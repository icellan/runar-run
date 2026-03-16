import { useState } from 'react';

interface ScriptHexViewProps {
  hex: string;
}

export function ScriptHexView({ hex }: ScriptHexViewProps) {
  const [hoveredByte, setHoveredByte] = useState<number | null>(null);

  if (!hex) {
    return <div className="p-3 text-text-tertiary text-xs">No hex output</div>;
  }

  // Split hex into bytes
  const bytes: string[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(hex.slice(i, i + 2));
  }

  // Group into rows of 16 bytes
  const rows: string[][] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    rows.push(bytes.slice(i, i + 16));
  }

  return (
    <div className="p-3 font-mono text-xs">
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-baseline gap-3 py-px">
          {/* Offset */}
          <span className="text-text-tertiary w-10 text-right shrink-0 select-none">
            {(rowIdx * 16).toString(16).padStart(4, '0')}
          </span>
          {/* Bytes */}
          <div className="flex flex-wrap gap-x-1.5 gap-y-0">
            {row.map((byte, byteIdx) => {
              const globalIdx = rowIdx * 16 + byteIdx;
              const isHovered = hoveredByte === globalIdx;
              return (
                <span
                  key={byteIdx}
                  className={`cursor-default transition-colors duration-100 ${
                    isHovered ? 'text-accent-400 bg-accent-500/10 rounded' : 'text-text-secondary'
                  }`}
                  onMouseEnter={() => setHoveredByte(globalIdx)}
                  onMouseLeave={() => setHoveredByte(null)}
                  title={`Offset: 0x${globalIdx.toString(16)} (${globalIdx})\nValue: 0x${byte} (${parseInt(byte, 16)})`}
                >
                  {byte}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
