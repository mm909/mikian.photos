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
- A privacy policy and terms at `/row100k/app-privacy` and `/row100k/app-terms`, linked from Settings and from the sign-in screen.
- Sign in with Apple: the server takes an Apple identity (`appleToken` on the session route). The button is in the build that carries `expo-apple-authentication`.
- Left for him, because only he can: an App Store Connect listing (name, screenshots, description, age rating, the privacy questionnaire), a production build and its submission.

### Round 18, 2026-11-21 (afternoon): his spoken read of the phone build

His words in quotes. Built the same day; what was looked at in a browser on the sandbox is marked SEEN, the rest is typechecked only and wants his thumb.

- **100K tab.** A month pressed under EVERY MONTH is the month the calendar above shows ("if I click on one of those, then the calendar above it should update"). Worked out from the log already read; the page does not read again. SEEN.
- **EDIT ROW is a page, with everything on it** ("I need to be able to edit all of the things about it ... we'll allow them to edit the meters and time, even on telemetry ... add and remove photos and edit caption"; of the old sheet: "it kind of like glitches ... the keyboard is still covering the place where you type"). `screens/EditRow.tsx`: description first, at the top; meters and time; title; the two photos, each swapped from the library or the camera, or taken out (a row still saves only with two). It comes up a moment after the menu has gone. Saves through the site's own edit route. SEEN, a save included.
- **Reel overlays.** Opening a clip plays it at once: the five-second version at ten frames a second, as fifty small frames on one picture (`REEL_STRIP` in `erg/reel/serverReel.ts`, `&strip=1` on the reel route; about a tenth of a second to paint, 250 KB). It keeps playing while the site films and after. The clips are swiped through and go round, as the stickers do. The count of seconds left is beside the bar, not over the picture. SEEN moving; the swipe wants a phone.
  - His questions, answered: the film is made on the SERVER (the site paints every frame and encodes an MP4), not on the phone; the phone's film is 720 by 1280 at 20 frames a second, the site's studio 30; a film costs a few seconds of server time, which is nothing at this size.
  - THE FILM ITSELF plays on the phone once it is made ("we've already made it, so we should play it"), from build 1.2.0 on: `expo-video` went in the same evening, with the first production build, and `app.json` went to 1.2.0 with it. A 1.1.0 build keeps what it has and takes no code published after this. NOT SEEN on a phone.
- **Analytics.**
  - THE READ is under the head's figures, where the line of strokes, watts and drag was ("instead of that text ... we can have the read here"); those figures are in THE NUMBERS.
  - Cut, on his word: "as the monitor read it" on the drag; "Not about speed"; STROKES TO SETTLE and SECOND HALF; "read five strokes at a time"; the sentence explaining the score; "it does not know how fast the piece was".
  - RATE AND LENGTH wears its two lines beside their names (a blue line, a dashed grey one) in place of "rate solid, length dashed".
  - THE FORCE CURVE IS TWO CARDS: a swipe brings AGAINST EVERYONE, the rower's average stroke over the average stroke of every real recording, each as a percent of its own peak, with where each peaks ("what should it be at? Like how far away am I?"). `api/row100k/app/field`: one curve a rower, then the rowers averaged, kept half an hour. It says how many rows and rowers are in it, and says so when the field is under five rowers. NOT SEEN: the sandbox has no real recordings.
  - COACHING replaces WHAT NEXT ("a specific call to action for what to do next row, like a cue or a reminder"): at most four, numbered, each a thing to do in bold and the row's own numbers under it: pacing (with the steady score as the reason when it needs nothing: "let's support that by saying like what my consistency is"), rate against length, a warm-up when the work per stroke peaks well into the piece (his own example), where the push peaks. The rate chart's sentence ends on what to do next row. SEEN.
  - A SPLIT PRESSED in the table draws the pace, the rate and length and the work per stroke from that split's strokes alone; a blue bar over the charts says which and brings the whole piece back. SEEN.
  - The foot is packets, strokes, and the monitor.
  - NOT BUILT, his to decide: THE READ written by a language model ("is that a crazy cost? If it's not a crazy cost, then let's do it"). It is not a crazy cost (a fraction of a cent a row, written once and kept). It needs an API key of his on the server, and the privacy policy has to say a row's numbers go to a model, so it waits on his yes.
- **Profile.** Followers and following side by side, figure then word ("0 followers, 3 following, but side by side"). SEEN.
- **A finger on a chart does not change tab** ("if I'm scrubbing on the charts, then we shouldn't change pages"): `scrub` in `ui.tsx`.
- **RACE DAY 5K on THE BESTS opens every race-day result** in order of time, the rower's own line marked ("we can just show all the results from race day ... it's okay if it's a little different"). `api/row100k/app/raceday`.
- **Loading is breathing blocks, not a spinner** ("I'm still looking for those like flashing boxes"): `Skel`, `SkelPage`, `SkelCards` in `ui.tsx`; after six seconds a line says the signal may be slow, with TRY AGAIN.
- **The mark.** A word of another length leaves fast and is gone before the new one starts ("make sure the animation of the item leaving the top finishes before the animation of something new coming in ... move faster or wait. Probably a combination of both"). QUESTIONS wears its Q in the blue.
- **Three more questions** ("take that as free rein to add a couple more"): how many make the 100K, how far a typical row is, how long a 5K takes. SEEN.
- **The contact address** on the app's policy and terms is `row@rowtember.com` ("this should be just row@rowtember.com for now"). The mailbox has to exist before a store reviewer writes to it.
- LEFT AS IT IS: the TELEMETRY tag ("this is fine"), the stickers and the overlays menus ("looks pretty good").

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

## Round 19 (2026-11-22): the race page, and the monitor on its side

His words, by voice. BUILT in the worktree, NOT committed, not on a phone yet (seen in the web build against the local sandbox).

- **The average keeps its tenth and stays on one line.** "The average pace number has that decimal and it doesn't fit in the box. It's two lines ... I think I'd like having the average pace decimal there." The size is cut for the face's real width and the line shrinks before it breaks (`RowScreen.tsx` Main).
- **ON PACE FOR heads the figures at the right.** It was a line under the average: "I actually want to move that just on to the right with the other stats there ... the most important stat there is probably that expected finish time." The meters to go stay under the average.
- **THE RACE is the monitor's second page** (`screens/GhostRace.tsx`, `erg/ghosts.ts`, `api/row100k/app/ghosts`). "Race yourself or different versions of your past ... race ghosts"; "even better ... racing the people that you follow ... not racing their PRs ... just a row that person had ... the closest one to this user"; "start us at the same time"; "a line art style ... thin lines"; "the boats are relatively small ... enough space between these boats ... lanes that aren't actually denoted by anything ... kind of like Frogger"; "a drone view"; "going to the right".
  - DECIDED by him: four figures and no more ("my estimated time, the time elapsed, my average pace, and the meters to go"), the finish at the top, and under the water meters to go at the left, the time in the middle, the average at the right.
  - MINE, to react to: the rower's boat holds its place 42% across and the water runs under it; a phone on its side shows about 110 m of lake, upright about 50 m; a boat is 8.2 m; the oars follow the rower's own stroke rate, a ghost's follow its recorded average; blades leave puddles; a tick every 10 m on the edges and a line every 100 m; one boat a lane where they would overlap, the nearest first, and a name only where it fits whole.
  - MINE: THE LINE under the water is his "tasteful way to be able to fit all 150 in a line": every row in the field as a tick by how far ahead or behind it is, the rower in the middle, followed rowers' ticks darker.
  - WHO IS IN THE FIELD (the route): the rower's own rows over exactly the monitor's distance (newest 200), three rows a followed rower (the ones nearest the rower's usual time), and race day's recordings for racers a recording carries. Private, blocked and lights-out rowers are left out. A row logged by hand is replayed at an even pace; a recorded one from its per-second series.
  - A set distance only. A plain row or a timed piece shows a line saying so. OPEN: what a ghost is for those.
  - NOT BUILT: the lake as a real place from above ("could we go as far as setting a scene for like a little map ... a real lake"), which he called a side idea; picking who to race; a ghost's own page from its boat.
- **A demo row by address, browser only:** `?demo=5000&speed=6` starts the simulator as the log screen opens. `node scripts/dev-app-db.mjs --ghosts` gives the local sandbox a field to race.
- **Race day's 26 recordings have no rower on them.** `scripts/raceday-telemetry-match.ts` matched all 26 to one racer each by the posted time, to the tenth (read only; `--write` assigns). NOT WRITTEN: it would also put each recording on that rower's own page, which is his call.

## Round 20 (2026-11-22, later): black and white, Strava's row, Instagram's profile

His words, by voice, with Strava and Instagram open beside the app. BUILT in the worktree, NOT committed; seen in the web build against the sandbox, whose rows have grey stand-in photos or none.

- **The app is black and white.** "We need the black and white. That's what we need to be"; "the color scheme we have to take"; "I don't really give a shit about the blue ... I think this is better. It's easier on the eyes." `theme.ts`: white page, near-black type, one grey, a hairline; the dark look is black. The blue is left on what acts or is the rower's own (follow, a like, the rower's boat, the charts). MINE: whether the board, the stats and the monitor's big average should lose their blue too was not said; they keep it for now.
- **A row in the feed is Strava's row** (`Feed.tsx` Strip): who and when at the top ("Today at 6:12 AM", "Yesterday at", then the day in full), the title, then DISTANCE, PACE, TIME as small ink figures apart from who it is, then the picture the width of the phone, three by four ("whatever the largest format Instagram uses"), then the marks and the caption. No dots ("every post is going to have two photos"); a tap swaps to the other photo ("if you tap them, it'll swap back and forth"); a long press opens it whole. No card, no rule. The rower's number is not on the row.
- **A profile is Instagram's** (`Profile.tsx`): the face with ROWS, followers, following beside it; the name with the black check; the total meters rowed in grey under it; the bio; no Instagram link; the first tab a grid of photos and nothing else (`Feed.tsx` RowGrid); the month, the meters of it, time rowed, sessions and average split moved into the stats tab. The third tab is still the 100K: OPEN ("I kind of want it to be like a trophy case, but not like a badge collector").
- **Telemetry looks like metal.** "Like Amex Platinum ... a premium metal credit card." The TELEMETRY word on a row is a brushed plate (`ui.tsx` Plate). **The black check** ("it's a black verified check mark", "never say subscriber") is `icons.tsx` VerifiedIcon after a name; who wears it is `src/lib/rowPlus.ts`, which until there is a checkout answers the site's admins only.
- **The rower's oars are the rower's stroke** ("it needs to match with the stroke that I'm pulling"): the blades go in and come out on the monitor's own word for the drive (`erg/model.ts` driving, driveS, recoveryS).
- **Which photo is first** when logging: SWAP, one press. He asked for hold and drag; with two photos it is the same move.
- NOT BUILT: cropping a photo on upload ("we also need to be considerate now of crop"); the check beside the number in the top bar (it is after the name); racing rowers who are on the water right now, and a weekly start ("could I host a race on Saturday at 8 AM"); the jitter he feels scrolling the 100K tab, and the slow first load, neither looked into.
- **To his three screenshots (the same day; all three were the DARK look of Strava and Instagram):** the feed row lost the rules between its figures and took Strava's air and its band between rows, a larger title and bolder figures; the profile has the name beside the face with the counts under it from their left edges, pictures on the tabs (grid, stats, and 100K by name), and the check after the number in the top bar (`App.tsx` checked / onPlus), not after the name. OPEN: whether the black look is the default; white still is (CLAUDE.md's "never dark by default" was said of the website on 2026-10-30).

## Round 21 (2026-11-22, 1:30 in the morning): the race as a track

His third read, by voice, of the race page and the redesign. BUILT in the worktree, NOT committed; seen running in the web build on the sandbox.

- **Five lanes, five boats** ("let's cap this animation at 5 boats. And like in 5 lanes. I really don't like the 3 boats in a lane look"). The rower in the middle, four rivals, lanes ruled off "like lanes on a track", so the name can be large ("I won't be able to see those names when I'm rowing"). On its side the names are at the left of the water (15 pt bold) and the meters ahead or behind at the right (21 pt); upright both stand in the lane over the boat.
- **Who the four are** (`erg/ghosts.ts` pickRivals, rivalCost, crossings): nearest the finish the rower is headed for; a recorded row before a hand-logged one ("we should prioritize people with telemetry data, and we should denote that it's telemetry data"), marked EVERY STROKE or EVEN PACE; rows that trade places with the rower preferred ("intertwining ... a close race"); two ahead of the finish and two behind where the field allows; at most two of the rower's own rows; never two rows of one rower.
- **The closest are beside the rower** ("if assuming A and B were on the same side, I want A to be closer to me when we're neck and neck, and B ... when they're neck and neck with me"): two rivals a side for the whole row; of each two, the one nearer over the next half minute has the inside lane; they trade only while a boat's length apart along the water.
- **A boat off the water four seconds is replaced** ("if they fall too far behind, they can get replaced ... that can kind of slide in"), by the best rival for the finish now on pace for, sliding in from its end of the lane.
- **The rest of the field is dots in the water** ("fish-sized dots"); the strip of ticks under the water is gone ("my brain likes it analytically, but I don't think that it works very well").
- **ON PACE FOR is ink**, here and on the numbers page. **The race is the first page** of a set distance ("let's have that be the main screen").
- **The metal TELEMETRY badge is out** ("I didn't mean like the typing of a Pokemon ... definitely not that"): a small grey word for now. What he means by premium is the rower's NAME taking "a metallic sheen", "undertones"; NOT DESIGNED, he moved on.
- **Cropping on upload** ("why do we not build cropping on upload?"): the two frames of the log form are three by four and a drag slides the photo under its frame (`RowScreen.tsx` CropFrame, `upload.ts` frameOf); what is in the frame is what is sent. No zoom. Type-checked only: the sandbox cannot take an upload.
- **Profile buttons**: EDIT PROFILE and SHARE side by side, 32 tall ("it's just so large").
- **The top bar is left as it was.** He asked for only ROW and the number to animate, then: "I take it back ... I like it."
- **White stays the default look** ("let's keep white mode default").
- **The 26 race day recordings were assigned** to their racers on his word (`scripts/raceday-telemetry-match.ts --write`).
- The sandbox's sample rows carry real photos now: `node scripts/dev-app-db.mjs --photos`.

## Round 22 (2026-11-22, toward 2 in the morning): passing, the best, and a sheet for the board

Rounds 19 to 21 were PUSHED to main as 5097de0 on his word ("push the update") and published over the air to the preview channel at runtime 1.2.0. What follows is BUILT in the worktree and NOT committed.

- **The race is about passing** ("let's optimize for the number of times we're passing people or getting passed ... that dynamic race feeling"). A boat off the water is out at once ("as soon as they fall off screen, they're out"). Nothing slides in ("do not have someone swoop in from the back. That looks terrible"): the lane goes to a row that is off the water and coming onto it at its own pace, one ahead that the rower is catching or one behind that is catching the rower, the soonest to be past the rower first; a boat dropped behind is answered from the front ("if we drop someone, that means we're catching up to someone else"). One row a rower, the rower's own past rows included ("not have multiple copies of the same person").
- **The rower's best is a red line** where their fastest row over the distance is now, and the water reddens within 60 m of it, from 500 m on ("when you are chasing a PR, the whole track starts glowing that red"). NOT BUILT: the zoom out and back in.
- **The board's sheet, a MOCK** (`Board.tsx` Sheet): the viewer's total big at the top; a rower is a line (place, number, name, total) over eleven boxes, the seven days gone, today, and three ahead, each with that day's meters in thousands ("like an attendance sheet ... on GitHub ... that heat map"). The viewer's own three boxes ahead step through a few distances and are kept on the phone only; declaring a plan to others ("publicly declare their rowing plan") needs a table and a route and waits on his yes to the look. The board route answers the week (`week`).
- **A look being tried is one press away for an admin**: the 100K at the top of the board swaps bars and sheet ("the secret dev trick").

