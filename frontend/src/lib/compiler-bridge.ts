/**
 * Typed message protocol for the compiler Web Worker.
 */

import type { CompilerDiagnostic } from 'runar-compiler';

// Messages sent TO the worker
export type CompilerRequest =
  | {
      type: 'compile';
      source: string;
      fileName: string;
      constructorArgs?: Record<string, string>;
    }
  | { type: 'init' };

// Messages sent FROM the worker
export type CompilerResponse =
  | { type: 'ready' }
  | { type: 'result'; data: SerializedCompileResult }
  | { type: 'error'; message: string };

/**
 * Serialized compile result — BigInt values are converted to strings
 * since structured cloning doesn't support BigInt in postMessage.
 */
export interface SerializedCompileResult {
  anf: unknown | null;
  contract: unknown | null;
  diagnostics: CompilerDiagnostic[];
  success: boolean;
  artifact?: unknown;
  scriptHex?: string;
  scriptAsm?: string;
}

/**
 * Manages the compiler worker lifecycle and provides a promise-based API.
 */
export class CompilerBridge {
  private worker: Worker;
  private ready: Promise<void>;
  private pendingResolve: ((result: SerializedCompileResult) => void) | null = null;

  constructor() {
    this.worker = new Worker(
      new URL('../workers/compiler.worker.ts', import.meta.url),
      { type: 'module' },
    );

    this.ready = new Promise<void>((resolve) => {
      const handler = (e: MessageEvent<CompilerResponse>) => {
        if (e.data.type === 'ready') {
          resolve();
          this.worker.removeEventListener('message', handler);
          this.worker.addEventListener('message', this.handleMessage);
        }
      };
      this.worker.addEventListener('message', handler);
    });

    this.worker.addEventListener('error', (e) => {
      e.preventDefault();
      console.error('[compiler-worker]', e.message || e);
      if (this.pendingResolve) {
        this.pendingResolve({
          anf: null,
          contract: null,
          diagnostics: [{ message: e.message || 'Worker error', severity: 'error' } as CompilerDiagnostic],
          success: false,
        });
        this.pendingResolve = null;
      }
    });

    this.worker.postMessage({ type: 'init' } satisfies CompilerRequest);
  }

  private handleMessage = (e: MessageEvent<CompilerResponse>) => {
    const msg = e.data;
    if (msg.type === 'result' && this.pendingResolve) {
      this.pendingResolve(msg.data);
      this.pendingResolve = null;
    } else if (msg.type === 'error' && this.pendingResolve) {
      this.pendingResolve({
        anf: null,
        contract: null,
        diagnostics: [{ message: msg.message, severity: 'error' } as CompilerDiagnostic],
        success: false,
      });
      this.pendingResolve = null;
    }
  };

  async compile(
    source: string,
    fileName: string,
    constructorArgs?: Record<string, string>,
  ): Promise<SerializedCompileResult> {
    await this.ready;

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.worker.postMessage({
        type: 'compile',
        source,
        fileName,
        constructorArgs,
      } satisfies CompilerRequest);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
