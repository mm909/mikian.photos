import { useRef, type ReactElement, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { DOT_ON, FlipDots, dotClock } from "../arcade/Art159";
import { useWallClock } from "../arcade/BoatArt";
import { Board, ZONES, boardOf, pieceAt, sOf, zoneOf, type Piece } from "../arcade/Board";
import { ChestOpen } from "../arcade/Chest";
import { MonsterG } from "../arcade/Monster";
import { useBoat } from "../arcade/boat";
import { useLocker } from "../arcade/locker";
import { FILL_S, type MShot } from "../arcade/match";
import { KIT, SKILL_COLOR, TARGET, easeOf, skillAt, type SkillView } from "../arcade/pve";
import { useRun } from "../arcade/run";
import { useProgress } from "../arcade/progress";
import { useRating } from "../arcade/rating";
import { levelOf } from "../arcade/score";
import { INTRO_M, READY_S, type ShowView } from "../arcade/show";
import { SKIN_BY_ID, STOCK, wear } from "../arcade/skins";
import { TOKEN_U, TokenArt, ShotArt, star, type Paint } from "../arcade/Token";
import type { Showed } from "../arcade/useShow";
import { milestone } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import { useSession } from "../session";
import { C, F, fmtClock, fmtInt, fmtPace } from "../theme";
import { Eyebrow, Num } from "../ui";
import { BEST } from "./GhostRace";

/* THE SHOW ON THE MONITOR (owner, 2026-11-24, 3 AM: "for a 5K, we get to
 * run like a 20-minute television show", now by the clock; arcade/show.ts
 * is the running order, this is how it looks). OWNER ONLY.
 *
 *   on the produced page   the show is the page (ShowPage): the figures
 *                          across the top, the show under them, from the
 *                          intro to the last chest;
 *   on any other page      the ready check, the match and its celebration
 *                          are laid over the page (ShowOverlay), with the
 *                          same figures; the intro and home stay on the
 *                          produced page. Never on the last page, and not
 *                          once the row has stopped (RowScreen.tsx).
 *
 * THE FIGURES ALWAYS SHOW, "moved around the screen like a newscast's
 * headline, not hidden": the meters (to go, on a set piece), the pace of
 * this stroke, the finish the rower is on for, and the average.
 *
 * READ FROM THE SEAT, three to six feet away (2026-11-22): every word the
 * show says is in the black face and big, and nothing has to be read to
 * play: the pace is the only control.
 *
 * Drawn thirty times a second off the wall's clock, from the view the
 * show hands over in a ref (arcade/useShow.ts). The show's seconds are the
 * row's own; between the monitor's words they are carried on at the rate
 * the row's clock runs (ten times a clock on a demo at ten). */

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (x: number) => 1 - (1 - clamp(x)) ** 3;
const pop = (x: number) => {
  const v = clamp(x);
  return 1 + 2.2 * (v - 1) ** 3 + 1.2 * (v - 1) ** 2;
};
const clockS = (s: number) => fmtClock(Math.max(0, s), false);
/* "1:59" for a whole-second pace. */
const whole = (p: number) => dotClock(p);
/* A pace in tenths, or "-:--.-". */
const tenthsWord = (p: number | undefined) => (p && Number.isFinite(p) && p < 600 ? fmtClock(p) : "-:--.-");

/* THE EDITION'S NAME for the title card (CLAUDE.md: "September is Rowtember
 * and November is Rowvember"). */
export function editionWord(d = new Date()): string {
  return d.getMonth() === 10 ? "ROWVEMBER" : "ROWTEMBER";
}

/* ---- the row's clock, carried on between the monitor's words ---------- */

/* SMOOTH (owner, 2026-11-24, of the swarm: "The boat and the timer jitter
 * (the timer jumps 13, 12, 12, 11); it looks laggy"): the monitor's words
 * come when they come, so the clock the drawing runs on is carried on at
 * the row's rate by the wall and eased toward each word, never backwards;
 * a big jump (a demo scrubbed) is taken at once. */
function useRowClock(v: ShowView | null, wall: number): number {
  const at = useRef({ t: -1, wall: 0 });
  const sm = useRef({ disp: -1, wall: 0 });
  if (!v) return 0;
  if (v.t !== at.current.t) at.current = { t: v.t, wall };
  const since = Math.max(0, wall - at.current.wall);
  const still = v.phase === "chest" || v.phase === "done" || v.phase === "summary";
  const want = still ? v.t : v.t + Math.min(1.5, since) * v.rate;
  const S = sm.current;
  const dt = clamp(wall - S.wall, 0, 0.25);
  S.wall = wall;
  if (S.disp < 0 || still || Math.abs(want - S.disp) > 4 * Math.max(1, v.rate)) S.disp = want;
  else {
    const next = S.disp + dt * v.rate;
    S.disp = Math.max(S.disp, next + (want - next) * 0.12);
  }
  return S.disp;
}

/* The rower's piece hops on each catch: off the monitor's own stroke on a
 * real erg, at a steady 26 by the wall on a demo (whose strokes no eye
 * follows). */
function useHop(erg: Erg, wall: number): number {
  const s = useRef({ was: false, at: 0 });
  if (erg.demo) {
    const q = ((wall * 26) / 60) % 1;
    return q < 0.3 ? Math.sin((q / 0.3) * Math.PI) : 0;
  }
  if (erg.live.driving && !s.current.was) s.current.at = wall;
  s.current.was = erg.live.driving;
  const e = wall - s.current.at;
  return e >= 0 && e < 0.4 ? Math.sin((e / 0.4) * Math.PI) : 0;
}
const botHop = (id: string, rt: number): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  const q = ((rt * 27) / 60 + h / 997) % 1;
  return q < 0.3 ? Math.sin((q / 0.3) * Math.PI) * 0.8 : 0;
};

/* ---- the figures that always show --------------------------------------- */

function figures(erg: Erg): [string, string, string][] {
  const { live } = erg;
  const ms = milestone(live);
  const target = live.targetM;
  /* TWO, AND BIG (owner, 2026-11-24, from the seat: of the numbers on the
   * left he needs "current pace", which decides what fires, and "expected
   * finish time", which no Concept2 screen shows; the meters to go and the
   * average are on the monitor, and the average's blue goes). */
  return [
    ["Pace", live.pace > 0 && live.pace < 600 ? fmtClock(live.pace) : "-:--.-", C.ink],
    ["Finish", live.ended ? clockS(live.elapsedS) : ms ? clockS(ms.projected) : target > 0 ? "--:--" : clockS(live.elapsedS), C.ink],
  ];
}

/* The figures down the side (on its side) or across the top (upright). */
function Headline({ erg, width, height, wide }: { erg: Erg; width: number; height: number; wide: boolean }) {
  const figs = figures(erg);
  if (wide) {
    const size = Math.max(26, Math.min(64, Math.floor((height - 40) / 2 / 1.5), Math.floor((width - 24) / 4.1)));
    return (
      <View style={{ width, height, paddingLeft: 14, paddingRight: 8, justifyContent: "center", rowGap: 10 }}>
        {figs.map(([k, v, c]) => (
          <View key={k}>
            <Eyebrow>{k}</Eyebrow>
            <Num size={size} color={c}>
              {v}
            </Num>
          </View>
        ))}
      </View>
    );
  }
  const size = Math.max(26, Math.min(44, Math.floor((width - 40) / 2 / 4.1)));
  return (
    <View style={{ width, height, flexDirection: "row", paddingHorizontal: 18, borderBottomWidth: 1, borderColor: C.line }}>
      {figs.map(([k, v, c], i) => (
        <View key={k} style={{ width: "50%", alignItems: i % 2 ? "flex-end" : "flex-start", paddingTop: 2 }}>
          <Eyebrow>{k}</Eyebrow>
          <Num size={size} color={c}>
            {v}
          </Num>
        </View>
      ))}
    </View>
  );
}
const stripOf = (width: number) => {
  const size = Math.max(26, Math.min(44, Math.floor((width - 40) / 2 / 4.1)));
  return Math.round(size * 1.12) + 24;
};

/* The page or the overlay: the headline and the stage beside or under it. */
function Framed({ showed, erg, width, height, active, logIt }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean; logIt?: (() => void) | null }) {
  const wide = width >= 520 && width > height;
  if (wide) {
    const SIDE = Math.round(Math.min(230, width * 0.24));
    return (
      <View style={{ width, height, flexDirection: "row", backgroundColor: C.paper }}>
        <Headline erg={erg} width={SIDE} height={height} wide />
        <Stage showed={showed} erg={erg} width={width - SIDE} height={height} active={active} logIt={logIt} />
      </View>
    );
  }
  const STRIP = stripOf(width);
  return (
    <View style={{ width, height, backgroundColor: C.paper }}>
      <Headline erg={erg} width={width} height={STRIP} wide={false} />
      <Stage showed={showed} erg={erg} width={width} height={height - STRIP} active={active} logIt={logIt} />
    </View>
  );
}

/* `logIt`: the row is logged and the photos and the caption are a press
 * away (RowScreen's ADD PHOTOS); the finish screen shows LOG IT upright. */
export function ShowPage({ showed, erg, width, height, active, logIt }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean; logIt?: (() => void) | null }) {
  return <Framed showed={showed} erg={erg} width={width} height={height} active={active} logIt={logIt} />;
}

/* Whether the show is laid over the other pages now: the ready check, the
 * match and its celebration. */
export function overlays(v: ShowView | null): boolean {
  if (!v) return false;
  if (v.phase === "match" || v.phase === "celebrate") return true;
  return v.phase === "lobby" && v.t >= v.gunAt - READY_S;
}

export function ShowOverlay({ showed, erg, width, height }: { showed: Showed; erg: Erg; width: number; height: number }) {
  return <Framed showed={showed} erg={erg} width={width} height={height} active />;
}

/* ---- the stage ------------------------------------------------------------- */

function Stage({ showed, erg, width, height, active, logIt }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean; logIt?: (() => void) | null }) {
  const wall = useWallClock(active);
  const locker = useLocker();
  const paint = wear(locker.equipped);
  const v = showed.view.current;
  const rt = useRowClock(v, wall);
  const hop = useHop(erg, wall);
  if (!v) return <View style={{ width, height }} />;
  /* How far the rower has got by the show's second: their last word, and on
   * at the pace of this stroke. */
  const speed = erg.live.pace > 0 && erg.live.pace < 600 && !erg.live.ended ? 500 / erg.live.pace : 0;
  const myM = v.m + Math.max(0, rt - v.t) * speed;
  const p = { v, erg, width, height, wall, rt, myM, paint, hop, showed, logIt };
  /* SINGLE PLAYER ENDS ON THE FINISH SCREEN (round four): no chest. */
  if (v.battle && (v.phase === "chest" || v.phase === "summary")) return <EndScreen {...p} />;
  switch (v.phase) {
    case "intro":
      return showed.ctx.current.solo ? <SoloIntro {...p} /> : <Intro {...p} />;
    case "home":
    case "done":
      return <Home {...p} />;
    case "battle":
      return <Battle {...p} />;
    case "swarm":
      return null;
    case "lobby":
      return <Lobby {...p} />;
    case "match":
      return <Match {...p} />;
    case "celebrate":
      return <Celebrate {...p} />;
    case "levelup":
      return <LevelUp {...p} />;
    case "finish":
      return v.battle ? <DragRace {...p} /> : <Finish {...p} />;
    case "summary":
      return <Summary {...p} />;
    case "chest":
      return v.final ? <ChestOpen chest={v.final.chest} at={v.sinceWall} t={wall} width={width} height={height} won note="A NEW ITEM" /> : null;
    default:
      return null;
  }
}

