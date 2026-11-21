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

### Round 8, 2026-11-21: his read of pass 3, and what changed the same day

All DECIDED (his words, spoken), and BUILT unless marked. Where a line here disagrees with something further down, this one is the later word.

The shape of the app:

- "I really like how Instagram's app is set up." The top bar is PLUS (log a row) on the left, ROW in the middle, the BELL on the right. "The Log a row button can be condensed into just a plus."
- The bottom is five glyphs, no words: feed, search, board, stats, profile. "If we have that blue square in the back, then have it slide, animate, across from one to the other."
- The bell's count sits inside the bell, which fills with the blue: "I don't like the square used for the number."
- On a profile the mark becomes the rower's number: "ROW turns into 001 ... a nice little animation." Built as three wheels rolling over, the middle one keeping the blue.
- On your own profile the right of the bar is the three-line menu, which opens SETTINGS; on somebody else's it is three dots (block, report). "Settings should probably just be like ... how do they have it on Instagram." Settings no longer appear in the notification list.

The board: "the board is just for seeing the 100K challenge, like rankings."

- CUT: the viewer's own metres big and blue at the top, with "X m to 100K" and "X m behind Y", and with it "N rowers passed you since you last looked" (asked for in round 7; gone on his word here; it could come back as a line in the notifications). "There's no blue large number callout on the board on the website. So let's not have it there in the app either."
- CUT: "THE NOVEMBER 100K · 51 IN" and the "# ROWER METERS" heads. Kept: the dateline with its squares ("fine for now"), the tier names ("fine for now").
- STANDING INSTRUCTION, also in the repo's `CLAUDE.md`: "please reference the website before you try to redesign a UI."

Search: "rower 01, first name, last name, meters, Instagram handle. That's it."

- No follow button on a line (the line opens the rower), no PRIVATE label, no FOLLOWS YOU, no tinted rows. The right of each line is the rower's lifetime metres (not shown for a rower lights out is hiding).

The profile: "we really just reference the website."

- CUT: the all-time line with the lifetime tag and the metres to the next ("the 250K ... at least how it's presented here, it doesn't make sense"), the PRIVATE label, the underlines on the two counts, the MORE word.
- The name is one line, shrunk to fit, cut short only if it still will not: "the name can't be on 2 lines."
- FOLLOW moved to the right of the followers / following line, small, with the bell beside it once following.
- The big number shows one faint zero in front, not a fixed seven wheels: "only show 7 digits if there's 6 digits worth of meters rowed."
- Rank on a profile stays within the rower's own division: "on your profile we can show of your gender."
- OPEN (his, musing): colouring the rower number by lifetime metres in place of the tag ("is there enough cool colors to color their rower number? Is that crazy?"); and the profile's top split Instagram's way into sessions, following, followers ("that would be something. But until then, that's fine").

Notifications and settings:

- CUT: a line every time a followed rower logs a row. "Let's just remove that top one. You can't get notified when someone logs a row. That's fine." What is left: PASSED (one a day), FOLLOW, REQUEST, ACCEPTED. The bell on a rower's page stays ("we want users to be able to turn off notifications from that").
- A follow request is one line with CONFIRM and DELETE at its right ("looks like a high school computer science student made it", of the first try).
- The stock switch is gone; the switch is drawn in the app's own shapes ("the beige background with the blue and the green dot, not good").
- DARK MODE, to look at: "does the app look terrible if it's dark mode? Let's see"; "I would like a dark mode version ... it's that matte blue is what we currently have." A switch in SETTINGS, kept on the phone, off unless switched on (cream stays the default). Ink ground, cream type, the site's on-ink blue `#1A90D4`.

The owner's tools: "give me the ability to remove posts and photos ... sometimes maybe I don't remove the row, but I remove the photo"; "I need to be able to delete a rower." Shadow banning: not now ("is this really worth it?").

- At the foot of any row, for an admin only: REMOVE PHOTO 1, REMOVE PHOTO 2, REMOVE THIS ROW, each asking once.
- In the three dots on a rower, for an admin only: DELETE THIS ROWER, which wants the rower's number typed first. It takes their whole log and cannot be undone from the app.
- Removing a row and deleting a rower are the site's existing routes; removing one photo is new (`/api/row100k/app/moderate`).

