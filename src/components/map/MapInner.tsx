"use client";

import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Run } from "@/lib/types";

const RUN_COLORS = [
  "#c8956c", // dusty terracotta
  "#7898a8", // dusty slate blue
  "#8daa89", // dusty sage
  "#a89098", // dusty mauve
  "#b5a07c", // warm sand
  "#9896b8", // dusty lavender
];

interface MapInnerProps {
  runs: Run[];
  onReady?: () => void;
}

function exportSVG(map: L.Map, runs: Run[]) {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const W = 1920;
  const H = Math.round(W * (ne.lat - sw.lat) / (ne.lng - sw.lng)) || 1080;

  const toX = (lng: number) => ((lng - sw.lng) / (ne.lng - sw.lng)) * W;
  const toY = (lat: number) => ((ne.lat - lat) / (ne.lat - sw.lat)) * H;

  const paths = runs
    .map((run, i) => {
      const color = RUN_COLORS[i % RUN_COLORS.length];
      const pts = run.points
        .map((p) => `${toX(p.lon).toFixed(1)},${toY(p.lat).toFixed(1)}`)
        .join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-opacity="0.85" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  ${paths}
</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dtk-routes.svg";
  a.click();
  URL.revokeObjectURL(url);
}

export default function MapInner({ runs, onReady }: MapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRefs = useRef<L.Polyline[]>([]);
  const onReadyRef = useRef(onReady);
  const runsRef = useRef(runs);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { runsRef.current = runs; }, [runs]);

  const handleExport = useCallback(() => {
    if (mapRef.current) exportSVG(mapRef.current, runsRef.current);
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [36.15, -115.15],
      zoom: 13,
      zoomControl: true,
    });

    const tileLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxNativeZoom: 19,
        maxZoom: 22,
        keepBuffer: 6,
        updateWhenZooming: false,
      }
    ).addTo(map);

    tileLayer.once("load", () => {
      onReadyRef.current?.();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw static polylines when runs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up previous
    polylineRefs.current.forEach((p) => p.remove());
    polylineRefs.current = [];

    if (runs.length === 0) return;

    runs.forEach((run, i) => {
      const color = RUN_COLORS[i % RUN_COLORS.length];
      const latlngs = run.points.map(
        (p) => [p.lat, p.lon] as [number, number]
      );

      const dateStr = new Date(run.startTime).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const line = L.polyline(latlngs, {
        color,
        weight: 3,
        opacity: 0.85,
      })
        .bindTooltip(dateStr, { sticky: true, direction: "top", offset: [0, -8] })
        .addTo(map);

      polylineRefs.current.push(line);
    });

    // Fit bounds to all runs
    const allPoints = runs.flatMap((r) =>
      r.points.map((p) => [p.lat, p.lon] as [number, number])
    );
    map.fitBounds(L.latLngBounds(allPoints), { padding: [32, 32] });
  }, [runs]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "#0c0b0a" }}
      />
      {runs.length > 0 && (
        <button
          onClick={handleExport}
          title="Download routes as SVG"
          className="absolute bottom-6 right-3 z-[1000] bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded px-2.5 py-1.5 text-xs font-mono tracking-wide transition-colors backdrop-blur-sm"
        >
          SVG
        </button>
      )}
    </div>
  );
}