type P = { v: ShowView; erg: Erg; width: number; height: number; wall: number; rt: number; myM: number; paint: Paint; hop: number; showed: Showed; logIt?: (() => void) | null };

/* A line of big type, cut to fit the width (a phone's browser will not
 * shrink a line itself). */
function Big({ text, width, max, color = C.ink, align = "center" }: { text: string; width: number; max: number; color?: string; align?: "left" | "center" | "right" }) {
  /* Archivo Black's capitals run about 0.86 of the size each; reckoned at
   * a full size each, so a wide W or M never cuts the word ("ROWVEM..." was
   * seen cut, 2026-11-24). */
  const size = Math.max(14, Math.min(max, Math.floor(width / (Math.max(1, text.length) * 1.0))));
  return (
    <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.14), color, textAlign: align, letterSpacing: 0.4 }}>
      {text}
    </Text>
  );
}

/* A banner over the board: a small word, and a big line under it. */
function Banner({ eyebrow, line, sub, width, color = C.ink }: { eyebrow: string; line: string; sub?: string; width: number; color?: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, backgroundColor: C.paper, borderBottomWidth: 1, borderColor: C.line }}>
      <Eyebrow style={{ color: C.ink }}>{eyebrow}</Eyebrow>
      <Big text={line} width={width - 32} max={26} color={color} align="left" />
      {sub ? (
        <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.2, color: C.soft }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}
const BANNER = (sub: boolean) => (sub ? 72 : 56);

/* ---- the intro ---------------------------------------------------------- */

function Intro({ v, width, height, wall, paint, hop, showed }: P) {
  const ctx = showed.ctx.current;
  const rating = useRating();
  const boat = useBoat();
  const prog = useProgress();
  const wide = width >= 520;
  const e = wall - v.sinceWall;
  const k = clamp(v.t / Math.max(1, 60 * v.scale));
  const dots = ".".repeat(1 + (Math.floor(wall * 2) % 3));
  const word = editionWord();
  /* SAID IN FULL (owner, 2026-11-24, of "Lifetime" over "5K pace 1:57":
   * what does it mean?): the meters are all-time; the pace is the median of
   * the rower's 5Ks, and the course's floors are set off it. */
  const stats: [string, string][] = [
    ["All-time meters", ctx.lifetime ? `${fmtInt(ctx.lifetime)}` : "--"],
    ["Your pace · median 5K", ctx.assigned ? whole(ctx.assigned) : "1:59"],
    /* ONE SCREEN PAYS (owner, 2026-11-24: "I don't want to see that I got
     * like Elo when I was playing the PvE game"): the rating only before a
     * match; the course shows the coins. */
    ctx.solo ? ["Coins", fmtInt(boat.coins)] : ["Rating", `${rating.elo}`],
    ["Level", `${prog.level}`],
  ];
  const tokenSize = Math.min(wide ? height * 0.42 : width * 0.24, 108);
  return (
    <View style={{ width, height, overflow: "hidden", paddingHorizontal: 18, paddingTop: 10 }}>
      <View style={{ opacity: clamp(e / 0.4), transform: [{ scale: 0.9 + 0.1 * pop(e / 0.6) }] }}>
        {/* His order (2026-11-24: "Rowvember presents the arcade"). */}
        <Eyebrow style={{ color: C.ink }}>{`${word} presents`}</Eyebrow>
        <Big text="THE ARCADE" width={width - 36} max={wide ? 50 : 44} align="left" />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, flex: 1 }}>
        <View style={{ flex: 1, rowGap: wide ? 4 : 10, minWidth: 0, flexDirection: wide ? "row" : "column", flexWrap: "wrap" }}>
          {stats.map(([k2, val], i) => (
            <View key={k2} style={{ width: wide ? "50%" : undefined, opacity: clamp((e - 0.5 - i * 0.25) / 0.4), transform: [{ translateX: (1 - ease((e - 0.5 - i * 0.25) / 0.4)) * -30 }] }}>
              <Eyebrow>{k2}</Eyebrow>
              <Num size={wide ? 24 : Math.min(28, Math.floor((width - 36 - tokenSize * 1.65) / (val.length * 0.98)))}>{val}</Num>
            </View>
          ))}
        </View>
        <TokenArt paint={paint} size={tokenSize} t={wall} trail hop={hop} look={0.4} uid="intro" />
      </View>
      <View style={{ paddingBottom: 12 }}>
        <Text style={{ fontFamily: F.black, fontSize: 20, color: C.ink }}>{ctx.solo ? `TO FLOOR 1${dots}` : `LOOKING FOR A MATCH${dots}`}</Text>
        <View style={{ height: 8, backgroundColor: C.line, marginTop: 6 }}>
          <View style={{ width: `${Math.round(k * 100)}%`, height: 8, backgroundColor: C.ink }} />
        </View>
      </View>
    </View>
  );
}

/* ---- home ----------------------------------------------------------------- */

function Home({ v, width, height, wall, rt, myM, paint, hop }: P) {
  const dots = ".".repeat(1 + (Math.floor(wall * 2) % 3));
  let eyebrow = "Home";
  let line = `LOOKING FOR A MATCH${dots}`;
  let sub: string | undefined;
  let color = C.ink;
  if (v.phase === "done") {
    line = "ROW OVER";
  } else if (v.search === "found" && v.opp) {
    eyebrow = "Match found";
    line = `VS ${v.opp.name.toUpperCase()}`;
    sub = `${whole(v.opp.assigned)} PACE · ELO ${v.opp.elo} · IN ${clockS(v.lobbyAt - rt)}`;
    color = C.accent;
  } else if (v.search === "closed") {
    line = v.target > 0 ? "NO MORE MATCHES" : "HOME";
    sub = v.target > 0 ? "THE FINISH IS COMING" : undefined;
  }
  const B = BANNER(!!sub);
  const g = { W: width, H: Math.max(140, height - B) };
  const me: Piece = { id: "me", paint, s: sOf(boardOf(g.W, g.H), myM), hop, wobble: 0, label: "YOU", mine: true };
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: B, left: 0 }}>
        <Board W={g.W} H={g.H} pieces={[me]} t={wall} uid="home" />
      </View>
      <Banner eyebrow={eyebrow} line={line} sub={sub} width={width} color={color} />
    </View>
  );
}

/* ---- the lobby, and the ready check --------------------------------------- */

function oppPaint(id: string): Paint {
  /* A bot wears a plain piece in a colour of its own, so the two are told
   * apart at a glance; the skins it has won come with matchmaking. */
  const hulls = ["hull-red", "hull-yellow", "hull-green"];
  const hats = ["rower-teal", "rower-purple", "rower-stock"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return wear({ ...STOCK, hull: hulls[h % hulls.length], rower: hats[Math.floor(h / 3) % hats.length] });
}

function Lobby(p: P) {
  const { v, width, height, wall, rt, myM, paint, hop, showed } = p;
  const readyAt = v.gunAt - READY_S;
  const ready = rt >= readyAt && v.assigned > 0;
  const opp = v.opp;
  const B = BANNER(true);
  const CARD = ready ? Math.min(height * 0.5, 240) : 0;
  const g = { W: width, H: Math.max(120, height - B - CARD) };
  const geo = boardOf(g.W, g.H);
  const pieces: Piece[] = [{ id: "me", paint, s: sOf(geo, myM), hop, wobble: 0, label: "YOU", mine: true }];
  if (opp) pieces.push({ id: "op", paint: oppPaint(opp.id), s: sOf(geo, showed.show.current?.metersAt(opp.id, rt) ?? 0, 2), hop: botHop(opp.id, rt), wobble: 0, label: opp.name.split(" ")[0].toUpperCase() });
  /* THE LOBBY TEACHES BY PLAYING ("This minute also teaches the game, by
   * playing, not reading"): the rhythm of the match runs round the
   * rower's piece already, cool and aim, and says so. */

  const at = pieceAt(geo, pieces[0].s);
  const ringK = (((rt - v.lobbyAt) % FILL_S) + FILL_S) % FILL_S / FILL_S;
  const ring = <Ring x={at.x} y={at.y} r={geo.unit * 0.42} k={ringK} color={C.accent} />;
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: B, left: 0 }}>
        <Board W={g.W} H={g.H} pieces={pieces} t={wall} uid="lobby">
          {!ready ? ring : null}
        </Board>
      </View>
      <Banner eyebrow={ready ? "Ready check" : "Lobby · the bar fills faster at your pace"} line={opp ? `VS ${opp.name.toUpperCase()}` : "LOBBY"} sub={opp ? `${whole(opp.assigned)} PACE · ELO ${opp.elo} · MATCH IN ${clockS(v.gunAt - rt)}` : undefined} width={width} />
      {ready ? <Ready v={v} width={width} height={CARD} wall={wall} rt={rt} /> : null}
    </View>
  );
}

/* THE READY CHECK, the 12 seconds before ("The title: the flip dots read
 * 159, then flip to the pace you will play at ... Shown beside the pace you
 * are rowing, so you can get there"). */
function Ready({ v, width, height, wall, rt }: { v: ShowView; width: number; height: number; wall: number; rt: number }) {
  const readyAt = v.gunAt - READY_S;
  const into = rt - readyAt;
  const flip = into >= 1.6;
  const now = v.ready?.pace;
  const ok = !!v.ready?.ok;
  const left = Math.max(0, Math.ceil(v.gunAt - rt));
  const dotsW = Math.min(width * 0.46, 230);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 16, paddingTop: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14 }}>
        <View>
          <Eyebrow style={{ color: C.ink }}>{flip ? "Your pace" : "Game"}</Eyebrow>
          <FlipDots text={flip ? whole(v.assigned) : "1:59"} width={dotsW} t={wall} />
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Eyebrow>Now, 3 s</Eyebrow>
          <Num size={Math.min(42, Math.floor((width - dotsW - 50) / 4.2))} color={ok ? C.good : BEST}>
            {tenthsWord(now)}
          </Num>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
        <Big text={ok ? "READY" : `GET TO ${whole(v.assigned)}`} width={width * 0.62} max={32} color={ok ? C.good : C.ink} align="left" />
        <Num size={36}>{`${left}`}</Num>
      </View>
    </View>
  );
}

/* A ring filling round a piece: the cool, then the aim. */
function Ring({ x, y, r, k, color }: { x: number; y: number; r: number; k: number; color: string }) {
  const a = clamp(k) * Math.PI * 2;
  const end = { x: x + Math.sin(a) * r, y: y - Math.cos(a) * r };
  const big = a > Math.PI ? 1 : 0;
  return (
    <G>
      <Circle cx={x} cy={y} r={r} stroke={C.paper} strokeOpacity={0.75} strokeWidth={8} fill="none" />
      <Circle cx={x} cy={y} r={r} stroke={C.line} strokeWidth={4} fill="none" />
      {k >= 0.999 ? (
        <Circle cx={x} cy={y} r={r} stroke={color} strokeWidth={4.5} fill="none" />
      ) : k > 0.01 ? (
        <Path d={`M${x} ${y - r} A${r} ${r} 0 ${big} 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`} stroke={color} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      ) : null}
    </G>
  );
}

