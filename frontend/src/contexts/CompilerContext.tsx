import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { CompilerBridge, type SerializedCompileResult } from '../lib/compiler-bridge';
import { useEditor } from './EditorContext';

export type CompileStatus = 'idle' | 'compiling' | 'success' | 'error';

interface CompilerContextValue {
  status: CompileStatus;
  result: SerializedCompileResult | null;
  errorCount: number;
  warningCount: number;
  compileNow: () => void;
  progressStage: string;
  progressPercent: number;
}

const CompilerContext = createContext<CompilerContextValue | null>(null);

const DEBOUNCE_MS = 600;

/**
 * Serialize constructor args for postMessage (BigInt → string).
 */
function serializeArgs(
  args: Record<string, bigint | boolean | string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    result[key] = typeof value === 'bigint' ? value.toString() + 'n' : String(value);
  }
  return result;
}

export function CompilerProvider({ children }: { children: ReactNode }) {
  const { source, fileName, constructorArgs } = useEditor();
  const bridgeRef = useRef<CompilerBridge | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [status, setStatus] = useState<CompileStatus>('idle');
  const [result, setResult] = useState<SerializedCompileResult | null>(null);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Initialize worker on mount
  useEffect(() => {
    const bridge = new CompilerBridge();
    bridge.onProgress = (stage, percent) => {
      setProgressStage(stage);
      setProgressPercent(prev => Math.max(prev, percent));
    };
    bridgeRef.current = bridge;
    return () => {
      bridge.terminate();
      bridgeRef.current = null;
    };
  }, []);

  const doCompile = useCallback(async (
    src: string,
    file: string,
    args: Record<string, bigint | boolean | string>,
  ) => {
    if (!bridgeRef.current) return;
    setStatus('compiling');
    setProgressStage('');
    setProgressPercent(0);
    try {
      const serializedArgs = Object.keys(args).length > 0 ? serializeArgs(args) : undefined;
      const res = await bridgeRef.current.compile(src, file, serializedArgs);
      setResult(res);
      setStatus(res.success ? 'success' : 'error');
    } catch {
      setStatus('error');
    }
  }, []);

  // Debounced compile on source or constructorArgs change
  useEffect(() => {
    // Clear stale result immediately so old errors don't flash
    setResult(null);
    setStatus('compiling');

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      doCompile(source, fileName, constructorArgs);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [source, fileName, constructorArgs, doCompile]);

  const compileNow = useCallback(() => {
    doCompile(source, fileName, constructorArgs);
  }, [source, fileName, constructorArgs, doCompile]);

  const errorCount = result?.diagnostics.filter(d => d.severity === 'error').length ?? 0;
  const warningCount = result?.diagnostics.filter(d => d.severity === 'warning').length ?? 0;

  return (
    <CompilerContext.Provider value={{ status, result, errorCount, warningCount, compileNow, progressStage, progressPercent }}>
      {children}
    </CompilerContext.Provider>
  );
}

export function useCompiler(): CompilerContextValue {
  const ctx = useContext(CompilerContext);
  if (!ctx) throw new Error('useCompiler must be used within CompilerProvider');
  return ctx;
}
