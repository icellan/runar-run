import { useState, useCallback, useEffect, useRef, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ExecutionTrace, MethodCallDef, MethodArg } from '../../lib/execution-bridge';

/** Input that uses local state while editing and only commits on blur or Enter */
function DeferredInput({ value, onCommit, className }: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const committed = useRef(value);

  // Sync from parent when the parent value changes (e.g., method switch)
  useEffect(() => {
    if (value !== committed.current) {
      setLocal(value);
      committed.current = value;
    }
  }, [value]);

  const commit = () => {
    if (local !== committed.current) {
      committed.current = local;
      onCommit(local);
    }
  };

  return (
    <input
      type="text"
      value={local}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === 'Enter') commit(); }}
      className={className}
    />
  );
}
import { DebugControls } from './DebugControls';
import { ScriptPanel } from './ScriptPanel';
import { StackPanel } from './StackPanel';
import { InputsPanel } from './InputsPanel';

interface ContractMethod {
  name: string;
  visibility: string;
  params: Array<{ name: string; type: { kind: string; name?: string } }>;
}

interface DebuggerProps {
  trace: ExecutionTrace | null;
  unlockScriptOverride: string;
  methodCallDef?: MethodCallDef;
  publicMethods: ContractMethod[];
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  description?: string;
  constructorArgs?: Record<string, bigint | boolean | string>;
  isStateful?: boolean;
  mockLocktime?: number;
  onMockLocktimeChange?: (locktime: number) => void;
  onArgsChange?: (args: MethodArg[]) => void;
  onUnlockScriptChange: (value: string) => void;
  onRerun: () => void;
}

