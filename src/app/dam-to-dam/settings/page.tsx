import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { THEME_COLOR } from "../look";
import { readLook } from "../readLook";
import { RouteMap } from "../RouteMap";
import { css, spaceMono } from "../theme";
import { LookPicker } from "./LookPicker";

/* THE LOOK SETTINGS (owner, 2026-11-03: "Keep both options and put them in
 * a settings page. Also let me select isometric or top down.") — the two
 * palettes and the two projections as cookie-backed radios (LookPicker),
 * with the live chart underneath so a change shows itself at once.
 *
 * IN DEVELOPMENT with the rest of /dam-to-dam: owner-only in production,
 * open in local dev. */

export const metadata: Metadata = {
  title: "Settings (dev) — Dam to Dam",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export function generateViewport(): Viewport {
  return { themeColor: THEME_COLOR[readLook().look] };
}

export default async function DamToDamSettingsPage() {
  const actor = await getEffectiveActor();
  const owner = actor ? isOwner(actor) : false;
  if (process.env.NODE_ENV === "production" && !owner) notFound();
  const { look, view } = readLook();

  return (
    <div className={`dd dd-${look} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="dd-bar">
        <div className="dd-wm">
          <Link href="/dam-to-dam">Dam to Dam</Link>
        </div>
        <div className="dd-doors">
          <Link href="/dam-to-dam" className="dd-door">
            Back to the page
          </Link>
          <span className="dd-dev">Dev</span>
        </div>
      </div>

      <div className="wrap">
        <LookPicker look={look} view={view} />

        <section>
          <div className="dd-head">
            <h2>Preview</h2>
            <span>as every page draws it</span>
          </div>
          <div className={`dd-chart ${view}`}>
            <RouteMap view={view} />
          </div>
        </section>
      </div>

      <footer>Dam to Dam · settings</footer>
    </div>
  );
}
