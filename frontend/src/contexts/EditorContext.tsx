import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { EXAMPLES, type MethodCall } from '../examples';
import { decodeFromHash } from '../lib/sharing-client';

export type Language = 'typescript' | 'solidity' | 'move' | 'python' | 'go' | 'rust' | 'zig' | 'ruby';

interface EditorState {
  source: string;
  language: Language;
  fileName: string;
  constructorArgs: Record<string, bigint | boolean | string>;
  /** Typed method call definition — used to generate real unlock scripts */
  methodCall: MethodCall | null;
  /** Manual override: if set, used instead of methodCall */
  unlockScriptHexOverride: string;
  description: string;
  /** Mock locktime (block height) for stateful contract testing */
  mockLocktime: number;
}

interface EditorContextValue extends EditorState {
  setSource: (source: string) => void;
  setLanguage: (language: Language) => void;
  setConstructorArgs: (args: Record<string, bigint | boolean | string>) => void;
  setUnlockScriptHexOverride: (hex: string) => void;
  setMockLocktime: (locktime: number) => void;
  loadExample: (exampleId: string) => void;
}

const LANGUAGE_EXTENSIONS: Record<Language, string> = {
  typescript: 'ts',
  solidity: 'sol',
  move: 'move',
  python: 'py',
  go: 'go',
  rust: 'rs',
  zig: 'zig',
  ruby: 'rb',
};

const DEFAULT_EXAMPLE = EXAMPLES[0]!;

/** Check URL hash on load for a shared playground */
function getInitialState(): EditorState {
  const hash = window.location.hash.slice(1);
  if (hash) {
    const shared = decodeFromHash(hash);
    if (shared) {
      const ext = LANGUAGE_EXTENSIONS[shared.language] ?? 'ts';
      return {
        source: shared.source,
        language: shared.language,
        fileName: `Contract.runar.${ext}`,
        constructorArgs: {},
        methodCall: null,
        unlockScriptHexOverride: '',
        description: '',
        mockLocktime: 0,
      };
    }
  }
  return {
    source: DEFAULT_EXAMPLE.source,
    language: DEFAULT_EXAMPLE.language,
    fileName: `Contract.runar.${LANGUAGE_EXTENSIONS[DEFAULT_EXAMPLE.language]}`,
    constructorArgs: DEFAULT_EXAMPLE.constructorArgs,
    methodCall: DEFAULT_EXAMPLE.methodCall,
    unlockScriptHexOverride: '',
    description: DEFAULT_EXAMPLE.description,
    mockLocktime: 0,
  };
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EditorState>(getInitialState);

  const setSource = useCallback((source: string) => {
    setState(prev => ({ ...prev, source, description: '' }));
  }, []);

  const setLanguage = useCallback((language: Language) => {
    const ext = LANGUAGE_EXTENSIONS[language];
    setState(prev => {
      // If the current source already belongs to an example in the new language, keep it
      const currentExample = EXAMPLES.find(e => e.source === prev.source && e.language === language);
      if (currentExample) {
        return { ...prev, language, fileName: `Contract.runar.${ext}` };
      }
      // Otherwise load the first example for the new language, or keep the source as-is
      const firstExample = EXAMPLES.find(e => e.language === language);
      if (firstExample) {
        return {
          source: firstExample.source,
          language,
          fileName: `Contract.runar.${ext}`,
          constructorArgs: firstExample.constructorArgs,
          methodCall: firstExample.methodCall,
          unlockScriptHexOverride: '',
          description: firstExample.description,
          mockLocktime: 0,
        };
      }
      return { ...prev, language, fileName: `Contract.runar.${ext}` };
    });
  }, []);

  const setConstructorArgs = useCallback((args: Record<string, bigint | boolean | string>) => {
    setState(prev => ({ ...prev, constructorArgs: args }));
  }, []);

  const setUnlockScriptHexOverride = useCallback((hex: string) => {
    setState(prev => ({ ...prev, unlockScriptHexOverride: hex }));
  }, []);

  const setMockLocktime = useCallback((mockLocktime: number) => {
    setState(prev => ({ ...prev, mockLocktime }));
  }, []);

  const loadExample = useCallback((exampleId: string) => {
    const example = EXAMPLES.find(e => e.id === exampleId);
    if (!example) return;
    const ext = LANGUAGE_EXTENSIONS[example.language];
    setState({
      source: example.source,
      language: example.language,
      fileName: `Contract.runar.${ext}`,
      constructorArgs: example.constructorArgs,
      methodCall: example.methodCall,
      unlockScriptHexOverride: '',
      description: example.description,
      mockLocktime: 0,
    });
  }, []);

  return (
    <EditorContext.Provider value={{
      ...state,
      setSource,
      setLanguage,
      setConstructorArgs,
      setUnlockScriptHexOverride,
      setMockLocktime,
      loadExample,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
