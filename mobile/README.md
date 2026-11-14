# Row: the phone app

An Expo (React Native) app: connect a Concept2 PM5 over Bluetooth, watch the row, bank it, read it back.

- `App.tsx`: four tabs (Today, Row, Board, Log) and the read over them.
- `src/erg/`: Bluetooth (`ble.native.ts` on a phone, `ble.ts` in a browser), the demo simulator, the live model and recorder.
- `src/pm5/`: a COPY of the site's `src/lib/pm5` (parsers, simulator, saved-row format, analysis). After changing the site's copy, run `npm run sync:pm5`.
- `src/screens/Review.tsx`: the read, from the same `analyseSession` the website runs.

## Try it

```bash
npm run web
```

Opens in a browser. DEMO ROW works anywhere; CONNECT works in Chrome on a computer (Web Bluetooth).

## Shortest path to the stores

Everything builds in Expo's cloud (EAS), so no Mac is needed.

1. Accounts (yours to open): Apple Developer Program ($99 a year), Google Play Console ($25 once), and a free Expo account.
2. `npx eas-cli@latest login`, then `npx eas-cli@latest init` in this folder (links the project).
3. A build for your own phone, to test against a real PM5 (Expo Go cannot do Bluetooth):
   `npx eas-cli@latest build --profile development --platform ios` (or `android`). Install it from the link EAS prints.
4. Store builds: `npx eas-cli@latest build --profile production --platform all`.
5. Upload: `npx eas-cli@latest submit --platform ios` and `--platform android`.
6. In App Store Connect and Play Console: screenshots, description, privacy answers (the app collects nothing today: rows stay on the phone), then submit for review. Tell the reviewer DEMO ROW runs the app without a rowing machine.

The bundle id is `com.rowtember.app` and the display name is `Rowtember` (both in `app.json`); change them before the first store build if the name is to be Row.

## Not built yet

- Sign-in and the real Rowtember board (the Board tab is a demo crew, and says so).
- Sending a banked row to rowtember.com.
- Nothing here has been run on a phone or against a real PM5 yet.
