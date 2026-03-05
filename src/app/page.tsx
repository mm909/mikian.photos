"use client";

import { useEffect, useState } from "react";
import { loadRuns } from "@/lib/manifestLoader";
import MapView from "@/components/map/MapView";
import type { Run } from "@/lib/types";

type Status = "loading" | "empty" | "ready" | "error";

export default function MapPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [runs, setRuns] = useState<Run[]>([]);

  useEffect(() => {
    loadRuns()
      .then((r) => {
        setRuns(r);
        setStatus(r.length === 0 ? "empty" : "ready");
      })
      .catch((err) => {
        console.error("Failed to load runs:", err);
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark">
        <p className="text-muted text-sm">Loading runs&hellip;</p>
      </div>
    );
  }

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
      <MapView runs={runs} />
    </div>
  );
}
