import type { Metadata } from "next";
import { forcedBlackout } from "@/lib/blackoutRules";
import { notFound } from "next/navigation";
import { START_MS, nowMs } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { communityPosterData, posterRoster, rowerPosterData } from "../poster/data";
import { raceDayPosterData } from "../poster/raceData";
import { poCss } from "../poster/studioCss";
import type { CommunityPoster, PosterRosterRower, RaceDayPoster, RowerPoster } from "../poster/types";
import { PosterStudio } from "./PosterStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The poster — 100K September",
  robots: { index: false, follow: false },
};

/* THE POSTER STUDIO — PUBLIC since 2026-09-16 (owner: "Lets make the
 * posters public. Only the racer's copy not the rowtember total or race
 * day"; the post pack was retired into it the same day). Everything the
 * sheet draws is gathered here on the server (poster/data.ts) and handed
 * to the client as plain JSON; the browser only draws.
 *
 * ONE ROWER is the only subject for everyone. The board it reads is the
 * PUBLIC one — a poster leaves the site, so one of the elite draws blocks
 * for a stranger, for themself and for the owner alike (owner,
 * 2026-09-05: "I shouldn't be able to know that I'm number three or
 * number four"); an admin's test blackout forces the window the way it
 * does on every page. Any ?r=N works: profiles are public. The default
 * subject is the viewer's own rower when they have joined; a signed-out or
 * unjoined visitor gets the roster picker.
 *
 * ROWTEMBER and RACE DAY stay admin-only and their payloads are never read
 * for anyone else. An admin reaches Rowtember with ?subject=rowtember (the
 * chip's href), because their no-query default is their own rower too. */

function parseNum(raw: string | undefined): number | null {
  if (typeof raw !== "string" || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function PostersPage({
  searchParams,
}: {
  searchParams?: { r?: string | string[]; subject?: string | string[] };
}) {
  const viewer = await resolveViewer();
  const admin = viewer.isAdmin;

  const before = nowMs() < START_MS;
  const rRaw = one(searchParams?.r);
  const rNum = parseNum(rRaw);
  if (rRaw !== undefined && rNum === null) notFound();
  const subjectQ = one(searchParams?.subject);
  const wantsCommunity = admin && (subjectQ === "rowtember" || subjectQ === "community");
  // The subject: ?r=N, else the viewer's own rower (any joined rower, the
  // owner included), else nothing — the picker. Only an explicit ?r= may 404.
  const explicit = rNum !== null;
  const subjectNum = explicit ? rNum : wantsCommunity ? null : (viewer.me?.rowerNumber ?? null);
  const opts = { forceBlackout: forcedBlackout(viewer.preview) };

  let community: CommunityPoster | null = null;
  let rower: RowerPoster | null = null;
  let roster: PosterRosterRower[] = [];
  /* RACE DAY is a chip, not a route (poster/raceData.ts): read for an admin
   * whatever the subject, because the chip flips without a navigation.
   * Never read for anyone else. */
  let raceday: RaceDayPoster | null = null;
  if (!before) {
    const [c, r, ro, rd] = await Promise.all([
      admin
        ? communityPosterData(opts).catch((err: unknown) => {
            console.error("row100k/posters: community payload failed", err);
            return null;
          })
        : Promise.resolve(null),
      subjectNum
        ? rowerPosterData(subjectNum, opts).catch((err: unknown) => {
            console.error(`row100k/posters: rower payload failed (rower ${subjectNum})`, err);
            return null;
          })
        : Promise.resolve(null),
      posterRoster(),
      admin
        ? raceDayPosterData().catch((err: unknown) => {
            console.error("row100k/posters: race day payload failed", err);
            return null;
          })
        : Promise.resolve(null),
    ]);
    community = c;
    rower = r;
    roster = ro;
    raceday = rd;
    // An explicit ?r= that names nobody is a 404, the way the profile is. A
    // default that could not be read falls through to the picker (or, for
    // an admin, to Rowtember) rather than 404 on a hiccup.
    if (explicit && !rower) notFound();
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{poCss}</style>

      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The poster</h2>
            <span className="mono">ONE ROWER · PRINT OR INSTAGRAM</span>
          </div>
          {before ? (
            <p className="po-first">FIRST STROKE SEP 1</p>
          ) : (
            <PosterStudio
              community={community}
              rower={rower}
              raceday={raceday}
              roster={roster}
              rowerOnly={!admin}
            />
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
