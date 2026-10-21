import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { LasdFooter } from "../LasdFooter";
import { LasdPage } from "../LasdPage";
import { stickersCss } from "../stickersCss";
import { StickersInvite, StickersSignIn } from "./StickersNotice";
import { StickersPanel } from "./StickersPanel";

/**
 * THE STICKERS (lasdPath("/stickers") = /lasd26/stickers; owner,
 * 2026-10-21: "I need to generate a bunch of stickers for Just Friends and
 * No Shortcuts and a combo of the 2 lets start w/ stand alone then lets
 * generate some combined and then lets make others like a shareable of the
 * route and maybe a few others"). Three families of cards, each in four
 * looks, at sticker / story / post sizes, painted on a canvas in the
 * browser (StickersPanel.tsx, paint.ts) and shared from the phone.
 *
 * LIVE FOR THE TEAM the same day (owner: "We can make stickers viewable
 * as a link on the profile menu"): no dev gate — getTeamViewer() /
 * ensureOwnerMember() like the info sheet, so a visitor who is signed out
 * sees the sign-in notice, one who is signed in but not on the team sees
 * the invite notice, and a member gets the cards. The one door is
 * "Stickers →" in the account menu's team group (LasdAccount.tsx); nothing
 * in the bar. Noindex: the crew's, not the public's.
 */

export const metadata: Metadata = {
  title: "LASD26 — Stickers",
  description: "Stickers for Just Friends, No Shortcuts and the two together.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#F4F3EE",
};

export const dynamic = "force-dynamic";

export default async function StickersPage() {
  const viewer = await ensureOwnerMember(await getTeamViewer());

  let body: ReactNode;
  let eyebrow: string;
  if (!viewer.actor) {
    body = <StickersSignIn />;
    eyebrow = "TEAM ONLY";
  } else if (!viewer.onTeam) {
    body = <StickersInvite />;
    eyebrow = "TEAM ONLY";
  } else {
    body = <StickersPanel />;
    eyebrow = "JUST FRIENDS · NO SHORTCUTS · BOTH";
  }

  return (
    <LasdPage viewer={viewer} active="none" extraCss={stickersCss}>
      <section className="st-top">
        <div className="wrap">
          <div className="sec-head">
            <h2>Stickers</h2>
            <span className="mono">{eyebrow}</span>
          </div>
          {body}
        </div>
      </section>
      <LasdFooter />
    </LasdPage>
  );
}
