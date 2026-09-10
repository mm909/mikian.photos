# Rowtember posters — SPEC

Design synthesis, 2026-09-10. The contract's type half is `types.ts` beside this file; when the two disagree, `types.ts` wins (every stream compiles against it). Streams: DATA (`data.ts`), COMMUNITY (`community.ts`, `charts.ts`), ROWER (`rower.ts`, `rowerCharts.ts`), ENGINE (`formats.ts`, `engine.ts`, `paint.ts`, `pdf.ts`, `../posters/page.tsx`, `../posters/PosterStudio.tsx`, `../r/[num]/poster/page.tsx`, `../dev/posters/page.tsx`, two links in `../BarAccount.tsx`).

The ask (owner, 2026-09-10): "I want to be able to provide posters for rowers and for Rowtember itself. I want to build a pdf or image with a bunch of stats/graphs for Rowtember meant as a summary to hang on a 24x36 poster or 18x24 (if we can build a utility for the most common aspect ratios that would be great). I also want this to be shareable in an insta story and insta post."

## 0. What was decided

Three designs were drawn and judged. The build is the **front-page** design ("the front page as a broadsheet", two of three judges) with these grafts, all of which the judges asked for:

- From the ledger design: the **flow engine** — modules return the height they used, plans stack rows, the footer is pinned to the bottom margin, slack is spent by named elastic parts in a fixed order, overflow is spent by a fixed shrink order and then a plan **cascade** (§8). No dead air above the footer, no holes.
- From the ledger design: `Figure {text} | {shape}` as the **one hidden-value mechanism**; nice-step y-axes; the blackout note printed on the sheet itself; tracking-aware ellipsis; short-form eyebrow descriptors before an ellipsis.
- From the infographic: calendar cells carry the **day number** top-left and the k-label bottom-centre; rest days dashed, future days paper; the **multi-column rower log** (1 → 2 columns → one type step down → "+ N MORE"); the rower Instagram **post is the month made big**; the phone formats each carry one chart or a takeaways ledger so every preset is composed; the ppi table (150 on the wall, 300 in the hand).
- Where the judges disagreed, the site's own rule decided: a masked rower's pace curve is **not built** (ProfileView never builds it for a masked view — a session-indexed variant ships ratios of hidden numbers on paper forever); the pace slot draws the paceTag the DogTag way (§6 R5). A masked rower's **TIME ROWED is dropped**, not blocked (pieces.tsx coreLedger review: with the average split public, even a block clock "would cut the range the total's own blocks are allowed to admit").
- 11x17 and A3 draw in the **hand family** (two columns, larger type relative to the sheet), never in the wall family where they came out at 8-pt eyebrows.

Owner decisions still open are listed in §14 with the default the build takes.

## 1. Principles

1. **The site on paper.** Paper `#F4F3EE` is the only ground; ink type; the headline number and every chart line in matte water `#0077B6`; a few thick black rules; mono datelines and eyebrows; Archivo Black headlines. "Running magazine, not sports app." No shadows (shadowBlur ignores the CTM anyway), no radii, no gradients, no boxes; white appears only as the label on the top calendar bucket and inside the Grizzly wordmark.
2. **Newspaper grammar.** Nameplate → dateline → the lead number → the bracketed strip → columns under one-line eyebrows → the honour roll → the ad corner → the footer. Nothing is parked on the right of a thick rule. The only sanctioned right-hand element is the gray descriptor of a `.pf-eye` eyebrow, on a hairline.
3. **Adaptation is composition, not squeezing.** Same modules, same tokens per family; a shorter sheet spends a shrink order, then drops whole rows by cascading to the next plan. A chart is never stretched; a row with a dropped slot is not drawn with a hole — the plan that has that row is simply not used.
4. **Masking is the share-card rule.** A poster leaves the site. Whatever a blackout hides arrives from the server as a shape and is drawn as ink blocks, for the rower themself and for an admin alike, decided off the PUBLIC board, fail closed. Nothing hidden exists in the client payload as a number.
5. **Read from where it hangs.** One logical unit is a fixed share of the sheet within a family, so a 24x36 is read from six feet, an 18x24 from three, a letter sheet in the hand, a story on a phone — with one type scale per family.

## 2. Formats

Families, logical spaces (`W × H`), pixels, the physical size of one logical unit, margins, plan keys, defaults. All print formats are TRIM size, no bleed, with an engine-level bleed option (§9.6).

| key | label | family | logical | px @150 | px @300 | 1 unit | margin (in) | plan | ppi default / options | stem |
|---|---|---|---|---|---|---|---|---|---|---|
| 24x36 | 24 × 36 in | printL | 1200 × 1800 | 3600 × 5400 | 7200 × 10800 | 0.020 in = 1.44 pt | 1.20 | tall | 150 / 150, 300 | poster-24x36 |
| 18x24 | 18 × 24 in | printL | 1200 × 1600 | 2700 × 3600 | 5400 × 7200 | 0.015 in = 1.08 pt | 0.90 | short | 150 / 150, 300 | poster-18x24 |
| 16x20 | 16 × 20 in | printL | 1200 × 1500 | 2400 × 3000 | 4800 × 6000 | 0.0133 in = 0.96 pt | 0.80 | squat | 150 / 150, 300 | poster-16x20 |
| 11x17 | 11 × 17 in | printS | 720 × 1113 | 1650 × 2550 | 3300 × 5100 | 0.0153 in = 1.10 pt | 0.67 | hand | 150 / 150, 300 | poster-11x17 |
| a3 | A3 | printS | 720 × 1018 | 1754 × 2480 | 3508 × 4961 | 0.0162 in = 1.17 pt | 0.71 | hand | 150 / 150, 300 | poster-a3 |
| letter | Letter | printS | 720 × 932 | 1275 × 1650 | 2550 × 3300 | 0.0118 in = 0.85 pt | 0.52 | hand | 300 / 150, 300 | poster-letter |
| a4 | A4 | printS | 720 × 1018 | 1240 × 1754 | 2480 × 3508 | 0.0115 in = 0.83 pt | 0.51 | hand | 300 / 150, 300 | poster-a4 |
| story | Story 9:16 | phone | 540 × 960 | 1080 × 1920 | — | 2 px (≈ 0.72 pt on a 390-pt phone) | 72 px | story | — | story |
| post | Post 4:5 | phone | 540 × 675 | 1080 × 1350 | — | 2 px | 72 px | post | — | post |
| square | Square 1:1 | phone | 540 × 540 | 1080 × 1080 | — | 2 px | 72 px | square | — | square |

- A3 and A4 are exact millimetres in `formats.ts` (297 × 420 mm = 11.6929 × 16.5354 in; 210 × 297 mm = 8.2677 × 11.6929 in), so the PDF page is exactly 841.89 × 1190.55 pt / 595.28 × 841.89 pt and A3 pixels are 1754 × 2480 @150, 3508 × 4961 @300 (the rounded-inch figures came out one pixel taller). Pixels = round(inches × ppi). `scale = pxW / W` (24x36 @150 = 3.0, @300 = 6.0; letter @300 = 3.54; phone = 2).
- **Margins** (logical): printL 60 all round, gutter 40, three columns of 333.3; printS 44, gutter 28, two columns of 302; phone 36, gutter 24. The **story** folds Instagram's UI bands into its margins: top 125, bottom 135 (250 / 270 px of 1920); the bands stay paper. `formats.ts` notes this as the one number to bump if a real device shows the dateline under the profile chip.
- **Plan keys** are per format and subject-independent (§7): the rower layout registers the same print plan under `tall`, `short` and `squat`.
- **Filenames** (`engine.ts fileName`): `rowtember-2026-<stem>.png|pdf` and `rower-023-<stem>.png|pdf` (number zero-padded to three). A PNG at a ppi other than the format's default appends `-300ppi` / `-150ppi`; bleed appends `-bleed`. Examples: `rowtember-2026-poster-24x36.pdf`, `rowtember-2026-story.png`, `rower-013-poster-18x24-300ppi.png`, `rower-013-poster-a4-bleed.pdf`.

