import type { Metadata, Viewport } from "next";
import { TEAM, ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { dueFor, memberDue, paidStamp, viaLabel } from "@/lib/lasd26/settle";
import { fmtUsd, wholeDollarsUp } from "@/lib/lasd26/money";
import { isPaymentsOpen } from "@/lib/paymentLock";
import type { CourseFile } from "../route/course";
import courseJson from "../../../../public/lasd26/route/course.json";
import { BareFrame } from "./BareFrame";
import { routeArt } from "./routeArt";
import { Steps, type Gate } from "./Steps";
import { ViewAs } from "./ViewAs";

/**
 * YOUR SHARE — pay what you're able, step by step (lasdPath("/your-share")).
 * The soft version of Settle up (owner, 2026-10-28: "a 'pay as your able'
 * experience … if someone is only able to pay $100 then I want to only
 * take that 100"; 2026-10-29: "make it a step by step screen … first
 * screen says 'Thank you for opting in', w/ a continue button … the route
 * being drawn in the background … the justfriends. and noshortcuts logo at
 * the top … I like LASD26 being the footer for this page. users need to be
 * able to log in but dont need any of the normal headers or footers … Next
 * screen should be a 'LASD26 is a pay what you're able to experience' …
 * mention the total cost, number of splits, and their share … Next screen
 * should where they enter the payment amount, then the next is the payment
 * processing … I only want one big number on the screen").
 *
 * LIVE BUT UNLISTED (owner, 2026-10-29: "Make it 'live' but only if I send
 * the link to someone"): no dev gate — any signed-in member sees their
 * share here once settling up is open — but nothing links to it except
 * the owner's DEVELOPMENT group in the account menu, and robots stay off.
 * The old address, /lasd26/dev/pay, redirects here.
 *
 * BARE (BareFrame.tsx): no LasdPage, no bar, no site footer. Ink, lime
 * type, the two marks and SIGN IN at the top, the screens (Steps.tsx),
 * LASD26 as the foot and nothing under it (owner, 2026-10-29: "Show me the
 * text at the bottom like it's live") — except the owner's own tools
 * (ViewAs.tsx). The course (public/lasd26/route/course.json) is projected
 * once here (routeArt.ts) and drawn behind the first screen in one stroke.
 *
 * The numbers are settle.ts's: the total, the split, each share, what this
 * member fronted, and the share less that — the big number and the field's
 * ceiling, rounded UP to the whole dollar (money.ts wholeDollarsUp; owner,
 * 2026-10-29: "make sure the dollar total rounded"); the route
 * /api/lasd26/your-share rounds the same way, charges the figure in the
 * field and nothing else, marks the row PAID at whatever it was, and
 * emails the owner.
 *
 * WHAT THEY ALREADY COVERED (owner, 2026-10-29: "some have used their own
 * card to buy things during the race. we need a note about what they have
 * already contributed and subtract that from their share"): the lines a
 * member fronted (settle.ts MemberRow.fronted) go down to the share screen,
 * which names them and shows the share less that sum.
 *
 * THE POOL ON THIS PAGE (owner, 2026-10-29, on his own screen: "I don't see
 * my expenses that I paid being taken out of this"): the owner's row is
 * the pool and settle.ts never has it owe or be owed, but HERE his share
 * reads like anyone's — the share less what he fronted, the note listing
 * it, and when that is more than the share, "nothing to pay" (gate
 * "covered"). Two owner-only tools sit under the foot (ViewAs.tsx):
 * VIEW AS a runner (?as=<member id>: their numbers and note, read-only,
 * no card button) and TEST A PAYMENT ON YOURSELF (?test=1: the whole share
 * with nothing taken off, charged to his own PayPal, recorded nowhere —
 * owner, 2026-10-29: "Allow me to submit payment to my self to test it
 * live"; lib/lasd26/yourShare.ts).
 */

export const metadata: Metadata = {
  title: "Your share — LASD26",
  description: "Your share of the crossing, as you're able.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111110",
};

// Session-gated and the sheet moves — never render statically.
export const dynamic = "force-dynamic";

const course = courseJson as unknown as Pick<CourseFile, "bbox" | "coords" | "drives">;

export default async function YourSharePage({ searchParams }: { searchParams?: { as?: string; test?: string } }) {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  const art = routeArt(course);

  // Where this viewer stands, and the numbers for the screens.
  let gate: Gate = "ok";
  let totalCents = 0;
  let splitCount = 0;
  let perPersonCents = 0;
  let frontedCents = 0;
  let fronted: { title: string; amountCents: number }[] = [];
  let shareCents = 0;
  let owedCents = 0;
  let paid: { amount: string; stamp: string; via: string } | null = null;
  let viewingAs: string | null = null;
  let asId: string | null = null;
  let testing = false;
  let roster: { id: string; name: string }[] = [];

  if (!viewer.actor) gate = "signin";
  else if (!viewer.onTeam || !viewer.member) gate = "join";
  else {
    const due = await dueFor(TEAM);
    splitCount = due.splitCount;
    totalCents = due.totalCents;

    // VIEW AS and TEST, the owner's alone (see the header).
    const wanted = viewer.owner && typeof searchParams?.as === "string" ? searchParams.as : null;
    const asRow = wanted ? due.members.find((r) => r.memberId === wanted) : undefined;
    const mine = asRow ?? memberDue(viewer.member, due);
    if (asRow && asRow.memberId !== viewer.member.id) {
      viewingAs = asRow.name;
      asId = asRow.memberId;
    }
    testing = viewer.owner && !viewingAs && searchParams?.test === "1";
    if (viewer.owner) roster = due.members.filter((r) => !r.pool).map((r) => ({ id: r.memberId, name: r.name }));

    perPersonCents = wholeDollarsUp(mine.shareCents);
    frontedCents = mine.frontedCents;
    fronted = mine.fronted.map((l) => ({ title: l.title, amountCents: l.amountCents }));

    if (!due.settleOpen && !viewer.owner) gate = "closed";
    else if (testing) {
      // The owner paying himself: the whole share, nothing taken off.
      frontedCents = 0;
      fronted = [];
      shareCents = perPersonCents;
    } else if (mine.pool) {
      // The pool, read like anyone's row: the share less what he fronted.
      if (mine.netCents <= 0) gate = "covered";
      else shareCents = wholeDollarsUp(mine.netCents);
    } else if (mine.status === "paid" && mine.paidAt) {
      gate = "paid";
      paid = { amount: fmtUsd(mine.paidCents), stamp: paidStamp(mine.paidAt), via: viaLabel(mine.paidVia) };
    } else if (mine.status === "owed") {
      gate = "owed";
      owedCents = mine.owedCents;
    } else if (mine.status === "square") gate = "square";
    else if (!isPaymentsOpen() && !viewer.owner) gate = "paused";
    else shareCents = wholeDollarsUp(mine.outstandingCents);
  }

  const tools = viewer.owner && viewer.member ? <ViewAs roster={roster} current={asId} testing={testing} /> : null;

  return (
    <BareFrame name={viewer.actor ? (viewer.member?.name ?? viewer.actor.name) : null} tools={tools}>
      <Steps
        gate={gate}
        totalCents={totalCents}
        splitCount={splitCount}
        perPersonCents={perPersonCents}
        frontedCents={frontedCents}
        fronted={fronted}
        shareCents={shareCents}
        owedCents={owedCents}
        paid={paid}
        stampToday={paidStamp(new Date())}
        art={art}
        viewingAs={viewingAs}
        testing={testing}
      />
    </BareFrame>
  );
}
