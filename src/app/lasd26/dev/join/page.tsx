import type { Metadata, Viewport } from "next";
import { inviteByToken } from "@/lib/lasd26/team";
import { gateLasdDev } from "@/lib/lasd26/devGate";
import { lasdPath } from "@/lib/lasd26/paths";
import { LasdPage } from "../LasdPage";
import { teamCss } from "../teamCss";
import { ChangeRole, JoinForm, SignInToJoin } from "./JoinClient";

/**
 * JOIN, the dev copy: lasdPath("/join")?t=<token> = /lasd26/dev/join?t=…
 * (lib/lasd26/paths.ts) — the link the owner drops in the group chat
 * (owner, 2026-10-15: "they'll have to sign in with their Google accounts
 * and then join the team … only accessible by an invite link").
 *
 * WHILE THE DEV GATE IS ON (lib/lasd26/devGate.ts): in production this
 * page answers 404 to anyone but the owner, so the invite link works for
 * him alone and the crew CANNOT join yet — joining stays untestable by
 * others until the owner says the site goes live and the gate lifts. On a
 * laptop it is open and any account can walk the four states.
 *
 * Four states, decided here on the server:
 *   1. no token / dead token → "not valid", and nothing else. The link is
 *      the only key to the team pages, so a bad one learns nothing.
 *   2. signed out → sign in with Google, back to this exact URL.
 *   3. already a member → "you're on the team as …", expenses, change role.
 *   4. the join form → POST /api/lasd26/team/join → the expenses page.
 */

export const metadata: Metadata = {
  title: "LASD26 — Join the crew (dev)",
  description: "Sign in and join the LASD26 team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session + invite lookups on every hit — never static.
export const dynamic = "force-dynamic";

function tokenFrom(searchParams: { t?: string | string[] } | undefined): string {
  const raw = searchParams?.t;
  const t = Array.isArray(raw) ? raw[0] : raw;
  return typeof t === "string" ? t.trim() : "";
}

export default async function JoinPage({ searchParams }: { searchParams?: { t?: string | string[] } }) {
  const viewer = await gateLasdDev();
  const token = tokenFrom(searchParams);

  let invite: { id: string } | null = null;
  if (token) {
    try {
      invite = await inviteByToken(token);
    } catch (err) {
      console.error("lasd26/join: invite lookup failed", err);
    }
  }

  if (!invite) {
    return (
      <LasdPage viewer={viewer} active="join" extraCss={teamCss}>
        <section>
          <div className="wrap">
            <div className="jn-bad">
              <strong>This link is not valid.</strong>
              Ask for a fresh one in the group chat.
            </div>
            {viewer.onTeam && (
              <div className="tm-actions">
                <a className="tm-btn fill" href={lasdPath("/expenses")}>
                  You&rsquo;re already on the team — expenses →
                </a>
              </div>
            )}
          </div>
        </section>
      </LasdPage>
    );
  }

  const member = viewer.member;
  const actor = viewer.actor;

  return (
    <LasdPage viewer={viewer} active="join" extraCss={teamCss}>
      <header className="jn-hero">
        <div className="wrap" style={{ padding: 0 }}>
          <h1>
            Join the
            <br />
            crew<span className="o">.</span>
          </h1>
          <p className="sub">
            <strong>LASD26</strong> — the No Shortcuts Time Trial, Santa Monica to San Diego, Fri 10.23. One team page for the roster, the
            costs and the receipts, so nobody chases anybody.
          </p>
          {/* No mark beside the line (owner, 2026-10-16: "remove the JF logo
           * here" on the landing's twin of this line). */}
          <div className="jn-brand" aria-hidden>
            <span className="x">JUST FRIENDS LV × NO SHORTCUTS</span>
          </div>
        </div>
      </header>

      {!actor ? (
        <section>
          <div className="wrap">
            <div className="sec-head">
              <h2>Sign in to join</h2>
              <span className="mono">GOOGLE · 10 SECONDS</span>
            </div>
            <p className="tm-lede">Sign in with the Google account you use for email. We only keep your name and address to put you on the roster.</p>
            <SignInToJoin token={token} />
          </div>
        </section>
      ) : member ? (
        <section>
          <div className="wrap">
            <div className="jn-state">
              <div className="k">You&rsquo;re on the team as</div>
              <div className="v">
                {member.name}
                <span className="o"> · {member.role}</span>
              </div>
              <p>{member.role === "crew" ? "Not running — helping, and submitting costs." : "On the roster. Costs and receipts are on the expenses page."}</p>
              <ChangeRole token={token} current={member.role} name={member.name} />
            </div>
          </div>
        </section>
      ) : (
        <div className="form-sec">
          <div className="wrap">
            <div className="sec-head">
              <h2>Put yourself on</h2>
              <span className="mono">RUNNER OR CREW</span>
            </div>
            <JoinForm token={token} defaultName={actor.name} email={actor.email} />
          </div>
        </div>
      )}

      <footer>
        <div className="wrap" style={{ padding: 0 }}>
          <p className="mono">for yourself and others</p>
        </div>
      </footer>
    </LasdPage>
  );
}
