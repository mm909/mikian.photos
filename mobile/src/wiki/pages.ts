/* THE WIKI: the owner's plans for the app, in the app, for him alone
 * (owner, 2026-11-24: "give me a wiki for the future planning ... give it
 * to me in the app just for me ... put it in the settings page ... organize
 * it in the way that makes the most sense, and ideally in a nice order ...
 * You're responsible for putting these items of development in responsible
 * order").
 *
 * Pages are words and two drawings (screens/Wiki.tsx draws them). The
 * order of the index is the order of the work. Written from his voice notes
 * of Nov 24, 12-2 AM; mobile/PLANS.md is the same plan as a file. Change the
 * words here, push, and the app has them with the next update. */

export type Block =
  | { h: string }
  | { p: string }
  | { list: string[] }
  | { steps: string[] }
  | { quote: string }
  | { draw: "minute" | "program" }
  | { link: string; label?: string };

export type Page = { id: string; title: string; sub: string; blocks: Block[] };

export const PAGES: Page[] = [
  {
    id: "start",
    title: "Start here",
    sub: "The three rules, and how this wiki is kept",
    blocks: [
      { quote: "I want stuff to work. I want the direction to be clear. I want it to be organized." },
      { p: "Every idea you say out loud lands here, written down, put in its place in the order of work. Nothing on a page is built until you say go, unless the page says it is." },
      { p: "The pages run in the order the work should happen. The first is what today is for; the second is the whole order with the reason for it; the rest are the plans, one page each." },
      { link: "today", label: "Today" },
      { link: "order", label: "The order of work" },
    ],
  },
  {
    id: "today",
    title: "Today",
    sub: "What makes a killer day",
    blocks: [
      { h: "Tuesday, Nov 24" },
      { p: "If these four are done, it was a killer day, whatever else happened. Using the app and giving notes all day is work too; it is not on the list because it happens anyway." },
      { steps: ["Start the App Store submission. Started is the goal, not approved. Production iOS build, then eas submit, with your Apple sign-in in the terminal.", "Post asking Android users to help (the survey and testers).", "Row a 5K at about 1:59, then make the reel straight after.", "Stretch. Your knee told you."] },
      { h: "Wednesday, Nov 25" },
      { steps: ["The Android submission. The Android phone arrives that day.", "Row, reel, stretch."] },
      { h: "Every day" },
      { list: ["A 5K at about 1:59.", "A reel right after it, showing the app.", "Stretch."] },
    ],
  },
  {
    id: "order",
    title: "The order of work",
    sub: "Everything planned, first to last, and why",
    blocks: [
      { p: "Why this order: the store comes first because nothing reaches the public without it. Then the arcade, because it is what nobody else has and it is what the reels show. The planner comes next because its boundary boat is a game too. Bigger games need ghosts of other rowers, so they come after the first ones work. Utilities from the website come after the games." },
      { steps: [
        "App Store submission (Tue). Yours: it needs your Apple sign-in.",
        "Google Play submission (Wed).",
        "This wiki. Built Nov 24.",
        "159, the hold-a-pace game, with the chest and the boat skins. Built Nov 24; owner only until you say. Play it, then tune it.",
        "Stories show both photos of a row, one after the other.",
        "More 250 m games: Free Throw (repeat the same pull), with soccer and golf skins of it.",
        "The planner: two dials, meters and average pace. Then The Wake, the red boat at the pace you need.",
        "The 5K programme: the director plans a whole 20-minute show out of 250 m blocks.",
        "The Duel: two boats shooting once a block, six rounds, lives.",
        "Row Crawler: the roguelike auto-battler, 1K first, then the whole 5K.",
        "Posters in the app.",
        "A version number made of meters.",
        "Together: come row with me, two-player, then the raid.",
        "Read the FAQs again with the graph notes in mind.",
      ] },
      { link: "arcade", label: "The arcade" },
    ],
  },
  {
    id: "arcade",
    title: "The arcade",
    sub: "Mini games you play by rowing",
    blocks: [
      { p: "The director becomes a game director. It runs an arcade of short games, like Mario Party mini games, dropped into a row. Not every screen is a game. Arcade does not mean a store; it means a set of games we make." },
      { h: "The joysticks" },
      { list: [
        "Pace: how fast you are going, 1:59 or 2:30. Can also scale difficulty.",
        "Change of pace from where you are: speed up, slow down. Go slower is a good cue too.",
        "Stroke rate.",
        "Steadiness: holding a tight band.",
        "The force curve: the best lever of all. Repeat a pull, cast a spell.",
      ] },
      { p: "The research says strokes make better buttons than pace: the catch and the finish arrive in a quarter of a second, but a change in effort takes 2 to 5 seconds to show in the pace. So pace is a dial, held over a stretch, never a trigger." },
      { h: "One 250 m game, second by second" },
      { p: "250 m is a minute at 1:59. Of that minute about 30 seconds is the game." },
      { draw: "minute" },
      { list: ["0-5 s: the title card. The name, and LOCK IN YOUR PACE.", "5-35 s: the game.", "35-40 s: the reward, a chest.", "40-60 s: rest, the race on screen."] },
      { p: "A 500 m game is 2 minutes and a 1K is 4, the same way round." },
      { h: "How long things take at 2:00" },
      { p: "120 seconds a 500 is 0.24 seconds a meter. At about 28 strokes a minute, a stroke is a little over 2 seconds, about 9 m." },
      { list: ["50 m: 12 s, about 6 strokes.", "100 m: 24 s.", "250 m: 1:00.", "450 m: 1:48.", "500 m: 2:00.", "1,000 m: 4:00.", "5,000 m: 20:00, about 570 strokes."] },
      { h: "A boss" },
      { p: "Your idea, Nov 24: games need not be cut into 250s. A boss fought across the whole row has room to be big: one shot every 50 m is 100 shots in a 5K; one a stroke is about 570. Six shots a game is enough for a rock, not for a boss." },
      { h: "A 5K is twenty blocks" },
      { p: "Twenty blocks of 250 m, about a minute each. The first is always the intro. The last stretch, from 4,500, is the finish line. At 5,000 the level up plays, then the chest, then a little credits." },
      { draw: "program" },
      { p: "The middle is the director's to fill: games, rests, the race, the curves. The drawing is one example, not a rule." },
      { h: "Safety (from the research)" },
      { list: ["An easy warm-up before any scored game.", "Surges built over three strokes or more.", "No cue faster than your usual by 5% for more than 20 seconds.", "Go slower as often as go faster.", "Heart rate is a ceiling, never a difficulty setting."] },
      { link: "g159", label: "159" },
      { link: "freethrow", label: "Free Throw" },
      { link: "loot", label: "Chests and skins" },
      { link: "duel", label: "The Duel" },
      { link: "crawler", label: "Row Crawler" },
      { link: "together", label: "Together" },
      { link: "research", label: "What the research found" },
    ],
  },
  {
    id: "g159",
    title: "159",
    sub: "Hold your pace, shoot the rocks. 250 m",
    blocks: [
      { p: "BUILT Nov 24, owner only. Start any row: on a 5K it comes up at 1,000, 2,000, 3,000 and 4,000 m. A demo row of 1K plays one at 250 m. The skins you win are in Settings, Locker." },
      { h: "To tune once you have played it" },
      { list: ["The playing part is 200 m, about 48 seconds at 1:59, not the 30 you said. Four shots of 50 m; shorten to 25 m shots or three shots to get to 30.", "A shot hits when 60% of its 50 m sat in your band; a missed one still hits 15% of the time, LUCKY.", "In testing a steady rower won about two games in three; a wobbly one almost never."] },
      { h: "The title card" },
      { p: "A line-art briefcase with 159 on it as a graffiti sticker. Under it a flip-dot board, black and yellow, reading 159 in our bold numerals, which flips into the pace you are holding while it says LOCK IN YOUR PACE. Five seconds; whatever you hold at the end is locked." },
      { h: "The game" },
      { list: [
        "Your boat sits still in the middle. Rocks float round it. It aims by itself; you never steer.",
        "Every 50 m you hold the locked pace, it fires. A big rock breaks in two. Four hits clear the field: you win.",
        "Rocks left at the end explode on you: you lose.",
        "Off your pace, the boat wobbles; the further off, the more it wobbles.",
        "A shot from a wobbly 50 m can still hit. It counts. It says LUCKY.",
      ] },
      { h: "How tight the band is" },
      { p: "Plus or minus one standard deviation of your own pace, stroke to stroke, measured over your strokes just before the game; never tighter than 1.5 s, never looser than 4 s. A steady rower lands about two shots in three. Your idea was one deviation of your pace across your rows; across rows it is several seconds wide, too easy, so it is your steadiness inside a row instead." },
      { h: "Where it goes" },
      { p: "On a 5K around 1,000, 2,000, 3,000 and 4,000 m; never in the first or last 500. One on a 2K, one on a 1K. Every 1,000 m on a row with no distance set." },
    ],
  },
  {
    id: "freethrow",
    title: "Free Throw",
    sub: "Repeat the same pull. 250 m",
    blocks: [
      { p: "Not started." },
      { p: "Same frame as 159, but what you lock in is a pull, not a pace: the shape of your force curve. Each stroke that matches the locked one sinks the shot; drift too far from it and it misses." },
      { h: "Skins of the same game" },
      { list: ["Free throws or threes on a hoop.", "Penalty kicks on a goal.", "A golf swing: set the row, then row it."] },
      { p: "The research says the curve inputs that hold up: where the peak lands in the drive, how full the curve is, and how alike each stroke is to the last, all against your own first strokes. Needs a PM5 that sends curves." },
      { h: "For the CrossFit crowd" },
      { p: "A higher-or-lower game: told to go up or down from your locked pace and hit the new mark, like aiming a launch. Short, hard, but built up over strokes, never from a dead start." },
    ],
  },
  {
    id: "loot",
    title: "Chests and skins",
    sub: "The reward after every game",
    blocks: [
      { p: "BUILT Nov 24, owner only: 38 items across the four layers, in Settings, Locker. Kept on the phone for now; on the server later so it follows you. Not yet worn by your boat in the race; that is next." },
      { h: "The chest" },
      { p: "Every game ends on a chest that opens: one item, or sometimes it bursts into rainbows and gives three." },
      { h: "The boat, in layers" },
      { list: ["Boat (the hull).", "Oars.", "You, the rower in it, rowing.", "Effects: a halo, flames off the oars, sparkles in the wake."] },
      { h: "Rarity" },
      { list: ["Common: a colour. My boat turned red.", "Uncommon: two-tone, stripes.", "Rare: shiny, patterned. Red and shiny.", "Epic: something on it. A little bird sitting on the bow.", "Legendary: alive. Flaming oars, a rainbow wake."] },
      { p: "Later: some items gated by what you have rowed (a boat for a fast 5K), still dropped at random. Later still: skins to sell." },
    ],
  },
  {
    id: "duel",
    title: "The Duel",
    sub: "Two boats, one shot a block. 1,500 m",
    blocks: [
      { p: "Not started. Started as Russian roulette; it became a straight shooter." },
      { list: [
        "Two boats circle a middle point and shoot at each other, once every 250 m.",
        "Each block is a 159-style hold. Hold it and your shot goes; too wobbly and it misses (later: a ricochet).",
        "Six blocks, 1,500 m. First boat to run out of lives loses; if both do, both lose.",
        "Your opponent is a replayed row: their past row played as if live.",
      ] },
      { h: "Open" },
      { list: ["How many lives: you said 1 or 2, then 5. Start with 3 and tune once it is played.", "The first block of a 5K is the intro, so a Duel starts at block 2 or later."] },
    ],
  },
  {
    id: "crawler",
    title: "Row Crawler",
    sub: "A roguelike auto-battler on the erg",
    blocks: [
      { p: "Not started. The biggest one." },
      { list: [
        "Your boat fights by itself, like an auto-battler or a clicker: every stroke is a hit on the enemy in the middle.",
        "Every 250 m a challenge, a 159 or a Free Throw. Win it and you get help: another boat shooting with you, or a power-up, two shots instead of one.",
        "Fail too many in a row and you lose a life. Lose them all and the run is over; the next row starts again.",
        "First as a 1K. Then the whole 5K, ending on the level up at 5,000.",
      ] },
      { p: "Controls are your body: faster, slower, longer strokes, harder strokes, the curve, steadiness." },
    ],
  },
  {
    id: "together",
    title: "Together",
    sub: "Ghosts, two players, the raid",
    blocks: [
      { p: "Not started. Needs rowers to test with." },
      { list: [
        "Ghosts first: any saved row can play any game that is built only from strokes and pace, so people who never played still make fair opponents.",
        "If somebody did play that game, replay their exact run: you against Lindsay, as she played it.",
        "Come row with me: two players live.",
        "A raid: rowers together against a boss that makes you hold the same pace, or split apart.",
        "A battle royale.",
      ] },
    ],
  },
  {
    id: "planner",
    title: "The planner",
    sub: "Two dials, and the red boat",
    blocks: [
      { p: "Not started. The website has a planner to start from." },
      { list: ["Two dials: how many meters (200,000 this month) and what average pace (2:00).", "From those, each day's rows and the pace each needs.", "During the row the director knows the plan: your average needs to be X.", "The Wake: one lane, you and a red boat at the pace you need. If it passes you before the line, you lost the game."] },
    ],
  },
  {
    id: "posters",
    title: "Posters in the app",
    sub: "Bring the website's poster tool over",
    blocks: [
      { p: "Not started. Piece by piece; leave out what is no longer needed." },
      { list: ["A poster for one rower, and one for the month as a whole.", "Choose the dates.", "Search for a rower, and for one row.", "Copy or download.", "Change the colours."] },
      { p: "Careful not to make the public app too heavy with tools. What matters is that it works." },
    ],
  },
  {
    id: "small",
    title: "Small things",
    sub: "Stories, the version number, the FAQs",
    blocks: [
      { h: "Stories show both photos" },
      { p: "Stepping through stories, a row shows its first photo, then its second." },
      { h: "A version number made of meters" },
      { p: "The first number is all-time meters in tens of millions: 8,066,757 m on Nov 24 reads 0. One way to write it: V0.8.0 now, V1.0.0 at ten million. The store's number has to only go up and the updates are keyed to it, so the meters version is the line on the opening screen, read live, and the store number stays." },
      { h: "The FAQs" },
      { p: "Read them again; the notes you gave the graphs probably apply." },
    ],
  },
  {
    id: "business",
    title: "The business",
    sub: "The reel a day, and where it leads",
    blocks: [
      { list: ["Every day: a 5K at about 1:59, then a reel straight after.", "Show the app the way Dr. Mike shows his: talk about the training, then the app tells me exactly what to row today.", "Reel, then installs. Some subscribe. Many more log rows and fill the feed.", "Then local gym ads, and the merch."] },
      { p: "The plan (Nov 22): subscriber-first, about $5 a month." },
    ],
  },
  {
    id: "research",
    title: "What the research found",
    sub: "Games on rowing machines so far",
    blocks: [
      { list: [
        "Existing erg games do one of two things: hold a pace or rate in a band (the PM5's own target game, Ergatta, Peloton's Lanebreak), or treat each stroke as an action whose strength is its power (Aviron's cannons). Steering with pace is rare.",
        "They set targets from your own first strokes, not one number for everybody.",
        "What bores people: the same scene, the same scoring, no bests, no head to head.",
        "Pace is worked out once a stroke and lags effort by 2 to 5 seconds; the catch and the finish are instant.",
        "Targets as a percent of your usual pace, so a 2:30 rower and a 1:59 rower play the same game.",
        "Build first: The Wake (the planner's red boat), Undertow (stay afloat), Stone Skip (a minute; every stroke scores).",
      ] },
      { p: "The whole report: mobile/ARCADE-RESEARCH.md." },
    ],
  },
];

export const pageOf = (id: string): Page | undefined => PAGES.find((p) => p.id === id);
