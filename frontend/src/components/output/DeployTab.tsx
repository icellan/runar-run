import { useWallet } from '../../contexts/WalletContext';
import { useCompiler } from '../../contexts/CompilerContext';

export function DeployTab() {
  const { connected, connecting, error, identityKey, connect } = useWallet();
  const { result } = useCompiler();

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-sm px-4">
          <div className="text-text-secondary text-sm">
            Connect a BRC-100 wallet to deploy and call contracts
          </div>
          <div className="text-text-tertiary text-xs">
            A BRC-100 wallet (e.g. BSV Desktop) must be running on localhost:2121
          </div>
          <button
            onClick={connect}
            disabled={connecting}
            className="px-4 py-2 text-sm font-medium text-neutral-950 bg-accent-500 rounded-md
                       hover:bg-accent-400 transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {error && (
            <div className="text-danger text-xs mt-2">{error}</div>
          )}
        </div>
      </div>
    );
  }

  const hasArtifact = result?.success && result.artifact;

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Connected status */}
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-block w-2 h-2 rounded-full bg-success" />
        <span className="text-text-secondary">Connected</span>
        <span className="text-text-tertiary font-mono truncate">
          {identityKey?.slice(0, 8)}...{identityKey?.slice(-8)}
        </span>
      </div>

      {!hasArtifact ? (
        <div className="text-text-tertiary text-sm">
          Compile a contract successfully to deploy it
        </div>
      ) : (
        <div className="space-y-4">
          {/* Deploy section */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-text mb-3">Deploy Contract</h3>
            <div className="text-text-tertiary text-xs">
              Deploy and Call functionality coming soon.
              The contract has been compiled successfully and is ready for deployment.
            </div>
          </div>

          {/* Call section */}
          <div className="border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-text mb-3">Call Method</h3>
            <div className="text-text-tertiary text-xs">
              Deploy a contract first, then call its public methods here.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
