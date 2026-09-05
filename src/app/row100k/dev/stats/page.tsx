import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, fmtRowerNumber, isRow100kAdmin, nowMs } from "@/lib/row100k";
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
.row100k .dst-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.row100k .dst-tile{border:2px solid var(--ink);background:var(--paper);padding:12px 14px 14px}
.row100k .dst-tile .k{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .dst-tile .v{font-family:var(--row-archivo-black),sans-serif;font-size:32px;line-height:1;margin-top:6px;font-variant-numeric:tabular-nums}
.row100k .dst-tile .s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:8px;font-variant-numeric:tabular-nums}
.row100k .dst-tile .s b{color:var(--water)}
.row100k .dst-sub{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray);margin:26px 0 10px}
.row100k .dst-lines{font-family:var(--row-mono),monospace;font-size:12px;line-height:1.8;font-variant-numeric:tabular-nums;overflow-x:auto}
.row100k .dst-lines .when{color:var(--gray)}
.row100k .dst-lines .act{color:var(--water);font-weight:700}
.row100k .dst-lines .n{display:inline-block;min-width:3ch;text-align:right;font-weight:700;margin-right:10px}
.row100k .dst-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.06em;color:var(--gray);margin-top:18px}
.row100k .dst-missing{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;color:var(--water);font-weight:700}
`;

type Ev = { cardId: string; action: string; rowerNumber: number | null; createdAt: Date };
type Click = { link: string; path: string; referrer: string; rowerNumber: number | null; createdAt: Date };

/* The tracked links (src/app/row100k/TrackedLink.tsx), in the order the
 * owner reads them: did they reach the partners page, did they follow the
 * sponsor out, did they leave via the discount-code line. */
/* The LINKS section is hidden for now (owner call, 2026-09-05); flip this
 * to bring it back — the data keeps collecting either way. */
const SHOW_LINKS = false;

const LINKS: { key: string; label: string }[] = [
  { key: "partners", label: "PARTNERS (rail)" },
  { key: "grizzly", label: "GRIZZLY (logo, site)" },
  { key: "grizzly-code", label: "GRIZZLY (the code)" },
];

const DIRECT = "direct / none";
const HOUR_MS = 3600_000;

/* Group key for a referrer. The route already stores the host, but an older
 * or odd row might carry a full URL, so a URL is reduced to its host here
 * too; www. is dropped so one site is one line; empty is DIRECT. */
function referrerHostOf(referrer: string): string {
  const s = referrer.trim();
  if (!s) return DIRECT;
  let host = s;
  try {
    host = new URL(s.includes("://") ? s : `https://${s}`).host;
  } catch {
    /* not URL-shaped: keep as typed */
  }
  host = host.toLowerCase().replace(/^www\./, "");
  return host || DIRECT;
}

/* Top hosts across a set of clicks, most clicks first, ties by name. */
function topReferrers(clicks: { referrer: string }[], n: number): { host: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const c of clicks) {
    const h = referrerHostOf(c.referrer);
    tally.set(h, (tally.get(h) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
    .slice(0, n);
}

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

  /* Tracked-link clicks (RowLinkClick), newest first — same in-memory
   * rollup. `clicksOk` false means the table is not pushed yet, which the
   * section says out loud instead of showing zeros that look real. */
  let clicks: Click[] = [];
  let clicksOk = true;
  try {
    clicks = await db.rowLinkClick.findMany({
      where: { challenge: CHALLENGE },
      select: { link: true, path: true, referrer: true, rowerNumber: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      // The per-IP rate limit keeps a month of honest clicks in the low
      // thousands; the cap only stops a flood from many IPs bloating this page.
      take: 5000,
    });
  } catch {
    clicksOk = false;
  }
  const now = nowMs();
  const dayAgo = now - 24 * HOUR_MS;
  const weekAgo = now - 7 * 24 * HOUR_MS;
  const linkStats = LINKS.map((l) => {
    const mine = clicks.filter((c) => c.link === l.key);
    return {
      ...l,
      total: mine.length,
      day: mine.filter((c) => c.createdAt.getTime() >= dayAgo).length,
      week: mine.filter((c) => c.createdAt.getTime() >= weekAgo).length,
    };
  });
  const referrers = topReferrers(clicks, 10);

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{dstCss}</style>
      <RowBar />

      {/* Retired from view (owner call, 2026-09-05) — the clicks still land
       * in RowLinkClick, so the section can come back with its history. */}
      {SHOW_LINKS && (
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Links</h2>
            <span className="mono">
              {clicksOk ? `${clicks.length} CLICKS ON TRACKED LINKS` : "NOT PUSHED YET"}
            </span>
          </div>
          {!clicksOk ? (
            <p className="dst-missing">NOT PUSHED YET — RowLinkClick needs npm run prisma:push</p>
          ) : (
            <>
              <div className="dst-tiles">
                {linkStats.map((l) => (
                  <div className="dst-tile" key={l.key}>
                    <div className="k">{l.label}</div>
                    <div className="v">{l.total}</div>
                    <div className="s">
                      <b>{l.day}</b> in 24h · <b>{l.week}</b> in 7d
                    </div>
                  </div>
                ))}
              </div>

              <div className="dst-sub">Where they came from · top {referrers.length} referrers, all clicks</div>
              {referrers.length === 0 ? (
                <div className="dst-lines">no clicks yet</div>
              ) : (
                <div className="dst-lines">
                  {referrers.map((r) => (
                    <div key={r.host}>
                      <span className="n">{r.count}</span>
                      {r.host}
                    </div>
                  ))}
                </div>
              )}

              {clicks.length > 0 && (
                <>
                  <div className="dst-sub">Last {Math.min(25, clicks.length)} clicks · Pacific</div>
                  <div className="dst-lines">
                    {clicks.slice(0, 25).map((c, i) => (
                      <div key={i}>
                        <span className="when">{stampWhen(c.createdAt)}</span>
                        {" · "}
                        <span className="act">{c.link.toUpperCase()}</span>
                        {" · "}
                        {c.path || "—"}
                        {" · "}
                        {referrerHostOf(c.referrer)}
                        {" · "}
                        {who(c.rowerNumber)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          <p className="dst-note">
            PAGE VIEWS AND REFERRERS FOR THE WHOLE SITE ARE IN VERCEL ANALYTICS — THIS COUNTS ONLY
            CLICKS ON THE PARTNERS RAIL LINK AND THE GRIZZLY LINKS.
          </p>
        </div>
      </section>
      )}

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
