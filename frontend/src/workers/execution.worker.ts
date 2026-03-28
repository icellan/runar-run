/**
 * Execution Web Worker
 *
 * Runs @bsv/sdk's Spend class step-by-step and captures per-opcode
 * stack snapshots. Can build real unlocking scripts with valid ECDSA
 * signatures using pre-generated test keys.
 */

import {
  Spend, LockingScript, UnlockingScript, Script, OP,
  PrivateKey, TransactionSignature, Hash, Transaction,
} from '@bsv/sdk';
import {
  buildStatefulPreimage,
  buildContinuationOutput,
  serializeState,
} from 'runar-testing/dist/mock-preimage.js';
import type {
  ExecutionRequest, ExecutionResponse,
  OpcodeSnapshot, ScriptOpcode, ExecutionTrace,
  MethodCallDef, MethodArg,
} from '../lib/execution-bridge';

// ---------------------------------------------------------------------------
// Test keys (same as runar-testing/test-keys.ts)
// ---------------------------------------------------------------------------

const TEST_KEYS: Record<string, string> = {
  alice: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  bob: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  charlie: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  dave: 'cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe',
  eve: 'abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01abcdef01',
};

// ---------------------------------------------------------------------------
// Script encoding helpers (match runar-sdk/contract.ts encoding)
// ---------------------------------------------------------------------------

function encodePushData(dataHex: string): string {
  if (dataHex.length === 0) return '00'; // OP_0
  const len = dataHex.length / 2;

  if (len <= 75) {
    return len.toString(16).padStart(2, '0') + dataHex;
  } else if (len <= 0xff) {
    return '4c' + len.toString(16).padStart(2, '0') + dataHex;
  } else if (len <= 0xffff) {
    const lo = (len & 0xff).toString(16).padStart(2, '0');
    const hi = ((len >> 8) & 0xff).toString(16).padStart(2, '0');
    return '4d' + lo + hi + dataHex;
  }
  return '00';
}

function encodeScriptNumber(n: bigint): string {
  if (n === 0n) return '00';
  if (n >= 1n && n <= 16n) return (0x50 + Number(n)).toString(16);
  if (n === -1n) return '4f';

  const negative = n < 0n;
  let num = negative ? -n : n;
  const bytes: number[] = [];

  while (num > 0n) {
    bytes.push(Number(num & 0xffn));
    num >>= 8n;
  }

  if (bytes.length === 0) bytes.push(0);
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) {
    bytes.push(negative ? 0x80 : 0x00);
  } else if (negative) {
    bytes[bytes.length - 1]! |= 0x80;
  }

  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  return encodePushData(hex);
}

// Mock transaction parameters (deterministic for reproducible signatures)
const MOCK_TXID = '00'.repeat(32);
const MOCK_SATOSHIS = 100000;
const MOCK_VERSION = 2;       // BSV relaxed mode
const MOCK_SEQUENCE = 0xffffffff;
const SIGHASH_ALL_FORKID = 0x41;

// Alice's pubKeyHash for mock change outputs
const ALICE_PKH = '9a1c78a507689f6f54b847ad1cef1e614ee23f1e';

// ---------------------------------------------------------------------------
// State serialization for stateful contract continuation outputs
// ---------------------------------------------------------------------------

interface StateField {
  name: string;
  type: string;
  index: number;
}

/**
 * Serialize a state field value to hex bytes according to the Rúnar format:
 * - bigint → 8 bytes LE
 * - boolean → 1 byte
 * - PubKey → 33 bytes raw
 * - Sha256 → 32 bytes raw
 * - ByteString/Ripemd160/etc → push-data framing (variable)
 */
function serializeStateField(value: string, type: string): string {
  switch (type) {
    case 'bigint': {
      // 8-byte little-endian
      const n = BigInt(value || '0');
      const bytes = new Uint8Array(8);
      let v = n < 0n ? -n : n;
      for (let i = 0; i < 8; i++) {
        bytes[i] = Number(v & 0xffn);
        v >>= 8n;
      }
      if (n < 0n) bytes[7]! |= 0x80;
      return toHex(bytes);
    }
    case 'boolean':
      return value === 'true' || value === '1' ? '01' : '00';
    case 'PubKey':
      // 33-byte compressed pubkey, pad/truncate to 33
      return (value || '00'.repeat(33)).padEnd(66, '0').slice(0, 66);
    case 'Sha256':
      return (value || '00'.repeat(32)).padEnd(64, '0').slice(0, 64);
    case 'Point':
      return (value || '00'.repeat(64)).padEnd(128, '0').slice(0, 128);
    default: {
      // ByteString, Ripemd160, Addr, etc — variable length with push-data prefix
      const data = value || '';
      if (data.length === 0) return '00';
      return encodePushData(data);
    }
  }
}

