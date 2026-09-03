import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import {
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtSplit,
  isRow100kAdmin,
} from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";

/* DEV DRAFTS — four shapes for the EDITABLE log (the share/edit/delete
 * table a rower sees on their own page; admins see it on anyone's). Every
 * button here is inert: no client JS, no mutations, just the look. The
 * public profile's TABLE view is an owner keep (cycle 6) and is not in
 * question here. Open in local dev; admin-only in production. */

export const metadata: Metadata = {
  title: "Log drafts — 100K September",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* Page-scoped styles — .dlg prefix; rendered as a style-tag text child, so
 * no double quotes and no angle brackets anywhere in the string. */
const draftCss = `
.row100k .dlg-lede{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);line-height:1.9;max-width:68ch}
.row100k .dlg-note{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;color:var(--gray)}
.row100k .dlg-tradeoff{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.08em;color:var(--gray);line-height:1.8;margin-top:12px}
.row100k .dlg-anchor{position:relative;display:inline-block}
.row100k .dlg-dots{background:none;border:none;color:var(--gray);font-family:var(--row-mono),monospace;font-size:15px;line-height:1;cursor:pointer;padding:2px 6px}
.row100k .dlg-dots:hover{color:var(--ink)}
.row100k .dlg-dots.on{color:var(--ink)}
.row100k .dlg-menu{position:absolute;top:calc(100% + 6px);right:0;background:var(--paper);border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:2px 14px;min-width:128px;z-index:40;text-align:left}
.row100k .dlg-menu button{display:block;width:100%;text-align:left;background:none;border:none;border-bottom:1px dashed var(--line);color:var(--ink);font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;padding:9px 0;cursor:pointer}
.row100k .dlg-menu button:last-child{border-bottom:none}
.row100k .dlg-menu button:hover{color:var(--water)}
.row100k .dlg-menu button.danger{color:#b3400f}
.row100k .dlg-thumb{display:block;object-fit:cover;border:1px solid var(--line)}
.row100k .dlg1-act{text-align:right;white-space:nowrap}
.row100k .dlg1-title{display:block;font-size:11px;color:var(--gray);white-space:normal;max-width:18ch}
.row100k .dlg1-thumbs{margin-top:4px}
.row100k .dlg2-card{position:relative}
.row100k .dlg2-card .plog-top{padding-right:30px}
.row100k .dlg2-corner{position:absolute;top:10px;right:10px}
.row100k .dlg3-block{border:2px solid var(--ink);box-shadow:6px 6px 0 rgba(21,23,26,.14);padding:2px 16px;margin-top:8px}
.row100k .dlg3-row{padding:12px 0;border-bottom:1px dashed var(--line)}
.row100k .dlg3-row:last-child{border-bottom:none}
.row100k .dlg3-l1{display:grid;grid-template-columns:64px 1fr auto 72px;gap:14px;align-items:baseline;font-family:var(--row-mono),monospace;font-size:13px;font-variant-numeric:tabular-nums}
.row100k .dlg3-day{color:var(--gray);font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.row100k .dlg3-m{font-weight:700;font-size:14px}
.row100k .dlg3-time{color:var(--ink-soft);text-align:right}
.row100k .dlg3-split{color:var(--gray);text-align:right}
.row100k .dlg3-l2{display:flex;align-items:center;gap:10px;margin-top:5px;min-height:18px}
.row100k .dlg3-title{color:var(--gray);font-family:var(--row-mono),monospace;font-size:12px;flex:1;min-width:0}
.row100k .dlg3-acts{white-space:nowrap;display:flex;gap:10px}
.row100k .dlg4-strip{display:flex;align-items:stretch;border:2px solid var(--ink);margin-top:10px}
.row100k .dlg4-pics{display:flex;flex-shrink:0}
.row100k .dlg4-pics img{display:block;width:64px;height:64px;object-fit:cover;border-right:1px solid var(--frame)}
.row100k .dlg4-noph{width:64px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--gray);font-family:var(--row-mono),monospace;font-size:12px;border-right:1px dashed var(--line)}
.row100k .dlg4-mid{flex:1;min-width:0;padding:8px 14px;display:flex;flex-direction:column;justify-content:center;gap:3px}
.row100k .dlg4-meta{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--gray);display:flex;gap:12px;flex-wrap:wrap}
.row100k .dlg4-nums{display:flex;align-items:baseline;gap:12px;font-variant-numeric:tabular-nums;flex-wrap:wrap}
.row100k .dlg4-m{font-family:var(--row-archivo-black),sans-serif;font-size:20px;line-height:1;color:var(--water)}
.row100k .dlg4-t{font-family:var(--row-mono),monospace;font-size:12px;color:var(--ink)}
.row100k .dlg4-s{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray)}
.row100k .dlg4-rail{width:36px;flex-shrink:0;border-left:1px dashed var(--line);display:flex;align-items:center;justify-content:center}
`;

/* Tiny inline-SVG color squares standing in for the photo pair — same look
 * as the demo seed. */
const sq = (hex: string) =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23${hex}'/%3E%3C/svg%3E`;

type DraftRow = {
  day: string;
  meters: number;
  seconds: number;
  title?: string;
  photoUrls?: string[];
};

const ROWS: DraftRow[] = [
  { day: "2026-09-14", meters: 10000, seconds: 2460, title: "Longest yet", photoUrls: [sq("0077B6"), sq("1c2b33")] },
  { day: "2026-09-12", meters: 5000, seconds: 1155, title: "Sunrise 5k" },
  { day: "2026-09-11", meters: 3200, seconds: 782 },
  { day: "2026-09-09", meters: 6100, seconds: 1464, title: "Two movies deep", photoUrls: [sq("b3400f"), sq("8a8a85")] },
  { day: "2026-09-08", meters: 4800, seconds: 1104 },
  { day: "2026-09-06", meters: 5200, seconds: 1248, title: "Steady state" },
];

/* The collapsed actions, opened: SHARE / EDIT / DELETE in one panel.
 * Inert — the draft only shows where the buttons live. */
function DraftMenu() {
  return (
    <span className="dlg-menu">
      <button type="button">SHARE</button>
      <button type="button">EDIT</button>
      <button type="button" className="danger">DELETE</button>
    </span>
  );
}

function Dots({ open }: { open?: boolean }) {
  return (
    <span className="dlg-anchor">
      <button type="button" className={open ? "dlg-dots on" : "dlg-dots"} aria-expanded={!!open}>
        …
      </button>
      {open ? <DraftMenu /> : null}
    </span>
  );
}

function Squares({ urls, size, className }: { urls: string[]; size: number; className?: string }) {
  return (
    <span className={className} style={{ display: "flex", gap: 4 }}>
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={u} alt={i === 0 ? "The rower" : "The erg screen"} width={size} height={size} className="dlg-thumb" />
      ))}
    </span>
  );
}

