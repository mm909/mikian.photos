import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { currentInvite, ensureOwnerMember, getTeamViewer, listMembers, inviteUrl, type Member } from "@/lib/lasd26/team";
import { lasdPath } from "@/lib/lasd26/paths";
import { dueFor, type MemberRow } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";
import { LasdPage } from "../LasdPage";
import { teamCss } from "../teamCss";
import { datePacific, originFrom, stampPacific } from "./fmt";
import { InviteLink } from "./InviteLink";
import { PaidButton } from "./PaidButton";
import { SettingsForm } from "./SettingsForm";

/**
 * TEAM (lasdPath("/team"); lib/lasd26/paths.ts) — the owner's console
 * (owner, 2026-10-15: "a link for me to send out"). Three blocks: THE
 * INVITE LINK (copy, rotate, uses), MEMBERS (who joined, as what, and
 * where each stands against the bill — share, what they fronted, what
 * they owe or are owed, paid — with the owner's hand marks: paid for
 * cash, settled once he has paid someone out), SETTINGS (how many ways
 * the total splits, and whether settle up is open to everyone). Owner
 * only in every environment: anyone else gets 404, the same answer as a
 * page that does not exist.
 */

export const metadata: Metadata = {
  title: "LASD26 — Team",
  description: "Invite link, members and settings.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Owner session + live tables — never static.
export const dynamic = "force-dynamic";

/** The PAID cell: when, how much, how — in either direction. */
function paidCell(r: MemberRow): string {
  if (r.paidAt) {
    const parts = [datePacific(r.paidAt), fmtUsd(r.paidCents)];
    if (r.paidVia) parts.push(`via ${r.paidVia}`);
    return parts.join(" · ");
  }
  if (r.settledAt) return `paid out ${datePacific(r.settledAt)}${r.settledCents !== null ? ` · ${fmtUsd(r.settledCents)}` : ""}`;
  return "—";
}

/** The OWES / OWED cell: the net in words, so the column reads at a glance. */
function netCell(r: MemberRow): { text: string; cls: string } {
  if (r.netCents > 0) return { text: `owes ${fmtUsd(r.netCents)}`, cls: "tm-owes" };
  if (r.netCents < 0) return { text: `owed ${fmtUsd(-r.netCents)}`, cls: "tm-owed" };
  return { text: "square", cls: "tm-dim" };
}

export default async function TeamPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (!viewer.owner) notFound();

  const h = headers();
  const origin = originFrom((k) => h.get(k));

  const [invite, roster, due] = await Promise.all([
    currentInvite().catch((err) => {
      console.error("lasd26/team: invite lookup failed", err);
      return null;
    }),
    listMembers().catch((err) => {
      console.error("lasd26/team: members failed", err);
      return [] as Member[];
    }),
    dueFor(),
  ]);

  const url = invite ? inviteUrl(origin, invite.token) : null;
  // The bill's rows carry the money; the roster carries the email and the
  // join time. Same ids, same order (both roster order).
  const byId = new Map(roster.map((m) => [m.id, m] as const));
  const rows = due.members.map((r) => ({ r, m: byId.get(r.memberId) ?? null }));
  const expenses = lasdPath("/expenses");

  return (
    <LasdPage viewer={viewer} active="team" extraCss={teamCss}>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The invite link</h2>
            <span className="mono">GROUP CHAT</span>
          </div>
          <p className="tm-lede">Send this to the group chat. They sign in with Google, pick runner or crew, and land on the expenses page.</p>
          <InviteLink url={url} uses={invite?.uses ?? 0} madeOn={invite ? datePacific(invite.createdAt) : null} />
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Members</h2>
            <span className="mono">
              {rows.length} JOINED · {due.paidCount} PAID
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="list-empty">NOBODY YET — SEND THE LINK.</p>
          ) : (
            <>
              <table className="pile tm-members">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="tm-hide-sm tm-amt">Share</th>
                    <th className="tm-hide-sm tm-amt">Fronted</th>
                    <th className="tm-amt">Owes / owed</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ r, m }) => {
                    const net = netCell(r);
                    return (
                      <tr key={r.memberId}>
                        <td>
                          {r.name}
                          <span className="tm-email">{m?.email ?? ""}</span>
                          <span className="tm-role">
                            {r.role}
                            {m ? ` · joined ${stampPacific(m.joinedAt)}` : ""}
                          </span>
                        </td>
                        <td className="tm-hide-sm tm-amt tm-dim">{fmtUsd(r.shareCents)}</td>
                        <td className="tm-hide-sm tm-amt">{r.frontedCents > 0 ? fmtUsd(r.frontedCents) : "—"}</td>
                        <td className={`tm-amt ${r.status === "paid" ? "tm-dim" : net.cls}`}>{net.text}</td>
                        <td className="tm-paid">
                          {paidCell(r)}
                          <br />
                          <PaidButton memberId={r.memberId} status={r.status} name={r.name} amount={fmtUsd(r.status === "owed" ? r.owedCents : r.outstandingCents)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* The two directions of the pool, so the owner knows what is still to come in and what he still sends out. */}
              <p className="tm-note">
                TO COLLECT <strong>{fmtUsd(due.toCollectCents)}</strong> · TO PAY OUT <strong>{fmtUsd(due.toPayOutCents)}</strong> · FRONTED SO FAR{" "}
                <strong>{fmtUsd(due.frontedCents)}</strong>
              </p>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Settings</h2>
            <span className="mono">THE SPLIT · SETTLE UP</span>
          </div>
          <SettingsForm splitCount={due.splitCount} settleOpen={due.settleOpen} memberCount={rows.length} />
          <div className="tm-card" style={{ borderTop: "none" }}>
            <div className="tm-share" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
              <div>
                <div className="k">Total so far</div>
                {/* The numbers are doors to the sheet (owner, 2026-10-16: "if you click on the number that is your share or the total it takes you to the expenses page"). */}
                <a className="v" href={expenses}>
                  {fmtUsd(due.totalCents, { whole: due.totalCents % 100 === 0 })}
                </a>
              </div>
              <div>
                <div className="k">Each, {due.splitCount} ways</div>
                <a className="v o" href={expenses}>
                  {fmtUsd(due.perPersonCents)}
                </a>
              </div>
            </div>
            {due.settleOpen ? (
              <p className="tm-note">Settling up is open: the real costs only, the estimates are out of the sum.</p>
            ) : due.estimatedCents > 0 ? (
              <p className="tm-note">
                {fmtUsd(due.estimatedCents, { whole: due.estimatedCents % 100 === 0 })} of that is still an estimate. Opening settle up swaps the estimates for the
                real costs.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">
            <a href={expenses}>EXPENSES →</a> · <a href={lasdPath("/the-list")}>THE LIST (CREW CALL) →</a>
          </p>
        </div>
      </footer>
    </LasdPage>
  );
}
