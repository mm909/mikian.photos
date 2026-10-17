import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { listInfoItems } from "@/lib/lasd26/info";
import { LasdFooter } from "../LasdFooter";
import { LasdPage } from "../LasdPage";
import { infoCss } from "../infoCss";
import { InfoInvite, InfoSheet, InfoSignIn, type WireItem } from "./InfoSheet";

/**
 * THE INFO SHEET (lasdPath("/info") = /lasd26/info; lib/lasd26/paths.ts)
 * — owner, 2026-10-16: "make a info page where we can fill out addresses
 * for airbnb, start line, van pick up etc. if you already know any of that
 * please fill it in. I can give the rest. What other info would the
 * runners need."
 *
 * One page the crew opens in the van: the race, the day, the start line,
 * the vans, the pairs, the Airbnb, the hotel rooms, who to call — a mono
 * eyebrow over each value, in the 720 px wrap. The built-in lines and
 * their text are lib/lasd26/infoSheet.ts (seeded on first read, brought in
 * line by lib/lasd26/info.ts); the values are the owner's — the notes he
 * sent on 2026-10-16, written by scripts/lasd26-info-fill.ts, and whatever
 * he types here through the EDIT pencil. Since the night of 2026-10-16
 * ("Allow me to add / remove notes on the info page") he also ADDS his own
 * lines — notes, key "n-…", after the built-in ones — and REMOVES any line,
 * built-in or note (a removed line is kept in the table with removedAt
 * set, so it never comes back); the page hands the lines through as they
 * are and the client tells a note by its key. Members read. The foot is
 * the shared LasdFooter (owner: "update the footer with my full footer,
 * like all the other pages").
 *
 * LIVE since 2026-10-16 (owner, that night: "Make the info page live"):
 * the dev gate is gone — getTeamViewer()/ensureOwnerMember() like the
 * expenses page, so a visitor who is signed out sees the sign-in notice,
 * one who is signed in but not on the team sees the invite notice, and
 * the sheet renders for a member (the owner counts, and gets his member
 * row made on the way in so his edits carry his id). The doors are INFO
 * in the bar (LasdBar.tsx) and "Info sheet →" in the account menu
 * (LasdAccount.tsx). Still noindex: it is the team's, not the public's.
 */

export const metadata: Metadata = {
  title: "LASD26 — Info sheet",
  description: "The sheet for the weekend — addresses, times, who to call.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated, live values — never render statically.
export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());

  let body: ReactNode;
  let eyebrow: string;
  if (!viewer.actor) {
    body = <InfoSignIn />;
    eyebrow = "TEAM ONLY";
  } else if (!viewer.onTeam) {
    body = <InfoInvite />;
    eyebrow = "TEAM ONLY";
  } else {
    let items: WireItem[] = [];
    try {
      // The lines as the lib gives them (live rows only, in order); the key
      // says which are the owner's notes ("n-…"), so nothing is added here.
      items = (await listInfoItems()).map((it) => ({ key: it.key, label: it.label, value: it.value, hint: it.hint }));
    } catch (err) {
      // The table is not pushed yet: an empty sheet, not a crash.
      console.error("lasd26/info: list failed (table pushed?)", err);
    }
    const filled = items.filter((it) => it.value.trim() !== "").length;
    // An empty sheet still renders the sheet: the owner's "+ ADD A NOTE" is on it.
    body = <InfoSheet items={items} canEdit={viewer.owner} />;
    eyebrow = `${filled} OF ${items.length} FILLED IN`;
  }

  return (
    <LasdPage viewer={viewer} active="info" extraCss={infoCss}>
      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>Info sheet</h2>
            <span className="mono">{eyebrow}</span>
          </div>
          <p className="if-lede">The sheet for the weekend — addresses, times, who to call.</p>
          {body}
        </div>
      </section>

      <LasdFooter />
    </LasdPage>
  );
}