Going live: "commit what's there now to live, then work on it, then commit again and push to live." Both pushes went to main on 2026-11-21. The app itself is still in development: the web build is unlisted, and the routes only it writes through (follow, block, report, settings, notifications) answer admins only in production until he says it is live (`SOCIAL_LIVE` in `src/app/api/row100k/app/social.ts`).

### Round 9, 2026-11-21 (night): his second spoken read, and what changed

All DECIDED (his words), BUILT unless marked. Later than round 8 where they disagree.

The frame:

- The bottom bar copies Instagram's: "white on black icons, rounded bars at the bottom, a highlight that follows each of the buttons. Everything's nice and rounded." The first icons were "a little interesting ... not really sure what it's meant", so they are now the usual pictures: house, glass, podium, rising line, person.
- The roll of the mark is to be used more ("one of the coolest transitions ... how can we make that a thing in other places?"): LOG on the log screen, the rower's number on a row's page, and every meter anybody has rowed on the stats tab (with the M in the blue).
- A screen opened over a tab "should swing in from the right", and "I obviously want to swipe to go back a page".
- No spinner for a thing already seen ("why is there a loading screen, especially after we've seen it once?"): every answer is kept while the app is open and drawn at once; the tabs, settings and notifications are read ahead as the app opens.
- Switches: "like the Apple on-offs, but I don't want it to be green ... a little oval". Dark mode: "not bad ... I just don't like it a lot"; left as it is.

The feed: "I want one page that can forever scroll just like every other social media site, and I want it to consider my friends or who I'm following first, and then everyone else."

- One list, no EVERYONE / FOLLOWING buttons. BUILT as: the last seven days of the rowers I follow (and my own), newest first, then everybody else. Seven days is Claude's number.
- No day heads with their totals. Meters and figures above the photos. No arrow on the figures.
- Three dots on every row: the row, the rower's page, follow or unfollow, notifications on or off, MUTE (new: leaves their rows out of my feed and nothing else), report. For an admin, remove a photo or the row sits in the same sheet ("that doesn't belong there", of links at the foot of the row page).
- A photo opens both on black with a swipe between them, an X at the left and the three dots at the right.

Following and notifications:

- The bell for a rower is OFF until turned on ("it's off by default"), from the three dots on their page or on a row.
- "Let's make sure we're not sending any emails to anyone. Let's just do on-phone notifications for now." Nothing in the app's social layer mails a rower. A report still mails the owner.
- My own FOLLOWING list has a button to unfollow on each line.

The profile:

- Bests after the field, and only the ones rowed. The erg section stays for now and each line opens its row.
- Under the big number: "Meters · November 2026", the month being the menu. No "hours on the erg" there, no rank, no 100K club, no LOG A ROW button.
- Small photos on each line of the log.
- The two standings (average row, average pace) sit side by side.
- Charts: touch and drag reads them out; long tails are cut but never one of the rower's own rows; chart titles are plainer. The pace chart is by row, the last 20 with 50 and ALL to widen, pace labels every 10 seconds, far outliers left out and said so.
- OPEN (his): "there should be a way for us to denote the prestige of rowers."

A row's page: name and date in two tight lines, the meters and the pace as the two big numbers, stickers behind a SHARE button. The stickers open on one screen, swiped through, with COPY and SHARE. The lights-out sticker is out of every menu.

Board: WARMING UP is one line ("this many rowers warming up for this many meters"). Stats: no month-and-total stamp at the top; SEE THE WHOLE BOARD under the top fives; the two hour charts together. Search: the keyboard comes up, and with nothing typed it lists the ten with the most lifetime meters.

Logging: the time is one field as on the website; both photos picked in one visit, the frames unlabelled; "meters" spelled the American way everywhere. Default titles say the month's ordinary name, and old "Rowvember #n" titles print as "November #n" (nothing stored is changed). The monitor says ON PACE FOR m:ss and shows the split now to the second; the line that said seconds to give up for a mark is gone; the pace page has labels on both axes.

NOT DONE from this round: shareables on the stats page; the cause of stickers looking blacked out after a row (not found).

### Round 10, 2026-11-22: his third spoken read

All DECIDED (his words), BUILT unless marked.

