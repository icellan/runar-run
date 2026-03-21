interface DebugControlsProps {
  currentStep: number;
  totalSteps: number;
  playing: boolean;
  speed: number;
  skipInactive: boolean;
  showAnnotations: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlay: () => void;
  onSpeedChange: (speed: number) => void;
  onSkipInactiveChange: (skip: boolean) => void;
  onShowAnnotationsChange: (show: boolean) => void;
}

export function DebugControls({
  currentStep,
  totalSteps,
  playing,
  speed,
  skipInactive,
  showAnnotations,
  onReset,
  onPrev,
  onNext,
  onPlay,
  onSpeedChange,
  onSkipInactiveChange,
  onShowAnnotationsChange,
}: DebugControlsProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-surface shrink-0">
      <button
        onClick={onReset}
        className="px-2 py-1 text-[11px] text-text-secondary hover:text-text
                   border border-border rounded hover:border-border-strong transition-colors"
        title="Reset (Home)"
      >
        Reset
      </button>
      <button
        onClick={onPrev}
        disabled={currentStep <= -1}
        className="px-2 py-1 text-[11px] text-text-secondary hover:text-text
                   border border-border rounded hover:border-border-strong transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
        title="Previous step (Left arrow)"
      >
        Prev
      </button>

      <span className="text-xs text-text-secondary tabular-nums min-w-[80px] text-center">
        {currentStep < 0 ? 0 : currentStep + 1} / {totalSteps}
      </span>

      <button
        onClick={onNext}
        disabled={currentStep >= totalSteps - 1}
        className="px-2 py-1 text-[11px] text-text-secondary hover:text-text
                   border border-border rounded hover:border-border-strong transition-colors
                   disabled:opacity-30 disabled:cursor-not-allowed"
        title="Next step (Right arrow)"
      >
        Next
      </button>
      <button
        onClick={onPlay}
        className={`px-2 py-1 text-[11px] border rounded transition-colors ${
          playing
            ? 'text-accent-400 border-accent-500/30 bg-accent-500/10'
            : 'text-text-secondary hover:text-text border-border hover:border-border-strong'
        }`}
        title="Play/Pause"
      >
        {playing ? 'Pause' : 'Run'}
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Skip inactive branches toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer" title="Skip opcodes in non-taken IF branches">
        <input
          type="checkbox"
          checked={skipInactive}
          onChange={(e) => onSkipInactiveChange(e.target.checked)}
          className="accent-accent-500 w-3 h-3"
        />
        <span className="text-[11px] text-text-tertiary">Skip inactive</span>
      </label>

      {/* Source annotations toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer" title="Show source line annotations on opcodes">
        <input
          type="checkbox"
          checked={showAnnotations}
          onChange={(e) => onShowAnnotationsChange(e.target.checked)}
          className="accent-accent-500 w-3 h-3"
        />
        <span className="text-[11px] text-text-tertiary">Annotate</span>
      </label>

      {/* Speed slider */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] text-text-tertiary">Speed</span>
        <input
          type="range"
          min={50}
          max={500}
          step={50}
          value={500 - speed + 50}
          onChange={(e) => onSpeedChange(500 - Number(e.target.value) + 50)}
          className="w-16 h-1 accent-accent-500"
        />
      </div>
    </div>
  );
}
