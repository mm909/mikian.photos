import type { Metadata } from "next";
import { digitCount } from "@/lib/blackoutRules";
import { fmtDay, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { Blocks } from "../Blackout";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { TrackedLink } from "../TrackedLink";
import { boardData, EMPTY_BOARDS } from "../boardData";
import { firstToGoal, type GoalClaim } from "../firstToGoal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The partners — 100K September",
  description: "Partners back Rowtember with real prizes on the line.",
};

/* Grizzly Health brand assets (downloaded from grizzlyhealth.org with the
 * owner, for this partnership block) + their palette, lifted from the CSS
 * variables on their site: greens #06130c/#0c2015/#142a1c, cream #f2ead7,
 * sage #a9bba6, gold #d3ab5d. The wordmark is gold + WHITE, so every
 * surface it sits on is one of their greens, never paper. */
const GRIZZLY = {
  site: "https://grizzlyhealth.org",
  bear: "/row100k/partners/grizzly-bear.png",
  wordmark: "/row100k/partners/grizzly-wordmark.png",
};

/* The prize in hand (owner's gallery exports, resized to 1200px for this
 * page — the originals live in R2 under row100k/gallery/), plus the meals
 * on the erg-room floor from the first batch. */
const PHOTOS = {
  pair: [
    {
      src: "/row100k/partners/grizzly-claim-stack.jpg",
      alt: "A rower grinning with three stacked Grizzly Health meal containers in his arms",
    },
    {
      src: "/row100k/partners/grizzly-claim-one.jpg",
      alt: "A rower holding one Grizzly Health meal container out to the camera",
    },
  ],
  floor: {
    src: "/row100k/rowtember-profiles/IMG_5229.JPG",
    alt: "Two Grizzly Health meal containers stacked on the erg room floor, a rower blurred behind them",
  },
};

/* Partners-page styles — .ptn- prefix, theme.ts untouched. Rendered as the
 * text child of a style tag, so no double quotes, no angle brackets, and no
 * apostrophes anywhere in the string (see the note in theme.ts). */
