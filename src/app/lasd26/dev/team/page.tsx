import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentInvite, getSettings, inviteUrl, listMembers, type Member } from "@/lib/lasd26/team";
import { gateLasdDev } from "@/lib/lasd26/devGate";
import { lasdPath } from "@/lib/lasd26/paths";
import { fmtUsd, perPersonCents, totalCents } from "@/lib/lasd26/money";
import { LasdPage } from "../LasdPage";
import { teamCss } from "../teamCss";
import { datePacific, originFrom, stampPacific } from "./fmt";
import { InviteLink } from "./InviteLink";
import { PaidButton } from "./PaidButton";
import { SettingsForm } from "./SettingsForm";

/**
 * TEAM, the dev copy (lasdPath("/team") = /lasd26/dev/team;
 * lib/lasd26/paths.ts) — the owner's console (owner, 2026-10-15: "a link
 * for me to send out"). Three blocks: THE INVITE LINK (copy, rotate,
 * uses), MEMBERS (who joined, as what, when, and whether they have paid —
 * with a hand "mark paid" for cash), SETTINGS (how many ways the total
 * splits, and whether settle up is open to everyone). Owner only in every
 * environment, over and above the dev gate: anyone else gets 404, the same
 * answer as a page that does not exist.
 */

export const metadata: Metadata = {
  title: "LASD26 — Team (dev)",
  description: "Invite link, members and settings.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Owner session + live tables — never static.
export const dynamic = "force-dynamic";

function paidCell(m: Member): string {
  if (!m.paidAt) return "—";
  const parts = [datePacific(m.paidAt)];
  if (m.paidCents !== null) parts.push(fmtUsd(m.paidCents));
  if (m.paidVia) parts.push(`via ${m.paidVia}`);
  return parts.join(" · ");
}

/** The running total from the expenses table — read-only here, best effort. */
async function expenseTotal(): Promise<{ total: number; estimated: number } | null> {
  try {
    const rows = await db.teamExpense.findMany({
      where: { team: "lasd26", deletedAt: null },
      select: { amountCents: true, estimate: true, deletedAt: true },
    });
    if (rows.length === 0) return null;
    const t = totalCents(rows);
    return { total: t.total, estimated: t.estimated };
  } catch (err) {
    console.error("lasd26/team: expense total failed (table pushed?)", err);
    return null;
  }
}

export default async function TeamPage() {
  const viewer = await gateLasdDev();
  if (!viewer.owner) notFound();

  const h = headers();
  const origin = originFrom((k) => h.get(k));

  const [invite, members, settings, money] = await Promise.all([
    currentInvite().catch((err) => {
      console.error("lasd26/team: invite lookup failed", err);
      return null;
    }),
    listMembers().catch((err) => {
      console.error("lasd26/team: members failed", err);
      return [] as Member[];
    }),
    getSettings(),
    expenseTotal(),
  ]);

  const url = invite ? inviteUrl(origin, invite.token) : null;
  const paidCount = members.filter((m) => m.paidAt !== null).length;
  const share = money ? perPersonCents(money.total, settings.splitCount) : null;

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
              {members.length} JOINED · {paidCount} PAID
            </span>
          </div>
          {members.length === 0 ? (
            <p className="list-empty">NOBODY YET — SEND THE LINK.</p>
          ) : (
            <table className="pile">
              <thead>
                <tr>
                  <th className="tm-hide-sm">#</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="tm-hide-sm">Joined</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id}>
                    <td className="tm-hide-sm tm-dim">{i + 1}</td>
                    <td>
                      {m.name}
                      <span className="tm-email">{m.email}</span>
                    </td>
                    <td className="tm-role">{m.role}</td>
                    <td className="tm-hide-sm tm-dim">{stampPacific(m.joinedAt)}</td>
                    <td className="tm-paid">
                      {paidCell(m)}
                      <br />
                      <PaidButton memberId={m.id} paid={m.paidAt !== null} name={m.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Settings</h2>
            <span className="mono">THE SPLIT · SETTLE UP</span>
          </div>
          <SettingsForm splitCount={settings.splitCount} settleOpen={settings.settleOpen} memberCount={members.length} />
          {money && share !== null && (
            <div className="tm-card" style={{ borderTop: "none" }}>
              <div className="tm-share" style={{ borderTop: "none", marginTop: 0, paddingTop: 0 }}>
                <div>
                  <div className="k">Total so far</div>
                  <div className="v">{fmtUsd(money.total, { whole: money.total % 100 === 0 })}</div>
                </div>
                <div>
                  <div className="k">Each, {settings.splitCount} ways</div>
                  <div className="v o">{fmtUsd(share)}</div>
                </div>
              </div>
              {money.estimated > 0 && <p className="tm-note">{fmtUsd(money.estimated, { whole: money.estimated % 100 === 0 })} of that is still an estimate.</p>}
            </div>
          )}
        </div>
      </section>

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">
            <a href={lasdPath("/expenses")}>EXPENSES →</a> · <a href={lasdPath("/the-list")}>THE LIST (CREW CALL) →</a>
          </p>
        </div>
      </footer>
    </LasdPage>
  );
}