/**
 * Build a continuation output script: codePart + OP_RETURN(0x6a) + serialized state
 */
function buildContinuationScript(
  codePartHex: string,
  stateFields: StateField[],
  stateValues: Record<string, string>,
): string {
  // Sort by index
  const sorted = [...stateFields].sort((a, b) => a.index - b.index);

  let stateHex = '';
  for (const field of sorted) {
    const value = stateValues[field.name] ?? '';
    stateHex += serializeStateField(value, field.type);
  }

  return codePartHex + '6a' + stateHex; // 0x6a = OP_RETURN
}

/**
 * Encode a varint (Bitcoin's CompactSize) as hex
 */
function varintHex(n: number): string {
  if (n < 0xfd) return n.toString(16).padStart(2, '0');
  if (n <= 0xffff) {
    return 'fd' +
      (n & 0xff).toString(16).padStart(2, '0') +
      ((n >> 8) & 0xff).toString(16).padStart(2, '0');
  }
  // Larger values unlikely for scripts
  return 'fe' +
    (n & 0xff).toString(16).padStart(2, '0') +
    ((n >> 8) & 0xff).toString(16).padStart(2, '0') +
    ((n >> 16) & 0xff).toString(16).padStart(2, '0') +
    ((n >> 24) & 0xff).toString(16).padStart(2, '0');
}

/**
 * Serialize a single output: amount(8-byte LE) + varint(scriptLen) + script
 */
function serializeOutput(satoshis: number, scriptHex: string): string {
  // Amount as 8-byte LE
  const amountBytes = new Uint8Array(8);
  let amt = BigInt(satoshis);
  for (let i = 0; i < 8; i++) {
    amountBytes[i] = Number(amt & 0xffn);
    amt >>= 8n;
  }
  const scriptLen = scriptHex.length / 2;
  return toHex(amountBytes) + varintHex(scriptLen) + scriptHex;
}

/**
 * Build mock outputs for a stateful method call and compute hashOutputs.
 * Returns the outputs array for the Spend constructor and the hashOutputs hex.
 */
function buildStatefulOutputs(
  methodCall: MethodCallDef,
): { outputs: Array<{ satoshis: number; lockingScript: LockingScript }>; hashOutputsHex?: string } {
  const hasChangePKH = methodCall.abiParams.some(p => p.name === '_changePKH');

  if (!hasChangePKH || !methodCall.stateFields || !methodCall.newStateValues) {
    return { outputs: [] };
  }

  // Get codePart: script up to the OP_RETURN separator
  // For the continuation output, codePart is the locking script portion that stays constant
  const codePartHex = methodCall.lockingScriptHex
    ? methodCall.lockingScriptHex.slice(0, (methodCall.codeSeparatorIndex ?? 0) * 2)
    : '';

  if (!codePartHex) return { outputs: [] };

  const satoshis = methodCall.continuationSatoshis ?? MOCK_SATOSHIS;
  const outputScript = buildContinuationScript(
    codePartHex,
    methodCall.stateFields,
    methodCall.newStateValues,
  );

  const outputLS = LockingScript.fromHex(outputScript);
  return {
    outputs: [{ satoshis, lockingScript: outputLS }],
  };
}

// ---------------------------------------------------------------------------

/** Common sighash preimage params for the mock Spend */
function mockSighashParams(
  subscript: LockingScript,
  lockTime = 0,
  outputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [],
) {
  return {
    sourceTXID: MOCK_TXID,
    sourceOutputIndex: 0,
    sourceSatoshis: MOCK_SATOSHIS,
    transactionVersion: MOCK_VERSION,
    otherInputs: [] as Array<{ sourceTXID: string; sourceOutputIndex: number; sequence: number }>,
    outputs,
    inputIndex: 0,
    subscript,
    inputSequence: MOCK_SEQUENCE,
    lockTime,
    scope: SIGHASH_ALL_FORKID,
  };
}

