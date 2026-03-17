import { useState, useMemo, useRef, useEffect } from 'react';
import { List, type RowComponentProps } from 'react-window';

interface ScriptHexViewProps {
  hex: string;
}

interface HexRowProps {
  rows: string[][];
  hoveredByte: number | null;
  onHover: (idx: number | null) => void;
}

const ROW_HEIGHT = 22;

function HexRow({ index, style, rows, hoveredByte, onHover }: RowComponentProps<HexRowProps>) {
  const row = rows[index]!;
  return (
    <div style={style} className="flex items-baseline gap-3 py-px">
      <span className="text-text-tertiary w-10 text-right shrink-0 select-none">
        {(index * 16).toString(16).padStart(4, '0')}
      </span>
      <div className="flex flex-wrap gap-x-1.5 gap-y-0">
        {row.map((byte: string, byteIdx: number) => {
          const globalIdx = index * 16 + byteIdx;
          const isHovered = hoveredByte === globalIdx;
          return (
            <span
              key={byteIdx}
              className={`cursor-default transition-colors duration-100 ${
                isHovered ? 'text-accent-400 bg-accent-500/10 rounded' : 'text-text-secondary'
              }`}
              onMouseEnter={() => onHover(globalIdx)}
              onMouseLeave={() => onHover(null)}
              title={`Offset: 0x${globalIdx.toString(16)} (${globalIdx})\nValue: 0x${byte} (${parseInt(byte, 16)})`}
            >
              {byte}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ScriptHexView({ hex }: ScriptHexViewProps) {
  const [hoveredByte, setHoveredByte] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!hex) {
    return <div className="p-3 text-text-tertiary text-xs">No hex output</div>;
  }

  const rows = useMemo(() => {
    const bytes: string[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(hex.slice(i, i + 2));
    }
    const result: string[][] = [];
    for (let i = 0; i < bytes.length; i += 16) {
      result.push(bytes.slice(i, i + 16));
    }
    return result;
  }, [hex]);

  const rowProps = useMemo<HexRowProps>(() => ({
    rows,
    hoveredByte,
    onHover: setHoveredByte,
  }), [rows, hoveredByte]);

  // For small hex outputs, render directly
  if (rows.length <= 100) {
    return (
      <div className="p-3 font-mono text-xs">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-baseline gap-3 py-px">
            <span className="text-text-tertiary w-10 text-right shrink-0 select-none">
              {(rowIdx * 16).toString(16).padStart(4, '0')}
            </span>
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

  return (
    <div ref={containerRef} className="h-full font-mono text-xs">
      <List
        style={{ paddingLeft: 12, paddingRight: 12 }}
        rowCount={rows.length}
        rowHeight={ROW_HEIGHT}
        rowComponent={HexRow}
        rowProps={rowProps}
        overscanCount={20}
      >
        {null}
      </List>
    </div>
  );
}