/* ---- the match ------------------------------------------------------------ */

/* How long a shot is in the air, in the wall's seconds (so it is seen at ten
 * times a clock too). */
const FLY_S = 0.42;

/* A spiky burst round a point: the "pow" of a hit. */
const burst = (x: number, y: number, R: number, r: number, n: number, turn = 0): string => {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + turn;
    const q = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * q).toFixed(1)} ${(y + Math.sin(a) * q).toFixed(1)}`;
  }
  return `${d}Z`;
};

/* A HEALTH BAR: what is left in its colour, and what was just lost shown
 * a moment longer in yellow, draining after it. It NEVER SHAKES (owner,
 * 2026-11-24: the shaking "hurts reading"); the number counts down to what
 * is left, red for a moment after a hit. `name` over it (none: the bar
 * alone), `right` after the number (a percent, "/ 500"). */
function HealthBar({ name, h, max, mine, wall, right }: { name?: string; h: number; max: number; mine: boolean; wall: number; right?: string }) {
  const lag = useRef({ v: h, hitAt: -9, was: h, shown: h, max });
  const L = lag.current;
  if (max !== L.max) {
    L.max = max;
    L.v = h;
    L.shown = h;
  }
  if (h < L.was) L.hitAt = wall;
  L.was = h;
  if (h >= L.v) L.v = h;
  else L.v += (h - L.v) * 0.07;
  if (h >= L.shown) L.shown = h;
  else L.shown += Math.min(-0.5, (h - L.shown) * 0.18);
  if (L.shown < h) L.shown = h;
  const m = Math.max(1, max);
  const now = clamp(h / m);
  const ghost = clamp(L.v / m) - now;
  const since = wall - L.hitAt;
  const low = now < 0.3;
  const num = `${fmtInt(Math.ceil(L.shown))}${right ? ` ${right}` : ""}`;
  /* No flex of its own (seen on his phone, 2026-11-24: a bar with flex 1
   * in a column of fixed height was laid over the JAB row); beside another
   * bar it is wrapped in a flex: 1 view by the caller. */
  return (
    <View style={{ alignSelf: "stretch" }}>
      {name ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 15, color: mine ? C.accent : C.ink, flexShrink: 1 }}>
            {name}
          </Text>
          <Text style={{ fontFamily: F.black, fontSize: 15, color: since < 0.5 ? BEST : C.ink, fontVariant: ["tabular-nums"] }}>{num}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 8, marginTop: 3 }}>
        <View style={{ flex: 1, height: 14, borderWidth: 2, borderColor: C.ink, borderRadius: 3, overflow: "hidden", flexDirection: mine ? "row" : "row-reverse", backgroundColor: C.paper }}>
          <View style={{ width: `${(100 * now).toFixed(1)}%`, backgroundColor: low ? BEST : mine ? C.accent : C.ink }} />
          <View style={{ width: `${(100 * ghost).toFixed(1)}%`, backgroundColor: DOT_ON }} />
        </View>
        {name ? null : <Text style={{ fontFamily: F.black, fontSize: 16, color: since < 0.5 ? BEST : C.ink, fontVariant: ["tabular-nums"] }}>{num}</Text>}
      </View>
    </View>
  );
}

function Match(p: P) {
  const { v, width, height, wall, rt, myM, paint, hop, showed } = p;
  const mv = v.match;
  const opp = v.opp;
  if (!mv || !opp) return null;
  const wide = width >= 520;
  const me = mv.players.find((x) => x.id === "me");
  const op = mv.players.find((x) => x.id !== "me");
  /* Upright, the aim is under the board; on its side, beside it, so the
   * board keeps its height. */
  const HUD = 54;
  const AIM = wide ? 0 : 104;
  const SIDE = wide ? Math.round(Math.min(210, width * 0.32)) : 0;
  const g = { W: width - SIDE, H: Math.max(120, height - HUD - AIM) };
  const geo = boardOf(g.W, g.H);
  const k = geo.unit / 64;
  /* The bar, and how near the pace sits (match.ts): no rounds, no
   * cooldown. */
  const near = me?.near ?? 0;
  const holding = near >= 0.99;
  const aimPace = me && Number.isFinite(me.pace) ? me.pace : NaN;
  const wobble = Number.isFinite(aimPace) && near < 0.6 ? clamp(1 - near, 0.15, 1) * 0.6 : 0;

  /* The wall's second a shot fired at: the show's second, back from now. */
  const wallOf = (s: MShot) => wall - (rt - s.at) / Math.max(0.2, v.rate);
  const flying = mv.shots.filter((s) => {
    const e = wall - wallOf(s);
    return e >= 0 && e < FLY_S + 0.9;
  });
  const meS = sOf(geo, myM);
  const opS = sOf(geo, showed.show.current?.metersAt(opp.id, rt) ?? 0, 2);
  /* A piece that is hit shakes for a moment. */
  const jolt = (id: string): number => {
    let j = 0;
    for (const s of mv.shots) {
      const e = wall - wallOf(s) - FLY_S;
      if (s.hit && !s.cancelled && s.to === id && e >= 0 && e < 0.45) j = Math.max(j, 0.9 * (1 - e / 0.45));
    }
    return j;
  };
  const pieces: Piece[] = [
    { id: "me", paint, s: meS, hop, wobble: Math.max(wobble, jolt("me")), label: "YOU", mine: true, out: (me?.health ?? 1) <= 0 && mv.phase === "over", firing: flying.some((s) => s.from === "me" && wall - wallOf(s) < FLY_S) },
    { id: "op", paint: oppPaint(opp.id), s: opS, hop: botHop(opp.id, rt), wobble: jolt(opp.id), label: opp.name.split(" ")[0].toUpperCase(), firing: flying.some((s) => s.from !== "me" && wall - wallOf(s) < FLY_S) },
  ];
  const posOf = (id: string) => pieceAt(geo, id === "me" ? meS : opS);
  const shots: ReactElement[] = [];
  for (const s of flying) {
    const e = (wall - wallOf(s)) / FLY_S;
    const a = posOf(s.from);
    const b = posOf(s.to);
    const shotPaint = s.from === "me" ? paint.oars : oppPaint(opp.id).oars;
    /* Two that land on each other meet in the middle and pop; a miss goes
     * wide and into the water. */
    const end = s.cancelled ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : s.hit ? b : { x: b.x + (b.y - a.y) * 0.28, y: b.y - (b.x - a.x) * 0.28 };
    const q = s.cancelled ? Math.min(1, e) : e;
    const R0 = 7 * k + 2;
    if (q < 1) {
      const at = (u: number) => ({ x: a.x + (end.x - a.x) * u, y: a.y + (end.y - a.y) * u - Math.sin(u * Math.PI) * 26 * k });
      const c0 = shotPaint.extra === "flame" ? "#F0631E" : shotPaint.extra === "bolt" ? "#F2C230" : shotPaint.blade === "ink" ? C.ink : shotPaint.blade;
      /* Its shadow runs along the water under it. */
      shots.push(<Ellipse key={`w${s.n}`} cx={a.x + (end.x - a.x) * q} cy={a.y + (end.y - a.y) * q + 9 * k} rx={R0 * (0.9 - 0.3 * Math.sin(q * Math.PI))} ry={R0 * 0.3} fill={C.ink} fillOpacity={0.16} />);
      /* The puff where it left, and the streak behind it. */
      if (q < 0.35) shots.push(<Circle key={`f${s.n}`} cx={a.x} cy={a.y} r={R0 * (1 + 3 * q)} stroke={c0} strokeWidth={3} strokeOpacity={1 - q / 0.35} fill="none" />);
      for (let j = 4; j >= 1; j--) {
        const u = q - j * 0.055;
        if (u <= 0) continue;
        const g2 = at(u);
        shots.push(<Circle key={`t${s.n}-${j}`} cx={g2.x} cy={g2.y} r={R0 * (1 - j * 0.17)} fill={c0} fillOpacity={0.34 - j * 0.07} />);
      }
      const here = at(q);
      shots.push(<ShotArt key={`s${s.n}`} o={shotPaint} x={here.x} y={here.y} r={R0} t={wall} />);
    } else {
      const kb = clamp(e - 1, 0, 2) / 0.8;
      if (kb < 1) {
        const R = (10 + 26 * kb) * k;
        const fade = 1 - kb;
        if (s.cancelled) {
          /* Two that meet: a clink, and sparks. */
          shots.push(
            <G key={`c${s.n}`} opacity={fade}>
              {kb < 0.35 ? <Path d={burst(end.x, end.y, R0 * (1.6 + 3 * kb), R0 * (0.7 + kb), 6, 0.3)} fill={C.paper} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" /> : null}
              <Circle cx={end.x} cy={end.y} r={R} stroke={C.gray} strokeWidth={3} fill="none" />
              {Array.from({ length: 6 }, (_, i) => {
                const an = (i / 6) * Math.PI * 2 + 0.5;
                const d = R * (0.5 + 0.9 * kb);
                return <Path key={i} d={star(end.x + Math.cos(an) * d, end.y + Math.sin(an) * d, (5 - 3 * kb) * k)} fill={DOT_ON} stroke={C.ink} strokeWidth={0.8} strokeLinejoin="round" />;
              })}
            </G>,
          );
        } else if (s.hit) {
          /* A hit: a flash, a "pow", and a ring going out. */
          const hot = s.lucky ? DOT_ON : BEST;
          shots.push(
            <G key={`h${s.n}`} opacity={fade}>
              {kb < 0.2 ? <Circle cx={end.x} cy={end.y} r={R * 1.3} fill="#FFFFFF" fillOpacity={0.8 * (1 - kb / 0.2)} /> : null}
              {kb < 0.32 ? <Path d={burst(end.x, end.y, (14 + 22 * Math.min(1, kb / 0.2)) * k, (8 + 9 * Math.min(1, kb / 0.2)) * k, 9, kb * 2)} fill={hot} stroke={C.ink} strokeWidth={2.2} strokeLinejoin="round" fillOpacity={0.9 - kb * 2} strokeOpacity={1 - kb * 2.5} /> : null}
              <Circle cx={end.x} cy={end.y} r={R * 1.25} stroke={hot} strokeWidth={4 * fade + 1} fill="none" />
              {Array.from({ length: 8 }, (_, i) => {
                const an = (i / 8) * Math.PI * 2;
                return <Line key={i} x1={end.x + Math.cos(an) * R * 0.9} y1={end.y + Math.sin(an) * R * 0.9} x2={end.x + Math.cos(an) * R * 1.5} y2={end.y + Math.sin(an) * R * 1.5} stroke={C.ink} strokeWidth={2.8} strokeLinecap="round" />;
              })}
            </G>,
          );
        } else {
          /* A miss: it goes into the water. */
          shots.push(
            <G key={`m${s.n}`} opacity={fade}>
              <Ellipse cx={end.x} cy={end.y} rx={R * 0.9} ry={R * 0.34} stroke={C.accent} strokeWidth={2.4} fill="none" />
              <Ellipse cx={end.x} cy={end.y} rx={R * 0.5} ry={R * 0.19} stroke={C.accent} strokeWidth={2} fill="none" />
              {[-1, 0, 1].map((i) => {
                const u = Math.min(1, kb * 1.6);
                return <Circle key={i} cx={end.x + i * 14 * k * u} cy={end.y - (i === 0 ? 30 : 20) * k * Math.sin(u * Math.PI)} r={(3 - 1.5 * u) * k + 1} fill={C.accent} />;
              })}
            </G>,
          );
        }
      }
    }
  }
  /* The ring round the rower's piece: the cool filling grey, the aim green
   * while held. */
  const at = posOf("me");
  const ring = mv.phase !== "over" ? <Ring x={at.x} y={at.y} r={geo.unit * 0.42} k={clamp(me?.charge ?? 0)} color={holding ? C.good : C.accent} /> : null;
  /* The damage, floating up off whoever took it. */
  const pops: ReactNode[] = [];
  for (const s of mv.shots) {
    const e = wall - wallOf(s) - FLY_S;
    if (!(s.hit && !s.cancelled) || e < 0 || e > 1.4) continue;
    const b = posOf(s.to);
    pops.push(
      <Text key={`p${s.n}`} style={{ position: "absolute", left: b.x - 60, width: 120, top: HUD + b.y - geo.unit * 0.9 - e * 30, textAlign: "center", fontFamily: F.black, fontSize: 24, color: s.to === "me" ? BEST : C.ink, opacity: 1 - clamp((e - 0.9) / 0.5), transform: [{ scale: 0.5 + 0.5 * pop(e / 0.22) }], textShadowColor: C.paper, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } }}>
        {`−${s.damage}`}
      </Text>,
    );
  }
  /* The last round's word, for a moment. */
  const lastMine = [...mv.shots].reverse().find((s) => s.from === "me");
  const lastE = lastMine ? wall - wallOf(lastMine) : 99;
  /* Up for a second and a half, or most of a round when a demo runs the
   * rounds faster than that. */
  const word = lastMine && lastE < Math.min(1.2, (0.8 * FILL_S) / Math.max(0.2, v.rate)) ? (lastMine.cancelled ? "CANCEL" : lastMine.lucky ? `LUCKY −${lastMine.damage}` : lastMine.hit ? `HIT −${lastMine.damage}` : "MISS") : "";
  const wordColor = lastMine?.cancelled ? C.gray : lastMine?.lucky ? "#111111" : lastMine?.hit ? C.good : BEST;

  const over = mv.phase === "over";
  /* THE BAR: always filling, faster the nearer the pace given. */
  const phaseWord = (
    <View style={{ width: wide ? undefined : 124 }}>
      <Eyebrow style={{ color: C.ink }}>{over ? "Match" : "Throw"}</Eyebrow>
      {over ? (
        <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 30, color: C.ink }}>OVER</Text>
      ) : (
        <View style={{ height: 18, borderWidth: 2, borderColor: C.ink, borderRadius: 3, overflow: "hidden", marginTop: 4, backgroundColor: C.paper }}>
          <View style={{ width: `${(100 * clamp(me?.charge ?? 0)).toFixed(1)}%`, height: "100%", backgroundColor: holding ? C.good : C.accent }} />
        </View>
      )}
    </View>
  );
  const paceBig = (
    <View style={{ flex: wide ? undefined : 1, alignItems: wide ? "flex-start" : "flex-end" }}>
      <Eyebrow>{`Target ${whole(me?.assigned ?? 0)} · 4 s`}</Eyebrow>
      <Num size={wide ? Math.min(40, Math.floor((SIDE - 28) / 4.2)) : Math.min(44, Math.floor((width - 170) / 4))} color={over || !Number.isFinite(aimPace) ? C.gray : holding ? C.good : near < 0.45 ? BEST : C.ink}>
        {!over && Number.isFinite(aimPace) ? tenthsWord(aimPace) : whole(me?.assigned ?? 0)}
      </Num>
    </View>
  );
  const aimPanel = wide ? (
    <View style={{ width: SIDE, height: g.H, borderLeftWidth: 2, borderColor: C.ink, paddingHorizontal: 14, justifyContent: "center", rowGap: 14 }}>
      {phaseWord}
      {paceBig}
    </View>
  ) : (
    <View style={{ height: AIM, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 16, paddingTop: 6, flexDirection: "row", alignItems: "center", columnGap: 12 }}>
      {phaseWord}
      {paceBig}
    </View>
  );
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <View style={{ height: HUD, flexDirection: "row", columnGap: 18, paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flex: 1 }}>
          <HealthBar name="YOU" h={me?.health ?? 0} max={me?.max ?? 1} mine wall={wall} />
        </View>
        <View style={{ flex: 1 }}>
          <HealthBar name={opp.name.toUpperCase()} h={op?.health ?? 0} max={op?.max ?? 1} mine={false} wall={wall} />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: g.W, height: g.H }}>
          <Board W={g.W} H={g.H} pieces={pieces} t={wall} uid="match">
            {ring}
            {shots}
          </Board>
          {word ? (
            <View pointerEvents="none" style={{ position: "absolute", top: 6, alignSelf: "center", backgroundColor: lastMine?.lucky ? DOT_ON : C.paper, paddingHorizontal: 10, borderWidth: 2, borderColor: C.ink, borderRadius: 4, transform: [{ scale: 0.6 + 0.4 * pop(lastE / 0.2) }, { rotate: `${(-3 * (1 - clamp(lastE / 0.3))).toFixed(1)}deg` }] }}>
              <Text style={{ fontFamily: F.black, fontSize: 24, letterSpacing: 1, color: wordColor }}>{word}</Text>
            </View>
          ) : null}
        </View>
        {wide ? aimPanel : null}
      </View>
      {pops}
      {wide ? null : aimPanel}
    </View>
  );
}

/* ---- single player: the course (arcade/pve.ts) ------------------------- */

/* A skill's colour on the board and in its box: quick, middle, heavy. */
/* THE TAG OVER YOUR BOAT (owner, 2026-11-24: in place of YOU, "if your
 * name isn't already shown anywhere on the screen, put it above the boat
 * like a health-bar label", with the level before it). The course and the
 * swarm show the name nowhere else, so it is here: LV 7 MIKIAN. The level
 * counts this row's XP as it comes. */
function useTag(v: ShowView): string {
  const { me } = useSession();
  const prog = useProgress();
  const name = (me.me?.displayName || me.name || "").trim().split(/\s+/)[0]?.toUpperCase() || "";
  /* NO LEVEL UP MID-ROW (owner, 2026-11-24): the level the row began at;
   * the row's XP is counted after. */
  void v;
  const lv = levelOf(prog.xp).level;
  return name ? `LV ${lv} ${name.slice(0, 12)}` : `LV ${lv}`;
}

/* THE PERCENTS COUNT UP, NEVER JUMP (owner, 2026-11-24: "it would go from
 * like 15 ... 19%, 69%, 19%, 69%"; he wants "a nice smooth animation"). The
 * engine's charge moves in steps, one a word from the monitor, and a quick
 * skill can fill and fire between two words. So what is shown runs after
 * it at no more than SHOWN_RATE a second: up to the charge, and when the
 * skill has gone off, on up to 100 and round to 0, never back down a step
 * it showed. At 10x it laps less often than the skill fires, which is the
 * price of never skipping. */
const SHOWN_RATE = 2.6;
function useShown(skills: SkillView[], wall: number): (s: SkillView) => number {
  const st = useRef(new Map<string, { d: number; last: number; lap: boolean; held: boolean; w: number }>()).current;
  const out = new Map<string, number>();
  for (const s of skills) {
    const id = s.def.id;
    const c = clamp(s.charge);
    let e = st.get(id);
    if (!e) {
      e = { d: c, last: c, lap: false, held: false, w: wall };
      st.set(id, e);
    }
    const dt = clamp(wall - e.w, 0, 0.25);
    e.w = wall;
    /* It went off since the last word: the charge fell back. */
    if (c < e.last - 0.04) {
      if (e.d >= 0.35) e.lap = true;
    }
    e.last = c;
    const step = SHOWN_RATE * dt;
    if (e.lap) {
      if (e.held) {
        e.d = 0;
        e.lap = false;
        e.held = false;
      } else {
        e.d = Math.min(1, e.d + step);
        if (e.d >= 1) e.held = true;
      }
    } else if (c > e.d) {
      e.d = Math.min(c, e.d + step);
    } else if (c < e.d) {
      e.d = Math.max(c, e.d - step);
    }
    out.set(id, e.d);
  }
  return (s) => out.get(s.def.id) ?? clamp(s.charge);
}

/* DAMAGE NUMBERS, after the RPGs' (owner, 2026-11-24: they overlapped and
 * were hard to read; "take a cue from Chinese/Japanese RPG damage
 * numbers"): each one pops in big and settles, floats up and fades, in its
 * colour inside a dark outline, so it reads on the water, the sand and
 * either look. They are set out in five columns, in turn, so the newest
 * five never sit on each other, and only the newest five are drawn (at 10x
 * the throws come faster than anybody reads them). */
const POP_LIFE = 1.0;
const POP_INK = "#10161C";
const RING8 = [[-2, 0], [2, 0], [0, -2], [0, 2], [-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];
function DmgPop({ x, y, text, size, color, e }: { x: number; y: number; text: string; size: number; color: string; e: number }) {
  const sc = e < 0.12 ? 1.7 - 0.7 * (e / 0.12) : 1;
  const o = 1 - clamp((e - POP_LIFE * 0.65) / (POP_LIFE * 0.35));
  const h = Math.round(size * 1.3);
  const w = Math.round(size * 4);
  const face = { position: "absolute" as const, left: 0, width: w, textAlign: "center" as const, fontFamily: F.black, fontSize: size, lineHeight: h };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x - w / 2, top: y - e * 46 - h / 2, width: w, height: h, opacity: o, transform: [{ scale: sc }] }}>
      {RING8.map(([dx, dy], i) => (
        <Text key={i} style={[face, { top: dy, left: dx, color: POP_INK }]}>
          {text}
        </Text>
      ))}
      <Text style={[face, { top: 0, color }]}>{text}</Text>
    </View>
  );
}

const SLOT_COLOR = SKILL_COLOR;
const SLOT_R = [4.5, 7, 11];


/* ---- THE COURSE, round four (owner, 2026-11-24, after a real 5K on the
 * rower, read from 4 to 6 feet: "readability from that distance is the main
 * problem") ----------------------------------------------------------------
 *
 *   the map as big as the stage, the board edge to edge (the figures on
 *   the left are two now: current pace and the finish, Framed);
 *   THE FLOOR as a big number in the corner;
 *   the monster's name and its bar CENTRED OVER IT, the bar alone ("no
 *   number or %"), its length fixed;
 *   YOUR HULL as the same kind of bar, in your colour, at the foot, no
 *   words;
 *   THE SKILLS as three rings in their colours, each with its pace over it
 *   and its percent inside in figures that do not move, filled when it is
 *   rising, grey when it is not; no names;
 *   THE REST between fights: no bars, REST and the floor that is next;
 *   the course EASES IN after the intro instead of popping in. */

/* A bar with a name over it, centred: what is left in its colour, what was
 * just lost a moment longer in yellow. Never shakes, never a number. */
function LifeBar({ h, max, color, width, height, wall, name, nameColor, size = 20 }: { h: number; max: number; color: string; width: number; height: number; wall: number; name?: string; nameColor?: string; size?: number }) {
  const lag = useRef({ v: h, max });
  const L = lag.current;
  if (max !== L.max) {
    L.max = max;
    L.v = h;
  }
  if (h >= L.v) L.v = h;
  else L.v += (h - L.v) * 0.07;
  void wall;
  const m = Math.max(1, max);
  const now = clamp(h / m);
  const ghost = clamp(L.v / m) - now;
  return (
    <View style={{ width, alignItems: "center" }}>
      {name ? (
        <View style={{ position: "relative", height: Math.round(size * 1.3), width: width + 80, alignItems: "center" }}>
          {RING8.map(([dx, dy], i) => (
            <Text key={i} numberOfLines={1} style={{ position: "absolute", top: dy, left: dx, right: -dx, textAlign: "center", fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.3), color: C.paper }}>
              {name}
            </Text>
          ))}
          <Text numberOfLines={1} style={{ position: "absolute", top: 0, left: 0, right: 0, textAlign: "center", fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.3), color: nameColor ?? C.ink }}>
            {name}
          </Text>
        </View>
      ) : null}
      <View style={{ width, height, borderWidth: 2.5, borderColor: C.ink, borderRadius: 4, overflow: "hidden", flexDirection: "row", backgroundColor: C.paper, marginTop: 2 }}>
        <View style={{ width: `${(100 * now).toFixed(1)}%`, backgroundColor: color }} />
        <View style={{ width: `${(100 * ghost).toFixed(1)}%`, backgroundColor: DOT_ON }} />
      </View>
    </View>
  );
}

/* A skill: its pace over a ring that fills, its percent inside. The % sign
 * stays put and the number grows to its left ("use fixed-width numbers"). */
function SkillRing({ s, k, size, on }: { s: SkillView; k: number; size: number; on: boolean }) {
  const col = s.def.color;
  const sw = Math.max(6, size * 0.12);
  const r = size / 2 - sw / 2 - 1;
  const c = size / 2;
  const a = clamp(k) * Math.PI * 2;
  const end = { x: c + Math.sin(a) * r, y: c - Math.cos(a) * r };
  const big = a > Math.PI ? 1 : 0;
  const pct = `${Math.floor(100 * clamp(k))}`;
  const fs = Math.round(size * 0.27);
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontFamily: F.black, fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.42), color: on ? C.ink : C.gray, fontVariant: ["tabular-nums"] }}>{whole(Math.round(s.target))}</Text>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ position: "absolute", left: 0, top: 0 }}>
          <Circle cx={c} cy={c} r={r} fill={on ? col : C.paper} fillOpacity={on ? 0.18 : 1} stroke={C.line} strokeWidth={sw} />
          {k >= 0.999 ? <Circle cx={c} cy={c} r={r} fill="none" stroke={col} strokeWidth={sw} /> : k > 0.004 ? <Path d={`M${c} ${c - r} A${r} ${r} 0 ${big} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} fill="none" stroke={col} strokeWidth={sw} opacity={on ? 1 : 0.4} /> : null}
        </Svg>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", width: fs * 2.6 }}>
            <Text style={{ flex: 1, textAlign: "right", fontFamily: F.black, fontSize: fs, color: on ? C.ink : C.gray, fontVariant: ["tabular-nums"] }}>{pct}</Text>
            <Text style={{ fontFamily: F.black, fontSize: Math.round(fs * 0.62), color: on ? C.ink : C.gray }}>%</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* THE FLOOR, big, in the corner; the stars of the runs done under it. */