- PROFILE PHOTOS: "I think the answer is yes, we do profile photos. Okay, set it up." A rower sets one in SETTINGS; it shows beside their name in the feed, search, people lists, notifications, a row's page and their profile. With none, their initials in the blue ("what happens when someone doesn't fill it out?"). Stored as `avatarKey` on `RowSocialSetting`; the owner can take one down from the three dots on a rower. Public like a name, private account or not.
- The feed's rows are CARDS: "there needs to be some depth ... right now it looks very flat ... each post needs to be carded."
- Sheets (the three dots) "animate up from the bottom."
- Search: the top ten wear the board's bars, the first full and the rest in proportion; the mark on that tab reads SEARCH with a blue glass after it.
- Stats: FULL RANKINGS is its own page, one table, men and women together, with the month and the record as the two words at the top ("a different view"). KDE charts on the stats tab show every row as a mark under the curve. The pace chart's foot is in meters rowed, not dates.
- A photo in a profile's log opens the viewer over every photo in the log, older ones after it.
- Row page: the "logged by hand" sentence is gone. Stickers were slow because every sticker request rebuilt the rower's whole profile; that is now done once a minute per rower, and the page fetches the stickers as it opens.
- NOT BUILT, on his own second thought: the meters rolling up beside a name in the feed ("I feel like that is not a good idea. I feel like it'll be too much. I could be wrong though").
- LEFT ALONE: the owner's remove tools ("it's definitely okay enough"), dark mode ("I am not sure what to do about dark mode there, but it looks okay").

### Round 11, 2026-11-22: his fourth spoken read

All DECIDED (his words), BUILT unless marked.

- SEARCH: the field is in the top bar with the blue glass at its left ("maybe that's where the search text box actually goes"); the keyboard waits to be asked for and goes away when the list is dragged ("the same behavior as Instagram"); clearing shows the ten at once; a RECENT section of the rowers lately opened from search, kept on the phone.
- Every screen's name in the bar is in the mark's bold face with ONE letter in the blue ("always have one item blue in it ... retain that same font"): the first O, or the middle letter.
- No spinner when switching tabs ("it looks like the data's already there"): the spinner is for a pull only.
- The three dots over a row's photos open their sheet OVER the photo ("shouldn't go back to the page"). Signed out, the sheet says to sign in to follow or report.
- SHARE: on the rower's own profile at the right of the handle line; in a row's three dots on the feed; in the sticker viewer SHARE is at the left and COPY at the right and filled ("copy should be the primary"); a press beside the sticker closes it.
- TWO NEW STICKERS, from his description of another sports app's: THE RECEIPT (a line a figure with dots between: meters, pace, time, and watts and rate off an erg, the date) and 500 M SPLITS (a bar a split, the fastest whole; erg rows only). He asked for "like 3 of them, and then we can go from there"; the third is waiting on the screenshots he said he would send.
- Feed cards: corners less round; the meters at the left with the pace and time at the right of the same line.
- Full rankings: EVERYONE / MEN / WOMEN. Stats opens on ALL TIME.
- Log by hand: meters and time side by side.
- Profile photo: the phone's own crop-and-zoom step when choosing one ("I need to be able to size it").
- LEFT ALONE: dark mode's blue ("I'm just not happy with it", no direction yet). An old erg piece that was never tied to a logged row has no page to open; the ones tied to a row open it.

### Round 12, 2026-11-22: his fifth spoken read

All DECIDED (his words), BUILT unless marked.

- The board's mark is 100K, the K in the blue.
- A sideways swipe on a tab goes to the tab beside it ("on Instagram ... I can swipe").
- On the feed, reading downward folds the top bar away and draws the bottom bar in; they come back on the way up. The top bar has no rule under it. The bottom bar floats over the page.
- Photos: opening one in the feed and swiping carries on through every row's photos; a tap at the right goes on, at the left goes back; the dots at the foot are gone and a small stamp (number, name, day, meters, title) is there instead.
- A row's page has AGAINST YOUR USUAL for every row, erg or not: this row's split and length beside the rower's averages, and its place among their rows of the same distance.
- An erg piece on a profile that no logged row is tied to opens its own read. His Sep 23 5,000 m session was tied to its row ("Rowtember #83") on the live site with `scripts/erg-link.ts`; the Sep 17 one was left, on his word.
- Stickers: the splits one carries the average split; two more, THE PACE (the split, as big as the card) and THE SHAPE OF IT (the 500 m splits as a line, erg rows only). "The two stickers that you made are pretty good ... give me two more."
- NOT BUILT: a closer copy of Instagram's bar ("right now it looks more Android-like"): needs his eye on what is off. The owner's remove tools stay as they are ("nah, it's fine"). The look, light or dark: "I need to user test."

