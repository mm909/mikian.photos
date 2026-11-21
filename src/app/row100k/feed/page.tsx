import type { Metadata } from "next";
import { END_MS, FIRST_DAY_TAG, LATE_LOGS_TAG, LOG_CLOSE_MS, MONTH_DAYS, START_MS, daysElapsed } from "@/lib/row100k";
import { barProps, resolveViewer } from "@/lib/row100kViewer";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { headCss } from "../headCss";
import { PageHead } from "../PageHead";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { Strips } from "./Strips";
import { buildFeed } from "./feedData";
import { eliteListHref } from "./view";

/* THE FEED — the strips (the owner's pick, 2026-09-05).
 * This page does every computation on the server — the rows, their
 * stamps, the photo media, the blackout masking, today's headline and the
 * day totals — and PageHead / Strips lay it out. Styles: the .fd- block in
 * theme.ts, the head's in headCss.ts. The head is the shared PageHead
 * since 2026-09-16 (owner: no bold THE FEED; the meters that landed today
 * in the front page odometer, six wheels here — remove the million and
 * ten million digits on the feed page — and variant A, picked for every
 * tab the same day). */

export const metadata: Metadata = {
  title: "The feed — Rowtember",
  description: "The live ticker — every row as it comes in, for the Rowtember challenge.",
};

export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

/* Page one is a bare /row100k/feed; older pages carry the cursor. */
function feedHref(beforeCursor: string | null): string {
  const q = new URLSearchParams();
  if (beforeCursor) q.set("before", beforeCursor);
  const s = q.toString();
  return s ? `/feed?${s}` : "/feed";
}

/* The dateline under THE FEED: today (Pacific) and where the month stands
 * — the front page's own wording — then the blackout line. */
function feedDateline(now: number, todayStr: string, eyebrow: string): string {
  const where =
    now < START_MS
      ? `FIRST STROKE ${FIRST_DAY_TAG}`
      : now >= LOG_CLOSE_MS
        ? "FINAL"
        : now >= END_MS
          ? `LATE LOGS THROUGH ${LATE_LOGS_TAG}`
          : `DAY ${daysElapsed(now)} OF ${MONTH_DAYS}`;
  return `${todayStr} · ${where} · ${eyebrow}`;
}

/* The rows and every figure on the page are computed in feedData.ts since
 * 2026-11-20, where the phone app's route reads them too. */
export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await resolveViewer();
  const beforeRaw = typeof searchParams.before === "string" ? searchParams.before : "";
  const { items, days, headline, eyebrow, sub, olderCursor, paged: before, now, todayStr } = await buildFeed(viewer, beforeRaw);
  const olderHref = olderCursor ? feedHref(olderCursor) : null;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{headCss}</style>

      <RowBar active="feed" {...barProps(viewer)} />

      <section className="fd-sec">
        <div className="wrap">
          {/* The ONE big blue number: meters that LANDED today, Pacific (by
           * createdAt, the day the stamps show — so it agrees with the
           * first day head; the front page's todayMeters goes by the rowed
           * `day`, so a row rowed last night and logged this morning counts
           * here today and there yesterday). Every rower's meters are in
           * the figure, THE ELITE's included (FeedHeadline in view.ts).
           * Six wheels, not eight: a day never needs the million and ten
           * million digits (owner, 2026-09-16). */}
          <PageHead
            name="The feed"
            dateline={feedDateline(now, todayStr, eyebrow)}
            meters={headline ? headline.meters : null}
            unit={
              <>
                Meters · <b>landed today</b>
              </>
            }
            sub={sub}
            digits={6}
          />

          {items.length === 0 ? (
            <p className="board-empty">NOTHING LOGGED YET — THE FEED STARTS WITH THE FIRST ROW.</p>
          ) : (
            /* THE ELITE mark links to the board's elite block for everyone
             * now that the board has no sign-in gate (2026-09-16). */
            <Strips items={items} days={days} eliteHref={eliteListHref()} />
          )}

          {(before || olderHref) && (
            <nav className="fd-pager" aria-label="Feed pages">
              {before ? <a href={feedHref(null)}>← NEWER</a> : <span className="fd-spacer" />}
              {olderHref ? <a href={olderHref}>OLDER →</a> : null}
            </nav>
          )}
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
