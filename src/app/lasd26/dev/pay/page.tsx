import type { Metadata, Viewport } from "next";
import { TEAM } from "@/lib/lasd26/team";
import { gateLasdDev } from "@/lib/lasd26/devGate";
import { lasdPath } from "@/lib/lasd26/paths";
import { dueFor, memberDue, paidStamp, viaLabel } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { LasdPage } from "../LasdPage";
import { payCss } from "../payCss";
import { PayShare } from "./PayShare";

/**
 * SETTLE UP, the dev copy (lasdPath("/pay") = /lasd26/dev/pay;
 * lib/lasd26/paths.ts; owner, 2026-10-15: "each person's share payable on
 * the site by card after the race … the pay button visible only to me for
 * now"). Behind the dev gate in production (admin-only) like the rest of
 * the dev tree.
 *
 * Who sees what:
 *   - signed out / not on the team → a notice (the bar has SIGN IN)
 *   - a member while settleOpen is false → "opens after the race"
 *   - a member once it is open → YOUR SHARE, the maths, PAID or the button
 *   - the owner → always the full page; a note on top while it is closed
 *
 * The share is settle.ts's number from the live cost sheet; the expenses
 * page has every line behind it.
 */

export const metadata: Metadata = {
  title: "Settle up — LASD26 (dev)",
  description: "Your share of the crossing.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated and the sheet moves — never render statically.
export const dynamic = "force-dynamic";

function Foot() {
  return (
    <footer>
      <div className="wrap" style={{ padding: 0 }}>
        <div className="big">NO SHORTCUTS TIME TRIAL — 7TH EDITION</div>
        <p className="mono">for yourself and others</p>
      </div>
    </footer>
  );
}

export default async function PayPage() {
  const viewer = await gateLasdDev();

  // The calm doors first: nobody off the team sees a number.
  if (!viewer.actor) {
    return (
      <LasdPage viewer={viewer} active="pay" extraCss={payCss}>
        <section className="pay-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Settle up</h2>
              <span className="mono">TEAM ONLY</span>
            </div>
            <div className="pay-notice">
              <b>Sign in to see your share.</b>
              Sign in with Google, top right. Your share of the crossing shows here once you are on the team.
            </div>
          </div>
        </section>
        <Foot />
      </LasdPage>
    );
  }

  if (!viewer.onTeam) {
    return (
      <LasdPage viewer={viewer} active="pay" extraCss={payCss}>
        <section className="pay-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Settle up</h2>
              <span className="mono">TEAM ONLY</span>
            </div>
            <div className="pay-notice">
              <b>This page is for the LASD26 team.</b>
              Join through the link Mikian sent to the group chat and your share shows here.
              <span className="mono">Signed in as {viewer.actor.email}</span>
            </div>
          </div>
        </section>
        <Foot />
      </LasdPage>
    );
  }

  const due = await dueFor(TEAM);

  // A member while settling up is closed (the owner always gets through).
  if (!due.settleOpen && !viewer.owner) {
    return (
      <LasdPage viewer={viewer} active="pay" extraCss={payCss}>
        <section className="pay-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Settle up</h2>
              <span className="mono">AFTER THE RACE</span>
            </div>
            <div className="pay-notice">
              <b>Settling up opens after the race.</b>
              The crew will send the word. Until then every cost is on the <a href={lasdPath("/expenses")}>expenses page</a> — add yours there.
            </div>
          </div>
        </section>
        <Foot />
      </LasdPage>
    );
  }

  const mine = viewer.member ? memberDue(viewer.member, due) : null;
  const hasEstimates = due.estimatedCents > 0;
  const paymentsOpen = isPaymentsOpen() || viewer.owner;

  return (
    <LasdPage viewer={viewer} active="pay" extraCss={payCss}>
      <section className="pay-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>Settle up</h2>
            <span className="mono">{mine?.paid ? "PAID" : due.settleOpen ? "YOUR SHARE" : "NOT OPEN YET"}</span>
          </div>

          {viewer.owner && !due.settleOpen && (
            <p className="pay-owner mono">
              Only you can see this page until you open settling up (<a href={lasdPath("/team")}>Team → settings</a>).
            </p>
          )}

          <div className="pay-share">
            <div className="k mono">Your share</div>
            <div className="n">{fmtUsd(due.perPersonCents)}</div>
            <p className="m mono">
              <b>{fmtUsd(due.totalCents)}</b> ÷ {due.splitCount}
              {due.totalCents === 0 ? " · nothing on the sheet yet" : ""}
            </p>
            {hasEstimates && (
              <p className="est mono">
                Includes estimates — <b>{fmtUsd(due.estimatedCents)}</b> of it is a round number until the receipts land. The share may move a little.
              </p>
            )}
          </div>

          {!viewer.member ? (
            <div className="pay-notice" style={{ marginTop: 22 }}>
              <b>You are not on the roster yet.</b>
              Join through the invite link (<a href={lasdPath("/team")}>Team → invite link</a>) to carry a share yourself. Everyone else&rsquo;s marks live on the members list there.
            </div>
          ) : mine?.paid ? (
            <div className="pay-paid mono">
              <div className="big">Paid — thank you.</div>
              {mine.paidAt ? paidStamp(mine.paidAt) : "—"} · {fmtUsd(mine.paidCents)} · via {viaLabel(mine.paidVia)}
            </div>
          ) : !paymentsOpen ? (
            <div className="pay-notice" style={{ marginTop: 22 }}>
              <b>Payments are paused.</b>
              Try again in a bit — nothing is lost, your share is still {fmtUsd(mine?.outstandingCents ?? due.perPersonCents)}.
            </div>
          ) : (
            <PayShare amount={fmtUsd(mine?.outstandingCents ?? due.perPersonCents)} />
          )}

          <p className="pay-alt mono">
            Prefer Venmo/Zelle? Tell Mikian and he&rsquo;ll mark you paid.
            <br />
            Every line behind the number is on the <a href={lasdPath("/expenses")}>expenses page</a>.
          </p>
        </div>
      </section>
      <Foot />
    </LasdPage>
  );
}
