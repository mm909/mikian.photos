import type { Metadata, Viewport } from "next";
import { TEAM } from "@/lib/lasd26/team";
import { devTitle, gateLasdDev } from "@/lib/lasd26/devGate";
import { dueFor, memberDue, paidStamp, viaLabel } from "@/lib/lasd26/settle";
import { fmtUsd, wholeDollarsUp } from "@/lib/lasd26/money";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { archivo, archivoBlack, spaceMono } from "../../theme";
import type { CourseFile } from "../../route/course";
import courseJson from "../../../../../public/lasd26/route/course.json";
import { payAbleCss } from "../../payAbleCss";
import { Account } from "./Account";
import { routeArt } from "./routeArt";
import { Steps, type Gate } from "./Steps";

/**
 * PAY WHAT YOU'RE ABLE, step by step (lasdPath("/dev/pay")) — the mock-up
 * of the soft version of Settle up (owner, 2026-10-28: "a 'pay as your
 * able' experience … if someone is only able to pay $100 then I want to
 * only take that 100"; 2026-10-29: "make it a step by step screen … first
 * screen says 'Thank you for opting in', w/ a continue button … the route
 * being drawn in the background … the justfriends. and noshortcuts logo at
 * the top … I like LASD26 being the footer for this page. users need to be
 * able to log in but dont need any of the normal headers or footers … Next
 * screen should be a 'LASD26 is a pay what you're able to experience' …
 * mention the total cost, number of splits, and their share … Next screen
 * should where they enter the payment amount, then the next is the payment
 * processing … I only want one big number on the screen").
 *
 * BARE: no LasdPage, no bar, no site footer. Ink, lime type. The two marks
 * at the top (type, like the stickers: NO SHORTCUTS with the red arrow ×
 * justfriends. with the lime dot) and SIGN IN / the first name; the screens
 * (Steps.tsx); LASD26 as the foot. The course (public/lasd26/route/
 * course.json) is projected once here (routeArt.ts) and drawn behind the
 * first screen.
 *
 * The numbers are settle.ts's: the total, the split, each share, what this
 * member fronted, and the share less that — the big number and the field's
 * ceiling, rounded UP to the whole dollar (money.ts wholeDollarsUp; owner,
 * 2026-10-29: "make sure the dollar total rounded"); the route rounds the
 * same way. The route /api/lasd26/dev/pay charges the figure in the field
 * and nothing else; the row is then PAID at whatever it was, no chasing.
 *
 * IN DEVELOPMENT (CLAUDE.md): admin-only in production through
 * gateLasdDev, "(dev)" in the title, noindex, linked only from the
 * DEVELOPMENT group of the account menu. When the owner says it goes live
 * this page replaces src/app/lasd26/pay and its route replaces
 * /api/lasd26/pay/paypal; the gate, the tag and the menu link go.
 *
 * THE STAND-IN NUMBERS: the owner's own row is the pool and never owes, so
 * for him the share is $475 (his "~$475"), the total is that times the
 * split, and the button simulates. A member sees the real numbers and the
 * real card button. The owner's one line under the foot says so.
 */

const MOCK_SHARE_CENTS = 47500;

export const metadata: Metadata = {
  title: devTitle("Pay what you're able — LASD26"),
  description: "Your share of the crossing, as you're able.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111110",
};

// Session-gated and the sheet moves — never render statically.
export const dynamic = "force-dynamic";

const course = courseJson as unknown as Pick<CourseFile, "bbox" | "coords" | "drives">;

export default async function PayAblePage() {
  const viewer = await gateLasdDev();
  const art = routeArt(course);

  // Where this viewer stands, and the numbers for the screens.
  let gate: Gate = "ok";
  let totalCents = 0;
  let splitCount = 0;
  let perPersonCents = 0;
  let frontedCents = 0;
  let shareCents = 0;
  let owedCents = 0;
  let paid: { amount: string; stamp: string; via: string } | null = null;
  let standIn = false;
  let sheetShare = 0;
  let settleOpen = false;

  if (!viewer.actor) gate = "signin";
  else if (!viewer.onTeam || !viewer.member) gate = "join";
  else {
    const due = await dueFor(TEAM);
    settleOpen = due.settleOpen;
    const mine = memberDue(viewer.member, due);
    splitCount = due.splitCount;
    sheetShare = mine.shareCents;
    if (!due.settleOpen && !viewer.owner) gate = "closed";
    else if (mine.status === "pool") {
      // The stand-in, see the header.
      standIn = true;
      shareCents = MOCK_SHARE_CENTS;
      perPersonCents = MOCK_SHARE_CENTS;
      totalCents = MOCK_SHARE_CENTS * Math.max(1, splitCount);
    } else if (mine.status === "paid" && mine.paidAt) {
      gate = "paid";
      paid = { amount: fmtUsd(mine.paidCents), stamp: paidStamp(mine.paidAt), via: viaLabel(mine.paidVia) };
    } else if (mine.status === "owed") {
      gate = "owed";
      owedCents = mine.owedCents;
    } else if (mine.status === "square") gate = "square";
    else if (!isPaymentsOpen() && !viewer.owner) gate = "paused";
    else {
      totalCents = due.totalCents;
      perPersonCents = wholeDollarsUp(mine.shareCents);
      frontedCents = mine.frontedCents;
      shareCents = wholeDollarsUp(mine.outstandingCents);
    }
  }

  return (
    <div className={`lasd-pay ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: payAbleCss }} />

      <header className="top">
        <div className="marks" aria-label="No Shortcuts × Just Friends LV">
          <span className="ns">
            No Shortcuts <span className="arrow">→</span>
          </span>
          <span className="x">×</span>
          <span className="jf">
            justfriends
            <i className="dot" />
          </span>
        </div>
        <Account name={viewer.actor ? (viewer.member?.name ?? viewer.actor.name) : null} />
      </header>

      <Steps
        gate={gate}
        standIn={standIn}
        totalCents={totalCents}
        splitCount={splitCount}
        perPersonCents={perPersonCents}
        frontedCents={frontedCents}
        shareCents={shareCents}
        owedCents={owedCents}
        paid={paid}
        stampToday={paidStamp(new Date())}
        art={art}
      />

      <footer className="foot">
        <span className="wm">LASD26</span>
        {viewer.owner && (
          <p className="owner mono">
            Mock-up of Settle up
            {standIn
              ? ` · you're the pool, so ${fmtUsd(MOCK_SHARE_CENTS, { whole: true })} is a stand-in (the sheet says ${fmtUsd(sheetShare)}) and the button simulates — nothing is charged`
              : ""}
            {settleOpen ? "" : " · a member sees it once you open settling up (Team → settings)"}
          </p>
        )}
      </footer>
    </div>
  );
}
