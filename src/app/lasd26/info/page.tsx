import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { devTitle, gateLasdDev } from "@/lib/lasd26/devGate";
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
 * runners need. Again put it behind a dev gate for now."
 *
 * One page the crew opens in the van: the race, the day, the start line,
 * the vans, the pairs, the Airbnb, the hotel rooms, who to call — a mono
 * eyebrow over each value, in the 720 px wrap. The list and the text are
 * lib/lasd26/infoSheet.ts (seeded on first read, brought in line by
 * lib/lasd26/info.ts); the values are the owner's — the notes he sent on
 * 2026-10-16, written by scripts/lasd26-info-fill.ts, and whatever he types
 * here through the EDIT pencil. Members read. The foot is the shared
 * LasdFooter (owner: "update the footer with my full footer, like all the
 * other pages").
 *
 * IN DEVELOPMENT (CLAUDE.md): gateLasdDev() — admin-only in production,
 * open on a laptop; "(dev)" in the title; noindex; the only door is the
 * DEVELOPMENT group of the account menu (LasdAccount.tsx). When the owner
 * says it is live: getTeamViewer()/ensureOwnerMember() instead of the
 * gate, the "(dev)" tag off, the link moved up, and the production check
 * off GET /api/lasd26/info.
 */

export const metadata: Metadata = {
  title: `LASD26 — ${devTitle("Info sheet")}`,
  description: "The sheet for the weekend — addresses, times, who to call.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

// Session-gated, live values — never render statically.
export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const viewer = await gateLasdDev();

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
      items = (await listInfoItems()).map((it) => ({ key: it.key, label: it.label, value: it.value, hint: it.hint }));
    } catch (err) {
      // The table is not pushed yet: an empty sheet, not a crash.
      console.error("lasd26/info: list failed (table pushed?)", err);
    }
    const filled = items.filter((it) => it.value.trim() !== "").length;
    body = items.length === 0 ? <p className="list-empty">NOTHING ON THE SHEET YET.</p> : <InfoSheet items={items} canEdit={viewer.owner} />;
    eyebrow = `${filled} OF ${items.length} FILLED IN`;
  }

  return (
    <LasdPage viewer={viewer} active="none" extraCss={infoCss}>
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