## Round 23 (2026-11-22): every card against everyone, and a card's questions

His words in quotes. Built the same day; SEEN in a browser on the sandbox, at phone width; pushed to main and published over the air on his word ("Push live yes!").

- **Every card of a row's analytics is two cards** ("for as many as we're able to, let's create that second pane like we have for the force curve where it compares us against other people"). A swipe on HOW STEADY, PACE ALONG THE PIECE, RATE AND LENGTH, FORCE CURVE and WORK PER STROKE brings AGAINST EVERYONE:
  - HOW STEADY: split spread, steady pace and same stroke, each as a line with a mark a rower, the rower in the middle (EVERYONE) and this row (YOU).
  - PACE ALONG THE PIECE: this row's pacing over the field's, each against its own average split, drawn in seconds at this rower's split.
  - RATE AND LENGTH: a dot a rower, rate across and meters a stroke up, the rules crossing at the rower in the middle.
  - WORK PER STROKE: joules a stroke, and how much of it was kept from the first third to the last.
  - Each says in a sentence where the row stands and which way is better. A field under five rowers says it is small. With nobody to compare against there is one card and no swipe.
- **The second card ends on a link to that card's questions** ("either a third pane or just a link on the second pane that links to a FAQ about this metric"; "less interested in definitions and more interested in the what does mine look like compared to everyone else, and what does that mean about me ... what direction is it to be better or worse?"). The link reads WHAT THIS SAYS ABOUT YOU. The page (the bar says QUESTIONS): this row's figure big, where it stands, the pictures against everyone, then WHAT DOES THIS SAY ABOUT YOU, WHICH WAY IS BETTER, what the figure is, HOW DO YOU MOVE IT. The first of those is worked out from the row and the field; the rest are the same for everybody, with the row's own numbers put in where they help.
- **How it is put together.** `src/lib/pm5/craft.ts` (copied to the app by `npm run sync:pm5`) measures one recording; the phone runs it on the row and the server runs it on the field, so the two are the same sums. `api/row100k/app/field` answers `stats` beside `force`: ONE FIGURE A ROWER (their recordings averaged first), the newest 80 real recordings, kept half an hour. The cards are `mobile/src/screens/Field.tsx`. `npm run check:field` in `mobile/` checks the sums; `node scripts/dev-app-db.mjs --field` gives the sandbox a field to look at.
- Claude's calls, his to change: a link and not a third pane; the middle of the field is the median rower, said as "the rower in the middle"; the second card is always the whole piece, whichever split the first is showing; the field includes the rower's own rows.
- NOT SEEN: the live field. The live site's has only the real recordings saved so far, so expect the small-field sentence until more rowers record.

## Round 24 (2026-11-22): for the App Store's reviewer

His words in quotes. Built and checked on the sandbox, then pushed to main and published over the air to the preview and production channels on his word ("Yes push it live").

- **The demo row is back** ("We can bring back the demo row for now"): a quiet line under the three steps on the log screen, "No rowing machine here? Run a demo row". 2,000 m at six times a clock, about 80 seconds. A demo row is still never logged outside development, so it ends on SEE ITS ANALYTICS: the read of the piece the simulator rowed, with every card and its questions, headed "Demo row · simulated · not logged" and kept nowhere (`RowPage.tsx` DemoPage). SEEN.
- **A reviewer login** ("Add a reviewer login"): "App review sign-in" under the buttons on the sign-in screen opens a name and a password. The server takes them only when they match `APP_REVIEW_USER` and `APP_REVIEW_PASSWORD` on the host (`src/lib/appReview.ts`); with either unset it refuses everybody. One plain account, "App Review", made on the first sign-in and again if the reviewer deletes it. Ten checks against the local database passed; the form's refusal SEEN. HIS: set the two on Vercel, and take them off after the review.
- **The listing text** ("work on the listing text as well"): `STORE.md`, every field under Apple's limit, the privacy answers from the privacy page as it reads today, the age-rating answers, the notes for the reviewer, and what is his to do before submitting.
- MINE, to react to: the demo line stays on the log screen for everybody, not only the reviewer; the keywords leave out Concept2's names; the reviewer joins as a rower the ordinary way (which mails the owner like any sign-up) rather than being handed one.

## Round 25 (2026-11-22): the profile's three tabs under the finger, and a pace reel with marks

His list, from the phone, and then "Make those changes and push it."

- **The grid does not flash** ("when you tap to scroll it, it like flashes, it highlights for a little bit. We can get rid of that"): a tile dimmed while a finger was on it, and a finger on the grid is nearly always scrolling it. The dim is gone (`Feed.tsx` RowGrid). SEEN.
- **A month reads the stats and nothing else** ("why is it that when I select the time frame for the stats section on the profile, it reloads the whole page ... we just can't reload the whole page"): the page was one read keyed by its month, so a new month had nothing to show and the whole screen went to its waiting state, back on the grid. Now what was last read stays up: the head and the selector do not move, the month word changes at once with READING beside it, and the stats sit faint until the month arrives (`Profile.tsx` `held` / `turning`). A month already read is there at once. SEEN, with the read slowed by four seconds. NOT DONE: making the read itself shorter ("I still really think we don't have to have a long load screen there. But it's okay"); that is the site's profile route working out every chart for the month.
- **A swipe under the selector moves between the three tabs** ("if I'm on the Stats tab of the profile and I'm swiping left or right, then that should just swap whether I'm looking at the 100K or the grid view ... Right now ... it takes me to the rankings page"): the grid, the stats and the 100K lie side by side and the finger drags them, as the shell drags its own tabs; the short rule under the open tab travels with the finger. At either end the drag is the shell's again ("on the very far left ... and then I swipe to the right. That should take me to the stats page"), and so is a drag on the head above the selector. The tab dragged toward is laid over the page beside the one in view, so the page does not change height under the finger. SEEN in a browser, every step both ways. A mouse dragged across type in a browser selects the type and that ends the drag; a finger does not, so it is not a fault on the phone, and it was NOT checked on one.
- **The pace reel** ("let's make that pace 1, a rolling average, so it looks a little smoother. 2 ... only showing 500 meters, the most recent 500 meters at a time ... And we need some y-axis markings for the different pace values"): the line is the average of the fifteen seconds behind each tick; the sheet is 500 m wide, standing at the start until the rower is 500 m in and then traveling with them, the head at the right edge, a notch on the floor every 100 m and the two ends counted under it; up the left side a rule and its pace at every round step that fits (five at most). The dashed average of the whole piece and the big figure over it are as they were. Painted on the site (`src/app/erg/reel/paint.ts`), so the site's reel studio draws the same, and the phone gets it with the site's deploy: no app update is needed for it. SEEN as frames rendered from the sample piece on ink, green and cream; not as a film on the phone.
- MINE, to react to: fifteen seconds for the rolling average; the up-and-down scale is fixed for the whole piece (so the rules do not move) and not refitted to each 500 m.

## Round 26 (2026-11-22, afternoon): a reel overlay with nothing behind it

From his phone, with a green clip on the timeline in Edits and no way there to key it out: "if we can get the same thing, but with the transparent background, that I don't have to do this. Ideally ... we're able to copy these and paste them onto an Instagram story ... You can have it there as one of the buttons there, just copy ... Make those changes, push it live."

- **NO BACKGROUND · GIF**, under FILM IT in a clip's viewer: the site paints the same clip on no ground and sends an animated GIF (`serverReel.ts` renderReelGif, `api/row100k/app/reel?gif=1`): the story's full size, cropped to the drawing, 12.5 frames a second, the last frame held two seconds, round and round. A GIF's pixel is there or not, and the clip's hard ink outline is what makes that edge clean. The ground picked above is not read; the length is.
- **It goes to the share sheet, and COPY is there.** NOT a copy button of its own: the clipboard module in the build takes a still picture only, so a moving GIF cannot be put on the clipboard from the app's code. A button that copies in one press needs a small native piece and a new build; NOT BUILT, his to ask for.
- SEEN: frames of all six clips taken out of the GIFs and laid over six colours, on the sample piece. NOT SEEN: the button on the phone, the paste into a story, or the GIF as an overlay in Edits.

## Round 27 (2026-11-22): the race, read from the seat

His fifth read of the race page, after a demo row on the sandbox. His words in quotes. BUILT in the worktree and SEEN in a browser on the sandbox, upright and on its side; pushed with round 28, which changes several of these; NOT seen on a phone.