function FloorBadge({ floor, boss, stars, size }: { floor: number; boss: boolean; stars: number; size: number }) {
  return (
    <View pointerEvents="none" style={{ marginLeft: 10, marginTop: 8, alignItems: "center", minWidth: size * 1.3, paddingHorizontal: 8, paddingBottom: 4, backgroundColor: C.paper, borderWidth: 2.5, borderColor: boss ? BEST : C.ink, borderRadius: 6 }}>
      <Text style={{ fontFamily: F.monoBold, fontSize: Math.max(10, Math.round(size * 0.2)), letterSpacing: 1.5, color: boss ? BEST : C.soft, marginTop: 3 }}>{boss ? "BOSS" : "FLOOR"}</Text>
      <Text style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.08), color: boss ? BEST : C.ink, fontVariant: ["tabular-nums"] }}>{`${floor}`}</Text>
      {stars > 0 ? <Text style={{ fontFamily: F.black, fontSize: Math.round(size * 0.26), color: DOT_ON }}>{"★".repeat(Math.min(5, stars))}</Text> : null}
    </View>
  );
}

function Battle(p: P) {
  const { v, width, height, wall, rt, myM, paint, hop } = p;
  const tag = useTag(v);
  const shown = useShown(v.battle?.skills ?? [], wall);
  const run = useRun();
  const b = v.battle;
  if (!b) return null;
  const wide = width > height * 1.1;
  /* The rings: as big as the stage lets them be. */
  const RING = Math.round(wide ? Math.min(96, height * 0.22) : Math.min(84, width * 0.2));
  const FOOT = wide ? 0 : Math.round(RING * 1.42 + 34);
  const g = { W: width, H: Math.max(120, height - FOOT) };
  const geo = boardOf(g.W, g.H);
  const k = geo.unit / 64;
  const rate = Math.max(0.2, v.rate);
  const wallAt = (at: number) => wall - (rt - at) / rate;
  const FLY = 0.38;
  const FLY_HIT = 0.65;
  const meS = sOf(geo, myM);
  const at = pieceAt(geo, meS);
  const mx = geo.cx;
  const my = geo.cy + geo.unit * 0.05;
  const mr = geo.unit * 0.56;
  const thrown = b.hits.filter((h) => !h.dot);
  const lastHit = thrown[thrown.length - 1];
  const hitE = lastHit ? wall - wallAt(lastHit.at) : 99;
  const pieces: Piece[] = [{ id: "me", paint, s: meS, hop, wobble: hitE >= 0 && hitE < 0.3 ? 0.5 * (1 - hitE / 0.3) : 0, label: tag, mine: true, firing: b.shots.some((s) => wall - wallAt(s.at) < FLY) }];
  const shots: ReactElement[] = [];
  const pops: ReactNode[] = [];
  const mine: { n: number; kb: number; slot: number; dmg: number }[] = [];
  let hurt = 0;
  let inAir = 0;
  for (const s of b.shots) {
    const e = (wall - wallAt(s.at)) / FLY;
    if (e < 0) {
      if (b.monster && s.monster === b.monster.i) inAir += s.dmg;
      continue;
    }
    if (e > 4) continue;
    if (e < 1 && b.monster && s.monster === b.monster.i) inAir += s.dmg;
    const R0 = SLOT_R[s.slot] * k + 1.5;
    const col = SLOT_COLOR[s.slot];
    if (e < 1) {
      const x = at.x + (mx - at.x) * e;
      const y = at.y + (my - at.y) * e - Math.sin(e * Math.PI) * (18 + 10 * s.slot) * k;
      shots.push(<Ellipse key={`w${s.n}`} cx={x} cy={at.y + (my - at.y) * e + 9 * k} rx={R0 * 0.8} ry={R0 * 0.28} fill={C.ink} fillOpacity={0.15} />);
      shots.push(<Circle key={`s${s.n}`} cx={x} cy={y} r={R0} fill={col} stroke={C.ink} strokeWidth={1.6} />);
    } else {
      const kb = (e - 1) * FLY;
      if (kb < 0.3) {
        hurt = Math.max(hurt, 0.6 * (1 - kb / 0.3));
        const big = s.slot === 2;
        shots.push(<Path key={`h${s.n}`} d={burst(mx + ((s.n * 37) % 21) - 10, my + ((s.n * 53) % 17) - 8, (big ? 26 : 12 + 4 * s.slot) * k * (0.6 + kb * 2), (big ? 13 : 6 + 2 * s.slot) * k, 8, s.n)} fill={big ? DOT_ON : C.paper} stroke={col} strokeWidth={2} strokeLinejoin="round" opacity={1 - kb / 0.3} />);
      }
      if (kb < POP_LIFE) mine.push({ n: s.n, kb, slot: s.slot, dmg: s.dmg });
    }
  }
  /* The monster's throws: a rock at the piece. In overtime the hull drains
   * by itself, and no rock flies. */
  for (const h of b.hits) {
    if (h.dot) continue;
    const e = (wall - wallAt(h.at - FLY_HIT * rate)) / FLY_HIT;
    if (e < 0 || e > 3) continue;
    const R = (h.boss ? 15 : 10) * k + 3;
    if (e < 1) {
      for (let j = 3; j >= 1; j--) {
        const u = e - j * 0.07;
        if (u <= 0) continue;
        shots.push(<Circle key={`mt${h.n}-${j}`} cx={mx + (at.x - mx) * u} cy={my + (at.y - my) * u - Math.sin(u * Math.PI) * 40 * k} r={R * (1 - j * 0.2)} fill={h.boss ? BEST : C.ink} fillOpacity={0.25 - j * 0.06} />);
      }
      const x = mx + (at.x - mx) * e;
      const y = my + (at.y - my) * e - Math.sin(e * Math.PI) * 40 * k;
      shots.push(<Ellipse key={`ms${h.n}`} cx={mx + (at.x - mx) * e} cy={my + (at.y - my) * e + 10 * k} rx={R * 0.9} ry={R * 0.3} fill={C.ink} fillOpacity={0.15} />);
      shots.push(<Path key={`m${h.n}`} d={burst(x, y, R, R * 0.72, 5, e * 9)} fill={h.boss ? BEST : C.gray} stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />);
    } else {
      const kb = (e - 1) * FLY_HIT;
      if (kb < 0.3) shots.push(<Path key={`mh${h.n}`} d={burst(at.x, at.y, 22 * k * (0.6 + kb * 2), 10 * k, 8, h.n)} fill={BEST} fillOpacity={0.85} stroke={C.ink} strokeWidth={1.8} opacity={1 - kb / 0.3} />);
      if (kb < POP_LIFE) pops.push(<DmgPop key={`mp${h.n}`} x={at.x + (h.n % 2 ? 22 : -22)} y={Math.max(30, at.y - geo.unit * 0.95)} text={`−${Math.max(1, Math.round(h.dmg))}`} size={26} color={BEST} e={kb} />);
    }
  }
  const m = b.monster;
  const barW = Math.round(Math.min(g.W * 0.5, Math.max(150, mr * 3.2)));
  const nameSize = Math.round(Math.min(30, Math.max(18, g.W / 22)));
  const barTop = my - mr * 1.3 - 24 - nameSize * 1.3;
  /* Your hits: the newest five, one to a column, over the monster's bar. */
  const colW = Math.min(70, (g.W - 40) / 5);
  for (const d of mine.sort((a, z) => a.kb - z.kb).slice(0, 5)) {
    const c = (d.n % 5) - 2;
    pops.push(<DmgPop key={`p${d.n}`} x={mx + c * colW} y={Math.max(24, barTop - 6 - (d.n % 2) * 16)} text={`−${d.dmg}`} size={[24, 30, 40][d.slot]} color={SLOT_COLOR[d.slot]} e={d.kb} />);
  }
  const ko = b.kos[b.kos.length - 1];
  const koE = ko ? wall - wallAt(ko.at) - FLY : 99;
  const KO_W = 0.7;
  let monster: ReactNode = null;
  if (ko && koE < KO_W && (!m || wallAt(m.born) > wall - 0.05)) {
    monster = <MonsterG x={mx} y={my} r={mr} n={ko.n} boss={ko.boss} seed={ko.seed} t={wall} hurt={koE < 0.2 ? 1 : 0} ko={clamp(koE / KO_W)} />;
  } else if (m) {
    const born = clamp((wall - wallAt(m.born)) / 0.5);
    monster = <MonsterG x={mx} y={my} r={mr} n={m.n} boss={m.boss} seed={m.seed} t={wall} hurt={hurt} born={born} lookX={(at.x - mx) / (geo.W * 0.4)} />;
  }
  /* The word over the board. */
  const ev = b.event;
  const evE = ev ? wall - wallAt(ev.at) - FLY : 99;
  const evOn = !!ev && ev.kind !== "floor" && evE >= 0 && evE < 3.4;
  const word = evOn
    ? ev.kind === "clear"
      ? { big: "BOSS DOWN", small: `ON TO ${ZONES[zoneOf(ev.floor + 1)].name}`, c: C.good }
      : ev.kind === "run"
        ? { big: "RUN COMPLETE", small: "★ A STAR: MORE DAMAGE FOR GOOD", c: C.accent }
        : { big: "RUN LOST", small: "ROW ON · A NEW RUN NEXT ROW", c: BEST }
    : ko && koE >= 0 && koE < 1.6
      ? { big: `${ko.name} DOWN`, small: `+${ko.xp} XP`, c: C.good }
      : null;
  const hp = m ? Math.min(m.max, m.hp + inAir) : 0;
  const resting = !m && !b.lost && !b.out && !(ko && koE < KO_W);
  const floorNow = m ? m.floor : b.at + 1;
  const zone = zoneOf(floorNow);
  /* EASED IN after the intro: the board rises and the bars come after. */
  const inE = ease((wall - v.sinceWall) / 1.1);
  const inBars = ease((wall - v.sinceWall - 0.7) / 0.6);
  const ringOn = (s: SkillView) => !!m && s.q > 0;
  const rings = (
    <View style={{ flexDirection: "row", columnGap: Math.round(RING * 0.22), alignItems: "flex-end" }}>
      {b.skills.map((s) => (
        <SkillRing key={s.def.id} s={s} k={shown(s)} size={RING} on={ringOn(s)} />
      ))}
    </View>
  );
  const hullW = wide ? Math.round(Math.min(g.W * 0.36, 300)) : g.W - 28;
  const hullBar = <LifeBar h={b.hull} max={b.hullMax} color={b.hull / Math.max(1, b.hullMax) < 0.3 ? BEST : C.accent} width={hullW} height={wide ? 20 : 18} wall={wall} />;
  const board = (
    <View style={{ width: g.W, height: g.H, opacity: inE, transform: [{ translateY: (1 - inE) * 40 }, { scale: 0.94 + 0.06 * inE }] }}>
      <Board W={g.W} H={g.H} pieces={pieces} t={wall} uid="isle" palm={false} zone={zone}>
        {monster}
        {shots}
      </Board>
      {m && !(ko && koE < KO_W && wallAt(m.born) > wall - 0.05) ? (
        <View pointerEvents="none" style={{ position: "absolute", left: mx - (barW + 80) / 2, top: barTop, width: barW + 80, alignItems: "center", opacity: inBars }}>
          <LifeBar name={m.name} nameColor={m.boss ? BEST : C.ink} size={nameSize} h={Math.ceil(hp)} max={m.max} color={m.boss ? BEST : C.ink} width={barW} height={16} wall={wall} />
          {b.overtime ? <Text style={{ fontFamily: F.black, fontSize: Math.round(nameSize * 0.8), color: BEST, marginTop: 2 }}>OVERTIME</Text> : null}
        </View>
      ) : null}
      {resting ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: my - mr * 0.6, alignItems: "center" }}>
          <Text style={{ fontFamily: F.black, fontSize: Math.round(nameSize * 1.5), color: C.ink, opacity: 0.55 + 0.45 * Math.abs(Math.sin(wall * 1.6)) }}>REST</Text>
          <Text style={{ fontFamily: F.black, fontSize: Math.round(nameSize * 0.8), color: C.soft }}>{isBossFloor(b.at) ? `THE BOSS IS NEXT` : `FLOOR ${b.at + 1} NEXT`}</Text>
        </View>
      ) : null}
      {b.lost && !evOn ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: my - mr * 0.6, alignItems: "center" }}>
          <Text style={{ fontFamily: F.black, fontSize: Math.round(nameSize * 1.3), color: BEST }}>RUN LOST</Text>
          <Text style={{ fontFamily: F.black, fontSize: Math.round(nameSize * 0.7), color: C.soft }}>A NEW RUN NEXT ROW</Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, opacity: inBars }}>
        <FloorBadge floor={floorNow} boss={!!m?.boss || (resting && isBossFloor(b.at))} stars={run.stars + b.runsDone} size={wide ? Math.round(Math.min(52, height * 0.12)) : 40} />
      </View>
      {word ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 8, alignSelf: "center", alignItems: "center", backgroundColor: C.paper, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 2.5, borderColor: C.ink, borderRadius: 6, maxWidth: g.W - 140 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: evOn ? 30 : 24, color: word.c }}>
            {word.big}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1, color: C.soft }}>
            {word.small}
          </Text>
        </View>
      ) : null}
      {wide && !b.lost ? (
        <>
          <View pointerEvents="none" style={{ position: "absolute", left: 12, bottom: 12, opacity: inBars, padding: 6, backgroundColor: C.paper, borderRadius: 6 }}>{hullBar}</View>
          <View pointerEvents="none" style={{ position: "absolute", right: 10, bottom: 8, opacity: inBars, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: C.paper, borderRadius: 10 }}>{rings}</View>
        </>
      ) : null}
    </View>
  );
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      {board}
      {pops}
      {!wide ? (
        <View style={{ height: FOOT, paddingHorizontal: 14, paddingTop: 6, alignItems: "center", rowGap: 4, opacity: inBars }}>
          {b.lost ? null : hullBar}
          {rings}
        </View>
      ) : null}
    </View>
  );
}
const isBossFloor = (i: number) => i % 5 === 4;

