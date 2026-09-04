import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, fmtRowerNumber, isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { CardPreviews } from "./CardPreviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dev stats — 100K September",
  robots: { index: false, follow: false },
};

/* Which shareables get used: every ShareEvent ping (fired by the share
 * dialog after a SUCCESSFUL share / copy / download) rolled up per card,
 * plus the raw tail. Owner-only in production; open in local dev so it can
 * be checked without a session — same gate as /row100k/partners. */

/* Absolute stamp, no relative time: createdAt shifted minus 7 hours (the
 * repo's Pacific convention — same as the feed's stampWhen), read back as
 * UTC fields. "SEP 4 · 3:54 PM". */
const STAMP_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
function stampWhen(createdAt: Date): string {
  const p = new Date(createdAt.getTime() - 7 * 3600_000);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(p.getUTCMinutes()).padStart(2, "0");
  const ampm = h24 < 12 ? "AM" : "PM";
  return `${STAMP_MONTHS[p.getUTCMonth()]} ${p.getUTCDate()} · ${h}:${min} ${ampm}`;
}

/* Page-local styles — .dst- prefix, theme.ts untouched. Rendered as the text
 * child of a style tag, so no double quotes, no angle brackets, and no
 * apostrophes anywhere in the string (see the note in theme.ts).
 *
 * The stage repeats the share dialog's dark checkerboard: these cards are
 * white-on-transparent stickers and are invisible on paper. */
const dstCss = `
.row100k .dst-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:22px;margin-top:22px}
.row100k .dst-card{margin:0;border:2px solid var(--ink);background:var(--paper)}
.row100k .dst-stage{background-color:var(--frame);background-image:linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%),linear-gradient(45deg,rgba(255,255,255,.05) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.05) 75%);background-size:18px 18px;background-position:0 0,9px 9px;display:flex;align-items:center;justify-content:center;padding:10px;min-height:150px}
.row100k .dst-canvas{display:block;max-width:100%;height:auto}
.row100k .dst-card figcaption{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px;border-top:2px solid var(--ink)}
.row100k .dst-name{font-family:var(--row-archivo-black),sans-serif;font-size:15px;text-transform:uppercase}
.row100k .dst-id{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.08em;color:var(--gray)}
.row100k .dst-n{font-family:var(--row-mono),monospace;font-size:12px;color:var(--gray);margin-top:4px;font-variant-numeric:tabular-nums}
.row100k .dst-n.on{color:var(--water);font-weight:700}
.row100k .dst-n em{font-style:normal;letter-spacing:.1em;text-transform:uppercase;font-size:10px}
`;

type Ev = { cardId: string; action: string; rowerNumber: number | null; createdAt: Date };

export default async function DevStatsPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  /* Everything this challenge, newest first. A ping per successful share —
   * tiny by construction (per-IP rate-limited at the route) — so the rollup
   * is in-memory, house style. */
  let events: Ev[] = [];
  try {
    events = await db.shareEvent.findMany({
      where: { challenge: CHALLENGE },
      select: { cardId: true, action: true, rowerNumber: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    /* table not pushed yet — show the empty state, not a 500 */
  }

  /* Just the total per card — how it left the site (share sheet, clipboard,
   * download) turned out not to be worth a column. */
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.cardId] = (counts[e.cardId] ?? 0) + 1;

  const who = (n: number | null) =>
    n === 0 ? "COMMUNITY" : n !== null ? `ROWER ${fmtRowerNumber(n)}` : "—";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{dstCss}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Dev stats</h2>
            <span className="mono">EVERY CARD, MOST SHARED FIRST</span>
          </div>
          <CardPreviews counts={counts} />
        </div>
      </section>

      {events.length > 0 && (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>Recent</h2>
              <span className="mono">LAST {Math.min(25, events.length)} EVENTS</span>
            </div>
            <div className="dst-lines">
              {events.slice(0, 25).map((e, i) => (
                <div key={i}>
                  <span className="when">{stampWhen(e.createdAt)}</span>
                  {" · "}
                  {e.cardId}
                  {" · "}
                  <span className="act">{e.action.toUpperCase()}</span>
                  {" · "}
                  {who(e.rowerNumber)}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <RowFooter />
    </div>
  );
}
