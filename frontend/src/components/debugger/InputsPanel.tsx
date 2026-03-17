import { useState, useEffect, useRef } from 'react';

interface InputsPanelProps {
  unlockScript: string;
  onChange: (value: string) => void;
  onRerun: () => void;
}

export function InputsPanel({ unlockScript, onChange, onRerun }: InputsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState(unlockScript);
  const committed = useRef(unlockScript);

  useEffect(() => {
    if (unlockScript !== committed.current) {
      setLocal(unlockScript);
      committed.current = unlockScript;
    }
  }, [unlockScript]);

  const commit = () => {
    if (local !== committed.current) {
      committed.current = local;
      onChange(local);
    }
  };

  return (
    <div className="border-b border-border shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-3 py-1 text-[11px] text-text-tertiary
                   hover:text-text-secondary transition-colors"
      >
        <span>{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>Manual unlock script override</span>
        {unlockScript && <span className="text-warning text-[10px]">(overriding auto-generated)</span>}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          <div className="text-[10px] text-text-tertiary">
            Paste raw hex here to override the auto-generated unlock script. Clear to use the example's method call with real signatures.
          </div>
          <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            placeholder="Raw unlocking script hex (leave empty for auto-generated)"
            className="w-full h-14 p-2 bg-bg border border-border rounded text-xs font-mono
                       text-text-secondary placeholder:text-text-tertiary resize-none
                       focus:border-accent-500/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { commit(); onRerun(); }}
              className="px-2 py-1 text-[11px] text-text-secondary border border-border
                         rounded hover:border-border-strong hover:text-text transition-colors"
            >
              Re-execute
            </button>
            {local && (
              <button
                onClick={() => { setLocal(''); committed.current = ''; onChange(''); }}
                className="px-2 py-1 text-[11px] text-text-tertiary border border-border
                           rounded hover:border-border-strong hover:text-text transition-colors"
              >
                Clear override
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