- **No lane is empty** ("when the rowers went off the screen, no one came to replace them"; "we need to make sure we have rowers in every lane"; "once a rower leaves, we need a rower to fill in ... and we need rowers to fill from the back if someone goes ahead of us"). Why they were: every boat leaves the start with the rower, so a row far enough away to be off the water is nearly always going farther away, and the rule waited for one coming back. Now a lane is given at once (`erg/ghosts.ts` nextBoat): first to a real row that is on the water (it was a dot) or will be within eight seconds, one ahead when a boat was dropped and one behind when a boat went up the course; failing any, to a PACE BOAT, an even pace to a round finish near the one the rower is headed for, named by that finish ("19:25 · PACE BOAT"). A boat that was already on the water comes up where it is in under a second; nothing slides in from an edge. One row a rower always now: a field of the rower's own rows is one boat and three pace boats, where it used to be four lanes of You.
- **The field is everybody** (`api/row100k/app/ghosts`, kind "field"): rows over the distance by any rower the viewer may be shown, two a rower, the sixty rowers nearest the viewer's usual time. It was the viewer's own rows, the rowers they follow and race day, so somebody who follows nobody (the App Store's reviewer) raced nobody.
- **The lanes run edge to edge and what a lane says is painted on it** ("let's extend the lanes to be the full width, and let's write their names on the lanes"; "in front of the boat, we should write their average pace ... like when you go to a high school track and they write their high school name on the track"; "I'm going to be reading this from, like 3 to 6 feet away"). The columns beside the water are gone. On a lane: the name at the left in capitals, the seconds at the right, and the boat's average split so far ahead of its bow, going with it. Upright the words are along the top of the lane; on its side they are across the middle, the small line after the name, and the name goes faint while its boat rows over it.
- **Seconds, not meters** ("I don't think I care about the number of meters behind me they are, but probably the number of seconds"): "+3.4 S" is that boat 3.4 seconds ahead, "−12 S" twelve behind; a tenth under ten seconds. Read off when that boat crossed the line the rower is on now (`ghostSeconds`).
- **The meters over the water are bigger and clear of the lanes** ("maybe those need to be a little bigger"): 16-point bold in a strip of their own above the water, with FINISH.
- **The finish the row is headed for is alone over the middle** ("I would rather that on pace 4 just be centered in the screen and have it just be the number with like an ETA next to it"): ETA, and FINISHED when it is. **The count of the field is gone** ("we don't need the 0 ahead, number of 76 behind").
- **The red is the rower getting nearer to beating their best** ("I want the track to light up red as your PB gets closer, right? Not further away ... we probably don't denote the PB till we have a reasonable prediction ... like in the first 100 meters"). Nothing before 100 m. From there the line is where their fastest row over the distance is, and the red is read off the finish this row is headed for: none at 2.5% of the best behind it, all of it on pace to beat it. It was read off the meters between the two boats either way, so it went out as the rower left their best behind. Under the water the line is named, YOUR BEST and its time, and when it is off the water, which way and how many seconds.
- **TELEMETRY, or nothing** ("I don't know what the every stroke comes from ... let's say telemetry ... the way that you denoted it on the feed ... if it's not, then we just ... don't put anything").
- **The boat on the finish line** ("Sandbox Rower 2 was like at the finish line, even though we passed them"): the clock the other boats are placed by ran on after the piece, two seconds in the demo, and a boat that close behind was put on the line. It stops on the line with the rower now. The simulator's own clock ran on too (FINISHED two seconds over the ETA); it stops at its finish (`src/lib/pm5/simulate.ts`, copied by `npm run sync:pm5`).
- **One demo** ("occasionally it brings up like this full animation, and then if I click the plus, after, then it brings me up like a worse demo"): the address `?demo=5000`, left in the sandbox's browser from an earlier look, rowed 5,000 m with seventy rows to race; the line under the steps rowed 2,000 m, which nobody in the sandbox had rowed. Both are 5,000 m at ten times a clock now, about two minutes (`STORE.md` says so to the reviewer).
- **Live, built and NOT ON** ("you should work on supporting this live. We don't have to turn it on right now ... across the world ... someone's rowing a 5K, and I'm also rowing a 5K, I should be able to see them, and they should be noted"). `erg/liveRace.ts`, `api/row100k/app/live`, the table `RowLive`. While the monitor is set to a distance the app says where its rower is every three seconds and is answered with everybody else over the same distance; each is a boat like any other, marked LIVE in the monitor's green, given a lane before anybody, and kept in it when off the water (the seconds point which way). A demo row listens and is never told to anybody. The site answers `on: false` until `ROW_LIVE_RACE=1` is set on the host, and the app then stops asking for that piece: turning it on needs no app update. SEEN on the sandbox with two sample rowers (`node scripts/dev-app-db.mjs --live --speed=10`, and `ROW_LIVE_RACE=1` in a `.env.development.local`).
  - WHAT IT IS NOT YET: a race started together. Every boat is drawn from its own start, so two rowers side by side who pull five seconds apart are level at the same second of their two rows, and across the world that is the only fair way to draw it. First across the line by the clock on the wall needs a shared start: one rower opens a race, the other joins it (a code, or from a follow), both phones count down off the server's clock, and the boats are placed by `startedAt`, which is already kept.
  - Also his to decide before it is on: who may see a rower live (today, whoever may see their rows); whether a phone that leaves the app should go on being told (it stops when iOS suspends it).
- MINE, to react to: pace boats at all (he said rowers; nothing else can fill a lane when nobody real is within a few seconds); a real row is preferred to a pace boat even when it is about to be dropped, which keeps the passing; 2.5% for the red; a past row of his own is named YOU and its day, his fastest YOUR BEST; the three figures under the water are as they were, so on its side a lane is about 36 points tall.



## Round 28 (2026-11-22): the race, his sixth read

His read of round 27 from two screenshots, and "build these changes and push them so I can get them in the app". His words in quotes. SEEN in a browser on the sandbox, upright and on its side, with a demo row to the finish and with two sample rowers live; NOT seen on a phone.

- **A real row before a pace boat** ("Rows from past recorded rows can be played there"). A lane that would have gone to a pace boat goes first to another row of somebody already racing, the rower's own past rows among them (`erg/ghosts.ts` nextBoat). One row a rower is still the rule while anybody else is near. A pace boat is left for when no real row at all is on the water; he looked at one in the screenshot and said "no, this is good".
  - WRONG, AND UNDONE THE SAME EVENING. His first row with it, a 5,000 m demo on his phone, finished with his name on four of the five lanes: "4 of these rowers are me. Fix it, push, and deploy." Nobody is in two lanes again, and NO past row of the rower's own takes a lane at all: the rower is on the page once, their best the red boat beside them, their other rows dots in the water. The four are other people, and a pace boat where there is nobody. MINE: he said four of him were wrong, not that one past row of his in another lane was; with every lane now saying a name and no date, even one reads as him twice, so there is none.
  - AND HALF OF THAT BACK, an hour on. Told that his rows had filled the lanes because few other 5,000 m rows were near his pace: "I realize this might be the case. If we cannot find any other people to put in that lane, then it's okay to duplicate." So the order is: SOMEBODY ELSE (not a past row of his own, not a second row of somebody racing); failing anybody near enough to be on the water, A DUPLICATE (either of those); failing any real row at all, a pace boat. The start line is other people only, and what they do not fill is filled the same way. A lane with his name on it now means nobody else was there to race. A duplicate also hands its lane to the first other person who comes onto the water (looked at once a second), so it holds a lane only while nobody else is there. MINE: he said when a lane may be given to a duplicate, not when it is taken back.
- **A live rower is where they are this second** ("say there are 4 people who are on their last 1,000 meters, and I'm just starting. There's no reason I would see them, because I'm not going to pass them"; "if someone is live and we're catching up to them, then show them like in someone's lane, and have that rower either drop ..."; "what I don't want to have happen is a lane be empty"). Round 27 drew a live rower from their own start and kept their lane for them off the water. Now the site says how old each rower's word is, the app works out how many seconds their clock is ahead of its own rower's (`Ghost.ahead`, `erg/liveRace.ts`), and the boat is where that rower is now: a minute's head start is a minute up the course and not on the water. A live boat is given a lane only while it is on the water (the boat farthest from the rower drops for it) and gives it up like anybody. So two rowers who pull at the same second are a race by the clock on the wall, with no countdown built: a shared start is still the next piece.
  - MINE: this is my reading of "I'm not going to pass them". The other reading keeps round 27's picture (their row replayed from its start), where he WOULD pass them.
- **The water behind a boat is green or red** ("can we tint the water behind them ... red when you're slowing down ... green ... when you're speeding up"; "the coloring ... can be based off of ... the last 100 meters or so"; "I want the number to be the average pace"). The lane from the left edge to the stern, strongest at the stern: the last 100 m against the 100 m before it, nothing within half a percent, all of it at two and a half (`trendOf`). The rower's own is read off the monitor's words; a recorded row's off its 100 m lines; a row logged by hand and a pace boat are always plain. Nothing before 200 m. The figure ahead of the bow is still the average.
  - MINE: against the 100 m before, not against the average (which would call a settled row "slowing" from the first minute on).
- **The best is a boat in the rower's own lane, when it is near** ("The text for your best 18:52 and then plus 24 seconds. That is a little hard to read, and we don't need to show my best all the time ... if I get close to it, then that boat should appear in my lane ... I can race my best self there"). A red boat in the middle lane while it is on the water, the seconds at the lane's end over YOUR BEST, and nothing of it otherwise. The red line and its strip are gone. It is never one of the four. Waiting on the finish line it shows only when the two finishes are within eight seconds.
  - The red as the best nears (round 27) is the lane ropes and the water's edges now, not the water, which is the wakes'. MINE.
- **Names, and no dates** ("Instead of saying you, let's put their name"; "the name in bold, and then on the second line, the date and telemetry"; "Let's drop the dates"). The rower's own lane and their past rows say their name; the small line is TELEMETRY or nothing (RACE DAY on a race day recording); on its side the small line is under the name when the lane is 46 points or taller, which it now is on a phone.
- **Three figures under the water, none over it** ("I kind of want to drop the ETA from the copy and just have it be the final or the expected time"; "we can move the ETA to where the current average is. That way we can make the lanes a little taller"). Meters to go, Time, Finish. The lanes have the room of the figure that was over the water and of the strip under it.
- On its side the water a boat can be on stops short of the seconds at the lane's end, so no boat rows over the figure. MINE.
- NOT DONE, his to come back to: rounding the seconds to whole ones ("maybe we can wait"); a rower rating, and an ELO for real races ("I don't need to spend time on that right now").

## Round 29 (2026-11-22, night): the race up the page, and a sample rower in the demo

"make a vertical option for when my phone is vertical. Like right now on the vertical option, the boat still goes side to side ... I actually don't mind how the vertical one looks right now, but I do want another option. Like another slide on that thing for now can be the vertical version of the race ... Also in the demo, can we show what a live rower would look like? Can we simulate a live rower, us rowing past them or us rowing with us or something like that? Again, make these changes, push, commit." SEEN in a browser on the sandbox, a demo row start to finish on the new page; NOT seen on a phone.

- **A second race page, the course up the screen** (`GhostRace.tsx` with `upright`; the page after the race in `RowScreen.tsx`, only while the phone is upright and the monitor is set to a distance; the page across the screen is as it was, and on its side the phone has that one alone). Five lanes side by side, bows up, the rower a third of the way up and the water coming down under them. About 84 m of the course is in view against 60 across the screen: some 48 m ahead of the rower and 36 behind.
  - What a lane says is still painted on it: the name UP the lane from the bottom, as on a track (it goes faint while its boat is over it), TELEMETRY or LIVE after it; the seconds across the top of the lane; the average split over the bow. The rower's best is the red boat in their own lane with its seconds and BEST across the top. The water behind a stern is the lane under it, green or red as before. The meters are in a margin down the left, and the three figures under the water are the same three.
  - A lane is 65 points wide on his phone, so the type is smaller than on the other page: 20-point seconds, 17-point names, 14-point splits and meters. MINE, and the first thing to react to from the seat.
- **One race for the two pages** (`useRace`, held by the monitor): the same four in the same lanes whichever page is looked at. The page in view moves the race on and says who has a lane, because the two have different amounts of water; the other only draws. Swiping from one to the other, a boat the narrower water has no room for is replaced on arrival.
- **A sample rower in every demo row** (`erg/liveRace.ts`): SAMPLE ROWER, marked LIVE in the green, made on the phone and told to nobody, whether or not the live race is on at the site. It pulled six seconds before the demo row and starts about 26 m up the course; the demo row is level with it a little before half way (2,100 m of 5,000) and rows through it; it is 18 m back at three quarters and closes to 6 m by the line. Made as a real one arrives (the second it crossed each 100 m line, a word twice a second, the rest carried on at its last split), so the lane it takes, its seconds and its water are what a real rower's would be. The App Store's reviewer sees it too (`STORE.md` says what it is).

## Round 30 (2026-11-22, night): a drag across does not scroll the page

"When I'm flicking back and forth between the grid view, the stats, and the 100K on the profile ... I can still scroll up and down. We probably want to make it to where if you're scrolling left or right, you can't scroll up and down. Make these changes, push it, commit."

- Why it did: a drag between tabs is taken by a responder in the app's own code, and the phone's scroller under it knows nothing of that, so it went on following the finger's up and down.
- Now whatever takes a drag across says so as it takes it and as it lets go (`ui.tsx` setSideDrag), and every page that scrolls is held still in between (`useScrollDir` hands the scroller `scrollEnabled`). Said by the profile's three tabs, which he named, and by the two other drags across that had the same fault: the shell's tabs and the edge a page is dragged back by. MINE to have done all three.
- The first 28 points of a drag are still the scroller's: that is how far a finger goes across before the drag is taken as one between tabs, so that a scroll with a little sideways in it stays a scroll.
- SEEN in a browser only as the lock going on during a drag and off at its end. A mouse does not scroll a page by dragging, so the fault itself cannot be shown there: NOT seen on a phone.

## Round 31 (2026-11-22, night): a row is never only in memory

"I just did a row on the rower, but when I left the app to do other things and came back to it ... is there a way to get that data back?"; "how do we prevent this from happening again? If I go to log a row, maybe there should be a history of all my rows that have been done on a rower." Then: "build 1 through 3, ship, and then also build 4."

- That row was not recoverable. Until this round a piece lived in the app's memory until LOG: nothing on the phone's storage, nothing on the site (the live line, `RowLive`, is not on). The phone closing the app behind him, or the monitor going back to its menu (`isNewPiece` wiped the recording), lost it. The monitor's own memory has the totals and splits; he logs that one by hand.
- 1, written as it goes: a real piece of 100 m or more is kept on the phone every fifteen seconds, as the app is left, as the monitor says it is over, and as the connection drops (`erg/useErg.ts` keep; `store.ts` Pending). A demo row is never kept.
- 3, the monitor re-arming keeps the piece: the model hands it over whole before it wipes (`erg/model.ts` onNewPiece) and the next piece is another row.
- 2, ROWED, NOT LOGGED YET, at the top of the log screen (`RowScreen.tsx` Unlogged): newest first, meters, time, split, when. A press opens the usual form with the meters and time in it and the day it was rowed; the photos go on there. DELETE asks once more in place. While a monitor is up and showing nothing, the last one is a line over it, LOG IT. Logging one, or DISCARD on the monitor, takes it off the phone; the most kept is 20.
- NOT on the website's version of this screen: he asked for it, of the app.
- 4, the app goes on reading the monitor from behind another app (`app.json`: the Bluetooth plugin's background mode, `central`). A build setting, so the version went to 1.3.0 and it needs a new build from him.
- SEEN: the types pass, and two simulated pieces fed one after the other through the model hand the first over whole (1,000 m, 117 strokes). NOT seen on a phone, and not against a real monitor: the list, the line over the monitor and the background reading are untried there.

## Round 32 (2026-11-22, night): the rower's own average ahead of their own bow

"on the racing animation, I didn't have my average pace there. I want my average pace to be in front of my boat, just like the other boats ... the same amount of boldness, but more dark, right? Because the other ones are pretty light ... full black ... the other ones are kind of like in the background."

- **The page across the screen had no average for the rower at all** (`GhostRace.tsx`): every other boat had its split ahead of its bow and the rower's own lane had only the name. It is there now, the same size and face as the others', in the full ink where theirs are half of it. On the page up the screen it was already over the bow, in the blue at nine tenths; it is the full ink there too.
- The rower's best, the red boat in the same lane, rows over the figure while it is within a few seconds ahead. Left so: the boat is a thin line and the figure reads under it. MINE.
- **RACE DAY without TELEMETRY is right where it shows** ("Are not all the race day entries telemetry?"). Read off the live recordings, 2026-11-22: of the 26 race day rows, 10 carry the second-by-second series and 16 carry the finish time alone. A lane says TELEMETRY only for the 10; the others are replayed at an even pace.
- SEEN in a browser on the sandbox: upright across, upright up the page, and on its side. NOT seen on a phone.

## Round 33 (2026-11-23): a held row, the meters after the name, FOLLOW at half, and the swipe a chart left dead

With Instagram's own held post open beside the app: "give me the ability to have a UI like this where we can hold or long press or deep press, whatever Instagram uses ... let me be able to open up a menu like that by ... pressing down on the item on that feed. And the only item we need ... swap photo ... I'd like to think we can have a share option. Like I can send this person the row ... share a link, and then the stickers. I don't know ... if stickers need to be on the profile, but sharing a link to it maybe." And of the profile: "it should just say that number meters, not meters rowed ... their name, hyphen, and then their total number lifetime. And we could probably just put an M"; "I also don't like how long this follow button is. Like it's so massive"; "if I'm on the stats part of the profile page and I ... scrubbed the pace meter graph ... then I can no longer swipe left or right between the two tabs." SEEN in a browser on the sandbox; NOT seen on a phone.

- **A photo that is held** (`ui.tsx` `HoldMenu`, `HOLD_MS` a third of a second; `Feed.tsx`): the screen goes dark, the row comes forward as a card (the face, the name, when; the photo that was showing) and a short list sits under it, a picture and a word to a line. A press off the list closes it.
  - On the feed: SWAP PHOTO (the same as a tap on the photo; it is not kept, and it does not change which photo anybody else sees first), SHARE LINK, STICKERS, VIEW PHOTO. VIEW PHOTO is MINE: holding a photo opened it whole until this round, and that would otherwise be gone.
  - On a profile's grid: SWAP PHOTO (the tile turns to the row's other photo until the page is left) and SHARE LINK. No stickers there, as he leaned.
  - What is held is the PHOTO. A row with no photo, or one the lights-out hides, has the three dots as before.
  - No buzz under the thumb as it opens: the build on his phone has nothing to make a short one with (`expo-haptics` is not in it), and the phone's own long buzz is worse than none. It comes with the next build if he wants it.
- **SHARE LINK is a line and the rower's page** (`files.ts` `shareLink`, `ROWER_URL`): "Ada Lovelace rowed 5,000 m at 1:57 /500m." and `https://www.rowtember.com/r/<number>`, handed to the phone's share sheet. NOT a link to the row: the site has no page for one row, a new page there starts in development by his rule, and the site is frozen. HIS to say whether that page gets built; the line and the address change in one place when it is.
- **The meters are after the name** (`Profile.tsx` `SocialLine`): "Ada Lovelace - 412,300 m" on the name's line, the figure in the heavier face. The grey line "412,300 meters rowed" under the face is gone.
- **FOLLOW is one of two** (`Social.tsx` `FollowButton block`): it was one bar across the page. FOLLOW (the blue until pressed, then FOLLOWING or REQUESTED in the pale) and SHARE beside it, each half the width, the bell after them once the rower is followed; the same shape as EDIT PROFILE and SHARE on the rower's own page. SHARE there hands the rower's page to the share sheet and is MINE.
- **The swipe a chart left dead** (`App.tsx`, `charts.tsx`): a finger that lands on a chart marks the touch as the chart's, so the tabs do not swipe under it, and the app took the mark off as the next touch began. But it did that on the view the five tabs are in, and a page opened over the tabs (a rower's profile from the feed or the search) is not inside that view: there the mark was never taken off, and after one touch of a chart the profile's tabs would not swipe again until the page was left. It is taken off now by the app's outermost view, on every touch, and by the chart itself as the finger lifts. Run both ways in the browser with made touches: the old code swipes, takes one tap on the pace chart and never swipes again; the new one swipes after it.

## Round 34 (2026-11-23): his read of round 33 from the phone

"I swapped photos and none of them saved ... the reason why I want to swap photos is because I want to swap which one shows up first ... it should be swap which one shows to other users. And I shouldn't be able to swap other people's photos. Just me. Also, when I hit the ... share link, nothing happened ... let's build whatever we need for the little buzz. I also want that little buzz whenever we swap screens, just like Instagram does it ... Sometimes ... if I've had the app open for a bit and I'm like flicking back and forth between a bunch of the pages, it'll go blank ... the data's still there. I just have to like move it a little bit and it'll show up ... I also want a little ding whenever I like a post ... my name whenever I'm in the comments is blue. I don't like that. Also, let's give an animation whenever I close out the comments ... there's a button down there that says more rows. I don't want that. I want that continuous loading page ... Yes, let's make a shareable link for a row, just like we can for a profile." SEEN in a browser on the sandbox unless a line says otherwise; NOT seen on a phone.

