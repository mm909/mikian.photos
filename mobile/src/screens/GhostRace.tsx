import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { ReactNode } from "react";
import { api } from "../api";
import { DRIVE, PASS_S, ghostClock, ghostDone, ghostMeters, ghostTrend, leadSeconds, nextBoat, oarAngle, phaseOf, pickRivals, rowerKey, trendOf, type Ghost, type Ghosts } from "../erg/ghosts";
import { useLiveRowers } from "../erg/liveRace";
import { milestone } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import { useSession } from "../session";
import { C, F, fmtClock, fmtInt, fmtPace } from "../theme";
import { Eyebrow, Num, styles } from "../ui";

/* THE RACE: the row in progress against four rows already rowed, seen
 * from over the water (owner, 2026-11-22: "one of the screens on live
 * view"; "a line art style ... thin lines"; "a drone view"; "going to the
 * right"; "I can see myself passing them"). The monitor's first page when
 * the piece is a set distance ("let's have that be the main screen").
 *
 * FIVE LANES AND FIVE BOATS, the rower's in the middle (his second read,
 * the same night: "let's cap this animation at 5 boats. And like in 5
 * lanes. I really don't like the 3 boats in a lane look"; "let's think
 * about lanes on a track ... so that way we can put their name larger").
 *
 * THE LANES RUN EDGE TO EDGE, AND WHAT A LANE SAYS IS PAINTED ON IT (his
 * fifth read: "let's extend the lanes to be the full width, and let's write
 * their names on the lanes"; "in the lane, like in front of the boat, we
 * should write their average pace ... like when you go to a high school
 * track and they write their high school name on the track"; "I'm going to
 * be reading this from, like 3 to 6 feet away"). There are no columns
 * beside the water any more. On a lane, under the boats: whose it is at the
 * left, in capitals; at the right, HOW MANY SECONDS that boat is ahead of
 * the rower or behind ("I don't think I care about the number of meters
 * behind me they are, but probably the number of seconds"); and ahead of
 * the bow, going with the boat, its average split so far. The rower's own
 * lane has their name and their own average, and a past row of theirs has
 * their name too (his sixth read: "instead of saying you, let's put their
 * name"). No lane says a date ("let's drop the dates").
 *
 * WHO THE FOUR ARE (erg/ghosts.ts pickRivals): the rows that will finish
 * nearest the finish the rower is headed for, a recorded row before one
 * logged by hand ("we should prioritize people with telemetry data ... you
 * are literally rowing against every stroke that they did"), two that
 * finish ahead and two behind where the field has them. A recorded row
 * says TELEMETRY, as a row in the feed does, and a row of which only the
 * time is known says nothing ("let's say telemetry ... the way that you
 * denoted it on the feed ... and if it's not, then we just ... don't put
 * anything"; it used to say EVERY STROKE and EVEN PACE).
 *
 * THE CLOSEST ARE NEXT TO THE ROWER ("I need the rowers that are going to
 * be closest to me for any given period of the race to be in the lanes
 * closest to me"). Two of the four are above the rower and two below, for
 * the whole row. Of each two, the one that will be nearer over the next
 * half minute has the lane beside the rower; when that changes they trade
 * lanes, and only while they are a boat's length apart along the water, so
 * neither rows through the other.
 *
 * NO LANE IS EMPTY (his fifth read: "when the rowers went off the screen,
 * no one came to replace them"; "we need to make sure we have rowers in
 * every lane"; "once a rower leaves, we need a rower to fill in ... and we
 * need rowers to fill from the back if someone goes ahead of us"). A boat
 * off the water is out at once, as before, and its lane goes at once to the
 * next boat (erg/ghosts.ts nextBoat): a real row that is on the water now
 * or about to be, one ahead when a boat was dropped and one behind when a
 * boat went away up the course. SOMEBODY ELSE FIRST: a past row of the
 * rower's own, or a second row of somebody racing, has a lane only when
 * nobody else is near ("4 of these rowers are me. Fix it"; "If we cannot
 * find any other people to put in that lane, then it's okay to
 * duplicate"). And when no real row at all is near, a PACE BOAT, an even
 * pace to a round finish, named by that finish.
 * A rower on the water this minute (erg/liveRace.ts) is where they are this
 * second and is given a lane like anybody, while they are on the water:
 * "if someone is live and we're catching up to them, then show them like in
 * someone's lane, and have that rower ... drop"; "what I don't want to have
 * happen is a lane be empty". A boat that was
 * already on the water (it was one of the dots) comes up where it is, in
 * under a second; nothing is slid in from an edge ("do not have someone
 * swoop in from the back").
 *
 * THE ROWER'S BEST ROWS IN THE ROWER'S OWN LANE (his sixth read: "we don't
 * need to show my best all the time or how far away I am from my best ...
 * if I get close to it, then that boat should appear in my lane, right? In
 * my lane, I can race my best self there"). Their fastest row over the
 * distance is a red boat in the middle lane for as long as it is on the
 * water, with the seconds between the two at the lane's end, and nothing
 * of it shows when it is not. It is never one of the four. The red line
 * across the water and the strip that named it are gone. The lane ropes
 * still go red as the finish this row is headed for nears that best (his
 * fifth read: "I want the track to light up red as your PB gets closer"):
 * none at 2.5% behind it, all of it on pace to beat it. It is the ropes
 * and not the water now, because the water has a color of its own:
 *
 * THE WATER BEHIND A BOAT SAYS WHAT ITS ROWER IS DOING (his sixth read:
 * "can we tint the water behind them ... red when you're slowing down ...
 * green ... when you're speeding up"; "the number to be the average pace
 * ... but the coloring ... can be based off of ... the last 100 meters or
 * so"). The lane behind each stern is green while the last 100 m was
 * quicker than the 100 m before it, red while it was slower, and plain
 * while the two are within half a percent (erg/ghosts.ts trendOf). A row
 * of which only the time is known is always plain.
 *
 * THE SAME RACE, UP THE SCREEN (owner, 2026-11-22: "make a vertical option
 * for when my phone is vertical. Like right now on the vertical option, the
 * boat still goes side to side ... I actually don't mind how the vertical
 * one looks right now, but I do want another option. Like another slide").
 * With `upright`, the course runs from the bottom of the page to the top:
 * five lanes side by side, bows up, the rower's boat a third of the way up
 * and the water coming down under it. An upright phone is twice as tall as
 * it is wide, so there is half as much again of the course in view. What a
 * lane says is still painted on it: the name up the lane from the bottom,
 * as on a track; the seconds across its top; the split above the bow. The
 * meters are in a margin down the left. It is a second page of the monitor
 * beside the first, on ONE race (useRace): the same four in the same
 * lanes, whichever page is looked at.
 *
 * THE REST OF THE FIELD IS IN THE WATER, as small dots where each of those
 * rows is at this moment ("fish-sized dots kind of going through the water
 * that shows the other rowers").
 *
 * THREE FIGURES UNDER THE WATER AND NONE OVER IT: the meters to go, the
 * time, and the finish the row is headed for (his sixth read: "I kind of
 * want to drop the ETA from the copy and just have it be the final or the
 * expected time"; "since we're putting the average ... on my rower ... we
 * can move the ETA to where the current average is. That way we can make
 * the lanes a little taller"). The average is on the rower's own lane.
 *
 * EVERY BOAT BUT A LIVE ONE LEFT THE START WITH THE ROWER, and the clock
 * stops on the
 * line with them: a boat a second behind used to be put on the finish line
 * by a clock that ran on after the piece ("Sandbox Rower 2 was like at the
 * finish line, even though we passed them"). The rower's boat holds its
 * place on the screen and the water runs under it. The monitor speaks a
 * few times a second; the picture is drawn thirty times a second from
 * where the last word put the rower, carried on at the split it gave. */

