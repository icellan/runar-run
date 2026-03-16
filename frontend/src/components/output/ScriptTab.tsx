import { useState, useMemo } from 'react';
import { useCompiler } from '../../contexts/CompilerContext';
import { useEditor } from '../../contexts/EditorContext';
import { ScriptAsmView } from './ScriptAsmView';
import { ScriptHexView } from './ScriptHexView';
import { CopyButton } from '../shared/CopyButton';

type ScriptView = 'asm' | 'hex' | 'annotated';

interface SourceMapping {
  opcodeIndex: number;
  sourceFile: string;
  line: number;
  column: number;
}

export function ScriptTab() {
  const { result, status } = useCompiler();
  const { source } = useEditor();
  const [view, setView] = useState<ScriptView>('asm');

  if (status === 'idle') {
    return <EmptyState text="Write a contract to see the compiled script" />;
  }

  const artifact = result?.artifact as {
    asm?: string;
    script?: string;
    sourceMap?: { mappings?: SourceMapping[] };
  } | undefined;

  if (!artifact) {
    return <EmptyState text="No script output — check for compilation errors" />;
  }

  const asm = result?.scriptAsm ?? artifact.asm ?? '';
  const hex = result?.scriptHex ?? artifact.script ?? '';
  const mappings = artifact.sourceMap?.mappings;

  const sourceLines = useMemo(() => source.split('\n'), [source]);

  // Build annotations from compiler source map
  const annotations = useMemo(() => {
    if (view !== 'annotated') return undefined;
    if (!mappings || mappings.length === 0) return undefined;

    const map = new Map<number, string>();
    let lastLine = -1;

    for (const m of mappings) {
      // Only annotate when we move to a different source line
      if (m.line !== lastLine && m.line >= 1 && m.line <= sourceLines.length) {
        const lineText = sourceLines[m.line - 1]?.trim();
        if (lineText) {
          map.set(m.opcodeIndex, `L${m.line}: ${lineText}`);
        }
        lastLine = m.line;
      }
    }
    return map;
  }, [mappings, sourceLines, view]);

  return (
    <div className="h-full flex flex-col">
      {/* View toggle */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border shrink-0">
        {(['asm', 'hex', 'annotated'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors duration-150 ${
              view === v
                ? 'bg-accent-500/15 text-accent-400'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {v === 'asm' ? 'ASM' : v === 'hex' ? 'Hex' : 'Annotated'}
          </button>
        ))}
        {view === 'annotated' && mappings && mappings.length > 0 && (
          <span className="text-[10px] text-text-tertiary ml-1">
            ({mappings.length} mappings)
          </span>
        )}
        <div className="ml-auto">
          <CopyButton text={view === 'hex' ? hex : asm} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === 'asm' && <ScriptAsmView asm={asm} />}
        {view === 'hex' && <ScriptHexView hex={hex} />}
        {view === 'annotated' && (
          <ScriptAsmView
            asm={asm}
            annotations={annotations}
            noAnnotationsMessage={
              !mappings || mappings.length === 0
                ? 'No source map available — the compiler did not emit source mappings for this contract'
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm h-full">
      {text}
    </div>
  );
}
