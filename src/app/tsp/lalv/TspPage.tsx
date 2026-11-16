import type { ReactNode } from "react";
import type { Actor } from "@/lib/permissions";
import type { TspViewer } from "@/lib/tsp/team";
import { teamPath, tspPath } from "@/lib/tsp/paths";
import { archivo, archivoBlack, spaceMono, css } from "@/app/lasd26/theme";
import { TspAccount } from "./TspAccount";
import { looksCss } from "./looksCss";
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

export type TspBarKey = "route" | "legs" | "expenses" | "info" | "team" | "join" | "hub" | "none";

const DOORS: { key: TspBarKey; label: string; path: string }[] = [
  { key: "route", label: "Route", path: "" },
  { key: "legs", label: "Legs", path: "/legs" },
  { key: "expenses", label: "Expenses", path: "/expenses" },
  { key: "info", label: "Info", path: "/info" },
];

export function TspPage({
  viewer = null,
  actor = null,
  active,
  children,
  extraCss = "",
  look = "",
}: {
  viewer?: TspViewer | null;
  /** The hub's pages have no team; they hand the signed-in account down instead. */
  actor?: Actor | null;
  active: TspBarKey;
  children: ReactNode;
  extraCss?: string;
  /** A trial look ("a" | "b" | "c"; the route page's ?look=), as a class on the frame. */
  look?: string;
}) {
  const who = viewer?.actor ?? actor;
  const slug = viewer?.team.slug ?? null;
  return (
    <div className={`lasd26 tsp${look ? ` look-${look}` : ""} ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style dangerouslySetInnerHTML={{ __html: css + extraCss + tspCss + looksCss }} />
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
      <footer className="tsp-foot">
        <div className="wrap mono">
          <span>TSP · SANTA MONICA PIER → THE LAS VEGAS SIGN</span>
          <a href={tspPath("")}>ALL TEAMS</a>
        </div>
      </footer>
    </div>
  );
}
