import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex-1 flex items-center justify-center h-full">
          <div className="text-center px-6 max-w-md space-y-3">
            <div className="text-danger text-sm font-medium">Something went wrong</div>
            <div className="text-text-secondary text-xs font-mono bg-surface p-3 rounded border border-border max-h-32 overflow-auto text-left">
              {this.state.error?.message ?? 'Unknown error'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-3 py-1.5 text-xs font-medium text-text-secondary border border-border rounded-md
                         hover:border-border-strong hover:text-text transition-all duration-150"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
