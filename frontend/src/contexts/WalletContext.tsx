import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface WalletState {
  identityKey: string | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  networkEndpoint: string;
}

interface WalletContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  setNetworkEndpoint: (url: string) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const DEFAULT_NETWORK_ENDPOINT = 'https://arc.gorillapool.io';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    identityKey: null,
    connected: false,
    connecting: false,
    error: null,
    networkEndpoint: localStorage.getItem('runar-network-endpoint') ?? DEFAULT_NETWORK_ENDPOINT,
  });

  const connect = useCallback(async () => {
    setState(s => ({ ...s, connecting: true, error: null }));
    try {
      // Dynamic import to avoid bundling wallet SDK if unused
      const { WalletClient } = await import('@bsv/sdk');
      const wallet = new WalletClient('json-api');

      const { authenticated } = await wallet.isAuthenticated();
      if (!authenticated) {
        await wallet.waitForAuthentication();
      }

      const { publicKey } = await wallet.getPublicKey({ identityKey: true });

      setState(s => ({
        ...s,
        identityKey: publicKey,
        connected: true,
        connecting: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setState(s => ({
        ...s,
        connecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState(s => ({
      ...s,
      identityKey: null,
      connected: false,
      error: null,
    }));
  }, []);

  const setNetworkEndpoint = useCallback((url: string) => {
    localStorage.setItem('runar-network-endpoint', url);
    setState(s => ({ ...s, networkEndpoint: url }));
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, setNetworkEndpoint }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
