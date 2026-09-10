import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CHALLENGE, START_MS, fmtRowerNumber, nowMs } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../../theme";
import { RowBar } from "../../../RowBar";
import { RowFooter } from "../../../RowFooter";
import { rowerPosterData } from "../../../poster/data";
import { poCss } from "../../../poster/studioCss";
import type { RowerPoster } from "../../../poster/types";
import { PosterStudio } from "../../../posters/PosterStudio";

export const dynamic = "force-dynamic";

/* A ROWER'S OWN POSTER (SPEC.md §11): the same studio with the subject
 * fixed, for the rower themself and for admins — admins print these to
 * hand out at shirt pick-up. Everyone else gets a 404, the way the
 * settings page does. The payload is the public-board one (poster/data.ts):
 * one of the elite gets blocks on their own poster, because the poster
 * leaves the site. */

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}

export async function generateMetadata({ params }: { params: { num: string } }): Promise<Metadata> {
  const num = parseNum(params.num);
  let name: string | null = null;
  if (num) {
    try {
      const p = await db.rowParticipant.findUnique({
        where: { challenge_rowerNumber: { challenge: CHALLENGE, rowerNumber: num } },
        select: { displayName: true },
      });
      name = p?.displayName ?? null;
    } catch {
      name = null;
    }
  }
  return {
    title: num && name ? `Rower ${fmtRowerNumber(num)} · ${name} — poster` : "Rower — poster",
    robots: { index: false, follow: false },
  };
}

export default async function RowerPosterPage({ params }: { params: { num: string } }) {
  const num = parseNum(params.num);
  if (!num) notFound();
  const viewer = await resolveViewer();
  // Admin-only for now (owner, 2026-09-10: "give me the poster in the dev
  // menu, not live"). When he opens it to rowers, this becomes
  // `!isMe && !viewer.isAdmin` and BarAccount gets its MY POSTER item back.
  const isMe = viewer.me?.rowerNumber === num;
  if (!viewer.isAdmin) notFound();
  void isMe;

  const before = nowMs() < START_MS;
  let rower: RowerPoster | null = null;
  if (!before) {
    rower = await rowerPosterData(num, { forceBlackout: viewer.preview !== null }).catch((err: unknown) => {
      console.error(`row100k/r/${num}/poster: payload failed`, err);
      return null;
    });
    if (!rower) notFound();
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{poCss}</style>

      <RowBar {...barProps(viewer)} />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>
              {rower ? `${fmtRowerNumber(rower.rower.rowerNumber)} ${rower.rower.name}` : "Your poster"}
            </h2>
            <span className="mono">YOUR POSTER · PNG, PDF, INSTAGRAM</span>
          </div>
          {before || !rower ? (
            <p className="po-first">FIRST STROKE SEP 1</p>
          ) : (
            <PosterStudio rower={rower} community={null} roster={null} fixed />
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