/* ---- the intro: 125 m (owner, 2026-11-24: "Don't show coins"; show "your
 * level, your upgrades ... your skills, and the difficulty: the paces your
 * skills fire at"; "animate your character hitting a training dummy with
 * your skills"; then "ease into the battle screen") --------------------- */

/* A training dummy: a post, a sack, a target painted on it. */
function Dummy({ x, y, s, hurt, t }: { x: number; y: number; s: number; hurt: number; t: number }) {
  const tilt = hurt * 10 * Math.sin(t * 30);
  return (
    <G transform={`translate(${x} ${y}) rotate(${tilt.toFixed(2)})`}>
      <Rect x={-s * 0.07} y={-s * 0.2} width={s * 0.14} height={s * 0.9} fill="#B07A4A" stroke={C.ink} strokeWidth={2} />
      <Rect x={-s * 0.55} y={-s * 0.62} width={s * 1.1} height={s * 0.12} rx={s * 0.05} fill="#B07A4A" stroke={C.ink} strokeWidth={2} />
      <Ellipse cx={0} cy={-s * 0.5} rx={s * 0.36} ry={s * 0.46} fill={hurt > 0.3 ? C.paper : "#E8D3A2"} stroke={C.ink} strokeWidth={2.5} />
      <Circle cx={0} cy={-s * 0.5} r={s * 0.2} fill="none" stroke={BEST} strokeWidth={3} />
      <Circle cx={0} cy={-s * 0.5} r={s * 0.07} fill={BEST} />
      <Circle cx={0} cy={-s * 1.04} r={s * 0.17} fill="#E8D3A2" stroke={C.ink} strokeWidth={2.5} />
    </G>
  );
}

