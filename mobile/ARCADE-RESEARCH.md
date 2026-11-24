# ROW Arcade: research notes

Research only, 2026-11-24. No code changed. [n] = sources at the end. "Inference" marks my own reasoning, not a source.

---

## A. Prior art

| Product | Games and control | What reviewers say |
|---|---|---|
| **Concept2 PM5, built in** | **Fish Game**: your fish moves up and down the left edge with "stroke intensity", eating small and striped fish (30/60 pts) and dodging predators (-45). 4 min. **Darts**: 300 darts, rings 50/25/10/5, pace set by your first five strokes. **Target Training**: hold a steady pace and rate to hit bull's-eyes, with the target set from your first five strokes (or entered by hand); scored as % of the best possible. **Biathlon**: intervals plus a shooting stage, where a miss adds penalty distance (often 150 m) [1][2]. | The reference set. Every game **calibrates from the player's own first strokes**. |
| **Ergatta** | Pulse (speed, cadence or hybrid targets), Meteor (interval high-score), Echo (match passing targets' tempo), Wavelength (fly a 3D world, hit targets, dodge obstacles), Endeavor (strokes power a creature), races against peers, your past rows or a "Rowbot" pacer, and Vortex multiplayer with "Calibrated Competition". Mostly **hold a band**; the avatar shows if you're on target and collects tokens [3]. | "Immensely engaging (and in some cases addictive)" [4]. Complaints: tutorials you can't skip [5], and the games sit behind the subscription [6]. |
| **Aviron** (its own rowers, plus an iOS app for the PM5) | Rags to Riches and Snow Tomorrow: **each completed stroke fires a shot**, watts set the damage, and SPM targets unlock power-ups. Blaze Breakers: each building floor is an SPM range, and watts set how fast fires go out. About 14 games [7][8]. | Rated Best Gamified Rower [8]. Little explanation of the games, and a flaky Bluetooth link on a Concept2 [9]. |
| **Peloton Lanebreak** (Bike; also on Peloton's Row pages [10]) | A rhythm game with 5-6 lanes. **Resistance picks the lane**. Beats: be in the right lane. Streams: hold cadence in a ~20-rpm band. Breakers: spin up to fill a meter, with "Overcharge" at 200%. Four difficulty levels just raise each lane's resistance [11]. | Good as a warm-up or finisher [12]. "Exhausted, and not in a good way" [13]. No head-to-head, a track that never changes, no PRs [11]. |
| **EXR / Holofit / Kinomap** | Virtual worlds (EXR's Henley and the Charles; Holofit in VR) or speed-synced video (Kinomap), with races or multiplayer. Speed is the only control [14][17][19]. | "Keeps long rowing workouts interesting" [16]. The avatar falls out of sync with your strokes [15], and video doesn't follow rower speed [19]. |
| **ErgData / ErgZone** | Not games, but they show the force-curve numbers: peak, peak position %, drive length, work, avg/peak ratio. ErgZone keeps them in its paid tier [20][21]. | Shows what the PM5 already exposes. |
| **Hydrow, Peloton Row, iFit** | Instructor-led classes; iFit sets resistance to match the trainer [22]. | Engagement comes from the coach, not from play. |
| **`ergarcade` (GitHub)** | pm5-base, a recorder and playback, a fluid sim "driven by Concept2 PM5s" [23]. | Toys, not a game catalogue. |

**Patterns:**
1. **Two control families: hold a band** (Target, Pulse, Lanebreak Streams, Blaze Breakers) and **each stroke is an action** (Aviron's shots, PM5 Darts). Continuous steering by pace is rare; the Fish Game is the old exception.
2. **Calibrate from the player** (the PM5's first five strokes; Ergatta's targets "dynamically adapted to you").
3. **What gets boring:** a static scene, the same scoring at every level, nothing to beat [11]. **What exhausts:** too many all-out prompts [13].

---

## B. Latency and what feels responsive

**What the PM5 sends** (Concept2 BLE spec rev 1.30, already coded in `mobile/src/pm5/pm5.ts`):
- Status characteristics (pace, meters, rate, watts, **stroke state**) at 1 s, 500 ms (the default), 250 ms or 100 ms, set by writing 0x0034.
- The stroke state runs `DRIVING → DWELLING_AFTER_DRIVE → RECOVERY`, so **the catch and finish are visible within about 0.1-0.25 s**.
- Stroke data (drive length and time, recovery time, peak and average force, work, distance per stroke) arrives **once per stroke**.
- The force curve arrives after the drive, in chunks of up to 9 points (not on PM5v1).
- Bandwidth is about 640 B/s on iOS and 1,000 B/s on Android [24], so don't stream everything at 100 ms plus curves. Use the multiplexed 0x0080 characteristic or 250 ms.

**Pace is a per-stroke figure** ("calculated each stroke" [25]): a new value about every 2.1 s at 28 spm. Inference from the flywheel physics: a change in effort takes 1-3 strokes to show fully, so effort to visible pace is **about 2-5 s**. That is mushy for steering. Meters lag the same way, but they only go forward, so they can be animated smoothly between samples.

**Design rules (inference, matching the patterns above):**
- **Strokes are the buttons.** The drive is the action and that stroke's watts, force or distance is its strength, as Aviron does. It is the lowest-latency input there is.
- **Pace is a dial, not a joystick.** Use it for slow state (depth, gap, lane) and show obstacles 3-4 strokes ahead.
- **Score bands, not points.** Use windows wide enough that one noisy stroke doesn't matter (Lanebreak's Streams are about 20 rpm [11]).
- **Smooth the picture, not the score.** Animate between samples, but score the raw per-stroke values so results stay deterministic.
- **Rate is the quickest whole-body input.** It changes every stroke under direct control, and you can change it without changing pace: rate works as the steering, pace as the throttle.
- **Move the boat on the PM5's stroke state**, not on a guess from pace. EXR's out-of-sync avatar is the warning [15].

---

## C. The force curve as an input

ErgData already computes peak force, **relative peak position (%)**, drive length and time, work, and **the average/peak ratio**. Its quality rules are a smooth curve ("a bump suggests force is applied in a disjointed way") and the same curve stroke after stroke [20]. The legs make the peak, which is what gives the curve its bell shape [26]. Coaching sources put the ideal peak at about 50% of the drive, and crew boats at 46-47% [27]. Research classifies rowers by curve shape using functional data analysis [28], curves barely change year to year [29], and biomechanists separate "single" from "double peak" patterns [30]. **No standard "double-hump score" exists.**

**Inputs robust enough for a game**, each computed once per stroke:
- **Peak position** = peak index ÷ point count (early, centre or late).
- **Fullness** = average/peak (square or spiky).
- **Hump count**: local maxima after 3-point smoothing, keeping only humps above 10% of the peak.
- **Match**: correlation with the previous stroke, or with the player's own average curve, both resampled to 32 points.
- **Drive length** and **peak force relative to the player's own median**, never in absolute newtons.

Use them for once-per-stroke choices (spells, abilities), with thresholds calibrated over the first 10 strokes. Gate them on PM5v2+, with a fallback when no curve arrives.

---

## D. Ghosts and asynchronous multiplayer

- **Mario Kart**: recorded runs on the same track; staff ghosts set the baseline and expert ghosts unlock after them; ghosts can be traded [31].
- **Trackmania**: every opponent is an intangible ghost, you chase the leader's, and ghosts teach [32][33].
- **Zwift HoloReplay**: your 90-day PR raced on a segment [34], after years of players asking for PB bots [35].
- **Peloton**: the "All Time" board ranks everyone who ever took the class, and "Here Now" was tidied up for "a live-class feel" [36].
- **Rubber-banding** keeps races tense but feels like cheating when noticed [37].

**Making ROW's replays feel alive:**
1. **Animate their strokes.** Drive the ghost's oars from its own recorded catch and finish timing; a ghost rating 31 beside your 26 reads as a person.
2. **Say who, when and what**: name, date, usual pace, "PR day" or "easy day".
3. **Match closely.** Pick a ghost with a home pace within ±3% of yours, or one who just beat you. Never rubber-band; a fixed handicap is fine if it is stated.
4. **"Open" games.** If the game's state is a deterministic function of (stroke events, per-stroke watts and distance, rate, pace relative to home pace, seed), **any stored row can be run through it**, so a person who never played still yields a fair ghost score. Games that cue the player ("speed up now") cannot be replayed from ordinary rows; their ghosts must be past plays of the game. Tag each game **open** or **cued**.
5. **End with a social beat**: a "they surged here" marker, the gap in seconds and meters, a one-line result card.

---

## E. Exergame design for 1-4 minute bouts

- **Home pace P₀** = the median pace of the last 5-10 rows of 2K or more (the PM5's "first five strokes" idea, using history). Make every target relative to P₀.
- **Use percent, not raw seconds.** Watts = 2.80 / (pace/500)³. A second at 1:59 is about 2.5% of watts (208→203 W); a second at 2:30 is about 2.0% (104→102 W). The owner's "2:30→2:31 = 1:59→2:00" is near, not exact. Define bands as a % of P₀ (±1% ≈ ±1.2 s at 1:59, ±1.5 s at 2:30) and show them in seconds.
- **Fairness.** Effort-based adaptation can lower less-skilled players' self-efficacy, feel unfair to skilled ones, and "overbalance" less fit players, whose heart rate rises sooner [38]. **Keep two boards**: raw (time or meters) and arcade (normalised), clearly labelled. HR-zone adaptation held people in their zones without raising enjoyment [39], so **use HR as a safety cap, not a difficulty knob.**
- **Injury.** The lower back is the commonest site, and novices on ergs bend at the lumbar spine instead of hinging at the hips [40]. Don't "suddenly pull as hard as possible ... in a stroke or two", and never start an interval at maximal effort [40][41]. Fatigue moves the work into the back [40].
  - **Arcade rules:**
    - A scored game unlocks after 500 m or 2 minutes of easy rowing.
    - No cue faster than P₀ −5% lasts more than 20 s.
    - Every surge ramps over 3 or more strokes.
    - "Go slower" cues are as common as "go faster".
    - Force bonuses are capped at 115% of the player's median peak.
    - Stop asking for more above about 90% of max HR when a strap is on.
- **Bout shape.** 1-4 minutes is the HIIT range exergames are studied in [42]. A set of 2-3 games makes about 10 minutes, and the player should want "one more".

---

## F. Mini-game concepts

The joysticks: **P** absolute pace, **ΔP** change in pace, **R** rate, **C** consistency, **F** force curve, **S** stroke event, and **D** distance per stroke (new). **Open** = any library row can be its ghost.

1. **The Wake.**
   - **Length:** 250 m, 500 m or 1K, or a whole row in planner mode.
   - **Joysticks:** P.
   - **Loop:** A red boat holds the required pace in your lane, and the gap reads in meters and seconds. If it catches you, the stern goes red and the water fogs. Planner mode sets the boat from the month's goal (200,000 m at 2:00 → a 2:00 boat).
   - **Scaling:** The arcade boat holds P₀ −1%, −2% or −3%.
   - **Ghost:** The red boat can be any library row, its oars driven by that row's strokes. *Open.*
2. **Undertow.**
   - **Length:** 500 m.
   - **Joysticks:** S, P.
   - **Loop:** You are a diver in a sinking current. Each drive kicks you up by that stroke's watts relative to P₀'s watts, and you sink between kicks. Air pockets and coral are telegraphed 3-4 strokes ahead.
   - **Scaling:** Neutral buoyancy is P₀, so everyone floats at their own normal.
   - **Ghost:** A translucent diver on their watts relative to their P₀, in the same seeded cave. *Open.*
3. **Stone Skip.**
   - **Length:** 250 m (about 1 min).
   - **Joysticks:** D, S.
   - **Loop:** Each stroke skips a stone, as far as that stroke's distance per stroke relative to your average. Below 90% of your average it sinks, and you throw again. Score = the longest chain plus total skips.
   - **Scaling:** Against your own average distance per stroke.
   - **Ghost:** Their stones skip on the same lake. *Open.*
4. **Plank Walk.**
   - **Length:** 500 m.
   - **Joysticks:** R, S.
   - **Loop:** Planks over a gorge appear on a beat that drifts 20 → 24 → 28 → 24 spm. Each catch must land in that plank's window (±150 ms, widening after misses).
   - **Scaling:** The beats centre on your usual rate.
   - **Ghost:** Their catches walk the same fixed beat. *Open.*
5. **Kite Line.**
   - **Length:** 1K.
   - **Joysticks:** C, P.
   - **Loop:** The kite flies while the 5-stroke pace stays in a band around P₀. The band narrows from ±3% to ±1%, and gusts shift it by 1%. Score = seconds aloft.
   - **Scaling:** The band is a % of P₀.
   - **Ghost:** Their kite flies on the same wind. *Open.*
6. **Signal Lights.**
   - **Length:** 500 m.
   - **Joysticks:** ΔP.
   - **Loop:** Lights cue +2%, −2% or hold. You score for reaching the new pace within 3 strokes, holding it, and not overshooting. This is the owner's "go faster / go slower" stick as a game.
   - **Scaling:** Cues are relative to your current pace, never all-out.
   - **Ghost:** *Cued*, so ghosts are past plays only.
7. **Rune Pull.**
   - **Length:** 500 m.
   - **Joysticks:** F, S.
   - **Loop:** Each stroke's curve casts a spell by its shape: a peak before 40% throws a flare, a full centred curve (fullness over 0.6) raises a shield, and a drive longer than 105% of your median throws a lance. Shadow waves each need a particular spell within 3 strokes, and a clean single hump doubles the damage.
   - **Scaling:** Thresholds come from your first 10 strokes.
   - **Ghost:** Their recorded curves cast their own spells. *Open,* where curves were recorded.
8. **Harbor Lanes.**
   - **Length:** 500 m.
   - **Joysticks:** R (lane), P.
   - **Loop:** Under 24 spm is the left lane, 24-28 the middle, over 28 the right. Lanterns sit in lanes ahead; higher lanes pay more, but you must hold pace there.
   - **Scaling:** The lane edges follow your usual rate.
   - **Ghost:** Their boat changes lanes with their rate. *Open.*
9. **Same Speed, New Gear.**
   - **Length:** 1K.
   - **Joysticks:** R, C.
   - **Loop:** Hold P₀ ±1.5% while the rate cue steps 20/24/28/32. A lantern burns brighter the steadier you are. It is a real power-per-stroke drill.
   - **Scaling:** Relative to P₀.
   - **Ghost:** *Cued*, so past plays only.
10. **Squall Line.**
    - **Length:** 500 m.
    - **Joysticks:** P, ΔP.
    - **Loop:** A storm front behind you surges and eases on a hidden plan (for example 20 s at P₀ −3%, then 40 s at P₀ +2%), and the clouds darken 3 strokes before each surge. Intervals in disguise.
    - **Scaling:** Relative to P₀, surges ramped and capped at −5%.
    - **Ghost:** A second boat replayed against the same storm. *Open.*
11. **Quarters.**
    - **Length:** 1K.
    - **Joysticks:** P, ΔP.
    - **Loop:** Four 250 m gates, each needing a split at least 0.5% faster than the last, with a bonus for a final quarter within 1% of the target.
    - **Scaling:** The first gate is P₀ +2%.
    - **Ghost:** Their splits go up on the gates. *Open.*

### Build first

1. **The Wake.** It needs only meters and pace at 1 Hz, which the app already reads, and ghosts from the library the app already has. It is the owner's pace-boundary planner idea, and it is tense from the first stroke.
2. **Undertow.** The "stay afloat" level he described. It runs on stroke events and per-stroke watts (no pace lag), and it is open, so every saved row is an opponent on day one.
3. **Stone Skip.** One minute long, on per-stroke distance only. Every stroke gives a fresh result, and the retry is instant: a natural "one more go".

All three are deterministic sims fed by (stroke events, per-stroke numbers, pace relative to P₀, a seed). Building that interface once also builds the ghost and replay engine for every later game.

---

## Sources

1. Concept2, PM5 games: Fish, Darts, Target Training, Biathlon. https://concept2.co.uk/node/31 · https://concept2.co.uk/service/monitors/pm5/how-to-use/fish-game · https://concept2.co.uk/service/monitors/pm5/how-to-use/darts-game · https://concept2.co.uk/service/monitors/pm5/how-to-use/target-training · https://concept2.co.uk/service/monitors/pm5/how-to-use/biathlon
2. Concept2 NZ, "Top 3 favourite workout games". https://concept2.co.nz/Blog/x_post/Top-3-favourite-workout-games-enhance-your-indoor-rower-or-skierg-workouts-with-pm5-games-00086.html
3. Ergatta, Game-based workouts. https://ergatta.com/pages/game-based-workouts
4. Live Science, Ergatta review. https://livescience.com/ergatta-rower-review
5. Athletech News, Ergatta. https://athletechnews.com/product-of-the-week-the-ergatta-rower/
6. Digital Trends, Ergatta review. https://www.digitaltrends.com/health-fitness/ergatta-rowing-machine-review/
7. Aviron programs (Strong/GO). https://www.avironactive.com/aviron-programs/strong-go-rower/
8. TreadmillReviewGuru, Aviron review. https://www.treadmillreviewguru.com/aviron-rower-review
9. Garage Gym Reviews, Aviron app review. https://www.garagegymreviews.com/aviron-app-review
10. Peloton Row. https://onepeloton.com/row
11. Pelobuddy, Lanebreak guide. https://www.pelobuddy.com/peloton-lanebreak-review-guide/
12. CGMagazine, Lanebreak review. https://www.cgmagonline.com/review/game/peloton-lanebreak-review/
13. Tom's Guide, Lanebreak. https://www.tomsguide.com/news/pelotons-new-lanebreak-game-left-me-exhausted-and-not-in-a-good-way
14. Concept2, "Try EXR". https://concept2.com/blog/concept2-compatible-apps-try-exr
15. EXR App Store listing and reviews. https://apps.apple.com/app/id1518208077
16. Garage Gym Reviews, EXR. https://www.garagegymreviews.com/equipment/exr-game
17. Holodia, Holofit; VR Fitness Insider hands-on. https://www.holodia.com/consumer/ · https://www.vrfitnessinsider.com/hands-on-with-holodias-holofit-bringing-your-rowing-machine-into-virtual-reality/
19. Cyclists Hub, Kinomap review; Kinomap app listing. https://www.cyclistshub.com/kinomap-review/ · https://apps.apple.com/app/id611177969
20. Concept2, "ErgData feature: enhanced force curve". https://www.concept2.com/blog/ergdata-feature-enhanced-force-curve
21. ErgZone, App Store. https://apps.apple.com/us/app/ergzone/id1474566270
22. TechRadar, Peloton Row review; T3, Hydrow review. https://www.techradar.com/health-fitness/peloton-row-review · https://www.t3.com/reviews/hydrow-review
23. ergarcade on GitHub. https://github.com/ergarcade
24. OpenRowingCommunity c2bluetooth (BLE throughput). https://github.com/OpenRowingCommunity/c2bluetooth
25. Concept2, PM5 how-to / manuals. https://concept2.com/service/monitors/pm5/how-to-use
26. Concept2, "Improving your rows with the force curve". https://www.concept2.com/blog/improving-your-rows-with-the-force-curve
27. RowPerfect, "What's the ideal force curve" (Peter Mallory). https://rowperfect.co.uk/whats-the-ideal-force-curve-peter-mallory
28. ISBS proceedings, functional data analysis of rowing force curves. https://ojs.ub.uni-konstanz.de/cpa/article/view/2133/1992
29. World Rowing, "What rowing force curves reveal about rowers". https://worldrowing.com/news/what-rowing-force-curves-reveal-about-rowers
30. British Rowing Plus, "Applying biomechanics". https://plus.britishrowing.org/2024/06/17/applying-biomechanics-an-analysis-of-the-rowing-stroke/
31. Super Mario Wiki, Ghost (Mario Kart). https://www.mariowiki.com/Ghost_(Mario_Kart_series)
32. TV Tropes, Racing Ghost. https://tvtropes.org/pmwiki/pmwiki.php/Main/RacingGhost
33. Giant Bomb, Ghost Racer. https://giantbomb.com/wiki/Concepts/Ghost_Racer
34. Zwift Insider, HoloReplay; Zwift FAQ. https://zwiftinsider.com/holoreplay/ · https://support.zwift.com/en_us/holoreplay-faq-BJq2ez4yj
35. Zwift forums, "Personal Best Bot". https://forums.zwift.com/t/personal-best-bot/13120
36. The Clip Out, Peloton leaderboards. https://theclipout.com/how-does-the-peloton-leaderboard-work/ · https://theclipout.com/potential-new-here-now-leaderboard-feature-on-demand-peloton-classes/
37. Game Developer, "Rubber banding as a design requirement". https://gamedeveloper.com/design/rubber-banding-as-a-design-requirement
38. Mantz et al., effort-based adaptation and fairness in VR exergames (GMAP). https://ceur-ws.org/Vol-4206/GMAP-3.pdf
39. arXiv 2508.13095, HR-zone adaptation in a VR cycling simulator. https://arxiv.org/pdf/2508.13095
40. World Rowing, "Back pain in rowing"; BJSM rowing injury consensus. https://worldrowing.com/2016/05/02/back-pain-rowing-update-current-understanding/ · https://bjsm.bmj.com/content/bjsports/48/21/1534.full.pdf
41. UMass, "Selecting and effectively using a rowing machine". https://websites.umass.edu/bodyshop/files/2009/07/SelectingandEffectivelyUsingARowingMachine.pdf
42. Frontiers in Psychology 2021, exergame-based functional HIIT. https://www.frontiersin.org/articles/10.3389/fpsyg.2021.572877
- Also: Concept2 PM Bluetooth Smart Communications Interface Definition rev 1.30, as encoded in `mobile/src/pm5/pm5.ts` (sample rates, stroke states, force-curve packets).
