# Rúnar Change Requests from the Playground

## Status: Implemented (Completed)

- Go and Rust parser support in the TypeScript compiler
- Undefined variable reference detection in typecheck/validate passes
- Source map emission from the emitter (06-emit.ts)
- ArrayLiteralExpression and checkMultiSig support (parser + all passes)
- Stateful contract preimage fix: confirmed `codeSeparatorIndex` / `codeSeparatorIndices`
  metadata is sufficient. Terminal stateful methods (e.g., Auction `close`) now execute
  fully in the playground debugger with real checkPreimage verification.

## Status: Build Issue

The runar-compiler build fails due to a TS error in a test file:

```
src/__tests__/rust-parser-examples.test.ts(9,16): error TS6133: 'basename' is declared but its value is never read.
src/__tests__/rust-parser-examples.test.ts(126,37): error TS2339: Property 'location' does not exist on type 'CompilerDiagnostic'.
```

The source and dist are currently out of sync (dist is from a previous successful build).
Fix: either update the test file or exclude `__tests__/` from the build tsconfig.

---

## Open: State Deserialization in Stateful Contract Execution

### Problem

State-mutating methods in stateful contracts (e.g., Auction's `bid`) fail during
state deserialization. The compiled contract uses `deserialize_state` to extract
mutable field values from the scriptCode within the BIP-143 preimage. The extraction
produces garbage bytes instead of the expected values.

Example: `this.highestBid` should be `0` (initial value) but the contract reads
`75810164a2777768` — a fragment of script opcodes at the wrong byte offset.

### Root Cause

The compiled `deserialize_state` code extracts mutable state fields by byte-splitting
the scriptCode from the END of the script (after OP_RETURN = 0x6a). The byte offsets
for each field are determined at compile time based on the known field types and sizes.

The playground's mock preimage includes the correct scriptCode (verified by the
successful OP_CHECKSIGVERIFY). However, the state data portion of the script
(after OP_RETURN) may not be at the byte offset the compiled code expects, causing
the extraction to read from the wrong position.

### What Would Help

A helper function or documentation from the SDK that clarifies:

1. **State serialization format**: Exactly how initial state values from `constructorArgs`
   are serialized into the locking script's state data section. The format per type is
   documented (bigint=8-byte LE, PubKey=33 bytes, etc.), but the exact byte position
   within the compiled script needs confirmation.

2. **`deserialize_state` byte offsets**: How the compiled code locates the state data
   within the scriptCode. Does it search for OP_RETURN (0x6a) and read backwards?
   Or does it use hardcoded offsets from the end?

3. **Ideally, a `buildMockPreimage(artifact, constructorArgs, mockTxParams)` helper**
   in `runar-testing` that returns preimage bytes guaranteed to pass all internal
   verification including state deserialization. The playground could port this logic.

### Impact

Terminal stateful methods work fully. State-mutating methods (bid, increment, transfer)
fail at state deserialization but pass all prior checks (checkPreimage, checkSig, etc.).
