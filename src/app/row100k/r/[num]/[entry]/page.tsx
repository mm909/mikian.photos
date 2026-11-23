import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { EDITION } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../../../theme";
import { RowBar } from "../../../RowBar";
import { RowFooter } from "../../../RowFooter";
import { EliteMark, HiddenBlock, MetersOf } from "../../../feed/Strips";
import { eliteListHref } from "../../../feed/view";
import { RowPhotos } from "./RowPhotos";
import { loadRow } from "./rowData";

export const dynamic = "force-dynamic";

/* THE PAGE OF ONE ROW: /r/<rower number>/<row id>.
 *
 * LIVE, NOT IN DEVELOPMENT (owner, 2026-11-23: "Yes, let's make a shareable
 * link for a row, just like we can for a profile"). The phone app's SHARE
 * LINK hands this address to a text message; a page only an admin could
 * open would be no link at all, so it carries no development gate. It is
 * linked from nowhere on the site: it is reached by its address.
 *
 * What it is: the row's own strip off /feed (the title, the number and the
 * name, the meters, the time, the split and the clock it landed), with
 * TELEMETRY after them when the monitor recorded it; then the two photos,
 * large; then what the rower wrote under them. The name opens the rower.
 *
 * What a visitor may see is the feed's rule, row for row (rowData.ts says
 * each case): a row the lights-out hides is its strip as /feed draws it,
 * blocks and THE ELITE mark and no photos; a private rower's row says it is
 * private and shows nothing of theirs; a row that is not there, or not that
 * rower's, is a 404.
 *
 * THE LINK CARD a message draws for it: the line "Ada Lovelace rowed 5,000 m
 * at 1:57 /500m" and the row's first photo, only when this page would show
 * those to a stranger (whoever fetches the card is signed out). Otherwise
 * the site's usual card and no number.
 *
 * Styles: the feed's .fd- block in theme.ts for the strip, and the few
 * .rw- lines below for what a strip has no place for. */

function parseNum(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 999999 ? n : null;
}
const ID_RE = /^[a-z0-9]{1,40}$/i;

/* One read for the card and the page. */
const viewerOnce = cache(resolveViewer);
const rowOnce = cache(async (num: number, id: string) => loadRow(await viewerOnce(), num, id));

