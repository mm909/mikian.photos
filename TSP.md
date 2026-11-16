# TSP team sites (`/tsp/lalv`, IN DEVELOPMENT)

Owner, 2026-11-16: "I need a new site, or just a new page on the normal
site, probably at /TSP … for our teams to use during TSP. We should design
it in a way that we can give this to other TSP teams … allow for there to be
multiple teams, multiple team captains, and the users."

The Speed Project, Santa Monica Pier → the Welcome to Fabulous Las Vegas
sign. One site per team, built on the LASD26 team site (LASD26.md): the same
tables keyed by a team slug, the same stylesheet with the accent turned to
the water blue.

**Where it is.** The DowntownKruz France tracker that lived at `/tsp` is
RETIRED (owner, 2026-11-16: "lets retire the france tracker"): its pages,
components and `/api/relay` are deleted, its `Relay*` tables and rows are
untouched, and `/tsp` now redirects to the hub. The team sites sit at
`/tsp/lalv` (`TSP_BASE` in `src/lib/tsp/paths.ts`; the
site moves in one edit). IN DEVELOPMENT (CLAUDE.md): `TSP_LIVE = false` in
`src/lib/tsp/team.ts` makes every page and every `/api/tsp` route admin-only
in production (404 to anyone else), noindex, "(dev)" in the title; the one
door is "TSP team sites →" in the DEVELOPMENT group of the Rowtember account
menu. When the owner says live: flip `TSP_LIVE`, and put a door where the
public finds it.

| Page | Who | What |
|---|---|---|
| `/tsp/lalv` | anyone signed in | your teams, MAKE A TEAM |
| `/tsp/lalv/new` | anyone signed in | name the team; you become its captain |
| `/tsp/lalv/<team>` | the team | THE MAP, full screen, and nothing else; one OPTIONS button holds the share switch, the runners, what to show, GPX, FIX THE ROUTE |
| `/tsp/lalv/<team>/legs` | the team | THE PLAN: who runs what, the shifts, the hand-offs between them, the plan editor |
| `/tsp/lalv/<team>/turns` | the team | TURNS: team status, the course's figures and profile, turn by turn with ETAs |
| `/tsp/lalv/<team>/expenses` | the team | the LASD26 expense sheet, plus FILED UNDER and the LINES view |
| `/tsp/lalv/<team>/info` | the team | the info sheet; captains edit, add, remove and reorder |
| `/tsp/lalv/<team>/team` | the team | the roster; captains: invite link, make captain, role, remove, settings |
| `/tsp/lalv/<team>/join?t=<token>` | anyone with the link | sign in with Google, runner or crew, join |

## Teams, captains, members

- `TspTeam` (slug = the `team` key on every `Team*` table; name, `secrets`,
  `shareVan`, `startAt`, `planPaceSec`). `createTeam()` makes the row, the
  maker as captain and the first invite link.
- A CAPTAIN is `TeamMember.captain`. The viewer handed to the shared
  lasd26 code (`getTspViewer()`) says `owner: true` for a captain, so
  everything "the owner's alone" there (estimates, editing any expense, the
  info sheet's pencil) is the captains' here. A team always has one: the
  last captain cannot be unmade or removed. The platform owner counts as a
  captain of every team without a member row.
- Every `/api/tsp/[team]/…` route goes through `src/lib/tsp/guard.ts`:
  the dev gate, signed in, on THIS team, a write lid per account;
  `requireTspCaptain` for the invite link, the roster, the settings and the
  info sheet's writes.
- Making a team and every join email the owner (`sendOwnerNotification`).

## An app on the phone (2026-11-16, third round)

Owner: "Lets format this like an app on my phone rather than a website …
this will eventually be an app." Under 960 px a team's pages wear app
chrome (`TspPage.tsx`, the last block of `tspCss.ts`): one slim top row, THE
TAB BAR along the bottom (Map · Plan · Turns · Costs · Info), no footer,
safe-area padding. `src/app/tsp/layout.tsx` links the manifest
(`public/tsp/app/`) and the Apple tags, so "Add to Home Screen" opens it
with no browser bars. From 960 px up the doors are words in the bar.

## Named runners, target paces, shifts (2026-11-16, second round)

- **A named runner nobody has claimed** (owner: "I make my team and it has
  one dummy runner named 'faith' … she has not clicked on the link to
  join"): a captain adds a name on the team page (`TeamMember.placeholder`,
  a made-up `userId` "placeholder:…", no email). The invite link's join page
  lists the unclaimed names ("Are you one of these?") above the usual form;
  claiming writes the account onto that same row, so the legs already
  assigned stay.
- **Target pace** (`TeamMember.paceSec`) and **shift** (`TeamMember.squad`,
  the group that shares a van) per runner, on the team page.
- **Hand-offs** are derived, never stored: wherever the plan passes from a
  runner on one shift to a runner on another (`handoffs()` in
  `src/lib/tsp/legs.ts`). They are tags on the map (H1, H2 …) and a list on
  the plan page with the mile, the nearest town and turn, the time, and a
  Google Maps door for the van.
- **The clock** runs every leg at its runner's target pace (`planClock()` /
  `etaPlan()`), stretched or squeezed mid-race by how the team is doing
  against the plan.
