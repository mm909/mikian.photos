import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { activeBlackout } from "@/lib/blackout";
import { START_MS, nowMs as clockNow } from "@/lib/row100k";
import { barProps, maskedIds, previewBlackout, resolveViewer, viewOpts } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { boardView, EMPTY_BOARDS } from "../../boardData";
import { liteRecords, type RecordsProp } from "../../records/defs";
import { RecordsPick } from "./RecordsPick";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Records pick (mock) — 100K September",
  robots: { index: false, follow: false },
};

/* MOCK, not live (owner ask, 2026-09-05): a picture of the stats page
 * records head with the five-link submenu folded into one control —
 * TOTAL METERS and a sign that it can change. Two closed states on one
 * page, both opening the same inline list (RecordsPick.tsx). Real data,
 * the live page's loading and blackout plumbing (stats/page.tsx), so what
 * the owner sees is what the page would print. Admin-only in production;
 * open in local dev so it renders without a session — the same gate as
 * /row100k/dev/stats. */
export default async function DevRecordsPage() {
  /* resolveViewer swallows a failed session lookup into the anonymous
   * view (isAdmin false), which is the dev/stats gate's catch branch. */
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();

  /* The board as THIS viewer may see it — stats/page.tsx, line for line:
   * boardView applies the blackout on the way out (self and admins keep
   * the numbers), and a board that cannot be read while a window is open
   * fails closed. */
  let boards = EMPTY_BOARDS;
  let blackout: { active: boolean; endsAt?: string } = { active: false };
  let hideAll = false;
  let boardUnreadable = false;
  try {
    const view = await boardView(viewOpts(viewer));
    boards = view.boards;
    blackout = view.blackout;
  } catch (err) {
    console.error("row100k/dev/records: failed to load board data", err);
    boardUnreadable = true;
    blackout = previewBlackout(viewer, await activeBlackout());
    hideAll = blackout.active && !viewer.isAdmin;
  }

  /* THE masked set, read off boardView (row100kViewer.maskedIds); the
   * client component gets rows liteRecords already blanked — a hidden
   * rower keeps a digit count or a clock silhouette, never the number. */
  const hidden = maskedIds(boards);
  const records: RecordsProp = liteRecords(boards, hidden);
  const anyHidden = hidden.size > 0 || hideAll;

  const started = clockNow() >= START_MS;
  const meId = viewer.myParticipantId;

  const pick = {
    records,
    started,
    meId,
    anyHidden,
    unavailable: boardUnreadable,
    blackout,
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <RowBar {...barProps(viewer)} />

      {/* The stats nameplate, so the head is seen where it would live; the
          dateline slot carries the warning instead of the date. */}
      <header className="front-head">
        <div className="wrap">
          <h1>The stats</h1>
          <p className="front-date mono">MOCK — RECORD PICKER, NOT LIVE</p>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p className="st-pick-eyebrow">Look A · the record name is the control</p>
          <RecordsPick {...pick} variant="name" />
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="st-pick-eyebrow">Look B · a chip on the end of the holder line</p>
          <RecordsPick {...pick} variant="chip" />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
