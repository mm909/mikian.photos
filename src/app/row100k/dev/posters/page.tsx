import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { archivo, archivoBlack, spaceMono, css } from "../../theme";
import { RowBar } from "../../RowBar";
import { RowFooter } from "../../RowFooter";
import { makeFixture, type FixtureOpts } from "../../poster/fixture";
import { isFormatKey } from "../../poster/formats";
import { poCss } from "../../poster/studioCss";
import type { PosterFormatKey, PosterPpi } from "../../poster/types";
import { PosterStudio } from "../../posters/PosterStudio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Posters (dev) — 100K September",
  robots: { index: false, follow: false },
};

/* THE DEV FIXTURE (SPEC.md §12): the poster studio over deterministic fake
 * data (poster/fixture.ts — fake TABLES pushed through the same
 * computeBoards → maskBoards → assemble path the live payload takes), so
 * every format × subject × masked can be looked at signed out on :3000
 * and screenshotted. DEV ONLY — a 404 in production, no session, no
 * database. Query switches:
 *
 *   ?subject=community|rower   which payload (default community)
 *   &r=N / &rower=N            the subject rower (default 23, one of the top men)
 *   &format=<key>              the format chip to start on
 *   &masked=1                  a window is open; the rower is one of the elite
 *   &final=1                   day 30, the five-row month, 40 names, a 40-row log
 *   &day=N                     the as-of day (1..30; day 1 = hours and split null)
 *   &names=N  &log=N           the club roll and the log, by count
 *   &runup=1                   the run-up: low digits covered, places kept
 *   &noprobe=300               the ppi ladder must refuse 300 (the fallback path)
 */
export default function DevPostersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = searchParams ?? {};
  const one = (k: string): string | undefined => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const flag = (k: string): boolean => one(k) === "1" || one(k) === "true";
  const num = (k: string): number | undefined => {
    const n = Number(one(k));
    return one(k) !== undefined && Number.isFinite(n) ? Math.round(n) : undefined;
  };

  const subject = one("subject") === "rower" ? "rower" : "community";
  const opts: FixtureOpts = {
    masked: flag("masked"),
    final: flag("final"),
    day: num("day"),
    names: num("names"),
    log: num("log"),
    runup: flag("runup"),
    rower: num("r") ?? num("rower"),
  };
  const fixture = makeFixture(opts);
  const format: PosterFormatKey | undefined = isFormatKey(one("format"))
    ? (one("format") as PosterFormatKey)
    : undefined;
  const noprobe = one("noprobe");
  const refusePpi: PosterPpi | null = noprobe === "300" ? 300 : noprobe === "150" ? 150 : null;

  // The chips keep every switch but the subject, so a masked FINAL stays
  // masked and final when the subject flips.
  const keep = new URLSearchParams();
  for (const k of ["masked", "final", "day", "names", "log", "runup", "noprobe", "format"]) {
    const v = one(k);
    if (v !== undefined) keep.set(k, v);
  }
  const tail = keep.toString() ? `&${keep.toString()}` : "";
  const hrefs = {
    community: `/row100k/dev/posters?subject=community${tail}`,
    rowerPrefix: `/row100k/dev/posters?subject=rower${tail}&r=`,
  };

  const community = subject === "community" ? fixture.community : null;
  const rower = subject === "rower" ? fixture.rower : null;
  const asOf = (community ?? rower ?? fixture.community).asOf;

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{poCss}</style>

      <RowBar signedIn={false} rowerNumber={null} admin={false}>
        <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--water)" }}>
          PREVIEW — NOT REAL DATA
        </span>
      </RowBar>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The posters (dev)</h2>
            <span className="mono">
              FAKE DATA · {subject.toUpperCase()} · DAY {asOf.dayNumber}
              {asOf.final ? " · FINAL" : ""}
              {opts.masked ? " · MASKED" : ""}
              {opts.runup ? " · RUN-UP" : ""}
            </span>
          </div>
          <PosterStudio
            community={community}
            rower={rower}
            roster={fixture.roster}
            hrefs={hrefs}
            initialFormat={format}
            refusePpi={refusePpi}
            dev
          />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
