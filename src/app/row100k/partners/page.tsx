import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The partners — 100K September",
  description: "Partners back Rowtember with real prizes on the line.",
  robots: { index: false, follow: false },
};

/* The one product photo in the Rowtember batch that clearly shows the
 * partner's meals (stacked labeled containers, shot by the owner in the erg
 * room). Everything else in the folder is rowers, machines, and blur. */
const PRODUCT_SHOT = {
  src: "/row100k/rowtember-profiles/IMG_5229.JPG",
  alt: "Two Grizzly Health meal containers stacked on the erg room floor, a rower blurred behind them",
};

/* Grizzly Health brand assets (downloaded from grizzlyhealth.org with the
 * owner, for this partnership block) + their palette, lifted from the CSS
 * variables on their site: greens #06130c/#0c2015/#142a1c, cream #f2ead7,
 * sage #a9bba6, gold #d3ab5d. The partner block renders in THEIR colors on
 * our page — that contrast is the pitch to the next partner. */
const GRIZZLY = {
  bear: "/row100k/partners/grizzly-bear.png",
  wordmark: "/row100k/partners/grizzly-wordmark.png",
};

/* Partners-page styles — .ptn- prefix, theme.ts untouched. Rendered as the
 * text child of a style tag, so no double quotes, no angle brackets, and no
 * apostrophes anywhere in the string (see the note in theme.ts). */
const ptnCss = `
.row100k .ptn-lede{max-width:56ch;color:var(--ink-soft);font-size:15px}
.row100k .ptn-brand{background:#0c2015;border:2px solid #06130c;box-shadow:8px 8px 0 rgba(21,23,26,.2);padding:26px 22px 30px;margin-top:26px}
.row100k .ptn-mark{display:flex;align-items:center;gap:16px;flex-wrap:wrap;text-decoration:none}
.row100k .ptn-mark img{display:block}
.row100k .ptn-mark .bear{height:48px;width:auto}
.row100k .ptn-mark .word{height:24px;width:auto}
.row100k .ptn-sub{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#a9bba6;margin:12px 0 0;border-bottom:1px solid rgba(242,234,215,.14);padding-bottom:14px}
.row100k .ptn-claim{margin-top:16px;font-size:15px;color:#e3d9bf;max-width:60ch}
.row100k .ptn-claim b{color:#f2ead7}
.row100k .ptn-grid{margin-top:22px}
.row100k .ptn-brand .rec{border:2px solid rgba(242,234,215,.25);background:#142a1c}
.row100k .ptn-brand .rec .t{color:#a9bba6}
.row100k .ptn-brand .rec .v{color:#d3ab5d}
.row100k .ptn-brand .rec .v em{color:#f2ead7}
.row100k .ptn-brand .rec .meta{color:#a9bba6}
.row100k .ptn-shot{margin-top:26px}
.row100k .ptn-shot img{display:block;width:100%;height:auto;border:2px solid rgba(242,234,215,.2);background:#06130c}
.row100k .ptn-cap{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;color:#a9bba6;text-transform:uppercase;margin-top:8px}
.row100k .ptn-code{border:2px solid #d3ab5d;background:#06130c;padding:32px 22px 30px;margin-top:30px;text-align:center}
.row100k .ptn-code .eyebrow{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.22em;color:#a9bba6;text-transform:uppercase}
.row100k .ptn-code .word{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(40px,11vw,84px);line-height:1;text-transform:uppercase;margin-top:10px;color:#d3ab5d}
.row100k .ptn-code .deal{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:16px;color:#f2ead7}
.row100k .ptn-code .deal a{color:#f2ead7;text-decoration:underline;text-underline-offset:3px}
.row100k .ptn-code .deal a:hover{color:#d3ab5d}
@media (max-width:599px){.row100k .ptn-brand{padding:20px 14px 24px}.row100k .ptn-mark .bear{height:40px}.row100k .ptn-mark .word{height:19px}}
.row100k .ptn-pitch{font-size:15px;color:var(--ink-soft);max-width:56ch}
.row100k .ptn-q{font-family:var(--row-mono),monospace;font-size:11px;color:var(--gray);margin-top:18px;letter-spacing:.06em}
.row100k .ptn-q a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.row100k .ptn-q a:hover{color:var(--water)}
`;

