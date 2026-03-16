import type { OpcodeSnapshot } from '../../lib/execution-bridge';
import { StackItem } from './StackItem';

interface StackPanelProps {
  snapshot: OpcodeSnapshot | null;
}

export function StackPanel({ snapshot }: StackPanelProps) {
  if (!snapshot) {
    return (
      <div className="p-3 text-text-tertiary text-xs">
        No stack state
      </div>
    );
  }

  const { stack, altStack } = snapshot;

  return (
    <div className="p-2">
      {/* Main stack */}
      <div className="text-text-tertiary text-[10px] uppercase tracking-wide mb-1 px-1">
        Stack ({stack.length})
      </div>
      {stack.length === 0 ? (
        <div className="text-text-tertiary text-xs px-1 py-2">(empty)</div>
      ) : (
        <div className="space-y-0.5">
          {stack.map((item, i) => (
            <StackItem
              key={i}
              index={i}
              bytes={item}
              isTop={i === stack.length - 1}
            />
          ))}
        </div>
      )}

      {/* Alt stack */}
      {altStack.length > 0 && (
        <>
          <div className="text-text-tertiary text-[10px] uppercase tracking-wide mt-3 mb-1 px-1">
            Alt Stack ({altStack.length})
          </div>
          <div className="space-y-0.5">
            {altStack.map((item, i) => (
              <StackItem
                key={i}
                index={i}
                bytes={item}
                isTop={i === altStack.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
