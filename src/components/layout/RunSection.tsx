"use client";

import { useState, useCallback, memo } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { PhotoCard } from "@/components/photos/PhotoCard";
import type { Run, MatchedPhoto } from "@/lib/types";

const MAX_PHOTOS_PER_RUN = 20;
const TIMEZONE = "America/Los_Angeles";

interface RunSectionProps {
  run: Run;
  matches: MatchedPhoto[];
  hoveredFilename: string | null;
  onHover: (filename: string | null) => void;
  onPhotoClick: (matches: MatchedPhoto[], index: number) => void;
}

export const RunSection = memo(function RunSection({
  run,
  matches,
  hoveredFilename,
  onHover,
  onPhotoClick,
}: RunSectionProps) {
  const [open, setOpen] = useState(true);

  // Sort by time, cap at MAX_PHOTOS_PER_RUN
  const sorted = [...matches].sort((a, b) => a.photo.utcTimeMs - b.photo.utcTimeMs);
  const shown = sorted.slice(0, MAX_PHOTOS_PER_RUN);
  const overflow = sorted.length - shown.length;

  const localStart = toZonedTime(run.startTime, TIMEZONE);
  const dateLabel = format(localStart, "MMM d, yyyy");

  const handleClick = useCallback(
    (index: number) => onPhotoClick(sorted, index),
    [sorted, onPhotoClick]
  );

  return (
    <div className="border-b border-white/8 last:border-b-0">
      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-cream text-sm font-medium truncate">{run.name}</span>
          <span className="text-white/30 text-xs shrink-0">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-white/40 text-xs">
            {sorted.length} photo{sorted.length !== 1 ? "s" : ""}
          </span>
          {/* Chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className={`text-white/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path
              d="M2 5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {/* Photo grid */}
      {open && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-3 gap-1">
            {shown.map((match, idx) => (
              <PhotoCard
                key={match.photo.filename}
                match={match}
                isHovered={hoveredFilename === match.photo.filename}
                onClick={() => handleClick(idx)}
                onHover={onHover}
              />
            ))}
          </div>
          {overflow > 0 && (
            <p className="text-white/30 text-xs mt-2 text-center">
              +{overflow} more photo{overflow !== 1 ? "s" : ""} (increase limit to see all)
            </p>
          )}
        </div>
      )}
    </div>
  );
});
