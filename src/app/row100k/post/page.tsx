import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import {
  CHALLENGE,
  FIRST_DAY,
  LAST_DAY,
  fmtDay,
  fmtMeters,
  fmtSplit,
  isRow100kAdmin,
  nowMs,
} from "@/lib/row100k";
import { digitCount, shapeOf } from "@/lib/blackoutRules";
import { maskedIds } from "@/lib/row100kViewer";
import { listGallery } from "../galleryList";
import { photoUrl, photosServable } from "../photoUrls";
import { boardData, EMPTY_BOARDS } from "../boardData";
import { firstToGoal } from "../firstToGoal";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { PostPack } from "./PostPack";
import type { PostData, PostRecord, PostRow } from "./slides";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Post pack — 100K September",
  robots: { index: false, follow: false },
};

/* The Instagram carousel, generated on the site instead of on the laptop.
 *
 * Everything the slides need is read here, server-side, off the same helpers
 * the public pages use — the board (boardData), the first-to-100k claim
 * (../firstToGoal), the newest gallery photos (the cached R2 listing in
 * ../galleryList.ts, served as public CDN URLs) — and handed to the client
 * as plain JSON. The drawing happens in the browser, on canvas, so the owner
 * can do the whole thing from a phone.
 *
 * Admin only, like /row100k/signups: everyone else gets a 404. */

/* Pacific, the repo convention for "which challenge day is it". */
const SHIFT_MS = 7 * 3600_000;
/* Enough gallery photos to cycle through without dragging the whole bucket
 * into the page. */
const PHOTO_LIMIT = 24;

/* Post-pack styles — .pk- prefix, theme.ts untouched. Rendered as the text
 * child of a style tag, so no double quotes, no apostrophes and no angle
 * brackets anywhere in this string (see the note in theme.ts). */
const pkCss = `
/* Font probes. They are laid out for real (off-screen, not display:none):
   the painter reads the hashed family name off them AND measures the line
   box they make — the height is line-height:normal, and the zero-sized
   inline-block strut inside sits exactly on the baseline. */
.row100k .pk-probe{position:absolute;left:-9999px;top:0;font-size:100px;line-height:normal;white-space:nowrap;visibility:hidden;pointer-events:none}
.row100k .pk-strut{display:inline-block;width:0;height:0;overflow:hidden}
.row100k .pk-probe.blk{font-family:var(--row-archivo-black),sans-serif}
.row100k .pk-probe.mn{font-family:var(--row-mono),monospace}
.row100k .pk-probe.arc{font-family:var(--row-archivo),sans-serif}

.row100k .pk-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px}
.row100k .pk-as{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .pk-acts{display:flex;flex-wrap:wrap;gap:10px}
.row100k .pk-btn{appearance:none;-webkit-appearance:none;border:2px solid var(--ink);border-radius:0;background:none;color:var(--ink);font-family:var(--row-mono),monospace;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:13px 18px;margin:0;cursor:pointer}
.row100k .pk-btn:hover{border-color:var(--water);color:var(--water)}
.row100k .pk-btn.primary{background:var(--water);border-color:var(--water);color:#fff}
.row100k .pk-btn.primary:hover{background:var(--water-hover);border-color:var(--water-hover);color:#fff}
.row100k .pk-btn:disabled{opacity:.45;cursor:default}
.row100k .pk-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;line-height:1.8;text-transform:uppercase;color:var(--gray);margin:14px 0 18px}
.row100k .pk-status{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--water);margin:14px 0 0}

.row100k .pk-strip{display:flex;gap:14px;overflow-x:auto;padding:2px 0 16px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
.row100k .pk-card{flex:0 0 auto;width:230px;scroll-snap-align:start}
.row100k .pk-frame{position:relative;display:block;width:100%;aspect-ratio:4/5;appearance:none;-webkit-appearance:none;border:2px solid var(--ink);border-radius:0;background:#23272b;padding:0;margin:0;overflow:hidden;cursor:pointer}
.row100k .pk-frame img{display:block;width:100%;height:100%;object-fit:cover}
.row100k .pk-wait{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8a8a85}
.row100k .pk-cap{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:8px}
.row100k .pk-name{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);line-height:1.5}
.row100k .pk-save{appearance:none;-webkit-appearance:none;border:none;background:none;padding:0;margin:0;font-family:var(--row-mono),monospace;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--water);cursor:pointer;flex:none}
.row100k .pk-save:disabled{opacity:.4;cursor:default}
.row100k .pk-frame:focus,.row100k .pk-btn:focus,.row100k .pk-save:focus{outline:none}
.row100k .pk-frame:focus-visible,.row100k .pk-btn:focus-visible,.row100k .pk-save:focus-visible{outline:2px solid var(--water);outline-offset:3px}
@media (max-width:599px){
  .row100k .pk-card{width:62vw}
  .row100k .pk-btn{padding:14px 16px}
  .row100k .pk-acts{width:100%}
  .row100k .pk-acts .pk-btn.primary{flex:1 1 auto}
}
`;

/* "115h 30m" — total time on the erg. Rounded in minutes so a rounded 60
 * can never print as 60m. */
