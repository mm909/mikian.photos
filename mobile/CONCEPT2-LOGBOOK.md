# Rows from ROW straight into the Concept2 Logbook

**Built 2026-11-26, in development, waiting on a Concept2 test key** (see
"Where it stands" at the end). Owner, 2026-11-26, of a rower logging every M2D row twice
(once on ROW, once typed into log.concept2.com): "is there a way for us to
auto write to the log book?" then "Def do this."

Per CLAUDE.md it starts **in development** (admin-only in production) and
goes live only when the owner says so.

## Can it work? Yes.

Concept2 has a public Logbook API with OAuth2 and an "add a result" call. A
row that ROW recorded off the monitor can be written into the rower's own
Logbook the moment it is saved, with its splits and strokes. Two things are
not in our hands:

1. **Concept2 must approve the app for writing to the live Logbook.** Until
   then it can only write to their test server (log-dev.concept2.com). They
   publish no review criteria and no turnaround: "Once the application is
   ready to go live, please contact ranking@concept2.com for validation."
   Late November is their busiest month (the Holiday Challenge).
2. **Whether an app-posted row counts for the Holiday Challenge.** The rules
   say only "all of your meters must be entered into your Online Logbook".
   Rows typed in by hand on the website count today, and they are unverified
   (`"source": "Web"`, `"verified": false`), so a row posted by an app should
   count the same way. Nothing says so outright. **Ask in the approval
   email.**
**Time is forgiving.** The challenge runs Nov 26 to Dec 24, and the Logbook
takes meters until **Jan 4, 11:59 pm GMT**. A backfill (below) sends every M2D
row a rower already logged on ROW the day they connect. So approval arriving
any time before about Jan 2 still counts every meter. A rower who would rather
not wait can keep typing rows in by hand. The backfill skips any row already
there (see Duplicates).

## What the Concept2 API gives us

From log.concept2.com/developers/documentation, read 2026-11-26.

| | |
|---|---|
| Live base | `https://log.concept2.com` |
| Test base | `https://log-dev.concept2.com` (separate accounts and data, "may occasionally be reset") |
| Authorize | `GET /oauth/authorize?client_id=&scope=&response_type=code&redirect_uri=` |
| Token | `POST /oauth/access_token`, form-encoded: `client_id`, `client_secret`, `grant_type` (`authorization_code` or `refresh_token`), `scope`, `code` / `redirect_uri` or `refresh_token` |
| Scopes | `user:read`, `user:write`, `results:read`, `results:write`. **Comma-separated**, the same string on every call, and none can be added later. A write scope includes its read scope. We ask for `user:read,results:write`. |
| Token life | access token about 7 days (`expires_in: 604800` in their example); refresh token one year, and a new one comes back on every refresh |
| PKCE | not mentioned. The client secret stays on the server, so we do not need it. |
| Add a result | `POST /api/users/me/results`, JSON, `Authorization: Bearer` |
| Bulk add | `POST /api/users/me/results/bulk`: an array, always HTTP 200, one `201` or `409` per item |
| List | `GET /api/users/me/results?from=YYYY-MM-DD&to=YYYY-MM-DD&type=rower` (50 a page, up to 250 with `number=`) |
| Edit / delete | `PATCH` / `DELETE /api/users/me/results/{id}` (delete "cannot be undone") |
| Webhooks | `result-added`, `result-updated`, `result-deleted` for users who authorized us, registered in the developer portal |
| Rate limit | none today; "abuse ... will result in either rate limits or removal of access" |

**The result we send** (all integers. A decimal or a string where an integer
belongs fails the whole workout):

```json
{
  "type": "rower",
  "date": "2026-11-27 07:42:10",
  "timezone": "America/Los_Angeles",
  "distance": 10000,
  "time": 24123,
  "weight_class": "H",
  "workout_type": "JustRow",
  "stroke_rate": 24,
  "stroke_count": 960,
  "drag_factor": 118,
  "calories_total": 610,
  "heart_rate": { "average": 148 },
  "comments": "Logged with ROW",
  "workout": { "splits": [{ "distance": 2000, "time": 4810, "stroke_rate": 24 }] },
  "stroke_data": [{ "t": 21, "d": 98, "p": 1201, "spm": 22, "hr": 120 }],
  "metadata": {}
}
```