const PX_PER_M = 7.2;
const BOAT_M = 8.2;
const PUDDLE_S = 2.4;
const LANES = 5;
const MID = 2;
const RIVALS = 4;
/* The rower's best over the distance, and the water as they close on it. */
const BEST = "#D8362A";
/* How far behind their best the finish they are headed for can be, as a
 * share of that best, before the water has none of its red. */
const BEST_SHARE = 0.025;
/* How much of its color the water right behind a boat has, when its rower
 * is speeding up or slowing down as hard as the tint reads. */
const WAKE = 0.5;
/* How long a boat takes to come up where it is. */
const RISE_MS = 900;

type Puddle = { wm: number; lane: number; born: number };
/* A boat's place in its stroke, the puddles it has left, and how much of
 * the green (over nothing) or the red (under it) the water behind it has. */
type Stroke = { phase: number; puddles: Puddle[]; tint: number };
/* One of the four: the row, which side of the rower it is on for good, the
 * lane it is drawn in (between two while it changes), and when it came up
 * out of the water (0: it rowed on, or was there from the start). */
type Rival = { g: Ghost; side: -1 | 1; lane: number; born: number };

/* Where a place along the course and across it is on the page: along is x
 * and across is y when the course runs left to right, and the other way
 * round, counted up from the bottom, when it runs up the page. */
type To = (along: number, across: number) => [number, number];
const flat: To = (a, c) => [a, c];

/* One boat, bow toward the finish, as two paths: the thin lines (hull,
 * rigger, looms, the wake) and the blades. */
