# LASD26 — the crew's site (`/lasd26`, LIVE)

The No Shortcuts Time Trial relay, Santa Monica → San Diego, Fri 2026-10-23,
run with Just Friends LV. The landing is the old crew call (now closed); the
rest is the team's own pages: who is on the crew, what it costs, who paid.
Built 2026-10-15 from the owner's brief, reviewed as a dev copy under
`/lasd26/dev`, and moved up over the old crew-call page on 2026-10-16
(owner: "we are going to make some of this live now"). Live tracking is the
separate tracker under `/track/lasd26` (see TRACKER.md).

**Where it is right now.** LIVE at `/lasd26`. The dev gate, the "(dev)"
title tags and the DEV pill are gone; the landing is indexable, the team
pages stay noindex. Each page keeps its own rule — nothing private opens
because the site did:

| Page | Who | What |
|---|---|---|
| `/lasd26` | everyone | the landing: crew call is closed, the weekend, facts, the countdown; the bar with CREW CALL · EXPENSES · ROUTE · INFO and the account button; signed out, one ON THE TEAM → SIGN IN line at the foot; signed in, nothing there |
| `/lasd26/join?t=<token>` | anyone with the link | sign in with Google, pick RUNNER or CREW, join the team |
| `/lasd26/expenses` | the team | every cost and its receipts; add a cost, attach receipts, edit/delete your own; the split and each person's share |
| `/lasd26/pay` | the team once settling up is open (owner before) | your share, card, "paid" state |
| `/lasd26/team` | owner | the invite link (copy / rotate), members, mark paid by hand, split count, open settling up |
| `/lasd26/the-list` | owner | the crew-call applications — the DEVELOPMENT item in the account menu, 404 to anyone else |
| `/lasd26/route` | everyone | the official course on a map in the site's colours — the lime line, start and finish, the turns, the van drive by road, your location, full screen — and the turn-by-turn list |
| `/lasd26/info` | the team | the info sheet: addresses, times, rooms, who to call; the owner fills it in, adds notes of his own and removes lines, members read |
| `/lasd26/stickers` | the team | the stickers: Just Friends, No Shortcuts and both, nine cards in four looks at sticker / story / post sizes; the door is "Stickers →" in the account menu, not the bar |