- **SWAP PHOTO is the rower's own and it is kept** (`api/row100k/app/row` POST `{ id, swap: true }`; `Feed.tsx` swapPhotos): the two photos of a row change places on the site, for everybody; the card and the grid's tile turn at once and are put back if the site refuses. Only the row's rower may, and only their own rows have the line, on the feed and on their grid. Round 33's swap turned the card for the looker alone and was the same as a tap; that is gone.
- **SHARE LINK did nothing on the phone**: the menu closed and the share sheet was asked for in the same breath, and a phone will not bring a sheet up from a screen on its way out. The sheet now comes up over the menu and the menu goes when the sheet does (`ui.tsx` HoldItem `wait`). The cause is read from the code, and SHARE on a profile, which was not in a menu, worked for him. NOT seen on a phone.
- **A row has its own page on the site**: `rowtember.com/r/<rower number>/<row id>` (`src/app/row100k/r/[num]/[entry]`), LIVE by his word and linked from nowhere. It shows a visitor what the feed would: a private rower's row says it is private and no more, a row the lights-out hides is blocks and no photos, anything else that is not there is a 404. A message draws its card from the line "Ada Lovelace rowed 5,000 m at 1:57 /500m" and the row's first photo when a stranger may see them. SHARE LINK hands that address on (`files.ts` ROW_URL). The lights-out face of the page is NOT seen: no window is open in the sandbox.
- **The little buzz** (`buzz.ts`, `expo-haptics`): as a held row comes forward, as a tab changes by press or by drag, on a like, on a swap. HIS "ding" on a like is taken to be this, a knock and not a sound: MINE to have read it so. The part of the phone that makes it is in the build from 1.3.0; on the 1.2.0 build every one of them is nothing at all.
- **The page that came up blank** (`App.tsx`, `Profile.tsx`): where a pane stands was held twice, in the app's count and in the phone's copy that ran the glide. A page drawn while they disagreed (a second drag before the first glide was over, a press on the bar mid-glide) was put a screen's width off and stayed there until a finger moved the count. Now the app runs the glide itself, the count is right before anything is drawn from it, and a glide that is cut short is finished on the spot before the next drag or press is read. The fault could NOT be made to happen in a browser, before or after: this is the cause as read from the code, and six flicks 60 ms apart and a press mid-glide leave a page in place there. If it still happens on the phone, the cause is another.
- **Comments**: the viewer's own name is ink like anybody's; the sheet goes down to the foot and the shade lifts as it closes (200 ms), and a press on a name opens that rower after it.
- **The gallery goes on as it is read** (`Feed.tsx` RowGrid `more`, counted up by the profile's own scroll): no MORE ROWS button; thirty tiles, and the next thirty as the end of the page comes near, with a spinner at the foot while there is more.
- NOT done, and HIS to say: the bar over the page going across with the page when a tab is dragged ("on Instagram, the header goes with them"). Swiping between the two photos on the feed was asked and taken back in the same breath ("let's just leave ours at tapping for now").

## Round 35 (2026-11-23): the field's curves as cards with two faces, and the FAQs

"what if we gave more room to some of these KDEs? Like gave them a little more vertical space ... on the stats page ... can we say anything cooler about them? Can we do that swiping like the cards we did with the post hoc, where this one will show everyone's, but then if I swipe, maybe it can show mine overlaid on it"; "instead of questions, let's just make it FAQs. Still the Q be the thing that is blue"; "spend some time adding some more stats in that FAQ, and like a couple of them I think is appropriate." He floated scatter plots and an advanced stats button, then said the FAQs are probably where those belong. SEEN in a browser on the sandbox; NOT seen on a phone.

- **Each curve of THE FIELD on the stats tab is a card** (`Stats.tsx` `FieldCard`; the analytics' own `Box` and `Flip`): half as tall again (180 from 120), its name in the head's face, and one sentence under it worked out from the curve. The length of every row, the split of every row, the 5k and the 10k.
- **Two faces where somebody is signed in and has rows over that measure**: everyone, then the same curve with the rower's own curve and marks over it. The dots and the line under them are the analytics cards' ("Swipe: you over everyone" / "Swipe back: everyone"). Signed out, or with no rows there, a card has the one face.
- **What is said**: on the first face the field's middle (counted by the server) and the middle half, read off the drawn curve and said as "about"; on the second the rower's average or middle, their best, and where they stand: the share of the other rowers' averages theirs beats (the server's count, as on a profile), or for a timed distance the share of the field's curve their middle is ahead of. Which way is better is said where one way is: a longer row is not a better row; a split and a time are faster to the left.
- **The rower's half is its own read** (`/api/row100k/app/standing?m=`, new, the app's): the stats answer has nobody laid over it, as the site's page has not. Same builders, same period, same hidden set, so the curve sits on the chart's grid. Only the asker's own figures are in it.
- **A finger across a curve still reads it**, so a card is turned from its name, its sentence or the line under it, not from the curve. MINE: with a taller curve that is less of the card to swipe on. A touch that lands on a two-faced card is the card's, so the tabs do not change under it (`ui.tsx` scrub). The card turning under a real finger is NOT seen: it was turned by its dots.
- **QUESTIONS is FAQS** in the bar over the page, the Q still the blue letter (`mark.tsx`, `App.tsx`).
- **Two more answers** (`Stories.tsx`, `app/stories`): DO LONGER ROWS GO SLOWER, every timed row as a field of dots, length across and split up the side, the middle split of each thousand meters as the blue line, and the seconds a 500 between the rows under 3,000 m and those of 9,000 m and over as the figure (the copy says it either way round); and HOW MANY DAYS A WEEK DO PEOPLE ROW, every rower's finished week by the days rowed in it. Counts of the field, as the other answers are; the dots leave out the rowers the board hides from whoever asks.
- NOT built: an advanced stats button. He decided the FAQs were the place. NOT tried: lights out on the new answers, a signed-out viewer, a rower with no rows.

## Round 36 (2026-11-23): the opening, and Android

"add a small splash screen for row, it should prob have the ROW title and count up to the total number of meters rowed"; "def start making an android build of the app. we will get an android phone wednesday." SEEN in a browser on the sandbox; NOT seen on a phone.

