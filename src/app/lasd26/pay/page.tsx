import type { Metadata, Viewport } from "next";
import { TEAM, ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { lasdPath } from "@/lib/lasd26/paths";
import { dueFor, memberDue, paidStamp, viaLabel, type MemberRow } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { LasdPage } from "../LasdPage";
import { payCss } from "../payCss";
import { PayShare } from "./PayShare";

/**
 * SETTLE UP (lasdPath("/pay"); lib/lasd26/paths.ts; owner, 2026-10-15:
 * "each person's share payable on the site by card after the race … the
 * pay button visible only to me for now"; 2026-10-16: "it's clear to
 * everyone (I would have paid x but I already spent y so now I owe z)").
 *
 * The statement in three lines, big and plain: YOUR SHARE, YOU FRONTED
 * (the lines behind it in small type), and the answer — YOU OWE, or WE
 * OWE YOU (Mikian sends it after the race), or ALL SQUARE. The share and
 * the total are links to the expenses page (owner: "if you click on the
 * number that is your share or the total it takes you to the expenses
 * page"). Paying is by card only (owner: "Allow users to pay w/ card
 * (only card)"), for what is owed — never the full share when something
 * was fronted.
 *
 * Who sees what:
 *   - signed out / not on the team → a notice (the bar has SIGN IN)
 *   - a member while settleOpen is false → "opens after the race"
 *   - a member once it is open → the statement, PAID or the card button
 *   - the owner → always the full page; a note on top while it is closed
 *
 * THE OWNER IS THE POOL (owner, 2026-10-16: "I am not going to be 'paying
 * out' myself. People will be paying me. So that line can be $0 for me"):
 * his statement is YOUR SHARE, YOU FRONTED, then "YOU'RE THE POOL" with a
 * $0 — people pay him, nothing to pay here, no card button, never WE OWE
 * YOU (settle.ts status "pool").
 *
 * The numbers are settle.ts's from the live cost sheet.
 */

export const metadata: Metadata = {
  title: "Settle up — LASD26",
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

/** The eyebrow beside SETTLE UP: where this member stands, in two words. */
function eyebrowFor(mine: MemberRow, settleOpen: boolean): string {
  if (mine.status === "pool") return "THE POOL";
  if (mine.status === "paid") return mine.paidAt ? "PAID" : "PAID OUT";
  if (mine.status === "owed") return "YOU ARE OWED";
  if (mine.status === "square") return "ALL SQUARE";
  return settleOpen ? "YOU OWE" : "NOT OPEN YET";
}

/** The third line of the statement: the answer. */
function Answer({ mine }: { mine: MemberRow }) {
  if (mine.status === "pool") {
    // The owner's own row: the $0 he asked for, and why (2026-10-16:
    // "People will be paying me … that line can be $0 for me").
    return (
      <div className="row big">
        <div className="k mono">You&rsquo;re the pool</div>
        <div className="n">{fmtUsd(0, { whole: true })}</div>
        <p className="m mono">
          People pay you; nothing to pay here. What you fronted is the pool&rsquo;s spend — who owes what is on the <a href={lasdPath("/team")}>team console</a>.
        </p>
      </div>
    );
  }
  if (mine.status === "paid" && mine.paidAt) {
    return (
      <div className="row big">
        <div className="k mono">You paid</div>
        <div className="n">{fmtUsd(mine.paidCents)}</div>
        <p className="m mono">
          {paidStamp(mine.paidAt)} · via {viaLabel(mine.paidVia)}
        </p>
      </div>
    );
  }
  if (mine.status === "paid") {
    // The pool owed them and the owner has sent it (settledAt).
    return (
      <div className="row big">
        <div className="k mono">Paid out to you</div>
        <div className="n">{fmtUsd(mine.settledCents ?? -mine.netCents)}</div>
        <p className="m mono">Mikian sent it{mine.settledAt ? ` · ${paidStamp(mine.settledAt)}` : ""}</p>
      </div>
    );
  }
  if (mine.status === "owed") {
    return (
      <div className="row big">
        <div className="k mono">We owe you</div>
        <div className="n">{fmtUsd(mine.owedCents)}</div>
        <p className="m mono">You fronted more than your share — Mikian sends it after the race.</p>
      </div>
    );
  }
  if (mine.status === "square") {
    return (
      <div className="row big">
        <div className="k mono">All square</div>
        <div className="n">{fmtUsd(0)}</div>
        <p className="m mono">What you fronted is exactly your share — nothing to pay, nothing owed.</p>
      </div>
    );
  }
  return (
    <div className="row big">
      <div className="k mono">You owe</div>
      <div className="n">{fmtUsd(mine.outstandingCents)}</div>
      <p className="m mono">
        {fmtUsd(mine.shareCents)} − {fmtUsd(mine.frontedCents)}
      </p>
    </div>
  );
}

export default async function PayPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());

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

  if (!viewer.onTeam || !viewer.member) {
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

  const mine = memberDue(viewer.member, due);
  const paymentsOpen = isPaymentsOpen() || viewer.owner;
  const expenses = lasdPath("/expenses");

  return (
    <LasdPage viewer={viewer} active="pay" extraCss={payCss}>
      <section className="pay-sec">
        <div className="wrap">
          <div className="sec-head">
            <h2>Settle up</h2>
            <span className="mono">{eyebrowFor(mine, due.settleOpen)}</span>
          </div>

          {viewer.owner && !due.settleOpen && (
            <p className="pay-owner mono">
              Only you can see this page until you open settling up (<a href={lasdPath("/team")}>Team → settings</a>). Until then the numbers still carry the
              estimates; opening it swaps them for the real costs.
            </p>
          )}

          <div className="pay-stmt">
            <div className="row">
              <div className="k mono">Your share</div>
              <a className="n" href={expenses} title="Every line behind it">
                {fmtUsd(mine.shareCents)}
              </a>
              <p className="m mono">
                <a href={expenses}>{fmtUsd(due.totalCents)}</a> ÷ {due.splitCount}
                {due.totalCents === 0 ? " · nothing on the sheet yet" : ""}
              </p>
              {viewer.owner && due.estimatedCents > 0 && (
                <p className="est mono">
                  Includes estimates — <b>{fmtUsd(due.estimatedCents)}</b> of it is a round number until settling up opens.
                </p>
              )}
            </div>
            <div className="row">
              <div className="k mono">You fronted</div>
              <div className="n">{fmtUsd(mine.frontedCents)}</div>
              {mine.fronted.length > 0 ? (
                <ul className="lines mono">
                  {mine.fronted.map((l) => (
                    <li key={l.id}>
                      <span>{l.title}</span>
                      <span>{fmtUsd(l.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              ) : mine.status === "pool" ? (
                <p className="m mono">Nothing yet — a cost you add with PAID BY you is the pool&rsquo;s spend.</p>
              ) : (
                <p className="m mono">Nothing yet — a cost you add with PAID BY you comes off here.</p>
              )}
            </div>
            <Answer mine={mine} />
          </div>

          {mine.status === "paid" && mine.paidAt ? (
            <div className="pay-paid mono">
              <div className="big">Paid — thank you.</div>
              {paidStamp(mine.paidAt)} · {fmtUsd(mine.paidCents)} · via {viaLabel(mine.paidVia)}
            </div>
          ) : mine.status === "owes" && !paymentsOpen ? (
            <div className="pay-notice" style={{ marginTop: 22 }}>
              <b>Payments are paused.</b>
              Try again in a bit — nothing is lost, you still owe {fmtUsd(mine.outstandingCents)}.
            </div>
          ) : mine.status === "owes" ? (
            <PayShare amount={fmtUsd(mine.outstandingCents)} />
          ) : null}
        </div>
      </section>
      <Foot />
    </LasdPage>
  );
}