- `date` is **the end of the piece**, as the monitor keeps it ("the end of the
  workout, NOT the beginning"), in the rower's local time, with `timezone`.
- `time` and `p` are tenths of a second. `distance` is meters. In
  `stroke_data`, `t` and `d` add up from the start (`d` in decimeters) and
  start again at 0 for each interval.
- `weight_class` is required for a rower: `H` or `L`.
- `verified: true` is only for clients Concept2 trusts. We do not send it.
- Optional headers `X-Client-Version`, `X-PM-Version`, `X-Firmware-Version`,
  `X-Device`, `X-Device-OS` and `X-Erg-Model-Type` can carry what the
  recording knows of the monitor.
- Concept2 refuses a second result with **the same date, time and distance**
  (`409 Duplicate result`).

## How ROW saves a row today

- **Off the monitor** (`mobile/src/autolog.ts` → `POST /api/row100k/app/erg`
  `{ doc, log: {} }`): the phone sends the whole recording
  (`pm5-telemetry/1`, `src/lib/pm5/session.ts`). The site reads the meters,
  the tenths and the day off it (`logOffTheMonitor`), saves the row through
  `saveRow` (`src/app/row100k/logEntry.ts`), and ties the recording to it
  (`RowTelemetry.entryId`). It answers with the row's `entryId`. Asking twice
  is safe: the same recording (same `startedAt`) answers with the same row.
- **Typed in** (`POST /api/row100k/rows`, with two photos): no recording
  behind it.
- **Deleted** (`DELETE /api/row100k/rows/[id]`), and a recording whose row was
  deleted stays deleted (410).

The recording has everything Concept2 asks for. `totals.meters` and
`totals.tenths` are `distance` and `time`. For `date`, use the **monitor's own
log date and time** (`summary.s39.logDate` / `logTime`, the PM5's
end-of-workout stamp, the same one ErgData sends). That way Concept2's exact
duplicate check catches an ErgData copy of the same piece. Fall back to
`startedAt` plus `tenths` only when the summary is missing. The rest map like
this:

| Concept2 field | Comes from |
|---|---|
| `stroke_rate`, `heart_rate.average`, `drag_factor` | the summary (`columnsFrom`) |
| `stroke_count` | `totals.strokes` |
| `calories_total` | `totals.calories` |
| `workout.splits` | `splits` |
| `stroke_data` | `strokes[]`: `elapsedHundredths/10` → `t`, `distanceTenths` → `d` (decimeters), `pace/10` → `p`, `spm`, `hr` |
| `workout_type` | the PM5 workout type (`doc.workout.type`, numbered as `WorkoutType` in `src/lib/pm5/pm5.ts`): 0–1 JustRow, 2–3 FixedDistanceSplits, 4–5 FixedTimeSplits, 6 FixedTimeInterval, 7 FixedDistanceInterval, 8 VariableInterval, 9 VariableIntervalUndefinedRest, 10 FixedCalorie, 11 FixedWattMinute, 12 FixedCalorieInterval |

Check the mapping against their validator (log.concept2.com/developers/validator)
before going live, intervals above all. A document thinned to fit the byte cap
(`notes.thinned`, `notes.headTrimmedFromS`) sends its totals and splits but
**not** `stroke_data`, because Concept2 would plot a partial curve as the whole
row.

**What it lacks:**

- **The rower's time zone.** The phone knows it
  (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and does not send it.
  The app adds `tz` to the erg post and to the connect call. Without it, use
  `America/Los_Angeles`, the zone the boards count days in.
- **Weight class.** The account may have `weightKg`. Use `L` only when it is
  under 75 kg (men) or 61.5 kg (women), and the division says which. Otherwise
  use `H`. Check on the test server whether `GET /api/users/me` returns a weight
  class to use instead.

## The build

### 1. Connect your Concept2 Logbook (the button)

- **The M2D tab** (`mobile/src/screens/M2D.tsx`): the third register step
  ("Get your meters into the Logbook") gets the button
  **Connect your Concept2 Logbook**. Once connected, it reads
  `Connected · <Logbook name>`. The "How do I log a row?" section loses its
  "2. On Concept2 → Add Workout" steps for a connected rower: their rows go
  there by themselves.
- **Settings** (`mobile/src/screens/Settings.tsx`): a line **Concept2 Logbook**
  with Connect / Disconnect and the date of the last row sent.
- **After the row** (`AfterRow.tsx` / the "Logged" line in `RowScreen.tsx`):
  one more word, `Sent to your Concept2 Logbook`, or `Waiting to send to
  Concept2` while it retries.

In development, all three show only to an admin (`me.isAdmin`) until the owner
says it goes live.

**The flow** works without a rebuild: `expo-web-browser` and the `rowtember`
scheme are already in the build, and Google sign-in on the site uses the same
pattern (`signInSite` in `mobile/src/session.tsx`).

1. The app calls `POST /api/row100k/app/concept2/start { tz }` with its bearer
   token. The site makes a signed, ten-minute `state` (the account id and a
   nonce, HMAC with `CONCEPT2_TOKEN_KEY`) and answers with the authorize URL.
2. The app calls `WebBrowser.openAuthSessionAsync(url, "rowtember://concept2")`.
   The rower signs in to Concept2 on Concept2's own page and presses Allow. ROW
   never sees their Concept2 password.
3. Concept2 sends the browser to
   `https://www.rowtember.com/api/row100k/app/concept2/callback?code=&state=`.
   The site checks `state`, swaps the code for tokens with the client secret,
   reads `GET /api/users/me` for the Logbook user id and name, saves the link,
   starts the backfill, and redirects to `rowtember://concept2?ok=1` (or
   `?error=`).
4. The app refreshes `me`, which now carries `concept2: { name, connectedAt }`.

Disconnect (`DELETE /api/row100k/app/concept2`) deletes the stored tokens.
That is the rower's own request about their own link, not a reset. Rows
already in their Logbook stay there. The rower can also revoke ROW from their
Concept2 profile, and the next push then answers 401 and marks the link dead.

### 2. Tokens stay on the server

Two new tables, additive only, so they reach production through the normal
`db-push-prod`:

```prisma
model Concept2Link {
  id           String   @id @default(cuid())
  userId       String   @unique      // the ROW account (Photographer id)
  c2UserId     Int
  c2Name       String   @default("")
  base         String                 // which Concept2 server issued it: a test token never goes to the live one
  accessToken  String                 // AES-256-GCM, key CONCEPT2_TOKEN_KEY
  refreshToken String                 // the same
  expiresAt    DateTime
  timezone     String   @default("America/Los_Angeles")
  status       String   @default("ok") // ok | revoked
  connectedAt  DateTime @default(now())
  lastPushAt   DateTime?
}

model Concept2Push {
  id         String   @id @default(cuid())
  entryId    String   @unique         // one Logbook result per ROW row, ever
  userId     String
  state      String                   // pending | sent | already-there | failed | skipped
  c2ResultId Int?
  error      String   @default("")
  tries      Int      @default(0)
  nextAt     DateTime @default(now())
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

- The tokens are encrypted at rest and never leave the server. The phone holds
  only its ROW token.
- Refresh happens just before a call when `expiresAt` is within a day. Save the
  new refresh token in the same write, because the old one is spent.
- The database backup (`/api/cron/backup-db`) dumps every table, so the tokens
  go to R2 encrypted. Keep `CONCEPT2_TOKEN_KEY` out of the backup and in Vercel
  only.

All the Concept2 talk lives in `src/lib/concept2.ts`: `authorizeUrl`,
`exchange`, `refresh`, `addResult`, `listResults` and `resultFrom(doc, tz,
weightClass)`. The server is set by `CONCEPT2_BASE`, so the same code talks to
the test server first and the live one after approval.

### 3. Push on save

As built: the site is on Next 14, which has no `after()`, so the erg route is
left alone and **the phone asks**. When `autolog.ts` has a row saved, it calls
`POST /api/row100k/app/concept2/sync`, and so does the app as it opens
(`armConcept2`). The sync (`syncUser` in `src/lib/concept2.ts`) gives every
monitor row since M2D began a `Concept2Push`, then sends what is due:

- The phone's answer for the row itself never waits on Concept2.
- Concept2 answers in one of four ways:
  - `201`: `sent` with `c2ResultId`.
  - `409`: `already-there`. Concept2 itself says the same date, time and
    distance is there.
  - `401` after a refresh: the link is `revoked`, and the app says so in
    Settings.
  - `5xx` or no answer: retry with backoff, as `autolog.ts` does (half a
    minute, doubling, at most a quarter hour, then hourly).
- **Retries need no new cron.** The Hobby crons are three a day and spoken
  for. The app already pings the site as it opens and comes to the front, so
  `POST /api/row100k/app/concept2/sync` sends that account's `pending` pushes
  whose `nextAt` has come. A once-a-day pass can ride on the existing
  `m2d-pledges` cron for rowers who stopped opening the app.

**Which rows:** only rows with a recording behind them, rowed with ROW on the
monitor. That is the case the owner asked for, and those are the rows Concept2
can trust. A row typed into ROW was rowed without ROW, often with ErgData,
which already sent it. It is not sent by itself. Its page gets a
**Send to Concept2** button that runs the duplicate check below first.

**The window:** in production, rows on or after Nov 26, 2026, and the window
closes Jan 4 (`src/app/row100k/m2d.ts` already knows the M2D dates). After M2D
the owner decides whether the sync stays on all year. It should: it is just
"your rows go to your Logbook".

**A row deleted on ROW** stays in the Logbook. Deleting there cannot be undone,
and the Logbook is the rower's. The delete sheet says "It stays in your
Concept2 Logbook." **Owner's call:** whether to ask "Delete it from your
Concept2 Logbook too?" instead.

### 4. The backfill from Nov 26

When a rower connects (and again if they reconnect), the site goes through
their ROW rows with a recording from **2026-11-26** to today. For each one with
no `Concept2Push`, it runs the duplicate check, then sends them one by one
(up to 40 a call, inside 40 seconds; the rest go on the next call). The rower sees "Sent 14 rows to your
Concept2 Logbook (3 were already there)."

### 5. No duplicates of what ErgData or a hand entry put there

A rower may have:

- typed a row into log.concept2.com by hand, as the FAQ told them to until now
- rowed with ErgData on another day
- synced the PM5's memory afterwards through ErgData or a USB stick

The same piece must not count twice toward 100K. Three guards:

1. **Before sending**, read the Logbook for that day, the day before and the
   day after (`GET /api/users/me/results?from=&to=&type=rower`, one call per
   backfill, cached for the run). Count a result as the same piece when its
   **distance is equal** and **its time is within 1 s**. Keep it the same piece
   only if **its end (`date_utc`) is within 15 minutes** of ours, or, for a
   result with `source: "Web"` (typed by hand, often with a rounded clock and
   no time of day), if it falls **on the same day**. A match marks the push
   `already-there` with that result's id, and nothing is sent.
2. **Concept2's own check:** same date, time and distance answers 409, and
   that is treated as `already-there` too. With the monitor's own log date and
   time, it should catch an ErgData copy exactly. A hand-typed row rarely
   matches it to the second, which is what guard 1 is for.
3. **Afterwards**, a `result-added` webhook that matches a row we sent (same
   test as guard 1, not from us) means the rower synced the same piece
   another way. We delete **our** copy, the one ROW wrote, so their
   monitor's copy stands. One copy counts, and the one that stays is the
   monitor's own. Nothing they entered themselves is ever touched. This one is
   phase 2: it needs a webhook registered in the portal, and guards 1 and 2
   cover the common cases.

**One piece, one result, from our side:** `Concept2Push.entryId` is unique, a
recording sent twice already answers with the same ROW row, and a push is
never re-sent once `sent`.

### 6. What the rower is told

The M2D FAQ "How do I log a row?" becomes:

1. **On ROW**: connect to the monitor and row.
2. **Connect your Concept2 Logbook once.** Every row goes there by itself.
   Rows typed in by hand on log.concept2.com are found and not sent twice.

The privacy policy and terms (`/row100k/app-privacy`, `/row100k/app-terms`)
get a paragraph: what goes to Concept2 (the row's meters, time, date, splits
and strokes), that it goes only after the rower connects, and how to
disconnect. They are site pages, so this needs the owner's yes, since the site
is frozen.

### 7. Order of work

1. `src/lib/concept2.ts`, the two tables, the routes
   (`app/concept2/{start,callback,sync}`, `DELETE app/concept2`), all wearing
   the development gate (admin-only in production, open locally).
2. The push in `app/erg`, the backfill and guard 1, all against
   **log-dev.concept2.com** with a test account.
3. The app: the button on M2D and in Settings, the "Sent to Concept2" word,
   `tz` on the erg post. All JS, so an OTA update with **no rebuild**.
4. Check intervals and stroke data in their validator. Row a real piece on the
   test server and look at it in the test Logbook.
5. Owner emails Concept2 for approval (below). On yes: live keys, flip
   `CONCEPT2_BASE`, still admin-only.
6. Owner says live: lift the gate, update the FAQ and the policy pages.

About two days of work for steps 1–4.

## What the owner does by hand

Nothing here has been registered, signed in to or sent.

1. **Make a test Logbook account** on https://log-dev.concept2.com (it is a
   separate database from the real Logbook). Then open
   https://log-dev.concept2.com/developers/keys and create an application:
   - Name: **ROW**
   - Redirect URI: **`https://www.rowtember.com/api/row100k/app/concept2/callback`**
     (and `http://localhost:3000/api/row100k/app/concept2/callback` for
     local work, if the form takes two)
   - Scopes: `user:read`, `results:write`

   It gives a **Client ID** and a **Client Secret**. Never send the secret in a
   chat. Paste it straight into Vercel.
2. **Vercel → mikian.photos → Settings → Environment Variables** (Production
   and Preview), and the same in `.env.local`:
   - `CONCEPT2_CLIENT_ID`: the test key's client id
   - `CONCEPT2_CLIENT_SECRET`: the test key's secret
   - `CONCEPT2_BASE` = `https://log-dev.concept2.com`
   - `CONCEPT2_TOKEN_KEY`: any long random string (16 characters or more),
     for example 32 random bytes in base64. Make it with
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
     Never change it once rowers have connected, or their links stop working.
3. **When it works on the test server, email ranking@concept2.com.** Say what
   ROW is (a rowing app that records the PM5 over Bluetooth), that it writes
   the rower's own rows to their Logbook only after they connect, and that it
   checks for duplicates first. Owner, 2026-11-26: "I don't want to tell them
   about any paid features or plans. Need to maximize good will." So the email
   says nothing of a paid tier, a subscription or plans, and asks two things
   only:
   1. Approve live write access.
   2. Do rows posted this way count toward the Holiday Challenge?
4. **On their yes**, create the live key at
   https://log.concept2.com/developers/keys with the same redirect URI, and
   swap `CONCEPT2_CLIENT_ID`, `CONCEPT2_CLIENT_SECRET` and
   `CONCEPT2_BASE=https://log.concept2.com`. Links made against the test
   server are dropped and the rower presses Connect again.
5. **Say when it goes live.**

## Open questions for the owner

- When a rower deletes a row on ROW, should it come out of their Logbook too,
  after asking? (Default: it stays.)
- After M2D, does the sync stay on all year? (Recommended: yes.)
- Should typed rows get the Send to Concept2 button, or should only monitor
  rows be sent? (Recommended: the button, with the duplicate check.)

## Where it stands (2026-11-26)

Built, in development (admin-only in production, open in local dev), and
**waiting on the four keys**. Until all four are set, every route and the
card say "Not set up on ROW yet", and nothing is sent anywhere.

- **The site:**
  - `src/lib/concept2.ts`: OAuth, the tokens sealed with AES-256-GCM, the
    result built from a recording, the duplicate check and the sync.
  - The routes: `api/row100k/app/concept2` (GET for status, DELETE to
    disconnect), `.../start`, `.../callback` and `.../sync`, behind
    `.../gate.ts`.
  - Two new tables, `Concept2Link` and `Concept2Push`. They are additive and
    go through db-push-prod.
- **The app:**
  - `mobile/src/concept2.tsx`: the card, with Connect, Disconnect and Send
    now.
  - The card shows on the M2D tab under joining and in Settings → Concept2
    Logbook, both for an admin only.
  - A sync runs after each row `autolog.ts` saves and as the app opens.
  - It is JS only, so it goes over the air with no rebuild.
- **Not built yet:**
  - the Send to Concept2 button on typed rows
  - the webhook (guard 3)
  - the M2D FAQ's new steps, which wait for live
  - the `Sent to your Concept2 Logbook` word on the after-row page
- **Not tried against Concept2.** With no key, it has never talked to
  Concept2. With the test key in, try these first:
  - Connect, then a backfill.
  - A JustRow piece with strokes.
  - A set distance with splits.
  - An interval piece, which is sent with totals only.
  - A row already typed in by hand, which should read `already there`.
- **The site's privacy policy and terms are left alone**, because the site is
  frozen. Before this goes live they need a paragraph that says:
  - On Connect, the row's meters, time, date, splits, strokes, heart rate and
    drag go to the rower's Concept2 Logbook.
  - ROW keeps a Concept2 sign-in token for that account, encrypted.
  - The token is deleted on Disconnect or when the account is deleted.
  - Rows already sent stay in the Logbook.
- **Account deletion** (`api/row100k/app/account`) deletes the account's
  `Concept2Link` and `Concept2Push` rows with the rest of it.
