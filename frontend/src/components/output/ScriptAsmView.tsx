import { useMemo } from 'react';
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

export function ScriptAsmView({ asm, annotations, noAnnotationsMessage }: ScriptAsmViewProps) {
  if (!asm) {
    return <div className="p-3 text-text-tertiary text-xs">No ASM output</div>;
  }

  const opcodes = asm.split(/\s+/).filter(Boolean);
  const indents = useMemo(() => computeIndents(opcodes), [opcodes]);

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
              <span style={{ paddingLeft: indent * 16, color: getOpcodeColor(op) }}>
                {op}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