### Round 13, 2026-11-22: his sixth read, with screenshots

All DECIDED (his words), BUILT unless marked.

- THE GOAL, in his words: "my goal for the app with UI design is to get users to want to row more. I want them to be engaged ... maybe this is something I should do daily, or at least I want to hit the 100K. So we need to make making the 100K as appealing as possible."
- A BEST on a profile opens the rower's own ranking for it: every 5K by time, every 10K, every row by length, every day by meters, all time, with a word at the top to switch ("a page that ranks my rows in order of my fastest 5Ks ... we can just rank").
- The bottom bar after Instagram's, which he sent: see-through dark, a soft capsule under the open tab instead of a blue square, the rower's own face for the profile.
- The bars step aside on every tab while it is read downward, not only the feed.
- Stickers, against the other app's that he sent: THE SHAPE OF IT is scratched ("the graph on the right needs some work. Let's scratch that one"); the splits one is thin bars with the distance before and the time after, the average and the mark under them ("it just looks a little cluttered"); THE PACE stays ("I like the middle one"); two after his references, THE STACK (each figure under its name) and THE TAGS (each figure in a capsule).
- NOT BUILT: a top bar the page shows through. It folds away as a screen is read instead; a see-through one means every screen starting under it, which is its own piece of work.
- OPEN: the long lines on the profile's log that wrap (he sent the profile, where the cause was not visible); following every rower by default ("do I actually want that? Nah, it's okay").

### Round 14, 2026-11-22: like, comment, share

All DECIDED (his words), BUILT on the sandbox unless marked.

- LIKE, COMMENT, SHARE under every row, in the feed and on the row's page ("I've officially bit the bullet. I think we want like, comment, share on the posts. And that way, that's where that share button can go"). Three marks in a line as on Instagram: the heart and the bubble each with its count, then share, which opens the stickers. The blue Share pill at the top of a row's page is gone; share is the third mark.
- REPLIES ("allow me to reply to comments. I really want it to work just like Instagram's"): the comments come up from the foot of the screen; a comment has Reply under it, replies sit indented under the comment they answer (one level; a reply to a reply is filed beside it), and the field says who is being answered. Its writer, the rower whose row it is, or an admin can remove one; anybody else can report it.
- NOTIFICATIONS for them: "liked your row", "commented on your row", "replied to your comment", each leading to the row (a comment or reply with the comments up). Two new switches in settings: likes, and comments and replies. Never for a rower's own like or comment, never across a block. On-phone only, no email.
- The keyboard goes away when a rower is opened from search ("when I ... click on someone, the keyboard stays up").
- A PACE NEEDS NO UNIT ("if we're denoting a pace, we don't need to say /500"): gone from the row stickers (receipt, pace, stack, tags), from the feed card and from the row's page.
- The splits sticker loses its title; the stat line (meters, time, average) is at the top where the title was ("we actually don't need the title 500-meter splits ... let's just put the stat line at the top").
- Later the same day, of the built row of marks: "likes and comments on the left, shares on the right" (first "evenly spaced", then "off to the left I think is fine"). Counts beside the heart and the bubble; the share mark has none.
- A COMMENT CAN BE LIKED ("allow me to like comments as well"): a small heart at the right of each, its count under it; the writer is told, under the Likes switch.
- TAGGING ("allow users to add other users": "I meant tagging someone in a comment"): an @ and the start of a name brings up to five of the roster over the field; the name is written in, shows in the blue, opens that rower, and they are told ("mentioned you in a comment", under the comments switch). A reply opens on the @name of who it answers. In the database a tag is @[rower number], so it follows a changed name.
- Comments are text only ("we just need text, I think, for comments").
- "I like this round of shareables."
- NOT BUILT: who liked a row (a tap on the count); a double tap on a photo to like; the hamburger menu holding more than settings ("settings and activity", the TSP and No Shortcuts events: "we don't need to build those things right now").

### Round 15, 2026-11-22: his read of likes and comments on the phone

All DECIDED (his words), BUILT on the sandbox unless marked.

