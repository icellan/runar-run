# Rúnar Playground

An interactive browser-based IDE for writing, compiling, and debugging [Rúnar](https://runar.build) smart contracts that compile to Bitcoin Script.

## What is Rúnar?

Rúnar is a smart contract language and compiler that targets **Bitcoin Script** — the stack-based bytecode executed on the Bitcoin SV blockchain. Developers write contracts in familiar languages (TypeScript, Solidity, Move, Python, Go, Rust) and the Rúnar compiler produces Bitcoin Script that can be deployed on-chain.

The compiler supports:

- Built-in Bitcoin cryptography: SHA256, RIPEMD160, ECDSA (`checkSig`), Rabin signatures, elliptic curve operations
- Standard contracts via `SmartContract` base class
- Stateful contracts via `StatefulSmartContract` for persistent state across transactions
- Multi-signature schemes (`checkMultiSig`)
- Source maps for mapping compiled opcodes back to source lines

## What the Playground Does

The playground is a fully-featured web IDE that lets you write, compile, inspect, and step-debug Rúnar contracts entirely in the browser — no install required.

### Code Editor

- Monaco Editor (the engine behind VS Code) with syntax highlighting and autocomplete
- Rúnar SDK type definitions loaded for IntelliSense
- Real-time compiler diagnostics displayed as inline error markers
- Constructor argument inputs with type-aware UI (BigInt, boolean, string)

### Multi-Language Support

Write contracts in any of the six supported input languages:

- TypeScript (primary)
- Solidity
- Move
- Python
- Go
- Rust

### Compilation Output

Four tabbed output panels show the full compilation pipeline:

| Tab | Description |
|-----|-------------|
| **AST** | Abstract syntax tree of the parsed contract |
| **IR** | Intermediate representation (A-Normal Form) |
| **Script** | Final Bitcoin Script in ASM, hex, or annotated view with source mappings |
| **Execution** | Interactive step-through debugger |

Compilation runs in a Web Worker with a 600ms debounce, so the UI stays responsive while the compiler processes changes.

### Interactive Debugger

The execution tab provides a full Bitcoin Script debugger:

- Step forward/backward through every opcode
- Play/pause with adjustable speed (50–500ms per step)
- Live data stack and alt stack visualization
- Auto-detection of public contract methods with argument inputs
- Real signature generation using test keys (Alice, Bob, Charlie)
- Unlock script hex override for manual testing
- Stateful contract support with mock locktime and state tracking
- Skip inactive steps to jump to meaningful execution points

### Sharing

- **URL sharing** — contract source is LZ-string compressed into the URL hash for instant sharing without any backend
- **Authenticated sharing** — save/load playgrounds through the backend API, with BRC-100 signature-based ownership verification

### Built-in Examples

Twelve example contracts are included, ranging from beginner to advanced:

- **HelloWorld** — string matching
- **HashPuzzle** — cryptographic hash verification
- **BooleanLogic** — arithmetic constraints
- **P2PKH** — Pay-to-Public-Key-Hash with ECDSA
- **Escrow** — 3-party escrow with multiple spending paths
- **TimeLock** — signature + amount threshold
- **MultiSig** — 2-of-3 multi-signature with array literals
- **Counter** — stateful: simple counter with increment/decrement
- **Auction** — stateful: English auction with block-height deadline
- **SimpleNFT** — stateful: non-fungible token with transfer/burn
- **BoundedCounter** — stateful: counter with property initializers
- **OraclePriceFeed** — Rabin signature verification + price feed

## Architecture

```
runar-run/
├── frontend/          # React web IDE
├── backend/           # Fastify API for playground persistence
├── compiler-shim/     # Browser-compatible ts-morph replacement
├── Dockerfile         # Multi-stage production build
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### Frontend

React 19 + TypeScript + Vite + Tailwind CSS 4. The compiler runs entirely in the browser via Web Workers — one for compilation and one for script execution/debugging. The `@bsv/sdk` library provides real Bitcoin cryptography for signature generation in the debugger.

### Backend

Fastify 5 + better-sqlite3. Provides a REST API for saving, loading, updating, and deleting playground sessions. Write operations require BRC-100 identity key signature verification for ownership.

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/playgrounds` | Create a playground (requires signature) |
| `GET` | `/api/playgrounds/:id` | Retrieve a playground |
| `PUT` | `/api/playgrounds/:id` | Update a playground (owner + signature) |
| `DELETE` | `/api/playgrounds/:id` | Delete a playground (owner + signature) |

### Compiler Shim

The Rúnar compiler depends on `ts-morph` for TypeScript AST manipulation, which normally requires filesystem access unavailable in browsers. The `compiler-shim` package implements the subset of the ts-morph API that the compiler uses, backed by the raw TypeScript compiler API (which does work in browsers). Vite's `resolve.alias` transparently swaps ts-morph for this shim at build time.

## Tech Stack

**Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS 4, Monaco Editor, @bsv/sdk, lz-string

**Backend:** Fastify 5, better-sqlite3, @bsv/sdk, TypeScript 5.8

**Build:** pnpm monorepo, Node 22, Docker multi-stage

**External (from the [runar](https://github.com/icellan/runar) repo):**

- `runar-compiler` — TypeScript-to-Bitcoin-Script compiler
- `runar-lang` — language definitions and built-in types
- `runar-ir-schema` — intermediate representation schema
- `runar-testing` — test utilities and key fixtures

## Getting Started

### Prerequisites

- Node.js >= 22.12.0
- pnpm

### Development

```bash
# Install dependencies
pnpm install

# Run both frontend and backend in dev mode
pnpm dev

# Or run them individually
pnpm dev:frontend
pnpm dev:backend
```

### Production Build

```bash
pnpm build
```

### Docker

```bash
docker build -t runar-playground .
docker run -p 3001:3001 runar-playground
```

The container serves the frontend static assets and the backend API on port 3001.

### Type Checking

```bash
pnpm check
```

## License

All rights reserved.