const ptnCss = `
.row100k .ptn-logos{background:#0c2015;border:2px solid #06130c;box-shadow:8px 8px 0 rgba(21,23,26,.2);padding:34px 22px 30px;text-align:center}
.row100k .ptn-logos .eyebrow{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#a9bba6;margin-bottom:18px}
.row100k .ptn-mark{display:inline-flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;text-decoration:none}
.row100k .ptn-mark img{display:block}
.row100k .ptn-mark .bear{height:68px;width:auto}
.row100k .ptn-mark .word{height:34px;width:auto}
.row100k .ptn-sub{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#a9bba6;margin:18px 0 0}
.row100k .ptn-sub a{color:#f2ead7;text-decoration:underline;text-underline-offset:3px}
.row100k .ptn-sub a:hover{color:#d3ab5d}

.row100k .ptn-brand{background:#0c2015;border:2px solid #06130c;box-shadow:8px 8px 0 rgba(21,23,26,.2);padding:26px 22px 30px;margin-top:22px}
.row100k .ptn-claim{font-size:15px;color:#e3d9bf;max-width:60ch}
.row100k .ptn-claim b{color:#f2ead7}
.row100k .ptn-grid{margin-top:20px}
.row100k .ptn-brand .rec{border:2px solid rgba(242,234,215,.25);background:#142a1c}
.row100k .ptn-brand .rec .t{color:#a9bba6}
.row100k .ptn-brand .rec .v{color:#d3ab5d}
.row100k .ptn-brand .rec .v em{color:#f2ead7}
.row100k .ptn-brand .rec .meta{color:#a9bba6;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;margin-top:8px;line-height:1.7}
.row100k .ptn-brand .rec .meta a{color:#f2ead7;text-decoration:underline;text-underline-offset:3px}
.row100k .ptn-brand .rec .meta a:hover{color:#d3ab5d}
.row100k .ptn-brand .rec.claimed{border-color:#d3ab5d;background:#1a2f22;box-shadow:4px 4px 0 #d3ab5d}
.row100k .ptn-brand .rec.claimed .v{color:#f2ead7}
.row100k .ptn-stamp{display:inline-block;font-family:var(--row-archivo-black),sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#06130c;background:#d3ab5d;padding:3px 9px 2px;margin-left:10px;vertical-align:middle;transform:rotate(-2deg)}
.row100k .ptn-brand .rec.claimed .who{display:block;font-family:var(--row-archivo-black),sans-serif;font-size:clamp(18px,4.6vw,24px);letter-spacing:0;text-transform:uppercase;color:#d3ab5d;margin:8px 0 2px;line-height:1.1}
.row100k .ptn-brand .rec.claimed .who a{color:#d3ab5d;text-decoration:none}
.row100k .ptn-brand .rec.claimed .who a:hover{color:#f2ead7}

.row100k .ptn-shots{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:26px}
.row100k .ptn-shots img,.row100k .ptn-shot img{display:block;width:100%;height:auto;border:2px solid rgba(242,234,215,.2);background:#06130c}
.row100k .ptn-shot{margin-top:12px}
.row100k .ptn-cap{font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;color:#a9bba6;text-transform:uppercase;margin-top:8px}

.row100k .ptn-code{border:2px solid #d3ab5d;background:#06130c;padding:32px 22px 30px;margin-top:30px;text-align:center}
.row100k .ptn-code .eyebrow{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.22em;color:#a9bba6;text-transform:uppercase}
.row100k .ptn-code .word{font-family:var(--row-archivo-black),sans-serif;font-size:clamp(30px,9.4vw,84px);line-height:1;text-transform:uppercase;margin-top:10px;color:#d3ab5d}
.row100k .ptn-code .deal{font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-top:16px;color:#f2ead7}
.row100k .ptn-code .deal a{color:#f2ead7;text-decoration:underline;text-underline-offset:3px}
.row100k .ptn-code .deal a:hover{color:#d3ab5d}

/* The ask under the partner block: framed as backing the work, not selling a
 * slot (owner call — no scarcity, and it has to carry over to the athletes
 * we sponsor next). Quiet strip on paper, never a pitch section. */
.row100k .ptn-next{margin-top:30px;border-top:2px solid var(--ink);padding:22px 0 4px;text-align:center}
.row100k .ptn-next .k{display:block;font-family:var(--row-mono),monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft)}
.row100k .ptn-next a{display:inline-block;margin-top:12px;font-family:var(--row-mono),monospace;font-size:clamp(15px,4.2vw,20px);font-weight:700;letter-spacing:.04em;color:var(--water);text-decoration:underline;text-underline-offset:5px;word-break:break-all}
.row100k .ptn-next a:hover{color:var(--ink)}

@media (max-width:599px){
  .row100k .ptn-logos{padding:26px 14px 24px}
  .row100k .ptn-mark .bear{height:52px}
  .row100k .ptn-mark .word{height:26px}
  .row100k .ptn-brand{padding:20px 14px 24px}
  .row100k .ptn-shots{gap:8px}
}
`;

/* Who got to 100k first — the rule (earliest crossing by row day, then by
 * log time) lives in ../firstToGoal so the admin post pack headlines exactly
 * the same rower this page does. */

/* The partners page: their logos up top, then what Grizzly Health put on the
 * line — which prizes are claimed and by whom, the photos, the code. Public,
 * like the rest of /row100k (opened up 2026-09-03 once there was a winner
 * to show; it lives in the bar next to STATS / FEED / GALLERY). */
