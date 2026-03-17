import { useMemo, memo } from 'react';

interface StackItemProps {
  index: number;
  bytes: number[];
  isTop: boolean;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function tryDecodeUtf8(bytes: number[]): string | null {
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    // Only return if it's printable
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

function tryDecodeInt(bytes: number[]): string | null {
  if (bytes.length === 0) return '0';
  if (bytes.length > 8) return null;

  // Little-endian signed integer (Bitcoin Script number encoding)
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value |= BigInt(bytes[i]!) << BigInt(i * 8);
  }

  // Check sign bit
  const lastByte = bytes[bytes.length - 1]!;
  if (lastByte & 0x80) {
    // Negative: clear sign bit and negate
    value &= ~(1n << BigInt(bytes.length * 8 - 1));
    value = -value;
  }

  return value.toString();
}

export const StackItem = memo(function StackItem({ index, bytes, isTop }: StackItemProps) {
  const hex = useMemo(() => bytesToHex(bytes), [bytes]);
  const utf8 = useMemo(() => tryDecodeUtf8(bytes), [bytes]);
  const intVal = useMemo(() => tryDecodeInt(bytes), [bytes]);

  const tooltip = [
    `Index: ${index}`,
    `Hex: ${hex || '(empty)'}`,
    `Length: ${bytes.length} bytes`,
    intVal !== null ? `Int: ${intVal}` : null,
    utf8 !== null ? `UTF-8: "${utf8}"` : null,
  ].filter(Boolean).join('\n');

  // Display value: prefer short representations
  let displayValue = hex || '(empty)';
  if (bytes.length <= 4 && intVal !== null) {
    displayValue = intVal;
  }

  return (
    <div
      className={`flex items-center gap-2 px-2 py-0.5 rounded font-mono text-xs
        transition-all duration-150
        ${isTop ? 'border border-accent-500/20 bg-accent-500/5' : 'hover:bg-white/[0.02]'}
      `}
      title={tooltip}
      style={{
        animation: 'fade-in 0.15s ease-out',
      }}
    >
      {/* Index */}
      <span className="text-text-tertiary w-5 text-right shrink-0 text-[10px]">
        {index}:
      </span>

      {/* Value */}
      <span className="text-text-secondary truncate">
        {displayValue}
      </span>

      {/* Byte count */}
      <span className="text-text-tertiary ml-auto text-[10px] shrink-0">
        {bytes.length}B
      </span>
    </div>
  );
});
