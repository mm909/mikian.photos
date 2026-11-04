# DAM TO DAM — spec

The working document for the Dam to Dam project. Every decision gets written
here, dated, with the owner's words where we have them. Iterate here first,
code second.

Owner, 2026-11-03: "I want to do a project named Dam to Dam. Where I row from
hover dam to davis dam. The goal is 100k meters. Point to point." … "I want this
to look like line art showing the coast line and the route line." … "Lets focus
on the 'pre race/advertizements' first."

## What this is

A solo, point-to-point, one-day row: Hoover Dam to Davis Dam down the Colorado
River — Black Canyon, then the length of Lake Mohave. 100,000 meters. The page
sells the attempt before race day and becomes the live tracker on race day.

FULLY STANDALONE (owner interview, 2026-11-03): not a row100k edition, no
row100k credit line. It lives at `/dam-to-dam` on mikianmusser.com — not under
/row100k, which the middleware sends to rowtember.com. The only door while in
development is the DEVELOPMENT group of the row100k account menu, as an
absolute mikianmusser.com URL.

## The route (facts, with sources to re-verify before anything goes live)

- River distance Hoover Dam → Davis Dam ≈ 67 mi ≈ 108 km, so 100,000 m is
  essentially the honest point-to-point number. Start line sits below the dam.
- Km 0–19: Black Canyon National Water Trail (Hoover Dam → Willow Beach).
  - Launching AT the dam base requires a permit arranged through an authorized
    outfitter (NPS). Willow Beach needs no permit. This decides where "0 m"
    legally starts — resolve with NPS/outfitter before announcing the start.
  - Motorized vessels are PROHIBITED Hoover→Willow Beach on Sundays and
    Mondays year-round; other off-season days (after Labor Day → Memorial
    Day) motors are allowed at ≤65 hp. The support boat is legal on a
    Saturday. Source: nps.gov Black Canyon National Water Trail pages.
- Km 19–97: Lake Mohave (Willow Beach → Cottonwood Cove ~55k → Katherine
  Landing ~97k). Slack water; wind is the main adversary.
- Km 97–100: Katherine Landing to the Davis Dam line.
- November daylight there is ~10 hours (~6:30 sunrise, ~16:30 sunset local).
  A continuous 100k push will not fit inside it → navigation lights on both
  boats, and the finish happens in the dark — which IS the brand.

## Decisions (owner interview, 2026-11-03)

| Decision | Answer |
| --- | --- |
| Format | One continuous push, dawn start, same-day finish |
| Crew | Solo rower + motorized support boat (food, water, cameras, rescue) |
| Live progress | Satellite GPS tracker pings → the site moves a dot down the map (no cell coverage in Black Canyon, so phone-only is out) |
| Tracker hardware | None yet — recommend one. Working pick: Garmin inReach Mini 2 (~$400 + subscription; MapShare feed is the integration point) |
| Boat | UNDECIDED — shortlist below, owner asked for recommendations |
| Brand | Fully standalone: its own look, no row100k connection shown |
| Sponsors | YES — pursue. Sponsor strip planned, plus a "Sponsor this row" pitch section; contact via Instagram for now |
| Date on the page | NOV 21 shown plain (stand-in; 2026-11-21 is a Saturday — clear of the Sun/Mon motor ban). Change it when the real date lands |

## Boat shortlist (research 2026-11-03, prices approximate — verify before buying)

| Boat | Type | Why / why not |
| --- | --- | --- |
| Maas Aero | Open-water shell, ~40 lb | The classic distance open-water boat; stable in lake chop, fast enough for ~10–11 h at 100k. ~$7.2k new (carbon ~$8.1k); healthy used market. FRONT-RUNNER. |
| Maas 24 | Open-water shell, longer | Faster, less forgiving; same list price. For a confident sculler. |
| Echo Classic | Open-water shell, ~53 lb | Most stable, wave-piercing bow; slower. The guaranteed-finish pick. |
| Flatwater 1x | Racing shell | RULED OUT: Mohave wind chop + 10+ fatigued hours is a swim waiting to happen. |

## Design language

