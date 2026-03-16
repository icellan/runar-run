import { useCompiler, type CompileStatus } from '../../contexts/CompilerContext';
import { useWallet } from '../../contexts/WalletContext';

const STATUS_CONFIG: Record<CompileStatus, { color: string; label: string }> = {
  idle: { color: 'bg-neutral-500', label: 'Ready' },
  compiling: { color: 'bg-warning', label: 'Compiling...' },
  success: { color: 'bg-success', label: 'Compiled' },
  error: { color: 'bg-danger', label: 'Error' },
};

export function StatusBar() {
  const { status, errorCount, warningCount } = useCompiler();
  const { connected, networkEndpoint } = useWallet();
  const config = STATUS_CONFIG[status];

  return (
    <footer className="flex items-center h-6 px-4 text-xs border-t border-border bg-surface shrink-0">
      {/* Compilation status */}
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

      {/* Right side */}
      <div className="ml-auto flex items-center gap-4 text-text-tertiary">
        {connected ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
            Wallet connected
          </span>
        ) : (
          <span>No wallet</span>
        )}
      </div>
    </footer>
  );
}
