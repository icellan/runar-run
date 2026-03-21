import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCompiler } from '../../contexts/CompilerContext';
import { useEditor } from '../../contexts/EditorContext';
import { ExecutionBridge, type ExecutionTrace, type MethodCallDef, type MethodArg } from '../../lib/execution-bridge';
import { Debugger } from '../debugger/Debugger';
import { ALICE, BOB, CHARLIE } from '../../examples/test-keys';

const MOCK_SATOSHIS = 100000;

interface ContractMethod {
  name: string;
  visibility: string;
  params: Array<{ name: string; type: { kind: string; name?: string } }>;
}

interface ABIMethod {
  name: string;
  isPublic: boolean;
  params: Array<{ name: string; type: string }>;
}

const TEST_KEY_ROTATION = [ALICE, BOB, CHARLIE];

const PUBKEY_TO_SIGNER: Record<string, string> = {
  [ALICE.pubKey]: 'alice',
  [BOB.pubKey]: 'bob',
  [CHARLIE.pubKey]: 'charlie',
};

/** Implicit ABI param names that the SDK/worker handles automatically */
const IMPLICIT_PARAMS = new Set(['txPreimage', '_changePKH', '_changeAmount', '_newAmount']);

function autoArgs(
  params: ContractMethod['params'],
  constructorArgs: Record<string, bigint | boolean | string>,
): MethodArg[] {
  let sigKeyIdx = 0;
  return params.map((p) => {
    const typeName = p.type.name ?? p.type.kind;
    switch (typeName) {
      case 'Sig': {
        const baseName = p.name.replace(/[Ss]ig$/, '');
        let signer: string | undefined;
        for (const suffix of ['PubKey', 'Pk', 'Key', 'pubKey', 'pubkey']) {
          const candidate = baseName + suffix;
          const pubKeyValue = constructorArgs[candidate];
          if (typeof pubKeyValue === 'string' && PUBKEY_TO_SIGNER[pubKeyValue]) {
            signer = PUBKEY_TO_SIGNER[pubKeyValue];
            break;
          }
        }
        if (!signer) {
          const key = TEST_KEY_ROTATION[sigKeyIdx % TEST_KEY_ROTATION.length]!;
          signer = key.name;
        }
        sigKeyIdx++;
        return { type: 'Sig' as const, signer };
      }
      case 'PubKey':
        return { type: 'PubKey' as const, value: ALICE.pubKey };
      case 'bigint': {
        // Try to find a related constructor arg and generate a value above it
        // e.g., param "bidAmount" → look for "highestBid", "threshold", "amount" in constructorArgs
        let bigintVal = '1';
        for (const [key, val] of Object.entries(constructorArgs)) {
          if (typeof val === 'bigint') {
            // Check if the param name relates to the constructor arg
            const paramLower = p.name.toLowerCase();
            const keyLower = key.toLowerCase();
            if (paramLower.includes('amount') || paramLower.includes('bid') ||
                paramLower.includes('value') || paramLower.includes('price') ||
                keyLower.includes(paramLower) || paramLower.includes(keyLower.replace('highest', '').replace('min', ''))) {
              bigintVal = String(val + 1n);
              break;
            }
          }
        }
        return { type: 'bigint' as const, value: bigintVal };
      }
      case 'boolean':
        return { type: 'boolean' as const, value: true };
      default:
        return { type: 'ByteString' as const, value: '00' };
    }
  });
}

