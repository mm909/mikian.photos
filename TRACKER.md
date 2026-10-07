# Live tracker (`/track/<slug>`)

Where runners are during a long event, for friends and family on a phone:
live position, progress, ETA and per-runner stats. Built from
`TRACKER_SPEC.md` (2026-10-06) for **LASD26** first (Santa Monica → San Diego
relay, 2026-10-23), general enough for a TSP-style relay and a Moab-style
solo later.

It lives inside this Next.js app instead of the spec's standalone box, so it
deploys with the site and reuses its admin gate. The pieces:

| What | Where |
|---|---|
| Event files (one YAML + GPX per event) | `events/<slug>.yaml`, `events/<slug>.gpx` |
| Tables (`Tracker*`) | end of `prisma/schema.prisma` |
| Core (types, route index, config, compute, snapshot, ingest, sync…) | `src/lib/tracker/` |
| API routes | `src/app/api/track/**` |
| Pages (public, crew, van, join) | `src/app/track/[slug]/**` |
| Simulator and sync CLI | `scripts/track-simulate.ts`, `scripts/track-sync.ts` |
| Unit tests (Vitest) | `src/lib/tracker/*.test.ts` → `npm test` |

## Status: IN DEVELOPMENT

`src/lib/tracker/gate.ts` → `TRACKER_PUBLIC = false`. Every `/track` page and
the read APIs it polls answer **404 in production to anyone who is not an
admin**; everything is open on a laptop. Titles carry "(dev)", robots are
noindex, and the only links are in the DEVELOPMENT group of the Rowtember
account menu. When the owner says the tracker goes live: flip
`TRACKER_PUBLIC` to `true`, which also drops the "(dev)" tag and switches the
snapshot's cache header to public, and move the menu links.

The write paths are not behind the admin and stay as they are when the pages
go public: Traccar's webhook carries a shared secret, the crew/van pages carry
the event's crew key.

## Environment variables

| Variable | Used for |
|---|---|
| `TRACKER_TRACCAR_SECRET` | The webhook secret. Traccar posts every position to `https://<host>/api/track/ingest/traccar/<secret>` (or sends it as `Authorization: Bearer …`). Unset → the webhook is disabled. |
| `TRACKER_TRACCAR_URL`, `TRACKER_TRACCAR_TOKEN` | The Traccar server and an API token (Bearer), for the admin **backfill** that pulls each device's positions since event start over Traccar's REST API when the webhook missed some. |
| `TRACKER_TRACCAR_PUBLIC_URL` | What runners type into Traccar Client as the server URL (`https://host:5055` form). Shown on `/track/<slug>/join`. |
| `TRACKER_CREW_KEY_<SLUG>` | The crew key named in the YAML as `crew_key: "$TRACKER_CREW_KEY_LASD26"`. The repo is public, so keys never go in the file. Unset → sync writes the key as `""`, the crew/van pages refuse every key, and `npm run track:sync` prints a banner naming the variable. The predictable `dev-<slug>-crew` fallback is used **only when `POSTGRES_URL` points at a local database** (`localhost`, `127.0.0.1`, `::1`, `*.local`, `*.test` — `databaseIsLocal()` in `src/lib/tracker/config.ts`), never by `NODE_ENV`: the sync script runs under tsx with `NODE_ENV` unset, and `.env.local` on the owner's laptop points at the live Neon database. |

Set them in Vercel (production + preview) and in `.env.local` for a laptop.
`npm run track:sync -- --dry-run` prints which rule applied without touching
the database.

## Configuring an event

1. Put the GPX next to the YAML and describe the event in `events/<slug>.yaml`
   (see `events/lasd26.yaml`: kind relay|solo, start_time with offset,
   timezone, units, entries with participants and their Traccar device ids,
   a `vehicle_device` per entry, checkpoints by mile/km/route_m).

   **Participant identity.** Handoffs hang off a participant's id, so the id
   must survive edits to the file. A line's id is, in order: an explicit
   `id:` on the line (`[a-z0-9-]`); else, when the line has a device, the
   device's `external_id` — for an event like LASD26 the phone IS the runner,
   so a runner who swaps phones gets the new `external_id` written on *their*
   line, not a new line; else the 1-based position (only for a line with
   neither). All three are stored as `<slug>:p:<SHORT>:<tail>`. Two lines
   resolving to the same id is a validation error. Deleting or reordering
   lines never re-attributes legs: a line that leaves the file keeps its row
   and sync warns with its name and how many handoffs point at it.
2. Load it into the database:

```bash
npm run track:sync
```

   (`-- --event lasd26` for one event, `--force` to rewrite even when nothing
   differs, `--dry-run` to validate and print the ids and crew-key status
   without a database, `--help`; also `POST /api/track/sync` as an admin.)
   Re-run after every edit of the YAML or GPX, and after rotating the crew
   key variable. Sync detects three kinds of change and names them in the
   summary (`config` = the YAML, `route` = a GPX file's text, `key` = the
   resolved crew key); a key-only change is one cheap update. Entries,
   participants and devices get stable ids derived from the file, so a
   re-sync updates rows in place; a device removed from the file is unlinked,
   never deleted. When the crew key variable is unset the sync still runs,
   writes the key as `""` and prints a banner — set the variable and re-run.
