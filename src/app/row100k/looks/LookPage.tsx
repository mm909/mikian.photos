import type { ReactNode } from "react";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { looksCss } from "./looksCss";
import { loadLook } from "./looksData";
import { FriendsBoard } from "./FriendsBoard";
import { LookSwitcher, MeHead } from "./MeHead";
import { MovedToday } from "./MovedToday";
import { RecordCard } from "./pieces";
import { Stream } from "./Stream";
import { Wall } from "./Wall";
import type { LookKey, LookPayload } from "./view";

/* THE LANDING AS A SOCIAL FEED — five looks (owner, 2026-09-25: "the
 * landing page could be a social feed, like Strava … a few of my stats, a
 * button to LOG A ROW, and then the main real estate is the status updates
 * from the friends I follow"). Rendered by /row100k in place of the counter
 * page when ?look=a..e is in the URL and the viewer is a joined rower;
 * every look is a complete page in the house language: the bar, the look
 * switcher, the me head with LOG A ROW and the in-place form, then the
 * look's own idea, then the footer on the front measure.
 *   a  the stream — a scrolling feed of followed rowers' rows
 *   b  the friends board — standings for followed rowers only
 *   c  moved today — the summary table, the records, then the feed
 *   d  two columns — the stream beside the friends board
 *   e  the photo wall — the pictures, the cards behind a tap
 * The following set is the stand-in in following.ts until follows exist. */

function Body({ d }: { d: LookPayload }) {
  const stream = (title: ReactNode, cards = true) => (
    <Stream
      rows={d.rows}
      records={d.records}
      monthLabel={d.monthLabel}
      eliteHref={d.eliteHref}
      feedHref={d.feedHref}
      capped={d.rowsCapped}
      title={title}
      aside={<span>{d.friends.length} followed</span>}
      cards={cards}
    />
  );
  switch (d.look) {
    case "a":
      return stream(<>The stream · {d.monthLabel}</>);
    case "b":
      return <FriendsBoard friends={d.friends} rows={d.rows} boardHref={d.boardHref} todayStr={d.todayStr} />;
    case "c":
      return (
        <>
          <MovedToday friends={d.friends} todayStr={d.todayStr} />
          <div className="lk-gap">
            <RecordCard records={d.records} monthLabel={d.monthLabel} />
          </div>
          <div className="lk-gap">{stream(<>The stream · {d.monthLabel}</>, false)}</div>
        </>
      );
    case "d":
      return (
        <div className="lk-two">
          {stream(<>The stream · {d.monthLabel}</>)}
          <FriendsBoard friends={d.friends} rows={d.rows} boardHref={d.boardHref} todayStr={d.todayStr} compact />
        </div>
      );
    case "e":
      return (
        <>
          <Wall rows={d.rows} eliteHref={d.eliteHref} todayStr={d.todayStr} />
          <div className="lk-gap">{stream(<>The rows · {d.monthLabel}</>)}</div>
        </>
      );
  }
}

export async function LookPage({
  look,
  me,
  myMonth,
  view,
  isAdmin,
  previewOn,
  bar,
  form,
}: {
  look: LookKey;
  me: { id: string; rowerNumber: number; displayName: string };
  myMonth: { meters: number; seconds: number; sessions: number };
  view: { viewerParticipantId: string | null; admin: boolean; forceBlackout: boolean };
  isAdmin: boolean;
  previewOn: boolean;
  bar: { signedIn: boolean; rowerNumber: number | null; admin: boolean };
  /* The in-place log form (LogInPlace, bare), built by the page with the
   * share payload it already computes; LOG A ROW in the head toggles it. */
  form: ReactNode;
}) {
  const d = await loadLook({ look, me, myMonth, view, isAdmin, previewOn });
  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{looksCss}</style>

      <RowBar active="home" {...bar} />

      <div className="wrap front">
        <LookSwitcher look={look} />
        <MeHead me={d.me} monthLabel={d.monthLabel} form={form} />
        <div className="lk-body">
          <Body d={d} />
        </div>
      </div>

      <RowFooter front />
    </div>
  );
}