export default async function PartnersPage() {
  // Prize state: who is leading each board, and who got to 100k first.
  // Fail open — the block still renders with the prizes listed.
  let boards = EMPTY_BOARDS;
  let claim: GoalClaim | null = null;
  try {
    [boards, claim] = await Promise.all([boardData(), firstToGoal()]);
  } catch (err) {
    console.error("row100k partners: failed to load prize state", err);
  }
  // boardData() is the PUBLIC board: during a blackout the leader arrives
  // already masked (blackoutRules.ts) with a tier floor that can be 0, so a
  // masked row counts as leading even at a 0 floor — it is first on the
  // board by definition — and prints blocks instead of the floor.
  const leader = (division: "M" | "F") =>
    boards.total.find((r) => r.division === division && (r.meters > 0 || r.masked)) ?? null;
  const men = leader("M");
  const women = leader("F");

  // The claimed card prints the claimant's running total, and firstToGoal()
  // reads the raw rows — the truth, blackout or not. The first rower to
  // 100k is in the elite fifteen by construction, so the card asks the same
  // PUBLIC board whether that rower is masked right now and prints blocks
  // when they are. Promise.all above loads the board and the claim together
  // or not at all, and a rower with 100k is on the board, so a missing row
  // cannot happen — but if it ever does the card hides rather than leaks.
  const claimNum = claim?.rowerNumber;
  const claimRow = claim ? boards.total.find((r) => r.rowerNumber === claimNum) : undefined;
  const claimHidden = claim ? !claimRow || claimRow.masked === true : false;

  const leading = (r: typeof men) =>
    r ? (
      <>
        Leading —{" "}
        <a href={`/row100k/r/${r.rowerNumber}`}>
          {r.name} · {fmtRowerNumber(r.rowerNumber)}
        </a>{" "}
        ·{" "}
        {r.masked ? (
          <>
            <Blocks digits={r.digits ?? digitCount(r.meters)} /> m
          </>
        ) : (
          fmtMeters(r.meters)
        )}
      </>
    ) : (
      <>In play — decided Sep 30</>
    );

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{ptnCss}</style>

      <RowBar active="partners" />

      <section>
        <div className="wrap">
          <div className="ptn-logos">
            <div className="eyebrow">Rowtember 2026 · Partners</div>
            <TrackedLink link="grizzly">
              <a className="ptn-mark" href={GRIZZLY.site} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="bear" src={GRIZZLY.bear} alt="" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="word"
                  src={GRIZZLY.wordmark}
                  alt="Grizzly Health — You Gotta Be Hungry"
                />
              </a>
            </TrackedLink>
            <p className="ptn-sub">
              Prepared meals · Coaching ·{" "}
              <TrackedLink link="grizzly">
                <a href={GRIZZLY.site} target="_blank" rel="noopener noreferrer">
                  grizzlyhealth.org
                </a>
              </TrackedLink>
            </p>
          </div>

          <div className="ptn-brand">
            <p className="ptn-claim">
              <b>Grizzly Health is giving away five free meals</b> to the first-place men&apos;s
              board, the first-place women&apos;s board, and the first rower to 100,000&nbsp;m.
            </p>

            {/* The claimed prize leads the three (owner call, day 3); the two
             * boards still in play follow. */}
            <div className="records ptn-grid">
              {claim ? (
                <div className="rec claimed">
                  <div className="t">
                    FIRST TO 100,000 M
                    <span className="ptn-stamp">Claimed</span>
                  </div>
                  <div className="v">
                    5 <em>FREE MEALS</em>
                  </div>
                  <span className="who">
                    <a href={`/row100k/r/${claim.rowerNumber}`}>
                      {claim.name} · {fmtRowerNumber(claim.rowerNumber)}
                    </a>
                  </span>
                  <div className="meta">
                    Crossed 100k on {fmtDay(claim.day)} · now{" "}
                    {claimHidden ? (
                      <>
                        <Blocks digits={claimRow?.digits ?? digitCount(claim.total)} /> m
                      </>
                    ) : (
                      fmtMeters(claim.total)
                    )}
                    {claim.instagram ? (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={`https://instagram.com/${claim.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          @{claim.instagram}
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rec">
                  <div className="t">FIRST TO 100,000 M</div>
                  <div className="v">
                    5 <em>FREE MEALS</em>
                  </div>
                  <div className="meta">Still open — nobody there yet</div>
                </div>
              )}
              <div className="rec">
                <div className="t">MEN&apos;S BOARD — 1ST PLACE</div>
                <div className="v">
                  5 <em>FREE MEALS</em>
                </div>
                <div className="meta">{leading(men)}</div>
              </div>
              <div className="rec">
                <div className="t">WOMEN&apos;S BOARD — 1ST PLACE</div>
                <div className="v">
                  5 <em>FREE MEALS</em>
                </div>
                <div className="meta">{leading(women)}</div>
              </div>
            </div>

            <div className="ptn-shots">
              {PHOTOS.pair.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.src} src={p.src} alt={p.alt} width={1200} height={1500} loading="lazy" />
              ))}
            </div>
            <p className="ptn-cap">THE PRIZE, IN HAND</p>

            <div className="ptn-shot">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTOS.floor.src} alt={PHOTOS.floor.alt} loading="lazy" />
              <p className="ptn-cap">THE MEALS</p>
            </div>

            <div className="ptn-code">
              <div className="eyebrow">THE CODE</div>
              <div className="word">ROWTEMBER</div>
              <div className="deal">
                10% OFF MEALS AT{" "}
                <TrackedLink link="grizzly-code">
                  <a href={GRIZZLY.site} target="_blank" rel="noopener noreferrer">
                    GRIZZLYHEALTH.ORG
                  </a>
                </TrackedLink>
              </div>
            </div>
          </div>

          <div className="ptn-next">
            <span className="k">Become a partner</span>
            <a href="mailto:mikian.musser@gmail.com?subject=Becoming%20a%20partner">
              mikian.musser@gmail.com
            </a>
          </div>
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
