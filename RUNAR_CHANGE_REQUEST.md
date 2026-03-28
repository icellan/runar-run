# Change Request: Compiler Progress Callback & Export Internal Passes

## Summary

The Rúnar Playground needs to show compilation progress to users when compiling large contracts. This requires two changes to `runar-compiler`:

1. Add an `onProgress` callback to `CompileOptions`
2. Export `lowerToStack` and `emit` (currently internal-only)

## Motivation

Large contracts (e.g., SPHINCS+ wallet, EC demos) take several seconds to compile. During this time the user sees a static "Compiling..." message with no indication of progress. Showing which pass is running and a progress percentage would significantly improve the experience.

## Proposed Changes

### 1. Add `onProgress` callback to `CompileOptions`

```typescript
export interface CompileOptions {
  fileName?: string;
  constructorArgs?: Record<string, bigint | boolean | string>;
  // ... existing options ...

  /** Called between compilation passes with the current stage name and progress percentage (0-100). */
  onProgress?: (stage: string, percent: number) => void;
}
```

Then call it between each pass in the `compile()` function:

```typescript
export function compile(source: string, options?: CompileOptions): CompileResult {
  const onProgress = options?.onProgress;

  onProgress?.('Parsing', 0);
  const parseResult = parse(source, options?.fileName);
  // ... error handling ...

  onProgress?.('Validating', 15);
  const validationResult = validate(parseResult.contract);
  // ... error handling ...

  onProgress?.('Type checking', 30);
  const typeCheckResult = typecheck(parseResult.contract);
  // ... error handling ...

  onProgress?.('Lowering to ANF', 45);
  const anf = lowerToANF(parseResult.contract);

  onProgress?.('Optimizing', 55);
  // constant folding + EC optimization

  onProgress?.('Stack lowering', 65);
  const stackProgram = lowerToStack(optimizedAnf);

  onProgress?.('Peephole optimizing', 80);
  // peephole optimization

  onProgress?.('Emitting script', 90);
  const emitResult = emit(stackProgram);
  // ...
}
```

### 2. Export `lowerToStack` and `emit`

Add these to `packages/runar-compiler/src/index.ts`:

```typescript
export { lowerToStack } from './passes/05-stack-lower.js';
export { emit } from './passes/06-emit.js';
export { optimizeStackIR } from './optimizer/peephole.js';
export { optimizeEC } from './optimizer/anf-ec.js';
export { foldConstants } from './optimizer/constant-fold.js';
export { assembleArtifact } from './artifact/assembler.js';
```

This allows advanced consumers (like the Playground) to run passes individually if needed, while the `compile()` function with `onProgress` remains the recommended API.

## How the Playground Will Use This

In the compiler Web Worker:

```typescript
import { compile } from 'runar-compiler';

compile(source, {
  fileName,
  constructorArgs,
  onProgress: (stage, percent) => {
    self.postMessage({ type: 'progress', stage, percent });
  },
});
```

The main thread receives progress messages and updates a progress bar in the UI.

## Impact

- **Backward compatible** — `onProgress` is optional, existing callers unaffected
- **No new dependencies**
- **Minimal code change** — ~10 lines in `compile()` + ~6 export lines