- STANDING: "when in doubt, use the Instagram layout as the standard operating procedure."
- A swipe on the stickers no longer changes tab behind them ("I have the share menu open and I swipe ... it swipes to the search"). Anything open over the screen (photos, stickers, a sheet, comments) holds the tab swipe off.
- A tap on a photo changes it at once, no slide ("it doesn't have to scroll it").
- The handle on a profile opens that account on Instagram.
- STICKERS WITHOUT THE WAIT ("I should not be waiting for anything there ... they're only changing after a row"): one request now brings the list and every sticker drawn (it was a request a sticker, each rebuilding the rower's numbers). The viewer's own newest rows are drawn while the feed is read. Kept five minutes and let go when a row is logged.
- The comment field: an arrow in a disc in place of POST ("just an arrow that says up"); the face lines up with the field; paper under the sheet so nothing darker shows at the keyboard's corners.
- A CAPTION ("a caption whenever you post ... can we do that in a tasteful way? Maybe beneath the photos"): a field on the log form, shown under the like, comment, share marks with the name before it, as Instagram does. The rower can add or change it on the row's page. Text, 500 characters.
- FILMING A REEL ("there should be a progress bar ... preview me the film ... I clicked filming and nothing's happening"): FILM IT shows a bar, then the film plays where the still was, and SHARE IT is its own press. Filmed at 720 by 1280 from the app, which takes half the time. Given up on after ninety seconds, with a sentence. The cause on the live site was not confirmed (no access to its logs); the likely ones are the minute a film is allowed and a share sheet that a browser will not open twenty seconds after the press.
- "I really like how the best page turned out." Searching for another rower from it: dropped by him ("never mind ... you just got to go to their profile").
- NOT BUILT: reels inside the share menu, beginning with one that counts up to the row's meters ("eventually, on the shareables, I'm going to want those reels"). The count-up clip exists (METERS); reels are still the owner's only.

### Round 16, 2026-11-21: his read after the first over-the-air build

Built the same day, checked on the sandbox (`scripts/rowed-check.ts`, and at phone width in a browser). His words in quotes.

- **The tabs slide.** "I want to see the pane swipe ... it's like they exist, but they're just off the screen. On my app, it just teleports there." The tab in view and the one being dragged toward are both mounted and follow the finger (`pos` in `App.tsx`). A press on the bar still goes straight there.
- **The mark leaves as it came.** "The old item that was there kind of just leaves ... settings just kind of disappears." A word of a different length rolls up and out while the new one rolls in. And every letter has its own moment ("the ATIONS ... comes up almost as one block"): the stagger is spread over the whole word (`src/mark.tsx`).
- **The feed card.** The name is ink, his own too ("it doesn't need to be blue"). The pace is to the second ("we can just leave it at 157"). Watts, strokes and drag are off the card; a row the monitor recorded wears a small ink TELEMETRY tag beside its meters ("on the same row as that 5,000 meters"). Photos have a little round at the corners.
- **TELEMETRY is the name** for what comes off the erg ("I like the name telemetry as like a product"): the section on the profile, the bar's title, the eyebrow on the log screen.
- **Log a row.** CONNECT and LOG BY HAND side by side at the foot; the three steps and the monitors found above. The demo row is off the screen ("I don't think we need it anymore").
- **Search.** The bar is the field alone, no plus and no bell. Small type over a bar is a shade darker.
- **Profile.** Followers and following stacked, figure over word. A bio under them. A bell beside FOLLOWING asks for that rower's rows. Three tabs under the ledger: ROWS (the feed's own cards, ten at a time), STATS (pace, field, bests, telemetry), 100K (the month's calendar, and every month against 100,000). The third tab was his "maybe it's something about the 100K"; it is the one to change if he wants another.
- **Settings are a list that leads to pages**: Account (photo, bio, birthday, height, weight), Privacy (private account, muted, blocked), Notifications, Appearance (dark mode). `screens/Settings.tsx`.
- **Notifications when a row is logged**, all off until turned on: the bell on one rower, "a rower I follow logs a row", "anybody logs a row" (`notifyOn`, `notifyRowed` in `lib/rowNotify.ts`). In the app's notification centre today. On the phone's lock screen they need `expo-notifications`, which is a new build and an Apple push key: NOT built.
- **Questions behind the stats.** The bell on the stats tab is a question mark; it lists questions, each a page with one big figure, a chart and plain sentences. Two to start: how many people are rowing, when do people row (`screens/Stories.tsx`, `api/row100k/app/stories`). He called them FAQs, then "really stories".
- **Stats page**: the line of mean, deviation and percentiles under the two medians of THE FIELD is gone. This was my reading of "that like little copy, isn't doing much"; if he meant something else, put it back.
- **Comments sheet**: moved by the keyboard's own height, made shorter while the keyboard is up so the row still shows over it, paper behind the whole keyboard, and no home-bar room under the field while the keyboard covers it. Only a phone can confirm these three.
- **Stickers go round**: past the last is the first, before the first is the last.
- **Reels**: seconds left count down over the still while the site films; the phone's film is 20 frames a second (a 10 second clip in about 6 s on the sandbox, from 9); under a running month total the pace is the month's, not the row's.
- **Dark mode**: the faint leading zero on the profile is lighter. Changing the look still mounts the screens afresh; with the switch on its own short page that no longer loses a place in a long one.

Not built, with why: sharing the rankings table (he set it aside), other makes of erg (needs a machine to test against; see Questions), birthday and gender from Google (two sensitive scopes that Google must review for the whole site's sign-in), more than two photos and video (after release), push to the lock screen (above).

### Round 17, 2026-11-21: the row's page, and the store

His words in quotes. Built and checked on the sandbox the same day.

- **The bars hold still at the foot of a list.** "Wants to fight you as you scroll down, and the bottom bar ... goes large, goes small, goes large." Nothing is told to the bars within a short way of the end of a list (`useScrollDir`).
- **A row is edited from its three dots.** "I really don't like the ability to edit the caption without ... clicking those three dots and then explicitly editing it." EDIT ROW in the row's menu, on the rower's own row; no word on the page writes anything. The thing written is a DESCRIPTION ("description is probably a better word"); the column is still `caption`. Changing photos from EDIT ROW is not built.
- **Every sheet stands on the keyboard** ("the keyboard covers where you're writing"): `useKeyboardHeight` in `ui.tsx`, used by `Sheet`.
- **These are ROWS**, not activities ("these can just be called rows").
- **Stickers above the reel overlays** on a row's page, a strip of them.
- **The monitor's averages** are one line, and only where the read is not shown: the read's NUMBERS carry them ("the numbers section and the erg have really similar data. Do we need both? I don't think so"). Drag factor and strokes joined THE NUMBERS.
- **ANALYTICS**, where it said saved session. **No playback** ("I don't want to support that"); the site's page still has it.
- **Each chart is a box** with a title in the head's face and ONE sentence under it, worked out from the numbers ("box these charts up a little bit ... is there anything useful we can say ... below these charts?"). A chart with nothing to say says nothing.
- **Pace along the piece** is a moving-average line, not a bar a split. **Rate and length** are moving averages with the first and last strokes cut off ("the meters per stroke dropped a lot because it finished"). **Work per stroke** has its moving average, the straight trend as a quiet dashed rule, and the moving average of his other recordings at that distance when the phone holds any.
- **The force curve** says where its peak sits and whether it is one hump or two. No "ideal" line is drawn: there is not one curve that is right for everybody, and he said "if we can infer this ... we don't need to come up with something".
- **HOW STEADY, two scores out of 100 that are not speed.** "There should be a reward to chase for being very steady ... it doesn't matter if I'm rowing a 201 or a 230." STEADY PACE: 100 less ten for every 1% the split wandered from its own average, read five strokes at a time. SAME STROKE: 100 less three for every 1% a stroke's force curve differed in shape from the average stroke. With them, the spread of every stroke's split as columns. The constants are a first guess: tune them once real rows have been scored.
- **The foot** lost its two paragraphs and gained the monitor's name, serial and firmware.

For the store, the same day ("Do all the items to get it Apple App Store ready"):

- The app's routes answer every signed-in rower (`SOCIAL_LIVE = true`).
- DELETE ACCOUNT in Settings, Account: the rower's number typed back, and everything of theirs goes.
- A privacy policy and terms at `/row100k/privacy` and `/row100k/terms`, linked from Settings and from the sign-in screen.
- Sign in with Apple: the server takes an Apple identity (`appleToken` on the session route). The button is in the build that carries `expo-apple-authentication`.
- Left for him, because only he can: an App Store Connect listing (name, screenshots, description, age rating, the privacy questionnaire), a production build and its submission.

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
