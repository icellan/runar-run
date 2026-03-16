/**
 * Typed message protocol for the execution (script debugger) Web Worker.
 */

export interface OpcodeSnapshot {
  /** Program counter within current script context */
  pc: number;
  context: 'UnlockingScript' | 'LockingScript';
  /** Human-readable opcode name (e.g. OP_DUP, PUSH_5) */
  opcode: string;
  /** Raw opcode byte */
  opcodeHex: number;
  /** Data pushed by this opcode (if any) */
  data?: number[];
  /** Main stack state AFTER this opcode executed */
  stack: number[][];
  /** Alt stack state AFTER this opcode executed */
  altStack: number[][];
  /** Whether this opcode was skipped (inside a non-taken IF branch) */
  skipped: boolean;
  /** Error message if this step failed */
  error?: string;
}

/** A parsed opcode from a script (for display, independent of execution) */
export interface ScriptOpcode {
  /** Index in the chunk array */
  index: number;
  /** Human-readable name */
  name: string;
  /** Raw opcode byte */
  op: number;
  /** Data bytes (for push operations) */
  data?: number[];
  /** Which script this belongs to */
  context: 'UnlockingScript' | 'LockingScript';
}

export interface ExecutionTrace {
  snapshots: OpcodeSnapshot[];
  /** Full parsed opcode list for unlocking script */
  unlockOpcodes: ScriptOpcode[];
  /** Full parsed opcode list for locking script */
  lockOpcodes: ScriptOpcode[];
  success: boolean;
  error: string | null;
}

/** A typed argument for building unlock scripts with real signatures */
export type MethodArg =
  | { type: 'ByteString'; value: string }
  | { type: 'PubKey'; value: string }
  | { type: 'Sig'; signer: string }
  | { type: 'bigint'; value: string }
  | { type: 'boolean'; value: boolean };

export interface MethodCallDef {
  method: string;
  args: MethodArg[];
  /** Total number of public methods in the contract (for method selector) */
  publicMethodCount: number;
  /** Index of this method among public methods */
  methodIndex: number;
  /** Per-method OP_CODESEPARATOR byte offsets from the artifact (if available) */
  codeSeparatorIndices?: number[];
  /** Whether this is a stateful contract (extends StatefulSmartContract) */
  isStateful: boolean;
  /** Full ABI params for this method (includes implicit ones like txPreimage, _changePKH) */
  abiParams: Array<{ name: string; type: string }>;
  /** Locking script hex (needed for _codePart computation) */
  lockingScriptHex?: string;
  /** codeSeparatorIndex byte offset from the artifact */
  codeSeparatorIndex?: number;
  /** Mock locktime for the transaction (block height, for extractLocktime) */
  mockLocktime: number;
  /** State fields from the artifact (for building continuation outputs) */
  stateFields?: Array<{ name: string; type: string; index: number }>;
  /** Expected post-call state values (for computing hashOutputs) */
  newStateValues?: Record<string, string>;
  /** Satoshis for the continuation output */
  continuationSatoshis?: number;
  /** The full compiled artifact (for buildStatefulPreimage) */
  artifact?: unknown;
  /** Constructor args (for buildStatefulPreimage) */
  constructorArgs?: Record<string, string>;
}

// Messages sent TO the worker
export type ExecutionRequest =
  | {
      type: 'execute';
      lockingScriptHex: string;
      /** Raw hex override — used if provided, bypasses methodCall */
      unlockingScriptHex: string;
      /** Typed method call — used to generate real signatures if no hex override */
      methodCall?: MethodCallDef;
    }
  | { type: 'init' };

// Messages sent FROM the worker
export type ExecutionResponse =
  | { type: 'ready' }
  | { type: 'trace'; data: ExecutionTrace }
  | { type: 'error'; message: string };

/**
 * Manages the execution worker lifecycle.
 */
export class ExecutionBridge {
  private worker: Worker;
  private ready: Promise<void>;
  private pendingResolve: ((result: ExecutionTrace) => void) | null = null;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/execution.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.ready = new Promise<void>((resolve) => {
      const handler = (e: MessageEvent<ExecutionResponse>) => {
        if (e.data.type === 'ready') {
          resolve();
          this.worker.removeEventListener('message', handler);
          this.worker.addEventListener('message', this.handleMessage);
        }
      };
      this.worker.addEventListener('message', handler);
    });

    this.worker.postMessage({ type: 'init' } satisfies ExecutionRequest);
  }

  private handleMessage = (e: MessageEvent<ExecutionResponse>) => {
    const msg = e.data;
    if (msg.type === 'trace' && this.pendingResolve) {
      this.pendingResolve(msg.data);
      this.pendingResolve = null;
    } else if (msg.type === 'error' && this.pendingResolve) {
      this.pendingResolve({
        snapshots: [],
        unlockOpcodes: [],
        lockOpcodes: [],
        success: false,
        error: msg.message,
      });
      this.pendingResolve = null;
    }
  };

  async execute(
    lockingScriptHex: string,
    unlockingScriptHex: string,
    methodCall?: MethodCallDef,
  ): Promise<ExecutionTrace> {
    await this.ready;
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.worker.postMessage({
        type: 'execute',
        lockingScriptHex,
        unlockingScriptHex,
        methodCall,
      } satisfies ExecutionRequest);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