function getSubscript(
  lockingScript: LockingScript,
  methodIndex: number,
  codeSeparatorIndices?: number[],
  codeSeparatorIndex?: number,
): LockingScript {
  const fullHex = lockingScript.toHex();

  // Try per-method indices first
  if (codeSeparatorIndices && codeSeparatorIndices.length > 0) {
    const sepIdx = Math.min(methodIndex, codeSeparatorIndices.length - 1);
    const sepByteOffset = codeSeparatorIndices[sepIdx]!;
    return LockingScript.fromHex(fullHex.slice((sepByteOffset + 1) * 2));
  }

  // Fall back to single codeSeparatorIndex
  if (codeSeparatorIndex !== undefined) {
    return LockingScript.fromHex(fullHex.slice((codeSeparatorIndex + 1) * 2));
  }

  // No code separator — full script is the subscript
  return lockingScript;
}

function toHex(bytes: number[] | Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a real ECDSA signature valid for the mock Spend context.
 */
function createSignature(
  privKeyHex: string,
  subscript: LockingScript,
  lockTime = 0,
  outputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [],
): string {
  const privKey = PrivateKey.fromString(privKeyHex, 16);
  const params = mockSighashParams(subscript, lockTime, outputs);
  const preimageBytes = TransactionSignature.format(params);

  const sighash = Hash.sha256(preimageBytes);
  const sig = privKey.sign(sighash);
  const txSig = new TransactionSignature(sig.r, sig.s, SIGHASH_ALL_FORKID);
  return toHex(txSig.toChecksigFormat());
}

/**
 * Create the "push tx" signature for stateful contracts.
 * Signs with private key = 1 (generator point G) to satisfy checkPreimage.
 */
function createPushTxSig(
  subscript: LockingScript,
  lockTime = 0,
  outputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [],
): string {
  const privKey = PrivateKey.fromString(
    '0000000000000000000000000000000000000000000000000000000000000001', 16,
  );
  return createSignature(privKey.toHex(), subscript, lockTime, outputs);
}

/**
 * Compute the BIP-143 sighash preimage bytes for the mock transaction.
 * Pushed onto the stack for stateful contracts so they can extract fields.
 */
function createMockPreimage(
  subscript: LockingScript,
  lockTime = 0,
  outputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [],
): string {
  const params = mockSighashParams(subscript, lockTime, outputs);
  const preimageBytes = TransactionSignature.format(params);
  return toHex(preimageBytes);
}

/**
 * Build unlocking script hex from a typed method call definition.
 *
 * For stateless contracts: pushes user args + method selector.
 * For stateful contracts: pushes implicit params (_codePart, _opPushTxSig,
 * _changePKH, _changeAmount, _newAmount, txPreimage) around the user args,
 * matching the exact stack layout the compiler expects.
 *
 * Stack order (bottom to top):
 *   [_codePart] [_opPushTxSig] <userArgs...> [_changePKH _changeAmount] [_newAmount] [txPreimage] [methodSelector]
 */
function buildUnlockingScript(
  methodCall: MethodCallDef,
  lockingScript: LockingScript,
): { unlockHex: string; statefulLockingScriptHex: string | undefined; outputs: Array<{ satoshis: number; lockingScript: LockingScript }> } {
  let script = '';
  const lockTime = methodCall.mockLocktime;

  const subscript = getSubscript(
    lockingScript,
    methodCall.methodIndex,
    methodCall.codeSeparatorIndices,
    methodCall.codeSeparatorIndex,
  );

  // Detect implicit params from ABI
  const hasPreimage = methodCall.abiParams.some(p => p.name === 'txPreimage');
  const hasChangePKH = methodCall.abiParams.some(p => p.name === '_changePKH');
  const hasNewAmount = methodCall.abiParams.some(p => p.name === '_newAmount');

  // --- For stateful contracts, use buildStatefulPreimage from runar-testing ---
  let statefulResult: { preimageHex: string; signatureHex: string; codePart: string; lockingScript: string } | undefined;

  if (hasPreimage && methodCall.artifact && methodCall.constructorArgs) {
    // Deserialize constructor args (string values back to proper types)
    const ctorArgs: Record<string, bigint | boolean | string> = {};
    for (const [k, v] of Object.entries(methodCall.constructorArgs)) {
      if (v === 'true') ctorArgs[k] = true;
      else if (v === 'false') ctorArgs[k] = false;
      else if (/^\d+n?$/.test(v)) ctorArgs[k] = BigInt(v.replace(/n$/, ''));
      else ctorArgs[k] = v;
    }

    // Build initial state from constructor args (mutable fields only)
    const stateFields = methodCall.stateFields ?? [];
    const state: Record<string, bigint | boolean | string> = {};
    for (const sf of stateFields) {
      if (ctorArgs[sf.name] !== undefined) state[sf.name] = ctorArgs[sf.name]!;
      else state[sf.name] = sf.type === 'bigint' ? 0n : '';
    }

    // Compute new state from method args
    const implicitNames = new Set(['txPreimage', '_changePKH', '_changeAmount', '_newAmount']);
    const userParamNames = methodCall.abiParams.filter(p => !implicitNames.has(p.name)).map(p => p.name);
    const newState = { ...state };
    if (hasChangePKH && methodCall.newStateValues) {
      for (const [k, v] of Object.entries(methodCall.newStateValues)) {
        if (/^\d+$/.test(v)) newState[k] = BigInt(v);
        else newState[k] = v;
      }
    }

    try {
      // Pass empty constructorArgs — the compiler already baked values into
      // artifact.script, so buildCodePart should NOT re-substitute.
      statefulResult = buildStatefulPreimage({
        artifact: methodCall.artifact as any,
        constructorArgs: {},
        state,
        methodIndex: methodCall.methodIndex,
        satoshis: BigInt(MOCK_SATOSHIS),
        newState: hasChangePKH ? newState : undefined,
        version: MOCK_VERSION,
        locktime: lockTime,
        sequence: MOCK_SEQUENCE,
      });
    } catch (e) {
      console.warn('[exec-worker] buildStatefulPreimage failed:', e);
    }
  }

  // --- Stateful prefix: _codePart + _opPushTxSig ---
  if (hasPreimage && statefulResult) {
    if (hasChangePKH) {
      script += encodePushData(statefulResult.codePart);
    }
    script += encodePushData(statefulResult.signatureHex);
  } else if (hasPreimage) {
    // Fallback to manual construction
    if (hasChangePKH && methodCall.codeSeparatorIndex !== undefined && methodCall.lockingScriptHex) {
      script += encodePushData(methodCall.lockingScriptHex.slice(0, methodCall.codeSeparatorIndex * 2));
    }
    script += encodePushData(createPushTxSig(subscript, lockTime));
  }

  // --- User parameters ---
  const implicitNames = new Set(['txPreimage', '_changePKH', '_changeAmount', '_newAmount']);
  const userParams = methodCall.abiParams.filter(p => !implicitNames.has(p.name));

  // For signatures, use the stateful locking script and matching outputs
  const sigSubscript = statefulResult
    ? getSubscript(LockingScript.fromHex(statefulResult.lockingScript), methodCall.methodIndex, methodCall.codeSeparatorIndices, methodCall.codeSeparatorIndex)
    : subscript;

  // Build continuation outputs for user sig computation (must match Spend's outputs)
  let sigOutputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [];
  if (statefulResult && hasChangePKH && methodCall.stateFields && methodCall.newStateValues) {
    const newStateForOutput: Record<string, unknown> = {};
    const ctorArgs = methodCall.constructorArgs ?? {};
    for (const sf of methodCall.stateFields) {
      const initial = ctorArgs[sf.name];
      if (initial !== undefined) {
        if (/^\d+n?$/.test(initial)) newStateForOutput[sf.name] = BigInt(initial.replace(/n$/, ''));
        else newStateForOutput[sf.name] = initial;
      } else {
        newStateForOutput[sf.name] = sf.type === 'bigint' ? 0n : '';
      }
    }
    for (const [k, v] of Object.entries(methodCall.newStateValues)) {
      if (/^\d+$/.test(v)) newStateForOutput[k] = BigInt(v);
      else newStateForOutput[k] = v;
    }
    const artifact = methodCall.artifact as { script?: string } | undefined;
    const codePart = artifact?.script ?? '';
    const stateHex = serializeState(methodCall.stateFields, newStateForOutput);
    const outputScriptHex = codePart + '6a' + stateHex;
    sigOutputs = [{ satoshis: MOCK_SATOSHIS, lockingScript: LockingScript.fromHex(outputScriptHex) }];
  }

  for (let i = 0; i < methodCall.args.length && i < userParams.length; i++) {
    const arg = methodCall.args[i]!;
    switch (arg.type) {
      case 'ByteString':
      case 'PubKey':
        script += encodePushData(arg.value);
        break;
      case 'Sig': {
        const privKeyHex = TEST_KEYS[arg.signer];
        if (!privKeyHex) throw new Error(`Unknown test key signer: ${arg.signer}`);
        script += encodePushData(createSignature(privKeyHex, sigSubscript, lockTime, sigOutputs));
        break;
      }
      case 'bigint':
        script += encodeScriptNumber(BigInt(arg.value));
        break;
      case 'boolean':
        script += arg.value ? '51' : '00';
        break;
    }
  }

  // --- Stateful suffix: _changePKH, _changeAmount, _newAmount, txPreimage ---
  if (hasPreimage && statefulResult) {
    if (hasChangePKH) {
      script += encodePushData(ALICE_PKH);
      script += encodeScriptNumber(0n);
    }
    if (hasNewAmount) {
      script += encodeScriptNumber(BigInt(MOCK_SATOSHIS));
    }
    script += encodePushData(statefulResult.preimageHex);
  } else if (hasPreimage) {
    if (hasChangePKH) {
      script += encodePushData(ALICE_PKH);
      script += encodeScriptNumber(0n);
    }
    if (hasNewAmount) {
      script += encodeScriptNumber(BigInt(MOCK_SATOSHIS));
    }
    script += encodePushData(createMockPreimage(subscript, lockTime));
  }

  // --- Method selector (if multi-method) ---
  if (methodCall.publicMethodCount > 1) {
    script += encodeScriptNumber(BigInt(methodCall.methodIndex));
  }

  return {
    unlockHex: script,
    statefulLockingScriptHex: statefulResult?.lockingScript,
    outputs: sigOutputs,
  };
}

// ---------------------------------------------------------------------------
// Script parsing and execution (unchanged)
// ---------------------------------------------------------------------------

interface Chunk { op: number; data?: number[] }

function getChunks(script: Script): Chunk[] {
  try {
    return script.chunks as Chunk[];
  } catch {
    return [];
  }
}

function opName(op: number): string {
  for (const [name, value] of Object.entries(OP)) {
    if (value === op && name.startsWith('OP_')) return name;
  }
  if (op >= 1 && op <= 75) return `PUSH_${op}`;
  return `0x${op.toString(16).padStart(2, '0')}`;
}

function parseScript(
  chunks: Chunk[],
  context: 'UnlockingScript' | 'LockingScript',
): ScriptOpcode[] {
  return chunks.map((chunk, index) => ({
    index,
    name: opName(chunk.op),
    op: chunk.op,
    data: chunk.data,
    context,
  }));
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

// Cached execution state for on-demand stack retrieval
let cachedSpendParams: {
  lockingScript: LockingScript;
  unlockingScript: UnlockingScript;
  outputs: Array<{ satoshis: number; lockingScript: LockingScript }>;
  lockTime: number;
} | null = null;

self.addEventListener('message', (e: MessageEvent<ExecutionRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    self.postMessage({ type: 'ready' } satisfies ExecutionResponse);
    return;
  }

  if (msg.type === 'getStack') {
    if (!cachedSpendParams) {
      self.postMessage({ type: 'stackResult', step: msg.step, stack: [], altStack: [] } satisfies ExecutionResponse);
      return;
    }
    try {
      const { lockingScript: ls, unlockingScript: us, outputs, lockTime } = cachedSpendParams;
      const spend = new Spend({
        sourceTXID: MOCK_TXID,
        sourceOutputIndex: 0,
        sourceSatoshis: MOCK_SATOSHIS,
        lockingScript: ls,
        unlockingScript: us,
        transactionVersion: MOCK_VERSION,
        otherInputs: [],
        outputs,
        inputIndex: 0,
        inputSequence: MOCK_SEQUENCE,
        lockTime,
      });
      // Step through to the requested position
      for (let i = 0; i <= msg.step; i++) {
        try { if (!spend.step()) break; } catch { break; }
      }
      self.postMessage({
        type: 'stackResult',
        step: msg.step,
        stack: spend.stack.map(item => [...item]),
        altStack: spend.altStack.map(item => [...item]),
      } satisfies ExecutionResponse);
    } catch {
      self.postMessage({ type: 'stackResult', step: msg.step, stack: [], altStack: [] } satisfies ExecutionResponse);
    }
    return;
  }

  if (msg.type === 'execute') {
    try {
      let lockingScript: LockingScript;
      try {
        lockingScript = LockingScript.fromHex(msg.lockingScriptHex);
      } catch (e) {
        const hexPreview = msg.lockingScriptHex?.slice(0, 40) ?? '(empty)';
        throw new Error(`Invalid locking script hex (${hexPreview}...): ${e instanceof Error ? e.message : e}`);
      }

      // Determine unlocking script: manual hex override or build from method call
      let unlockHex = msg.unlockingScriptHex || '';
      let mockOutputs: Array<{ satoshis: number; lockingScript: LockingScript }> = [];
      if (!unlockHex && msg.methodCall) {
        const built = buildUnlockingScript(msg.methodCall, lockingScript);
        unlockHex = built.unlockHex;
        mockOutputs = built.outputs;
        if (built.statefulLockingScriptHex) {
          try {
            lockingScript = LockingScript.fromHex(built.statefulLockingScriptHex);
          } catch (e) {
            const hexPreview = built.statefulLockingScriptHex?.slice(0, 40) ?? '(empty)';
            throw new Error(`Invalid stateful locking script hex (${hexPreview}...): ${e instanceof Error ? e.message : e}`);
          }
        }
      }

      const unlockingScript = unlockHex
        ? UnlockingScript.fromHex(unlockHex)
        : new UnlockingScript();

      const unlockChunks = getChunks(unlockingScript);
      const lockChunks = getChunks(lockingScript);

      const unlockOpcodes = parseScript(unlockChunks, 'UnlockingScript');
      const lockOpcodes = parseScript(lockChunks, 'LockingScript');

      if (lockChunks.length === 0) {
        self.postMessage({
          type: 'trace',
          data: { snapshots: [], unlockOpcodes, lockOpcodes, success: false, error: 'Empty locking script' },
        } satisfies ExecutionResponse);
        return;
      }

      // Cache params for on-demand stack retrieval
      const lockTime = msg.methodCall?.mockLocktime ?? 0;
      cachedSpendParams = { lockingScript, unlockingScript, outputs: mockOutputs, lockTime };

      const spend = new Spend({
        sourceTXID: MOCK_TXID,
        sourceOutputIndex: 0,
        sourceSatoshis: MOCK_SATOSHIS,
        lockingScript,
        unlockingScript,
        transactionVersion: MOCK_VERSION,
        otherInputs: [],
        outputs: mockOutputs,
        inputIndex: 0,
        inputSequence: MOCK_SEQUENCE,
        lockTime,
      });

      const snapshots: OpcodeSnapshot[] = [];
      let error: string | null = null;

      try {
        let continuing = true;
        // Track opcode index within each context independently
        let unlockIdx = 0;
        let lockIdx = 0;

        while (continuing) {
          const context = spend.context as 'UnlockingScript' | 'LockingScript';
          const isUnlock = context === 'UnlockingScript';
          const chunks = isUnlock ? unlockChunks : lockChunks;
          const idx = isUnlock ? unlockIdx : lockIdx;
          const chunk = chunks[idx];
          const opcodeNum = chunk?.op ?? 0;

          // Check if we're inside a non-taken IF branch (ifStack contains false)
          const skipped = spend.ifStack.includes(false);

          continuing = spend.step();

          snapshots.push({
            pc: idx,
            context,
            opcode: opName(opcodeNum),
            opcodeHex: opcodeNum,
            data: chunk?.data ? [...chunk.data] : undefined,
            stack: [],   // populated on demand via getStack
            altStack: [], // populated on demand via getStack
            skipped,
          });

          if (isUnlock) unlockIdx++;
          else lockIdx++;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        error = errMsg;

        const errObj = err as {
          programCounter?: number;
          context?: string;
          stackState?: number[][];
          altStackState?: number[][];
        };

        snapshots.push({
          pc: errObj.programCounter ?? spend.programCounter,
          context: (errObj.context ?? spend.context) as 'UnlockingScript' | 'LockingScript',
          opcode: 'ERROR',
          opcodeHex: 0,
          stack: errObj.stackState?.map(item => [...item]) ?? spend.stack.map(item => [...item]),
          altStack: errObj.altStackState?.map(item => [...item]) ?? spend.altStack.map(item => [...item]),
          skipped: false,
          error: errMsg,
        });
      }

      self.postMessage({
        type: 'trace',
        data: { snapshots, unlockOpcodes, lockOpcodes, success: !error, error },
      } satisfies ExecutionResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', message } satisfies ExecutionResponse);
    }
  }
});
