import { Shell } from './components/layout/Shell';
import { EditorProvider } from './contexts/EditorContext';
import { CompilerProvider } from './contexts/CompilerContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <EditorProvider>
        <CompilerProvider>
          <Shell />
        </CompilerProvider>
      </EditorProvider>
    </ErrorBoundary>
  );
}