- TWO PALETTES, viewer-choosable (owner, 2026-11-03, on the previews: "the
  survey ink and topo olive. Keep both options and put them in a settings
  page. Also let me select isometric or top down."): SURVEY — blueprint-blue
  line work on paper cream with orange pops (the vintage Canyonlands
  direction; DEFAULT) — and OLIVE — cream line work on dark olive, the
  national-park poster. The first pass (neon cyan on black) was retired
  with that call. All mono (Space Mono), wide letter-spacing,
  nautical-chart furniture (north arrow, scale bar, distance ticks).
- TWO PROJECTIONS of the same chart: isometric (tilted panorama, canyon
  walls raised off the sheet with hatching; DEFAULT) and top-down (the tall
  overhead chart). Palette and projection are cookies (look.ts) set on
  /dam-to-dam/settings.
- THE MAP IS REAL: USGS NHD geometry (riverData.ts) — the Colorado River
  flowline dam to dam (honest length ~106.4 km behind the 100,000 m goal),
  the Lake Mohave shoreline, and the upper Black Canyon river polygon. The
  cross-axis is exaggerated 2.4x or the lake reads as a thread.
- The route line IS the progress bar: pre-race it is the poster, race day the
  dot moves down it. One map component (RouteMap.tsx), two modes.
- This dark look is a deliberate one-off for this page. The site default
  stays paper/paper-brown per the standing rule; nothing about it changes.
- No site address on any shareable/sticker output, per standing rule.

## v2, same day (owner feedback round, 2026-11-03)

- LIVE BUT UNLISTED (owner: "open this to everyone but keep it unlisted") —
  the lasd26/your-share pattern: the owner gate is gone from all three
  pages, robots stay off, the only link stays in the DEVELOPMENT group.
  The (dev) titles and DEV chips went with it.
- NO MARKETPLACE HEADER (owner: "how does this header still exist, remove
  it") — /dam-to-dam joined RunnerChrome's bare list; the page carries only
  its own bar.
- THE HERO: "Dam TO Dam" highlights the TO; the sub line is the live one —
  "One rower · <meters> m · <$raised> for children with cancer" — meters
  flip to the boat's own on race day and the money reads state.ts
  (hand-updated constants until Candlelighters provides a feed). Facts:
  "every meter on the water" is gone, the date fact carries the ETA
  (10–12 h, dawn start), and the crew fact became the cause fact
  ($1 = 1 m, matched for Candlelighters).
- THE PLAN SHOWS, NOT TELLS (owner: "break down the route/plan on a map")
  — four leg detail charts (LegMap.tsx, legChart in map.ts): each leg
  rotated to its own horizontal, fine NHD shorelines (riverDataFine.ts,
  mixed resolution, ~2,450-point ring) clipped around it, km ticks at the
  ends, one line of caption. The canyon leg runs EX 4.5 or its walls hide
  under the route line.
- ZOOM (owner: "allow me to zoom in to the main map as well") —
  ZoomPan.tsx drives the overview SVG's viewBox: ctrl/cmd+wheel, pinch,
  double-click, drag when zoomed, +/−/reset buttons. Vector all the way
  down.
- The iso chart got its pass: double canyon rim, sparser lake hatching.

## Page — v1 "pre-race" (as built, 2026-11-03; superseded by v2 above)

Route: `/dam-to-dam`. Owner-only in production (the longhorn-lms gate), open
in local dev, `(dev)` in the title, robots noindex, linked only from the
DEVELOPMENT group in BarAccount (absolute URL, cross-host).

Sections, top to bottom:
1. Hero: title, facts grid (distance / route / date / crew), the map with
   the animated route line.
2. The plan: the three legs and the clock, from the route facts above.
3. The boat: the shortlist, marked IN EVALUATION until the owner picks.
4. The gear: tracker, lights, PFD, support boat load-out.
5. Safety: support boat, satellite SOS, bail-out points, cold water, the
   NPS rules.
6. Watch live: the map again with a SIMULATED live dot at 42,180 m and the
   race-day promise; livestream link placeholder.
7. Sponsor this row: the pitch + Instagram contact. A logo strip appears
   here when there is a first sponsor to put in it.

## The money (owner, 2026-11-03: "a donor part/page as well")

- THE DONOR PAGE (/dam-to-dam/donate) is what gets sent to people and
  companies who want to give: what the row is, the goal, how the match
  works, where the money goes. THE SPONSOR PAGE (brand sponsorship, the
  hull) is separate and comes later; the main page's sponsor section holds
  its place.
- THE GOAL: $100,000 — a dollar a meter, capped at the row itself.
  Beneficiary: Candlelighters Childhood Cancer Foundation of Nevada
  (candlelightersnv.org).
- THE MATCH: companies/big donors pledge a MATCH POOL before race day;
  individual donations are matched 1:1 from the pool until it runs dry.
  A pledge pays out only as donations come in to meet it.
- THE MONEY NEVER TOUCHES THE SITE: donations go directly to Candlelighters
  through their own donation page; pledges settle directly with them too.
  RAISED and MATCH_POOL on the donor page are hand-updated constants until
  there is a reason to automate.
- HONESTY NOTE for the owner: $100k is a very ambitious first-time
  individual fundraising goal — it only lands if one or two corporate
  anchors take big slices of the match pool. The page is built so a smaller
  total still reads as a win (the gauge fills meter by meter; no percent).
- BEFORE THIS GOES ANYWHERE: talk to Candlelighters — their name and cause
  are on the page, they may want a dedicated campaign/peer-to-peer link
  (which would also make totals automatic), and they should bless the copy.

## Live tracking (later phase — designed, not built)

- inReach MapShare KML feed → an API route polls it and stores pings → page
  renders the dot at meters-along-route (map.ts pointAtMeters is already the
  lookup). Needs a Ping table, the real route polyline to snap pings onto,
  and a race-mode flag. The map component stays shared between modes.

## Open questions

- [ ] Real date (and the permit/outfitter conversation that anchors it)
- [ ] Boat choice + where from (new vs used)
- [ ] Buy or rent the inReach; which subscription tier
- [ ] Sponsor pitch contents (what do sponsors get — hull, page, story?)
- [ ] Sponsor contact channel (IG for now; a form that emails the owner
      per the standing sign-up rule, if inquiries should be structured)
- [ ] Livestream platform for the chase-boat camera
- [ ] Training plan / proof-of-fitness content on the page?
- [ ] Candlelighters: blessing, exact donate link, dedicated campaign page?
- [ ] The dedicated sponsor page (the donor page shipped first)
- [ ] Start-line honesty: the real line is ~106.4 km dam to dam — decide
      whether 0 m starts at the dam (goal passed at ~94% of the water) or
      the "100,000 m" is the whole line (then it is a 106k row)