**LIVE is hidden** (owner, 2026-10-16: "Let's hide the 'live' page for
now. It's not ready."). The bar has four doors, CREW CALL, EXPENSES,
ROUTE and INFO; the tracker (`/track/lasd26`, the runner setup, the crew & van
links) is reachable only from the owner's DEVELOPMENT group in the account
menu (`LasdAccount.tsx`). When the tracker is ready, a LIVE door goes back
into `LasdBar.tsx`.

**The footer** is one component, `LasdFooter.tsx` — the landing's (the
race, Just Friends, the crew captains, "for yourself and others") on every
page (owner, 2026-10-16: "update the footer with my full footer, like all
the other pages").

**The crew call is closed.** `POST /api/lasd26/apply` answers 410 ("Crew
call is closed."); the owner's `DELETE` (the clear button on the list)
still works. Nothing renders the old form.

**The invite link** is `lasdPath("/join")?t=<token>` — `/lasd26/join?t=…`.
The owner makes it on `/lasd26/team` (copy / rotate) and drops it in the
group chat; the token is the only key to the team, and making a new link
retires the old one.

## The route and the info sheet (both live)

Both built 2026-10-16 from the owner's notes behind the dev gate (owner:
"put it behind the dev gate", "again put it behind a dev gate for now");
the route went live the same evening ("the route page can go live after
those changes"), the info sheet that night ("Make the info page live").
Nothing wears the gate now; it stays for the next new page. The gate is
the standing rule in CLAUDE.md through `gateLasdDev()` in
`src/lib/lasd26/devGate.ts` — admin-only in production (anyone else gets
the 404 a missing page gives), open on a laptop — `devTitle("…")` puts
"(dev)" in the title, the metadata says noindex, and the only door is the
owner's DEVELOPMENT group of the account menu (`LasdAccount.tsx`). When
the owner says a page is live: swap the gate for
`getTeamViewer()`/`ensureOwnerMember()`, drop the "(dev)" tag, move the
link to where the team finds it, and take the production check off its
API route.

- **The route** (`/lasd26/route`; owner, 2026-10-16: "I've attached a
  google maps with the route, embed this route into the site, make it the
  same color scheem at the rest of the site", then on his phone: "Remove
  the copy at the top … remove the bathroom stops, and bathroom count,
  remove after the finish copy and the 'from no shortcuts' offical…' …
  show the users location on the map. Give a button to full screen the
  map. see if we can make the dotted link follow the route we are driving
  … Make the dots a little easier to tap on while on the phone"). Open to
  everyone — the ROUTE door in the bar — because it is the race's own
  published course. The course is a STATIC FILE,
  `public/lasd26/route/course.json`, made from the organizer's Google My
  Maps KML (`mid=1vsgSOGVJdwgvlBo3dPvUKCsPG6CL998`, exported by hand) by
  `scripts/lasd26-route-from-kml.ts`: the running line and its cumulative
  metres, the 53 turns, the elevation profile, and the one van drive
  (San Mateo Point → the Oceanside Chevron through Camp Pendleton) ROUTED
  BY CAR — BRouter's `car-fast` profile first (as `src/lib/routing.ts`
  does), OSRM's public demo second, the straight line only if both fail —
  stored as `drives[].coords` with `road_m` (18.0 mi) beside `straight_m`
  (17.5). Run it under `NODE_OPTIONS=--dns-result-order=ipv4first` on this
  machine; `--gpx` also rewrites `events/lasd26.gpx` for the tracker, which
  is PAUSED, so the default run leaves `events/` alone. The page
  (`RouteView.tsx` / `RouteMap.tsx`, MapLibre on OpenFreeMap's light
  tiles): the lime line with an ink casing, START and FINISH, the turn dots
  with an invisible wider hit ring (14–18 px) so a thumb finds them, a
  paper popup with mile and call (a fresh Popup per tap — MapLibre drops a
  re-used one), the drive dashed along the road, LOCATE (geolocation
  watch → lime dot in an ink ring over the accuracy circle; follows until
  you drag) and FULL SCREEN (the Fullscreen API, or on iPhone a fixed
  stage with a CLOSE button); the map TURNS (owner, 2026-10-16: "Let me
  rotate it" — two fingers, right-drag / Ctrl-drag, Shift+arrows) but
  never tilts, and a NORTH button with a needle shows under LOCATE only
  while it is turned and eases it back to north-up; then the facts strip
  (run, van, climb, turns), the profile and the turn list, and at the foot
  the chip to the Google map for the van, then the shared footer. No
  bathrooms, no credit line, nothing past the finish.

- **The info sheet** (`/lasd26/info`; owner, 2026-10-16: "make a info page
  where we can fill out addresses for airbnb, start line, van pick up etc.
  if you already know any of that please fill it in. I can give the rest.
  What other info would the runners need."; that night: "Remove emergency.
  Allow me to add / remove notes on the info page. Make the info page
  live."). LIVE: the page resolves the viewer with `getTeamViewer()` +
  `ensureOwnerMember()`, title "LASD26 — Info sheet", noindex; signed out
  → the sign-in notice, signed in but not on the team → the invite notice,
  a member → the sheet, the owner → the sheet with EDIT / REMOVE on every
  line and "+ ADD A NOTE" at the foot. The doors: INFO in the bar
  (`LasdBar.tsx`) and "Info sheet →" in the team group of the account menu
  (`LasdAccount.tsx`). One line per thing a runner needs, a `TeamInfoItem`
  row each (team + key slug, label, value, hint, sortOrder, removedAt).
  THE LIST IS CODE — `DEFAULT_ITEMS` in `src/lib/lasd26/infoSheet.ts`
  (pure data, no `server-only`, so the fill script can read the same copy;
  `info.ts` is the database side and re-exports it), in page order: Race,
  Race day, Start line, Finish, The weekend, Leaving Vegas, Van pick-up,
  Packet pick-up, Vans, Pairs & rotation, Airbnb, Hotel after the race
  (key still `hotel-friday`), Crew phones. The owner's notes of 2026-10-16
  ("no Group chat, no Food plan, no Phone tracking, no What to bring, no
  Parking at the start, no Exchange points, no Money", then "Remove
  emergency") are `RETIRED_KEYS`: `ensureInfoItems()` and the fill script
  hard-delete those rows (they were prefills, nothing of his). What he
  then sent from his phone — the two vans and their drivers, the four
  running pairs and the one-hour rotation, Thursday's early / late van out
  of Vegas and the two flights, the five hotel rooms with their codes, the
  Airbnb address, map link and house rules, later the Turo van pick-up,
  the packet pick-up, the hotel address and rooms, the finish, his and
  Jazz's numbers — is typed into the list word for word;
  `scripts/lasd26-info-fill.ts`
  (`npx dotenv -e .env.local -- tsx scripts/lasd26-info-fill.ts`) drops the
  retired keys and writes every line's text into the table, EXCEPT a line
  the owner has edited by hand on the page (`updatedById` set), which it
  keeps unless run with `--force`, and a line he has REMOVED (`removedAt`
  set), which it never recreates, `--force` or not; it prints what it
  wrote, what it kept and what it found removed. Run it against production
  after the deploy, and again whenever a line's text in `DEFAULT_ITEMS`
  changes — pushing alone never changes a value that is already in the
  table. `ensureInfoItems()` on every read seeds a built-in line that
  has NO row at all (a removed one counts as present), deletes the retired
  ones and moves a LIVE built-in row's label / hint / sortOrder to what the
  list says, but never touches a value, so what the owner types survives
  any change to the list. NOTES: a line the owner adds is a `TeamInfoItem`
  with key `"n-" + slug(label)` ("n-gas-money"; "-2", "-3"… when that key
  is taken, removed rows counting), sortOrder 1000 + the number of note
  rows the team has (after every built-in line, newest last), hint "";
  its label is his to rename, a built-in line's is the list's (no built-in
  key starts with "n-", so `RETIRED_KEYS` can never hit a note;
  `NOTE_PREFIX`, `isNoteKey()`, `slugLabel()`, `cleanLabel()`, `MAX_LABEL`
  = 60 in `infoSheet.ts`; `addInfoNote()` / `removeInfoItem()` in
  `info.ts`). REMOVE, built-in or note alike, is a SOFT DELETE — `removedAt`
  set, the row stays — so a removed built-in is never seeded again and its
  key stays taken; every reader shows `removedAt null` only. The page: a
  mono eyebrow over each value in body type, the lines as typed — a blank
  line is a paragraph gap, a "•" or "1." line hangs its bullet, a
  64-character measure — URLs / @handles / phone numbers / emails made into
  links, "— not yet —" in grey where nothing is typed; the OWNER gets an
  EDIT pencil per line (textarea up to 30 rows, SAVE / CANCEL, Ctrl+Enter
  saves, Escape backs out) and REMOVE, a member reads; the shared
  `LasdFooter` at the foot. API `/api/lasd26/info` (all JSON; sign-in or
  401, team or 403, writes the owner's or 403; no production gate any
  more): `GET` the live lines in order; `PATCH { key, value, label? }` —
  `label` for a note only, 400 "The name of a built-in line is fixed."
  otherwise, 404 unknown or removed, 4000 characters at most;
  `POST { label, value? }` → 201 and the new note; `DELETE { key }` →
  `{ ok, key }`, 404 unknown or already removed. The `removedAt` column is
  additive, so the production build's `prisma db push` applies it; the
  table itself needs `npm run prisma:push` once (the page shows an empty
  sheet, not a crash, until then).

## Mile markers, ETAs and the van (2026-10-21)

Owner, 2026-10-21: "I also need mile markers on the route page, they
should be subtle. I also want etas added to the route page that will be
filled in as we get more info like avg pace. We should include an expected
finish time at the bottom. I dont think we need a new screen we can
include the etas on the turn by turn area. Also, we need a 'van location'
button. This should be only clickable/visable by team members. The van
location button should put a pin/van indicator on the map so the runners
will be able to view where the van is on their turn by turn. We dont need
to make this live. It can just take the location of the user who is
clicking the button as the van's location." Then: "the pace should be
inferred from the van's location and current duration of the race. I can
input the drive time but I don't want to have to input/guess an avg pace
or have to click a 'start/end drive' button"; "we prob have to base ETA
on the van's position? … maybe we assume that we have used the time since
the start to get to the van's current location (even if the runners will
be a mile behind)"; and "One van pin".

- **Mile markers** (`RouteMap.tsx`, `mileMarkers()` in
  `src/app/lasd26/route/eta.ts`): a grey numeral beside the line at every
  whole run mile, a symbol layer in the basemap's own face (Noto Sans
  from OpenFreeMap's glyphs; the raster fallback style names the same
  glyphs) with a paper halo — no dots, no ticks. Three layers by tier:
  every ten miles from the whole-course view, every five from zoom 9.2,
  every mile from 11.2; the map's collision drops any that would pile up.
- **ETAs** (`eta.ts`, pure; `npx tsx src/app/lasd26/route/eta.test.ts`):
  NO PACE IS TYPED. The van's latest pin is snapped to the course
  (`snapToCourse()`: the running line leg by leg, and the drive's road —
  a pin clearly nearer the road than the line is ON THE DRIVE); the clock
  since the start, less the Camp Pendleton ride where the van is past it,
  divided by the van's run mile is the pace (`paceModel()`, source
  "van"); every call after the van is that many minutes from the pin's
  time, the restart is the pickup plus the ride, the list never runs
  backwards (`rowEtas()`), the last row is the EXPECTED FINISH. A pin
  before the start, still inside mile 1, more than a mile off the course,
  or implying a pace outside 4:00–20:00/mi does not count and the PACE row
  says why. Until a pin counts the list is PLANNED at the planned pace.
  Three knobs, all prefilled, on `TeamSettings` (`etaDriveMin` 25,
  `etaStartAt` null = Fri 5:00 AM PT, `etaPlanPaceSec` 540), read by
  `getSettings()` and changed through `PATCH /api/lasd26/eta` by anyone
  on the team (EDIT on the PACE row: the start as a time on race day, the
  drive in minutes, the planned pace as m:ss). `GET /api/lasd26/eta` is
  open (the settings) and carries the pin only for the team; the view
  polls it every 30 s while the tab is in front and keeps the same state
  object when nothing moved. Clock times are Pacific
  (`Intl.DateTimeFormat`, `America/Los_Angeles`), with the weekday added
  once the schedule crosses out of the race day ("12:40 AM SAT"). A call
  the clock has passed goes grey. On the page: the PACE row over the list
  ("FROM THE VAN · MI 42.3 AT 10:12 AM · 8:52/MI" or "PLANNED ·
  9:00/MI until the van's first check-in", then "start 5:00 AM · drive 25
  min"), the ETA at the right of every call, THE VAN as a lime row where
  it sits in the list (`vanRowAfter()`), and the EXPECTED FINISH box.
- **LOCATE and RECENTER** (owner, 2026-10-23: "When sharing your location
  for the map keep it centered unless the user moves it and give a button
  to recenter"): while the location is on the map follows every fix; a
  drag by hand stops the following and a RECENTER button (ink, the lime
  arrow, the word) shows under LOCATE until a tap puts the map back on the
  dot; LOCATE itself is on / off only. It went to the owner alone first
  ("deploy this to just my user first so I can test") and to everyone the
  same morning ("Push this to all users"); the flag and the older way
  (LOCATE re-following from "watch") are gone.
- **The van** (`TeamVanPin`; `src/lib/lasd26/van.ts`; `/api/lasd26/van`
  GET / POST / DELETE, all sign-in + team): a fourth button on the map,
  team only, asks "Pin the van at this phone?" (MOVE IT HERE / CLEAR /
  CANCEL once a pin exists), reads the phone's position once (the LOCATE
  fix when the watch is live) and POSTs it; every tap is a new row, the
  old one gets `clearedAt`, so the rows are the check-in log. The pin is
  an ink dot in a lime ring with a VAN tag; a tap on the tag says where
  ("mi 42.3", "on I-5 through Camp Pendleton", "0.8 mi off the course"),
  who set it and how long ago. The public never sees the pin — the page
  hands it only to a member, the API answers 403 — so a visitor's list is
  the planned schedule. Both new columns and the table are additive, so
  the production build's `prisma db push` applies them; until then the
  pin reads as none and the settings as their defaults.

- **The stickers** (`/lasd26/stickers`; owner, 2026-10-21: "I need to
  generate a bunch of stickers for Just Friends and No Shortcuts and a
  combo of the 2 … a shareable of the route"; his picks the same day: the
  marks as TYPE for now — "Type now, swap in the marks later" — NO
  handles, and after the first look "Lets remove 'one van. one long
  friday'", "Lets remove 'start' 'the van is full', the crew and done
  stickers", "We can make stickers viewable as a link on the profile
  menu"). LIVE FOR THE TEAM: `getTeamViewer()` / `ensureOwnerMember()`,
  the sign-in / invite notices for anyone else, "Stickers →" in the
  account menu's team group, nothing in the bar, noindex. Nine cards in
  three families (`StickersPanel.tsx`), each family with four looks
  (`LOOKS` in `src/app/lasd26/stickers/paint.ts`), at sticker (own
  height) / story (1080 × 1920) / post (1080 × 1350), share / copy /
  download and DOWNLOAD ALL for the family (`StickerFrame.tsx`, the Hyrox
  frame in the team site's clothes). JUST FRIENDS, paper on ink with the
  lime dot: the mark ("justfriends." with a lime disc for the period),
  RUN IT DOWN THE COAST., LA → SD (lime arrow), DAYS AWAY (the phone's
  own calendar). NO SHORTCUTS, their red (#C81E2E, sampled from their
  avatar) on black with the arrow: the mark (NO / SHORTCUTS →), the race
  (TIME TRIAL · 7TH EDITION · LA → SD · 10.23.26), 115 MILES. (the
  measured course, not the poster's 120). BOTH, paper on ink with the
  dot and the arrow: the lockup (NO SHORTCUTS → × justfriends. / LASD26 /
  the line and the date) and THE ROUTE (the course line from
  course.json, START and FINISH tags, the drive dashed, a tick every 25
  miles, 115 MI). THE MARKS ARE THE SEAM: `jfMark()` and `nsMark()` set
  type today; when the owner sends hi-res files they paint images and
  every card follows. No address, no handle on any card (CLAUDE.md).

## How it works

- **Where the site lives** is one constant, `LASD_BASE` in
  `src/lib/lasd26/paths.ts` (`"/lasd26"`). Every link, redirect, sign-in
  callback and the invite link goes through `lasdPath()`, so the site moves
  in one edit. `LASD_ASSETS` names the static files in `public/lasd26`,
  which never move.
- **Sign-in** is Google through next-auth, the same account table as the
  rest of the site. Every page resolves the viewer once with
  `getTeamViewer()` (`src/lib/lasd26/team.ts`). The owner (role `owner`)
  sees everything; a member is a `TeamMember` row (team `lasd26`, role
  runner|crew) created by the invite.
- **Expenses** are `TeamExpense` rows in cents, seeded from the cost sheet
  by `scripts/lasd26-seed-expenses.ts` (race entry, hotel, Airbnb, two vans,
  gas and food as estimates). Receipts are uploaded straight to R2 with a
  presigned PUT, registered, thumbnailed with sharp, and served through a
  membership-checked redirect, so they are private to the team. The gas
  receipt is whoever filled up: any member can attach to any line, and
  remove only what they attached themselves (owner, 2026-10-16: "it's okay
  for them to delete their own but not other people's"); an estimate takes
  no receipts — they go on the real costs under it; a line is edited or
  deleted by whoever added it
  or the owner.
- **Buckets** (owner, 2026-10-16: "How do I let people add real expenses to
  the food/gas estimates"). An estimate line is a bucket real costs are
  filed under: `TeamExpense.parentId` points "Chevron $62" at "Gas $600".
  Only a live, top-level estimate can be a parent; a child is never an
  estimate and never a parent (`checkBucket()` in
  `src/lib/lasd26/expenses.ts`; the API answers 400). A bucket counts
  max(its estimate, the sum of its live children) — the estimate stands
  until the real costs pass it, so one early gas receipt does not drop
  everyone's share — and "includes $X of estimates" is only the part the
  real costs have not covered (`totalCents()` in `money.ts`, checked by
  `npx tsx src/lib/lasd26/money.test.ts`). Every reader of the sums selects
  `TOTAL_SELECT` (id + parentId + paidById) or it double counts. On the page
  the bucket card lists what is in it and carries "+ ADD A COST"; the
  ESTIMATE chip, the "estimate stands" line and the estimate checkbox are
  the owner's alone (owner, 2026-10-16: "we don't need the estimate line
  visible to the other users, keep that for me") — members see a plain
  category card. Deleting a bucket detaches its live children, which carry
  on as their own lines.
- **Paid by** (owner, 2026-10-16: "instead of having a note just make it a
  'paid by' and auto fill the name of the user logged in"): every real line
  carries `paidById`, the member who fronted it — the add form's PAID BY
  select defaults to the signed-in member; the seeded lines are the
  owner's. Estimates have no payer.
- **The split** is a setting (18, the cost sheet's team size), not the
  member count, so the per-person number holds while people join. Each
  share is the total divided by it.
- **Settling up** (owner, 2026-10-16: "if someone pays for something like
  gas … deduct that from their total … everyone pays their fair share …
  I would have paid x but I already spent y so now I owe z … prevent me
  from having to reimburse someone for them to just pay it back"). Per
  member: share = total ÷ split; fronted = the real lines they paid for;
  net = share − fronted. net > 0: they OWE it; net < 0: the pool OWES them
  and the owner pays them out after the race, then marks them SETTLED;
  net = 0: square (`settlement()` in `money.ts`, `dueFor()` in
  `settle.ts`). Once the owner flips "Settle up open to everyone" on
  `/lasd26/team`, estimates count for nothing and only real costs divide
  (owner: "when I make settle up go live replace the estimate costs with
  the real cost"); until then the pay page is the owner's alone. The pay
  page says it in three rows — YOUR SHARE, YOU FRONTED, YOU OWE / WE OWE
  YOU / ALL SQUARE — and takes a card only (PayPal's card button, the
  photo shop's connection) for the net, never the full share; a capture
  below the net does not settle it. The team console shows SHARE · FRONTED
  · OWES/OWED · PAID per member with Mark paid / Mark settled / Unmark.
- **Colours**: the Just Friends lime `#D0F858` is the fill and the accent on
  dark ground; on the cream paper, text and thin borders use the deep green
  `#3C7A0B` (`--safety` / `--safety-ink` in `src/app/lasd26/theme.ts`). The
  LASD26 chip in the mikianmusser.com bar wears the same lime (`--jf` in
  `src/components/home/theme.ts`).

## Setting it up

1. Push the schema once (`npm run prisma:push`) — the `Team*` tables.
2. `npx dotenv -e .env.local -- tsx scripts/lasd26-seed-expenses.ts` — the
   seven cost-sheet lines and the split of 18 (idempotent).
3. Open `/lasd26/team`, make the invite link, send it.
4. Env: `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_*` (already set for the
   shop) and the R2 keys (already set) are all it needs.

Code: `src/app/lasd26/**` (pages, `LasdPage`/`LasdBar`/`LasdAccount`/
`LasdFooter`, `SignInLine`, `theme.ts`, the `*Css.ts` files),
`src/app/api/lasd26/**`,
`src/lib/lasd26/{paths,team,money,expenses,receipts,settle,info,infoSheet,devGate}.ts`
(`devGate.ts` is idle since the info sheet went live — kept for the next
new page), `scripts/lasd26-{seed-expenses,info-fill,route-from-kml}.ts`,
models at the end of `prisma/schema.prisma`.