const TRADEOFF =
  "A … HIDES DELETE BEHIND TWO CLICKS (MENU, THEN SURE?) — ARGUABLY SAFER, SLIGHTLY SLOWER.";

export default async function LogDraftsPage() {
  const actor = await getEffectiveActor();
  const admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{draftCss}</style>

      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The log, four ways</h2>
            <span className="mono">DEV DRAFTS — NOTHING IS WIRED UP</span>
          </div>
          <p className="dlg-lede">
            FOUR SHAPES FOR THE EDITABLE LOG — THE SHARE / EDIT / DELETE TABLE ON A ROWER&rsquo;S OWN
            PAGE. THE PUBLIC PROFILE&rsquo;S TABLE VIEW IS AN OWNER KEEP (CYCLE 6) AND STAYS EXACTLY
            AS IT IS.
          </p>
          <p className="dlg-lede" style={{ marginTop: 8 }}>
            WHATEVER WINS MUST KEEP: THE INLINE EDITOR, THE TWO-TAP DELETE, ALL-OR-NOTHING PHOTO
            REPLACEMENT, AND THE SINGLE ERROR SLOT.
          </p>
        </div>
      </section>

      {/* 1 — today's table, three text actions folded into one … per row. */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>1 · The condensed table</h2>
            <span className="mono">THE BET: SAME TABLE, LESS CHROME</span>
          </div>
          <table className="mine">
            <thead>
              <tr>
                <th>Day</th>
                <th>Meters</th>
                <th>Time</th>
                <th>/500m</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r.day}>
                  <td className="num">
                    {fmtDay(r.day)}
                    {r.title ? <span className="dlg1-title">{r.title}</span> : null}
                    {r.photoUrls ? <Squares urls={r.photoUrls} size={42} className="dlg1-thumbs" /> : null}
                  </td>
                  <td className="num">{fmtMeters(r.meters)}</td>
                  <td className="num">{fmtDuration(r.seconds)}</td>
                  <td className="num">{fmtSplit(r.meters, r.seconds)}</td>
                  <td className="dlg1-act">
                    <Dots open={i === 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="dlg-tradeoff">{TRADEOFF}</p>
        </div>
      </section>

      {/* 2 — the feed/profile card idiom, with actions in the corner. */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>2 · The card log</h2>
            <span className="mono">THE BET: LOG AND FEED, ONE VISUAL LANGUAGE</span>
          </div>
          {[ROWS[0], ROWS[1], ROWS[3]].map((r, i) => (
            <article className="plog-card dlg2-card" key={r.day}>
              <div className="plog-top">
                <span>{fmtDay(r.day).toUpperCase()}</span>
                <span>{fmtSplit(r.meters, r.seconds)} /500M</span>
              </div>
              {r.title ? <p className="plog-title">{r.title}</p> : null}
              <div className="plog-nums">
                <span className="plog-m">{fmtMeters(r.meters)}</span>
                <span className="plog-time">{fmtDuration(r.seconds)}</span>
              </div>
              {r.photoUrls ? (
                <div className="plog-photos">
                  {r.photoUrls.map((u, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={u} alt={k === 0 ? "The rower" : "The erg screen"} loading="lazy" />
                  ))}
                </div>
              ) : (
                <p className="plog-nopics">NO PHOTOS ON THIS ONE.</p>
              )}
              <span className="dlg2-corner">
                <Dots open={i === 0} />
              </span>
            </article>
          ))}
          <p className="dlg-tradeoff">{TRADEOFF}</p>
        </div>
      </section>

      {/* 3 — two-line rows in one bordered block; actions stay text. */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>3 · The ledger</h2>
            <span className="mono">THE BET: DENSITY WITHOUT A TABLE</span>
          </div>
          <div className="dlg3-block">
            {ROWS.map((r) => (
              <div className="dlg3-row" key={r.day}>
                <div className="dlg3-l1">
                  <span className="dlg3-day">{fmtDay(r.day)}</span>
                  <span className="dlg3-m">{fmtMeters(r.meters)}</span>
                  <span className="dlg3-time">{fmtDuration(r.seconds)}</span>
                  <span className="dlg3-split">{fmtSplit(r.meters, r.seconds)}</span>
                </div>
                <div className="dlg3-l2">
                  <span className="dlg3-title">{r.title ?? ""}</span>
                  {r.photoUrls ? <Squares urls={r.photoUrls} size={26} /> : null}
                  <span className="dlg3-acts">
                    <button type="button" className="del-btn save">share</button>
                    <button type="button" className="del-btn">edit</button>
                    <button type="button" className="del-btn">delete</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 — photos anchor the row; numbers scan; actions ride a slim rail. */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>4 · The photo ledger</h2>
            <span className="mono">THE BET: PHOTOS ANCHOR MEMORY, NUMBERS STAY SCANNABLE</span>
          </div>
          {ROWS.map((r) => (
            <div className="dlg4-strip" key={r.day}>
              {r.photoUrls ? (
                <span className="dlg4-pics">
                  {r.photoUrls.map((u, k) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={u} alt={k === 0 ? "The rower" : "The erg screen"} loading="lazy" />
                  ))}
                </span>
              ) : (
                <span className="dlg4-noph">—</span>
              )}
              <span className="dlg4-mid">
                <span className="dlg4-meta">
                  <span>{fmtDay(r.day)}</span>
                  {r.title ? <span>{r.title}</span> : null}
                </span>
                <span className="dlg4-nums">
                  <span className="dlg4-m">{fmtMeters(r.meters)}</span>
                  <span className="dlg4-t">{fmtDuration(r.seconds)}</span>
                  <span className="dlg4-s">{fmtSplit(r.meters, r.seconds)} /500M</span>
                </span>
              </span>
              <span className="dlg4-rail">
                <button type="button" className="dlg-dots" aria-expanded={false}>
                  ⋮
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="wrap">
          <p className="dlg-note">DRAFTS — THE REAL LOG IS UNCHANGED.</p>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