- **The opening** (`src/splash.tsx`, over the whole app in `App.tsx` Root): once a launch, ROW on the paper with its O in the blue, and under it every meter anybody has logged (the stats tab's number, `api/row100k/app/total`) rolling up from nothing over about a second, METERS ROWED under it, then the whole of it fades and the app is there. The app draws and reads ahead under it the whole time. The phone keeps the last total it saw so the count starts at once; with none (a first launch with no network) it is the mark alone. A tap lets it go; reduce motion shows the figure without the roll. It is JavaScript only, so it goes out over the air; the phone's own still screen before it (the icon) is unchanged.
- **Android** (`src/insets.tsx`): an Android phone draws the app under its status bar and its navigation bar, and react-native's SafeAreaView does nothing there, so the app is padded by the sizes the phone reports (`react-native-safe-area-context`). Required on Android only: the iPhone builds 1.2.0 and 1.3.0 do not carry the module. The fixed 28 at the top on Android is gone. Modals still keep their own 28 at the top: NOT seen on an Android phone.
- First Android builds (1.3.0): a test build that installs as a file (eas.json preview `android.buildType: "apk"`) and the Play build. The signing key was made in Expo's cloud and stays there. Push notifications on Android need a Firebase project (his to make): until then the phone asks for a token and quietly gets none.

## Round 37 (2026-11-23): the Developer account, rower 000

"We just need a single reviewer/dev account. Give them rower 000 and name Developer. Give it a copy of all my data (always just pulls data from my account 001) and make any changes that it makes to it's data reset the next day ... Or we can have a reset button for the dev account in the settings ... We also just need a password for it no username ... can we set one up w/o me being in vercel?" SEEN on the sandbox (signed in through the app's own Developer sign-in, the grid, settings, the password page; the reset by its button and by winding the day back); NOT seen on a phone or in production.

- **One account, rower 000, "Developer"** (`src/lib/devAccount.ts`), opened by a password alone: DEVELOPER SIGN-IN under the sign-in buttons (`Account.tsx`), which replaced APP REVIEW SIGN-IN and its name field. It is made the first time the password is right, or the first time the password is set.
- **The password is set in the app**, by an admin: Settings > DEVELOPER PASSWORD (`Settings.tsx` DeveloperPassword, `api/row100k/app/dev`). Only a scrypt digest is kept, in RowSetting `dev.password`; it cannot be read back. APP_REVIEW_PASSWORD on the host still opens it if ever set; APP_REVIEW_USER is gone.
- **Its data is rower 001's, copied**: every row (the photos are the same stored files, never copied and never deleted), the bio and words of the profile under the name Developer, the profile photo, the erg pieces, and who 001 follows. NOT copied: 001's likes, comments, notifications, opt-ins.
- **It goes back to 001's every day**: the first request the Developer makes on a later Pacific day wipes everything rower 000 did and copies 001 again (claimed by one conditional write so two requests cannot both copy). RESET THIS ACCOUNT in its settings does it at once (pressed twice). The wipe checks that rower 000 is the Developer's before it touches anything, and touches nothing of anybody else's.
- **Nobody else ever sees it** (`src/lib/devHide.ts`, applied to `db` in `src/lib/db.ts`): every read of rowers, rows, erg pieces and the social tables leaves rower 000 out unless it names the Developer, so the copied meters are never counted twice: not on the board, not in a total, not in the stats, the feed, a follower count, an email or a site page. Its own likes and comments are shown back to it alone, by the bearer token on the request. Its actions notify nobody (`rowNotify.ts`). A read of rower number 0 by anybody else is NO SUCH ROWER. The live race's raw SQL carries the same rule by hand.
- **Rower 0 is a real number in the app**: places that read "no rower number" as false now ask for null (`App.tsx`, `Profile.tsx`, `Social.tsx`, the feed route's `?rower=`), so 000 shows as 000.
- NOT seen: copying erg pieces and follows (the sandbox's rower 001 has none); the Developer logging a row; Apple's reviewer deleting the account (it is made again at the next sign-in).

## Round 38 (2026-11-23): the opening's zeros, its pop and its build line; the grid's own loading squares; the push's whole-second pace

- **The opening's count wears every place from the start, and one more** (owner: "Always add a 0 in front of the digits that we end with ... those ... million places should be 00"): 13,303,326 counts 000,000,000 → 013,303,326 (`splash.tsx` zeroed).
- **ROW pops in first** ("first the row pops up, kind of like it does on the top bar ... and then the numbers start going up"): a spring from 55% size; the count waits about a third of a second for it. Reduce motion: no pop.
- **A build line at the foot of the opening** ("a small secondary text for yourself and others ... where a version number would be"): `V1.3.0 · PRODUCTION · UPDATE NOV 23 10:42`, or `AS BUILT` when the phone runs the code it was installed with. Answers "did the update land?" by looking.
- **The profile grid loads as its own squares** ("it looks like it's loading like a post, but it's not loading posts"): twelve 3:4 squares, three across, in place of a feed card (`Feed.tsx` RowGrid). SEEN in the browser.
- **The row push says the pace in whole seconds, tenths dropped, never rounded** ("if it was 221.7, it just becomes 221"): `rowNotify.ts` rowedWords; the notifications list too. The row's page keeps its tenths.
- NOT seen: the pop and the roll on a phone (the browser pane was hidden, so its frames did not run); the build line's update stamp (web has no updates).

## Round 39 (2026-11-23): the splash rolls, the KDEs grow

- **ROW rolls in letter by letter** on the splash, as the bar's title does ("I want it to roll in like it does on the title ... one letter by letter"): each letter rises into its own window, 70 ms apart; the count starts as W lands. Replaced round 38's pop.
- **The foot reads FOR YOURSELF AND OTHERS** ("instead of the version number stuff"); the build line is gone.
- **The KDEs are taller** ("give more vertical space to the KDEs"): the stats tab's field cards 180 → 260, the profile's curves 120 → 200 (`Density`'s default).
- SEEN in the browser sandbox (the letters' order, the count after, the foot, the 260 cards); NOT seen on a phone at full frame rate.

## Round 40b (2026-11-23): the 100K tab's months and warming up

"On the 100K tab, I think I want to be able to change what month I'm looking at. I want to see September's and October's results as well"; "I'm also still not able to click on the warming up section and have me see those rowers." Typechecked (app and site); NOT seen in a browser and NOT seen on a phone.

- **The month, at the top of the board** (`Board.tsx` MonthPick, both looks): the month's name big between two boxed arrows, an arrow with nowhere to go greyed out, and the name itself a menu of every month there is a board for (Rowvember, October, Rowtember). Under it THIS MONTH in the blue, or FINAL. This month is the default. While another month's board is on its way the arrows stay up over the loading blocks.
- **The route takes `?m=2026-10`** (`api/row100k/app/board`): a month from Rowtember through this one; nothing is this month; anything else is a 400, never quietly this month. It answers `months` (oldest first) and `live`. The rows come from the site's own builder (`boardPageData.ts` buildBoardPage, now with an optional month; the site's /board still asks for this month only), through `boardView` with the period, so the lights-out mask and the Developer rule are the ones this month's board has.
- **September had no opt-in** (it began 2026-10-01), so its board is everyone who rowed it. October and on are the rowers opted into that month.
- **A past month is final standings**: FINAL STANDINGS where the day of the month was, every day's square filled, no OPT IN, the rungs in that month's name, and the rowers under 10K listed in full under UNDER 10K instead of the warming-up line. In the sheet: no days ahead to plan, no ringed today, the boxes are the month's last eight days.
- **WARMING UP opens** (this month only): the one line is a button with SEE ▾ at its right in the blue; pressed, it lists every rower in it (each opens that rower) and reads HIDE ▴; pressed again, it is one line again. A long list has a second HIDE at its foot. Shut again on a month change.
- NOT seen: any of it on a phone or in a browser; a past month during a live lights out; the menu's width with the longest month name.

## Round 40 (2026-11-23): stories atop the feed

"a story recap. I want anyone who has rowed in the last 24 hours to show up kind of like a story at the top of the feed. And when we click it, something similar to stories happens ... we'll just show their first photo and some text about length and time and who did it"; "there's probably a section or an area that you can click on that lets you go to that row, and then otherwise it lets you just go to the next one"; "We can build that, ship it, and we'll see how we like it." Typechecked (app and site); NOT seen in a browser and NOT seen on a phone.

- **The route** (`api/row100k/app/recap`, new; not `app/stories`, which is the FAQs): for the signed-in rower, every rower with a row logged (createdAt) in the last 24 hours, the one who logged last first and the viewer's own ahead of everybody when they rowed; each with those rows oldest first, the first photo only. Who is left out is the feed's rule: private rowers who have not accepted the viewer, both sides of a block, the muted, the Developer (lib/db.ts). A row the lights-out hides is LEFT OUT, not drawn as blocks (MINE: a story is the photo, the length and the time, and the lights-out hides all three); with the board unreadable during a window, everybody's but the viewer's own.
- **The circles** (`Recap.tsx` RecapStrip, the feed's list header): the face, or the rower number in a circle without one; the ring in the blue until every row in it has been seen on this phone, then the hairline (the seen row ids kept on the phone, `recap/seen/1`); the first name under it in the small mono, YOU for the viewer's own (MINE). Gone when nobody rowed in a day. Read again with the pull down, a row logged, an account change. A drag along circles that run past the screen does not change the tab.
- **The stories** (`Recap.tsx` RecapViewer): a page to a row, the first photo filling the screen with a dark wash at top and foot; a row with no photo is the paper with its figures big in the middle. The bars on top, one per row of that rower's; the face, name, number and how long ago under them (a tap opens the rower); an X. At the foot the meters big, TIME and PACE (whole seconds, /500m), and SEE THE ROW: a tap there opens the row. The left third goes back, the rest goes on; five seconds a page; held, it stops; a drag down closes it. Past a rower's last row is the next rower's first row not yet seen; past the last, it closes.
- NOT built: a recap for a viewer who has not joined (the route answers JOIN FIRST and the circles are not drawn); seen rings moving to the end of the row as Instagram does (the server's order stands).

## Round 40c (2026-11-23): a held square lifts off the page

"whenever we hover over or like hard press one of the posts on the gallery, I need it to like animate open ... right now it just pops open ... I want to pick it up and lift it up and make it bigger ... I want to take it, lift it off the page, show it, give it the options. Then I can swipe down and have it be removed. Also, I feel like when I press and hold it to view it, I also want to see the how long and how fast stat." Type-checked only; NOT seen in a browser and NOT seen on a phone.

- **The held menu is `lift.tsx` `LiftMenu`** (it replaced `ui.tsx` HoldMenu; `HOLD_MS` and `HoldItem` stay in ui.tsx). Both holds use it: a square of a profile's grid (`Feed.tsx` RowGrid) and a photo on the feed (`ui.tsx` PhotoSwap `onHold`, which now hands on where the photo is, `Held.from`).
- **Up**: the held square is measured on the screen (`measureInWindow`) and the card is first drawn so its photo sits exactly on the square, then springs to the middle and grows to the card's width (about a third of a second, the native driver). The page darkens as it goes; the card's paper, its shadow, who and when, and the figures come up round the photo in the last part of the way; the list rises under it. The buzz is the held row's own (`buzz.thud`, round 34).
- **How long and how fast**: DISTANCE, PACE (to the second, "/500m" small after it) and TIME under the photo, in the feed card's figure style.
- **Down**: a drag down takes the card with the finger, smaller as it goes (to 80% at 420 px), and the dark thins so the page shows. Past 110 px or a flick and the photo goes back into its square as the dark goes (280 ms); short of that it springs back. A press off the card, on the card, or the phone's back does the same. SHARE LINK goes back into the square once the share sheet is done; the other lines close at once, as before.
- **The square stays on the page underneath**; the photo lands on it and the cover goes. MINE.
- **Reduce motion**: nothing flies; the card fades up in the middle and fades away there.
- NOT done: the finger that held the square cannot drag the card without lifting first (the phone keeps that touch on the page under the cover). No blur behind (no blur module in the build). NOT checked: Android, where the square's place and the cover's may differ by the status bar if the app is ever not drawn under it.

## Round 40d (2026-11-23): fixes from the owner's long list

- **The race grades itself on passes** ("optimize the number of people that I'm passing ... people that are passing me and people that I'm passing"): an open lane goes to the boat that will cross the rower soonest (inside 90 s), and a boat that never will (same speed, not beside the rower) gives its lane to one that will cross inside a minute, one trade every six seconds (`erg/ghosts.ts` nextBoat, `GhostRace.tsx`). Rivals at the start weigh lead changes three times as much.
- **The feed's pull-to-refresh spinner wears the ink**, so it shows on the dark look.
- **A field card turns by a JS pager, not a native scroller** (`Field.tsx` Flip): a drag on a chart scrubs and never moves the card; a drag elsewhere on the card turns it and keeps the drag from the tabs. The dots stay; the "Swipe: ..." words are gone.
- **A profile's field charts are the stats tab's cards** (`Stats.tsx` FieldCards), the rower's face first and everyone a swipe away. Average row and average pace are in the ink.
- **The pace chart** is 220 tall (was 150), its key is gone, its head says how many rows, and the picked row's ring is filled grey.
- **The stats tab's time frame and stat** are two centred buttons with a caret (`WordMenu` chip).
- **Sign-in** is Apple, Google, Developer sign-in, then Terms and Privacy policy; no heading, no "by signing in you agree", no line on abusive content.
- **Search** leaves the Instagram handle off.
- **The splash's count** springs up as zeros and the M, then counts.
- SEEN in the browser sandbox: the stats buttons, scrub vs turn on a card, the board's months, the feed's circles and a story. NOT seen: any of it on a phone, the race on the water, sign-in, the lift.

## Round 41 (2026-11-23): centred, wrapped, and the month as a word

- The profile's time frame is the centred caret button the stats tab has; on the stats tab the big number and its line sit centred under the two buttons (`Lead center`).
- The pace chart rules every 5 s (labels thin to what fits).
- A field card goes round: a swipe past either face lands on the other (`Flip`, a copy at each end of the strip).
- On the stats tab, a fastest 5k / 10k or a longest row opens THAT ROW (found in the rower's log by its day); total meters and the biggest day still open the rower.
- A held photo: a tap on the photo turns to the row's other photo; a tap on the figures opens the row.
- The 100K tab's month line is the menu (dotted underline, a drop-down of every month); the arrows are gone.
- SEEN in the browser sandbox: all but the held card's taps and the record tap. NOT seen on a phone.

## Round 41b (2026-11-23): the analytics compare with densities

"if we're going to show this sort of like you against everyone on a line chart, the line chart's probably not the way to go. It's definitely like a KDE ... Show me the KDE where I lie ... if we can't show it in one chart or one page, that's okay. Just make another page ... we can keep swiping"; "joules per stroke 441 and everyone else is 446. Is that a big difference? Is that a little difference? A KDE will help me there"; "For the rate and length graph ... there's only 1 dot on there ... We have all the race day data." Typechecked (app and site); NOT seen in a browser and NOT seen on a phone.

- **The line charts are gone** (`Field.tsx` Strip, Strips, SteadyField, WorkField). Each figure against everyone is now its own curve of every rower's figure (`reviewBits.tsx` FieldDensity, a Gaussian curve with Silverman's bandwidth worked out on the phone from the field's list): the grey filled curve on the ink rule with a tick a rower under it, the rower in the middle as the dashed grey line (MIDDLE and its figure), this row as the blue line with YOU and its figure, and where one way is better the part of the field the row beats washed in the blue. Under it one plain line: "Steadier than 74% of rowers" (a share once there are ten rowers, a count before that), and at the right of its name the way that is better ("Lower is steadier", "Neither way is better").
- **How big the gap is**: the sentence under each curve gives the two figures, then the middle half of rowers and whether the gap to the middle is small, clear or big against it (under a quarter of the middle half, under three quarters, more).
- **One figure to a face, as many faces as figures** (`Pages.tsx`, new: Flip's JS pager for any number of faces, going round, the dots from `ui.tsx` Dots so a tap or a held slide picks a face). HOW STEADY: the row's card, then split spread, steady pace, same stroke, rate held. RATE AND LENGTH: the row's card, the dot a rower, strokes a minute, meters a stroke. WORK PER STROKE: the row's card, joules a stroke, kept to the end (nearer zero is better, so nothing is washed). A face is there only where the row and the field both have the figure. The curves do not scrub, so a drag anywhere on them turns the card.
- **The card's questions page** draws the same curves bare, one a face, under AGAINST EVERYONE: steady (four), rate (the dots, then two), force (where the push peaks, same stroke), work (two).
- **Kept as they were**: pace along the piece against everyone, and the force curve against everyone.
- **Why rate and length had one dot** (`api/row100k/app/field`): the field put each recording to `userId`, the account that SAVED it, and every race-day piece was saved from the console on the owner's laptop, so the whole of race day was one rower, him; and it read only the newest 80 recordings. Now a recording is the rower's who was on the erg: the Rowtember rower it was filed against, as the account behind that rower when there is one (so a rower's phone rows and race-day rows are one rower); a console piece with no rower named is its own rower (MINE: his own unnamed console pieces count that way too). It looks over the newest 4,000 recordings, measures the newest six of each rower, 320 in all, read forty at a time; the force curve against everyone is grouped the same way. Still at most once in half an hour on the live site.
- NOT seen: any of it drawn, the curves in the dark look, a field of one or two rowers, how long the field now takes to work out on the live site (320 recordings measured where it was 80).

## Round 41c (2026-11-23): numbers for faces, dots you can hold, a gutter

- **No photo, the rower's number** in every face (`ui.tsx` Avatar `num`), as the story circles had it; Settings no longer says initials stand in.
- **Dots you can touch** (`ui.tsx` Dots): a tap on a dot goes to its page; a finger held on the dots and slid along goes page to page under it. Used by the field cards and the analytics pages.
- **Air round each card face** (Flip GUTTER 14): the spring's swing shows the gap, not a clipped card; two faces never touch. More room above and below the dots.
- **Stories**: the bars start under the iPhone's camera (read off a SafeAreaView, not the safe-area module the installed builds lack); no rule under the circles; the circles read again after a photo swap. **A profile's face is ringed when that rower has a story** and opens it (`Recap.tsx` StoryRing).
- **The check rolls in after the number** in the top bar (`mark.tsx` RollIn).
- **Profile stats**: All time first; the time button back at the left; the pace chart's range is the dots plus a margin, with a line every 1, 2 or 5 s as fits. The length card's "longer is more meters in a sitting, not a better row" is gone.
- **Rankings**: time frame, record and who (Everyone, Men, Women) are three caret buttons, centred. Caret buttons are 8-point corners, not pills.
- **The tab bar's highlight** is nearly the bar's height and a little wider than its slot, as Instagram's.
- **The splash's foot**: FOR YOURSELF AND OTHERS · V1.3.0.
- SEEN in the browser: the number faces, the story ring on a profile, the bigger highlight, the gutter and dots, the copy gone. NOT seen: the analytics' new density pages (Round 41b), the story bars on an iPhone, any of it on a phone.

## Round 42 (2026-11-23): the produced row

His words, by voice: "during the row, I want users to want to use our app during the row ... I want to produce a screen that they're looking at ... for a 5K, we get to run like a 20-minute television show"; "as I'm rowing, I want that screen to change. I don't want it to just change like a screensaver ... I want it to change a little intelligently. I want it to change when things in my stroke change"; "I want my eyes to be glued to my screen while I row"; and then "I like the idea of having a director / producer ... having them have a bunch of scenes to choose from and maybe cues for when to put those scenes in."

- **One more page of the monitor, the one after the race** (`screens/Produced.tsx`; every page there was is still there). It says PRODUCED, and after it, for a few seconds, the one word for the cue it just took (HALFWAY, PASS, PACE UP, LAST 500 M). A set distance only, as the race is. MINE: one swipe (or one tap) from the race and not ahead of it until he has seen it on a phone; the race is the page he said to land on.
- **Always up** ("The stats that are always important are how many meters are left, what's my average pace, and what's my ETA ... should be there all the time"): METERS LEFT, AVERAGE, FINISH over every scene. On its side the phone has NOW and TIME beside them; upright those two are under the stage, beside the curve.
- **The stage and the curve** ("some nice like animation on the left and showing their force curve on the right"). The stroke being pulled is drawn in the blue over the grey mean of the row so far: at the right on a phone on its side, under the stage upright.
- **The director** (`erg/director.ts`, no React, no network, no clock of its own). Told where the row is four times a second, it answers with the scene and why. Held by the monitor beside the race, so it has watched the whole row whichever page was up. The scenes:
  - LANES, the race as it was, five lanes.
  - DUEL, the same race with three lanes in view, or the rower's own ("reduce the number of people we're racing against to 3 ... 2 of the edge people fall off ... keep it at 1, 3 or 5"). The lanes grow about the rower's and the edge ones leave the water; nobody loses their lane (`GhostRace.tsx`, `lanes`).
  - THE FIELD FROM FAR UP ("one animation is the zooming out of that race screen ... very faint dots of everyone's row"). The camera goes up from the race's own picture until the whole field is on the water, the lane boats small boats and the live ones green, and comes down again. THE FIRST CUT WENT UP OVER ALL 5,000 M, and everybody was one thin column of dots, because every row leaves the start with the rower. Now it frames the field, and the whole course is a bar along the foot: blue for what is rowed, a box for the stretch on screen, a tick at half way. MINE, and the thing to react to.
  - TWO FORCE CURVES, the earlier stretch grey and the later one blue, drawn across after it ("the force curve for the last 1,000 ... versus the last 1,000. Or near the end ... the first 1,000 ... this last 1,000").
- **The cues.** The start: five lanes. A surge (the last 100 m two seconds a 500 quicker than the 100 m before): the rower's lane alone. A fade: three lanes. The curve's shape changed against the stretch before: the two curves. A boat about to cross the rower, or just crossed, and not in the picture: the lanes widen to take it in ("maybe there's a 4th and 5th added again"). Half way: the field from far up. A little before the last stretch: first stretch against last. The last stretch (500 m of a 5K): five lanes and nothing else. The last strokes (100 m): three lanes if somebody is beside the rower, their own if nobody is. The finish: five. And when nothing has happened for a while (about 70 s of a 5K): five lanes come in to three; from three, up over the field and back, or the last 1,000 m's curve against the one before; then back out to five.
- **No flicker.** A scene is up six seconds of the wall before anything but the last stretch takes the screen; a cue that comes sooner waits a few seconds and is dropped if the moment has gone, but a mark along the way (half way, first against last) keeps its turn. The far shot and the curves rest between showings.
- **A 1K is not a 5K.** Everything is cut to the piece (`planOf`): the curves are compared over a fifth of it (1,000 m of a 5K, 200 m of a 1K), the last stretch is a tenth, quiet follows how long the row will take.
- **Nothing is cut.** Layers of one stage fade into each other with the phone's own animation; the lanes and the camera are eased frame by frame, as the race is drawn.
- `npx tsx scripts/director-check.ts` rows a steady 5K, a 5K with two kicks and a changed curve, a 1K, and the demo row at ten times a clock through the director and prints each timeline. A steady 5K is 23 scenes; the two kicks and the changed curve are each caught inside 150 m and 300 m.
- MINE, all of it to react to: two seconds a 500 for a surge; the six seconds; the surge showing the rower alone and the fade showing three; the words; that a pass already in the picture changes nothing but the word; how unlike two curves must be (never seen against a real rower's curve: the simulator pulls one shape all row, so in the demo only the timed compares show).

**The same day, from his list:**
- **A tap turns the page** ("Let me just tap the screen instead of swiping"): anywhere that is not a button, and from the last page back to the first. The swipe is as it was.
- **A phone that is turned keeps its page.** It used to land between two pages or on the first.
- **The others row on to the line** ("When the race finishes, let the other rowers in my lanes also finish ... not idling"). The seconds on each lane stand at what they were as the rower crossed; the boats come up to the line at their own pace and stop on it.
- **The log form**: the title comes filled in, "November #18" (the month and which row of it this is; the site's own default, `/me` now says the month's count); the labels are Title and Description; the date reads "Nov 23, 2026" and opens a calendar made in the app (no phone date wheel: that needs a new build).
- NOT DONE: "Don't let the other screens ... go horizontal." Holding every screen but the live row upright needs a piece of the phone the app does not carry (`expo-screen-orientation`), so it needs a new build from him; nothing was added.

SEEN in a browser on the sandbox (headless Chrome, a demo row start to finish at ten and at twenty times a clock, upright and on its side): every scene, the camera going up and coming down, the lanes going 5 to 3 to 1 and back, both compares, the cue words, the last stretch and the finish with the boats on the line, the tap from page to page, the page kept through a turn, the log form with its title and date, the calendar open and a day of last month taken (the title steps aside for the site to number). NOT SEEN: any of it on a phone; a real monitor's curves through the director; the tap on a phone, where it shares the page with the swipe.

## Round 43 (2026-11-23): one push a row, and the bell under "every row"

- **Two pushes for one row** came from two tokens for one phone (a phone set up again keeps getting the old token's pushes). Saving a token now drops the account's other tokens of that kind (`api/row100k/app/push`); a phone cleans itself up the next time the app opens.
- **"Every row" turns the bell on for everyone you follow** (and "every row of the rowers I follow" the same): the relation's `bell` reads on, with `bellAll` saying why (`lib/rowSocial.ts`).
- **Turning the bell off under it asks**: "Off for <name>" or "Open Settings" (Profile.tsx). Off for one rower adds them to `RowSocialSetting.quiet` (new, additive column), which the blanket settings skip (`lib/rowNotify.ts`); turning the bell back on takes them out.
- Checked on the sandbox database: plain follow, bell off; every row on, bell on and asks; left out, bell off. NOT seen on a phone.

## Round 45 (2026-11-23): 11/26, records that open their row, a policy that does not promise

- **The 100K tab's title is the month**, "11/26" with the month in the blue (mark kind "month"); a press opens the months (Board.tsx MonthSheet); the board's month is held outside the screen (`useBoardMonth`). The admin look swap is a long press now.
- **The check leaves with the number** (mark.tsx BadgeSlot): it rolls out with the old word and in after the new.
- **Stats**: median row and median split side by side; the stat chosen is remembered (for the app's life and on the phone); a card claims a sideways drag at 6 points.
- **Records name their row** (`RecordRow.entryId`, from the board's own entries): a fastest or a longest opens that row at once, on the stats tab and on rankings; rankings' three buttons fit one line (`tight`), and a fastest shows its pace under its time.
- **Bests link to everybody's**: "Everyone's fastest 10k · rankings →" under a rower's bests.
- **Privacy policy (2026-11-23)**: no promise never to sell or advertise ("today we do not ... we will change this policy before it starts"); birthday, height and weight used in aggregate; a rough location may be estimated from the IP and the machine.
- SEEN in the browser: 11/26 and its menu (October picked), medians side by side, the rankings line (desktop width). NOT seen on a phone.

## Round 46 (2026-11-23): a bar while a row is sent, and the time it was rowed

- **A bar under LOG** (owner: "we need like a animation for loading/sending or a % going up ... it's a little unclear, like how long does it have left, or is it working"). The button gives its place to a big percentage, the step it is on, and a bar (RowScreen.tsx `Sending`). The count is `Progress` from upload.ts `logRow`: 12% for cutting the two photos down, most of the rest by BYTES that have left the phone out of the bytes of both photos and their small copies (a photo is sent with a request that reports on its way up, not `fetch`), then the row's save, then the recording when there is one. A step with no count creeps along the stretch it was given, and a light band crosses the bar all the time, so it is never still and never goes back.
- **A monitor row prints the time it was ROWED** (owner: "if it's a PM5 over Bluetooth, we should set the time as the time rowed, not the time submitted"). `src/lib/rowedAt.ts`: the recording tied to the row (RowTelemetry.entryId) says when it started and how long it ran; start plus length is the clock printed on the feed, the row's page in the app and on the site, and the hour in the hours chart. NOTHING is stored and the database was not changed, so monitor rows already logged show it too. A demo, a finish after the submission, or one two months before it, is not believed. The feed's ORDER is still by submission, and on the site's feed a row rowed on another day keeps its landing day's section (the app's card says the rowed day: `FeedItem.rowed`).
- MINE: the rowed time is the FINISH (start plus length), not the start.
- NOT DONE: the recap's "2 h ago" (Recap.tsx and its route were another session's that hour) still counts from the submission. And the third ask of the same message, every monitor row logged at once with photos added after: not built, see the hand-over note.
- SEEN in a test browser on the sandbox: the bar from 2% to 94% over a throttled connection with two real photos (the storage and the save were stood in for, nothing was sent anywhere real); the feed's top row reading "Yesterday at 12:52 PM" where it read "Today at 3:11 AM". NOT seen on a phone: the byte count over a phone's own network.
- **The end buttons never flash on the first stroke** (owner, the same day: "as soon as I started rowing ... like the first stroke, it pulled up those buttons to like submit and cancel my row, and then they went away"). "The meters have stood still" was a note taken once a second, and before a row they have stood at nothing for as long as the rower took to sit down; the first stroke made the meters 1 while the note was up to a second old. It is worked out as the screen is drawn now (RowScreen.tsx Monitor), and a piece the monitor calls finished has to have been so for 1.2 s. SEEN on a demo row at clock speed (first stroke 7 s after the monitor came up: no buttons) and at a real finish (buttons about 1.5 s after). NOT seen on a monitor.

## Round 44 (2026-11-23): the row just logged, lifetime and the board

His words: "instead of the number that counts up being the 5,000 ... I want it to be ... my lifetime"; "my next thing is till like 1 million ... the progress isn't very large ... maybe we change the axes"; "saying 115 of 100K doesn't really do it for me here ... show this November stat is by the board ... my number increasing and then my position changing"; "I want to see Abraham's name here ... show the people that are ... 1 below me and 5 above me". Typechecked; NOT seen in a browser and NOT seen on a phone.

- **The row just logged** (`RowPage.tsx` Logged): the big count-up is ALL-TIME meters, rolling from before the row to after it, in the ink; the row itself is the small line under it (+5,000 m, the time, the split).
- **The next mark** (the axes changed): a bar over a round stretch sized to the row, the smallest of 5K, 10K, 25K, 50K, 100K... that is at least four times the row, so a 5K fills a fifth of 25,000 m. "To 1,250,000 · 2,000 m to go"; a row that crosses one fills its stretch to the end and says PASSED. The ends of the stretch are printed under the bar.
- **The next rung**: its thin bar starts where the rower stood at the start of the month, or at the rung below, whichever is later (never at 0): "To 2M · 755,000 m to go". New tag as before.
- **The month's 100K bar** shows only while the month is still short of 100K (or this row gets there: THE 100K CLUB). Past it, the board is the month.
- **The month as a slice of its board** (Climb, Slice): the rower's line with five above and one below, each with place, rower number, name and meters, read from `/api/row100k/app/board` (the 100K tab's rows and mask: blocks for a hidden total, the run-up's shape, no place for the hidden elite). The rower's meters count up; if the row passed anybody, the line starts under them and rises over them as each drops a place, then the window settles to five above and one below (a short climb: the line visibly rises, the window follows a beat later; a long one: the window rides with the line). Places belong to the slots. Under it: "9,000 m behind 012 · Abraham Singleton", "Level with", or "Behind 012 · Name" when the board hides that total; "Leading the board" at the top. A line opens its rower. A rower who is one of the hidden elite in a lights out does not move.
- **Against your usual**: every figure in the ink, better or not; the big meters of a row's page too.
- **Analytics**: the date, the monitor and "PM5 over Bluetooth" left the head; they open the foot now, over the monitor's serial line and the packets.
- **Coaching is for a goal**: every cue reads "For a faster time: start 1.8 s a 500 quicker." with the goal first (in the grey): For a faster time / To hold one pace / For the same speed on less effort / To not fade at the end / To not fade or burn out / For more speed from each stroke / To be more consistent; a fade says "For a faster time, or to hold one pace". The rate-and-length card's "Next row:" lines and the field pages' "How do you move it?" answers say what they are for the same way. No cue claims the heart rate: nothing here reads it.
- MINE: the step sizes (four times the row); the lifetime count in the ink, not the blue; the 100K bar kept for a month short of it; the window's lag.
- NOT seen: any of it drawn; a climb past many rowers; a row logged during a lights out; a long name in the slice. NOT changed: `pm5/analysis.ts`'s own "what next" lines (the site's copy), printed only when no cue could be made.

## Round 47 (2026-11-23): stories by the time rowed

- The stories keep a row for a day from when it was ROWED (lib/rowedAt.ts, as the feed prints it), not from when it was sent, and order and age them by that time (`api/row100k/app/recap`). Site only; no app update needed.

## Round 48 (2026-11-24): a demo row can be logged, pretend

- Owner: "if I submit the demo row, I want to run through like the post screen. Like I want to be able to fake submit a row."
- A demo row's end buttons are now the real ones: DISCARD and LOG X M, with "Just its analytics" under them (the old end). LOG opens the real form, headed "Demo row · nothing is saved · photos optional"; the photos can be left empty. Its LOG runs the progress bar through the real steps (about three seconds, "A demo: nothing is being sent.") and lands on the page a logged row lands on, headed "Demo row · nothing was saved": all-time count-up, the bars, the month's board with the demo meters added to the rower's line (it climbs over anybody it would pass), the read of the piece, DONE.
- Nothing leaves the phone: no row, no photos, no recording kept, no read of the session again, no stickers dropped. The page has no like/comment/share, no three dots, no stickers or reels.
- In development a demo row used to log for real; it is pretend there too now (log by hand for a real one).
- Seen in the sandbox (1,000 m demo at 40x): form, bar, page, board +1,000. NOT seen on a phone; a demo climb past other rowers not seen (the sandbox rower leads the board).

## Round 49 (2026-11-24): the wiki, and the arcade's first game

- THE WIKI (owner: "give me a wiki for the future planning ... just for me ... put it in the settings page"): Settings, Wiki, admins only. screens/Wiki.tsx draws wiki/pages.ts: pages in the order of the work (now, being built, next, later, background), lists, steps, quotes, and two drawings (one 250 m game as a minute; a 5K as twenty blocks). mobile/PLANS.md is the same plan as a file; mobile/ARCADE-RESEARCH.md the research.
- 159, THE FIRST GAME (arcade/): hold the pace you lock in; every 50 m a shot at the rocks; four hits win, rocks left wipe you out; a wobbly 50 m can still hit, LUCKY. Title card with the flip dots and the briefcase (5 s, or 150 m), band = 1 SD of your own stroke paces (1.5-4 s), chest after every game (one item, or three with the rainbow), 38 skins over hull, oars, rower, aura in five rarities, kept on the phone. Settings, Locker (admins) to wear them. The director's schedule: 5K at 1,000/2,000/3,000/4,000, 2K at 1,000, 1K at 250, every 1,000 m on a plain row. On the produced page it takes the stage; on the other pages it lies over them; never on the last page or once stopped. Admins only: the store build has no games.
- Pure logic, checked: scripts/arcade-check.ts (steady rower wins ~68%, wobbly ~0%; drops 60/25/10/4/1).
- Seen in the sandbox: a 1K demo at 10x (title, rocks, HIT, gauge, wipe-out, chest), the wiki and its drawings, the Locker. NOT seen on a phone or a real PM5. Open: play length (200 m, ~48 s, against his 30 s), the race boat wearing the skin, a server table for skins.

## Round 50 (2026-11-24, overnight): both photos in stories, the ratings tab

- STORIES SHOW BOTH PHOTOS (owner: "I actually do want to look through both of the rows, photos ... one right after the other"): a row with two photos is two pages back to back, the bars count pages, taps step pages; the row's figures are on both. The recap API sends `photos` (both) beside the old `photo`. A browser tap on the left third went forward (no locationX on a click); it falls back to pageX now.
- THE PROFILE'S THIRD TAB IS RATINGS (owner: "this tab I need their elo here ... average 5K pace and the standard deviation"): a bell-curve icon; the arcade's rating (own page, admins only), the 5K average pace and its spread over all 5Ks (rows within 50 m of 5,000), and a dot strip of every 5K with the average and one deviation shaded. The profile API sends `fiveK`. The meters-per-day calendar and the every-month list moved to the foot of the profile's STATS tab ("back to the stats tab"; the stats tab of the app keeps the community's calendar).
- Seen in a headless Chrome against the sandbox; NOT on a phone. Not seen: another rower's ratings tab, a rower with no 5Ks, a story row with no photo.

## Round 51 (2026-11-24): tap, not swipe

- THE ANALYTICS' CARDS TURN ON A TAP (owner: "there's 5 charts. The swiping, it doesn't feel very good. So instead, can we just tap on those and have them go through?"): Pages.tsx (the many-faced cards) and Field.tsx Flip (the two-faced cards, also on the stats tab and the profile) no longer take a sideways drag; a quick tap anywhere on the card is the next face, round and round (ui.tsx useTap: down and up inside 300 ms, moved under 8 px; a held or dragged finger reads the chart). The dots still go straight to a face.
- A ROW'S TWO PHOTOS LOOP ON A TAP (owner: "anywhere where we're opening up those 2 photos, we should be able to tap and have them loop back and forth ... I had to like tap one direction then the other direction"): the photo viewer with two photos turns to the other on a tap anywhere; a gallery of many keeps right-on, left-back.
- Seen in the sandbox: a stats card turned by a tap on its words and back by a tap on its chart. NOT on a phone; a tap on a button inside a card also turns it.

## Round 52 (2026-11-24): a row off the monitor logs itself

- THE ROW IS LOGGED THE MOMENT IT ENDS, WITH NO PHOTOS (owner, 2026-11-23: "Strava does this thing where it's like it automatically logs the row and then lets you add the photos ... the intention is that every row gets logged"; 2026-11-24, asked whether to build it: "Yes, build every single thing you need"). `src/autolog.ts` has the whole of it; the sending starts in `erg/useErg.ts`, at the root of the app, so it happens whichever screen is up. The site makes the row out of the recording alone (`api/row100k/app/erg`, `{ doc, log }`): its meters, its time and its day come off the recording, never off the phone. A row typed in BY HAND still needs its two photos before it exists.
- WHICH ROWS: 500 m or more, or a set piece rowed to its end however short. Shorter pieces wait under "Rowed, not logged yet" with LOG, as before. MINE, the 500: he was asked for the shortest row worth logging by itself and said to build it.
- WHEN: a finished set piece, about a second and a half after the monitor says so. A piece stopped short or just rowed: when the monitor moves on to another piece, ten minutes after the phone last heard from it, the next time the app opens, or at once on LOG.
- THE MONITOR'S FOOT says LOGGED with DONE and ADD PHOTOS under it; NOT SENT YET with DISCARD and TRY AGAIN when there is no signal (the row stays on the phone and sends itself, less often each time). A piece that does not log itself keeps DISCARD and LOG, and LOG now logs it there and then.
- THE FORM IS THE SAME FORM, on a row that exists: photos two or none, the title the site gave it, the words, the day. Its button reads ADD THE PHOTOS, SAVE or DONE by what it would do. DELETE THIS ROW at its foot, asked twice, is what DISCARD was.
- A ROW WITH NO PHOTOS: on the feed and on its own page the rower sees a dashed ADD THE TWO PHOTOS where the pictures would be (nobody else does); EDIT ROW opens on its photos and one visit to the library fills both. The site's feed, row page and profile grid already drew a row with no photos.
- NEVER TWICE: the site knows a recording it has made a row of (by the instant it starts) and answers with that row; a deleted row stays deleted. A piece whose connection dropped and came back is two recordings that start together: the whole one is the row, the short one is marked and left to delete.
- NEVER WHAT WAS THERE BEFORE: pieces already waiting on a phone when this arrived keep their LOG and are not sent by themselves. NEVER A DEMO: the demo row says LOGGED and sends nothing.
- THE SITE: `app/row100k/logEntry.ts` is the second half of `api/row100k/rows` moved out whole (rate limit, caps, title, the owner's note, the followers' word), so both doors save by the same rules. No change to the database.
- IN DEVELOPMENT ONLY, `?demo=600&speed=10&as=real` in a browser rows the simulator as a real piece, to drive all of this against the sandbox.
- Seen in a headless Chrome against the sandbox: a 600 m piece logged 1.5 s after its finish and two photos put on it after; DONE with no photos, and that row on the feed, its page and EDIT ROW; no signal at the finish, then TRY AGAIN; LOG pressed part way; DELETE THIS ROW; the app closed mid-row and the piece logging itself eleven minutes on; one recording sent twice makes one row; a demo sends nothing. NOT on a phone, NOT on a real monitor. Not seen: the monitor moving on to another piece, a connection that drops and comes back, the day's cap of ten refusing a row.
- KNOWN: an app closed by the phone mid-row logs what it had heard by then (the meters can be put right in EDIT ROW). Followers who asked to be told hear of every piece, a warm-up of 500 m included.

## Round 53 (2026-11-24, overnight): the arcade's world, the show, 159 as a match

- THE LOOK (owner: "think chess piece size ... Monopoly piece going around a board ... it doesn't have to be a boat ... I am a box. I am shooting circles"): arcade/Token.tsx, a small line-art box with eyes; the four skin layers are now Box (body), Shot (what it fires), Hat, Trail (aura). Ids and rarities kept, so owned items survive. BoatArt.tsx kept (the rocks game).
- HOME (arcade/Board.tsx): water, land in the corners, an island with a palm, a dashed loop the piece wanders at the rower's pace (a lap is 125 m), fish; room for four.
- THE SHOW BY THE CLOCK (arcade/show.ts, useShow.ts, screens/Show.tsx), admins only: the produced page becomes the show (on a plain row it is page 1 after the numbers). Intro 60 s, home 60 s+ with MATCH FOUND, the lobby on the next whole minute with the ready check in its last 12 s, the match, 12 s celebration, home; no match past 80%; level up at 90%, the finish line, the chest at 100%. Minutes scale with the piece (floor 0.2), real-time floors keep a 10x demo watchable. The figures always show: meters to go, this stroke, finish, average.
- 159, THE MATCH (arcade/match.ts, bots.ts): cool 3 s, aim 3 s, fire; a hit when the aim's pace is the given pace or faster in whole seconds (HIT_SLACK 0.9); damage = meters rowed in the aim; both landing cancel; health 65 m on a 5K (x target/5000, floor 0.35). Bots are other rowers' saved rows with their own median pace. Celebration: XP (match meters + 100 win / 50 draw; level 2 at 1,500, +250 a level), Elo (1200, K 32), the chest, lifetime ticking.
- Checked: scripts/arcade-check.ts, 109 checks (steady 1:59 wins 65% against level bots, wobbly 23%; no match past 80%; finale at 90/100%). Seen in the sandbox (1K demo at 4x: match, NO MORE MATCHES, final chest). NOT on a phone or a real PM5. The intro's title was cut ("ROWVEM..."): the big line now reckons a full size per letter.
- Open, for the owner: the hit rule, health, the failed ready check costing a shot, plain bots, the art. The admin's produced page no longer shows the director's scenes.

## Round 54 (2026-11-24, morning): the arcade's art, polished (Fable)

- The piece: eyes with a glint, cheeks, a smile, a blink, a worried face when the aim is off; squash and stretch on each stroke (a transform string now, the old scaleY was ignored on web); line weight scales with size.
- The rarity ladder made plain: common a flat colour, uncommon two-tone, rare a shine and a passing glint, epic a thing added (the bird hops and chirps, halo, captain's cap, viking), legendary always moving (molten lava, fireball, ball lightning, the crown's sweep, the rainbow, starfall). Ids, names, rarities unchanged.
- The board: sand, grass, shallows and surf, the path as a ring of board-game spaces, fish, a palm with coconuts, a lighthouse; its own dark mode.
- The match: muzzle puffs, streaks, hit bursts and shakes, cancel sparks, miss splashes; health bars whose lost part lingers in yellow and pulses red when low. Level up rays, a waving finish flag.
- The chest: redrawn; shakes, flashes, confetti; cards pop in and float, rarity tags, a rainbow border for a legendary; the card no longer covers the line under CHEST.
- Seen in headless Chrome only. Unsure on a phone: the frame cost (the board and up to 20 moving locker cards), Android has no card glow, the hit burst briefly covers the piece.

## Round 55 (2026-11-24, after he watched the demo): 159 single player, the island

- HIS WORDS: a PvE auto-battler as single player, pace-driven like an idle clicker; the same intro, then straight into single player, no matchmaking; he circles the island, a monster on the centre island; the target fixed at 1:59 for now; a bar always filling while he rows, faster the nearer 1:59, a throw when it is full, NO cooldown; about 3 monsters in a 1K; monster health and damage grow; boats recruited that help (one auto-throws, one makes him throw two). He wants to row it on his 5K today.
- BUILT: arcade/pve.ts (the loop, pure), arcade/Monster.tsx (line-art monsters, every fifth a crowned boss), Battle in screens/Show.tsx, the "battle" phase in arcade/show.ts (intro, then the island until 90%, then level up, finish, the one chest). The pages jump to the show as the island starts.
- NUMBERS (scripts/pve-check.ts): the bar fills in 3 s within 1.5 s of 1:59, falls off by e every 8 s past that, never under a fifth while moving. Damage 10 x 1.1 per kill, times 0.4 to 1 by how near the pace sat while the bar filled. Health 150 x 1.25 per monster, a boss x1.25. Crew: a DECKHAND at 2 KO (throws every 5 s, 40% of his power, whatever the pace), TWIN at 4, a second deckhand at 7, QUICK HANDS at 10, a third at 14. A 1K at 1:59 gets 3, a 2K 8, a 5K 15; at 2:05 a 5K gets 10, at 2:10 five.
- DEMO ROWS NO LONGER MOVE THE RATING; the rating started again at 1200 (kept under arcade/rating/2; the old one, all demo games, is left on the phone).
- THE MATCH (multiplayer) is kept, behind ShowCtx.solo = false.
- Seen in headless Chrome against the sandbox (a 1K demo at 4x: intro, the island, KOs, the chest). NOT on a phone or a real PM5.

## Round 56 (2026-11-24, afternoon): the rest of his notes on the demo

- THE MATCH GETS THE BAR (his words: "the always-filling bar, filling faster near pace, with no cooldown"): arcade/match.ts rewritten. Each piece's bar fills by the island's `nearOf` against the pace it was given (4 s of its meters); full, it throws at once: THROW 10 times 0.4 to 1 by how near the pace sat. Every throw lands (no luck, no cancels). Health 300 on a 5K. Checked (arcade-check.ts): about 1:40 a match; steady 1:59 wins 63% against bots of its level, wobbly 2%, steady 2:30 43%. The failed ready check starts the bar a throw behind.
- WHICH GAME: `arcade/mode.ts`, single player by default; the arcade tab on his own profile has SINGLE PLAYER / AGAINST ROWERS.
- ONE CHEST, AT THE END: the match's celebration has no chest and gives no items (his piece hops there instead); the one chest drops at the end of the row, and now also when a row stops short after the intro.
- THE ROW'S GAME ON ITS PAGE: `arcade/games.ts` keeps the last 30 games on the phone (XP, the XP before, KOs or matches, the items) and binds each to its row id when the monitor logs the row (or the form does). RowPage shows THE ARCADE after the stickers and reels, before the analytics: +XP, the level bar, each item with EQUIP. On the rower's own rows only, where this phone played.
- THE ARCADE TAB: his piece in a round frame, hopping; the level and its bar; CHANGE THE LOOK opens the locker; the mode switch; the rating under it.
- THE LOCKER: the piece and BOX / SHOT / HAT / TRAIL pinned at the top; the one layer's items scroll under it, four across. Gone: "x of 37 found", "Every match of the arcade ends on a chest ...", the rarity legend and the rarity words on cards (the coloured strip on each card says it).
- SMALLER: the show's figures max 36 (was 46), banners 26 (34), titles 44 (56), the board's pieces max 76 (92), the match HUD and pops about a fifth down.
- THE SPLASH VERSION IS A STAMP: `src/build.ts` holds the all-time meters taken when an update is published (`node scripts/stamp-version.mjs` in mobile/, then commit it), with a letter when two ship at the same meters. Shown from the first frame; never live.
- Seen in headless Chrome against the sandbox: a 1K demo (island, KOs, the chest, DONE, the row page's arcade with EQUIP), a 2K demo against rowers (the bar, HIT −10, YOU LOSE with DEMO, NOT RATED), the arcade tab, the locker's BOX tab. NOT on a phone or a real PM5.
- OPEN: the target stays 1:59 (harder over time? his own 5K pace?); a 2:30 rower barely hurts the first monster; more crew kinds; monsters hitting back; the games list is on the phone only (a server table so it follows him is not built).

## Round 57 (2026-11-24, evening): the sign-in page from the splash, the search's lines as Instagram's

- THE SIGN-IN PAGE (his words: "login page should probably have the same preview as our splash screen. You should have like the row app name and the total number of meters rowed. Because right now it's kind of bare ... let's put the buttons closer to the center of the screen, put some header there, do a little graphic"): `Account.tsx` SignIn. The top half is the splash's: ROW at 76 with the O in the blue, every meter logged under it in the splash's zero-padded count with the blue M and METERS ROWED (still, not rolling: the splash has just rolled it; the number is the splash's kept total, then the fresh one, `useAllTimeMeters` in `splash.tsx`), and three lines of water in the blue under that, fading downward, as the little graphic. The masthead stands on the middle of the screen; the buttons start just under it, at most 400 wide and centred, and Developer sign-in and Terms / Privacy policy are centred too. The page scrolls, so the Developer's password field is never under the keyboard. The Developer sign-in works exactly as before (same call, same spinner bar). With no total at all (first launch, no network) the mark and the water stand alone.
- THE SEARCH'S LINES (his words: "the text is a little large ... what I want to copy from this is just the text sizing and placement, and where they have like a bio or who's following them, we can just put their total number of meters rowed"; his reference, Instagram's search results): `Social.tsx` PersonLine with `sub`. A round avatar of 48 on the left; the name in Archivo semibold 15; under it, in grey Archivo 13.5, the rower's number and all-time meters ("001 · 630,000 m"). The meters column at the right is gone (the grey line says it), and so are the rules between lines, as on Instagram. Recent and Most meters both wear it; Most meters keeps the board's bars behind the lines. Followers, following and the other lists keep the old line.
- Seen in a browser at phone width (the total and the people faked on the page: the live API refuses localhost). NOT on a phone; the Apple and Google buttons only draw on a phone.

## Round 58 (2026-11-24, evening): the monitor's titles, the stuck page, the sideways view, the demo's speed, a row stopped part way

- EACH PAGE NAMES ITSELF IN THE BAR (owner: "I want the top of each one of these to show me the title of the screen ... where that live 5000 is, let's show the name of the screen that I'm looking at"). The bar is ← APP at the left, the page's name in the middle (RACE, ARCADE, RACE, UPRIGHT, PACE, RATE · WATTS · HEART, SPLIT CHART, SPLITS, END THE ROW; `TITLE` in RowScreen.tsx), and at the right DEMO, the monitor's name, WAITING before the first stroke, or DISCONNECTED in the red. "Live" and "5,000 m" left the bar (the race and PACE pages say the meters to go). The last page's own "End the row" line went, as the bar says it. The pages are now one list in order (`order`), so the dots, the titles and the page numbers cannot disagree.
- THE PAGE THAT WOULD NOT MOVE (owner: "sometimes like I scroll and the little bar at the bottom changes, but the actual screen doesn't. It just stays on like the fancy screen"). The cause: during the arcade's ready check, a match against rowers and its celebration, the show was laid over whatever page was in view, the whole screen and opaque. A swipe moved the pages and the dots under it; the show stayed on top until the match ended. FIXED: nothing is laid over the pages any more. As the ready check starts the pages go to the ARCADE page, once a match, and a swipe away from it is the rower's own. The strip also takes its page from where it comes to rest, not only from the words on the way.
- SIDEWAYS, TIDIED toward the upright one he likes: the side margins 28 (were 20), the bar a little shorter; the END THE ROW words and buttons, and the buttons that come up when a row stops, in one centred column at most 520 wide instead of the screen's width; the split chart no longer cut at its top and foot; a demo's strip and the page dots share one line, so the race keeps its lane height. MINE, not changed: the race's own sideways layout (the name across the middle of a lane, faded under a boat). It is as the rounds of the race left it; it is drawn name-over-boat only when a lane is 46 points or taller, which on a phone on its side with nothing under the pages is about where it sits.
- THE DEMO AT TWO SPEEDS, AND A SCRUBBER (owner: "can we do like a real-time demo versus sped-up demo row? ... I would like to be able to scrub the demo rows, at least for the real-time one for sure"). On the log screen: "Run a demo row" as before (ten times a clock; the App Store reviewer's path is unchanged) and under it "Or a demo row in real time". Under the pages of any demo: II (hold), 1× and 10×, then the piece as a line with a knob, the meters at its end. A finger down on the line and slid shows where it will land in the blue; the row is there when it lifts, forward or back, on the page that was in view. A landing rows the piece again from its start and straight on to that meter in one go (erg/link.ts `until`, useErg.ts `demoCtl.seek`), so the race, the arcade and the director start over from there; that is why it lands on the lift and not under the moving finger. MINE: the three speeds and the landing on the lift.
- A ROW STOPPED PART WAY, as it stands (his question: "how does progress work when we have to stop in the middle of a row ... we need to be able to still log the meters"). Nothing is lost, and it was already so:
  - The piece is written to the phone every 15 s once it passes 100 m, as the app is left, and as the connection drops (useErg.ts keep).
  - Stopped with the monitor still connected: six seconds still and DISCARD / LOG X M come up under the pages; LOG logs the meters so far at once (or, under 100 m or 8 strokes, opens the form with two photos). Pieces of 500 m or more that nobody logs send themselves once the monitor moves to another piece, or ten minutes after the connection goes, or the next time the app opens (autolog.ts).
  - The connection drops: DISCONNECTED in the bar, the meters stay on the screen, and the same LOG logs them. NEW: RECONNECT AND GO ON under the two buttons. It finds the monitor again and carries on with the piece: the monitor still has its own count, so the recording from there is the row, and the half before it stays on the phone marked as the first part of a longer row (autolog.ts, NEVER TWICE).
  - GAPS, NOT BUILT (for him to decide): (1) after a reconnect the row's recording starts where it picked up, so the analytics and charts lack the strokes before the drop, though the meters and time are whole; (2) a piece stopped part way with the monitor still connected and the app open does not log itself until he presses LOG, the monitor moves on, or the connection goes (the screen stays awake, so the buttons are in view); (3) a piece under 100 m is not kept at all.
- Seen in headless Chrome against the sandbox (admin, 5K demo at 10x), upright and on its side: every title, the arcade page, the strip, a scrub from about 2,000 m back to 652 m staying on its page. NOT on a phone or a real PM5: the reconnect, and a match against rowers going to the arcade page (that code path was read, not watched).

## Round 59 (2026-11-24, evening): the course, from his notes after the island

- HIS NOTES (relayed): one screen pays ("you only get rewards for the stuff that's on your screen ... I don't want to see that I got like Elo when I was playing the PvE game"); monsters fight back ("3 monsters worth of battles with my 1 HP bar, and then maybe the 4th one is a boss ... after I beat this section of the course, my HP gets restored ... if I die, I just restart back to the beginning"); areas sized in meters, an infinite clicker curve, many skins of one enemy then a boss; an end summary ("XP gained, item gained, number of people killed"); weapons are SKILLS that "fill up in 1 second if you're rowing at the pace that you're rowing at", some with a difficulty index (a z), up to three charging at once, rolled, upgradable; coins are the damage done, i.e. the meters, spent on boat upgrades; no hands; two modes to try (the boss course, and a Vampire Survivors swarm).
- BUILT: `arcade/pve.ts` rewritten as THE COURSE. Stages of four (three skins of one kind, then its boss: crabs, gulpers, eels, toads, the tangle). Health in meters: 250 m x 1.12 a monster, a boss x2.2; each kill in a run makes the skills x1.07. The monsters hit the HULL (500) every 3 s, 2.4 a hit (a boss 1.5x), scaled to the rower's own speed. Boss down: hull mended. Hull gone: WRECKED, back to the first monster, coins and XP kept.
- SKILLS: three slots, each rolls one of two: JAB/FLICK (1 s), THROW/SPEAR (3 s), CANNON (8 s)/ANCHOR (10 s). Each fills in its time at the rower's OWN pace (median 5K; 1:59 without one), within 1.5 s; slower falls by e every 7 s (floor 0.15); faster up to 1.3x. FLICK, SPEAR (z 1) and ANCHOR (z 1.5) aim at own - z x spread (the profile's 5K spread; 3 s without one) and hit 1 + 0.5z harder. Shares of a meter's damage: 25 / 35 / 40%.
- COINS = damage dealt (about the meters at the first monster, more as the run grows). `arcade/boat.ts`: coins and three upgrades bought on the arcade tab (THE BOAT): DAMAGE +12%, HULL +15%, QUICK -6% fill; 400/300/500 coins x1.6-1.7 a level.
- ONE SCREEN PAYS: the course adds coins at the end and never touches the rating; the intro shows coins instead of the rating in single player. A match still pays only the rating and XP.
- THE SUMMARY: a "summary" phase after the chest (held 7 s of the wall): XP, monsters down, bosses, furthest stage, coins, wrecks, the item(s). The row page's arcade block adds a line of the same. games.ts keeps coins/bosses/best/wrecks/meters.
- The match keeps the first island's bar numbers (moved into match.ts).
- TUNED (scripts/pve-check.ts): 1K at own pace 3 KO; 5K at own pace 10 KO, two bosses, no wreck; 6 s slower wrecked once; upgrades 5/5/3 take 25 minutes from 14 KO to 22.
- Seen in headless Chrome against the sandbox: a 2K demo at 10x (stage 1's boss, STAGE 2, the hull bar and the three skills, the summary), the arcade tab's upgrades. NOT on a phone or a real PM5.
- NEXT: the swarm (wiki page "swarm"): the boat roams open water steering from a chasing school of fish, speed from the rowing, skills as area attacks, pickups; a director alternating it with the course.

## Round 58b (2026-11-24, evening): the ROWING strip on the bar

- FOLLOW-UP, the same evening: the ROWING strip (the row in progress, shown off the monitor) was drawn at the foot of the page, and the tab bar floats over the foot of the page, so on his phone it sat half under the bar (owner: "This shouldn't be able to happen"). It now rides on the floating bar itself (App.tsx TabBar `above`): a dark rounded strip in the bar's own glass, 8 points over it, moving and tucking with it, on every tab. Seen in headless Chrome at phone width; NOT on a phone.

## Round 60 (2026-11-24, evening): the swarm, and the director between it and the course

- HIS WORDS: "maybe our director can do a round or two of the single boss, and then a round or two of the Vampire Survivors type of game"; the boat roams the water in free X/Y, auto-moving and pathing away from a mob of fish that follows it; skills fire on their own as area attacks; rowing speed sets how fast the boat moves; mobs drop coins or XP the boat paths over; "more things moving around, more things exploding".
- BUILT: `arcade/swarm.ts` (pure). The boat steers itself (away from fish within 30 m, weighted 1/d², toward the nearest pickup, a little wander; turns at most 2.6 rad/s); its speed is 500/pace m/s of the last four seconds. Fish at 0.97 of the rower's own pace's speed (a big slow one at 0.8, a quick one 1.08), 8 health growing 80% a minute (the big one 2.5x), up to 44, spawning 34 m out every 0.9 s down to 0.3 s. Touching (2.2 m) bites 9 hull a second each. The course's three skills, filling the same way, go off as areas: 7 m pulse round the boat, a 9 m blast on the nearest fish within 26 m, a 20 m ring. A fish leaves coins (its health) and 3 XP; drawn in from 14 m, taken at 2.5 m, sunk after 30 s. A round is 120 s of a 5K, cut to the piece (never under 45 s), or until the hull is gone (SUNK).
- THE DIRECTOR (`show.ts`): a "swarm" phase. After a course card (STAGE CLEAR or WRECKED) is held 3.5 s of the wall, a swarm round; its end held 3 s; then the course again where it was (`pve.rest` moves the monster's clock past the round). The finale at 90% and a stopped row settle a round under way. XP and coins of the rounds go in the row's totals; the summary adds FISH; the coins go in with the chest.
- THE SCREEN: Swarm in `screens/Show.tsx`: top-down water with wave marks scrolling under a centred boat, its wake, fish drawn as fish nosing at the boat and flashing when hit, the blasts as rings in the skill's colour, bursts on a kill, coins and blue XP gems bobbing; the round's clock and haul across the top; the hull and skills under (one SkillPanel shared with the course).
- TUNED (scripts/swarm-check.ts): at own pace about 68 fish, 370 coins, 80 XP a round, the hull almost whole; 13 s slower a third of the hull; 26 s slower sunk every time at about 80 s.
- Seen in headless Chrome against the sandbox: a 3K demo at 6x (the course's stage 1, the swarm round, back to stage 2). NOT on a phone or a real PM5. Frame cost on a phone unknown (up to 44 fish and their blasts in one SVG).
## Round 58c (2026-11-24, night): upright everywhere but the live row; 1.4.0

- HIS WORDS, of the feed and the profile drawn on their side: "The profile view is trying to be rendered horizontally when it shouldn't be able to be viewed horizontally." The app had turned with the phone everywhere since the first build (`app.json` orientation "default", for the monitor's sideways view).
- NOW: the app is held upright everywhere, and the phone may turn only while the monitor's live pages are the screen in front (`src/orient.ts`: Monitor says it is drawn, App.tsx says the log screen with a row on it is in front). The form after a row, the feed with a row going under the ROWING strip, every other page: upright. The app starts upright before any code runs (`expo-screen-orientation` plugin, initialOrientation PORTRAIT_UP).
- A NEW BUILD: `expo-screen-orientation` is native, so `app.json` went to 1.4.0 (owner, the same night: "Build any changes you're waiting on and always deploy over the air to my latest version. We shouldn't update the version the reviewer has"). Updates from here go to preview under 1.4.0; the reviewer's 1.3.0 build and the production channel are left alone.

## Round 58 (2026-11-24, evening): the months as dates, and stories that close after the new ones

He said of round 57's search: "much better".

- THE MONTH MENU IS DATES (his words: "If the selection box looks good with just 11/26, 10/26, 09/26, then maybe we just do that"): `Board.tsx` MonthSheet, the menu under the 100K tab's title, lists 11/26, 10/26, 09/26 and nothing else (the month's name and the edition's name are gone), each centred in a box 132 wide. VoiceOver still reads the month's name. No month totals: the box reads well without them.
- STORIES CLOSE AFTER THE LAST NEW ONE (his words: "when I finish all the new stories, go ahead and close out the stories for me"): `Recap.tsx` RecapViewer. Past a rower's last page is the next rower with a page not yet seen when the viewer opened; rowers already seen are skipped; with none left, the viewer closes. Tapping a seen circle still opens it and plays it through, then goes on to any new ones, or closes.
- Typechecked; NOT seen in a browser or on a phone.

## Round 59 (2026-11-24, evening): ABOUT in settings

His words, not able to tell whether his phone had the newest code: "Maybe if I could have the Apple version be in my settings somewhere, right? Like an about type of deal."

- ABOUT at the foot of the settings list, under Sign out (`Settings.tsx` About): VERSION, the store's version and build number ("1.4.0 (n)", from expo-application, which the build already carries through expo-notifications; read in a try, so a build without it shows the version alone); UPDATE, the stamp the splash prints (`STAMP` in `splash.tsx`) and when that update was published, or "in the build" when the phone runs the code it was built with; CHANNEL (preview on his phone). Under them, asked of expo-updates as the list opens: "Up to date.", or in the blue "A newer update is ready: close and reopen ROW, or get it now." with GET THE UPDATE, which fetches it and starts the app again on it. CHECK AGAIN after an answer or a failed check. A development build and the web build say plainly that they do not take updates.
- Typechecked; NOT seen on a phone (settings needs an account, which the local web build cannot sign in to).
## Round 58d (2026-11-24, night): the monitor after his first look at 1.4.0

- THE DEMO'S STRIP GETS OUT OF THE WAY (owner: "I also maybe need that just to disappear, like while it's running, unless I start moving the thing back and forth and maybe it pops back up again"). Three seconds after the last touch the speeds and the line fade to nothing; the page dots stay. They still take a finger where they were: one put down on the line brings them back and scrubs from there, a tap on a hidden speed only brings them back, and a plain tap on the hidden line does not move the row. Held still (II) or under a finger, they stay up. MINE: the three seconds.
- NO "/500" ON THE FIGURES (owner: say "current pace" and "average pace"). CURRENT PACE and AVERAGE PACE on the arcade's figures, the PACE page and the produced page. The split chart keeps its "/500 m" line.
- THE BEST IS A RED LINE IN THE ROWER'S LANE, NOT A BOAT (owner: "instead of being a boat being my personal pace, have it just be a line that's in my lane, a red line that I'm chasing after ... it's too hard to see with the other stuff"). Where the best's bow is, across the middle lane from rope to rope, 3 points thick, in the BEST red; when it shows and the seconds at the lane's end are as before (GhostRace.tsx `pb`). Not seen on screen yet: the sandbox's best is never near the demo's pace.
- LOG BY HAND DOES NOT STICK (owner: "if I click log by hand and then I go back and then I click the plus again, then I'm still on the manual log ... it should come back to the connect your erg screen"). Each press of the plus lets go of a form typed by hand and opens on CONNECT YOUR ERG. A form about a row already on the board (after LOG, or a kept piece) stays, as that row is waiting on its photos.
- FREE ROW OR THE ARCADE, ASKED AS THE MONITOR CONNECTS (owner: "After the rowing machine connects, ask what to do: free row, or play the arcade"). WHAT ARE YOU ROWING? with FREE ROW and PLAY THE ARCADE, and ← APP. The arcade lands on its page and stays there until the first stroke (the monitor naming its distance does not send it back to the race). A free row has no arcade; its produced page, for a set distance, is called SHOW in the bar. Owner only, as the arcade is: anybody else, and the App Store reviewer, goes straight to the monitor as before. Asked again for each new connection, not after a demo scrub.
- He liked being able to get back to the row (the ROWING strip on the bar).
- Seen in headless Chrome against the sandbox: the question, the arcade landing, the new names, the strip fading and coming back under a drag. NOT seen: the red line (see above), the plus resetting the hand form; nothing on a phone.
- THE MENU OPENS UNDER THE TITLE (his words, of the box over the 11/26 in the bar: "This is good, but it's covered a little"): the title is measured on the screen as it is pressed (`App.tsx` openMonths), and the box opens 8 below its foot, centred, the same size; never over it. Without a measure it opens at 112. Typechecked; NOT seen on a phone.
- THE FOOT OF SETTINGS (his words: "we just put it just not a link to my Instagram. We just put for yourself and others as a footer there in the settings tab"): under ABOUT, FOR YOURSELF AND OTHERS, centred, in the splash's small grey mono. Plain text: no link, no handle. Typechecked; NOT seen on a phone.

## Round 61 (2026-11-24, night): his review of the demo row, upright and on its side

- HIS WORDS (relayed from the store-art session; he watched a demo row both ways and will row it tonight): "floor 1, king crab, floor 2", a boss every 5th floor; "the boss having a pace that sets how hard your skills are ... you row this boss at 1:58 instead of 1:59 ... it can go up, it can go down, relatively random within a reasonable range", purchases making it easier; skills as three boxes along the bottom with a PERCENT, rising only at their pace and faster the more you beat it, saying how much faster to row ("I'm never rowing a 1:47 casually"); the boss visibly throwing things; less health-bar shaking, the numbers counting down; your HP as a number; no KO, coin or stray pace counters; the four figures "meters to go, finish, current pace, average pace", no "/500"; coins "just meters rowed during the game for now"; rooms sized in meters (500 to 2,500); the swarm smooth ("the timer jumps 13, 12, 12, 11"), the boat "like a boxer within their jab range", no coin counter; the chest granted on the press, a margin at the sides, "like a Counter-Strike chest ... it kind of scrolls past", a chest bought with coins; the single player / against rowers buttons and the rating hidden ("PvE first and then do PvP"); the 5K chart's hash marks instead of dots; "Rowvember presents the arcade"; what "Lifetime 5K pace" means; on its side the right column the shape of the left, the boss name big over the game, no YOU label, no lopsided borders; the summary on a demo's analytics. "Build as much as you can."
- THE COURSE (`pve.ts`, rewritten): floors, a monster each, every fifth the kind's boss. Each floor rolls a pace: own + 0..4 s, a boss own -1..+2 (EASE adds half a second a level). Skills key off it: JAB +1 s (slower), FLICK/THROW at it, SPEAR/CANNON -1, ANCHOR -2; fill 0 slower than the skill's pace, 1 on it, rising to 2x at 3 s faster; +20% damage a second harder. Rooms 500/600/750 m, the boss 1,500, a fifth more each five floors, times the show's scale; health 0.7 a meter. The hull is a clock: HULL0 lasts the time to row 3,300 m (scaled) at own pace, a boss's rocks 1.2x. Wrecked: floor 1, XP kept. Tuned: a 5K at own pace beats the first boss and is never wrecked; 2 s slower is wrecked; 4 s faster reaches 2 bosses.
- THE DIRECTOR: a swarm round after two floors, a boss or a wreck. COINS are the meters from the intro's end (`show.ts` `coins`), banked with the chest. THE REWARD is rolled the moment the piece is complete or the row stops, whatever card is up, and banked then (`useShow.ts`), and again on the way out if the monitor is left before (DONE, a demo's analytics).
- THE SWARM: steering as a boxer round the jab's 7 m reach (in when the jab is above 60%, out from anything inside 4.4 m, circling while two or more are in reach, the XP when the water is clear); drops are XP only; the skills key off the floor's pace. Tuned: about 105 fish a round at own pace.
- THE SCREEN (`Show.tsx`): the row's clock is a smooth one (carried on by the wall at the row's rate, eased to each word, never back); the swarm's camera eases after the boat. Battle: the floor, its pace and the boss's floor across the top, the monster's name big (red for a boss), its health with number and percent; rocks thrown in a high arc with a trail, a boss's red; damage numbers 20/26/34; no YOU label. Upright: the hull and three boxes (name, pace, percent, ▲ RISING 1.5x or ■ 1.4S FASTER). On its side: the HUD over the board only, the right column (`SkillColumn`) the hull then the three percents in the figures' size; both side columns edged in the hairline. HealthBar no longer shakes; its number counts down.
- THE CHEST (`Chest.tsx`): opens at 1.4 s; the reel from 1.55 s for 3.9 s, 34 tiles drawn at the chest's odds, a quartic ease to the prize (the best item); then the cards at a 20 px margin. CHEST_S 7.6; the show holds it 10 s. A chest for 2,000 coins in the locker and on the arcade tab, granted on the press.
- THE PROFILE: the mode switch and the rating are gone from the arcade tab (every row plays the course; `useShow` sets solo). THE BOAT: DAMAGE 1,500, HULL 1,200, QUICK 2,000, EASE 2,500, each x1.5-1.7 a level, and A CHEST. The 5K chart draws hash marks under the line, as `charts.tsx` does.
- THE WORDS: the intro reads "<EDITION> PRESENTS / THE ARCADE" (his wording; ROWVEMBER is still what `editionWord` says in November, though CLAUDE.md retired the name on 11-20, a call for him), "All-time meters" and "Your pace · median 5K".
- DEVELOPER, THE ARCADE (his words, the same night: "Maybe there's a section for developer in the settings and put that as one of them"): in Settings under the Developer rows, admin only, six buttons each pressed twice: level 1 (`setXp(0)`), the boat (coins and every upgrade), the skills (DAMAGE, QUICK, EASE; the skills are rolled each row), the appearance (stock), all unlocks (the locker emptied), unlock everything. The phone's arcade state only; never a row or the meters. For later, his words: rowing bests ("fastest 5K, 10K, meters") feeding XP and levels.
- THE DEVELOPER SUBMENU (2026-11-24): every developer option on one page, Settings > Developer (`developer`; the password moved to `password`), not loose rows on the list. At its top RESET MY WHOLE CHARACTER (XP, coins, boat, skills, look, unlocks), then one at a time: level, coins (new, `resetCoins`), boat (the HULL only now, `resetHull`), skills, appearance, unlocks, unlock everything; then the Developer account. The arcade's resets show for an admin only, not behind `arcadeFor`, so opening the arcade does not open them.
- AFTER HE PLAYED THE PREVIEW (2026-11-24, late): the arcade is hidden from everybody but him (`src/arcade/gate.ts`, `ARCADE_OPEN = false`, `arcadeFor(me)`: admin is his accounts), every door to it behind that one switch, the wiki left on isAdmin since it holds more than the arcade; the skill percents are a shown value that runs after the charge at 2.6 a second and laps to 100 and 0 when a skill fires (`useShown`, Show.tsx); LV n NAME over the boat on the course and in the swarm (`useTag`); monsters 0.52 of a unit (was 0.42), fish a fifth longer; ZONES in Board.tsx, a new palette every five floors (the isles, the reef, the ice, the embers, the marsh); damage numbers are `DmgPop`, an eight-copy dark outline, a pop from 1.7x, five columns, the newest five only. Open: whether the zones want more than colours (props of their own), and whether he wants five floors or ten a zone.
- AFTER HIS PHONE SCREENSHOTS (the build before this round): the hull bar was laid over the JAB row on the phone (a HealthBar with flex 1 in a fixed column; the web drew it right), so HealthBar has no flex of its own now. The kit is the same every row, JAB, SPEAR, ANCHOR (his names; SPEAR at the floor's pace, ANCHOR a second under); the sideways view no longer says THROW.
- THE MORNING PAGE: the wiki's "While you slept" rewritten for Nov 25 with all of Nov 24 across the sessions and what to try on the phone and the PM5.
- Seen in headless Chrome against the sandbox, upright and on its side, a 3K demo at 6x. NOT on a phone or a real PM5.

## Round 58e (2026-11-25): logging a row reads as writing a post

- ONE CAPTION, NO TITLE (owner, 2026-11-24: make it feel like writing an Instagram post, not filling out a form; "We just do a caption. Yeah."; drop the labels sitting outside the boxes). The form a row ends at (LogForm in RowScreen.tsx) is now: the row in one line at the head (500 m · 1:59 · 1:59.0; for a row typed in, METERS and TIME as two lines of a list with the word inside the line), the two photos (kept, with SWAP and CAMERA under them), then WRITE A CAPTION... with no box and no word over it, then DATE ROWED as one line of a list with the date and › at its right, as Instagram has its rows under the caption. The cards and their labels (Two photos, Date rowed, Title, Description) are gone.
- THE TITLE IS THE SITE'S. A row sent with no title is given "November #12" by the site (lib/row100k defaultRowTitle, logEntry.ts); a row already logged keeps its title (the PATCH leaves a title it is not sent alone). No site change.
- Seen in headless Chrome against the sandbox: the form typed by hand, and a demo row's form after ADD PHOTOS. Not seen on a phone.
