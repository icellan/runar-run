import { useMemo, useState, useRef, useEffect } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { getOpcodeColor } from '../../lib/opcode-meta';

interface ScriptAsmViewProps {
  asm: string;
  annotations?: Map<number, string>;
  noAnnotationsMessage?: string;
}

/** Compute indentation depth for each opcode based on IF/ELSE/ENDIF nesting */
function computeIndents(opcodes: string[]): number[] {
  const indents: number[] = [];
  let depth = 0;

  for (const op of opcodes) {
    if (op === 'OP_ELSE' || op === 'OP_ENDIF') {
      depth = Math.max(0, depth - 1);
    }

    indents.push(depth);

    if (op === 'OP_IF' || op === 'OP_NOTIF' || op === 'OP_ELSE') {
      depth++;
    }
  }

  return indents;
}

interface AsmRowProps {
  opcodes: string[];
  indents: number[];
  annotations?: Map<number, string>;
  colors: string[];
}

const ROW_HEIGHT = 22;

function AsmRow({ index, style, opcodes, indents, annotations, colors }: RowComponentProps<AsmRowProps>) {
  const i = index;
  const indent = indents[i] ?? 0;
  const annotation = annotations?.get(i);

  return (
    <div style={style}>
      {annotation && (
        <div className="flex items-baseline gap-3 pt-1 pb-0.5">
          <span className="w-8 shrink-0" />
          <span style={{ paddingLeft: indent * 16 }} className="text-accent-500/60 text-[11px]">
            // {annotation}
          </span>
        </div>
      )}
      <div className="flex items-baseline gap-3 py-px hover:bg-white/[0.02]">
        <span className="text-text-tertiary w-8 text-right shrink-0 select-none">
          {i + 1}
        </span>
        <span style={{ paddingLeft: indent * 16, color: colors[i] }}>
          {opcodes[i]}
        </span>
      </div>
    </div>
  );
}

export function ScriptAsmView({ asm, annotations, noAnnotationsMessage }: ScriptAsmViewProps) {
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

  if (!asm) {
    return <div className="p-3 text-text-tertiary text-xs">No ASM output</div>;
  }

  const opcodes = useMemo(() => asm.split(/\s+/).filter(Boolean), [asm]);
  const indents = useMemo(() => computeIndents(opcodes), [opcodes]);
  const colors = useMemo(() => opcodes.map(op => getOpcodeColor(op)), [opcodes]);

  const rowProps = useMemo<AsmRowProps>(() => ({
    opcodes, indents, annotations, colors,
  }), [opcodes, indents, annotations, colors]);

  // For small lists, render directly without virtualization
  if (opcodes.length <= 200) {
    return (
      <div className="p-3 font-mono text-xs leading-relaxed">
        {noAnnotationsMessage && (
          <div className="text-text-tertiary text-[11px] mb-3 px-1 italic">
            {noAnnotationsMessage}
          </div>
        )}
        {opcodes.map((op, i) => {
          const annotation = annotations?.get(i);
          const indent = indents[i] ?? 0;
          return (
            <div key={i}>
              {annotation && (
                <div className="flex items-baseline gap-3 pt-2 pb-0.5">
                  <span className="w-8 shrink-0" />
                  <span style={{ paddingLeft: indent * 16 }} className="text-accent-500/60 text-[11px]">
                    // {annotation}
                  </span>
                </div>
              )}
              <div className="flex items-baseline gap-3 py-px hover:bg-white/[0.02]">
                <span className="text-text-tertiary w-8 text-right shrink-0 select-none">
                  {i + 1}
                </span>
                <span style={{ paddingLeft: indent * 16, color: colors[i] }}>
                  {op}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full font-mono text-xs leading-relaxed">
      {noAnnotationsMessage && (
        <div className="text-text-tertiary text-[11px] mb-3 px-4 pt-3 italic">
          {noAnnotationsMessage}
        </div>
      )}
      <List
        style={{ paddingLeft: 12, paddingRight: 12 }}
        rowCount={opcodes.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={AsmRow}
        rowProps={rowProps}
        overscanCount={20}
      >
        {null}
      </List>
    </div>
  );
}
