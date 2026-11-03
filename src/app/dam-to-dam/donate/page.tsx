import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { THEME_COLOR } from "../look";
import { readLook } from "../readLook";
import { css, spaceMono } from "../theme";

/* THE DONOR PAGE (owner, 2026-11-03: "This should be what we send
 * people/compnaies who want to donate. It should be clear, what I am
 * doing, how much I am asking/aming to raise, how matched donations work")
 * — the page a donor or a company gets as a link: the row in one
 * paragraph, the $100,000 goal (a dollar a meter), the match pool, where
 * the money goes, and the two asks. Donations go DIRECTLY to
 * Candlelighters Childhood Cancer Foundation of Nevada — this site never
 * touches the money; match pledges and the totals below are updated by
 * hand until there is a reason to automate them.
 *
 * RAISED / MATCH_POOL are the hand-updated numbers the gauge draws. The
 * exact Candlelighters donation link, and whether they set up a dedicated
 * campaign page for the row, is an open question in SPEC.md — the owner
 * talks to them before this page goes anywhere.
 *
 * IN DEVELOPMENT with the rest of /dam-to-dam: owner-only in production,
 * open in local dev. */

export const metadata: Metadata = {
  title: "Donate (dev) — Dam to Dam",
  description:
    "100,000 meters of rowing, $100,000 for Candlelighters Childhood Cancer Foundation of Nevada. A dollar a meter.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export function generateViewport(): Viewport {
  return { themeColor: THEME_COLOR[readLook().look] };
}

const OWNER_IG = "mikian_";
const CANDLELIGHTERS_URL = "https://www.candlelightersnv.org/";

/* Hand-updated until the row has real numbers to show. */
const GOAL = 100_000;
const RAISED = 0;
const MATCH_POOL = 0;

const usd = (n: number) => "$" + n.toLocaleString("en-US");

/* THE GAUGE: the money drawn as the river — a dam at each end, the raised
 * dollars filling the line meter for meter. */
function Gauge() {
  const W = 920;
  const x0 = 10;
  const x1 = W - 10;
  const fx = x0 + (x1 - x0) * Math.min(1, RAISED / GOAL);
  return (
    <div className="dd-gauge">
      <svg viewBox={`0 0 ${W} 40`} role="img" aria-label={`${usd(RAISED)} raised of the ${usd(GOAL)} goal.`} style={{ width: "100%", display: "block" }}>
        <path d={`M${x0} 8 L${x0} 32`} stroke="var(--m-strong)" strokeWidth={5} />
        <path d={`M${x1} 8 L${x1} 32`} stroke="var(--m-strong)" strokeWidth={5} />
        <path d={`M${x0} 20 L${x1} 20`} stroke="var(--m-rim)" strokeWidth={1.2} strokeDasharray="7 9" />
        {RAISED > 0 && <path d={`M${x0} 20 L${fx} 20`} stroke="var(--m-route)" strokeWidth={2.4} strokeLinecap="round" />}
        <circle cx={fx} cy={20} r={4.5} fill="var(--m-dot)" />
      </svg>
      <div className="lbl">
        <span>Hoover · {usd(RAISED)} raised</span>
        <span>Davis · {usd(GOAL)}</span>
      </div>
    </div>
  );
}

export default async function DamToDamDonatePage() {
  const actor = await getEffectiveActor();
  const owner = actor ? isOwner(actor) : false;
  if (process.env.NODE_ENV === "production" && !owner) notFound();
  const { look } = readLook();

  return (
    <div className={`dd dd-${look} ${spaceMono.variable}`}>
      <style>{css}</style>

      <div className="dd-bar">
        <div className="dd-wm">
          <Link href="/dam-to-dam">Dam to Dam</Link>
        </div>
        <div className="dd-doors">
          <Link href="/dam-to-dam" className="dd-door">
            The row
          </Link>
          <span className="dd-dev">Dev</span>
        </div>
      </div>

      <div className="wrap">
        <div className="dd-hero">
          <h1>
            A dollar <span>a meter</span>
          </h1>
          <div className="dd-sub">Supporting Candlelighters Childhood Cancer Foundation of Nevada</div>
          <p className="dd-lede">
            On one November day I row 100,000 meters of the Colorado River — from the Hoover Dam
            to the Davis Dam, solo, point to point, ten-plus hours on the water. The row has a
            price on its head: <b>$100,000 for Candlelighters</b>, a dollar for every meter.
          </p>
          <div className="dd-facts">
            <div className="dd-fact">
              <div className="k">Goal</div>
              <div className="v">
                {usd(GOAL)}
                <small>a dollar a meter, capped at the row itself</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">Beneficiary</div>
              <div className="v">
                Candlelighters<small>Childhood Cancer Foundation of Nevada</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">The row</div>
              <div className="v">
                100,000 m<small>Hoover Dam → Davis Dam, one day, solo</small>
              </div>
            </div>
            <div className="dd-fact">
              <div className="k">Match pool</div>
              <div className="v">
                {usd(MATCH_POOL)}
                <small>pledged so far — every pledge doubles small donations</small>
              </div>
            </div>
          </div>
          <Gauge />
        </div>

        <section>
          <div className="dd-head">
            <h2>How the match works</h2>
            <span>two kinds of donors, one total</span>
          </div>
          <div className="dd-row">
            <div className="k">The pool</div>
            <p>
              Companies and big donors pledge <b>matching funds</b> before race day. A pledge is a
              promise, not a payment: it pays out only as individual donations come in to meet it.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">Your dollar</div>
            <p>
              Every individual donation is <b>matched 1:1 from the pool</b> until the pool runs
              dry — your $25 puts $50 in front of a family. The page always shows how much match
              is left.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">The cap</div>
            <p>
              The goal is capped at the row itself: <b>{usd(GOAL)} for 100,000 meters</b>. When
              the line is full, the row is paid for its distance and the campaign closes.
            </p>
          </div>
          <div className="dd-row">
            <div className="k">The money</div>
            <p>
              Donations go <b>directly to Candlelighters</b> through their own donation page —
              never through me or this site. Match pledges settle directly with Candlelighters
              too. I carry the oars, not the cash.
            </p>
          </div>
        </section>

        <section>
          <div className="dd-head">
            <h2>Where it goes</h2>
            <span>the cause</span>
          </div>
          <p className="dd-lede" style={{ marginTop: 24 }}>
            Candlelighters Childhood Cancer Foundation of Nevada supports children with cancer and
            their families — emotional, financial and quality-of-life support, from diagnosis
            onward. They are Nevada families and this is a Nevada row: the water in this chart is
            the state line.
          </p>
          <a className="dd-cta" href={CANDLELIGHTERS_URL} target="_blank" rel="noopener noreferrer">
            Donate now → candlelightersnv.org
          </a>
        </section>

        <section>
          <div className="dd-head">
            <h2>Match the row</h2>
            <span>for companies and big donors</span>
          </div>
          <p className="dd-lede" style={{ marginTop: 24 }}>
            A match pledge is the highest-leverage dollar in the campaign: it doubles everyone
            else and your name rides every dollar it doubles — here, on the live map on race day,
            and in the story afterward. Pledge any amount; nothing is collected unless the
            donations come in to meet it.
          </p>
          <a className="dd-cta" href={`https://instagram.com/${OWNER_IG}`} target="_blank" rel="noopener noreferrer">
            Pledge a match → @{OWNER_IG}
          </a>
        </section>
      </div>

      <footer>Dam to Dam · a dollar a meter · for Candlelighters</footer>
    </div>
  );
}