function fmtHours(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function PostPackPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) notFound();

  // Pacific day — what "as of" means, and how many September days are left.
  const today = new Date(nowMs() - SHIFT_MS).toISOString().slice(0, 10);
  const daysLeft =
    today > LAST_DAY ? 0 : today < FIRST_DAY ? 30 : Math.max(0, 30 - Number(today.slice(8, 10)));

  // The board, exactly as the public pages compute it.
  let boards = EMPTY_BOARDS;
  try {
    boards = await boardData();
  } catch (err) {
    console.error("row100k/post: failed to load board data", err);
  }

  // Total time on the erg + the hour grid (sessions logged per Pacific hour
  // of each September day). Both need raw rows, which boardData doesn't
  // carry.
  const known = new Set(boards.total.map((r) => r.participantId));
  const gridDays =
    today < FIRST_DAY ? 1 : today > LAST_DAY ? 30 : Math.min(30, Number(today.slice(8, 10)));
  const hourGrid: number[][] = Array.from(
    { length: gridDays },
    () => Array(24).fill(0) as number[],
  );
  let totalSeconds = 0;
  try {
    const entries = await db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, seconds: true, createdAt: true },
    });
    for (const e of entries) {
      if (!known.has(e.participantId)) continue;
      totalSeconds += e.seconds;
      const shifted = new Date(e.createdAt.getTime() - SHIFT_MS);
      const day = shifted.toISOString().slice(0, 10);
      if (day < FIRST_DAY || day > LAST_DAY) continue;
      const di = Number(day.slice(8, 10)) - 1;
      if (di < 0 || di >= gridDays) continue;
      hourGrid[di][shifted.getUTCHours()] += 1;
    }
  } catch (err) {
    console.error("row100k/post: failed to load entries", err);
  }

  // Who got to 100k first — the same rule the partners page shows.
  let claim = null as Awaited<ReturnType<typeof firstToGoal>>;
  try {
    claim = await firstToGoal();
  } catch (err) {
    console.error("row100k/post: failed to resolve the 100k claim", err);
  }

  // The newest gallery photos as public CDN URLs. Thumbs are skipped — these
  // get painted full-bleed at 1080x1350.
  let photos: string[] = [];
  try {
    if (photosServable()) {
      const mains = await listGallery();
      photos = await Promise.all(mains.slice(0, PHOTO_LIMIT).map((o) => photoUrl(o.key)));
    }
  } catch (err) {
    console.error("row100k/post: gallery listing failed", err);
    photos = [];
  }

  // boardData() is the public, masked board: during a blackout the elite
  // fifteen arrive with a tier floor and a digit count, and the board slide
  // draws blocks for them. A masked row under 10k carries a floor of 0, so
  // the filter keeps masked rows regardless.
  const standings: PostRow[] = boards.total
    .filter((r) => r.meters > 0 || r.masked)
    .map((r) => ({
      name: r.name,
      num: r.rowerNumber,
      meters: r.meters,
      masked: r.masked,
      digits: r.digits,
    }));
  const club50 = standings.filter((r) => r.meters >= 50_000);

  // The record list. Fastest boards print the average 500m split, which is
  // what the approved slide shows. boardData() masks only the total rows,
  // so the record boards still hold every real value here — a holder in the
  // masked set (the same fifteen the board hides) gets no value at all,
  // only its silhouette, and the slide draws blocks: the carousel leaves
  // the site, and an elite rower's split or best is their meters by another
  // route (owner rule, 2026-09-05).
  const hidden = maskedIds(boards);
  const records: PostRecord[] = [];
  const add = (
    label: string,
    row: { name: string; participantId: string } | undefined,
    value: string,
  ) => {
    if (!row) return;
    const masked = hidden.has(row.participantId);
    records.push({
      label,
      who: row.name,
      value: masked ? "" : value,
      masked: masked || undefined,
      shape: masked ? shapeOf(value) : undefined,
    });
  };
  const fastest = (dist: 5000 | 10000, division: string) =>
    boards.fastest[dist].find((r) => r.division === division);
  const men5 = fastest(5000, "M");
  const women5 = fastest(5000, "F");
  const men10 = fastest(10000, "M");
  add("Fastest 5k · men", men5, men5 ? fmtSplit(5000, men5.value) : "");
  add("Fastest 5k · women", women5, women5 ? fmtSplit(5000, women5.value) : "");
  add("Fastest 10k · men", men10, men10 ? fmtSplit(10000, men10.value) : "");
  const longest = boards.longest[0];
  add("Longest row", longest, longest ? fmtMeters(longest.value) : "");
  const bigDay = boards.bigDay[0];
  add("Biggest day", bigDay, bigDay ? fmtMeters(bigDay.value) : "");

  // The claim's `total` is the rower's real running total (firstToGoal.ts
  // does not mask), and the first to 100k is all but certainly one of the
  // elite fifteen — so the congrats slide reads its meters off the masked
  // standings row when there is one, and hides what the board slide hides.
  // No standings row at all means the board could not be read (a rower
  // with 100k is on it by definition) — then the page cannot tell whether
  // a window is open, so the line hides rather than guessing the rower is
  // not elite, the same fail-closed rule the partners page holds (review,
  // 2026-09-05).
  const claimRow = claim ? standings.find((r) => r.num === claim.rowerNumber) : undefined;
  const claimHidden = !claimRow || claimRow.masked === true;
  const first100k: PostRow | null = claim
    ? {
        name: claim.name,
        num: claim.rowerNumber,
        meters: claimHidden ? (claimRow?.meters ?? 0) : claim.total,
        masked: claimHidden || undefined,
        digits: claimHidden ? (claimRow?.digits ?? digitCount(claim.total)) : undefined,
      }
    : (standings.find((r) => r.meters >= 100_000) ?? null);

  const data: PostData = {
    asOfDay: fmtDay(today),
    asOfIso: today,
    daysLeft,
    totalMeters: boards.community.meters,
    totalTime: fmtHours(totalSeconds),
    totalSessions: boards.community.sessions,
    rowersLogged: standings.length,
    standings,
    records,
    club50,
    first100k,
    hourGrid,
    photos,
  };

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{pkCss}</style>

      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The post pack</h2>
            <span className="mono">
              ADMIN ONLY — {photos.length} GALLERY PHOTOS, {standings.length} ON THE BOARD
            </span>
          </div>
          <PostPack data={data} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
