"use client";

import { useEffect, useRef } from "react";

/* ZOOM FOR THE CHART (owner, 2026-11-03: "allow me to zoom in to the main
 * map as well") — a client shell around the server-rendered SVG that
 * drives its viewBox, so the line art stays vector-crisp at any depth and
 * the chart itself ships no script.
 *
 * Gestures: ctrl/cmd + wheel (the trackpad-pinch browsers report), real
 * two-finger pinch, double-click to step in (shift to step out), drag to
 * pan once zoomed, and the +/−/reset buttons for discoverability. Plain
 * wheel is left alone so the page still scrolls over the chart; touch
 * panning only captures the finger once zoomed in. */

const MAX_Z = 12;

export function ZoomPan({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<{ zoom: (f: number, cx?: number, cy?: number) => void; reset: () => void }>({
    zoom: () => {},
    reset: () => {},
  });

  useEffect(() => {
    const el = ref.current;
    const svg = el?.querySelector("svg");
    if (!el || !svg) return;
    const vb0 = (svg.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number) as [number, number, number, number];
    let vb: [number, number, number, number] = [...vb0];

    const z = () => vb0[2] / vb[2];
    const apply = () => {
      /* Keep the window inside the original sheet. */
      vb[2] = Math.min(vb0[2], Math.max(vb0[2] / MAX_Z, vb[2]));
      vb[3] = (vb[2] / vb0[2]) * vb0[3];
      vb[0] = Math.min(vb0[0] + vb0[2] - vb[2], Math.max(vb0[0], vb[0]));
      vb[1] = Math.min(vb0[1] + vb0[3] - vb[3], Math.max(vb0[1], vb[1]));
      svg.setAttribute("viewBox", vb.map((n) => n.toFixed(2)).join(" "));
      el.style.touchAction = z() > 1.01 ? "none" : "";
      el.style.cursor = z() > 1.01 ? "grab" : "";
    };

    /** Zoom by factor f around the client point (cx, cy). */
    const zoomAt = (f: number, cx?: number, cy?: number) => {
      const r = svg.getBoundingClientRect();
      const px = cx === undefined ? 0.5 : (cx - r.left) / r.width;
      const py = cy === undefined ? 0.5 : (cy - r.top) / r.height;
      const w = vb[2] / f;
      vb = [vb[0] + (vb[2] - w) * px, vb[1] + (vb[3] - (w / vb0[2]) * vb0[3]) * py, w, (w / vb0[2]) * vb0[3]];
      apply();
    };
    api.current = {
      zoom: zoomAt,
      reset: () => {
        vb = [...vb0];
        apply();
      },
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
    };
    const onDbl = (e: MouseEvent) => {
      e.preventDefault();
      zoomAt(e.shiftKey ? 0.5 : 2, e.clientX, e.clientY);
    };

    /* Pointers: one drags (when zoomed), two pinch. */
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch0 = 0;
    const onDown = (e: PointerEvent) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      }
      if (ptrs.size === 1 && z() > 1.01) {
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (ptrs.size === 2) {
        ptrs.set(e.pointerId, cur);
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0 > 0 && Math.abs(d - pinch0) > 2) {
          zoomAt(d / pinch0, (a.x + b.x) / 2, (a.y + b.y) / 2);
          pinch0 = d;
        }
        return;
      }
      if (z() > 1.01) {
        const r = svg.getBoundingClientRect();
        vb[0] -= ((cur.x - prev.x) / r.width) * vb[2];
        vb[1] -= ((cur.y - prev.y) / r.height) * vb[3];
        ptrs.set(e.pointerId, cur);
        apply();
      }
    };
    const onUp = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      pinch0 = 0;
      if (z() > 1.01) el.style.cursor = "grab";
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDbl);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDbl);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div className="dd-zoomwrap">
      <div ref={ref} className="dd-zoombox">
        {children}
      </div>
      <div className="dd-zoomui" aria-hidden="false">
        <button type="button" aria-label="Zoom in" onClick={() => api.current.zoom(1.5)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => api.current.zoom(1 / 1.5)}>
          −
        </button>
        <button type="button" aria-label="Reset zoom" onClick={() => api.current.reset()}>
          ⟲
        </button>
      </div>
    </div>
  );
}
