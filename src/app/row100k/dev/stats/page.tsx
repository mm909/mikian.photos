import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, fmtRowerNumber, isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";

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
 * apostrophes anywhere in the string (see the note in theme.ts). */
const dstCss = `
.row100k .dst-table th.num{text-align:right}
.row100k .dst-table td.card{font-size:12px;white-space:nowrap}
.row100k .dst-table td.when{white-space:nowrap;color:var(--gray)}
.row100k .dst-lines{font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink-soft)}
.row100k .dst-lines div{border-bottom:1px dashed var(--line);padding:7px 0;white-space:nowrap;overflow-x:auto}
.row100k .dst-lines .when{color:var(--gray)}
.row100k .dst-lines .act{color:var(--water)}
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

  type Agg = { share: number; copy: number; download: number; total: number; last: Date };
  const byCard = new Map<string, Agg>();
  for (const e of events) {
    const agg: Agg =
      byCard.get(e.cardId) ??
      { share: 0, copy: 0, download: 0, total: 0, last: e.createdAt };
    if (e.action === "share") agg.share += 1;
    else if (e.action === "copy") agg.copy += 1;
    else if (e.action === "download") agg.download += 1;
    agg.total += 1;
    if (e.createdAt > agg.last) agg.last = e.createdAt;
    byCard.set(e.cardId, agg);
  }
  const rows = [...byCard.entries()].sort((a, b) => b[1].total - a[1].total);

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
            <span className="mono">WHICH CARDS GET USED</span>
          </div>
          {rows.length === 0 ? (
            <p className="board-empty">NOTHING SHARED YET.</p>
          ) : (
            <table className="board dst-table">
              <thead>
                <tr>
                  <th>Card</th>
                  <th className="num">Share</th>
                  <th className="num">Copy</th>
                  <th className="num">Download</th>
                  <th className="num">Total</th>
                  <th>Last used</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([cardId, agg]) => (
                  <tr key={cardId}>
                    <td className="card">{cardId}</td>
                    <td className="num">{agg.share}</td>
                    <td className="num">{agg.copy}</td>
                    <td className="num">{agg.download}</td>
                    <td className="num">{agg.total}</td>
                    <td className="when">{stampWhen(agg.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
