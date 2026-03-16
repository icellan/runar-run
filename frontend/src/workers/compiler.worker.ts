/**
 * Compiler Web Worker
 *
 * Runs the runar-compiler inside a Web Worker to avoid blocking the main thread.
 * The ts-morph dependency is replaced by our browser shim via Vite's resolve.alias.
 *
 * The compiler now includes source maps in the artifact automatically when
 * source locations are available (which they are for all supported languages).
 */

import { compile } from 'runar-compiler';
import type { CompilerRequest, CompilerResponse, SerializedCompileResult } from '../lib/compiler-bridge';

function serializeBigInts(obj: unknown): unknown {
  if (typeof obj === 'bigint') return obj.toString() + 'n';
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value);
    }
    return result;
  }
  return obj;
}

function deserializeConstructorArgs(
  args: Record<string, string>,
): Record<string, bigint | boolean | string> {
  const result: Record<string, bigint | boolean | string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === 'true') result[key] = true;
    else if (value === 'false') result[key] = false;
    else if (/^\d+n?$/.test(value)) result[key] = BigInt(value.replace(/n$/, ''));
    else result[key] = value;
  }
  return result;
}

self.addEventListener('message', (e: MessageEvent<CompilerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    self.postMessage({ type: 'ready' } satisfies CompilerResponse);
    return;
  }

  if (msg.type === 'compile') {
    try {
      const constructorArgs = msg.constructorArgs
        ? deserializeConstructorArgs(msg.constructorArgs)
        : undefined;

      const result = compile(msg.source, {
        fileName: msg.fileName,
        constructorArgs,
      });

      const serialized: SerializedCompileResult = {
        anf: serializeBigInts(result.anf),
        contract: serializeBigInts(result.contract),
        diagnostics: result.diagnostics,
        success: result.success,
        artifact: result.artifact ? serializeBigInts(result.artifact) : undefined,
        scriptHex: result.scriptHex,
        scriptAsm: result.scriptAsm,
      };

      self.postMessage({ type: 'result', data: serialized } satisfies CompilerResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', message } satisfies CompilerResponse);
    }
  }
});
