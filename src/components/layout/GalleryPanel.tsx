"use client";

import { useState, useCallback } from "react";
import { RunSection } from "@/components/layout/RunSection";
import { PhotoModal } from "@/components/photos/PhotoModal";
import type { Run, MatchedPhoto } from "@/lib/types";

interface GalleryPanelProps {
  runs: Run[];
  matches: MatchedPhoto[];
  hoveredFilename: string | null;
  onHover: (filename: string | null) => void;
  onCollapse: () => void;
}

export function GalleryPanel({
  runs,
  matches,
  hoveredFilename,
  onHover,
  onCollapse,
}: GalleryPanelProps) {
  const [modalMatches, setModalMatches] = useState<MatchedPhoto[]>([]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);

  const handlePhotoClick = useCallback((sectionMatches: MatchedPhoto[], index: number) => {
    setModalMatches(sectionMatches);
    setModalIndex(index);
  }, []);

  const handleModalClose = useCallback(() => setModalIndex(null), []);
  const handleModalPrev = useCallback(
    () => setModalIndex((i) => (i !== null && i > 0 ? i - 1 : i)),
    []
  );
  const handleModalNext = useCallback(
    () =>
      setModalIndex((i) =>
        i !== null && i < modalMatches.length - 1 ? i + 1 : i
      ),
    [modalMatches.length]
  );

  // Group matches by runId
  const matchesByRun = new Map<string, MatchedPhoto[]>();
  for (const m of matches) {
    const arr = matchesByRun.get(m.runId) ?? [];
    arr.push(m);
    matchesByRun.set(m.runId, arr);
  }

  // Runs sorted by start time
  const sortedRuns = [...runs].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  const totalPhotos = matches.length;

  return (
    <div className="flex flex-col h-full bg-card border-l border-white/10 relative">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          {/* Collapse arrow (points right → collapses gallery) */}
          <button
            onClick={onCollapse}
            className="text-white/40 hover:text-white transition-colors"
            title="Collapse gallery"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className="text-cream text-sm font-medium">Gallery</span>
          <span className="text-white/30 text-xs">{totalPhotos} photos</span>
        </div>
      </div>

      {/* Scrollable run sections */}
      <div className="flex-1 overflow-y-auto">
        {sortedRuns.map((run) => {
          const runMatches = matchesByRun.get(run.id) ?? [];
          if (runMatches.length === 0) return null;
          return (
            <RunSection
              key={run.id}
              run={run}
              matches={runMatches}
              hoveredFilename={hoveredFilename}
              onHover={onHover}
              onPhotoClick={handlePhotoClick}
            />
          );
        })}

        {totalPhotos === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-white/25 text-sm">
            No photos to display
          </div>
        )}
      </div>

      {/* Full-screen photo modal */}
      <PhotoModal
        matches={modalMatches}
        index={modalIndex}
        onClose={handleModalClose}
        onPrev={handleModalPrev}
        onNext={handleModalNext}
      />
    </div>
  );
}
