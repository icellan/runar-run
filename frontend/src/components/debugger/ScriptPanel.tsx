import { useEffect, useRef, useMemo } from 'react';
import type { ExecutionTrace, ScriptOpcode } from '../../lib/execution-bridge';
import { getOpcodeColor } from '../../lib/opcode-meta';

interface ScriptPanelProps {
  trace: ExecutionTrace;
  currentStep: number;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compute indentation depth for each opcode based on IF/ELSE/ENDIF nesting */
function computeIndents(opcodes: ScriptOpcode[]): number[] {
  const indents: number[] = [];
  let depth = 0;

  for (const op of opcodes) {
    if (op.name === 'OP_ELSE' || op.name === 'OP_ENDIF') {
      depth = Math.max(0, depth - 1);
    }

    indents.push(depth);

    if (op.name === 'OP_IF' || op.name === 'OP_NOTIF' || op.name === 'OP_ELSE') {
      depth++;
    }
  }

  return indents;
}

export function ScriptPanel({ trace, currentStep }: ScriptPanelProps) {
  const { unlockOpcodes, lockOpcodes, snapshots } = trace;
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentStep]);

  const unlockIndents = useMemo(() => computeIndents(unlockOpcodes), [unlockOpcodes]);
  const lockIndents = useMemo(() => computeIndents(lockOpcodes), [lockOpcodes]);

  const renderOpcode = (op: ScriptOpcode, flatIndex: number, indent: number) => {
    const active = flatIndex === currentStep;
    const executed = flatIndex <= currentStep;
    const snap = flatIndex < snapshots.length ? snapshots[flatIndex] : undefined;
    const hasError = !!snap?.error;
    const isSkipped = !!snap?.skipped;

    return (
      <div
        key={`${op.context}-${op.index}`}
        ref={active ? activeRef : undefined}
        className={`flex items-baseline gap-2 px-2 py-px rounded transition-colors duration-100 ${
          active
            ? hasError ? 'bg-danger/15'
            : isSkipped ? 'bg-neutral-500/5'
            : 'bg-accent-500/10'
            : ''
        }`}
      >
        <span className={`w-3 text-center shrink-0 text-[10px] ${
          active ? isSkipped ? 'text-text-tertiary' : 'text-accent-400' : ''
        }`}>
          {active ? (isSkipped ? '\u00B7' : '\u25B6') : ''}
        </span>

        <span className="text-text-tertiary w-5 text-right shrink-0 select-none text-[10px]">
          {op.index}
        </span>

        <span
          style={{
            paddingLeft: indent * 12,
            color: hasError ? 'var(--color-danger)'
              : isSkipped && executed ? 'var(--color-neutral-500)'
              : getOpcodeColor(op.name),
          }}
          className={
            isSkipped && executed ? 'line-through opacity-50'
            : !executed ? 'opacity-40'
            : executed && !active ? 'opacity-70'
            : ''
          }
        >
          {op.name}
        </span>

        {/* Skipped label */}
        {active && isSkipped && (
          <span className="text-[9px] text-text-tertiary italic">skipped</span>
        )}

        {op.data && op.data.length > 0 && !isSkipped && (
          <span className={`text-text-tertiary text-[10px] truncate max-w-[120px] ${!executed ? 'opacity-40' : ''}`}>
            {bytesToHex(op.data).length > 16
              ? bytesToHex(op.data).slice(0, 16) + '\u2026'
              : bytesToHex(op.data)}
          </span>
        )}
      </div>
    );
  };

  let flatIndex = 0;

  return (
    <div className="p-2 font-mono text-xs">
      {unlockOpcodes.length > 0 && (
        <>
          <div className="text-[10px] text-accent-500/60 uppercase tracking-wide mb-0.5 px-2 flex items-center gap-2">
            <span>Unlocking Script</span>
            <span className="text-text-tertiary">({unlockOpcodes.length} ops)</span>
          </div>
          {unlockOpcodes.map((op, i) => {
            const el = renderOpcode(op, flatIndex, unlockIndents[i] ?? 0);
            flatIndex++;
            return el;
          })}
          <div className="border-t border-border my-1.5" />
        </>
      )}

      <div className="text-[10px] text-accent-500/60 uppercase tracking-wide mb-0.5 px-2 flex items-center gap-2">
        <span>Locking Script</span>
        <span className="text-text-tertiary">({lockOpcodes.length} ops)</span>
      </div>
      {lockOpcodes.map((op, i) => {
        const el = renderOpcode(op, flatIndex, lockIndents[i] ?? 0);
        flatIndex++;
        return el;
      })}

      {trace.error && (
        <div className="mt-2 px-2 py-1.5 bg-danger/10 border border-danger/20 rounded text-danger text-[11px]">
          {trace.error}
        </div>
      )}
    </div>
  );
}
