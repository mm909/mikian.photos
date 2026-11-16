import type { ReactNode } from "react";
import type { Actor } from "@/lib/permissions";
import type { TspViewer } from "@/lib/tsp/team";
import { teamPath, tspPath } from "@/lib/tsp/paths";
import { archivo, archivoBlack, spaceMono, css } from "@/app/lasd26/theme";
import { TspAccount } from "./TspAccount";
import { tspCss } from "./tspCss";

/**
 * The frame every page of the TSP team sites sits in (/tsp/lalv,
 * lib/tsp/paths.ts): the LASD26 team site's own stylesheet — the crew knows
 * it, and every xp-*, rt-*, tm-* class comes along — with the accent turned
 * from the Just Friends lime to the site's water blue (tspCss), then the
 * bar: the wordmark, the team's doors, the account button.
 *
 * On a team's page `viewer` is set and the doors are that team's; on the hub
 * (no team) the bar carries the wordmark and the account button alone. The
 * style tag is raw HTML on purpose (React escapes quotes inside <style>
 * children; see LasdPage).
 */

export type TspBarKey = "route" | "legs" | "turns" | "expenses" | "info" | "team" | "join" | "hub" | "none";

/**
 * THE DOORS. On a desktop they are words in the bar. On a phone they are THE
 * TAB BAR (owner, 2026-11-16: "Lets format this like an app on my phone
 * rather than a website … this will eventually be an app"): five icons with
 * a word under each, fixed to the bottom of the screen where a thumb is,
 * the top bar cut to one slim row, no footer. `d` is the icon, a 24-unit
 * stroked path.
 */
const DOORS: { key: TspBarKey; label: string; tab: string; path: string; d: string }[] = [
  { key: "route", label: "Map", tab: "Map", path: "", d: "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4zM9 4v13.5M15 6.5V20" },
  { key: "legs", label: "Plan", tab: "Plan", path: "/legs", d: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" },
  { key: "turns", label: "Turns", tab: "Turns", path: "/turns", d: "M6 20V10a4 4 0 0 1 4-4h8M14 2l4 4-4 4" },
  { key: "expenses", label: "Expenses", tab: "Costs", path: "/expenses", d: "M12 3v18M16.5 7.5c-.6-1.5-2.3-2.5-4.5-2.5-2.5 0-4.5 1.3-4.5 3.5s2 3 4.5 3.5 4.5 1.3 4.5 3.5-2 3.5-4.5 3.5c-2.2 0-3.9-1-4.5-2.5" },
  { key: "info", label: "Info", tab: "Info", path: "/info", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01" },
];

export function TspPage({
  viewer = null,
  actor = null,
  active,
  children,
  extraCss = "",
  bare = false,
}: {
  viewer?: TspViewer | null;
  /** The hub's pages have no team; they hand the signed-in account down instead. */
  actor?: Actor | null;
  active: TspBarKey;
  children: ReactNode;
  extraCss?: string;
  /** The map page: nothing under the bar but the page itself (no footer), the frame exactly one screen tall. */
  bare?: boolean;
}) {
  const who = viewer?.actor ?? actor;
  const slug = viewer?.team.slug ?? null;
  return (
    <div className={`lasd26 tsp${bare ? " tsp-bare" : ""}${slug ? " tsp-app" : ""} ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: css + extraCss + tspCss }} />
      <div className="bar">
        <a className="wm" href={slug ? teamPath(slug, "") : tspPath("")} aria-label={viewer ? `${viewer.team.name}, TSP LA to Las Vegas` : "TSP LA to Las Vegas, team sites"}>
          <span className="mono tag">TSP</span>
          <span className="mono wm-t">{viewer ? viewer.team.name.toUpperCase() : "LA → LAS VEGAS"}</span>
        </a>
        {slug && (
          <nav className="bar-nav mono" aria-label={viewer?.team.name}>
            {DOORS.map((d) => (
              <a key={d.key} href={teamPath(slug, d.path)} aria-current={active === d.key ? "page" : undefined}>
                {d.label}
              </a>
            ))}
          </nav>
        )}
        <div className="bar-acct">
          <TspAccount
            viewer={{
              signedIn: who !== null,
              name: viewer?.member?.name ?? who?.name ?? "",
              role: viewer?.member?.role ?? null,
              captain: viewer?.captain ?? false,
              onTeam: viewer?.onTeam ?? false,
              slug,
              teamName: viewer?.team.name ?? null,
            }}
          />
        </div>
      </div>
      {children}
      {slug && (
        <nav className="tsp-tabs" aria-label={`${viewer?.team.name ?? "Team"}, sections`}>
          {DOORS.map((d) => (
            <a key={d.key} href={teamPath(slug, d.path)} aria-current={active === d.key ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d={d.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{d.tab}</span>
            </a>
          ))}
        </nav>
      )}
      {!bare && (
        <footer className="tsp-foot">
          <div className="wrap mono">
            <span>TSP · SANTA MONICA PIER → THE LAS VEGAS SIGN</span>
            <a href={tspPath("")}>ALL TEAMS</a>
          </div>
        </footer>
      )}
    </div>
  );
}
