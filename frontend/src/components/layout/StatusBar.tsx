import { useCompiler, type CompileStatus } from '../../contexts/CompilerContext';
import { version as runarVersion } from 'runar-compiler/package.json';

const STATUS_CONFIG: Record<CompileStatus, { color: string; label: string }> = {
  idle: { color: 'bg-neutral-500', label: 'Ready' },
  compiling: { color: 'bg-warning', label: 'Compiling...' },
  success: { color: 'bg-success', label: 'Compiled' },
  error: { color: 'bg-danger', label: 'Error' },
};

export function StatusBar() {
  const { status, errorCount, warningCount } = useCompiler();
  const config = STATUS_CONFIG[status];

  return (
    <footer className="flex items-center h-6 px-4 text-xs border-t border-border bg-surface shrink-0">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-text-tertiary">{config.label}</span>
        {errorCount > 0 && (
          <span className="text-danger">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
        )}
        {warningCount > 0 && (
          <span className="text-warning">{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      <span className="ml-auto text-[10px] text-text-tertiary">
        Runar v{runarVersion}
      </span>
    </footer>
  );
}
