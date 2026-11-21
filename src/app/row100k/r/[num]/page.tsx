import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmtRowerNumber } from "@/lib/row100k";
import { barProps } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { DogTag } from "./looks/DogTag";
import { Profile } from "./looks/Profile";
import { paceCss } from "./looks/paceCss";
import { profileCss } from "./looks/profileCss";
import { buildProfile } from "./profileData";
import { getRower } from "./shareData";

export const dynamic = "force-dynamic";

/* One rower's public page: their stats, their September calendar, their
 * log. Reached by clicking any name on the boards. Settings live on
 * /row100k/settings and moderation on /row100k/moderation (owner call,
 * 2026-09-05) — this page is the rower's, and only the logging station
 * and the share button change with who is looking. This file computes
 * the view; looks/Profile.tsx lays it out (the owner's pick from three
 * looks, same day — the ?look= switch is gone with the other two).
 *
 * Blackout: while a window is open, THE ELITE — the top N of each board,
 * or the top N overall, as the policy says (rowSettings.ts) — have their
 * numbers hidden from the
 * public. This page hides exactly the rowers the board hides — same masked
 * set, same self/admin exemptions — and draws blocks of the right shape
 * wherever a number of theirs would print — meters, times and the pace
 * bests alike (owner rule, 2026-09-05: a time over a known distance is the
 * meters by another route); the calendar, which is the numbers by another
 * name, goes entirely. Names, dates and the sessions count stay. Their
 * PLACE does not (owner, same evening): the elite carry none while hidden,
 * themself included, so the ledger says ELITE (ELITE_TAG) where the rank
 * would be and no card draws a #. */

/* The rower read (getRower), the share payload and the bests live in
 * shareData.ts since 2026-09-24. They were split out for a shareables page
 * that has since gone (owner, 2026-09-25: "did not land — revert to just
 * the poster"); this page is their one reader now. */

/* The view itself (who is hidden, the bests, the pace, the field, the log)
 * is computed in profileData.ts since 2026-11-20, where the phone app's
 * route reads it too. */

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

export async function generateMetadata({ params }: { params: { num: string } }): Promise<Metadata> {
  const num = parseNum(params.num);
  const data = num ? await getRower(num).catch(() => null) : null;
  const title = data
    ? `Rower ${fmtRowerNumber(data.participant.rowerNumber)} · ${data.participant.displayName} — Rowtember`
    : "Rower — Rowtember";
  return { title };
}

export default async function RowerProfilePage({ params, searchParams }: { params: { num: string }; searchParams?: { m?: string | string[] } }) {
  const num = parseNum(params.num);
  if (!num) notFound();
  const built = await buildProfile(num, searchParams?.m);
  if (!built) notFound();
  const { view, viewer, until, rel } = built;
  /* Blocked, either way: there is no page (lib/rowSocial.ts). */
  if (rel.access === "blocked") notFound();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{paceCss}</style>
      <style>{profileCss}</style>
      {/* The viewer is already resolved, so the bar skips its own lookup.
          No ROWER-number tag in it — the nameplate just below says whose
          page this is. */}
      <RowBar {...barProps(viewer)} />
      {/* One of the elite, seen by anybody else while a window is open:
          the profile is a dog tag, not a wall of blocks (owner,
          2026-09-06). Self and admins keep the whole page — an elite
          rower's own page carries the tag under the stats (view.ownTag). */}
      {/* A PRIVATE ACCOUNT, seen by somebody it has not accepted: the totals,
          and a line saying why there are no rows under them. */}
      {rel.access === "private" ? (
        <p style={{ margin: "18px auto 0", maxWidth: 1080, padding: "0 20px", fontFamily: "var(--font-space-mono), monospace", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Private account · rows are shown to followers this rower has accepted
        </p>
      ) : null}
      {view.masked ? (
        <DogTag view={view} until={until} />
      ) : (
        <Profile view={view} />
      )}
      <RowFooter />
    </div>
  );
}