## 3. Type scale

Faces: **Archivo Black** — nameplate, headline number, stat numbers, record values, footer name, ROWTEMBER on the plate. **Space Mono** — datelines, eyebrows, table numbers, ledger, axes, small labels, places, log numbers. **Archivo** 400 / 600 / 700 — names, log titles, best labels, record holders.

Tokens in logical units (`formats.ts` exports one `PosterTokens` per family):

| token | printL | printS | phone | used for |
|---|---|---|---|---|
| W / margin / gutter / cols | 1200 / 60 / 40 / 3 | 720 / 44 / 28 / 2 | 540 / 36 / 24 / 2 | |
| nameCap | 112 | 84 | 60 | nameplate cap (fit to measure); the rower's nameplate cap is 0.8 × this |
| headCap | 150 | 125 | 92 | headline number cap (fit to ≤ 94 % of its measure); masked blocks at 0.8 × |
| datel | 13 | 13 | 11 | mono 700, .16em |
| headLabel | 14 | 13 | 11 | mono, .14em, gray with one bold ink run |
| statN / statL | 46 / 11 | 41 / 11 | 34 / 9 | strip number (black, −.01em, shrink-to-fit per cell, floor 0.7×) / label (mono .14em gray) |
| eye | 12 | 13 | 11 | eyebrow mono 700 .16em; descriptor same size 400 gray .12em |
| row / rowPitch | 14 / 27 | 15 / 30 | 13 / 26 | board, bests, club, log rows; place/number = row × .86 mono gray; names Archivo 700 at row; meters mono 700 at row |
| small | 10 | 12 | 10 | subs, table headers, record meta, axis end labels |
| ledger / ledgerPitch | 13 / 27 | 14 / 29 | 12 / 25 | mono .1em: key ink-soft, value 700 ink, 2-unit dotted gray leader |
| axis | 10 | 11 | 9 | chart tick labels, mono gray |
| recV | 26 | 31 | 26 | record value, Archivo Black water |
| footer | 13 | 13 | 11 | "MIKIAN MUSSER" Archivo Black .1em; the mono lines at footer × .92 gray |
| thick / hair | 4 / 1.5 | 3.6 / 1.4 | 3 / 1.2 | rules |
| gap | 30 | 26 | 22 | between rows and inside stacks |

What the key tokens become on each sheet:

| | 24x36 | 18x24 | 16x20 | 11x17 | A3 | letter | A4 | phone (1080 px) |
|---|---|---|---|---|---|---|---|---|
| nameCap | 161 pt (2.2 in) | 121 pt | 108 pt | 92 pt | 98 pt | 71 pt | 69 pt | 120 px |
| headCap | 216 pt (3.0 in) | 162 pt | 144 pt | 138 pt | 146 pt | 106 pt | 103 pt | 184 px |
| row | 20.2 pt | 15.1 pt | 13.4 pt | 16.5 pt | 17.5 pt | 12.8 pt | 12.4 pt | 26 px |
| eye | 17.3 pt | 13.0 pt | 11.5 pt | 14.3 pt | 15.2 pt | 11.0 pt | 10.8 pt | 22 px |
| small | 14.4 pt | 10.8 pt | 9.6 pt | 13.2 pt | 14.0 pt | 10.2 pt | 9.9 pt | 20 px |
| hair | 0.030 in | 0.023 in | 0.020 in | 0.021 in | 0.023 in | 0.017 in | 0.016 in | 2.4 px |
| thick | 0.080 in | 0.060 in | 0.053 in | 0.055 in | 0.058 in | 0.042 in | 0.041 in | 6 px |

Phone floor: nothing under 18 px (9 units) at 1080 wide; stat labels 18 px, rows 26 px, small 20 px.

Rules of type:
- Tracking: nameplate −.02em, headline −.01em, stat numbers −.01em, eyebrows and datelines .16em, small labels .12–.18em, ledger .10em. Drawn through `ctx.letterSpacing` with the per-glyph fallback (slides.ts `hasLetterSpacing`); measured with the same tracking it is drawn with.
- Position by `metricsOf` / `baselineOf` with the DOM FontBox ratios read off the probes (measured on the site faces: black lh 1.35 / baseline 1.04, mono 1.48 / 1.12, archivo 1.09 / 0.88). The headline number sits by its cap height (baseline = top + 0.74 × size) — it wants no leading.
- Fit-to-measure for the nameplate and the headline (`paint.fitSize`); names ellipsize; numbers never do; `fillText(maxWidth)` is never used (it condenses glyphs — visible on a 24x36).
- Nameplate line box = 0.9 × size; hairline 0.12em under the baseline; dateline datel × 1.5 under the hairline.

## 4. Colours, rules, texture

