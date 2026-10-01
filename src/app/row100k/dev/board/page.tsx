import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { digitCount } from "@/lib/blackoutRules";
import { GOAL_METERS, MONTH, MONTH_NAME, TIERS, daysElapsed, fmtMeters, nowMs } from "@/lib/row100k";
import { previewViewOpts, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { EMPTY_BOARDS, boardView } from "../../boardData";
import { monthOptIns } from "../../monthOptIn";
import { Board100k, type BoardRow, type BoardSection } from "./Board100k";
import { board100kCss } from "./board100kCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The 100K board (dev) — Rowtember",
  robots: { index: false, follow: false },
};

/* THE 100K BOARD (owner, 2026-10-01: "the difference between the board and
 * the rankings page is split those up. The board should be for
 * specifically the 100K monthly challenge with the opt-in"), drawn to his
 * "Rowtember · the opt in" mock: the month's 100K and nothing else. The
 * rowers who opted into THIS month (monthOptIn.ts), by meters, under the
 * tier words — THE 100K CLUB, OCTOBER ATHLETE, PARTICIPANT, WARMING UP —
 * each row carrying its share of 100,000 m as a bar under the name, the
 * viewer's own row in red; the strip above says who is in; a signed-in
 * rower who has not opted in gets the sheet. Everything else the old
 * board carried (the time records, longest, biggest day, movement, the
 * division tabs) is the full rankings' (records/[record]/page.tsx).
 *
 * The rows are the viewer's board (boardView: the elite masked for a
 * stranger during a blackout, the viewer themself exempt, an admin
 * unmasked — and the admin's test blackout honoured), so a hidden rower
 * prints blocks and no bar, the way every board does.
 *
 * IN DEVELOPMENT (CLAUDE.md): admin-only in production, open in local
 * dev; reached from the DEVELOPMENT group of the account menu. When it
 * goes live it takes /row100k/board and THE BOARD on the rail. */

const SIGN_IN = `/row100k/sign-in?callbackUrl=${encodeURIComponent("/row100k/dev/board")}`;

export default async function DevBoardPage() {
  const viewer = await resolveViewer();
  if (process.env.NODE_ENV === "production" && !viewer.isAdmin) notFound();
  const me = viewer.me;

  let total = EMPTY_BOARDS.total;
  try {
    const view = await boardView(previewViewOpts(viewer.preview, viewer.myParticipantId, viewer.isAdmin));
    total = view.boards.total;
  } catch (err) {
    console.error("row100k/dev/board: failed to load the board", err);
  }

  let optIns = new Set<string>();
  let unreadable = false;
  try {
    optIns = await monthOptIns();
  } catch (err) {
    console.error("row100k/dev/board: failed to read the month's opt-ins (table pushed?)", err);
    unreadable = true;
  }

  /* The listed rows: opted in, in the board's own order (meters, the
   * masked elite first while a window is open). */
  const listed = total.filter((r) => optIns.has(r.participantId));
  const toRow = (r: (typeof total)[number]): BoardRow => ({
    rowerNumber: r.rowerNumber,
    name: r.name,
    meters: r.meters,
    masked: r.masked === true,
    digits: r.masked ? (r.digits ?? digitCount(r.meters)) : undefined,
    me: me !== null && r.participantId === me.id,
  });

  /* The sections, highest first: the club, the athletes, the participants,
   * then WARMING UP for anyone in but under the first rung. A rung nobody
   * has reached prints its lock line. The two named rungs wear the month's
   * name (row100k.ts TIERS). */
  const t10 = TIERS.find((t) => t.key === "t10")!;
  const t50 = TIERS.find((t) => t.key === "t50")!;
  const t100 = TIERS.find((t) => t.key === "t100")!;
  const band = (lo: number, hi: number) => listed.filter((r) => r.meters >= lo && r.meters < hi).map(toRow);
  const sections: BoardSection[] = [
    { key: "club", title: t100.title, rows: band(GOAL_METERS, Infinity), lock: `Unlocks at ${fmtMeters(GOAL_METERS)} — nobody here yet` },
    { key: "athlete", title: t50.title, rows: band(t50.meters, GOAL_METERS), lock: `Unlocks at ${fmtMeters(t50.meters)} — nobody here yet` },
    { key: "participant", title: t10.title, rows: band(t10.meters, t50.meters), lock: `Unlocks at ${fmtMeters(t10.meters)} — nobody here yet` },
    { key: "warming", title: "Warming up", rows: band(0, t10.meters), lock: null },
  ];

  const myRow = me ? total.find((r) => r.participantId === me.id) : undefined;

  return (
    <div className={`row100k bk chrome-ink ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>
      <Board100k
        month={{ key: MONTH.key, label: MONTH.label, name: MONTH_NAME, days: MONTH.days, day: daysElapsed(nowMs()) }}
        count={optIns.size}
        sections={sections}
        unreadable={unreadable}
        signedIn={viewer.actor !== null}
        me={
          me
            ? {
                rowerNumber: me.rowerNumber,
                name: me.displayName,
                meters: myRow?.meters ?? 0,
                in: optIns.has(me.id),
              }
            : null
        }
        signInHref={SIGN_IN}
      />
    </div>
  );
}
