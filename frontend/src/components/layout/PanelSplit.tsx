import { useCallback, useRef, useState, type ReactNode } from 'react';

interface PanelSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
}

export function PanelSplit({
  left,
  right,
  defaultLeftPercent = 45,
  minLeftPercent = 20,
  maxLeftPercent = 80,
}: PanelSplitProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = (x / rect.width) * 100;
        setLeftPercent(Math.min(maxLeftPercent, Math.max(minLeftPercent, pct)));
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [minLeftPercent, maxLeftPercent],
  );

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0">
      <div style={{ width: `${leftPercent}%` }} className="min-w-0">
        {left}
      </div>
      <div
        className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-accent-500/30 transition-colors duration-150"
        onMouseDown={onMouseDown}
      />
      <div style={{ width: `${100 - leftPercent}%` }} className="min-w-0">
        {right}
      </div>
    </div>
  );
}