export function Debugger({
  trace,
  unlockScriptOverride,
  methodCallDef,
  publicMethods,
  selectedMethod,
  onMethodChange,
  description,
  constructorArgs,
  isStateful,
  mockLocktime,
  onMockLocktimeChange,
  onArgsChange,
  onUnlockScriptChange,
  onRerun,
}: DebuggerProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [skipInactive, setSkipInactive] = useState(true);
  const playInterval = useRef<ReturnType<typeof setInterval>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSteps = trace?.snapshots.length ?? 0;
  const snapshot = currentStep >= 0 ? trace?.snapshots[currentStep] : undefined;

  /** Find the next non-skipped step forward from `from` */
  const nextActive = useCallback((from: number): number => {
    if (!skipInactive || !trace) return Math.min(from + 1, totalSteps - 1);
    let s = from + 1;
    while (s < totalSteps && trace.snapshots[s]?.skipped) s++;
    return Math.min(s, totalSteps - 1);
  }, [skipInactive, trace, totalSteps]);

  /** Find the next non-skipped step backward from `from` */
  const prevActive = useCallback((from: number): number => {
    if (!skipInactive || !trace) return Math.max(from - 1, -1);
    let s = from - 1;
    while (s >= 0 && trace.snapshots[s]?.skipped) s--;
    return Math.max(s, -1);
  }, [skipInactive, trace]);

  useEffect(() => {
    setCurrentStep(-1);
    setPlaying(false);
  }, [trace]);

  useEffect(() => {
    if (playing && trace) {
      playInterval.current = setInterval(() => {
        setCurrentStep((prev) => {
          const n = nextActive(prev);
          if (n >= totalSteps - 1) {
            setPlaying(false);
            return n;
          }
          return n;
        });
      }, speed);
    }
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, [playing, speed, totalSteps, trace, nextActive]);

  const reset = useCallback(() => { setCurrentStep(-1); setPlaying(false); }, []);
  const prev = useCallback(() => { setCurrentStep((s) => prevActive(s)); }, [prevActive]);
  const next = useCallback(() => { setCurrentStep((s) => nextActive(s)); }, [nextActive]);
  const play = useCallback(() => { setPlaying((p) => !p); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement) &&
          document.activeElement !== document.body) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      if (e.key === 'Home') { e.preventDefault(); reset(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next, reset]);

  const hasScript = trace && (trace.lockOpcodes.length > 0 || trace.unlockOpcodes.length > 0);

  // Get user-visible param names (exclude implicit ones)
  const implicitNames = new Set(['txPreimage', '_changePKH', '_changeAmount', '_newAmount']);
  const userParamNames = methodCallDef?.abiParams
    .filter(p => !implicitNames.has(p.name))
    .map(p => p.name) ?? [];

  const updateArg = useCallback((index: number, newArg: MethodArg) => {
    if (!methodCallDef || !onArgsChange) return;
    const newArgs = [...methodCallDef.args];
    newArgs[index] = newArg;
    onArgsChange(newArgs);
  }, [methodCallDef, onArgsChange]);

  return (
    <div ref={containerRef} className="h-full flex flex-col" tabIndex={-1}>
      {/* Context bar */}
      <div className="px-3 py-1.5 border-b border-border bg-surface shrink-0 space-y-1">
        {/* Method selector */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-text-tertiary shrink-0">Method:</span>
          {publicMethods.length > 1 ? (
            <select
              value={selectedMethod}
              onChange={(e) => onMethodChange(e.target.value)}
              className="h-6 px-1.5 text-xs font-mono bg-bg border border-border rounded
                         text-accent-400 cursor-pointer outline-none
                         hover:border-border-strong focus:border-accent-500/50 transition-colors
                         appearance-none pr-5"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
            >
              {publicMethods.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}({m.params.map(p => `${p.name}: ${p.type.name ?? p.type.kind}`).join(', ')})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-accent-400 font-mono">
              {selectedMethod}({publicMethods[0]?.params.map(p => `${p.name}: ${p.type.name ?? p.type.kind}`).join(', ')})
            </span>
          )}
          {!unlockScriptOverride && methodCallDef && (
            <span className="text-success text-[10px]">real signatures</span>
          )}
        </div>

        {/* Editable method args */}
        {methodCallDef && methodCallDef.args.length > 0 && (
          <div className="space-y-0.5">
            {methodCallDef.args.map((arg, i) => {
              const paramName = userParamNames[i] ?? `arg${i}`;
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="text-text-tertiary w-20 truncate shrink-0" title={paramName}>
                    {paramName}:
                  </span>
                  {arg.type === 'Sig' ? (
                    <span className="text-text-secondary font-mono text-[10px]">
                      {arg.signer}'s sig
                    </span>
                  ) : (
                    <DeferredInput
                      value={arg.type === 'boolean' ? String(arg.value) : arg.value}
                      onCommit={(raw) => {
                        if (arg.type === 'bigint') {
                          updateArg(i, { type: 'bigint', value: raw });
                        } else if (arg.type === 'boolean') {
                          updateArg(i, { type: 'boolean', value: raw === 'true' });
                        } else {
                          updateArg(i, { ...arg, value: raw } as MethodArg);
                        }
                      }}
                      className="flex-1 min-w-0 h-5 px-1.5 text-xs font-mono bg-bg border border-border rounded
                                 text-text-secondary focus:border-accent-500/50 focus:outline-none transition-colors"
                    />
                  )}
                  <span className="text-[9px] text-text-tertiary shrink-0">{arg.type}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Constructor args */}
        {constructorArgs && Object.keys(constructorArgs).length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-text-tertiary shrink-0">Constructor:</span>
            <div className="flex items-center gap-2 overflow-x-auto">
              {Object.entries(constructorArgs).map(([k, v]) => (
                <span key={k} className="text-text-secondary whitespace-nowrap">
                  <span className="text-text-tertiary">{k}=</span>
                  <span className="font-mono">
                    {typeof v === 'bigint' ? v.toString() : typeof v === 'string' && v.length > 16 ? v.slice(0, 16) + '\u2026' : String(v)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Locktime input (for stateful contracts) */}
        {isStateful && onMockLocktimeChange && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-text-tertiary shrink-0">Locktime:</span>
            <DeferredInput
              value={String(mockLocktime ?? 0)}
              onCommit={(raw) => onMockLocktimeChange(Number(raw) || 0)}
              className="w-24 h-5 px-1.5 text-xs font-mono bg-bg border border-border rounded
                         text-text-secondary focus:border-accent-500/50 focus:outline-none transition-colors"
            />
            <span className="text-text-tertiary text-[10px]">block height</span>
          </div>
        )}

        {description && (
          <div className="text-[10px] text-text-tertiary">{description}</div>
        )}
      </div>

      {/* Manual unlock script override */}
      <InputsPanel
        unlockScript={unlockScriptOverride}
        onChange={onUnlockScriptChange}
        onRerun={onRerun}
      />

      {/* Controls */}
      {totalSteps > 0 && (
        <DebugControls
          currentStep={currentStep}
          totalSteps={totalSteps}
          playing={playing}
          speed={speed}
          skipInactive={skipInactive}
          onReset={reset}
          onPrev={prev}
          onNext={next}
          onPlay={play}
          onSpeedChange={setSpeed}
          onSkipInactiveChange={setSkipInactive}
        />
      )}

      {/* Main debugger area */}
      {hasScript ? (
        <div className="flex-1 flex min-h-0">
          <div className="w-1/2 border-r border-border overflow-auto">
            <ScriptPanel trace={trace} currentStep={currentStep} />
          </div>
          <div className="w-1/2 overflow-auto">
            <StackPanel snapshot={snapshot ?? null} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
          {trace?.error ? (
            <div className="text-center px-4 max-w-md">
              <span className="text-danger">Execution error:</span>
              <div className="mt-1 text-text-secondary">{trace.error}</div>
            </div>
          ) : (
            'No script to execute'
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center h-6 px-3 text-xs border-t border-border bg-surface shrink-0">
        {snapshot ? (
          <>
            <span className="text-text-tertiary">
              {snapshot.context === 'UnlockingScript' ? 'Unlock' : 'Lock'} #{snapshot.pc}: {snapshot.opcode}
            </span>
            <span className={`ml-auto ${snapshot.error ? 'text-danger' : trace?.success ? 'text-success' : 'text-text-tertiary'}`}>
              {snapshot.error
                ? `Error: ${snapshot.error.slice(0, 50)}`
                : trace?.success
                  ? 'Script valid'
                  : totalSteps > 0 && currentStep === totalSteps - 1
                    ? 'Script failed'
                    : `Step ${currentStep + 1} / ${totalSteps}`}
            </span>
          </>
        ) : (
          <span className="text-text-tertiary">
            {trace?.error ?? `Step 0 / ${totalSteps}`}
          </span>
        )}
      </div>
    </div>
  );
}
