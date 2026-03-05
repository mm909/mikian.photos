"use client";

const SPEEDS = [1, 2, 4];

interface PlaybackControlsProps {
  playing: boolean;
  speed: number;
  progress: number; // 0-1
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: number) => void;
}

export function PlaybackControls({
  playing,
  speed,
  progress,
  onPlay,
  onPause,
  onRestart,
  onSpeedChange,
}: PlaybackControlsProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-card/90 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 shadow-xl">
      {/* Restart */}
      <button
        onClick={onRestart}
        className="text-white/50 hover:text-white transition-colors"
        title="Restart"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2 2v5h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 8.5a5 5 0 1 0 1.3-4.2L2 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={playing ? onPause : onPlay}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-cream"
        title={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Progress bar */}
      <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-strava rounded-full transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Speed */}
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
              speed === s
                ? "bg-white/15 text-cream"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
