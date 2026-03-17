import { useEffect, useRef, useMemo, useState } from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import type { ExecutionTrace, ScriptOpcode, OpcodeSnapshot } from '../../lib/execution-bridge';
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

/** Pre-compute hex strings for opcode data to avoid doing it in render */
function precomputeDataHex(opcodes: ScriptOpcode[]): (string | undefined)[] {
  return opcodes.map(op => {
    if (!op.data || op.data.length === 0) return undefined;
    const hex = bytesToHex(op.data);
    return hex.length > 16 ? hex.slice(0, 16) + '\u2026' : hex;
  });
}

interface FlatEntry {
  type: 'header' | 'separator' | 'opcode';
  flatIndex: number;
  indent: number;
  label?: string;
  count?: number;
}

interface OpcodeRowProps {
  entries: FlatEntry[];
  currentStep: number;
  allOpcodes: ScriptOpcode[];
  allDataHex: (string | undefined)[];
  allColors: string[];
  snapshots: OpcodeSnapshot[];
}

const ROW_HEIGHT = 22;

function OpcodeRow({
  index, style, entries, currentStep, allOpcodes, allDataHex, allColors, snapshots,
}: RowComponentProps<OpcodeRowProps>) {
  const entry = entries[index]!;

  if (entry.type === 'header') {
    return (
      <div style={style} className="text-[10px] text-accent-500/60 uppercase tracking-wide px-2 flex items-center gap-2 pt-1">
        <span>{entry.label}</span>
        <span className="text-text-tertiary">({entry.count} ops)</span>
      </div>
    );
  }

  if (entry.type === 'separator') {
    return (
      <div style={style} className="flex items-center px-2">
        <div className="border-t border-border w-full" />
      </div>
    );
  }

  const flatIdx = entry.flatIndex;
  const op = allOpcodes[flatIdx]!;
  const active = flatIdx === currentStep;
  const executed = flatIdx <= currentStep;
  const snap = flatIdx < snapshots.length ? snapshots[flatIdx] : undefined;
  const hasError = !!snap?.error;
  const isSkipped = !!snap?.skipped;
  const dataHex = allDataHex[flatIdx];

  return (
    <div
      style={style}
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
          paddingLeft: entry.indent * 12,
          color: hasError ? 'var(--color-danger)'
            : isSkipped && executed ? 'var(--color-neutral-500)'
            : allColors[flatIdx],
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

      {active && isSkipped && (
        <span className="text-[9px] text-text-tertiary italic">skipped</span>
      )}

      {dataHex && !isSkipped && (
        <span className={`text-text-tertiary text-[10px] truncate max-w-[120px] ${!executed ? 'opacity-40' : ''}`}>
          {dataHex}
        </span>
      )}
    </div>
  );
}

export function ScriptPanel({ trace, currentStep }: ScriptPanelProps) {
  const { unlockOpcodes, lockOpcodes, snapshots } = trace;
  const listRef = useListRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const unlockIndents = useMemo(() => computeIndents(unlockOpcodes), [unlockOpcodes]);
  const lockIndents = useMemo(() => computeIndents(lockOpcodes), [lockOpcodes]);

  const allOpcodes = useMemo(() => [...unlockOpcodes, ...lockOpcodes], [unlockOpcodes, lockOpcodes]);
  const allColors = useMemo(() => allOpcodes.map(op => getOpcodeColor(op.name)), [allOpcodes]);
  const allDataHex = useMemo(() => precomputeDataHex(allOpcodes), [allOpcodes]);

  const entries = useMemo(() => {
    const result: FlatEntry[] = [];
    let flatIndex = 0;

    if (unlockOpcodes.length > 0) {
      result.push({ type: 'header', flatIndex: -1, indent: 0, label: 'Unlocking Script', count: unlockOpcodes.length });
      for (let i = 0; i < unlockOpcodes.length; i++) {
        result.push({ type: 'opcode', flatIndex, indent: unlockIndents[i] ?? 0 });
        flatIndex++;
      }
      result.push({ type: 'separator', flatIndex: -1, indent: 0 });
    }

    result.push({ type: 'header', flatIndex: -1, indent: 0, label: 'Locking Script', count: lockOpcodes.length });
    for (let i = 0; i < lockOpcodes.length; i++) {
      result.push({ type: 'opcode', flatIndex, indent: lockIndents[i] ?? 0 });
      flatIndex++;
    }

    return result;
  }, [unlockOpcodes, lockOpcodes, unlockIndents, lockIndents]);

  // Scroll active row into view
  useEffect(() => {
    if (currentStep < 0 || !listRef.current) return;
    const rowIndex = entries.findIndex(e => e.type === 'opcode' && e.flatIndex === currentStep);
    if (rowIndex >= 0) {
      listRef.current.scrollToRow({ index: rowIndex, align: 'smart' });
    }
  }, [currentStep, entries, listRef]);

  const rowProps = useMemo<OpcodeRowProps>(() => ({
    entries,
    currentStep,
    allOpcodes,
    allDataHex,
    allColors,
    snapshots,
  }), [entries, currentStep, allOpcodes, allDataHex, allColors, snapshots]);

  const totalOpcodes = unlockOpcodes.length + lockOpcodes.length;

  // For small scripts, render without virtualization
  if (totalOpcodes <= 200) {
    return <ScriptPanelSimple trace={trace} currentStep={currentStep} />;
  }

  return (
    <div ref={containerRef} className="h-full font-mono text-xs">
      <List
        listRef={listRef}
        rowCount={entries.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={OpcodeRow}
        rowProps={rowProps}
        overscanCount={20}
      >
        {null}
      </List>

      {trace.error && (
        <div className="mt-2 px-2 py-1.5 bg-danger/10 border border-danger/20 rounded text-danger text-[11px]">
          {trace.error}
        </div>
      )}
    </div>
  );
}

/** Simple non-virtualized renderer for small scripts */
function ScriptPanelSimple({ trace, currentStep }: ScriptPanelProps) {
  const { unlockOpcodes, lockOpcodes, snapshots } = trace;
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentStep]);

  const unlockIndents = useMemo(() => computeIndents(unlockOpcodes), [unlockOpcodes]);
  const lockIndents = useMemo(() => computeIndents(lockOpcodes), [lockOpcodes]);

  const allOpcodes = useMemo(() => [...unlockOpcodes, ...lockOpcodes], [unlockOpcodes, lockOpcodes]);
  const allDataHex = useMemo(() => precomputeDataHex(allOpcodes), [allOpcodes]);

  const renderOpcode = (op: ScriptOpcode, flatIndex: number, indent: number) => {
    const active = flatIndex === currentStep;
    const executed = flatIndex <= currentStep;
    const snap = flatIndex < snapshots.length ? snapshots[flatIndex] : undefined;
    const hasError = !!snap?.error;
    const isSkipped = !!snap?.skipped;
    const dataHex = allDataHex[flatIndex];

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

        {active && isSkipped && (
          <span className="text-[9px] text-text-tertiary italic">skipped</span>
        )}

        {dataHex && !isSkipped && (
          <span className={`text-text-tertiary text-[10px] truncate max-w-[120px] ${!executed ? 'opacity-40' : ''}`}>
            {dataHex}
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
