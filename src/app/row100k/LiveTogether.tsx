"use client";

import Link from "next/link";
import type { MeterSnapshot } from "@/lib/homeStats";
import { Odometer } from "@/components/home/Home";
import { useLiveMeters } from "@/components/home/useLiveMeters";

/* METERS TOGETHER, live (owner, 2026-09-24: the front should look closer
 * to the counter page at mikianmusser.com — "the meters together starts
 * incrementing live on the active month"). The landing's own wheels and
 * engine (Home.tsx Odometer, useLiveMeters.ts polling /api/home/meters,
 * which already serves the month the clock is in), in the first cell of
 * the counter row. The number is a link to the stats page (owner: "if we
 * click on the meters together number it takes us to the stats page. No
 * view-stats button"). The server-rendered snapshot is the first paint,
 * so nothing to hydrate; the dot appears once the wheels are turning. */
export function LiveTogether({ snapshot }: { snapshot: MeterSnapshot }) {
  const m = useLiveMeters(snapshot);
  return (
    <div className="front-live">
      <Link href="/row100k/stats" className="front-live-link" aria-label="the stats page">
        <Odometer meters={m.meters} tempo={m.tempoMs} />
      </Link>
      <div className="l mono">
        {m.live ? <span className="dot" aria-hidden="true" /> : null}
        meters together
      </div>
    </div>
  );
}
