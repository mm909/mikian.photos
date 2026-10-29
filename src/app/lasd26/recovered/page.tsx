import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { TEAM, ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { dueFor, paidStamp, viaLabel } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";
import { lasdPath } from "@/lib/lasd26/paths";
import { BareFrame } from "../your-share/BareFrame";

/**
 * RECOVERED (lasdPath("/recovered")) — who paid, how much, and what has
 * come back so far (owner, 2026-10-29: "I need a screen that shows who
 * paid and how much and the total amount of $ recovered"). The same bare
 * frame as /lasd26/your-share (BareFrame.tsx), one big number — what has
 * come in — a line with how many have paid and what is still to come, the
 * payments newest first, and the names still to pay, dim.
 *
 * OWNER ONLY, always: who paid what is his to see (the team console at
 * /lasd26/team has the same rows in a table). Anyone else gets a 404. LIVE
 * (owner, 2026-10-29: "make that page live"): linked from the TEAM group
 * of his account menu, noindex.
 *
 * The numbers are settle.ts's: a row is paid when paidAt is set (a card
 * capture, or the owner's MARK PAID), at paidCents; the pool's own row
 * (his test payments are never recorded) is skipped; TO COME is
 * Due.toCollectCents. A payout the owner made to someone he owed
 * (settledAt) is not money in and is not listed.
 */

export const metadata: Metadata = {
  title: "Recovered — LASD26",
  description: "Who paid, and what has come back.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111110",
};

// Owner-gated and the sheet moves — never render statically.
export const dynamic = "force-dynamic";

export default async function RecoveredPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (!viewer.owner) notFound();

  const due = await dueFor(TEAM);
  const rows = due.members.filter((r) => !r.pool);
  const paid = rows.filter((r) => r.paidAt !== null).sort((a, b) => (b.paidAt as Date).getTime() - (a.paidAt as Date).getTime());
  const notYet = rows.filter((r) => r.paidAt === null && r.status === "owes");
  let recovered = 0;
  for (const r of paid) recovered += r.paidCents;

  return (
    <BareFrame name={viewer.actor ? (viewer.member?.name ?? viewer.actor.name) : null}>
      <section className="stage list">
        <div className="step">
          <h1>Recovered.</h1>
          <p className="line mono">
            {paid.length} of {rows.length} paid · {fmtUsd(due.toCollectCents, { whole: due.toCollectCents % 100 === 0 })} still to come ·{" "}
            <a href={lasdPath("/team")}>team console</a>
          </p>
          <div className="k mono">Recovered so far</div>
          <div className="big">{fmtUsd(recovered, { whole: recovered % 100 === 0 })}</div>

          {paid.length > 0 ? (
            <ul className="paid">
              {paid.map((r) => (
                <li key={r.memberId}>
                  <span className="who">{r.name}</span>
                  <span className="amt">{fmtUsd(r.paidCents)}</span>
                  <span className="when mono">
                    {paidStamp(r.paidAt as Date)} · {viaLabel(r.paidVia)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="line mono">Nobody yet.</p>
          )}

          {notYet.length > 0 && (
            <>
              <div className="k mono">Not yet</div>
              <p className="names mono">{notYet.map((r) => r.name).join(" · ")}</p>
            </>
          )}
        </div>
      </section>
    </BareFrame>
  );
}
