/**
 * Opcode category classification for syntax coloring in the Script tab.
 */

type OpcodeCategory = 'push' | 'arithmetic' | 'bitwise' | 'crypto' | 'flow' | 'locktime' | 'stack' | 'data' | 'nop';

const CATEGORY_MAP: Record<string, OpcodeCategory> = {
  // Push
  OP_0: 'push', OP_FALSE: 'push', OP_1: 'push', OP_TRUE: 'push',
  OP_2: 'push', OP_3: 'push', OP_4: 'push', OP_5: 'push',
  OP_6: 'push', OP_7: 'push', OP_8: 'push', OP_9: 'push',
  OP_10: 'push', OP_11: 'push', OP_12: 'push', OP_13: 'push',
  OP_14: 'push', OP_15: 'push', OP_16: 'push',
  OP_1NEGATE: 'push', OP_PUSHDATA1: 'push', OP_PUSHDATA2: 'push', OP_PUSHDATA4: 'push',

  // Arithmetic
  OP_ADD: 'arithmetic', OP_SUB: 'arithmetic', OP_MUL: 'arithmetic',
  OP_DIV: 'arithmetic', OP_MOD: 'arithmetic',
  OP_1ADD: 'arithmetic', OP_1SUB: 'arithmetic',
  OP_NEGATE: 'arithmetic', OP_ABS: 'arithmetic',
  OP_MIN: 'arithmetic', OP_MAX: 'arithmetic',
  OP_WITHIN: 'arithmetic', OP_NUMEQUALVERIFY: 'arithmetic',
  OP_NUMEQUAL: 'arithmetic', OP_NUMNOTEQUAL: 'arithmetic',
  OP_LESSTHAN: 'arithmetic', OP_GREATERTHAN: 'arithmetic',
  OP_LESSTHANOREQUAL: 'arithmetic', OP_GREATERTHANOREQUAL: 'arithmetic',
  OP_NOT: 'arithmetic', OP_0NOTEQUAL: 'arithmetic',
  OP_BOOLAND: 'arithmetic', OP_BOOLOR: 'arithmetic',

  // Bitwise
  OP_AND: 'bitwise', OP_OR: 'bitwise', OP_XOR: 'bitwise',
  OP_INVERT: 'bitwise', OP_LSHIFT: 'bitwise', OP_RSHIFT: 'bitwise',

  // Crypto
  OP_SHA256: 'crypto', OP_HASH160: 'crypto', OP_HASH256: 'crypto',
  OP_RIPEMD160: 'crypto', OP_SHA1: 'crypto',
  OP_CHECKSIG: 'crypto', OP_CHECKSIGVERIFY: 'crypto',
  OP_CHECKMULTISIG: 'crypto', OP_CHECKMULTISIGVERIFY: 'crypto',
  OP_CODESEPARATOR: 'crypto',

  // Flow control
  OP_IF: 'flow', OP_NOTIF: 'flow', OP_ELSE: 'flow', OP_ENDIF: 'flow',
  OP_VERIFY: 'flow', OP_RETURN: 'flow', OP_EQUAL: 'flow', OP_EQUALVERIFY: 'flow',

  // Locktime
  OP_CHECKLOCKTIMEVERIFY: 'locktime', OP_CHECKSEQUENCEVERIFY: 'locktime',

  // Stack
  OP_DUP: 'stack', OP_DROP: 'stack', OP_SWAP: 'stack', OP_NIP: 'stack',
  OP_OVER: 'stack', OP_PICK: 'stack', OP_ROLL: 'stack', OP_ROT: 'stack',
  OP_TUCK: 'stack', OP_2DUP: 'stack', OP_2DROP: 'stack', OP_3DUP: 'stack',
  OP_2OVER: 'stack', OP_2ROT: 'stack', OP_2SWAP: 'stack',
  OP_TOALTSTACK: 'stack', OP_FROMALTSTACK: 'stack',
  OP_IFDUP: 'stack', OP_DEPTH: 'stack', OP_SIZE: 'stack',

  // Data
  OP_CAT: 'data', OP_SPLIT: 'data', OP_NUM2BIN: 'data', OP_BIN2NUM: 'data',
  OP_SUBSTR: 'data', OP_LEFT: 'data', OP_RIGHT: 'data',

  // NOPs
  OP_NOP: 'nop',
};

const CATEGORY_COLORS: Record<OpcodeCategory, string> = {
  push: 'var(--op-push)',
  arithmetic: 'var(--op-arithmetic)',
  bitwise: 'var(--op-bitwise)',
  crypto: 'var(--op-crypto)',
  flow: 'var(--op-flow)',
  locktime: 'var(--op-locktime)',
  stack: 'var(--op-stack)',
  data: 'var(--op-data)',
  nop: 'var(--op-push)',
};

export function getOpcodeColor(opcode: string): string {
  // Strip any data suffix (e.g., "OP_PUSH 0a1b..." → "OP_PUSH")
  const op = opcode.split(' ')[0] ?? opcode;
  const category = CATEGORY_MAP[op];
  if (category) return CATEGORY_COLORS[category];

  // Data push (hex bytes)
  if (/^[0-9a-fA-F]+$/.test(op)) return CATEGORY_COLORS.push;

  return CATEGORY_COLORS.push;
}

export function getOpcodeCategory(opcode: string): OpcodeCategory {
  const op = opcode.split(' ')[0] ?? opcode;
  return CATEGORY_MAP[op] ?? 'push';
}
