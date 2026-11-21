# Row app: design notes

A running record of the walk-through with the owner. Nothing here is built until he says start.
Three kinds of line: **DECIDED** (his words), **PROPOSED** (Claude's recommendation, waiting on a yes), **OPEN** (a question).

Started 2026-11-20. Rounds 2 and 3 folded in the same day.

## Where the build stands

Pass 1 was built on 2026-11-20 (uncommitted at the time of writing). How it is put together is in `README.md`.

- BUILT and checked in a browser against the live data (read only): FEED, BOARD, STATS, PROFILE (own and anybody's), the shell with four tabs and LOG A ROW, the lifetime total and tag on the profile.
- BUILT and checked with the simulator: the numbers-only monitor, upright and sideways, its four swipe pages, the 10-second milestone line (his 2:01 example gives −2.0 s for 20:00), the row surviving a trip to another screen.
- BUILT and checked against a sandbox server by script: logging a row with two photos, and the erg recording tied to it.
- NOT DONE in pass 1:
  - Google sign-in on the phone itself (the server half exists; the button needs a Google iOS client id and the first phone build).
  - The demo copy of the live database. The sandbox used for building is the old sample namespace, not a copy of prod; the copy needs a branch made in Neon.
  - Photo upload from a browser on the app's dev port (the storage bucket refuses that address). Unaffected on a phone and on the site-served web build.
  - Anything on a real phone or a real PM5.
  - Editing or deleting a logged row from the app, and the settings page (name, Instagram): still website only.
- CHANGED on the site to make this possible: the profile, board and feed pages now call shared files for their numbers (same output), sign-in accepts an app token, and six routes were added under `/api/row100k/app/`. Saving an erg recording stays admin-only in production, as the erg pages are.

### Pass 3, built 2026-11-21 (uncommitted at the time of writing)

Search, following, private accounts, block, report, the following feed and the notification centre. How each rule was built is under **Social** and **Notifications** below.

- BUILT and checked by script against a local sandbox database, 39 checks (`npm run check:social`) and 8 (`npm run check:notify`), all passing: search by name, handle and number; follow at once (public) or by request (private); accept and decline; the bell per rower; the following feed; a private page locked for a stranger and for a signed-out visitor, open for an accepted follower; a private row refused by its id; a private rower still on the board; block in both directions; report; the settings; told when a followed rower rows; one "passed you" line a day.
- BUILT and looked at in a browser at phone width: the two glyphs in the top bar (search, the bell with its count), the notification centre with a request's ACCEPT and DECLINE, search, a private profile with REQUESTED, the MORE menu, the report sheet, settings, the EVERYONE / FOLLOWING chips.
- The website's own feed and rower page read the same rule, so a private rower's rows are gone from the site too.
- NOT DONE:
  - PUSH to the phone. The server half exists (a phone registers a token at `/api/row100k/app/push`; every line is also sent through Expo's free push service, in production only). The app half needs the `expo-notifications` package and the first phone build, and cannot be tried in a browser.
  - Reports on the site's moderation page. A report is stored (`RowReport`) and mailed to the owner the moment it is made; nothing lists them on the site yet.
  - Anything on a phone.
- NEW TABLES, six, all additive: `RowSocialSetting`, `RowFollow`, `RowBlock`, `RowReport`, `RowNotification`, `RowPushToken`. They reach the live database with the production build that carries this code, and not before. Until then this branch's sandbox runs on a local database (`scripts/dev-app-db.mjs`, README).

## Follow the website's look

- DECIDED (round 6, 2026-11-20): the app's screens follow what the site already settled on. "I would strongly encourage you to review the current site for style guides and UI/UX ... I dont like the 'the 100k' header, we dont have that on the site, we also use a different ui to select what record and time frame we are looking at. Those things we have already iterated on while designing the website can come over."
- DONE the same day: board, stats, profile and feed rebuilt from the site's own pieces (`mobile/src/site.tsx`): the dateline with a square a day, word menus on a dotted rule for the month and the record, the lead figure with its holder line, tinted tables with dashed rules, the by-day calendar, the profile nameplate, odometer and ledger, the feed strips.
- Rule for new screens: look at the site's version of the thing first and bring its layout over; invent only where the site has nothing (the live monitor, the lifetime line).

## The journey of one row (round 6)

His walk-through, in his order. Each step says what the app does today and what is proposed.

1. BEFORE THE ROW: opens the app to check stats, current metres, who has passed them, how many more they need.
   - Today: FEED opens first; BOARD shows place and metres; PROFILE shows the month and all time. Nothing says who passed you or how far to the next person.
   - PROPOSED: a "your line" at the top of BOARD: place, metres this month, metres to 100K, the gap to the rower above, and who passed you since your last row.
   - OPEN: which tab the app opens on.
2. DURING: pulls out the phone, connects the erg, rows with the screen on, showing performance targets.
   - Today: connect, then the numbers-only monitor with the line to the next 10-second mark.
   - PROPOSED: the screen stays awake for the whole row; the app remembers the last monitor and offers it first.
3. RIGHT AS THEY FINISH: submits the row.
   - DECIDED: LOG and DISCARD are not on the rowing screen. "Put the log x meters and discard on a sep screen (swipeable) and or have them only pop up when the rower is either just starting or just finished, prob just finished."
   - DONE: both. While rowing the screen is numbers only. The buttons come up by themselves when the monitor says the piece is over, when the connection drops, or when the metres have stood still for six seconds. They are also always on the last swipe page.
   - The two photos sit between the finish and the animation (the server will not take a row without them). OPEN: see questions.
4. THE ANIMATION: their metres going up, and who they have passed.
5. THE SHAREABLES MENU.
6. THE ROW'S STATS: everything from this row if the erg was connected; "prob the same screen but with less stats if they didnt".
7. THEN they might share the stickers and the reel video overlays.
   - PROPOSED for 4 to 7: one page for a row. Opened fresh after logging it plays the animation at the top, then the share strip, then the stats; opened later from the feed or a profile it is the same page without the animation. Every row gets one, erg or not.

### Answers, round 7 (2026-11-20)

- DECIDED: the app opens on the BOARD.
- DECIDED: "who passed me" means since you last opened the app.
- DECIDED: the two photos stay required with the erg connected, and the photo step stays as it is: a slot opens the library, CAMERA beside it takes one. The camera is not opened for the rower.
- DECIDED: tapping a row opens that row's page ("the commentary on that row, that post row screen"), and the shareables are used from there.
- DECIDED: the stickers are the site's transparent cards. The reel overlays are videos of the numbers, made to be stitched into an edit in another app; the app does not composite onto the rower's footage.
- DECIDED: the mark on the cards is ROW ("Lets try it w/ just ROW").
- DECIDED: get the cards working whatever it takes, without adding cost if possible. Stickers first, then the reels. "The cards should be doable b/c we get them w/ strava."

### Built from round 7 (2026-11-20, uncommitted at the time of writing)

- BOARD opens first, with YOUR LINE under the dateline: place, metres, metres to 100K, the gap to the rower above, and who passed you since you last opened the app (the last board is kept on the phone and compared).
- THE ROW PAGE (`src/screens/RowPage.tsx`): after logging it opens with LOGGED (the metres count up, the month bar and the all-time bar fill from where they were, a new tag or the 100K CLUB is stamped, and the climb shows who was passed and the gap to the next rower), then the row, its photos, STICKERS, REEL OVERLAYS, the erg's averages and THE READ. Tapping a row in the feed or a profile log opens the same page without LOGGED.
- STICKERS work. The site's own card code runs on the server (`src/app/row100k/share/serverCard.ts`, `/api/row100k/app/cards` and `/card`) and answers transparent PNGs; the app shows them and hands them to the share sheet. No added service: one free package (`@napi-rs/canvas`) on the existing host. The mark on every card is now ROW, on the site's cards too, and a card that names the month says November.
- REEL OVERLAYS are built the same way: the site's reel painter run frame by frame on the server and encoded to MP4 by a free WebAssembly encoder (`src/app/erg/reel/serverReel.ts`, `/api/row100k/app/reel`). Six clips, on green, blue or black, 5, 10 or 15 seconds. A ten-second clip took about 19 seconds to film in a test off a real saved row.
- The screen stays awake while the monitor is up.
- VERIFIED 2026-11-20, later: the film route over the network, once the encoder was installed. A ten-second story clip came back as a 3.2 MB MP4 in about 20 seconds.
- NOT VERIFIED: the share sheet on a real phone; either renderer on the live host; how long a clip takes there (the route allows 60 seconds).
- Reels stay behind the erg gate: admins only in production, as the site's reel page is.

### How the site makes its shareables today (found 2026-11-20)

- Every share card, poster and reel is drawn in the BROWSER on a canvas (`src/app/row100k/share/cards.ts`, `poster/`, `erg/reel/`). Nothing on the server returns a card image or a reel video.
- A phone app has no browser canvas, so it cannot run that drawing code directly. Two ways to get the same cards without drawing them twice:
  - PROPOSED: a server route that runs the same card code and answers a PNG. The app shows the image and hands it to the phone's share sheet. One set of drawing code, usable by the site too.
  - Alternative: a hidden web view inside the app that runs the site's card code and passes the picture back.
- Reels are harder: they are recorded live in a browser tab (a canvas filmed at 30 frames a second), on a green screen for keying, and that recording does not work reliably inside an iPhone app. They are also admin-only in production today. OPEN: what the app does for reels in pass 2.
- The mark on every card comes from one place (`MARK` in `src/lib/row100k.ts`) and says ROWVEMBER in November. Under the month-names rule it should say ROW or ROWTEMBER. OPEN: which.

## Words and names

- DECIDED: "logged", never "banked". Button, banner, empty states, code names.
- DECIDED: the log button reads `LOG 5,000 M` (the live metres).
- DECIDED: months wear their normal names. The event and the app are Rowtember; the months are September, November.
  - DECIDED (round 4): the website follows. Months are spelled normally everywhere except shareables, which say ROW or ROWTEMBER. ROWVEMBER is retired as a name. Recorded in `CLAUDE.md`; the site's code has not been changed yet.
- DECIDED: the branding is ROW, and the app's icon is the ROW logo (the O in the blue; files in `public/row100k/row/`). `app.json` still says `Rowtember` as the display name; change it to `ROW` when work starts.
- DECIDED: the app is called ROW if it can be.
  - Fact to check, not yet checked: the App Store does not allow two apps with the same listing name; Google Play does. The name under the icon on the phone is a separate field and can be plain ROW either way. If "Row" is taken on the App Store the listing becomes something like "ROW: Rowtember" and the phone still says ROW. Check when the Apple developer account is open.

## Removed

- DECIDED: no daily 5k goal. Drop `dailyGoal` from the profile, the row screen and the feed.
- DECIDED: no streak. In its place, the focus is total metres rowed.
- DECIDED: no animated pace wheel on the live row. Numbers only.
- DECIDED: the feed has no header (today's metres, x of 100K bar). Just the feed.
- DECIDED: no choosing a pace or time target, for now.
- DECIDED (leaning): no likes and no comments for now. See "Social".

## One app, one build of each page

- DECIDED: nothing the website does today may be lost. Profile charts, posters, plan, settings and the rest come over, slowly if need be.
- DECIDED: build a thing once and it shows up on both. No state where the site has something the app lacks. Every page is reachable from the app.
- DECIDED: one app for everything. People download it once; other projects' pages (not only Rowtember) can be pushed into it as needed.
- DECIDED (round 3, replaces the all-shell proposal): the app should feel as native as possible and must not feel like a web page. He will say explicitly which items move into the app. He accepts the app and site being separate builds and some extra work; what he does not want is to design everything twice or be limited.
  - DECIDED (round 4): be selective. Only the pages he names are built into the app; nothing else is reachable from it. No site pages shown inside the app. The website keeps everything it has, so nothing is lost.
  - DECIDED: keep and maintain both the website and the app for now. A possible later path, not a plan yet: the website becomes a landing page and the app becomes the application.
  - What is shared so the work is not doubled: one set of server routes for the data (the site and the app read the same ones), the erg and analysis code (already copied by `npm run sync:pm5`), and one sheet of colours, type and sizes. A design decision is made once here and built in both.
  - Sign-in is native Google sign-in, exchanged with the site for the same account.

### Build order (DECIDED, round 4)

- Pass 1, in this order: profile, log a row, board, stats, feed. This is most of what the website does today.
- Pass 2: posters and shareables, the post-row screen and its animations.
- Pass 3: search, notifications.
- PROPOSED additions he did not list but the passes need:
  - Before pass 1: the demo copy of the database, sign-in, and the server routes the app reads and writes through.
  - In pass 1 with log a row: the redesigned live monitor and the photo step.
  - In pass 3 with search: follow, private, accept, block, report, the following filter on the feed. Following is useless until people can be found, so it travels with search. Block and report must exist before the App Store sees the app.
  - His to do, not code: an Apple developer account ($99 a year). Needed to put the app on his own phone against a real erg, and for notifications.
- DECIDED: other projects' pages appear only for people invited to them, switchable from settings or the profile.
  - PROPOSED: PROFILE has a YOUR PAGES list (LASD26 team, a TSP team, ...). An invite link opens the app and adds the page to that list.
- DECIDED: iPhone first.

### Site pages the app must reach (inventory, from `src/app`)

Public or rower: front, board, feed, gallery, stats, analysis, records, rower page `r/[num]` and its poster, posters, shareables, plan, settings, post (log a row), join, sign-in, race day and results, partners, raffles, shirts, blackout, erg console, erg saved sessions `erg/s/[id]`, erg sessions list, erg reel.
Owner or dev: dev stats, dev rowers, dev plan, dev posters, dev shirts, race-day results (dev), emails, moderation, signups, race admin, shirts admin, shop admin, preview, pm5 and telemetry.

## Shape of the app

- DECIDED: buttons at the bottom, LOG A ROW top right.
- DECIDED: the board stays. And the stats page must not be buried under the 100K board each month.
  - PROPOSED: four at the bottom: FEED · BOARD · STATS · PROFILE. Board and stats each get their own place, so neither sits on top of the other.
- DECIDED: a row in progress survives leaving the screen.
  - PROPOSED: the live row lives above the tabs. Leave it and a thin strip sits over the tab bar (`ROWING · 2,340 M · 9:41`); tap to return. Needs Bluetooth background mode and keep-awake.
- DECIDED: a search to find other rowers; place not settled ("probably in the top bar??").
- PROPOSED: top bar on tab roots is the ROW mark small on the left; on the right a magnifier (search rowers by name or rower number), a bell (notification centre) and LOG A ROW. Pushed pages show a back arrow and a title. Hidden on the live row.

## Live row

- DECIDED: page one is numbers only. Average pace is primary, current pace beside it, plus metres and total time.
- DECIDED: two layouts, sideways and upright. Sideways is the main one.
- DECIDED: read the set piece off the monitor (a 5k, any fixed distance) and show what they are rowing for. The parser already has it (`mobile/src/pm5/pm5.ts`, `session.ts`).
- DECIDED: no target is chosen. The app knows the distance and the pace so far, finds the milestone the rower is closest to, and says what it takes to hit it.
  - His example: 2,500 m into a 5k averaging 2:01. Elapsed is 10:05. 20:00 leaves 9:55 for 2,500 m, which is 1:59.0 per 500 m, 2.0 s faster than the average so far.
  - DECIDED: the line is the change, not the pace to hold. Under the big `2:01.0` it reads `−2.0 s FOR 20:00`.
  - The sum: needed pace = (milestone time − elapsed) ÷ metres left × 500; the line shows needed pace minus average pace.
  - DECIDED: milestones are every 10 seconds of finish time, always, at every distance.
  - PROPOSED: show the next 10 s mark faster than the projected finish. When the projection crosses a mark the line moves to the next one.
- DECIDED: other timing modes are Claude's call, or better, one catch-all "free play" monitor that always works whenever an erg is connected.
  - PROPOSED: one monitor for every mode. Average pace, current pace, metres and time always show. A set distance adds the milestone line and metres left. A set time shows the metres it is on pace for. Intervals show the current interval's numbers and count the rest down. A plain row shows the four numbers and no line.
- DECIDED: other pages swipe sideways.
  - PROPOSED pages: (2) rate, watts, heart rate, drag; (3) pace line, y axis locked to ±5 s around the average; (4) splits so far.
- DECIDED: any pace chart shows about ±5 s around where the rower is.

## After a row is logged

- DECIDED: first pass of the read is not bad. Keep it.
- DECIDED: needs a celebration: the bar filling, climbing the board, a dopamine hit.
  - PROPOSED: LOGGED screen first: metres count up, the month bar fills from before to after, the board row slides up past the names just passed ("passed 3, now 14th"), a new tag or best stamped on.
- DECIDED: needs shareables, and the video ones are the erg reels (`/erg/reel/[id]`, e.g. rowtember.com/erg/reel/latest).
  - PROPOSED: the LOGGED screen ends on the cards and the reel for that row, each with one button that saves it or hands it to Instagram.
- DECIDED: more graphs and stats, as on the erg monitor page. In the shell plan this is the site's own saved-session page (`/erg/s/[id]`), so it arrives whole.
- Split colours today (`Review.tsx:216`): green fastest, light blue slowest, ink the rest, with no legend.
  - PROPOSED: all ink, the fastest in the blue with FASTEST under it. No green.

## Photos and the feed

- DECIDED: the feed is every row so far, newest first, with no month cutoff.
- DECIDED: each entry shows name, metres, time, the photos, and the stats when the row came off an erg.
- DECIDED: photos are attached when the row is logged. Two per row at most. No video.
- DECIDED: rows can still be logged by hand. A photo is required on every row, by hand or off an erg.
  - DECIDED (round 5): exactly two photos on every row.
- DECIDED (round 5): a report function, to comply with Apple.
- DECIDED (round 5): the STATS tab is the stats page for everyone; personal stats are on the profile.
- DECIDED: an old row with no photo is left alone; the card handles a post with no photos.
- DECIDED: the feed opens on everyone, not on following.
- DECIDED: the feed can be switched to only the people I follow.
- DECIDED: photos of different shapes have to sit well.
  - PROPOSED: one photo fills a frame in its own shape, clamped between 4:5 (tall) and 1.91:1 (wide), centre-cropped past that. Two photos sit side by side, each cropped to 4:5. Tap opens the whole photo. A row with no photo is a short text card.

## Accomplishments

- DECIDED: total metres rowed is the number to lean on.
- DECIDED (to consider): a tag for lifetime metres (10K, 50K, 100K, 250K, 500K, ...) and something for hitting 100K in a month. Look not settled.
- DECIDED: he likes the ladder of lifetime-metre stamps.
  - PROPOSED: one small chip beside the name wherever a name appears (feed, board, profile), showing the highest rung reached; the ladder continues 1M, 2M, 5M. Announced on the LOGGED screen when earned.
- BENCHED (round 4): collecting months, as probably out of scope for now. Kept below for later.
- OPEN (his, unsettled): how a 100K month is marked. He wants people to want to collect months. Thoughts so far: prestige tiers that grow each time, as game profiles do (but there is no border to grow); or a gym stamp card, one stamp for every month of the year, which can then be prestiged.
  - PROPOSED, to react to: a stamp card on the profile with twelve places, January to December. Hitting 100K in a month stamps that month. The count of stamped months is the number people collect and is shown beside the name (`×7`). Filling all twelve places retires the card: it becomes one solid mark with the year on it and a fresh card starts, so the row of finished cards is the prestige. Months before the app count, from the rows already on the site.

## Social

His list, all DECIDED for the first pass unless marked:

- follow someone
- set my account private
- accept (or decline) a follow request when private
- block someone
- see only who I follow in my feed
- turn notifications on or off per person
- a notification centre
- He is unsure how much of this the first pass needs; the three he cares most about are private accounts, the feed filter, and notifications only from people he cares about.

Rules DECIDED in round 3:

- New accounts are public. Everyone starts following no one.
- A private rower still appears on the board. Their individual rows are not shown to people they have not accepted.
- A private account's page still shows: name, rower number, Instagram, total metres, hours, average split, number of sessions.
- Blocking removes someone from my feed and from my view of their profile (and mine from theirs). They stay on the board.
  - PROPOSED: private has to hold on the website too (the rower page, the feed, the gallery), or it is private in name only.
- DECIDED (round 4): anyone can see who a rower follows and who follows them.
- DECIDED: a private rower's rows are hidden from the feed and from their profile.
- DECIDED: on a public profile every chart is visible to everyone.

How it was built (2026-11-21). Each is Claude's call where his words did not settle it; say so and it changes:

- The one rule is `src/lib/rowSocial.ts` on the site. The feed, a profile, a row's page and the website's own pages all ask it.
- SEARCH and the BELL are two glyphs in the top bar, beside LOG A ROW, so the four words at the bottom stay four. Search takes a name, an Instagram handle or a rower number; with nothing typed it lists everybody in number order.
- FOLLOW is one button: FOLLOW, REQUESTED (a private rower has been asked; a press takes it back), FOLLOWING (a press stops).
- A PRIVATE page keeps the name, number, Instagram, the month's and the all-time metres, hours, average split and sessions, and shows no rows, bests, calendar or charts. A private row opened by its address answers "that row is private".
- NOBODY IS EXEMPT, admins included: an admin sees a private rower's rows by following them. (A report mails the owner what was reported, so moderating does not need it.)
- GOING PUBLIC accepts every request that was waiting. Going private keeps the followers already there.
- The FOLLOWING feed is the rowers I follow and my own rows.
- A BLOCK ends any following between the two, clears what each had been told about the other, and hides the blocker from the blocked rower's search. The blocked rower is not told; a follow they send reads as "requested" and never arrives. Unblocking does not bring a follow back.
- REPORT is on anybody else's profile (MORE) and at the foot of anybody else's row. Five reasons and an optional line. Stored, and mailed to the owner at once.
- OPEN: should the lifetime tag show beside names in search and the people lists? Left out for now: for a rower hidden by lights out it would give the month away.

Likes and comments, weighed (he asked to decide; he leans no):

- For likes: one tap, no moderation, the cheapest dopamine for the person who rowed, and something to put in the notification centre.
- Against likes: a row with zero likes looks worse than a row with no counter at all, and the crowd is small today.
- For comments: real conversation, the strongest reason to come back.
- Against comments: they need reporting, moderation and someone watching; abuse lands on the owner; quiet threads make a small community look empty.
- PROPOSED: no comments. No likes in the first pass. Leave room on the row card so likes can be added later without a redesign, and revisit once following exists and the feed is busy.

Needed whether or not there are likes:

- Fact: Apple requires any app showing other people's photos and names to offer a way to report content and to block a user. Blocking is on the list; REPORT is not and must be added (a row or a photo, sent to the owner's email, shown in the site's existing moderation page).

## Notifications

- DECIDED: one when I get passed on the board, and only when the person passing is someone I follow.
- DECIDED: frequency is at most once a day, OR whenever someone I follow rows (the two are still being weighed).
  - PROPOSED: both, as separate kinds. "Passed" is batched to one a day ("3 rowers passed you today"). "Someone you follow rowed" fires per row, only for people whose bell is on.
- PROPOSED also: follow request, request accepted, a new tag or month stamp earned. Each kind has its own switch in settings.
- DECIDED: a notification centre lists them all.
- BUILT (2026-11-21), as proposed above, both kinds, each with its own switch in SETTINGS:
  - ROWED: one line for each row by a rower I follow whose bell is on.
  - PASSED: one line a day. The first rower I follow to pass me that day makes it; later ones that day are added to the same line ("and 2 others you follow passed you"). Only on this month's board, only when both of us opted in.
  - FOLLOW, REQUEST, ACCEPTED. Requests and their answers cannot be switched off.
  - No metres in any line, so a rower hidden by lights out stays hidden; the line opens the row or the board. PASSED is not sent at all while a lights-out window is open.
  - NOT BUILT: "a new tag or month stamp earned" (the LOGGED screen already announces it to the rower).
  - The bell counts unread lines plus requests still waiting. Opening the centre marks everything read.

## Demo environment

- DECIDED: demo is a full copy of prod that can be read and written freely without changing prod.
  - PROPOSED: a branch of the live database (the host, Neon, makes a full copy in seconds that shares nothing going forward), a demo deployment of the site pointed at it, and the app switching between LIVE and DEMO from a setting only the owner sees. Refresh the copy on demand. In demo, new photos go to a separate folder and no emails or notifications go out to real people.
  - This replaces the 100 fake rowers in the `challenge` demo namespace for app work.

## Sign-in

- DECIDED: Google, the same account as rowtember.com.

## Questions waiting on the owner

See the conversation of 2026-11-20, round 2; answers get folded in above.