export function ExecutionTab() {
  const { result, status } = useCompiler();
  const {
    methodCall: exampleMethodCall,
    unlockScriptHexOverride, setUnlockScriptHexOverride,
    constructorArgs, description,
    mockLocktime, setMockLocktime,
    source,
  } = useEditor();
  const bridgeRef = useRef<ExecutionBridge | null>(null);
  const [trace, setTrace] = useState<ExecutionTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [userMethodOverride, setUserMethodOverride] = useState<string | null>(null);
  const [userArgsOverride, setUserArgsOverride] = useState<MethodArg[] | null>(null);

  useEffect(() => {
    bridgeRef.current = new ExecutionBridge();
    return () => {
      bridgeRef.current?.terminate();
      bridgeRef.current = null;
    };
  }, []);

  const scriptHex = result?.scriptHex;

  const publicMethods = useMemo((): ContractMethod[] => {
    if (!result?.contract) return [];
    const contract = result.contract as { methods?: ContractMethod[] };
    return contract.methods?.filter(m => m.visibility === 'public') ?? [];
  }, [result?.contract]);

  const isStateful = useMemo(() => {
    if (!result?.contract) return false;
    const contract = result.contract as { parentClass?: string };
    return contract.parentClass === 'StatefulSmartContract';
  }, [result?.contract]);

  // Extract ABI methods from the artifact
  const abiMethods = useMemo((): ABIMethod[] => {
    if (!result?.artifact) return [];
    const artifact = result.artifact as { abi?: { methods?: ABIMethod[] } };
    return artifact.abi?.methods?.filter(m => m.isPublic) ?? [];
  }, [result?.artifact]);

  const codeSeparatorIndices = useMemo((): number[] | undefined => {
    if (!result?.artifact) return undefined;
    const artifact = result.artifact as { codeSeparatorIndices?: number[] };
    return artifact.codeSeparatorIndices;
  }, [result?.artifact]);

  const codeSeparatorIndex = useMemo((): number | undefined => {
    if (!result?.artifact) return undefined;
    const artifact = result.artifact as { codeSeparatorIndex?: number };
    return artifact.codeSeparatorIndex;
  }, [result?.artifact]);

  const selectedMethod = useMemo((): string => {
    if (userMethodOverride && publicMethods.some(m => m.name === userMethodOverride)) {
      return userMethodOverride;
    }
    if (exampleMethodCall && publicMethods.some(m => m.name === exampleMethodCall.method)) {
      return exampleMethodCall.method;
    }
    return publicMethods[0]?.name ?? '';
  }, [userMethodOverride, publicMethods, exampleMethodCall]);

  useEffect(() => {
    setUserMethodOverride(null);
    setUserArgsOverride(null);
  }, [exampleMethodCall]);

  // Reset args override when method changes
  useEffect(() => {
    setUserArgsOverride(null);
  }, [selectedMethod]);

  const methodCallDef = useMemo((): MethodCallDef | undefined => {
    if (!selectedMethod || publicMethods.length === 0) return undefined;

    const methodIndex = publicMethods.findIndex(m => m.name === selectedMethod);
    if (methodIndex < 0) return undefined;

    const method = publicMethods[methodIndex]!;

    // Get ABI params for this method (includes implicit params for stateful contracts)
    const abiMethod = abiMethods.find(m => m.name === selectedMethod);
    const abiParams = abiMethod?.params ?? method.params.map(p => ({
      name: p.name,
      type: p.type.name ?? p.type.kind,
    }));

    // Filter to user-visible params only (exclude implicit ones) for autoArgs
    const userVisibleParams = method.params.filter(p => !IMPLICIT_PARAMS.has(p.name));

    let args: MethodArg[];
    if (userArgsOverride) {
      args = userArgsOverride;
    } else if (exampleMethodCall && exampleMethodCall.method === selectedMethod) {
      args = exampleMethodCall.args;
    } else {
      args = autoArgs(userVisibleParams, constructorArgs);
    }

    const hasChangePKH = abiParams.some(p => p.name === '_changePKH');

    // Extract stateFields from artifact for stateful contracts
    const artifact = result?.artifact as {
      stateFields?: Array<{ name: string; type: string; index: number }>;
    } | undefined;
    const stateFields = artifact?.stateFields;

    // Compute expected new state values for state-mutating methods.
    // Start with constructor arg values (initial state), then override with method arg values
    // by matching common patterns (e.g., method assigns this.highestBidder = bidder arg).
    let newStateValues: Record<string, string> | undefined;
    if (stateFields && stateFields.length > 0 && hasChangePKH) {
      newStateValues = {};
      for (const sf of stateFields) {
        const initial = constructorArgs[sf.name];
        newStateValues[sf.name] = initial !== undefined
          ? (typeof initial === 'bigint' ? initial.toString() : String(initial))
          : '';
      }
      for (let i = 0; i < args.length && i < userVisibleParams.length; i++) {
        const paramName = userVisibleParams[i]!.name;
        const argValue = args[i]!;
        for (const sf of stateFields) {
          if (sf.name.toLowerCase().endsWith(paramName.toLowerCase()) ||
              sf.name.toLowerCase() === paramName.toLowerCase()) {
            if (argValue.type === 'bigint') newStateValues[sf.name] = argValue.value;
            else if (argValue.type === 'boolean') newStateValues[sf.name] = String(argValue.value);
            else if (argValue.type === 'PubKey' || argValue.type === 'ByteString') newStateValues[sf.name] = argValue.value;
          }
        }
      }
    }

    // Serialize constructor args for the worker (BigInt → string)
    const serializedCtorArgs: Record<string, string> = {};
    for (const [k, v] of Object.entries(constructorArgs)) {
      serializedCtorArgs[k] = typeof v === 'bigint' ? v.toString() + 'n' : String(v);
    }

    return {
      method: selectedMethod,
      args,
      publicMethodCount: publicMethods.length,
      methodIndex,
      codeSeparatorIndices,
      isStateful,
      abiParams,
      lockingScriptHex: scriptHex,
      codeSeparatorIndex,
      mockLocktime,
      stateFields,
      newStateValues,
      continuationSatoshis: MOCK_SATOSHIS,
      artifact: isStateful ? result?.artifact : undefined,
      constructorArgs: isStateful ? serializedCtorArgs : undefined,
    };
  }, [selectedMethod, publicMethods, exampleMethodCall, codeSeparatorIndices,
      constructorArgs, isStateful, abiMethods, scriptHex, codeSeparatorIndex, mockLocktime, userArgsOverride,
      result?.artifact]);

  const runExecution = useCallback(async () => {
    if (!bridgeRef.current || !scriptHex) return;
    setLoading(true);
    try {
      const res = await bridgeRef.current.execute(
        scriptHex,
        unlockScriptHexOverride || '',
        !unlockScriptHexOverride ? methodCallDef : undefined,
      );
      setTrace(res);
    } catch {
      setTrace(null);
    }
    setLoading(false);
  }, [scriptHex, unlockScriptHexOverride, methodCallDef]);

  // Re-execute when inputs change
  useEffect(() => {
    setTrace(null);
    if (scriptHex && methodCallDef) {
      runExecution().catch(() => {});
    }
  }, [scriptHex, unlockScriptHexOverride, methodCallDef]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMethodChange = useCallback((method: string) => {
    setUserMethodOverride(method);
  }, []);

  if (status === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm h-full">
        Write a contract to debug
      </div>
    );
  }

  if (status === 'compiling') {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm h-full">
        Compiling...
      </div>
    );
  }

  if (!result?.success) {
    const errors = result?.diagnostics.filter(d => d.severity === 'error') ?? [];
    const warnings = result?.diagnostics.filter(d => d.severity === 'warning') ?? [];
    const sourceLines = source.split('\n');

    const renderDiagnostic = (d: typeof errors[number], i: number, kind: 'error' | 'warning') => {
      const loc = (d as { loc?: { line?: number; column?: number } }).loc;
      const colorClass = kind === 'error' ? 'text-danger' : 'text-warning';

      return (
        <div key={`${kind[0]}${i}`} className="space-y-1">
          <div className="flex gap-2 text-xs">
            <span className={`${colorClass} shrink-0`}>{kind}</span>
            {loc?.line && (
              <span className="text-text-tertiary shrink-0">L{loc.line}:{loc.column ?? 0}</span>
            )}
            <span className="text-text-secondary">{d.message}</span>
          </div>
          {loc?.line && (
            <div className="ml-2 font-mono text-[11px] border-l-2 border-border pl-2">
              {(() => {
                const line = loc.line;
                const start = Math.max(0, line - 3);
                const end = Math.min(sourceLines.length, line + 2);
                return sourceLines.slice(start, end).map((text, idx) => {
                  const lineNum = start + idx + 1;
                  const isErrorLine = lineNum === line;
                  return (
                    <div
                      key={lineNum}
                      className={`flex ${isErrorLine ? 'bg-danger/10 text-danger rounded' : ''}`}
                    >
                      <span className="text-text-tertiary w-8 text-right shrink-0 select-none pr-2">
                        {lineNum}
                      </span>
                      <span className={isErrorLine ? 'text-danger' : 'text-text-tertiary'}>
                        {text || ' '}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 border-b border-border text-xs text-text-tertiary">
          {errors.length} error{errors.length !== 1 ? 's' : ''}
          {warnings.length > 0 && `, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          {errors.map((d, i) => renderDiagnostic(d, i, 'error'))}
          {warnings.map((d, i) => renderDiagnostic(d, i, 'warning'))}
        </div>
      </div>
    );
  }

  if (loading && !trace) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm h-full">
        Executing script...
      </div>
    );
  }

  return (
    <Debugger
      trace={trace}
      unlockScriptOverride={unlockScriptHexOverride}
      methodCallDef={methodCallDef}
      publicMethods={publicMethods}
      selectedMethod={selectedMethod}
      onMethodChange={handleMethodChange}
      description={description}
      constructorArgs={constructorArgs}
      isStateful={isStateful}
      mockLocktime={mockLocktime}
      onMockLocktimeChange={setMockLocktime}
      onArgsChange={setUserArgsOverride}
      onUnlockScriptChange={setUnlockScriptHexOverride}
      onRerun={runExecution}
    />
  );
}
