"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { loadRunsProgressive } from "@/lib/manifestLoader";
import type { LoadProgress } from "@/lib/manifestLoader";
import MapView from "@/components/map/MapView";
import type { Run } from "@/lib/types";

type Status = "loading" | "empty" | "ready" | "error";

interface LoadEntry {
  name: string;
  date: string;
  status: "ok" | "error";
}

export default function MapPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedEntries, setLoadedEntries] = useState<LoadEntry[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const handleProgress = useCallback((progress: LoadProgress) => {
    setTotal(progress.total);
    setLoadedEntries((prev) => [
      ...prev,
      { name: progress.name, date: progress.date, status: progress.status },
    ]);
  }, []);

  const handleMapReady = useCallback(() => {
    setMapReady(true);
  }, []);

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loadedEntries.length]);

  useEffect(() => {
    const controller = new AbortController();

    setTotal(0);
    setLoadedEntries([]);
    setRunsLoaded(false);
    setMapReady(false);

    loadRunsProgressive(handleProgress, controller.signal)
      .then((r) => {
        setRuns(r);
        setRunsLoaded(true);
        if (r.length === 0) setStatus("empty");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to load runs:", err);
        setStatus("error");
      });

    return () => controller.abort();
  }, [handleProgress]);

  // Transition to ready once both runs are loaded and map tiles are done
  useEffect(() => {
    if (runsLoaded && mapReady && runs.length > 0) {
      setStatus("ready");
    }
  }, [runsLoaded, mapReady, runs.length]);

  const showOverlay = status === "loading";
  const loaded = loadedEntries.length;

  if (status === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark gap-2">
        <p className="text-cream text-sm font-semibold">Could not load data</p>
        <p className="text-muted text-xs">Check that manifest.json is accessible.</p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark gap-3 px-6 text-center">
        <p className="text-cream text-base font-semibold">No runs yet</p>
        <p className="text-muted text-sm max-w-xs">
          Add GPX files to{" "}
          <code className="text-strava text-xs">public/downtownkruz/gpx/</code>{" "}
          and update <code className="text-strava text-xs">manifest.json</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex relative bg-dark overflow-hidden">
      {/* Map renders underneath, initializing while loading screen shows */}
      <MapView runs={runs} onReady={handleMapReady} />

      {/* Loading overlay */}
      {showOverlay && (
        <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-dark px-6">
          <div className="w-full max-w-sm flex flex-col gap-4">
            {/* Counter */}
            <div className="flex items-center justify-between">
              <p className="text-cream text-sm font-mono font-semibold">
                Loading runs
              </p>
              {total > 0 && (
                <p className="text-muted text-xs font-mono">
                  {loaded}/{total}
                </p>
              )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-strava rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${(loaded / total) * 100}%` }}
                />
              </div>
            )}

            {/* Scrolling file list */}
            <div className="h-56 overflow-y-auto scrollbar-none">
              <div className="flex flex-col gap-1.5">
                {loadedEntries.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex items-baseline justify-between gap-3 ${
                      entry.status === "ok" ? "text-white/40" : "text-red-400/60"
                    }`}
                  >
                    <p className="text-xs font-mono truncate">
                      {entry.name}
                    </p>
                    {entry.date && (
                      <p className="text-[10px] font-mono text-white/25 shrink-0">
                        {entry.date}
                      </p>
                    )}
                  </div>
                ))}
                <div ref={listEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
