import { Shell } from './components/layout/Shell';
import { EditorProvider } from './contexts/EditorContext';
import { CompilerProvider } from './contexts/CompilerContext';
import { WalletProvider } from './contexts/WalletContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <EditorProvider>
        <CompilerProvider>
          <WalletProvider>
            <Shell />
          </WalletProvider>
        </CompilerProvider>
      </EditorProvider>
    </ErrorBoundary>
  );
}