/* "1:57.0" to "1:57": a card says the pace to the second, as the app does. */
function wholeSplit(s: string): string {
  const m = /^(\d+):(\d{2})\.(\d)$/.exec(s);
  if (!m) return s;
  const t = Math.round(Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 10);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

const SITE = EDITION ?? "Rowtember";
const OG_IMAGE = EDITION === "Rowvember" ? "/row100k/og-rowvember.png" : "/row100k/og.png";

export async function generateMetadata({ params }: { params: { num: string; entry: string } }): Promise<Metadata> {
  const num = parseNum(params.num);
  const row = num && ID_RE.test(params.entry) ? await rowOnce(num, params.entry).catch(() => null) : null;
  const usual = (title: string, description: string): Metadata => ({
    title,
    description,
    openGraph: { title, description, images: [{ url: OG_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  });
  if (!row) return { title: `A row · ${SITE}` };
  if (row.kind === "private") return usual(`A private row · ${SITE}`, "This rower's rows are shown to the followers they have accepted.");
  const it = row.item;
  if (it.masked) return usual(`${it.name} · a row · ${SITE}`, `A row by ${it.name}.`);
  const line = `${it.name} rowed ${it.metersStr} at ${wholeSplit(it.splitStr)} /500m`;
  const title = `${line} · ${SITE}`;
  const description = [it.title, `${it.metersStr} in ${it.durationStr}`, `${it.dayStr}`].filter(Boolean).join(" · ");
  const photo = it.photos.find((p) => /^https?:\/\//.test(p.full));
  if (!photo) return usual(title, description);
  return {
    title,
    description,
    openGraph: { type: "article", title: line, description, images: [{ url: photo.full }] },
    twitter: { card: "summary_large_image", title: line, description, images: [photo.full] },
  };
}

/* Per the theme.ts hydration rule: no double quotes, no angle brackets, no
 * apostrophes in this string. */
const rowCss = `
.row100k section.rw-sec{padding:30px 0 8px}
.row100k .rw-strip.open{grid-template-columns:minmax(0,1fr)}
.row100k .rw-strip .fd-sub .rw-tel{color:var(--gray);letter-spacing:.14em}
.row100k .rw-pics{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:18px}
.row100k .rw-pics.one{grid-template-columns:minmax(0,420px)}
.row100k .rw-pics .fd-pic{width:100%;aspect-ratio:4/5;background:var(--line)}
.row100k .rw-cap{font-family:var(--row-archivo),sans-serif;font-size:16px;line-height:1.5;color:var(--ink);margin:16px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.row100k .rw-note{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:18px 0 0;line-height:1.7}
.row100k .rw-who{font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);margin:0;display:flex;flex-wrap:wrap;gap:0 8px;align-items:baseline}
.row100k .rw-who .fd-n{color:var(--gray);font-weight:400}
`;

export default async function RowPage({ params }: { params: { num: string; entry: string } }) {
  const num = parseNum(params.num);
  if (!num || !ID_RE.test(params.entry)) notFound();
  const viewer = await viewerOnce();
  const row = await rowOnce(num, params.entry);
  if (!row) notFound();

  const who = row.kind === "private" ? row : row.item;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{rowCss}</style>

      <RowBar {...barProps(viewer)} />

      <section className="rw-sec">
        <div className="wrap">
          {row.kind === "private" ? (
            <>
              <h1 className="fd-dayh">
                <span>A row</span>
              </h1>
              <p className="rw-who" style={{ marginTop: 16 }}>
                <span className="fd-n">{row.numStr} ·</span>
                <a className="fd-who" href={`/r/${row.rowerNumber}`}>
                  {row.name}
                </a>
              </p>
              <p className="rw-note">Private account · this row is shown to followers this rower has accepted</p>
            </>
          ) : (
            <>
              {/* The day it landed, as the feed heads its day. */}
              <h1 className="fd-dayh">
                <span>{row.item.dayStr}</span>
              </h1>
              <article className={`fd-strip rw-strip${row.item.masked ? "" : " open"}`}>
                {row.item.masked ? row.item.elite ? <EliteMark href={eliteListHref()} /> : <HiddenBlock /> : null}
                <span className="fd-mid">
                  <span className="fd-lead">
                    {row.item.title ? <span className="fd-ttl">{row.item.title}</span> : null}
                    <span className="fd-nm">
                      <span className="fd-n">{row.item.numStr} ·</span>
                      <a className="fd-who" href={`/r/${row.item.rowerNumber}`}>
                        {row.item.name}
                      </a>
                    </span>
                  </span>
                  <span className="fd-m">
                    <MetersOf item={row.item} />
                  </span>
                  <span className="fd-sub">
                    {row.item.durationStr ? <span className="fd-d">{row.item.durationStr}</span> : null}
                    <span className="fd-s">{row.item.splitStr} /500m</span>
                    <span className="fd-t" title={row.item.absIso}>
                      {row.item.clockStr}
                    </span>
                    {row.telemetry ? <span className="rw-tel">TELEMETRY</span> : null}
                  </span>
                </span>
              </article>

              <RowPhotos photos={row.item.photos} alts={row.item.photos.map((_, i) => (i === 0 ? `${row.item.name} after the row` : "Erg screen"))} />
              {row.caption ? <p className="rw-cap">{row.caption}</p> : null}
            </>
          )}

          <nav className="fd-pager" aria-label="This rower">
            <a href={`/r/${who.rowerNumber}`}>
              ROWER {who.numStr} · {who.name.toUpperCase()} →
            </a>
          </nav>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
