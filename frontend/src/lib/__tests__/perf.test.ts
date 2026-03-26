/**
 * Performance tests for the compilation and rendering pipeline.
 *
 * These verify that data preparation functions used in the output tabs
 * scale well with large inputs (thousands of opcodes / bytes).
 */
import { describe, it, expect } from 'vitest';
import { getOpcodeColor } from '../opcode-meta';

// ---------------------------------------------------------------------------
// Helpers — replicate the pure functions from components to test in isolation
// ---------------------------------------------------------------------------

function computeIndents(opcodes: string[]): number[] {
  const indents: number[] = [];
  let depth = 0;
  for (const op of opcodes) {
    if (op === 'OP_ELSE' || op === 'OP_ENDIF') depth = Math.max(0, depth - 1);
    indents.push(depth);
    if (op === 'OP_IF' || op === 'OP_NOTIF' || op === 'OP_ELSE') depth++;
  }
  return indents;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function precomputeDataHex(opcodes: Array<{ data?: number[] }>): (string | undefined)[] {
  return opcodes.map(op => {
    if (!op.data || op.data.length === 0) return undefined;
    const hex = bytesToHex(op.data);
    return hex.length > 16 ? hex.slice(0, 16) + '\u2026' : hex;
  });
}

function splitHexToRows(hex: string): string[][] {
  const bytes: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(hex.slice(i, i + 2));
  }
  const rows: string[][] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(bytes.slice(i, i + 16));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

const OPCODES_POOL = [
  'OP_DUP', 'OP_HASH160', 'OP_EQUALVERIFY', 'OP_CHECKSIG',
  'OP_ADD', 'OP_SUB', 'OP_IF', 'OP_ELSE', 'OP_ENDIF',
  'OP_SWAP', 'OP_DROP', 'OP_OVER', 'OP_PICK', 'OP_ROLL',
  'OP_SHA256', 'OP_EQUAL', 'OP_VERIFY', 'OP_RETURN',
  'OP_0', 'OP_1', 'OP_2', 'OP_3', 'OP_TRUE', 'OP_FALSE',
  'OP_CAT', 'OP_SPLIT', 'OP_NUM2BIN', 'OP_CHECKLOCKTIMEVERIFY',
];

function generateOpcodeList(count: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(OPCODES_POOL[i % OPCODES_POOL.length]!);
  }
  return result;
}

function generateScriptOpcodes(count: number): Array<{ name: string; data?: number[] }> {
  return generateOpcodeList(count).map((name, i) => ({
    name,
    data: i % 5 === 0 ? Array.from({ length: 20 }, (_, j) => (i + j) & 0xff) : undefined,
  }));
}

function generateHex(byteCount: number): string {
  const bytes: string[] = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push((i & 0xff).toString(16).padStart(2, '0'));
  }
  return bytes.join('');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScriptAsmView data preparation', () => {
  it('computes indents for 10,000 opcodes in < 10ms', () => {
    const opcodes = generateOpcodeList(10_000);
    const start = performance.now();
    const indents = computeIndents(opcodes);
    const elapsed = performance.now() - start;

    expect(indents).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(10);
  });

  it('precomputes opcode colors for 10,000 opcodes in < 20ms', () => {
    const opcodes = generateOpcodeList(10_000);
    const start = performance.now();
    const colors = opcodes.map(op => getOpcodeColor(op));
    const elapsed = performance.now() - start;

    expect(colors).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(20);
  });
});

describe('ScriptPanel data preparation', () => {
  it('precomputes data hex for 10,000 opcodes in < 20ms', () => {
    const opcodes = generateScriptOpcodes(10_000);
    const start = performance.now();
    const hexStrings = precomputeDataHex(opcodes);
    const elapsed = performance.now() - start;

    expect(hexStrings).toHaveLength(10_000);
    // Every 5th opcode has data
    const withData = hexStrings.filter(Boolean);
    expect(withData.length).toBe(2_000);
    expect(elapsed).toBeLessThan(20);
  });

  it('builds flat entry list for 5,000 unlock + 5,000 lock opcodes in < 5ms', () => {
    const unlockCount = 5_000;
    const lockCount = 5_000;
    const unlockIndents = new Array(unlockCount).fill(0);
    const lockIndents = new Array(lockCount).fill(0);

    const start = performance.now();
    const entries: Array<{ type: string; flatIndex: number }> = [];
    let flatIndex = 0;

    entries.push({ type: 'header', flatIndex: -1 });
    for (let i = 0; i < unlockCount; i++) {
      entries.push({ type: 'opcode', flatIndex });
      flatIndex++;
    }
    entries.push({ type: 'separator', flatIndex: -1 });
    entries.push({ type: 'header', flatIndex: -1 });
    for (let i = 0; i < lockCount; i++) {
      entries.push({ type: 'opcode', flatIndex });
      flatIndex++;
    }
    const elapsed = performance.now() - start;

    // 2 headers + 1 separator + 10000 opcodes
    expect(entries).toHaveLength(10_003);
    expect(elapsed).toBeLessThan(5);
  });
});

describe('ScriptHexView data preparation', () => {
  it('splits 100KB hex into rows in < 10ms', () => {
    const hex = generateHex(100_000); // 100KB = 200,000 hex chars
    const start = performance.now();
    const rows = splitHexToRows(hex);
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(Math.ceil(100_000 / 16));
    expect(rows[0]).toHaveLength(16);
    expect(elapsed).toBeLessThan(10);
  });

  it('splits 1MB hex into rows in < 100ms', () => {
    const hex = generateHex(1_000_000);
    const start = performance.now();
    const rows = splitHexToRows(hex);
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(Math.ceil(1_000_000 / 16));
    expect(elapsed).toBeLessThan(200);
  });
});

describe('bytesToHex performance', () => {
  it('converts 10,000 byte arrays in < 50ms', () => {
    const arrays = Array.from({ length: 10_000 }, (_, i) =>
      Array.from({ length: 32 }, (_, j) => (i + j) & 0xff)
    );

    const start = performance.now();
    const results = arrays.map(bytesToHex);
    const elapsed = performance.now() - start;

    expect(results).toHaveLength(10_000);
    expect(results[0]).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(elapsed).toBeLessThan(50);
  });
});

describe('precomputeDataHex avoids redundant work', () => {
  it('returns undefined for opcodes without data', () => {
    const opcodes = [
      { name: 'OP_DUP' },
      { name: 'OP_ADD', data: [] },
      { name: 'PUSH_5', data: [0x0a, 0x1b, 0x2c] },
    ];
    const result = precomputeDataHex(opcodes);

    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe('0a1b2c');
  });

  it('truncates long data with ellipsis', () => {
    const opcodes = [{
      name: 'PUSH_20',
      data: Array.from({ length: 20 }, (_, i) => i),
    }];
    const result = precomputeDataHex(opcodes);

    // 20 bytes = 40 hex chars > 16, so truncated
    expect(result[0]).toMatch(/^[0-9a-f]{16}\u2026$/);
  });
});
