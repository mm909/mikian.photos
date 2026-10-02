import type { Metadata } from "next";
import { digitCount, partialShape } from "@/lib/blackoutRules";
import {
  GOAL_METERS,
  MONTH,
  MONTH_NAME,
  MONTH_WORD,
  TIERS,
  daysElapsed,
  nowMs,
  type TotalRow,
} from "@/lib/row100k";
import { barProps, previewViewOpts, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { EMPTY_BOARDS, boardView } from "../boardData";
import { monthOptIns } from "../monthOptIn";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Board100k, type BoardMe, type BoardRow, type BoardTier } from "./Board100k";
import { board100kCss } from "./board100kCss";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The board — Rowtember",
};

/* THE 100K BOARD (owner, 2026-10-01: "the difference between the board and
 * the rankings page is split those up. The board should be for
 * specifically the 100K monthly challenge with the opt-in"): the month's
 * 100K and nothing else. The rowers who opted into THIS month
 * (monthOptIn.ts), by meters, under the tier words — THE 100K CLUB,
 * OCTOBER ATHLETE, OCTOBER PARTICIPANT, WARMING UP — each row carrying its
 * share of 100,000 m as a bar behind it, the viewer's own row in the
 * accent. Everything else the old board carried (the time records,
 * longest, biggest day, movement, the division tabs) is the full
 * rankings' (records/[record]/page.tsx).
 *
 * A REAL PAGE (owner, 2026-10-01, on the first version, a phone frame with
 * a bar of its own: "I know this is the dev board, but I should still see
 * it as if I'm looking at a real screen ... what's it going to look like
 * when it's on desktop? It better not look like this"; "I can't click on
 * the rower number up there"). So this file is the frame every page is:
 * the site bar, the page on the front measure, the site footer, the look
 * and the palette off the layout. THE BOARD is lit on the rail because
 * that is the tab this page takes when it goes live.
 *
 * A TIER PRINTS ONLY ONCE SOMEBODY ON THE BOARD IS IN IT (owner, same
 * day: "if someone is not in that tier yet, then we do not show the tier
 * ... I shouldn't see what the different groups are until someone has hit
 * it"). All four are handed down so the client can open one the moment the
 * viewer opts into it; it prints none that is empty.
 *
 * The rows are the viewer's board (boardView: the elite masked for a
 * stranger during a blackout, the viewer themself exempt, an admin
 * unmasked — and the admin's test blackout honoured), so a hidden rower
 * prints blocks, no bar and no place, the way every board does.
 *
 * LIVE (owner, 2026-10-01: "I like the sign up page, we can make that
 * live. Same with the board"): /board and BOARD on the rail. The full
 * rankings the rail word used to open are RANKINGS now (barItems.ts). */

const SIGN_IN = `/sign-in?callbackUrl=${encodeURIComponent("/board")}`;

/* The numbers a row may print, as boardView left them: blocks for a hidden
 * total, the partial shape in the run-up, neither otherwise. */
const hiddenOf = (r: TotalRow): { blocks?: number; shape?: string } =>
  r.masked
    ? { blocks: r.digits ?? digitCount(r.meters) }
    : r.hideLow
      ? { shape: partialShape(r.meters, r.hideLow, r.digits) }
      : {};

export default async function BoardPage() {
  const viewer = await resolveViewer();
  const me = viewer.me;

  let total = EMPTY_BOARDS.total;
  let unreadable = false;
  try {
    const view = await boardView(previewViewOpts(viewer.preview, viewer.myParticipantId, viewer.isAdmin));
    total = view.boards.total;
  } catch (err) {
    console.error("row100k/board: failed to load the board", err);
    unreadable = true;
  }

  let optIns = new Set<string>();
  try {
    optIns = await monthOptIns();
  } catch (err) {
    console.error("row100k/board: failed to read the month's opt-ins (table pushed?)", err);
    unreadable = true;
  }

  /* The listed rows: opted in, in the board's own order (meters, the
   * masked elite first while a window is open). */
  const rows: BoardRow[] = total
    .filter((r) => optIns.has(r.participantId))
    .map((r) => ({
      rowerNumber: r.rowerNumber,
      name: r.name,
      meters: r.meters,
      ...hiddenOf(r),
      unranked: r.unranked === true,
      me: me !== null && r.participantId === me.id,
    }));

  /* The tiers, highest first: the club, the athletes, the participants,
   * then WARMING UP for anyone in but under the first rung. The two named
   * rungs wear the month's name (row100k.ts TIERS). */
  const t10 = TIERS.find((t) => t.key === "t10")!;
  const t50 = TIERS.find((t) => t.key === "t50")!;
  const t100 = TIERS.find((t) => t.key === "t100")!;
  const tiers: BoardTier[] = [
    { key: "club", title: t100.title, floor: GOAL_METERS },
    { key: "athlete", title: t50.title, floor: t50.meters },
    { key: "participant", title: t10.title, floor: t10.meters },
    { key: "warming", title: "Warming up", floor: 0 },
  ];

  /* The viewer's own row, whether or not it is listed: what OPT IN puts on
   * the board before the refresh brings the list. */
  const myRow = me ? total.find((r) => r.participantId === me.id) : undefined;
  const mine: BoardMe | null = me
    ? {
        rowerNumber: me.rowerNumber,
        name: me.displayName,
        meters: myRow?.meters ?? 0,
        in: optIns.has(me.id),
        unranked: myRow?.unranked === true,
        ...(myRow ? hiddenOf(myRow) : {}),
      }
    : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{board100kCss}</style>

      <RowBar active="board" {...barProps(viewer)} />

      <Board100k
        month={{
          key: MONTH.key,
          label: MONTH.label,
          name: MONTH_NAME,
          word: MONTH_WORD,
          days: MONTH.days,
          day: daysElapsed(nowMs()),
        }}
        count={rows.length}
        rows={rows}
        tiers={tiers}
        unreadable={unreadable}
        signedIn={viewer.actor !== null}
        me={mine}
        signInHref={SIGN_IN}
      />

      <RowFooter front />
    </div>
  );
}