- paper `#F4F3EE` (painted first, always — the PDF's JPEG has no alpha) · ink `#15171A` · ink-soft `#3b3e42` (datelines, ledger keys, log time) · gray `#8a8a85` (descriptors, places, numbers, axes, meta) · line `#c9c8c0` (dashed row rules, empty calendar cells) · grid `#dddbd2` (chart gridlines) · water `#0077B6` (headline number, record values, curve and pace lines, calendar top bucket, pace tags in a board row) · water-pale `#e3eef5`.
- Calendar ramp `#d9e8f2 → #a5cde3 → #4d9fc9 → #0077B6`; every rowed cell also gets a 1-unit `line` outline so the first bucket survives matte stock; day labels ink, **white only on the top bucket** (theme.ts `.hm-num` rule).
- Curve area `rgba(0,119,182,.08)`; hour bars `rgba(0,119,182,.32)` with the busiest bar solid water (never .16 — it vanishes on matte); split density: ±1 SD band `rgba(0,119,182,.10)`, area `.06`, line ink 1.5 units, median dashed ink.
- Board wash: none by default (the owner may ask for table.board's `rgba(236,220,170,.22)` behind the top-ten rows — it is one fillRect before the rows; keep it in charts.ts as an option, off).
- Medals `#D4AF37` / `#C0C0C0` / `#CD7F32` as FILLED chips with ink text (`.dtag.m1–m3`), never as coloured text; outline chip gray for #4+.
- Grizzly plate `#0c2015`, border 2 units `#06130c`, cream `#f2ead7`, sage `#a9bba6`, gold `#d3ab5d` — the only dark surface on the sheet.
- Rules: thick (strip brackets, ledger top, footer top), hairline ink (nameplate, eyebrows, cell dividers, the elite bracket), 1-unit dashed line `[3,3]` (rows), 2-unit dotted gray (ledger leaders), chart gridlines 1 unit grid `[3,4]` with the top one solid, chart baseline 2.1 units ink, water lines hair × 2.2 with round joins and caps (3.3 units on printL = 0.066 in at 24x36), end dot r = hair × 3.2. Weights are logical, so they scale with the sheet; 300 ppi is the same drawing at 2×.

## 5. Data and masking — the DATA contract

`data.ts` exports `communityPosterData(opts)` and `rowerPosterData(num, opts)` with `opts: { forceBlackout?: boolean }` (the page passes `viewer.preview !== null`; the leak test passes `true`). Both return plain JSON per `types.ts`. Rules:

1. **The public board, always.** `boardView({ viewerParticipantId: null, admin: false, forceBlackout })` (the partners-page idiom) — never `boardData()` (ignores the preview cookie), never `boardDataRaw`. `hidden = maskedIds(boards)`. If the board throws while `blackout.active`, everything fails **closed** (community: standings empty, records masked; rower: `masked = true`).
2. **Standings** = `boards.total` filtered to `meters > 0 || masked`, split by division, first ten each, mapped to `PosterStanding` (`meters` a `Figure`: text `fmtMeters`, or `shape` `shapeOf(fmtMeters(floor))` … the digit count is `digits` so the shape is `"#".repeat` grouped by `partialShape(0, digits, digits)` — i.e. the real comma positions; the run-up `hideLow` rows ship `partialShape(meters, hideLow, digits)`), run through `maskStandings(rows, { active, admin: false })` for idempotency. Order is the public-board order; the module never sorts.
3. **Records** follow `records/defs.ts liteRecords` (owner, 2026-09-08): 5k and 10k (men, women) as `fmtRecordTime` text with holder, day and the split meta — public even for a hidden holder; longest and biggest day as `fmtMeters` text, or `{ shape: shapeOf(fmtMeters(v)) }` when the holder is in `hidden`. `post/page.tsx add()` masks times too and is **not** this surface's rule — the community records and a rower's bests must agree.
4. **Club** = `boards.total.filter(r => r.meters >= GOAL_METERS)` in board order (a masked row's meters is its tier floor, so the filter is safe), names and numbers only; `count = boards.community.finished`; `first = firstToGoal()` reduced to name / number / day — its `total` never ships. Under an open window with an unranked board and no claim row, `first = null` (never guess).
5. **byDay** zero-filled Sep 1 … `asOf.dayNumber` by differencing `boards.daily` of the SAME board read as `totals.meters`, so the curve's last point equals the headline. `totals.seconds = boards.community.seconds`.
6. **Hours** = 24 SESSION counts by Pacific hour of `createdAt` (the stats-page recipe: `createdAt − 7 h`, September rows only, orphans dropped); `null` under 5 sessions. **Split** = `buildField(fieldEntries, { isHidden: hidden.has, meId: null }).field.paceKde` → `{ xs, ys, median, mean, sd }` (`ys` peak 1); `null` when `paceKde` is null.
7. **Takeaways** pre-formatted, in this order: `biggestDay` "SEP 30 · 588K" (kLabel), `busiestHour` "7 AM" (argmax of hours), `medianSplit` "2:07 /500M" (field.pace.median, `fmtClock`), `avgRow` "7,987 M" (field.length.mean), `rowsADay` "56" (sessions / dayNumber), `metersARower` "140,272 M" (meters / rowers), `club` "25 ROWERS · FIRST TESS VALE · SEP 8" ("25 ROWERS" when no claim). Aggregates only.
8. **As-of and dateline.** `dayNumber = daysElapsed()`, `iso = pacificDay(nowMs())`, `day = fmtDay(iso)`, `final = nowMs() >= END_MS`. Community dateline `"SEP 10 · DAY 10 OF 30"` | `"SEP 30 · FINAL"`; rower `"ROWTEMBER 2026 · MEN’S BOARD · 100K CLUB · SEP 10 · DAY 10 OF 30"` (`WOMEN’S BOARD`; division X → no board word; ` · 100K CLUB` only when `club`; the rank never rides here — the phone post module appends it). Before Sep 1 the studio is not offered (the page prints "FIRST STROKE SEP 1" instead of the studio). The site's "LATE LOGS THROUGH OCT 3" wording is a studio caveat, not paper.
9. **Blackout** `{ active, until: fmtPacificDay(endsAt) | null, note }` with `note = "BLACKOUT — THE ELITE ARE HIDDEN UNTIL SEP 27 · TIMES ARE SHOWN"` while active (`"… HIDDEN"` without a date when `endsAt` is unknown).
10. **Rower.** `getRower`-style select (id, rowerNumber, displayName, instagram, division) + entries (day, meters, seconds, title; ordered day asc, createdAt asc; no `photos`, no Dates). `computeBoards([p], entries)` for totals and bests; `pub = boardView(public)`; `masked = blackout.active && maskedIds(pub).has(p.id)` (fail closed); `rank = "ELITE"` when masked or the public row is unranked, else `divisionRank(pub, id)` for M/F, else null; `recordPlacements(pub, id, 10)` for places — time-board places kept while masked, meters-board places null; `totals.meters` `{text: n.toLocaleString("en-US")}` or `{shape: shapeOf(n.toLocaleString("en-US"))}` (no unit); `seconds`, `hours`, `avgSplit`, `metersADay`, `community.share`, `pace`, `month.meters` all **null while masked**; `longest` / `bigDay` shapes while masked; `paceTag = fmtPaceTag(meters, seconds)` always (when timed); log rows: `{text: fmtMeters}` / `{text: fmtDuration}` / `split: fmtSplit` or `{shape: shapeOf(fmtMeters)}` / `{shape: clockShape(seconds)}` / `split: null`. `club = (masked ? floor : meters) >= GOAL_METERS`.
11. **Roster** for the picker = `{ rowerNumber, displayName, division }` only (the `RosterRower` guard).
12. **Partner** is the static `GRIZZLY` block (partners/page.tsx) + `footerLine`; `url` upper-case as printed.

The leak test (§13) serialises both payloads under `forceBlackout: true` and greps them for every hidden rower's real total, longest, biggest day and per-row meters/seconds as digit strings; any hit fails the build.

## 6. Modules

Every module owns its eyebrow, draws inside its box and returns the height it used (`types.ts PosterModule`). Geometry below is what the front-page mocks show (`scratchpad/posters-design-front-page/mock.ts` is the working reference; port its module functions, re-colour where noted). Heights are for the 24x36 at day 30 unless stated; `measure()` must report the same numbers the draw uses.

### Shared (both subjects)

**S1 `masthead` / `nameplate`.** Archivo Black fitted to the measure (`fitSize`, cap `nameCap`; rower cap × 0.8): community "ROWTEMBER 2026"; rower "023 AVERY STONE" with the number in gray and the name in ink, uppercase, one line, never wrapped. Line box 0.9 × size, hairline (hair) at 0.12em under the baseline, then `asOf.dateline` in mono 700 datel .16em ink-soft at datel × 1.5. When `blackout.active` a second dateline line prints `blackout.note` in ink (community always; rower only when `masked`). Height ≈ 0.9 × size + 0.12 × size + hair + 1.5 × datel (+ 1.5 × datel).

**S2 `headline`.** Community: `totals.meters` in water Archivo Black fitted to ≤ 94 % of the measure (cap `headCap`), baseline at top + 0.74 × size; label line at 1.6 × headLabel under the baseline: mono headLabel .14em gray runs with one bold ink run — "METERS · **EVERYONE TOGETHER** · 96 ROWERS · THIRTY DAYS" (`DAY 10 OF 30` → "TEN DAYS"; spelled out through THIRTY). Rower: `totals.meters` figure — text in water, or the shape as ink blocks at 0.8 × the fitted size (`paint.figure`) — and the label "METERS · **8.0 H ON THE ERG** · OF 4,182,400 M BY 96 ROWERS" (`community.share` as " · 3.1 % OF ROWTEMBER" appended when present); masked: "METERS · **THE ELITE** · HIDDEN UNTIL SEP 27 · OF 4,182,400 M BY 96 ROWERS". Phone post (rower): the label carries hours and sessions "METERS · **8.0 H ON THE ERG** · 14 SESSIONS". Height ≈ 0.74 × size + 1.6 × headLabel + headLabel.

**S3 `strip`.** The `.front-stats` idiom: thick rule top and bottom, cells parted by hairlines, each cell statN Archivo Black ink −.01em (shrink-to-fit the cell, floor 0.7 ×) over statL mono .14em gray. Height = 1.15 × statN + 2.6 × statL + 2 × thick. Cells:
- community print: TIME ROWED "953.1 h" · SESSIONS "1,686" · ROWERS "96" · IN THE 100K CLUB "25". Phone: three cells TIME ROWED · ROWERS · 100K CLUB.
- rower printL: SESSIONS · LONGEST ROW "21,097 m" · AVERAGE SPLIT "1:52 /500" (`avgSplit` trimmed to the pace tag + " /500") · RANK · MEN "#1 of 48". Masked: SESSIONS · LONGEST ROW (blocks, label "LONGEST ROW · M") · AVERAGE SPLIT (paceTag) · RANK ("ELITE", label "RANK · NO PLACES WHILE HIDDEN"). Division X or no rank: "—" with label "RANK". Phone story: two cells — SESSIONS (label "SESSIONS · 1:52 /500 AVERAGE") · RANK · MEN.

**S4 eyebrow** (`paint.eyebrow`, used by every module below): bold mono eye .16em uppercase ink left; gray 400 .12em descriptor right, ellipsized with its tracking after trying `rightShort`; hairline under at eye × 0.7; 1.1 × eye of air. The owner's block title — "the stats page spent too much room on titles"; no h2s, no boxes.

**S14 `plate`.** The partner ad box on the Grizzly green: 2-unit `#06130c` border, the bear at its native ratio at twice the wordmark height, the wordmark centred under it (never on paper — it is gold + white). Three layouts by the height the slot gives it: STACK (≥ 190): eyebrow "ROWTEMBER 2026 · PARTNER" sage mono small .2em, marks, "THE CODE" sage, "ROWTEMBER" gold Archivo Black at recV × 1.05, `deal` cream mono small; COMPACT (≥ 110): marks, THE CODE, ROWTEMBER at ledger × 1.7, deal; below 110 the plate is not drawn (the plan drops it). Width = its column. Position on print: the bottom-right column, beside the club roll (community) or at the foot of the side stack (rower); never in the masthead, never on a bar. Phone: no plate — the footer carries `partner.footerLine`.

**S15 `footer`.** Thick rule; "MIKIAN MUSSER" Archivo Black footer .1em; `url` " · @MIKIAN_" in gray mono footer × .92; "for yourself and others" (lowercase) on print; on the phone the third line is `partner.footerLine` instead. Everything left-aligned; nothing on the right. Height ≈ thick + 12 + 3 × footer × 1.5. Pinned to the bottom margin by the engine.

### Community

**C5 `curve`.** Eyebrow "THE CURVE" / "METERS TOGETHER · SEP 1 → SEP 30" (`→ SEP N`). Cumulative meters Sep 1 → as-of day (the frame is the elapsed days). Left gutter 4.2 × axis for y labels; **nice-step** gridlines: step = the first of `pow, pow/2, pow/4, pow/5, pow/10` (pow = 10^floor(log10(max))) giving 4–5 lines, labelled "500K", "1M", "2.5M"; top line solid, others dashed grid; ink baseline; x ticks "SEP 1" then bare numbers per `dayTicks(span)` (≤ 10 days: every day); water area + line, end dot, end label mono 700 small `fmtMeters`. Draws when `dayNumber ≥ 2`, else the eyebrow plus a mono line "THE CURVE STARTS TOMORROW". Height = whatever the plan hands it (min 210 printL / 160 printS / 140 phone; max 320 / 220 / 220). Chart-only height is the box minus the eyebrow.

**C6 `month`.** Eyebrow "THE MONTH" / "METERS PER DAY". Seven columns S M T W T F S (mono axis gray letters), Sep 1 in the Tuesday column (two blanks). Print: the full five-row September grid — future days paper (no outline), rest days a dashed `line` outline, rowed days a ramp cell with the **day number** top-left (mono axis, ink; white on the top bucket) and the kLabel ("312k", "1.2M") bottom-centre in mono 700 at cell × .28. Phone and printS: **elapsed weeks only** (rows through the as-of day). Cell = (w − 6 × gap) / 7 with gap = 0.7 × small; phone story caps the cell at 44, post at 56. Community buckets: **quartiles of the elapsed days' meters** (§14.1 — the site's 25/50/75 %-of-biggest ramp paints a community month solid water). Height = eyebrow + axis row + rows × cell + (rows − 1) × gap.

**C7 `board.men` / `board.women` (and `.5` variants).** Eyebrow "MEN" / "TOP TEN" (`.5`: "TOP FIVE"). Rows on dashed hairlines at rowPitch: place "01"–"10" mono gray row × .86 (01–03 as filled medal chips with ink text, `paint.chip`), rower number gray mono row × .86, name Archivo 700 row ink (ellipsized to the room), meters mono 700 row right (`paint.figure`). A masked row: division letter M/W in gray where the place goes, the pace tag as a `pace` chip after the name, blocks + " m" right; no medal. When every row is masked the eyebrow reads "THE ELITE · MEN" / "HIDDEN UNTIL SEP 27 · BY AVERAGE SPLIT · NO PLACES" (short "BY AVERAGE SPLIT"); when mixed (run-up), the masked rows come first inside a hairline bracket headed "THE ELITE" and the ranked rows continue 01, 02 … below. Phone rows drop the rower number so name + tag + blocks fit. Height = eyebrow + n × rowPitch.

**C8 `records`.** Eyebrow "THE RECORDS" / "THIS SEPTEMBER" (blackout: "TIMES ARE SHOWN, HIDDEN METERS ARE NOT", short "TIMES SHOWN"). Compact list: small gray label (FASTEST 5K, FASTEST 10K, LONGEST ROW, BIGGEST DAY), then one line per holder: division letter gray, value in water Archivo Black recV (a shape → `paint.figure` blocks at recV with " m" at row), holder Archivo 700 row on the same baseline, "· 075 · SEP 4" small gray; dashed hairline between records. Six lines. Height ≈ 4 × (small × 1.8) + 6 × (recV × 1.35) + 3 × 12 + eyebrow — sized to match the boards' ten rows on printL.

**C9 `hours`.** Eyebrow "THE HOURS" / "SESSIONS BY HOUR". 24 bars from 3 AM (HoursSvg's start), slot × .62 wide, water .32 with the busiest bar solid water and its count in mono 700 small ink above it, ink baseline, labels "06 · 12 · 18 · 00" in axis gray. `hours === null` → eyebrow + mono small line "NOT ENOUGH ROWS LOGGED YET". Fixed height 170 printL.

**C10 `field`.** Eyebrow "THE FIELD" / "SPLIT PER 500 M". KDE of every row's split: ±1 SD band, area, ink line, dashed median with "MED 2:07" small ink, "← FASTER" / "SLOWER →" axis gray in the corners, ink baseline, ticks every 20 s labelled "1:40 … 3:20". `split === null` → "NOT ENOUGH TIMED ROWS YET". Fixed height 170 printL.

**C11 `ledger`.** The `.bl` ledger: thick rule on top, KEY ······ VALUE mono ledger .1em (key ink-soft, leader 2-unit dotted gray, value 700 ink), one column (two when the box is ≥ 600 wide), pitch ledgerPitch. Draws `takeaways` in order: six on print; as a `fit: "lines"` slot it draws the lines that fit (minimum 3) or nothing. **`ledger.phone`** is the same drawing with the pick order `biggestDay, medianSplit, club, busiestHour, avgRow, rowsADay`, up to four, minimum two. Height = thick + 10 + n × ledgerPitch.

**C12 `club`.** Eyebrow "THE 100K CLUB" / "25 ROWERS AT 100,000 M OR MORE" (short "25 ROWERS"). First line mono ledger: "FIRST TO 100,000 M · **TESS VALE** · SEP 8" (omitted when `first` is null). Then the roll: number gray mono + name Archivo 700 flowing DOWN as many name columns as the widest name allows in the box width (name column = widest name + number + 3 × small), public-board order. Fit rule: rows at row / rowPitch × .83 (14 / 22.4 printL); if the roll does not fit the height it steps to small / 18.6 and re-fits the columns; a `fit: "cap"` slot then ends with "+ N MORE" in the last cell; a `fit: "all"` slot reports the full height and the plan cascades instead. `measure()` = the height of the full roll at the step that fits the width. Masked: unchanged — names only, never meters.

**C13 leaders** — not built; the square carries `ledger.phone` instead (judges: two bare lines were too thin).

### Rower

**R4 `month`** — the community module with `month.meters` and the site's fixed buckets 2,500 / 5,000 / 10,000 (Heatmap.tsx); eyebrow "THE MONTH" / "METERS PER DAY". Masked (`meters === null`): eyebrow "THE MONTH" / "DAYS ROWED · METERS HIDDEN"; rowed days as ink-outlined cells (hair) with a centred ink dot (r = cell × .12) and the day number; rest days dashed; no ramp, no labels.

**R5 `pace`.** Eyebrow "THE PACE" / "AVERAGE SPLIT · METER BY METER". Running average split per session against cumulative meters (PaceCurve.tsx rules: faster UP; y range rounded to 5 s with ≥ 3 s of air; tick step 15/10/5 s; x ticks 0 · 25 · 50 · 75 · 100 % of max as "32K"), water line hair × 2.2, dots r = hair × 1.5 (the last hair × 3.2), end label mono 700 small "1:52.8 /500M". Fewer than two timed rows → "TWO TIMED ROWS DRAW THE FIRST CURVE". **Masked** (`pace === null`): the same box draws the DogTag idiom on paper — `paceTag` in Archivo Black at recV × 3.4 ink, centred, "AVERAGE SPLIT · PER 500 M" small mono gray under it, "THE ONE FIGURE THAT STAYS PUBLIC · HIDDEN UNTIL SEP 27" small gray under that; no curve of any kind. Fixed height 250 printL, 200 printS (the plan sizes it; the printS hand plan lets it grow to level the body row, max 0.52 × its width).

**R6 `bests`.** Eyebrow "THE BESTS" / "THIS SEPTEMBER". Four rows on dashed hairlines: label Archivo 700 row (Fastest 5k, Fastest 10k, Longest row, Biggest day) with the small gray `sub` under it, value mono 700 row right (`paint.figure`), a place chip before the value (#1–#3 filled medal, #4+ outline gray, none when `place` is null). Row pitch = row + small + 14. Masked: times keep value and chip, meters draw blocks + " m" with no chip. **`bests.compact`** (phone): one line per best — label Archivo 700, chip, value right — at rowPitch, `fit: "lines"` (min 2).

**R7 `ledger`.** The `.bl` ledger with: TIME ROWED "8:02:46" · METERS A DAY "12,840 M" · SHARE OF EVERYTHING "3.1 %" · EVERYONE "4.2M · 96 ROWERS". Masked: SESSIONS · DAYS ROWED · AVERAGE SPLIT (paceTag " /500M") · EVERYONE — no time, no per-day, no share (§0). On the phone story the rower has no ledger (the strip carries sessions/split/rank).

**R8 `log`.** Eyebrow "THE LOG" / "14 SESSIONS · EVERY ROW". A header line DAY · ROW · METERS · TIME · SPLIT in small gray on a hairline, then every row newest first: day gray mono row × .86, title Archivo row (ellipsized first), meters mono 700 row, time mono ink-soft, split mono gray; dashed hairlines. **Columns**: the log lays its rows in as many log-columns as its box holds at ≥ 330 units each on printL (the wide 2-col slot = 706 → two log-columns) and ≥ 300 on printS (the full width 632 → two), balanced (newest in the first column's top). Fit rule: all rows at row / rowPitch → all rows at small / rowPitch × .82 → "+ N MORE" as the last row (`fit: "cap"`). Column widths inside a log-column: DAY 4.6 × small, METERS 6.6 × small, TIME 6.4 × small, SPLIT 5.4 × small, the title takes the rest. Masked: meters blocks + " m", time a block clock, the SPLIT column REMOVED and its width given to the title. Height = eyebrow + header + ceil(n / columns) × pitch.

## 7. Plans

Notation: rows top-down; `[a | b ×2]` = slots and spans; `{a, b, c}` = a stack (top-down, gap between; `grow:x` names the member that absorbs the row's height); `grow N` = elastic row order; `fit` per §types. The footer is pinned. Shrink and cascade per §8.

### Community

**tall** (24x36 first plan) — `masthead · headline · strip · D[curve ×2 | month] grow 1 maxH 320 · E[board.men | board.women | records] · F[hours | field | ledger] · G[club ×2 fit:all | plate] · footer`; shrink `gap, pitch, chart`; next `short`. Vertical budget at day 30 (from the mock): masthead 60–205, headline 235–405, strip 425–535, D 565–835, E 865–1215, F 1245–1415, G 1445–1615, footer 1655–1740. Holds every module up to ~45 club names (the roll's small step is 6 name columns × 7 rows); past that it cascades.

**short** (18x24 first plan; 24x36 fallback) — `masthead · headline · strip · D[curve ×2 | {month, ledger fit:lines}] grow 1 maxH 340 · E[board.men | board.women | records] · G[club ×2 fit:cap | plate] · footer`; shrink `gap, pitch, chart, step, cap`; next `squat`. The ledger draws under the month when the month is short (mid-month: five lines; at FINAL: none — "the ledger is the first module to yield on 3:4"). Hours and field are gone by design.

**squat** (16x20 first plan; 18x24 fallback) — `masthead · headline · strip · D[curve ×3] grow 1 maxH 260 · E[board.men | board.women | records] · G[club ×2 fit:cap | plate] · footer`; shrink `gap, pitch, chart, step, cap`; next `core`.

**core** (printL terminal) — `masthead · headline · strip · D[curve ×3] grow 1 maxH 300 · E[board.men.5 | board.women.5 | ledger fit:lines] · footer`; shrink `gap, pitch, chart`; no next (last resort, §8.6).

**hand** (11x17, A3, letter, A4; two columns) — `masthead · headline · strip · D[curve ×2] grow 1 maxH 220 · E[board.men.5 | board.women.5] · F[ledger ×2 fit:lines] · footer`; drop `ledger`; shrink `gap, pitch, chart`; terminal. Budget: letter fits D + E at the shrink floor with the ledger dropped; A3/A4 fit with the curve grown; 11x17 fits three ledger lines. The hand-out is the front page above the fold.

**story** — `masthead · headline · strip · D[month] grow 1 (cell ≤ 44) · F[ledger.phone fit:lines] · footer`; drop `ledger.phone`; shrink `gap, chart`; terminal. Mid-month (elapsed weeks only) the ledger shows three lines; at FINAL the five-row month may push it out.

**post** — `masthead · headline · strip · D[curve] grow 1 min 140 maxH 220 · F[ledger.phone fit:lines] · footer`; drop `ledger.phone`; shrink `gap, chart`; terminal.

**square** — `masthead · headline · strip · F[ledger.phone fit:lines] · footer`; shrink `gap`; terminal.

### Rower

**tall = short = squat** (one print plan registered under all three keys) — `nameplate · headline · strip · B[{month, bests, ledger, plate} | {pace, log grow:log fit:cap} ×2] grow 1 · footer`; drop `plate`; shrink `gap, pitch, step, cap`; terminal. Two flows, not rows, so a short month never leaves a hole: the side stack stacks down from the row's top, the wide stack gives the log everything under the pace. Log capacity at 15/27 on the 18x24 ≈ 2 × 19 rows, at the small step ≈ 2 × 22; on the 24x36 ≈ 2 × 26 — a FINAL log fits without capping. Masked: the same plan; every module draws its masked variant (§6), so the sheet stays composed.

**hand** — `nameplate · B[{headline, ledger, bests} | {month, pace grow:pace}] · C[log ×2 fit:cap] grow 1 · footer`; shrink `gap, pitch, step, cap`; terminal. The pace grows to level the two stacks (min 160, max 0.52 × its width); the log takes what is left (letter ≈ 2 × 3 rows then "+ N MORE"; 11x17 ≈ 2 × 11). The whole profile is on the hand-out; the log caps.

**story** — `nameplate · headline · strip · D[month] grow 1 (cell ≤ 44) · F[bests.compact fit:lines] · footer`; drop `bests.compact`; shrink `gap, chart`; terminal.

**post** — `nameplate (rank appended to the dateline: " · #3 OF 47") · headline (hours + sessions) · D[month] grow 1 (cell ≤ 56) · F[bests.compact fit:lines] · footer`; drop `bests.compact`; shrink `gap, chart`; terminal. Masked: the month draws DAYS ROWED dots and the bests show times with places, meters as blocks.

**square** — `nameplate (rank in the dateline) · headline · F[bests.compact fit:lines] · footer`; shrink `gap`; terminal.

## 8. The flow engine (`engine.ts compose`)

Deterministic; two agents given the same data and plan draw the same sheet.

1. **Budget.** `y0 = margin.top`; `footerH = footer.measure()`; the stack region is `[y0, H − margin.bottom − footerH − gap]`. Content width = `W − margin.left − margin.right`; column x/width from `cols` and the gutter; a span-2 slot is two columns plus the gutter.
2. **Measure.** For each row, each slot: a module slot measures at its width with an unbounded budget (`measure()` or `minH`); a stack measures as the sum of its members plus gaps. Row height = the tallest slot; `total = Σ rowH + gap × (rows − 1)`.
3. **Drop.** While `total > region` and `plan.drop` has entries: remove the next listed module id from wherever it sits (a stack member, or a slot; an emptied row goes with its gap); re-measure.
4. **Shrink.** While `total > region`, spend `plan.shrink` in order, one step each: `gap` → all gaps × 0.8; `pitch` → board / bests / log pitch × 0.9 (modules read `paint.tk` overridden through a `PosterPaint` clone the engine hands them — `tk.rowPitch`, `tk.gap`); `chart` → curve / pace at their minimum; `step` → club and log at their small type step; `cap` → `fit: "cap"` slots cut to what remains (in reverse row order) and `fit: "lines"` slots to the lines that fit, their rows re-measured.
5. **Cascade.** Still over → `plan.next`, from step 2 with the original tokens. A terminal plan still over → cut `fit` slots to zero, gaps to 0.6 ×, and record `slack < 0` in the log (the dev fixture shows it red; production logs a console.error and draws anyway).
6. **Grow.** `slack = region − total`. Give it to rows with `grow`, ascending, each up to `maxH − rowH` (a stack row hands it to its `grow` member; a `fit: "lines"` slot then draws the lines that now fit); then to the gaps evenly up to 1.5 × gap; what remains is paper above the footer and is reported (`PosterLayoutLog.slack`). On the rower's print plan the body row's `maxH` is unbounded, so the log always closes on the footer.
7. **Draw.** Paint paper; `ctx.scale(scale)`; offset by bleed; rows top-down at their final boxes (`box.h` = the row height; a stack member gets its measured height, the `grow` member the rest); the footer at `H − margin.bottom − footerH`. A module that returns a height larger than its box is a bug: the engine clips to the box and logs it.
8. **Log.** `PosterLayoutLog { plan, rows: [{ id, h, slots }], dropped, shrinks, slack }` returned with the canvas.

Module rules the engine relies on: a module never draws outside its box; a module with a cap or line count returns exactly `box.h` (or less) and never more; `measure()` and `draw()` agree; modules read pitch and gap from `paint.tk` (never a constant) so the shrink steps reach them.

## 9. Rendering (`engine.ts`, `paint.ts`)

1. **Canvas.** One detached `document.createElement("canvas")` at the target's pixels; `fillRect` paper over everything (the PDF's JPEG has no alpha — an unpainted canvas encodes as black); `ctx.save(); ctx.translate(offset); ctx.scale(scale, scale)`; compose + draw in logical units; `ctx.restore()`; `toBlob`; then `canvas.width = canvas.height = 1` to free the store. Only ONE full-res canvas alive at a time; it is never mounted.
2. **Preview.** The same draw at ~1000 px wide (device-pixel-ratio aware, capped at 2×) into a second detached canvas, shown as an `<img>` from its object URL inside the frame. The preview renders immediately on any change; the full-res render follows after a 300 ms debounce and its blobs are kept so SHARE can build its `File` synchronously inside the tap (§10.3).
3. **Allocation probe.** `probeCanvas(w, h)`: create a canvas of that size, `getContext("2d")`, fill `#0077B6` at `(w−2, h−2, 1, 1)`, `getImageData` there must read `[0,119,182,255]`, then `toBlob("image/png")` must be non-null; free it in `finally`; cache per `w×h` for the session. Over-limit canvases fail SILENTLY (no exception; `fillRect` no-ops; `getImageData` zeros) — never trust try/catch alone. Limits measured on this desktop: per side 65,535, area 268,435,456 px; every preset passes here. iOS: a total live-canvas budget ≈ 224 MB — 24x36 @150 (78 MB) fits only as the sole big canvas; @300 (311 MB) does not.
4. **Ladder.** `ladder(format, wanted)`: try `wanted`, then 300 → 200 → 150 → 100 (skipping values ≥ the one that failed); the first pass wins; `fellBack = true` when it is not `wanted`; the studio prints "RENDERED AT N PPI — THIS DEVICE CANNOT MAKE 300" with the rung that actually passed (a refused 300 lands on 200 first, so the note reads "RENDERED AT 200 PPI …") and disables the 300 chip with the same note.
5. **Fonts.** Three laid-out probes `<div class="po-probe blk|mn|arc">Hxg<i class="po-strut"/></div>` (PostPack markup and boxOf, the `.pk-probe` CSS copied under `.po-`), `readFonts()` after `await document.fonts.ready`, then `await document.fonts.load` per hashed family and weight (`400 100px <black>`, `400/700 100px <mono>`, `400/600/700 100px <archivo>`) with the poster glyph set as sample text: `0123456789 ,.:/%#·—…→←‘’ AÁÉÍÓÚÑÖØÜ ÆŒ` plus every name in the payload — the unicode-range subsets load lazily and the metric-override Fallback faces report "loaded" too, so `document.fonts.check` is not proof. Read FontBox ratios from the probes; never hardcode a family; never read them during SSR.
6. **Bleed.** `RenderTarget.bleedIn` (0 or 0.125): pixels grow by `2 × bleedIn × ppi` per axis, the drawing is offset by `bleedIn × ppi`, the extra is paper; the PDF's `MediaBox` is trim + bleed, `TrimBox` the trim. Default off; the studio's BLEED switch is on print formats only, with the note "PRINT BORDERLESS OR TRIM TO SIZE".
7. **Images.** `loadImage` (PostPack idiom, cached, never rejects); the marks are same-origin so no `crossOrigin`; a null asset draws nothing (the plate then draws its text block only).
8. **paint.ts** copies, with attribution comments naming the source function: from `post/slides.ts` — `boxFor, metricsOf, baselineOf, hasLetterSpacing, measure, drawText, drawCentered, drawRight, Run/runsWidth/drawRuns, ellipsize, rule, dottedRule, headlineLines`; from `share/cards.ts` — `drawBlockShape` (with `paint:false`), `blockDigitsWidth`, `kLabel`, `medalColor`, `SEP_FIRST_DOW/DOW_LETTERS`; it imports `drawBlockDigits`, `drawBlockClock` from cards.ts. Every colour re-parameterised for paper; no shadow anywhere. `post/slides.ts`, `share/cards.ts`, `theme.ts` are not edited.

## 10. Files and sharing

1. **PNG** for every format: `canvas.toBlob(cb, "image/png")`.
2. **PDF** for print formats (`pdf.ts jpegToPdf(jpeg: Uint8Array, widthPt, heightPt, opts?: { trimPt?: [x0, y0, x1, y1] }): Blob`): the JPEG is `toBlob(cb, "image/jpeg", 0.92)` of the same canvas → `arrayBuffer` → `Uint8Array`. Byte layout (verified in `scratchpad/poster-pdf-probe.mjs`, opened in Chrome's viewer): header `%PDF-1.4\n` then the raw bytes `25 E2 E3 CF D3 0A` (written as bytes, never through TextEncoder); obj 1 Catalog; obj 2 Pages `/Kids [3 0 R] /Count 1`; obj 3 Page `/MediaBox [0 0 W H]` (points = inches × 72, two decimals, trailing zeros trimmed; `/TrimBox` when bleed) `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R`; obj 4 `/Type /XObject /Subtype /Image /Width pw /Height ph /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length N` + `stream\n` + the JPEG bytes + `\nendstream` (pw/ph read off the SOF marker; the EOL before endstream is not counted); obj 5 content `q\nW 0 0 H x y cm\n/Im0 Do\nQ\n` with its exact byte length; `xref` with `0 6`, the free entry, then one 20-byte entry per object (`oooooooooo 00000 n \n`, offsets of each `N 0 obj` line); `trailer << /Size 6 /Root 1 0 R >>`, `startxref`, the byte offset of `xref`, `%%EOF`. Built as `Uint8Array` chunks with a running byte length (the zip.ts idiom); `new Blob([bytes], { type: "application/pdf" })`. Single page by contract.
3. **Share** (`navigator.share`): the `File` objects are built synchronously inside the tap from blobs that already exist (PostPack 469–471); gate with `typeof navigator.canShare === "function" && navigator.canShare(payload)`; `DOMException AbortError` = dismissed, quiet; anything else falls through to `saveBlob`. SHARE hands over the PNG only (Instagram's sheet takes images; a PDF is DOWNLOAD). Primary button = SHARE when `canShare && matchMedia("(pointer: coarse)").matches` (ShareMenu's `handheld`), else DOWNLOAD PNG. `saveBlob` = object URL, `<a download>`, click, revoke after 10 s.
4. **Sizes to expect**: 24x36 @150 PNG 1–4 MB, @300 5–15 MB, PDF 1–6 MB — under the 50 MB share cap. Full-res encode of 7200 × 10800 takes ~0.8 s here and seconds on a phone: the status line shows RENDERING and the buttons disable meanwhile.
5. No `/api/row100k/share-event` POST for posters (that route validates sticker ids); poster actions are not tracked.

## 11. The studio

**`/row100k/posters` (`posters/page.tsx`, server).** `export const dynamic = "force-dynamic"`; metadata title "The posters — 100K September", robots noindex. Gate: `const viewer = await resolveViewer(); if (!viewer.actor || !viewer.isAdmin) notFound();`. Reads `communityPosterData({ forceBlackout: viewer.preview !== null })`, the roster, and — when `?r=023` is present — `rowerPosterData(23, …)` (404 on an unknown number). Renders the page wrapper (`div.row100k` with the three `.variable` classes, `<style>{css}</style><style>{poCss}</style>`), `<RowBar {...barProps(viewer)} />`, a `sec-head` "The posters" / "ADMIN ONLY — ROWTEMBER OR ONE ROWER · PNG, PDF, INSTAGRAM", `<PosterStudio community={…} rower={…} roster={…} />`, `<RowFooter />`. Before Sep 1 the studio is replaced by the mono line "FIRST STROKE SEP 1".

**`/row100k/r/[num]/poster` (`r/[num]/poster/page.tsx`).** Gate: `isMe || viewer.isAdmin` else `notFound()`. `<PosterStudio rower={…} community={null} roster={null} fixed />` — subject fixed, no picker. Title "Rower 023 · Name — poster".

**`PosterStudio.tsx` (client).**
- **SUBJECT** chips (`.tabs`): ROWTEMBER · A ROWER. Picking A ROWER opens the roster panel (the `RowerSearch` search + panel copied with `fold()/search()/SHOWN` and the `.pf-find-*` markup, `onSelect` → `router.push("/row100k/posters?r=<num>")`); the ROWTEMBER chip pushes `/row100k/posters`. A picked rower shows as the chip label "023 · AVERY STONE ▾". Hidden when `fixed`.
- **FORMAT** chips in two groups with mono eyebrows PRINT (24 × 36 · 18 × 24 · 16 × 20 · 11 × 17 · A3 · LETTER · A4) and INSTAGRAM (STORY · POST · SQUARE). The chosen format is remembered per session (`sessionStorage`, try/catch).
- **Options** (`.st-sub` underline words, print only): `150 PPI · 300 PPI` (300 disabled with the fallback note when the probe refuses) · `BLEED` on/off.
- **Preview**: a `.po-frame` (2px ink border, `aspect-ratio` of the format, max-width 100 % of the column, the story/post frames capped at 60vh) holding the preview `<img>`; a mono status line under it (`.po-status`, water): "RENDERING 3600 × 5400 …" / "READY · 3600 × 5400 · 150 PPI · 2.1 MB PNG · 1.4 MB PDF" / "READY · 1080 × 1920 · 0.6 MB PNG".
- **Buttons** (`.pk-btn` idiom, `.primary` water fill): SHARE · DOWNLOAD PNG · DOWNLOAD PDF (print only); disabled while rendering. Primary per §10.3.
- **Notes** (mono small gray, uppercase): "PRINT BORDERLESS OR TRIM TO SIZE" on print; "RENDERED AT 150 PPI — THIS DEVICE CANNOT MAKE 300" when fell back; "BLACKOUT — THIS POSTER PRINTS WITH BLOCKS UNTIL SEP 27" when the payload masks anything; "LATE LOGS THROUGH OCT 3 — THE POSTER READS FINAL" between END_MS and LOG_CLOSE_MS.
- **Dev** (`dev` prop): the `PosterLayoutLog` under the preview as a mono list (plan, rows and heights, dropped, shrinks, slack — red when negative) and a `<details>` with the payload JSON.
- Page-local CSS in `poCss` (`.po-` prefix; probes, frame, status, notes, the roster panel copies); no double quotes, apostrophes, angle brackets or ampersands in it.

**Account menu (`BarAccount.tsx`, two links only).** Under UTILITIES after "Post pack →": `Posters →` → `/row100k/posters`. Beside "My profile →" for a joined rower: `My poster →` → `/row100k/r/${rowerNumber}/poster`.

## 12. The dev fixture — `/row100k/dev/posters`

`if (process.env.NODE_ENV === "production") notFound();` — no session, visible signed out on :3000. RowBar with the mono child "PREVIEW — NOT REAL DATA". Deterministic fake data (the CardPreviews `sampleData` way), both subjects, chosen by query: `?subject=community|rower` (default community) `&format=<key>` `&masked=1` (blackout open; the rower one of the elite) `&final=1` (day 30, five-row month, 40 club names, a 40-row log) `&names=N` `&log=N` `&runup=1` (hideLow rows). Renders `<PosterStudio dev … />` so the studio itself is what is shot. Fake data must exercise: an eight-digit community total, a 19-character name, an accented name (Sørensen), a rower with no timed rows, a day-1 payload (`dayNumber = 1`), and `hours/split = null`.

## 13. Verification

1. `npx tsc --noEmit -p tsconfig.json` exits 0 after every stream.
2. Screenshots from the dev fixture on :3000 (Browser pane) of **every** format × both subjects × open/masked, plus `final=1` on 24x36, 18x24, letter and story: no clipped text, no hole, no dead band above the footer (log `slack` ≤ 1.5 × gap on print), nothing on the right of a thick rule, every chart inside its column. Letter, A4, 11x17, A3 and 16x20 must be rendered before the studio lists them.
3. Offline renders for pixel checks: bundle a throwaway entry with esbuild (`--bundle --format=iife --global-name=X`) into the scratchpad, an HTML harness loading the three Google faces, shoot with `scratchpad/posters-design-ledger/shoot.mjs` (fixed viewport, CDP timeouts, port argument — the older `fx-shoot.mjs` hung on getLayoutMetrics).
4. PDF: a generated 24x36 PDF opens in the Browser pane; `MediaBox [0 0 1728 2592]`; the image fills the page edge to edge; a re-parse of `startxref`, every xref offset and both `/Length` values matches the bytes (port the probe's `verify()` into a scratchpad script).
5. PNG dimensions equal the table in §2 for every format and ppi; the ladder is exercised by forcing `probeCanvas` to refuse 300 in a dev query (`&noprobe=300`).
6. Leak test: a scratchpad `tsx` script (NODE_PATH = the worktree's node_modules, `tsconfig.render.json`) calls `communityPosterData({ forceBlackout: true })` and `rowerPosterData(<an elite number>, { forceBlackout: true })` against the live DB (read only), takes the hidden rowers' real figures from `boardDataRaw()`, and asserts none of them (total, longest, biggest day, any row's meters or seconds, as `toLocaleString` and bare digit strings) appears in `JSON.stringify` of either payload; also asserts `pace === null`, `seconds === null`, every log `split === null`, `rank === "ELITE"` on the masked rower, and that `standings` carry no number field other than `rowerNumber`.
7. Fonts: on the live page, `readFonts().black` contains `__Archivo_Black` and a 100px `measureText("2,431,900")` width differs from the Fallback face's by > 3 % before the first full-res draw.
8. Share: on a handheld (or the pane's mobile emulation) SHARE is primary and hands a PNG `File`; DOWNLOAD PDF saves a file named per §2.

## 14. Open decisions for the owner (the build takes the default)

1. **Community calendar buckets** — default QUARTILES of the elapsed days (the site's 25/50/75 %-of-biggest ramp paints a FINAL community month solid water). One table swap in `charts.ts`.
2. **Masked rower headline** — default ink blocks at 0.8 × the fitted size (the site's own BigMeters draws blocks in `.bhead-n`). Alternative: the DogTag idiom ("THE ELITE" on an ink plate at headline height, blocks only in the strip and log) — one module swap.
3. **Club roll past ~45 names on the 24x36** — default: the plan cascades to `short` (hours, field and the ledger yield) and the roll takes the room; past ~70 it caps with "+ N MORE".
4. **Bleed** — default off (trim size, "PRINT BORDERLESS OR TRIM TO SIZE"); the switch exists from the first build.
5. **Records under a window** — times public (the brief and liteRecords). The post pack still masks times; aligning it is outside these streams.
6. **Story safe bands** — 125 / 135 logical; check on a real device.
7. **Board wash** — off by default (the cream `table.board` wash behind the top-ten rows is a one-line option in `charts.ts`).
8. **Lines before gaps** (Integrate) — §8's order is "lines yield first, then drop, then shrink", so the rower square at day 12 shows THREE of the four bests over 19 units of paper: the fourth line would fit if the `gap` step (13 units) ran before the lines yielded (7 units short). Swapping the two in `engine.ts composePlan` is one move of the `yieldLines()` call; both drawing streams tested against the current order.
9. **Masked story mid-month** (Integrate) — the rower story's shrink order is `gap, cap, chart` (the rower stream's call, so a FINAL month keeps 43-unit cells); under a window mid-month the nameplate's two blackout lines push the two public time bests off and the DAYS ROWED month sits over ~70 units of paper (its cells are width-capped). `gap, chart, cap` would keep the two bests lines there at the cost of a smaller FINAL month (35-unit cells). One array in `rower.ts story.shrink`.

## 15. As built (Integrate, 2026-09-10) — where the build differs from §6–§9 above

The streams read the sections above; the sheet the studio draws is the code. Where a module or a plan settled on something else, this is the list, so the SPEC is not read as truth against `community.ts` / `rower.ts` / `engine.ts`:

- **§6 S1** — the community masthead prints the blackout note on PRINT formats only: no community phone sheet draws a block, and the note's line was the two ledger lines the square has room for. The rower nameplate prints it on every format when `masked`.
- **§6 C5** — the phone curve's minimum is 115 (not 140) so the post keeps two takeaway lines under the curve. Under the engine's `chart` step the curve and the pace are measured AGAIN on the paint clone carrying `tk.chart = true` and held at no less than `minH` (the community curve's measure is its family minimum 210 / 160 / 115, so the step is a no-op for it on the wall; the rower month reads `tk.chart` and measures at 0.68 × its cell cap).
- **§6 C6 / §7 short** — the September calendar is registered twice in `community.ts`: `month.full` (the five-row grid, future days paper) is the TALL plan's month — a 24x36 shows the whole month from six feet; `month` (elapsed weeks only) is the short plan's, the hand-outs' and the phone's. The ledger under the month on the short plan is `ledger.side`: it measures 0 once the month has five rows (from Sep 27) so it yields before the club roll caps. `charts.ts drawMonth` (community, quartile buckets) and `rowerCharts.ts drawMonth` (rower, fixed 2.5k / 5k / 10k, DAYS ROWED masked form) are two drawings of one grid; folding one into the other is a later pass.
- **§7 community tall** — shrink order `gap, pitch, chart, step` (the club roll's small step is in it, so a roll of forty with one 19-character name keeps hours, field and the ledger on the wall); past that the plan cascades to `short` and the roll takes the room (§14.3).
- **§7 community story / post / square** — no drop list: the engine spends drops BEFORE shrink steps, and a ledger dropped whole leaves a hole where the `cap` step keeps two lines of it. Story and post shrink `gap, chart, cap`; the square `gap, cap`. The story's month is a `fit: "cap"` slot so a FINAL five-row month shrinks its cells rather than push the footer.
- **§7 rower story / post / square** — the same reasoning: no drop; story and post shrink `gap, cap, chart` (the bests to the lines that fit, two at least; then the month to its small cell — only a FINAL five-row month needs it); the square `gap, cap` (a masked nameplate is three lines). Mid-month that is the month at its cap over two or three bests; at FINAL the month alone; the post from week 2 is the month alone.
- **§6 S14 rower plate** — measures its STACK form on the 24x36 only (plan `tall`) and its COMPACT form on `short` / `squat`, because with the full five-row month the 18x24 side column is 7 units short of month + bests + ledger + a stacked plate. The 16x20 still drops it.
- **§6 R8 log** — the progression is §0's graft: 1 column → as many columns as the box holds (≥ 330 printL / ≥ 300 printS) → small step → "+ N MORE"; `measure()` reports the multi-column height so a FINAL 40-row log never forces the plate off. On the hand-outs' row step the column shares leave no title room, so titles and the ROW header are dropped there and return at the small step.
- **§8 engine** — a "lines yield first" pass trims `fit: "lines"` slots to their MINIMUM before the drop list and every shrink step (never to nothing there — the `gap` step alone finds the two lines a square or a post is a few units short of; the `cap` step and the terminal last resort are where a lines slot goes to nothing); the total is re-read from the live rows after every cut, so a row that yielded to nothing takes no gap and its room reaches the grow rows; the `gap` step shrinks the gap above the pinned footer too (the region follows `tk.gap`); every fit test carries a 1e-6 epsilon so a cut that lands exactly on the region does not spend a shrink step.
- **§9.4** — the ladder is 300 → 200 → 150 → 100, so a device that refuses 7200 × 10800 gets 4800 × 7200 at 200 ppi and the note names that rung.
- **§5 data** — `totals.hours` is null for a rower with no timed row (the headline prints "N SESSIONS" in its place); ROWERS = rowers with a logged meter, not sign-ups; the payload clamps to "SEP 30 · FINAL" from END_MS; under the admin's test blackout with no real window the note has no date.
