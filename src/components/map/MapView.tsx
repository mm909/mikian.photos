"use client";

import dynamic from "next/dynamic";
import type { Run } from "@/lib/types";

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-card flex items-center justify-center">
      <div className="text-white/30 text-sm">Loading map...</div>
    </div>
  ),
});

export interface MapViewProps {
  runs: Run[];
}

export default function MapView({ runs }: MapViewProps) {
  return <MapInner runs={runs} />;
}
