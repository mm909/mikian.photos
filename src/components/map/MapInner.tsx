"use client";

import { useEffect, useRef } from "react";
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
}

export default function MapInner({ runs }: MapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRefs = useRef<L.Polyline[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [36.15, -115.15],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxNativeZoom: 19,
        maxZoom: 22,
      }
    ).addTo(map);

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

      const dateStr = run.startTime.toLocaleDateString("en-US", {
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
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#0c0b0a" }}
    />
  );
}
