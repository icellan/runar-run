import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import { useRef, useEffect } from 'react';
import type { editor } from 'monaco-editor';
import { useEditor, type Language } from '../../contexts/EditorContext';
import { useCompiler } from '../../contexts/CompilerContext';
import { ConstructorArgs } from './ConstructorArgs';

const LANGUAGE_TO_MONACO: Record<Language, string> = {
  typescript: 'typescript',
  solidity: 'sol',
  move: 'rust',
  python: 'python',
  go: 'go',
  rust: 'rust',
  zig: 'c',       // closest built-in Monaco language for Zig syntax
  ruby: 'ruby',
};

/**
 * Rúnar SDK type stubs — injected into Monaco's TypeScript environment
 * so the editor doesn't show "Cannot find name" errors for SDK types.
 */
const RUNAR_TYPE_DEFS = `
declare type ByteString = string & { readonly __brand: 'ByteString' };
declare type PubKey = string & { readonly __brand: 'PubKey' };
declare type Sig = string & { readonly __brand: 'Sig' };
declare type Sha256 = string & { readonly __brand: 'Sha256' };
declare type Ripemd160 = string & { readonly __brand: 'Ripemd160' };
declare type Addr = string & { readonly __brand: 'Addr' };
declare type SigHashPreimage = string & { readonly __brand: 'SigHashPreimage' };
declare type RabinSig = { s: bigint; padding: ByteString };
declare type RabinPubKey = bigint;
declare type Point = { x: bigint; y: bigint };
declare type FixedArray<T, N extends number> = T[];

declare class SmartContract {
  constructor(...args: unknown[]);
  protected getStateScript(): ByteString;
  protected buildP2PKH(addr: Addr): ByteString;
}

declare class StatefulSmartContract extends SmartContract {
  protected readonly txPreimage: SigHashPreimage;
  protected addOutput(satoshis: bigint, ...stateValues: unknown[]): void;
  protected addRawOutput(satoshis: bigint, scriptBytes: ByteString): void;
}

declare function assert(condition: boolean): void;
declare function sha256(data: ByteString): Sha256;
declare function ripemd160(data: ByteString): Ripemd160;
declare function hash160(data: ByteString | PubKey): Ripemd160;
declare function hash256(data: ByteString): Sha256;
declare function checkSig(sig: Sig, pubKey: PubKey): boolean;
declare function checkMultiSig(sigs: Sig[], pubKeys: PubKey[]): boolean;
declare function verifyRabinSig(msg: ByteString, sig: RabinSig, padding: ByteString, pubKey: RabinPubKey): boolean;
declare function len(data: ByteString): bigint;
declare function cat(a: ByteString, b: ByteString): ByteString;
declare function num2bin(n: bigint, size: bigint): ByteString;
declare function bin2num(data: ByteString): bigint;
declare function abs(n: bigint): bigint;
declare function min(a: bigint, b: bigint): bigint;
declare function max(a: bigint, b: bigint): bigint;
declare function within(x: bigint, lo: bigint, hi: bigint): boolean;
declare function safediv(a: bigint, b: bigint): bigint;
declare function safemod(a: bigint, b: bigint): bigint;
declare function clamp(x: bigint, lo: bigint, hi: bigint): bigint;
declare function sign(n: bigint): bigint;
declare function pow(base: bigint, exp: bigint): bigint;
declare function sqrt(n: bigint): bigint;
declare function gcd(a: bigint, b: bigint): bigint;
declare function mulDiv(a: bigint, b: bigint, c: bigint): bigint;
declare function percentOf(amount: bigint, bps: bigint): bigint;
declare function log2(n: bigint): bigint;
declare function divmod(a: bigint, b: bigint): bigint;
declare function substr(data: ByteString, start: bigint, len: bigint): ByteString;
declare function left(data: ByteString, len: bigint): ByteString;
declare function right(data: ByteString, len: bigint): ByteString;
declare function reverseBytes(data: ByteString): ByteString;
declare function checkPreimage(preimage: SigHashPreimage): boolean;
declare function extractLocktime(preimage: SigHashPreimage): bigint;
declare function extractAmount(preimage: SigHashPreimage): bigint;
declare function extractOutputHash(preimage: SigHashPreimage): Sha256;
declare function ecAdd(a: Point, b: Point): Point;
declare function ecMul(p: Point, k: bigint): Point;
declare function ecMulGen(k: bigint): Point;
declare function ecNegate(p: Point): Point;
declare function ecOnCurve(p: Point): boolean;
declare function ecModReduce(v: bigint, m: bigint): bigint;
declare function ecEncodeCompressed(p: Point): ByteString;
declare function ecMakePoint(x: bigint, y: bigint): Point;
declare function ecPointX(p: Point): bigint;
declare function ecPointY(p: Point): bigint;
declare const EC_N: bigint;
`;

export function CodeEditor() {
  const { source, language, setSource } = useEditor();
  const { result } = useCompiler();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Disable Monaco's built-in TypeScript diagnostics — we use the Rúnar compiler's own errors
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });

    // Add Rúnar SDK type definitions for autocompletion
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      RUNAR_TYPE_DEFS,
      'runar-sdk.d.ts',
    );

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      strict: true,
      noEmit: true,
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  // Apply error markers from Rúnar compiler diagnostics
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    if (!result?.diagnostics.length) {
      monaco.editor.setModelMarkers(model, 'runar', []);
      return;
    }

    const markers: editor.IMarkerData[] = result.diagnostics.map((d) => {
      const loc = (d as { location?: { line?: number; column?: number } }).location;
      const line = loc?.line ?? 1;
      const col = (loc?.column ?? 0) + 1;

      return {
        severity:
          d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : d.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
        message: d.message,
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col + 1,
      };
    });

    monaco.editor.setModelMarkers(model, 'runar', markers);
  }, [result]);

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={LANGUAGE_TO_MONACO[language]}
          value={source}
          onChange={(value) => setSource(value ?? '')}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            fontFamily: '"JetBrains Mono Variable", monospace',
            fontSize: 13,
            lineHeight: 20,
            minimap: { enabled: false },
            wordWrap: 'off',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            tabSize: 2,
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
      <ConstructorArgs />
    </div>
  );
}
