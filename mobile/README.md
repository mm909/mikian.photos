# ROW: the phone app

An Expo (React Native) app. Four tabs, FEED · BOARD · STATS · PROFILE, and LOG A ROW top right: connect a Concept2 PM5 over Bluetooth, watch the row, log it with two photos. The design decisions and what is still to build are in `DESIGN.md`.

## How it is put together

The app holds no numbers of its own. Every screen reads the website, through the same code the site's pages run, so a figure is computed once and a hidden rower is hidden by one rule.

- `App.tsx`: the shell. The top bar, the four tabs, what is opened over them (a rower, the log, the read), and the strip that shows a row in progress.
- `src/api.ts`: one `api()` call and the shapes the routes answer. `src/session.tsx`: who is signed in.
- `src/screens/`: `Feed`, `Board`, `Stats`, `Profile` (yours, or anybody's), `RowScreen` (connect, the live monitor, the two-photo form), `Review` (the read of a piece this phone recorded), `Account` (sign in, join).
- `src/charts.tsx`: the densities, the pace line, the calendars, drawn from curves the server sends.
- `src/erg/`: Bluetooth (`ble.native.ts` on a phone, `ble.ts` in a browser), the simulator, the decoder (`model.ts`), the row in progress held above the screens (`useErg.ts`), and the line to the next 10-second mark (`milestone.ts`).
- `src/upload.ts`: the two photos and the row, sent the way the site's own form sends them.
- `src/pm5/`: a COPY of the site's `src/lib/pm5`. After changing the site's copy, run `npm run sync:pm5`.

On the site (the repo root):

- `src/app/api/row100k/app/`: `session` (sign-in for the app), `me`, `profile`, `board`, `feed`, `erg` (the recording behind a logged row). Stats, logging a row, the photo upload, joining and the month opt-in are the site's existing routes.
- Also under `src/app/api/row100k/app/`: `row` (one row, for its page), `cards` and `card` (a rower's stickers, and one sticker as a PNG), `reel` (a reel overlay as an MP4, or its last frame as a PNG).
- `src/app/row100k/share/serverCard.ts` and `src/app/erg/reel/serverReel.ts`: the site's own card and reel painting run on the server's canvas (`@napi-rs/canvas`), the reel encoded by `h264-mp4-encoder`. Both packages are in the root `package.json`; run `npm install` in the checkout that owns `node_modules` after pulling this.
- Pass 3, also under `src/app/api/row100k/app/`: `people` (search, followers, following, requests, blocked), `follow`, `block`, `report`, `settings` (private, notification switches), `notifications`, `push` (a phone's push token). Who sees whose rows is one file, `src/lib/rowSocial.ts`; what is told to whom is `src/lib/rowNotify.ts`.
- `profileData.ts`, `boardPageData.ts`, `feedData.ts` under `src/app/row100k/`: the computation each page used to do inline, now shared by the page and its route.
- `src/lib/appToken.ts` and the bearer path in `src/lib/permissions.ts`: how a request from the app is known.

## Signing in

The account is the site's Google account.

- The web build served by the site (`/row100k/app/index.html`) uses the site's own sign-in and its cookie.
- The phone signs in with Google itself and trades the ID token for an app token at `/api/row100k/app/session`. The server half exists; the button in the app does not yet. It needs a Google iOS client id (set `GOOGLE_IOS_CLIENT_ID` on the server) and the first phone build.
- In development an existing account can be entered by email on the sign-in screen.

## Try it on a laptop

Three things running, each in its own terminal, from the repo root: a local database, the site, and the app.

1. The database. This folder's `.env.local` points at the LIVE database, and this branch has tables the live one does not have until it is deployed, so the sandbox keeps its own (a real Postgres from npm, whole in `.rowapp-db/`, git-ignored):
   - once: `npm install` inside `.rowapp-db/` (if the folder is missing, make it with a `package.json` that depends on `embedded-postgres`)
   - `node scripts/dev-app-db.mjs` and leave it running (port 5433)
   - once, in another terminal: `node scripts/dev-app-db.mjs --seed` (the schema, 100 sample rowers over three months, and three accounts to sign in as: the owner's email, `sandbox.one@example.com`, `sandbox.two@example.com`)
2. The site, on that database, mail off: `node scripts/dev-app-sandbox.mjs --local -p 3001`. (Without `--local` it reads the sample namespace inside the live database, which works only for code whose tables are already live.)
3. Tell the app where it is: `mobile/.env.local` with `EXPO_PUBLIC_API=http://localhost:3001`.
4. The app: `npx expo start --web --port 8090` in `mobile/`, then http://localhost:8090. Sign in on the PROFILE tab with one of the three emails.

`npm run check:social` and `npm run check:notify` (in `mobile/`, with `B=http://localhost:3001`; the second also needs `IMG=<a picture>`) walk the following, privacy, block, report and notification rules as those three accounts and print PASS or FAIL a line.

DEMO ROW works anywhere. CONNECT works in Chrome on a computer (Web Bluetooth). To read the real board instead, run the site with `npm run dev:live` and do not log rows: that server writes to the live challenge.

Photos cannot be uploaded from the app's own dev port: the storage bucket only accepts the site's addresses. `npm run check:sandbox` (with `B`, `IMG` and `EMAIL` set, see the script) logs a simulated row the way a phone does, photos and recording included. A phone is not a browser and is not affected.

## The web build on the site

```bash
npm run export:web
```

Writes `public/row100k/app/`. It bakes in no server address: the build talks to the host it is served from.

## Shortest path to the stores

Everything builds in Expo's cloud (EAS), so no Mac is needed.

1. Accounts (yours to open): Apple Developer Program ($99 a year), Google Play Console ($25 once), and a free Expo account.
2. `npx eas-cli@latest login`, then `npx eas-cli@latest init` in this folder (links the project).
3. A build for your own phone, to test against a real PM5 (Expo Go cannot do Bluetooth):
   `npx eas-cli@latest build --profile development --platform ios`. Install it from the link EAS prints.
4. Store builds: `npx eas-cli@latest build --profile production --platform all`.
5. Upload: `npx eas-cli@latest submit --platform ios` and `--platform android`.
6. In App Store Connect: screenshots, description, privacy answers, then submit for review. Tell the reviewer DEMO ROW runs the monitor without a rowing machine.

The display name is `ROW` and the bundle id is `com.rowtember.app` (both in `app.json`).

## Not built yet

See `DESIGN.md` for the passes. In short: the Google button on the phone, push notifications arriving on the phone (the server half is built), reports listed on the site's moderation page, and the demo copy of the live database. Nothing here has been run on a phone or against a real PM5 yet.
