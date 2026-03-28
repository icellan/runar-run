/**
 * Compiler Web Worker
 *
 * Runs each compiler pass individually with yields between them so progress
 * messages flush to the main thread via postMessage.
 */

import {
  parse, validate, typecheck, lowerToANF,
  lowerToStack, emit, optimizeStackIR, optimizeEC, foldConstants, assembleArtifact,
  type CompilerDiagnostic,
} from 'runar-compiler';
import type { CompilerRequest, CompilerResponse, SerializedCompileResult } from '../lib/compiler-bridge';


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

function hasErrors(diags: CompilerDiagnostic[]): boolean {
  return diags.some(d => d.severity === 'error');
}

function send(msg: CompilerResponse): void {
  self.postMessage(msg);
}

function tick(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

async function compileWithProgress(source: string, fileName: string, constructorArgs?: Record<string, bigint | boolean | string>): Promise<SerializedCompileResult> {
  const diagnostics: CompilerDiagnostic[] = [];

  send({ type: 'progress', stage: 'Parsing', percent: 0 });
  await tick();

  let parseResult: ReturnType<typeof parse>;
  try {
    parseResult = parse(source, fileName);
    diagnostics.push(...parseResult.errors);
  } catch (e: unknown) {
    diagnostics.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' } as CompilerDiagnostic);
    return { anf: null, contract: null, diagnostics, success: false };
  }
  if (!parseResult.contract || hasErrors(diagnostics)) {
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }

  send({ type: 'progress', stage: 'Validating', percent: 10 });
  await tick();

  try {
    const v = validate(parseResult.contract);
    diagnostics.push(...v.errors, ...v.warnings);
  } catch (e: unknown) {
    diagnostics.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' } as CompilerDiagnostic);
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }
  if (hasErrors(diagnostics)) {
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }

  send({ type: 'progress', stage: 'Type checking', percent: 20 });
  await tick();

  try {
    const tc = typecheck(parseResult.contract);
    diagnostics.push(...tc.errors);
  } catch (e: unknown) {
    diagnostics.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' } as CompilerDiagnostic);
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }
  if (hasErrors(diagnostics)) {
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }

  send({ type: 'progress', stage: 'Lowering to ANF', percent: 35 });
  await tick();

  let anf: ReturnType<typeof lowerToANF>;
  try {
    anf = lowerToANF(parseResult.contract);
  } catch (e: unknown) {
    diagnostics.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' } as CompilerDiagnostic);
    return { anf: null, contract: parseResult.contract, diagnostics, success: false };
  }

  if (constructorArgs) {
    for (const prop of anf.properties) {
      if (prop.name in constructorArgs) {
        prop.initialValue = constructorArgs[prop.name];
      }
    }
  }

  send({ type: 'progress', stage: 'Optimizing', percent: 45 });
  await tick();

  const folded = foldConstants(anf);
  const optimized = optimizeEC(folded);

  send({ type: 'progress', stage: 'Stack lowering', percent: 50 });
  await tick();

  try {
    const stack = lowerToStack(optimized);

    send({ type: 'progress', stage: 'Peephole optimizing', percent: 55 });
    await tick();

    for (const m of stack.methods) {
      m.ops = optimizeStackIR(m.ops);
    }

    send({ type: 'progress', stage: 'Emitting script', percent: 60 });
    await tick();

    const emitResult = emit(stack);

    send({ type: 'progress', stage: 'Assembling artifact', percent: 70 });
    await tick();

    const artifact = assembleArtifact(
      parseResult.contract, optimized, stack,
      emitResult.scriptHex, emitResult.scriptAsm,
      {
        constructorSlots: emitResult.constructorSlots,
        codeSeparatorIndex: emitResult.codeSeparatorIndex,
        codeSeparatorIndices: emitResult.codeSeparatorIndices,
        includeSourceMap: emitResult.sourceMap.length > 0,
        sourceMappings: emitResult.sourceMap,
      },
    );

    return {
      anf: optimized,
      contract: parseResult.contract,
      diagnostics,
      success: !hasErrors(diagnostics),
      artifact,
      scriptHex: emitResult.scriptHex,
      scriptAsm: emitResult.scriptAsm,
    };
  } catch (e: unknown) {
    diagnostics.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' } as CompilerDiagnostic);
    return { anf: optimized, contract: parseResult.contract, diagnostics, success: false };
  }
}

self.addEventListener('message', (e: MessageEvent<CompilerRequest>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    send({ type: 'ready' });
    return;
  }

  if (msg.type === 'compile') {
    const args = msg.constructorArgs ? deserializeConstructorArgs(msg.constructorArgs) : undefined;
    compileWithProgress(msg.source, msg.fileName, args)
      .then(data => send({ type: 'result', data }))
      .catch(err => send({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
  }
});
