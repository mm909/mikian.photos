import type { FeedHeadline } from "./view";

/* The top of the feed: THE FEED as a nameplate over a hairline (the
 * profile's .pf-name, one voice across the site), the dateline — today,
 * where the month stands, and the blackout line — then the ONE big blue
 * number: meters that LANDED today, Pacific (by createdAt, the day the
 * stamps show — so it agrees with the first day head; the front page's
 * todayMeters goes by the rowed `day`, so a row rowed last night and
 * logged this morning counts here today and there yesterday), with a mono
 * descriptor of the rows and rowers behind it. Every rower's meters are in
 * the figure, THE ELITE's included (FeedHeadline in view.ts).
 * Server component, no hooks. */
export function FeedHead({ headline, dateline }: { headline: FeedHeadline | null; dateline: string }) {
  return (
    <>
      <div className="fd-head">
        <h1 className="fd-name">The feed</h1>
        <p className="fd-date mono">{dateline}</p>
      </div>
      <div className="fd-big">
        <div className="bhead-n">{headline ? headline.meters.toLocaleString("en-US") : "—"}</div>
        <p className="bhead-l mono">
          Meters ·{" "}
          <b>
            {!headline
              ? "today could not be read"
              : headline.rows === 0
                ? "nothing landed today yet"
                : `${headline.rows} ${headline.rows === 1 ? "row" : "rows"} · ${headline.rowers} ${
                    headline.rowers === 1 ? "rower" : "rowers"
                  } today`}
          </b>
        </p>
      </div>
    </>
  );
}