function SoloIntro({ v, width, height, wall, myM, paint, hop, showed }: P) {
  const ctx = showed.ctx.current;
  const boat = useBoat();
  const prog = useProgress();
  const run = useRun();
  const wide = width > height * 1.1;
  const e = wall - v.sinceWall;
  const M = INTRO_M * v.scale;
  const k = clamp(myM / Math.max(1, M));
  const word = editionWord();
  const base = Math.round(ctx.assigned ?? TARGET) + easeOf(boat.ease);
  const skills = KIT.map((d) => skillAt(d, base));
  /* The dummy is hit by each skill at its own beat, by the wall. */
  const beats = [0.7, 1.6, 3.1];
  const RING = Math.round(wide ? Math.min(78, height * 0.18) : Math.min(70, width * 0.17));
  const ups: [string, number][] = [
    ["DAMAGE", boat.dmg],
    ["HULL", boat.hull],
    ["QUICK", boat.quick],
    ["EASE", boat.ease],
  ];
  const fade = (i: number) => ({ opacity: clamp((e - 0.3 - i * 0.3) / 0.4), transform: [{ translateY: (1 - ease((e - 0.3 - i * 0.3) / 0.4)) * 16 }] });
  const artW = wide ? width * 0.42 : width;
  const artH = wide ? height - 70 : Math.max(120, height * 0.34);
  const ts = Math.min(artH * 0.5, artW * 0.28, 100);
  const tx = artW * 0.16;
  const ty = artH * 0.62;
  const dx = artW * 0.74;
  const dy = artH * 0.8;
  const ds = Math.min(artH * 0.5, 90);
  const throws: ReactElement[] = [];
  let hurt = 0;
  beats.forEach((beat, slot) => {
    const ph = ((e + slot * 0.37) % beat) / beat;
    const fly = 0.42 / beat;
    const u = ph / fly;
    if (u < 1) {
      const x = tx + ts * 0.3 + (dx - tx - ts * 0.3) * u;
      const y = ty - ts * 0.45 + (dy - ds * 0.5 - (ty - ts * 0.45)) * u - Math.sin(u * Math.PI) * (26 + slot * 10);
      throws.push(<Circle key={`t${slot}`} cx={x} cy={y} r={5 + slot * 3} fill={SKILL_COLOR[slot]} stroke={C.ink} strokeWidth={1.6} />);
    } else if (u < 1.6) {
      const kb = (u - 1) / 0.6;
      hurt = Math.max(hurt, 1 - kb);
      throws.push(<Path key={`b${slot}`} d={burst(dx, dy - ds * 0.5, (12 + slot * 6) * (0.6 + kb), 6 + slot * 2, 8, slot)} fill={slot === 2 ? DOT_ON : C.paper} stroke={SKILL_COLOR[slot]} strokeWidth={2} opacity={1 - kb} />);
    }
  });
  const art = (
    <View style={{ width: artW, height: artH }}>
      <Svg width={artW} height={artH} style={{ position: "absolute", left: 0, top: 0 }}>
        <Ellipse cx={artW / 2} cy={dy + 6} rx={artW * 0.46} ry={12} fill={C.line} />
        <Dummy x={dx} y={dy} s={ds} hurt={hurt} t={wall} />
        {throws}
      </Svg>
      <View style={{ position: "absolute", left: tx - ts * 0.6, top: ty - ts * 0.9 }}>
        <TokenArt paint={paint} size={ts} t={wall} hop={hop} look={1} uid="intro" />
      </View>
    </View>
  );
  const facts = (
    <View style={{ rowGap: wide ? 8 : 6, flex: wide ? 1 : undefined }}>
      <View style={[{ flexDirection: "row", alignItems: "baseline", columnGap: 18 }, fade(0)]}>
        <View>
          <Eyebrow>Level</Eyebrow>
          <Num size={wide ? 40 : 34}>{`${prog.level}`}</Num>
        </View>
        <View>
          <Eyebrow>{run.at ? "Back to" : "Run"}</Eyebrow>
          <Num size={wide ? 40 : 34}>{run.at ? `FLOOR ${run.at + 1}` : `${run.run + 1}`}</Num>
        </View>
        {run.stars ? (
          <View>
            <Eyebrow>Stars</Eyebrow>
            <Num size={wide ? 40 : 34} color={C.ink}>{`★${run.stars}`}</Num>
          </View>
        ) : null}
      </View>
      <View style={[{ flexDirection: "row", columnGap: 14, flexWrap: "wrap" }, fade(1)]}>
        {ups.map(([n, lv]) => (
          <Text key={n} style={{ fontFamily: F.black, fontSize: wide ? 17 : 15, color: lv ? C.ink : C.gray }}>{`${n} ${lv}`}</Text>
        ))}
      </View>
      <View style={[{ flexDirection: "row", columnGap: Math.round(RING * 0.25), marginTop: 2 }, fade(2)]}>
        {skills.map((s) => (
          <SkillRing key={s.def.id} s={s} k={0} size={RING} on />
        ))}
      </View>
    </View>
  );
  return (
    <View style={{ width, height, overflow: "hidden", paddingHorizontal: 18, paddingTop: 8 }}>
      <View style={{ opacity: clamp(e / 0.4) }}>
        <Eyebrow style={{ color: C.ink }}>{`${word} presents`}</Eyebrow>
        <Big text="THE ARCADE" width={width - 36} max={wide ? 40 : 36} align="left" />
      </View>
      {wide ? (
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          {facts}
          {art}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {facts}
          {art}
        </View>
      )}
      <View style={{ paddingBottom: 10 }}>
        <View style={{ height: 10, backgroundColor: C.line, borderRadius: 5, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(k * 100)}%`, height: 10, backgroundColor: C.ink }} />
        </View>
      </View>
    </View>
  );
}

/* ---- THE DRAG RACE to the line (owner, 2026-11-24: the crawl to the
 * finish was "the worst part"; "a drag race against a ghost", a real
 * rower's pace that rises and falls). Two lanes from level at the
 * kick-out to the line; the ghost is a saved row's own last stretch. */
function DragRace(p: P) {
  const { v, width, height, wall, rt, myM, paint, hop, showed } = p;
  const d = v.drag;
  const T = v.target;
  if (!d || T <= 0) return <Finish {...p} />;
  const span = Math.max(1, T - d.m0);
  const gm = Math.min(T, showed.show.current?.dragM(rt) ?? d.m0);
  const me = Math.min(T, myM);
  const left = Math.max(0, T - me);
  const lead = me - gm;
  const laneH = Math.min(height * 0.3, 120);
  const top = height * 0.3;
  const lineX = width - 46;
  const x0 = 20;
  const xOf = (m: number) => x0 + ((m - d.m0) / span) * (lineX - x0 - 60);
  const size = Math.min(laneH * 0.9, 80);
  const sq = 12;
  const rows = Math.ceil((laneH * 2) / sq);
  const lane = (y: number) => <Rect x={0} y={y} width={width} height={laneH} fill={C.accent} fillOpacity={0.1} />;
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {lane(top)}
        {lane(top + laneH + 6)}
        {Array.from({ length: 12 }, (_, i) => {
          const wx = ((((i * 97 + 13) % width) - wall * 90 * (0.6 + (i % 3) * 0.3)) % (width + 40) + width + 40) % (width + 40) - 20;
          const wy = top + 8 + ((i * 53) % Math.max(20, laneH * 2 - 10));
          return <Path key={`w${i}`} d={`M${wx.toFixed(1)} ${wy.toFixed(1)} q4 -3.5 8 0 t8 0`} stroke={C.accent} strokeOpacity={0.45} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
        })}
        {Array.from({ length: rows }, (_, j) => [0, 1].map((i) => ((i + j) % 2 === 0 ? <Rect key={`${i}-${j}`} x={lineX + i * sq} y={top + j * sq} width={sq} height={sq} fill={C.ink} /> : null)))}
      </Svg>
      <View style={{ position: "absolute", left: xOf(me) - size * 0.3, top: top + laneH - size * 0.95 }}>
        <TokenArt paint={paint} size={size} t={wall} trail hop={hop} look={1} uid="drag-me" />
      </View>
      <View style={{ position: "absolute", left: xOf(gm) - size * 0.3, top: top + laneH * 2 + 6 - size * 0.95, opacity: 0.55 }}>
        <TokenArt paint={oppPaint(d.id)} size={size} t={wall} trail hop={botHop(d.id, rt)} look={1} uid="drag-ghost" />
      </View>
      <Text numberOfLines={1} style={{ position: "absolute", left: 14, top: top + laneH * 2 + 10, fontFamily: F.black, fontSize: 18, color: C.soft }}>{d.name.toUpperCase()}</Text>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Big text={`${fmtInt(Math.ceil(left))} M`} width={width * 0.5} max={56} align="left" />
        <Text style={{ fontFamily: F.black, fontSize: 30, color: lead >= 0 ? C.good : BEST, fontVariant: ["tabular-nums"] }}>{`${lead >= 0 ? "+" : "−"}${fmtInt(Math.abs(Math.round(lead)))} M`}</Text>
      </View>
    </View>
  );
}

/* ---- the summary, after the chest ------------------------------------------ */

/* THE GAME'S SUMMARY (owner, 2026-11-24: "XP gained, item gained, number of
 * people killed, things like that"). It stays up once the chest is done. */
function Summary({ v, width, height, wall, paint }: P) {
  const b = v.battle;
  const e = wall - v.sinceWall;
  const items = v.final?.chest.items ?? [];
  const from = Math.max(0, v.xpStart);
  const lv = levelOf(from + v.xpRow);
  const up = lv.level > levelOf(from).level;
  const rows: [string, string][] = b
    ? [
        ["XP", `+${fmtInt(v.xpRow)}`],
        ["Floors beaten", `${b.kills}`],
        ["Bosses", `${b.bosses}`],
        ["Furthest", `FLOOR ${b.best}`],
        ["Coins · your meters", `+${fmtInt(v.coins)}`],
        ["Wrecked", `${b.wrecks}`],
        ...(v.swarmTot.rounds ? ([["Fish", `${v.swarmTot.kills}`]] as [string, string][]) : []),
      ]
    : [
        ["XP", `+${fmtInt(v.xpRow)}`],
        ["Matches", `${v.matches}`],
      ];
  const wide = width >= 520;
  const tk = Math.min(wide ? height * 0.36 : width * 0.22, 96);
  return (
    <View style={{ width, height, paddingHorizontal: 16, paddingTop: 10, overflow: "hidden" }}>
      <Eyebrow style={{ color: C.ink }}>The piece is done</Eyebrow>
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 30, lineHeight: 38, color: up ? C.accent : C.ink }}>
        {up ? `LEVEL ${lv.level}!` : "THE SUMMARY"}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
        {rows.map(([k2, val], i) => (
          <View key={k2} style={{ width: wide ? "33.3%" : "50%", paddingVertical: 4, opacity: clamp((e - 0.2 - i * 0.15) / 0.3) }}>
            <Eyebrow>{k2}</Eyebrow>
            <Num size={wide ? 26 : 24} color={k2 === "XP" ? C.accent : k2 === "Wrecked" && val !== "0" ? BEST : C.ink}>
              {val}
            </Num>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 12, marginTop: 8 }}>
        <TokenArt paint={paint} size={tk} t={wall} hop={0} look={0} uid="summary" />
        <View style={{ flex: 1, rowGap: 4 }}>
          <Eyebrow>{items.length > 1 ? "Items" : "Item"}</Eyebrow>
          {items.map((id, i) => (
            <Text key={`${id}${i}`} numberOfLines={1} style={{ fontFamily: F.black, fontSize: 18, color: C.ink }}>
              {SKIN_BY_ID[id]?.name ?? id}
            </Text>
          ))}
          <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1, color: C.soft }}>{b ? "COINS BUY UPGRADES: YOUR PROFILE, THE ARCADE TAB" : "ON YOUR ROW'S PAGE, WITH EQUIP"}</Text>
        </View>
      </View>
    </View>
  );
}

/* ---- the celebration ------------------------------------------------------- */

function Celebrate({ v, erg, width, height, wall, showed, paint }: P) {
  const r = v.result;
  if (!r) return null;
  const e = wall - v.sinceWall;
  const ctx = showed.ctx.current;
  const wide = width >= 520;
  const head = r.result === "win" ? "YOU WIN" : r.result === "draw" ? "A DRAW" : "YOU LOSE";
  const why = r.called ? "TIME · MORE HEALTH WINS" : r.result === "win" ? `${r.opp.name.toUpperCase()} IS OUT` : r.result === "loss" ? "OUT OF HEALTH" : "";
  /* The bar fills from the XP before the match to after it, a level at a
   * time. */
  const k = ease((e - 0.6) / 2.2);
  const xpNow = r.xpBefore + r.xp * k;
  const lv = levelOf(xpNow);
  const lvWas = levelOf(r.xpBefore).level;
  const life = ctx.lifetime + r.fromM + r.rowed * ease((e - 0.8) / 2.6);
  const elo = Math.round(r.eloBefore + (r.eloAfter - r.eloBefore) * ease((e - 1.6) / 1.2));
  const dElo = r.eloAfter - r.eloBefore;
  const statsW = wide ? width * 0.5 : width;
  const stats = (
    <View style={{ width: statsW, paddingHorizontal: 16, paddingTop: 8, rowGap: 4 }}>
      <View style={{ transform: [{ scale: 0.7 + 0.3 * pop(e / 0.5) }], alignSelf: "flex-start" }}>
        <Big text={head} width={statsW - 32} max={36} color={r.result === "win" ? C.good : r.result === "loss" ? BEST : C.ink} align="left" />
      </View>
      {why ? <Text style={{ fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1.4, color: C.soft }}>{why}</Text> : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <Eyebrow style={{ color: C.ink }}>{`Level ${lv.level}${lv.level > lvWas ? " · UP!" : ""}`}</Eyebrow>
        <Num size={22} color={C.accent}>{`+${fmtInt(r.xp * k)} XP`}</Num>
      </View>
      <View style={{ height: 12, backgroundColor: C.line }}>
        <View style={{ width: `${Math.round((100 * lv.into) / lv.need)}%`, height: 12, backgroundColor: C.accent }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <Eyebrow>Lifetime</Eyebrow>
        <Num size={22}>{`${fmtInt(life)} m`}</Num>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Eyebrow>Rating</Eyebrow>
        {erg.demo ? (
          <Num size={22} color={C.gray}>{`${r.eloBefore} · DEMO, NOT RATED`}</Num>
        ) : (
          <Num size={22} color={dElo > 0 ? C.good : dElo < 0 ? BEST : C.ink}>{`${elo} ${dElo > 0 ? "▲" : dElo < 0 ? "▼" : ""}${dElo ? Math.abs(dElo) : ""}`}</Num>
        )}
      </View>
    </View>
  );
  const chestW = wide ? width - statsW : width;
  const chestH = wide ? height : Math.max(160, height - 228);
  /* NO CHEST HERE (owner, 2026-11-24: "remove the treasure chest animation
   * from mid-row. There is only ONE loot box, at the very end of the
   * row"): the rower's own piece, hopping on a win. */
  const tk = Math.min(chestW * 0.5, chestH * 0.7, 150);
  const chest = (
    <View style={{ width: chestW, height: chestH, alignItems: "center", justifyContent: "center" }}>
      <TokenArt paint={paint} size={tk} t={wall} hop={r.result === "win" ? Math.abs(Math.sin(e * 5)) : 0} look={0} uid="celebrate" />
    </View>
  );
  return wide ? (
    <View style={{ width, height, flexDirection: "row" }}>
      {stats}
      {chest}
    </View>
  ) : (
    <View style={{ width, height }}>
      {stats}
      <View style={{ position: "absolute", bottom: 0 }}>{chest}</View>
    </View>
  );
}

/* ---- the level up, at 90% -------------------------------------------------- */

function LevelUp({ v, width, height, wall, paint, hop }: P) {
  const e = wall - v.sinceWall;
  const from = Math.max(0, v.xpStart);
  const k = ease((e - 0.5) / 3);
  const xp = from + v.xpRow * k;
  const was = levelOf(from).level;
  const lv = levelOf(xp);
  const up = lv.level > was;
  /* Whether the row's XP makes a level by the end of the count. */
  const upEnd = levelOf(from + v.xpRow).level > was;
  const size = Math.min(width * 0.28, height * 0.28, 118);
  return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, rowGap: 6 }}>
      <View style={{ transform: [{ scale: up ? 0.8 + 0.2 * pop((e - 3.4) / 0.5) : 1 }] }}>
        <Big text={up && e > 3.4 ? `LEVEL ${lv.level}!` : upEnd ? "LEVEL UP" : "THIS ROW'S XP"} width={width - 32} max={46} color={up && e > 3.4 ? C.accent : C.ink} />
      </View>
      <View style={{ width: (76 * size) / TOKEN_U, height: (72 * size) / TOKEN_U }}>
        {/* The light behind the piece once the level is made, turning. */}
        {up && e > 3.4 ? (
          <Svg width={size * 3} height={size * 3} style={{ position: "absolute", left: (36 * size) / TOKEN_U - size * 1.5, top: (52 * size) / TOKEN_U - size * 1.5 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + e * 0.5;
              const R = size * 1.45 * pop((e - 3.4) / 0.5) * (i % 2 ? 0.7 : 1);
              const w = 0.1;
              const c = size * 1.5;
              return <Path key={i} d={`M${c} ${c} L${c + Math.cos(a - w) * R} ${c + Math.sin(a - w) * R} L${c + Math.cos(a + w) * R} ${c + Math.sin(a + w) * R}Z`} fill={C.accent} fillOpacity={i % 2 ? 0.14 : 0.24} />;
            })}
            {Array.from({ length: 6 }, (_, i) => {
              const a = (i / 6) * Math.PI * 2 - e * 0.7;
              const tw = Math.max(0, Math.sin(e * 4 + i * 1.9));
              return <Path key={`s${i}`} d={star(size * 1.5 + Math.cos(a) * size * 0.95, size * 1.5 + Math.sin(a) * size * 0.8, 3 + 7 * tw)} fill={DOT_ON} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />;
            })}
          </Svg>
        ) : null}
        <TokenArt paint={paint} size={size} t={wall} hop={up && e > 3.4 ? Math.abs(Math.sin((e - 3.4) * 5)) : hop} look={0} uid="levelup" />
      </View>
      <Num size={28} color={C.accent}>{`+${fmtInt(v.xpRow * k)} XP`}</Num>
      <Text style={{ fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1.4, color: C.soft }}>{v.battle ? `THIS ROW · ${v.battle.kills} ${v.battle.kills === 1 ? "FLOOR" : "FLOORS"}` : `THIS ROW'S MATCHES · ${v.matches} PLAYED`}</Text>
      <View style={{ width: Math.min(width - 40, 420), marginTop: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Eyebrow style={{ color: C.ink }}>{`Level ${lv.level}`}</Eyebrow>
          <Eyebrow>{`${fmtInt(lv.into)} / ${fmtInt(lv.need)}`}</Eyebrow>
        </View>
        <View style={{ height: 16, borderWidth: 2, borderColor: C.ink, marginTop: 4 }}>
          <View style={{ width: `${Math.round((100 * lv.into) / lv.need)}%`, height: "100%", backgroundColor: C.accent }} />
        </View>
      </View>
    </View>
  );
}

/* ---- the finish line, the last tenth --------------------------------------- */

function Finish({ v, width, height, wall, myM, paint, hop }: P) {
  const T = v.target;
  const stretch = T * 0.1;
  const left = Math.max(0, T - myM);
  const k = clamp(1 - left / Math.max(1, stretch));
  const laneY = height * 0.62;
  const lineX = width * 0.82;
  const size = Math.min(80, height * 0.22);
  /* The box's middle goes from the left edge to the line; the drawing has
   * its trail to the left of the box (TokenArt: the box's middle is 62 of
   * its 102 units across). */
  const mid = 24 + size * 0.5 + (lineX - 10 - size * 0.5 - 24 - size * 0.5) * k;
  const x = mid - (size * 62) / 64;
  const sq = 12;
  const rows = Math.ceil(height * 0.5 / sq);
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <Rect x={0} y={laneY - 4} width={width} height={height - laneY + 4} fill={C.accent} fillOpacity={0.12} />
        {Array.from({ length: 9 }, (_, i) => {
          const wx = ((((i * 97 + 13) % width) - wall * 34 * (0.6 + (i % 3) * 0.3)) % (width + 40) + width + 40) % (width + 40) - 20;
          const wy = laneY + size * 0.3 + ((i * 53) % Math.max(20, height - laneY - size * 0.4));
          return <Path key={`w${i}`} d={`M${wx.toFixed(1)} ${wy.toFixed(1)} q4 -3.5 8 0 t8 0`} stroke={C.accent} strokeOpacity={0.4} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
        })}
        <Line x1={0} y1={laneY + size * 0.12} x2={width} y2={laneY + size * 0.12} stroke={C.ink} strokeOpacity={0.25} strokeWidth={2} strokeDasharray="2 9" />
        {Array.from({ length: rows }, (_, j) =>
          [0, 1].map((i) => ((i + j) % 2 === 0 ? <Rect key={`${i}-${j}`} x={lineX + i * sq} y={height * 0.4 + j * sq} width={sq} height={sq} fill={C.ink} /> : null)),
        )}
        <Rect x={lineX} y={height * 0.4} width={sq * 2} height={rows * sq} fill="none" stroke={C.ink} strokeWidth={2} />
        {/* The flag over the line, flying. */}
        <Line x1={lineX + sq} y1={height * 0.4} x2={lineX + sq} y2={height * 0.4 - 46} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
        {Array.from({ length: 4 }, (_, i) =>
          [0, 1, 2].map((j) => {
            const fx = lineX + sq + 1.5 + i * 9;
            const fy = height * 0.4 - 45 + j * 8 + Math.sin(wall * 6 - i * 0.9) * (1 + i * 0.9);
            return <Rect key={`f${i}-${j}`} x={fx} y={fy} width={9} height={8} fill={(i + j) % 2 ? C.paper : C.ink} stroke={C.ink} strokeWidth={0.8} />;
          }),
        )}
      </Svg>
      <View style={{ position: "absolute", left: x, top: laneY - size * 0.95 }}>
        <TokenArt paint={paint} size={size} t={wall} trail hop={hop} look={1} uid="finish" />
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Eyebrow style={{ color: C.ink }}>The finish line</Eyebrow>
        <Big text={`LAST ${fmtInt(Math.ceil(left))} M`} width={width - 32} max={44} align="left" />
      </View>
    </View>
  );
}


/* ---- THE FINISH SCREEN (owner, 2026-11-24: on the rower, "the time first
 * and biggest, then meters and pace. Congratulations; lifetime meters can
 * tick up here"; then "he hangs up the handle and picks up the phone.
 * Turned upright, a Log it button appears"). The performance, the progress
 * and the boxes follow in the hand, on the row's page (AfterRow.tsx). ---- */
function EndScreen({ v, width, height, wall, paint, showed, logIt }: P) {
  const e = wall - v.sinceWall;
  const ctx = showed.ctx.current;
  const wide = width > height * 1.1;
  const secs = v.t;
  const pace = v.m > 0 ? (secs / v.m) * 500 : 0;
  const life = ctx.lifetime + v.m * ease((e - 1) / 2.5);
  const fade = (i: number) => ({ opacity: clamp((e - 0.2 - i * 0.3) / 0.4) });
  const b = v.battle;
  const line = b ? (b.lost ? `RUN LOST ON FLOOR ${b.at + 1}` : b.runsDone ? `RUN COMPLETE · ★ ${b.runsDone}` : `ON TO FLOOR ${b.at + 1} NEXT ROW`) : "";
  return (
    <View style={{ width, height, paddingHorizontal: 18, paddingTop: 10, overflow: "hidden" }}>
      <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, fade(0)]}>
        <Text style={{ fontFamily: F.black, fontSize: wide ? 24 : 22, color: C.accent }}>WELL ROWED</Text>
        <TokenArt paint={paint} size={wide ? 54 : 48} t={wall} hop={Math.abs(Math.sin(e * 4)) * 0.6} look={0} uid="end" />
      </View>
      <View style={fade(0)}>
        <Num size={Math.min(wide ? 110 : 92, width / 4.3, height * 0.32)}>{clockS(secs)}</Num>
      </View>
      <View style={[{ flexDirection: "row", columnGap: 26, marginTop: 4 }, fade(1)]}>
        <View>
          <Eyebrow>Meters</Eyebrow>
          <Num size={wide ? 40 : 32}>{fmtInt(v.m)}</Num>
        </View>
        <View>
          <Eyebrow>Pace</Eyebrow>
          <Num size={wide ? 40 : 32}>{pace ? fmtClock(pace) : "-:--.-"}</Num>
        </View>
      </View>
      <View style={[{ marginTop: 10 }, fade(2)]}>
        <Eyebrow>All-time meters</Eyebrow>
        <Num size={wide ? 30 : 26}>{fmtInt(life)}</Num>
        {line ? <Text style={{ fontFamily: F.black, fontSize: 16, color: b?.lost ? BEST : C.soft, marginTop: 6 }}>{line}</Text> : null}
      </View>
      <View style={{ flex: 1 }} />
      {wide ? (
        <Text style={[{ fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1.6, color: C.soft, paddingBottom: 10 }, fade(3)]}>PICK UP THE PHONE TO LOG IT</Text>
      ) : (
        <View style={[{ paddingBottom: 14 }, fade(3)]}>
          {logIt ? (
            <Pressable accessibilityRole="button" onPress={logIt} style={({ pressed }) => ({ backgroundColor: C.ink, borderRadius: 10, paddingVertical: 18, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ fontFamily: F.black, fontSize: 26, letterSpacing: 2, color: C.paper }}>LOG IT</Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: F.black, fontSize: 18, color: C.soft, textAlign: "center" }}>LOGGING…</Text>
          )}
        </View>
      )}
    </View>
  );
}
