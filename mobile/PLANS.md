# ROW: the sticky note

Written down 2026-11-24, 12:40 AM, from the owner's voice note. Nothing below is started. **He says when.**

## The three rules

"I want stuff to work. I want the direction to be clear. I want it to be organized."

## This week

**Tuesday, Nov 24: a killer day is these three things.**
- [ ] **Start the App Store submission.** It only has to be started, not approved. Production iOS build, then `eas submit`. His Apple sign-in is needed in the terminal.
- [ ] **Post asking Android users to help** (the survey / testers). Post tomorrow, not tonight.
- [ ] **Row a 5K at about 1:59, then make a reel straight after** that shows the app.

**Wednesday, Nov 25**
- [ ] **Android submission.** The Android phone arrives that day.

Testing the app and giving UX notes all day is work too. That happens anyway, so it is not on this list.

## The daily job (the marketing plan)

- **Every day:** row about 5K at 1:59, then make a reel right after.
- **In the reel:** show what the app does, in the style of Dr. Mike Israetel's ads. Talk about the training, then say "the app tells me exactly what to do." For example: "today it's a 5K at this pace, because ROW says that's what's on the schedule to hit my month."
- **The funnel:** reel → app installs → some become paid subscribers, many more log rows and fill the feed → local gym ads and merch.

## The queue (in his order, not started)

### 1. A version number made of meters

- **The rule:** the first number of the version is the all-time meters in tens of millions. The total was 8,066,757 m on Nov 24, so it reads **0**.
- **One way to write it:** tens of millions . millions . hundred-thousands, so **V0.8.0** today and **V1.0.0** at 10 million.
- **Watch out:** the App Store version (1.3.0 now) can only ever go up, and the update channels are keyed to it. So the meters version is probably the splash's line ("· V0.8.0"), read live, and the store number stays as it is. To decide with him.

### 2. Stories show both photos

- When stepping through stories, a row shows its first photo, then its second, one right after the other.

### 3. The poster utility, in the app, piece by piece

- **Two posters:** one for a single rower, and one for Rowtember (or the edition) as a whole.
- **Choose a date range.**
- **Search for a rower:** pick one row, or make a poster for one rower.
- **Copy or download.**
- **Change the color scheme.**
- **Leave out** the parts of the site version that are no longer needed.
- **The site's versions to start from:**
  - `src/app/row100k/posters/page.tsx`
  - `src/app/row100k/r/[num]/poster/page.tsx`
  - `src/app/row100k/post/page.tsx`
  - `src/app/row100k/shareables/page.tsx`
- **Careful:** he does not want the public app to get "too utility heavy". He said "maybe I do"; the priority is that it works.

### 4. The planner (site: `src/app/row100k/plan/page.tsx`)

- **Two dials:** the meters goal (for example 200,000 m) and the average pace goal (for example 2:00).
- **From the dials:** a rower assigns meters to days and is told what pace each row needs.
- **During the row:** the director knows the plan, so it can cue "your average needs to be X". A **red boundary boat** at the required pace chases you in a single lane. If it passes you before the finish, you lost the game (nothing is actually taken away).

### 5. The arcade (the big one; see below)

### 6. Re-read the FAQs

- The critiques he gave the other graphs probably apply to the FAQ pages too. He has not checked them in a while.

### Also on his mind

- **The race boat moves:** right now his boat sits fixed in the centre of the race screen. Let it move up and down with speed. That is a first test of pace as a control.

---

## The arcade (brain dump, Nov 24)

**The idea.** The director becomes a game director, running an arcade of mini games. Think **Mario Party mini games** or Jackbox. Not every screen has to be a game. "Arcade" does not mean building a store or marketplace; it means a set of games we make.

**Length.** 250 m (about 1 minute at 1:59) up to 1K (about 4 minutes). Nothing shorter than 250 m.

**Single player first, for sure.** Multiplayer later, filled in with past rows: any saved row can be replayed live as an opponent.
- The replayed rower was not playing the game, so their "controls" wander. That is fine.
- If someone did play that game, replay their exact run: "you're playing against Lindsay, exactly as she played it", shown as a ghost beside you.

**The joysticks** (what the game can make a rower do):

1. **Absolute pace:** how fast you are going (1:59 vs 2:30). It can also scale difficulty: row slower and maybe your ball is smaller, or a boss gets more health when you row faster.
2. **Change in pace from where you are:** speed up or slow down. 2:30 to 2:31 counts the same as 1:59 to 2:00. The game can cue "go faster", and he especially likes **"go slower"** as a cue.
3. **Stroke rate.**
4. **Consistency:** holding a tight band.
5. **The force curve.** He called it "the best lever of all", for example to cast a spell.

**Genre ideas he named.**
- **Stay afloat:** a side-scroller where raising your pace lifts you and easing off drops you, dodging things. Think Flappy Bird or Jetpack Joyride, or an underwater level.
- **The pace-boundary chase** from the planner.
- Make the genres our own; do not copy an existing game.

**Tomorrow's game goal, in his words.** "Try and make several games for the rower", 1K / 4-minute games, single player first.

**Research.** Done (Nov 24): `mobile/ARCADE-RESEARCH.md`. Its pick to build first is The Wake (the red-boat chase), Undertow (stay afloat, driven by strokes) and Stone Skip (one minute, every stroke scores). It covers prior art (the PM5's own games, Ergatta, Aviron, Peloton Lanebreak and others), controls and lag, the force curve as an input, ghosts, and 8 to 12 game concepts.