3. Open `/track/<slug>` (public page), `/track/<slug>/join` (runner setup),
   `/track/<slug>/crew?k=<crew key>` and `/track/<slug>/van?k=<crew key>`.
   The admin index at `/track` prints the crew and van links.

**Before race week for LASD26** (spec §15): the real GPX (the current file is
a BRouter stand-in, 142.4 mi vs the official ~134), the start time, team and
runner names, the real towns/exchange points and their miles, whether public
positions should be delayed (`public_delay_s`).

## Traccar

On the Traccar server (`traccar.xml`):

```xml
<entry key='forward.type'>json</entry>
<entry key='forward.url'>https://<host>/api/track/ingest/traccar/<TRACKER_TRACCAR_SECRET></entry>
<entry key='forward.retry.enable'>true</entry>
```

Traccar then POSTs `{"position": …, "device": …}` per fix (speed in knots,
times as ISO strings). Each runner installs **Traccar Client**, enters the
server URL and their device identifier exactly as `/track/<slug>/join` shows
(the ids are the `external_id`s in the YAML), sets accuracy Highest, a 20 m
distance / 15 s interval, offline buffering on, location permission Always,
Low Power Mode off, and never swipes the app away. The join page polls and
shows "we last heard from your phone N s ago" so each runner can confirm the
setup works.

Phones buffer in dead zones and upload later, oldest first. That is the
normal case: ingest is idempotent (one row per device + fix time), everything
is ordered by the device's fix time, and each snapshot build recomputes legs
and stats from scratch, so late data corrects the totals by itself. Fixes
with accuracy worse than 100 m, more than 5 minutes in the future, or before
event start minus one hour are dropped.

## Crew and van

- **Crew page** (installable): pick your team once, tap the runner taking
  over. Taps are stored on the phone first (IndexedDB) with the client time
  and a UUID and sent when there is signal; a visible "N taps waiting to send"
  banner shows the queue; the newest tap can be undone. The server corrects
  client clocks off by more than 5 s, using the `client_now` the page sends
  with each tap; a request without `client_now` (an admin posting a missed
  tap by curl later) is stored at the time given, uncorrected.
- **Van page**: START shares the van phone's position every ~10 s through the
  web adapter, keeps the screen awake, queues offline. The public page shows
  the van ("showing support van") only when the runner's phone has gone quiet
  for 3 minutes, and the van never advances a team's progress.

## Test runs

Fixes stamped before `start_time − 1 h` are dropped, so for a test run before
race day set `start_time` in the YAML to the test day, `npm run track:sync`,
and (if needed) reset the event's data from a laptop against the dev server:

```bash
curl -X POST "http://localhost:3000/api/track/lasd26/reset?k=<crew key>"
```

(the reset route is disabled in production). The crew key is whatever the
sync summary says it is: `env` (the variable), `dev-fallback` (local database
only), or `missing` — with `missing` every crew/van/reset call is a 403 until
the variable is set and the event re-synced.

The first sync after 2026-10-06 moves the LASD26 participants from
positional ids (`lasd26:p:A:1`) to device-based ones (`lasd26:p:A:lasd26-a1`).
The old rows stay (sync lists them with their handoff counts) and the
handoffs from earlier simulator runs still point at them, so reset the event
(`--reset` on the simulator, or the curl above) before the next replay.

### Simulator

Replays an event against a running dev server through the real HTTP
endpoints (Traccar-shaped webhook bodies for runners, the web adapter for
vans, the handoffs API for crew taps):

```bash
npm run track:simulate -- --event lasd26 --speed 60 --reset
```

`--speed 0` runs as fast as the server takes it; `--fraction 0.5` stops
halfway; `--dry-run` prints without posting; `--help` lists the hard cases:
`--deadzone A:20:30` (hold a team's fixes for 30 sim-minutes, then deliver
them oldest first), `--deadphone A3`, `--miss-tap 3`, `--late-tap 4:10`,
`--dupes`, `--offroute 45:300`, `--skew 90`. The sim clock must stay inside
the ingest time rules (not more than 5 min ahead of the wall clock, not
before `start_time − 1 h`); the script warns when the plan would break them.

## How a snapshot is built

The public page polls `/api/track/<slug>/snapshot` every 15 s and fetches
`/api/track/<slug>/route` once. The snapshot is cached in `TrackerSnapshot`
and rebuilt when older than 15 s or after an ingest (at most once per 5 s).
A build loads the on-course devices' fixes since start − 1 h and the
handoffs, snaps each fix to the route (a window from 500 m behind to 5 km
ahead of the entry's progress, else the whole route; > 300 m off route keeps
the fix for the map but does not advance progress), derives legs (handoff
to handoff for a relay, checkpoint to checkpoint for a solo), per-runner and
per-entry stats, the gap between entries, and ETAs (70 % of the pace over the
last 10 miles, 30 % whole-event pace, window ± max(10 min, 5 % of remaining
time)). `public_delay_s` builds the snapshot as of now minus the delay.

## Not in v1

Satellite and manual adapters (stubs by design), per-entry routes and solo
mode in the UI (the compute supports them), an admin UI, notifications,
accounts, Strava import.