/* Preview page the owner shows prospective partners: what Grizzly Health put
 * on the line, the code, and the ask for the next partner. Owner-only in
 * production; open in local dev so it can be checked without a session. */
export default async function PartnersPage() {
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    admin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  } catch {
    /* no session backend in some local setups — the dev branch below still opens */
  }
  if (process.env.NODE_ENV === "production" && !admin) notFound();

  /* Real rower count for the pitch line; the copy stands without it. */
  let rowerCount: number | null = null;
  try {
    rowerCount = await db.rowParticipant.count({ where: { challenge: CHALLENGE } });
  } catch {
    /* copy falls back to the version without a number */
  }
  const field =
    rowerCount && rowerCount > 0 ? `${rowerCount} rowers` : "a whole board of rowers";

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{ptnCss}</style>

      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The partners</h2>
            <span className="mono">THEY PUT SOMETHING ON THE LINE</span>
          </div>
          <p className="ptn-lede">
            Partners back the challenge with real prizes. The rowers put in the meters — the
            partners make the finish worth racing for.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="ptn-brand">
            <a
              className="ptn-mark"
              href="https://grizzlyhealth.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bear" src={GRIZZLY.bear} alt="" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="word"
                src={GRIZZLY.wordmark}
                alt="Grizzly Health — You Gotta Be Hungry"
              />
            </a>
            <p className="ptn-sub">PREPARED MEALS · COACHING · GRIZZLYHEALTH.ORG</p>

            <p className="ptn-claim">
              <b>Grizzly Health is giving away five free meals</b> to the first-place men&apos;s
              board, the first-place women&apos;s board, and the first rower to 100,000&nbsp;m.
            </p>

            <div className="records ptn-grid">
            <div className="rec">
              <div className="t">MEN&apos;S BOARD — 1ST PLACE</div>
              <div className="v">
                5 <em>FREE MEALS</em>
              </div>
              <div className="meta">FROM GRIZZLY HEALTH</div>
            </div>
            <div className="rec">
              <div className="t">WOMEN&apos;S BOARD — 1ST PLACE</div>
              <div className="v">
                5 <em>FREE MEALS</em>
              </div>
              <div className="meta">FROM GRIZZLY HEALTH</div>
            </div>
            <div className="rec">
              <div className="t">FIRST TO 100,000 M</div>
              <div className="v">
                5 <em>FREE MEALS</em>
              </div>
              <div className="meta">FROM GRIZZLY HEALTH</div>
            </div>
            </div>

            <div className="ptn-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PRODUCT_SHOT.src} alt={PRODUCT_SHOT.alt} loading="lazy" />
              <p className="ptn-cap">THE MEALS, IN THE ERG ROOM — SHOT BY MIKIAN</p>
            </div>

            <div className="ptn-code">
              <div className="eyebrow">THE CODE</div>
              <div className="word">ROWTEMBER</div>
              <div className="deal">
                10% OFF MEALS AT{" "}
                <a href="https://grizzlyhealth.org" target="_blank" rel="noopener noreferrer">
                  GRIZZLYHEALTH.ORG
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Partner with Rowtember</h2>
            <span className="mono">THE NEXT SPOT IS OPEN</span>
          </div>
          <p className="ptn-pitch">
            Put a prize on the line for {field} chasing 100,000 meters this September. Your
            brand gets its own block — your colors, your logo, your prize, your code.
          </p>
          <p className="ptn-q">
            Questions →{" "}
            <a href="https://instagram.com/mikian_" target="_blank" rel="noopener noreferrer">
              @mikian_
            </a>
          </p>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