function boat(ca: number, cc: number, u: number, pitch: number, phase: number, to: To = flat): { lines: string; blades: string; wet: boolean; tipDy: number } {
  const len = BOAT_M * u;
  const hb = Math.max(1.8, Math.min(3.2, 0.36 * u));
  const pinA = ca + 0.15 * u;
  const pinC = Math.max(4.5, 0.8 * u);
  const out = Math.max(8, Math.min(1.9 * u, pitch * 0.46 - pinC));
  const inb = pinC * 0.7;
  const { angle, wet } = oarAngle(phase);
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const P = (a: number, c: number) => {
    const [x, y] = to(a, c);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const tail = ca - len / 2 - 1;
  let lines = `M${P(ca - len / 2, cc)} Q${P(ca, cc - hb * 2)} ${P(ca + len / 2, cc)} Q${P(ca, cc + hb * 2)} ${P(ca - len / 2, cc)}Z`;
  lines += `M${P(pinA, cc - pinC)} L${P(pinA, cc + pinC)}`;
  lines += `M${P(tail, cc)} L${P(tail - 0.9 * u, cc - 0.42 * u)} M${P(tail, cc)} L${P(tail - 0.9 * u, cc + 0.42 * u)}`;
  let blades = "";
  for (const side of [-1, 1]) {
    const hA = pinA - inb * sin;
    const hC = cc + side * (pinC - inb * cos);
    const tA = pinA + out * sin;
    const tC = cc + side * (pinC + out * cos);
    const bA = pinA + out * 0.7 * sin;
    const bC = cc + side * (pinC + out * 0.7 * cos);
    lines += `M${P(hA, hC)} L${P(bA, bC)}`;
    blades += `M${P(bA, bC)} L${P(tA, tC)}`;
  }
  return { lines, blades, wet, tipDy: pinC + out * cos };
}

const median = (v: number[]): number => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
/* "+3.4", "−12", "0.0": seconds ahead of the rower, or behind. A tenth
 * under ten seconds, where a tenth is the race. */
function gapWord(s: number): string {
  const a = Math.abs(s);
  if (a < 0.05) return "0.0";
  return `${s > 0 ? "+" : "−"}${a >= 9.95 ? Math.round(a) : a.toFixed(1)}`;
}

/* ONE RACE, for however many pages draw it: the field for the distance,
 * and everything that moves from frame to frame. The monitor holds it
 * (RowScreen.tsx) and hands it to the page across the screen and the page
 * up it, so the two show the same boats in the same lanes. A page handed
 * none keeps its own. */
export function useRace(target: number) {
  const [field, setField] = useState<Ghosts | null>(null);
  const [failed, setFailed] = useState(false);

  /* The field for this distance, asked for once as the monitor names it. */
  useEffect(() => {
    if (!(target > 0)) return;
    let on = true;
    setField(null);
    setFailed(false);
    api<Ghosts>(`/api/row100k/app/ghosts?meters=${Math.round(target)}`)
      .then((r) => on && setField(r))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [target]);

  /* WHERE THE ROWER IS NOW: the monitor's last word, carried on. */
  const said = useRef({ at: 0, t: -1, m: -1 });
  const shown = useRef({ at: 0, t: 0, m: 0 });
  const strokes = useRef(new Map<string, Stroke>());
  /* How many of the monitor's seconds pass in one of the clock's: 1 on a
   * real monitor; the demo row runs faster and is carried on as fast. */
  const rate = useRef(1);
  /* Whether the handle was on the drive at the last frame, and since when. */
  const pulling = useRef({ on: false, at: 0 });
  const rivals = useRef<Rival[]>([]);
  const seeded = useRef<Ghosts | "none" | null>(null);
  /* The second the rower's boat reached the line. */
  const lineAt = useRef<number | null>(null);
  /* Where the monitor has put the rower over the last 260 m, for what they
   * have done over the last 100 m against the 100 m before. */
  const path = useRef<{ t: number; m: number }[]>([]);
  /* When the rower's best came onto the water (0: it is not on it). */
  const bestBorn = useRef(0);
  /* When the lanes were last looked over for a duplicate to hand back. */
  const handedAt = useRef(0);
  const swappedAt = useRef(0);
  return { field, failed, said, shown, strokes, rate, pulling, rivals, seeded, lineAt, path, bestBorn, handedAt, swappedAt };
}
export type Race = ReturnType<typeof useRace>;

/* `upright`: the course runs up the page (an upright phone only; on its
 * side the page is the one across the screen whatever is asked). `drive`:
 * of two pages on one race, only one moves it on and says who has a lane,
 * because how much water is in view differs between the two; the other
 * draws what it is given. */
export function GhostRace({ erg, width, height, active, race, upright = false, drive = true }: { erg: Erg; width: number; height: number; active: boolean; race?: Race; upright?: boolean; drive?: boolean }) {
  const { live } = erg;
  const { me } = useSession();
  const myName = (me.me?.displayName || "You").toUpperCase();
  const target = live.targetM;
  const own = useRace(race ? 0 : target);
  const { field, failed, said, shown, strokes, rate, pulling, rivals, seeded, lineAt, path, bestBorn, handedAt, swappedAt } = race ?? own;

  const ghosts = useMemo(() => field?.ghosts ?? [], [field]);
  /* The rower's fastest row over the distance: it rows in the rower's own
   * lane, and is never one of the four. THE FOUR ARE OTHER PEOPLE WHILE
   * THERE ARE OTHER PEOPLE (owner, 2026-11-22, of a finish with his name on
   * four lanes: "4 of these rowers are me. Fix it"; and then, told why:
   * "If we cannot find any other people to put in that lane, then it's okay
   * to duplicate"). A past row of the rower's own, or a second row of
   * somebody racing, is given a lane only when nobody else is near enough
   * to be on the water (erg/ghosts.ts nextBoat). */
  const best = useMemo(() => ghosts.filter((g) => g.kind === "me").sort((a, b) => a.seconds - b.seconds)[0] ?? null, [ghosts]);
  const pool = useMemo(() => (best ? ghosts.filter((g) => g !== best) : ghosts), [ghosts, best]);
  /* Who is rowing the distance this minute (erg/liveRace.ts; nobody, until
   * the owner turns it on). */
  const liveNow = useLiveRowers();
  const all = useMemo(() => (liveNow.length ? [...pool, ...liveNow] : pool), [pool, liveNow]);
  /* What the rower usually does over this distance: the middle of their
   * own rows, or of the field's when they have none. The finish the four
   * are first picked for, before this row has a pace. */
  const usual = useMemo(() => median(ghosts.filter((g) => g.kind === "me").map((g) => g.seconds)) || median(ghosts.map((g) => g.seconds)), [ghosts]);

  /* Thirty frames a second while this page is the one in view. */
  const [, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 32) {
        last = ts;
        setFrame((v) => (v + 1) % 1_000_000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const now = Date.now();
  if (live.elapsedS !== said.current.t || live.meters !== said.current.m) {
    /* A new piece on the monitor starts the picture, and the race, again. */
    if (live.meters + 5 < said.current.m) {
      shown.current = { at: now, t: live.elapsedS, m: live.meters };
      strokes.current.clear();
      rivals.current = [];
      seeded.current = null;
      lineAt.current = null;
      path.current = [];
      bestBorn.current = 0;
    }
    const tail = path.current[path.current.length - 1];
    if (live.meters > 0 && (!tail || live.meters >= tail.m + 2)) {
      path.current.push({ t: live.elapsedS, m: live.meters });
      while (path.current.length > 2 && path.current[1].m < live.meters - 260) path.current.shift();
    }
    const wall = (now - said.current.at) / 1000;
    const step = live.elapsedS - said.current.t;
    if (said.current.t >= 0 && wall > 0.03 && wall < 3 && step > 0) {
      const r = step / wall;
      rate.current = r > 0.7 && r < 1.4 ? 1 : Math.min(40, rate.current + (r - rate.current) * 0.5);
    }
    said.current = { at: now, t: live.elapsedS, m: live.meters };
  }
  const moving = live.awake && !live.ended && live.pace > 0 && live.pace < 600;
  let since = moving ? Math.min(1.5, (now - said.current.at) / 1000) * rate.current : 0;
  /* No further than the line: the clock that the other boats are placed by
   * stops there with the rower. */
  if (moving && target > 0) since = Math.min(since, Math.max(0, ((target - said.current.m) * live.pace) / 500));
  let wantT = said.current.t < 0 ? 0 : said.current.t + since;
  let wantM = said.current.m < 0 ? 0 : said.current.m + (moving ? (since * 500) / live.pace : 0);
  if (target > 0) wantM = Math.min(target, wantM);
  if (target > 0 && said.current.m > 0 && (live.ended || wantM >= target - 0.01)) {
    if (lineAt.current === null) lineAt.current = wantT;
    wantT = Math.min(wantT, lineAt.current);
  } else lineAt.current = null;
  /* Time passes for the page that drives the race, and stands still for
   * one that only draws it. */
  const dt = drive && shown.current.at ? Math.min(0.25, (now - shown.current.at) / 1000) : 0;
  const ease = Math.min(1, dt * 9);
  if (drive) shown.current = { at: now, t: shown.current.t + (wantT - shown.current.t) * ease, m: Math.max(0, shown.current.m + (wantM - shown.current.m) * ease) };
  const t = shown.current.t;
  const myM = shown.current.m;

  if (!(target > 0)) {
    return (
      <View style={{ width, height, justifyContent: "center", paddingHorizontal: 20 }}>
        <Eyebrow style={{ color: C.ink, marginBottom: 6 }}>The race</Eyebrow>
        <Text style={styles.body}>Set a distance on the monitor and four rows already rowed over it line up beside you: your own, and the rowers you follow.</Text>
      </View>
    );
  }

  /* THE PAGE, from the top: the meters along the course, over the water
   * and clear of the lanes; the water, edge to edge; the three figures.
   * With the course up the page the meters are in a margin down the left
   * of the water and there is no strip over it. */
  const wide = width >= 520;
  const up = upright && !wide;
  const PAD = 20;
  const W = width;
  const TOP = wide ? 2 : 6;
  const RULE = up ? 0 : wide ? 20 : 22;
  const GUT = up ? 50 : 0;
  const FOOT = wide ? 62 : 64;
  const waterH = Math.max(150, height - TOP - RULE - FOOT - 8);
  const pitch = up ? (W - GUT) / LANES : waterH / LANES;
  /* Upright with the course across the page, a lane is tall: its words are
   * along its top and its boat a little under the middle. On its side the
   * words are across the middle and the boats row over them, as over
   * paint. */
  const drop = wide || up ? 0 : pitch * 0.12;
  const u = PX_PER_M;
  /* ALONG AND ACROSS. `xOf` is how far along the course a place is from
   * the edge of the water behind the rower, and `yOf` how far across the
   * water a lane's middle is; `pt` puts the two on the page. Across the
   * screen they are x and y. Up it, along is counted from the bottom. */
  const course = up ? waterH : W;
  const xMe = up ? waterH * 0.36 : W * 0.42;
  const xOf = (m: number) => xMe + (m - myM) * u;
  const yOf = (lane: number) => GUT + (lane + 0.5) * pitch + drop;
  const pt: To = (a, c) => (up ? [c, waterH - a] : [a, c]);
  const n1 = (v: number) => v.toFixed(1);
  /* The seconds at the end of a lane: on its side they are across the
   * middle of it, and up the page across its top, where a boat would row
   * over them, so there the water a boat can be on stops short of them. */
  const gapSize = up ? 20 : Math.round(wide ? clamp(pitch * 0.72, 18, 30) : clamp(pitch * 0.3, 22, 32));
  const gapLine = Math.round(gapSize * 1.12);
  const gapW = gapSize * 3.6;
  const back = xMe / u + BOAT_M / 2;
  const front = up ? (waterH - gapLine - 16 - xMe) / u - BOAT_M / 2 : wide ? (W - gapW - 18 - xMe) / u - BOAT_M / 2 : (W - xMe) / u + BOAT_M / 2;

  /* The finish the rower is headed for: this row's own once it has 100 m
   * to go on; before that their usual, or what the first strokes say. */
  const ms = milestone(live);
  const proj = live.ended ? t : ms ? ms.projected : 0;
  const near = proj > 0 ? proj : usual > 0 ? usual : live.avgPace > 0 && live.meters > 20 ? (target * live.avgPace) / 500 : 0;
  const speed = live.avgPace > 0 ? 500 / live.avgPace : near > 0 ? target / near : 0;
  const gapOf = (g: Ghost, at = t, mine = myM) => ghostMeters(g, target, at) - mine;
  const inView = (d: number) => d >= -back && d <= front;

  /* A boat takes a lane on the side with fewer boats on it. */
  const add = (g: Ghost, born: number) => {
    const above = rivals.current.filter((r) => r.side === -1).length;
    const side: -1 | 1 = above <= rivals.current.length - above ? -1 : 1;
    rivals.current.push({ g, side, lane: MID + side * (rivals.current.filter((r) => r.side === side).length + 1), born });
  };

  /* THE FOUR, picked once the field is in (or has failed, and the lanes
   * are pace boats): two above the rower and two below, a quicker and a
   * slower row on each side, the nearer finish in the lane beside the
   * rower. A field that arrives with the row under way is not lined up on
   * the start: the lanes are filled from who is on the water. */
  const ready = field !== null || failed;
  if (ready && seeded.current !== (field ?? "none")) {
    seeded.current = field ?? "none";
    strokes.current.clear();
    rivals.current = [];
    if (t <= 2) {
      /* Other people on the start; lanes they do not fill are filled just
       * below, with a duplicate before a pace boat. */
      for (const g of pickRivals(pool.filter((x) => x.kind !== "me"), target, usual, RIVALS).sort((a, b) => a.seconds - b.seconds)) add(g, 0);
      for (const s of [-1, 1] as const) {
        const two = rivals.current.filter((r) => r.side === s).sort((a, b) => Math.abs(a.g.seconds - usual) - Math.abs(b.g.seconds - usual));
        two.forEach((r, i) => (r.lane = MID + s * (i + 1)));
      }
    }
  }

  /* A ROWER ON THE WATER THIS MINUTE is where they are this second, and
   * has a lane while that is on the water: the lane of their own past row
   * if that is racing, or of the boat farthest from the rower, which
   * drops. Their boat is their latest word; one who has stopped sending,
   * or is off the water, gives the lane up like anybody. */
  const stale = new Set<Rival>();
  for (const r of rivals.current) {
    if (r.g.kind !== "live") continue;
    const fresh = liveNow.find((g) => g.id === r.g.id);
    if (fresh) r.g = fresh;
    else stale.add(r);
  }
  const refill = drive && ready && !live.ended && target - myM > 30;
  if (refill && t > 0) {
    for (const g of liveNow) {
      if (rivals.current.some((r) => r.g.id === g.id) || ghostDone(g, t) || !inView(gapOf(g))) continue;
      if (rivals.current.length < RIVALS) {
        add(g, t > 1 ? now : 0);
        continue;
      }
      const out = rivals.current.find((r) => rowerKey(r.g) === rowerKey(g)) ?? rivals.current.filter((r) => r.g.kind !== "live").sort((a, b) => Math.abs(gapOf(b.g)) - Math.abs(gapOf(a.g)))[0];
      if (!out) continue;
      strokes.current.delete(out.g.id);
      out.g = g;
      out.born = now;
    }
  }

  /* NO LANE IS EMPTY. A boat off the water has given up its lane, and the
   * next has it at once (erg/ghosts.ts nextBoat); so has a lane that never
   * had a boat, when the field was short of four. Not in the last strokes,
   * where the picture is the finish. */
  if (refill && speed > 0) {
    const water = { back, front };
    for (const r of rivals.current) {
      const d = gapOf(r.g);
      if (inView(d) && !stale.has(r)) continue;
      if (!(t > 0)) continue;
      const next = nextBoat({ ghosts: all, meters: target, t, mine: myM, speed, near, water, racing: rivals.current.filter((x) => x !== r).map((x) => x.g), want: d < -back ? 1 : d > front ? -1 : 0 });
      if (!next) continue;
      strokes.current.delete(r.g.id);
      r.g = next.g;
      r.born = next.on ? now : 0;
    }
    /* A DUPLICATE HAS ITS LANE ONLY UNTIL SOMEBODY ELSE COMES ONTO THE
     * WATER: a past row of the rower's own, or a second row of somebody
     * racing, gives the lane to the first other person who is on it.
     * Looked at once a second. */
    if (t > 0 && now - handedAt.current > 1000) {
      handedAt.current = now;
      rivals.current.forEach((r, i) => {
        const dup = r.g.kind === "me" || rivals.current.findIndex((x) => rowerKey(x.g) === rowerKey(r.g)) !== i;
        if (!dup) return;
        const next = nextBoat({ ghosts: all, meters: target, t, mine: myM, speed, near, water, racing: rivals.current.filter((x) => x !== r).map((x) => x.g), want: 0, others: true });
        if (!next || !next.on) return;
        strokes.current.delete(r.g.id);
        r.g = next.g;
        r.born = now;
      });
      /* A BOAT THAT WILL NEVER CROSS THE ROWER GIVES ITS LANE TO ONE THAT
       * WILL (owner, 2026-11-23: passes are what the race is for). One
       * that is not closing on the rower, or not inside PASS_S, and is not
       * right beside them, makes way for a boat that will pass or be
       * passed inside the next minute. One trade every six seconds at most,
       * so the water does not churn. */
      if (now - swappedAt.current > 6000) {
        const closing = (g: Ghost) => {
          const d = gapOf(g);
          const v = (gapOf(g, t + 10, myM + 10 * speed) - d) / 10;
          return (d > 1 && v < -0.02) || (d < -1 && v > 0.02) ? Math.abs(d) / Math.abs(v) : Infinity;
        };
        const idle = rivals.current
          .filter((r) => r.g.kind !== "live" && !stale.has(r) && Math.abs(gapOf(r.g)) > 12 && closing(r.g) >= PASS_S && (r.born === 0 || now - r.born > 8000))
          .sort((a, b) => Math.abs(gapOf(b.g)) - Math.abs(gapOf(a.g)))[0];
        if (idle) {
          const next = nextBoat({ ghosts: all, meters: target, t, mine: myM, speed, near, water, racing: rivals.current.filter((x) => x !== idle).map((x) => x.g), want: 0, others: true });
          if (next && next.cross < 60) {
            swappedAt.current = now;
            strokes.current.delete(idle.g.id);
            idle.g = next.g;
            idle.born = next.on ? now : 0;
          }
        }
      }
    }
    while (rivals.current.length < RIVALS) {
      const next = nextBoat({ ghosts: all, meters: target, t, mine: myM, speed, near, water, racing: rivals.current.map((x) => x.g), want: 0 });
      if (!next) break;
      add(next.g, next.on && t > 1 ? now : 0);
    }
  }

  /* WHO IS BESIDE THE ROWER. Of the two on a side, the nearer over the
   * next half minute, the rower carried on at their average; a trade
   * waits until it is nearer by three meters and the two are a boat's
   * length apart along the water. */
  const soon = (g: Ghost): number => [0, 10, 20, 30].reduce((sum, a) => sum + Math.abs(gapOf(g, t + a, myM + a * speed)), 0) / 4;
  for (const s of [-1, 1] as const) {
    const two = rivals.current.filter((r) => r.side === s);
    if (two.length < 2) {
      if (two[0]) two[0].lane += (MID + s - two[0].lane) * Math.min(1, dt * 2.4);
      continue;
    }
    /* Which of the two has the lane beside the rower now. */
    let [inner, outer] = [...two].sort((a, b) => Math.abs(a.lane - MID) - Math.abs(b.lane - MID));
    if (soon(outer.g) + 3 < soon(inner.g) && Math.abs(gapOf(inner.g) - gapOf(outer.g)) >= BOAT_M * 1.15) [inner, outer] = [outer, inner];
    const step = Math.min(1, dt * 2.4);
    inner.lane += (MID + s - inner.lane) * step;
    outer.lane += (MID + 2 * s - outer.lane) * step;
    /* Arrived: on the lane, so the next look reads whole numbers. */
    if (Math.abs(inner.lane - (MID + s)) < 0.01) inner.lane = MID + s;
    if (Math.abs(outer.lane - (MID + 2 * s)) < 0.01) outer.lane = MID + 2 * s;
  }

  /* The strokes: each boat's place in its own, and the puddles its blades
   * left on the water where they came out. */
  const reach = Math.max(8, Math.min(1.9 * u, pitch * 0.46 - Math.max(4.5, 0.8 * u)));
  const tipM = (0.15 * u + reach * Math.sin(-0.62)) / u;
  const pull = (id: string, spm: number, lane: number, wm: number): Stroke => {
    let s = strokes.current.get(id);
    if (!s) {
      s = { phase: phaseOf(id), puddles: [], tint: 0 };
      strokes.current.set(id, s);
    }
    const before = s.phase;
    /* The oars keep to a pace an eye can follow, however fast a demo runs. */
    s.phase = (before + (dt * Math.min(rate.current, 2.5) * spm) / 60) % 1;
    if (spm > 0 && before < DRIVE && (s.phase >= DRIVE || s.phase < before)) s.puddles.push({ wm: wm + tipM, lane, born: now });
    s.puddles = s.puddles.filter((p) => now - p.born < PUDDLE_S * 1000);
    return s;
  };
  /* THE ROWER'S OWN OARS ARE THE ROWER'S OWN STROKE (owner, 2026-11-22:
   * "if we're gonna have a rowing animation, it needs to match with the
   * stroke that I'm pulling"). The monitor says when the handle goes on
   * the drive and when it comes off; the blades go in and come out on
   * those two words, and between them the oar is carried through at the
   * length the last stroke's drive and way back took. It waits at the
   * catch for the next pull, however long that is. */
  let mine = strokes.current.get("me");
  if (!mine) {
    mine = { phase: 0, puddles: [], tint: 0 };
    strokes.current.set("me", mine);
  }
  if (live.driving !== pulling.current.on) {
    if (pulling.current.on && moving) mine.puddles.push({ wm: myM + tipM, lane: MID, born: now });
    pulling.current = { on: live.driving, at: now };
  }
  const held = ((now - pulling.current.at) / 1000) * rate.current;
  mine.phase = live.driving ? Math.min(0.999, held / (live.driveS > 0 ? live.driveS : 0.8)) * DRIVE : DRIVE + Math.min(0.999, held / (live.recoveryS > 0 ? live.recoveryS : 1.6)) * (1 - DRIVE);
  mine.puddles = mine.puddles.filter((p) => now - p.born < PUDDLE_S * 1000);
  const myBoat = boat(xMe, yOf(MID), u, pitch, mine.phase, pt);
  /* What the rower has done over the last 100 m against the 100 m before
   * it, eased so the water does not flicker. */
  const tintStep = Math.min(1, dt * 1.5);
  const sinceAt = (m: number): number | null => {
    const p = path.current;
    if (p.length < 2 || m < p[0].m) return null;
    for (let i = p.length - 1; i > 0; i--) {
      if (p[i - 1].m > m) continue;
      const [a, b] = [p[i - 1], p[i]];
      return b.m > a.m ? a.t + ((m - a.m) / (b.m - a.m)) * (b.t - a.t) : b.t;
    }
    return null;
  };
  const head = path.current[path.current.length - 1];
  const lap1 = head ? sinceAt(head.m - 100) : null;
  const lap2 = head ? sinceAt(head.m - 200) : null;
  const myTrend = moving && head && lap1 !== null && lap2 !== null ? trendOf(lap1 - lap2, head.t - lap1) : 0;
  mine.tint += (myTrend - mine.tint) * tintStep;

  const others = rivals.current.map((r) => {
    const d = gapOf(r.g);
    const done = ghostDone(r.g, t);
    const y = yOf(r.lane);
    const s = pull(r.g.id, done || t <= 0 ? 0 : r.g.spm > 0 ? r.g.spm : 24, r.lane, myM + d);
    s.tint += (ghostTrend(r.g, target, t) - s.tint) * tintStep;
    /* Its average split so far, as the rower's own figure is; the whole
     * row's before it has gone anywhere. */
    const gone = myM + d;
    const pace = t > 0 && gone > 20 ? (Math.min(ghostClock(r.g, t), r.g.seconds) / gone) * 500 : (r.g.seconds / target) * 500;
    return { r, g: r.g, d, y, s, on: inView(d), rise: r.born ? Math.min(1, (now - r.born) / RISE_MS) : 1, lead: leadSeconds(r.g, target, t, myM), pace, x: xOf(gone), shape: boat(xOf(gone), y, u, pitch, s.phase, pt) };
  });
  const racing = new Set(rivals.current.map((r) => r.g.id));

  /* THE ROWER'S BEST, in the rower's own lane while it is on the water.
   * Once it has finished it is waiting on the line, which comes onto the
   * water however far behind it the rower is: it is shown there only when
   * the two finishes are within eight seconds, which is a race. */
  let pb: { x: number; lead: number; rise: number; shape: ReturnType<typeof boat> } | null = null;
  if (best && t > 0) {
    const d = gapOf(best);
    const lead = leadSeconds(best, target, t, myM);
    if (inView(d) && (!ghostDone(best, t) || Math.abs(lead) <= 8)) {
      if (drive && !bestBorn.current) bestBorn.current = t > 3 ? now : 1;
      const s = pull(best.id, ghostDone(best, t) ? 0 : best.spm > 0 ? best.spm : 24, MID, myM + d);
      pb = { x: xOf(myM + d), lead, rise: Math.min(1, (now - (bestBorn.current || 1)) / RISE_MS), shape: boat(xOf(myM + d), yOf(MID), u, pitch, s.phase, pt) };
    } else if (drive) bestBorn.current = 0;
  }
  /* THE WATER BEHIND EACH BOAT: its lane from the edge behind the rower to
   * its stern. */
  const stern = (BOAT_M * u) / 2 + 7;
  const wakes = [{ id: "me", x: xMe - stern, lane: MID, tint: mine.tint, rise: 1 }, ...others.map((o) => ({ id: o.g.id, x: o.x - stern, lane: o.r.lane, tint: o.s.tint, rise: o.rise }))].filter((w) => w.x > 4 && Math.abs(w.tint) > 0.04);

  /* THE WATER: the lanes ruled off, a tick every 10 m along both edges, a
   * line and its figure every 100 m, the start and the finish. */
  const fromM = myM - xMe / u;
  const toM = fromM + course / u;
  let ticks = "";
  for (let m = Math.ceil(fromM / 10) * 10; m <= toM; m += 10) {
    if (m < 0 || m > target) continue;
    ticks += up ? `M${n1(GUT)} ${n1(waterH - xOf(m))} h5 M${n1(W)} ${n1(waterH - xOf(m))} h-5` : `M${n1(xOf(m))} 0 v5 M${n1(xOf(m))} ${n1(waterH)} v-5`;
  }
  const hundreds: number[] = [];
  for (let m = Math.ceil(fromM / 100) * 100; m <= toM; m += 100) if (m > 0 && m < target) hundreds.push(m);
  let ropes = "";
  for (let l = 1; l < LANES; l++) ropes += up ? `M${n1(GUT + l * pitch)} 0 V${n1(waterH)}` : `M0 ${n1(l * pitch)} H${n1(W)}`;

  /* THE REST OF THE FIELD: a dot for every other row that is within the
   * water right now, each in a place of its own across it. */
  const fish: { id: string; x: number; y: number; mine: boolean }[] = [];
  for (const g of all) {
    if (racing.has(g.id) || fish.length >= 70) continue;
    const d = gapOf(g);
    if (!inView(d)) continue;
    const [x, y] = pt(xOf(myM + d), GUT + 6 + phaseOf(`${g.id}y`) * ((up ? W - GUT : waterH) - 12));
    fish.push({ id: g.id, x, y, mine: g.kind === "me" });
  }
  const puddles = [{ id: "me", s: mine, me: true }, ...others.map((o) => ({ id: o.g.id, s: o.s, me: false }))].flatMap(({ id, s, me }) =>
    s.puddles.flatMap((p) => {
      const age = (now - p.born) / 1000 / PUDDLE_S;
      const a = xOf(p.wm);
      if (a < -12 || a > course + 12) return [];
      return [-1, 1].map((side) => {
        const [x, y] = pt(a, yOf(p.lane) + side * myBoat.tipDy);
        return { key: `${id}:${p.born}:${side}`, x, y, r: 1.2 + age * 3.6, o: (1 - age) * (me ? 0.8 : 0.4), me };
      });
    }),
  );

  /* How much of their red the ropes have: none while the finish this row
   * is headed for is 2.5% of the rower's best behind it, or worse, and all
   * of it on pace to beat it. Nothing before the row has a finish. */
  const heat = best && proj > 0 ? clamp(1 - (proj - best.seconds) / Math.max(6, best.seconds * BEST_SHARE), 0, 1) : 0;
  const clock = (s: number) => fmtClock(s, false);
  const finish = live.ended ? clock(live.elapsedS) : ms ? clock(ms.projected) : "--:--";
  /* Three figures across: six characters of the black face run about four
   * times the type size wide, and each has a third of the width. */
  const fig = Math.min(40, Math.floor((width - PAD * 2) / 3 / 4.15));

  /* WHAT A LANE SAYS. Whose: a pace boat by its finish, a past row of the
   * rower's own by the rower's name, anybody else by theirs. And under
   * that, small: TELEMETRY when the monitor recorded the row, and nothing
   * when it did not. No dates. */
  const who = (g: Ghost) => (g.kind === "pace" ? clock(g.seconds) : g.kind === "me" ? myName : g.name).toUpperCase();
  const how = (g: Ghost) => (g.kind === "pace" ? "PACE BOAT" : g.kind === "live" ? "LIVE" : [g.kind === "race" ? "RACE DAY" : "", g.marks.length >= 2 ? "TELEMETRY" : ""].filter(Boolean).join(" · "));
  /* The name over the small line wherever a lane is tall enough for the
   * two, which upright is always ("the name in bold, and then on the second
   * line ... telemetry"). */
  const stacked = !wide || pitch >= 46;
  const nameSize = Math.round(wide ? (stacked ? clamp(pitch * 0.4, 16, 24) : clamp(pitch * 0.6, 15, 24)) : clamp(pitch * 0.25, 16, 22));
  const nameLine = Math.round(nameSize * 1.14);
  const tagSize = wide && !stacked ? 9 : 10;
  const tagLine = tagSize + 4;
  const paceSize = Math.round(wide ? clamp(pitch * 0.5, 13, 20) : clamp(pitch * 0.2, 14, 20));
  const paceLine = Math.round(paceSize * 1.14);
  const paceW = paceSize * 3.9;
  const bow = (BOAT_M * u) / 2 + 12;
  const paint = (size: number, line: number) => ({ fontFamily: F.black, fontSize: size, lineHeight: line, letterSpacing: 0.8, fontVariant: ["tabular-nums" as const] });
  /* The top of a lane's words: across the middle of the lane on its side
   * (the small line after the name there, not under it, so the name can be
   * as tall as the lane allows), along its top upright. */
  const wordsTop = (lane: number, h: number) => lane * pitch + (wide ? (pitch - h) / 2 : 5);
  /* The split painted ahead of a bow, when there is water for it short of
   * the seconds at the lane's end. */
  const paceFits = (x: number) => x + bow > 0 && (wide ? x + bow + paceW < W - gapW - 14 : x + bow < W);
  const note = !ready ? "Finding the field" : failed ? "The field did not load" : "";

  /* What both pages draw alike: the dots, the puddles and the boats, which
   * are already where `pt` put them; and the three figures. */
  const craft: ReactNode = (
    <>
      {fish.map((f) => (
        <Circle key={f.id} cx={f.x} cy={f.y} r={1.7} fill={f.mine ? C.gray : C.ink} fillOpacity={f.mine ? 0.55 : 0.6} />
      ))}
      {puddles.map((p) => (
        <Circle key={p.key} cx={p.x} cy={p.y} r={p.r} stroke={p.me ? C.accent : C.gray} strokeWidth={1} strokeOpacity={p.o} fill="none" />
      ))}
      {others.map(({ g, shape, rise }) => (
        <Path key={`l${g.id}`} d={shape.lines} stroke={C.ink} strokeWidth={1.2} strokeOpacity={rise} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {others.map(({ g, shape, rise }) => (
        <Path key={`b${g.id}`} d={shape.blades} stroke={C.ink} strokeWidth={shape.wet ? 2.6 : 1.4} strokeOpacity={rise} fill="none" strokeLinecap="round" />
      ))}
      {pb ? (
        <>
          <Path d={pb.shape.lines} stroke={BEST} strokeWidth={1.5} strokeOpacity={pb.rise} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Path d={pb.shape.blades} stroke={BEST} strokeWidth={pb.shape.wet ? 2.8 : 1.5} strokeOpacity={pb.rise} fill="none" strokeLinecap="round" />
        </>
      ) : null}
      <Path d={myBoat.lines} stroke={C.accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={myBoat.blades} stroke={C.accent} strokeWidth={myBoat.wet ? 3.4 : 1.8} fill="none" strokeLinecap="round" />
    </>
  );
  const foot: ReactNode = (
    <View style={{ height: FOOT + 4, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: PAD }}>
      <View style={{ flex: 1 }}>
        <Eyebrow>Meters to go</Eyebrow>
        <Num size={fig}>{fmtInt(Math.max(0, Math.ceil(target - live.meters)))}</Num>
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Eyebrow>Time</Eyebrow>
        <Num size={fig}>{fmtClock(live.elapsedS, false)}</Num>
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Eyebrow>Finish</Eyebrow>
        <Num size={fig}>{finish}</Num>
      </View>
    </View>
  );

  /* THE COURSE UP THE PAGE. */
  if (up) {
    const laneX = (lane: number) => GUT + lane * pitch;
    const sy = (a: number) => waterH - a;
    const upName = 17;
    const upNameLine = 20;
    const upPace = 14;
    const upPaceLine = 17;
    /* How far up a lane its name may run: to a little past the rower. */
    const run = Math.min(waterH - gapLine - 40, xMe + 60);
    /* A line of paint up a lane, read from the bottom of the water toward
     * the top, as a name is on a track: a box as long as the run and one
     * line high, turned a quarter about its middle. */
    const upLane = (key: string, lane: number, opacity: number, children: ReactNode) => (
      <View key={key} pointerEvents="none" style={{ position: "absolute", left: laneX(lane) + 4 + upNameLine / 2 - run / 2, top: waterH - 8 - run / 2 - upNameLine / 2, width: run, height: upNameLine, flexDirection: "row", alignItems: "baseline", columnGap: 8, opacity, transform: [{ rotate: "-90deg" }] }}>
        {children}
      </View>
    );
    const small = { fontFamily: F.monoBold, fontSize: 10, letterSpacing: 0 } as const;
    /* The split over a bow, when it is clear of what is across the top of
     * its lane. */
    const paceTop = (x: number) => sy(x) - bow - upPaceLine + 6;
    return (
      <View style={{ width, height }}>
        <View style={{ height: TOP }} />
        <View style={{ width: W, height: waterH, overflow: "hidden", borderTopWidth: heat > 0.4 ? 2 : 1, borderBottomWidth: heat > 0.4 ? 2 : 1, borderColor: heat > 0.4 ? BEST : C.ink }}>
          {/* The meters, in the margin down the left. */}
          {hundreds.map((m) => (
            <Text key={m} numberOfLines={1} style={{ position: "absolute", left: 0, width: GUT - 4, textAlign: "right", top: sy(xOf(m)) - 19, fontFamily: F.monoBold, fontSize: 14, lineHeight: 18, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {fmtInt(m)}
            </Text>
          ))}
          {sy(xOf(target)) > -4 && sy(xOf(target)) < waterH + 20 ? <Text numberOfLines={1} style={{ position: "absolute", left: 0, width: GUT - 4, textAlign: "right", top: sy(xOf(target)) - 21, fontFamily: F.monoBold, fontSize: 11, lineHeight: 16, color: C.ink }}>FINISH</Text> : null}
          {note ? <Eyebrow style={{ position: "absolute", left: GUT, right: 0, top: waterH * 0.3, textAlign: "center" }}>{note}</Eyebrow> : null}

          {/* PAINTED UP THE LANES, under the boats: whose lane it is. */}
          {upLane("wme", MID, 1, <Text numberOfLines={1} style={[paint(upName, upNameLine), { color: C.accent, flexShrink: 1 }]}>{myName}</Text>)}
          {others.map(({ g, r, rise, on, x }) => {
            const tag = how(g);
            const nameW = 8 + who(g).length * upName * 0.74;
            const under = on && x - bow < nameW;
            return upLane(
              `w${g.id}`,
              r.lane,
              rise,
              <>
                <Text numberOfLines={1} style={[paint(upName, upNameLine), { color: g.kind === "live" ? C.good : C.ink, opacity: under ? (g.kind === "live" ? 0.4 : 0.16) : g.kind === "live" ? 0.95 : 0.6, flexShrink: 1 }]}>{who(g)}</Text>
                {tag && (!under || g.kind === "live") ? <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: g.kind === "live" ? 12 : 10, letterSpacing: 1.2, color: g.kind === "live" ? C.good : C.gray }}>{tag}</Text> : null}
              </>,
            );
          })}

          {/* Across the top of each lane: the seconds that boat is ahead
              of the rower, or behind. */}
          {t > 0
            ? others.map(({ g, r, d, on, lead, rise }) => (
                <Text key={`s${g.id}`} numberOfLines={1} style={[paint(gapSize, gapLine), { position: "absolute", left: laneX(r.lane), width: pitch, top: 5, textAlign: "center", color: g.kind === "live" ? C.good : C.ink, opacity: rise, letterSpacing: 0 }]}>
                  {!on && d < 0 ? <Text style={{ fontSize: 11, color: C.gray }}>▾</Text> : null}
                  {gapWord(lead)}
                  <Text style={small}> S</Text>
                  {!on && d > 0 ? <Text style={{ fontSize: 11, color: C.gray }}>▴</Text> : null}
                </Text>
              ))
            : null}
          {pb ? (
            <View pointerEvents="none" style={{ position: "absolute", left: laneX(MID), width: pitch, top: 5, alignItems: "center", opacity: pb.rise }}>
              <Text numberOfLines={1} style={[paint(gapSize, gapLine), { color: BEST, letterSpacing: 0 }]}>
                {gapWord(pb.lead)}
                <Text style={small}> S</Text>
              </Text>
              <Text style={{ fontFamily: F.monoBold, fontSize: 11, lineHeight: 13, letterSpacing: 1.2, color: BEST }}>BEST</Text>
            </View>
          ) : null}

          {/* Over each bow: that boat's average split so far. The rower's
              own is in the full ink, the others' in half of it. */}
          {live.avgPace > 0 && paceTop(xMe) > gapLine + 26 ? (
            <Text numberOfLines={1} style={[paint(upPace, upPaceLine), { position: "absolute", left: laneX(MID), width: pitch, top: paceTop(xMe), textAlign: "center", letterSpacing: 0, color: C.ink }]}>{fmtPace(live.avgPace)}</Text>
          ) : null}
          {others.map(({ g, r, on, x, pace, rise }) =>
            on && paceTop(x) > gapLine + 8 ? (
              <Text key={`p${g.id}`} numberOfLines={1} style={[paint(upPace, upPaceLine), { position: "absolute", left: laneX(r.lane), width: pitch, top: paceTop(x), textAlign: "center", letterSpacing: 0, color: C.ink, opacity: 0.55 * rise }]}>
                {fmtPace(pace)}
              </Text>
            ) : null,
          )}

          <Svg width={W} height={waterH} style={{ position: "absolute", left: 0, top: 0 }}>
            <Defs>
              <LinearGradient id="raceWakeUpV" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={C.good} stopOpacity={1} />
                <Stop offset="1" stopColor={C.good} stopOpacity={0.1} />
              </LinearGradient>
              <LinearGradient id="raceWakeDownV" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={BEST} stopOpacity={1} />
                <Stop offset="1" stopColor={BEST} stopOpacity={0.1} />
              </LinearGradient>
            </Defs>
            {wakes.map((w) => (
              <Rect key={`k${w.id}`} x={laneX(w.lane) + 1.5} y={sy(w.x)} width={pitch - 3} height={w.x} fill={w.tint > 0 ? "url(#raceWakeUpV)" : "url(#raceWakeDownV)"} fillOpacity={Math.abs(w.tint) * WAKE * w.rise} />
            ))}
            <Line x1={GUT} y1={0} x2={GUT} y2={waterH} stroke={C.ink} strokeWidth={1} />
            <Path d={ropes} stroke={C.line} strokeWidth={1} fill="none" />
            {heat > 0 ? <Path d={ropes} stroke={BEST} strokeWidth={1 + 2 * heat} strokeOpacity={0.3 + 0.6 * heat} fill="none" /> : null}
            <Path d={ticks} stroke={C.gray} strokeWidth={1} fill="none" />
            {hundreds.map((m) => (
              <Line key={m} x1={GUT - 8} y1={sy(xOf(m))} x2={W} y2={sy(xOf(m))} stroke={C.line} strokeWidth={1} strokeDasharray="2 5" />
            ))}
            {sy(xOf(0)) > -4 && sy(xOf(0)) < waterH + 4 ? <Line x1={GUT} y1={sy(xOf(0))} x2={W} y2={sy(xOf(0))} stroke={C.ink} strokeWidth={1} /> : null}
            {sy(xOf(target)) > -6 && sy(xOf(target)) < waterH + 6 ? (
              <>
                <Line x1={GUT} y1={sy(xOf(target))} x2={W} y2={sy(xOf(target))} stroke={C.ink} strokeWidth={1.5} />
                <Line x1={GUT} y1={sy(xOf(target)) - 4} x2={W} y2={sy(xOf(target)) - 4} stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 5" />
              </>
            ) : null}
            {craft}
          </Svg>
        </View>
        {foot}
      </View>
    );
  }

  return (
    <View style={{ width, height }}>
      <View style={{ height: TOP }} />

      {/* The meters along the course, over the water. */}
      <View style={{ height: RULE, overflow: "hidden" }}>
        {hundreds.map((m) => (
          <Text key={m} style={{ position: "absolute", left: xOf(m) + 5, bottom: 0, fontFamily: F.monoBold, fontSize: wide ? 15 : 16, lineHeight: 20, color: C.ink, fontVariant: ["tabular-nums"] }}>
            {fmtInt(m)}
          </Text>
        ))}
        {xOf(target) > 0 && xOf(target) < W + 70 ? <Text style={{ position: "absolute", left: xOf(target) - 72, bottom: 0, fontFamily: F.monoBold, fontSize: wide ? 15 : 16, lineHeight: 20, letterSpacing: 0.6, color: C.ink }}>FINISH</Text> : null}
      </View>

      <View style={{ width: W, height: waterH, overflow: "hidden", borderTopWidth: heat > 0.4 ? 2 : 1, borderBottomWidth: heat > 0.4 ? 2 : 1, borderColor: heat > 0.4 ? BEST : C.ink }}>
        {/* PAINTED ON THE LANES, under the boats: whose lane, how many
            seconds that boat is ahead or behind, and its split ahead of
            its bow. */}
        {note ? <Eyebrow style={{ position: "absolute", left: 0, right: 0, top: wordsTop(MID - 1, 14), textAlign: "center" }}>{note}</Eyebrow> : null}
        <Text numberOfLines={1} style={[paint(nameSize, nameLine), { position: "absolute", left: 10, right: gapW + (stacked ? 18 : 64), top: wordsTop(MID, nameLine), color: C.accent }]}>
          {myName}
        </Text>
        {/* The rower's best, while it is on their water: the seconds
            between the two, in its red. */}
        {pb ? (
          <View pointerEvents="none" style={{ position: "absolute", right: 10, top: wordsTop(MID, stacked ? gapLine + tagLine : gapLine), opacity: pb.rise, alignItems: "flex-end" }}>
            <Text numberOfLines={1} style={[paint(gapSize, gapLine), { color: BEST, letterSpacing: 0 }]}>
              {stacked ? null : <Text style={{ fontFamily: F.monoBold, fontSize: Math.round(gapSize * 0.48), letterSpacing: 1 }}>BEST </Text>}
              {gapWord(pb.lead)}
              <Text style={{ fontFamily: F.monoBold, fontSize: Math.round(gapSize * 0.48), letterSpacing: 0 }}> S</Text>
            </Text>
            {stacked ? <Text style={{ fontFamily: F.monoBold, fontSize: tagSize + 2, lineHeight: tagLine, letterSpacing: 1.2, color: BEST }}>YOUR BEST</Text> : null}
          </View>
        ) : null}
        {others.map(({ g, r, rise, on, x }) => {
          const tag = how(g);
          /* On its side the boat rows over the name: the paint goes faint
           * under it, and the small line steps aside, so the boat and its
           * split are what is read there. */
          const nameW = 16 + who(g).length * nameSize * 0.74;
          const under = wide && on && x - bow < nameW;
          const overTag = wide && on && x - bow < (stacked ? 16 : nameW + 14) + tag.length * tagSize * 0.8;
          return (
            <View key={`w${g.id}`} pointerEvents="none" style={[{ position: "absolute", left: 10, right: gapW + 18, top: wordsTop(r.lane, stacked ? nameLine + (tag ? tagLine : 0) : nameLine), opacity: rise }, stacked ? null : { flexDirection: "row", alignItems: "baseline", columnGap: 10 }]}>
              <Text numberOfLines={1} style={[paint(nameSize, nameLine), { color: g.kind === "live" ? C.good : C.ink, opacity: under ? (g.kind === "live" ? 0.4 : 0.16) : g.kind === "live" ? 0.95 : 0.6, flexShrink: 1 }]}>
                {who(g)}
              </Text>
              {/* A rower on the water this minute is in the green the
                  monitor's own LIVE is in, and says so whatever is rowing
                  over the lane. */}
              {tag && (!overTag || g.kind === "live") ? (
                <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: g.kind === "live" ? tagSize + 2 : tagSize, lineHeight: tagLine, letterSpacing: 1.2, color: g.kind === "live" ? C.good : C.gray }}>
                  {tag}
                </Text>
              ) : null}
            </View>
          );
        })}
        {t > 0
          ? others.map(({ g, r, d, on, lead, rise }) => (
              <Text key={`s${g.id}`} numberOfLines={1} style={[paint(gapSize, gapLine), { position: "absolute", right: 10, top: wordsTop(r.lane, gapLine), color: C.ink, opacity: rise, letterSpacing: 0 }]}>
                {/* A boat off the water in the last strokes, where no lane
                    changes hands: which way it is. */}
                {!on && d < 0 ? <Text style={{ fontSize: Math.round(gapSize * 0.6), color: C.gray }}>◂ </Text> : null}
                {gapWord(lead)}
                <Text style={{ fontFamily: F.monoBold, fontSize: Math.round(gapSize * 0.48), letterSpacing: 0 }}> S</Text>
                {!on && d > 0 ? <Text style={{ fontSize: Math.round(gapSize * 0.6), color: C.gray }}> ▸</Text> : null}
              </Text>
            ))
          : null}
        {/* The rower's own average ahead of their own bow, as every other
            boat has its, and in the full ink where the others are half of
            it (owner, 2026-11-22: "I want my average pace to be in front of
            my boat, just like the other boats ... the same amount of
            boldness, but more dark ... the other ones are kind of like in
            the background"). */}
        {live.avgPace > 0 && paceFits(xMe) ? (
          <Text numberOfLines={1} style={[paint(paceSize, paceLine), { position: "absolute", left: xMe + bow, top: yOf(MID) - paceLine / 2, color: C.ink }]}>
            {fmtPace(live.avgPace)}
          </Text>
        ) : null}
        {others.map(({ g, on, x, y, pace, rise }) =>
          on && paceFits(x) ? (
            <Text key={`p${g.id}`} numberOfLines={1} style={[paint(paceSize, paceLine), { position: "absolute", left: x + bow, top: y - paceLine / 2, color: C.ink, opacity: 0.5 * rise }]}>
              {fmtPace(pace)}
            </Text>
          ) : null,
        )}

        <Svg width={W} height={waterH} style={{ position: "absolute", left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id="raceWakeUp" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={C.good} stopOpacity={0.1} />
              <Stop offset="1" stopColor={C.good} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="raceWakeDown" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={BEST} stopOpacity={0.1} />
              <Stop offset="1" stopColor={BEST} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          {wakes.map((w) => (
            <Rect key={`k${w.id}`} x={0} y={w.lane * pitch + 1.5} width={w.x} height={pitch - 3} fill={w.tint > 0 ? "url(#raceWakeUp)" : "url(#raceWakeDown)"} fillOpacity={Math.abs(w.tint) * WAKE * w.rise} />
          ))}
          <Path d={ropes} stroke={C.line} strokeWidth={1} fill="none" />
          {heat > 0 ? <Path d={ropes} stroke={BEST} strokeWidth={1 + 2 * heat} strokeOpacity={0.3 + 0.6 * heat} fill="none" /> : null}
          <Path d={ticks} stroke={C.gray} strokeWidth={1} fill="none" />
          {hundreds.map((m) => (
            <Line key={m} x1={xOf(m)} y1={0} x2={xOf(m)} y2={waterH} stroke={C.line} strokeWidth={1} strokeDasharray="2 5" />
          ))}
          {xOf(0) > -4 && xOf(0) < W + 4 ? <Line x1={xOf(0)} y1={0} x2={xOf(0)} y2={waterH} stroke={C.ink} strokeWidth={1} /> : null}
          {xOf(target) > -6 && xOf(target) < W + 6 ? (
            <>
              <Line x1={xOf(target)} y1={0} x2={xOf(target)} y2={waterH} stroke={C.ink} strokeWidth={1.5} />
              <Line x1={xOf(target) + 4} y1={0} x2={xOf(target) + 4} y2={waterH} stroke={C.ink} strokeWidth={1.5} strokeDasharray="5 5" />
            </>
          ) : null}
          {craft}
        </Svg>
      </View>

      {foot}
    </View>
  );
}