- **The test team** (owner: "make a test team w/ 8 runners and target
  paces"): the button on the hub, `src/lib/tsp/demo.ts`.

## Fixing the route (2026-11-16)

Owner: "allow me to clean up/edit a map. What is the best way for me to
clean up these issues/map bugs". Three ways, in order of effort:

1. **In the app** (a captain): OPTIONS → FIX THE ROUTE on the map. Tap the
   line where the bad part starts, where it ends, then the road it should
   take; PREVIEW, SAVE. `POST /api/tsp/[team]/course` re-routes that stretch
   on foot (or straight through the taps, for desert the map has no path
   for; `src/lib/tsp/courseFix.ts`), and the team gets its own copy of the
   course in `TeamCourse`. BACK TO THE STOCK ROUTE deletes the copy. Legs
   after the fix shift by what it added or saved.
2. **The stock route** (every team): move a point in
   `scripts/tsp-lalv/waypoints.json` and re-run the script.
   `node scripts/tsp-lalv-check.mjs` lists the kinks. The Lenwood zig-zag in
   the owner's photo was a waypoint sitting inside the neighbourhood.
3. **GPX out** (OPTIONS → DOWNLOAD GPX) for a watch or another app. There is
   no GPX import: a bare track has no turn list, surface or mile-accurate
   heights, and the in-app fix covers the cases a re-draw would.

## Expenses and the info sheet

The LASD26 components and libraries, parameterised (API base, sign-in
path, team name), so both sites share the code and both got the new
pieces:

- **FILED UNDER** (owner: "some people would add a cost for like gas … but
  they wouldn't do it underneath the gas bucket … reassign or
  rebucketize"): the edit form of a real cost has a select of the buckets;
  whoever may edit the line (its author, a captain) can file it or take it
  back out.
- **LINES** (owner: "there's probably like a line item version of this
  that's nice to throw around"): a CARDS / LINES switch, a compact table
  with the total and the per-person line, and COPY AS TEXT for the group
  chat.
- **Reorder** on the info sheet (owner: "I should also be able to reorder
  the notes"): ↑ / ↓ per line, `PUT { order }`. A TSP team's sheet is
  seeded from `TSP_DEFAULT_ITEMS` (labels and hints, no invented facts).
- On a TSP team only a captain may add or flip an ESTIMATE (the bucket).
- The expenses split (`TeamSettings.splitCount`, default 18) is set on the
  team page.

## The course

THREE ROUTES (owner, 2026-11-16: "save a few of these routes as different
options. We want to take the powerline route"), listed in `ROUTES` in
`src/app/tsp/lalv/course.ts`; a captain picks the team's on the team page
(`TspTeam.route`, default `powerline`): **Powerline** 302 mi, **The OG line**
338 mi, **Shoshone & Pahrump** about 350 mi. They share the road to Baker
(mile 211), so legs before it keep their meaning across a switch.
`public/tsp/lalv-course/course-<id>.json` (and `course-<id>-secrets.json`,
the same through three stand-in checkpoints for a secrets team) is written by
`node scripts/tsp-lalv-course.mjs` from `scripts/tsp-lalv/waypoints.json`:
the hand-picked route as ordered points, each pair routed ON FOOT by the
FOSSGIS Valhalla server (which also gives the turn list with street names
and the dirt), elevation from SRTM 30 m. Run it with
`NODE_OPTIONS=--dns-result-order=ipv4first`; answers are cached in
`scripts/tsp-lalv/.cache`. To change the route, edit the waypoints and
re-run; legs are stored in miles along the course, so a big change shifts
what a mile number means. The reasoning for the route is in
`scripts/tsp-lalv/ROUTE.md`.

## The map, the plan and live locations

- **The map** (`TspMap.tsx`, the LASD26 map's mechanics): turn dots, mile
  numerals that grow as you zoom (every mile from zoom 10.5 with a dot on
  the line), dirt dashed in sand, LOCATE / RECENTER / FULL SCREEN / NORTH,
  a tag per teammate sharing, the picked runner's legs in ink.
- **Sharing** (`TeamPosition`, `/api/tsp/[team]/positions`): each phone
  says what it is — OFF / RUNNING / VAN / CREW — remembered per phone, so
  the page shares again as soon as it opens. RUNNING is the baton: one
  holder; taking it moves the last holder to CREW. A browser only reports
  while the page is open and the screen is on. Other teams see a team's
  VAN dots only when a captain turns on "Show our van to the other teams".
- **Legs** (`TeamLeg`, `src/lib/tsp/legs.ts`, `/api/tsp/[team]/legs`):
  stretches in hundredths of a mile with a member. THE ROTATION fills a
  stretch (from, to, leg length, runners in order); every leg has − / + on
  both ends (0.1 and 0.5 mi), split, remove. Anyone on the team may save
  the plan. A runner's view: legs, miles, climb, the turns inside each
  leg, about how long, and when it starts.
- **The clock** (`progressOf()` / `etaMs()`): no pace is typed during the
  race. With a start time and a position past mile 1, pace = time since
  the start ÷ miles covered; before that, the planned pace from the team
  page. The team's position is the RUNNING phone, else the van furthest
  along.

Not built: tracking who ACTUALLY ran which miles, dragging the route to
another road, a native app (background location is what an app would
add), and any tracker hardware (Tile has no way for a site to read it).
