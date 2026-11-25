import { useRef, type ReactElement, type ReactNode } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { DOT_ON, FlipDots, dotClock } from "../arcade/Art159";
import { useWallClock } from "../arcade/BoatArt";
import { Board, boardOf, pieceAt, sOf, type Piece } from "../arcade/Board";
import { ChestOpen } from "../arcade/Chest";
import { MonsterG } from "../arcade/Monster";
import { useBoat } from "../arcade/boat";
import { useLocker } from "../arcade/locker";
import { FILL_S, type MShot } from "../arcade/match";
import type { SkillView } from "../arcade/pve";
import { useProgress } from "../arcade/progress";
import { useRating } from "../arcade/rating";
import { levelOf } from "../arcade/score";
import { READY_S, type ShowView } from "../arcade/show";
import { SKIN_BY_ID, STOCK, wear } from "../arcade/skins";
import { TOKEN_U, TokenArt, ShotArt, star, type Paint } from "../arcade/Token";
import type { Showed } from "../arcade/useShow";
import { milestone } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
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
  const meters = target > 0 ? fmtInt(Math.max(0, Math.ceil(target - live.meters))) : fmtInt(Math.floor(live.meters));
  /* In his order and his words (2026-11-24: "meters to go, finish, current
   * pace, average pace. No '/500'"). */
  return [
    [target > 0 ? "Meters to go" : "Meters", meters, C.ink],
    ["Finish", live.ended ? clockS(live.elapsedS) : ms ? clockS(ms.projected) : target > 0 ? "--:--" : clockS(live.elapsedS), C.ink],
    ["Current pace", live.pace > 0 && live.pace < 600 ? fmtClock(live.pace) : "-:--.-", C.ink],
    ["Average pace", fmtPace(live.avgPace), C.accent],
  ];
}

/* The figures, across the top (upright: two by two) or down the side (on
 * its side). Returns the room it took. */
function Headline({ erg, width, height, wide }: { erg: Erg; width: number; height: number; wide: boolean }) {
  const figs = figures(erg);
  if (wide) {
    const size = Math.max(22, Math.min(36, Math.floor((height - 16) / 4) - 22, Math.floor((width - 28) / 4.3)));
    return (
      <View style={{ width, height, paddingLeft: 18, paddingRight: 14, justifyContent: "center", borderRightWidth: 1, borderColor: C.line }}>
        {figs.map(([k, v, c]) => (
          <View key={k} style={{ paddingVertical: 2 }}>
            <Eyebrow>{k}</Eyebrow>
            <Num size={size} color={c}>
              {v}
            </Num>
          </View>
        ))}
      </View>
    );
  }
  const size = Math.max(22, Math.min(36, Math.floor((width - 40) / 2 / 4.4)));
  return (
    <View style={{ width, height, flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 18, borderBottomWidth: 1, borderColor: C.line }}>
      {figs.map(([k, v, c], i) => (
        <View key={k} style={{ width: "50%", alignItems: i % 2 ? "flex-end" : "flex-start", paddingTop: 3 }}>
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
  const size = Math.max(22, Math.min(36, Math.floor((width - 40) / 2 / 4.4)));
  return 2 * (Math.round(size * 1.12) + 17) + 6;
};

/* The page or the overlay: the headline and the stage beside or under it. */
function Framed({ showed, erg, width, height, active }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean }) {
  const wide = width >= 520 && width > height;
  if (wide) {
    const SIDE = Math.round(Math.min(270, width * 0.3));
    return (
      <View style={{ width, height, flexDirection: "row", backgroundColor: C.paper }}>
        <Headline erg={erg} width={SIDE} height={height} wide />
        <Stage showed={showed} erg={erg} width={width - SIDE} height={height} active={active} />
      </View>
    );
  }
  const STRIP = stripOf(width);
  return (
    <View style={{ width, height, backgroundColor: C.paper }}>
      <Headline erg={erg} width={width} height={STRIP} wide={false} />
      <Stage showed={showed} erg={erg} width={width} height={height - STRIP} active={active} />
    </View>
  );
}

export function ShowPage({ showed, erg, width, height, active }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean }) {
  return <Framed showed={showed} erg={erg} width={width} height={height} active={active} />;
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

function Stage({ showed, erg, width, height, active }: { showed: Showed; erg: Erg; width: number; height: number; active: boolean }) {
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
  const p = { v, erg, width, height, wall, rt, myM, paint, hop, showed };
  switch (v.phase) {
    case "intro":
      return <Intro {...p} />;
    case "home":
    case "done":
      return <Home {...p} />;
    case "battle":
      return <Battle {...p} />;
    case "swarm":
      return <Swarm {...p} />;
    case "lobby":
      return <Lobby {...p} />;
    case "match":
      return <Match {...p} />;
    case "celebrate":
      return <Celebrate {...p} />;
    case "levelup":
      return <LevelUp {...p} />;
    case "finish":
      return <Finish {...p} />;
    case "summary":
      return <Summary {...p} />;
    case "chest":
      return v.final ? <ChestOpen chest={v.final.chest} at={v.sinceWall} t={wall} width={width} height={height} won note="THE PIECE IS DONE · A NEW ITEM" /> : null;
    default:
      return null;
  }
}

type P = { v: ShowView; erg: Erg; width: number; height: number; wall: number; rt: number; myM: number; paint: Paint; hop: number; showed: Showed };

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
  return (
    <View style={{ flex: 1 }}>
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
        <HealthBar name="YOU" h={me?.health ?? 0} max={me?.max ?? 1} mine wall={wall} />
        <HealthBar name={opp.name.toUpperCase()} h={op?.health ?? 0} max={op?.max ?? 1} mine={false} wall={wall} />
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
const SLOT_COLOR = ["#2BB673", "#0077B6", "#E2725B"];
const SLOT_R = [4.5, 7, 11];

/* THE COURSE ON THE MONITOR, after the owner's review of it (2026-11-24,
 * night): "floor 1, king crab, floor 2"; the monster's name "much larger,
 * maybe with an HP percent"; your HP as a number too; the three skills as
 * three boxes along the bottom "each showing a PERCENT charged", plain
 * about whether it is rising and how much faster to row to start it; no KO
 * or coin counters, no stray pace (the figures across the top already have
 * it); the health bars that do not shake.
 *
 *   upright   the floor and the monster across the top, big, its health
 *             under it; the board; the hull and the three boxes under it.
 *   on its    the figures down the left (Framed), the monster over the
 *   side      board, and the right column the same shape as the left: the
 *             hull at the top, then the three skills as big numbers. */
function Battle(p: P) {
  const { v, width, height, wall, rt, myM, paint, hop } = p;
  const b = v.battle;
  if (!b) return null;
  const wide = width >= 520 && width > height * 0.9;
  const HUD = wide ? 84 : 92;
  const PANEL = wide ? 0 : 154;
  const SIDE = wide ? Math.round(Math.min(250, width * 0.32)) : 0;
  const g = { W: width - SIDE, H: Math.max(120, height - HUD - PANEL) };
  const geo = boardOf(g.W, g.H);
  const k = geo.unit / 64;
  const rate = Math.max(0.2, v.rate);
  /* The wall's second something at the row's second `at` happened. */
  const wallAt = (at: number) => wall - (rt - at) / rate;
  const FLY = 0.38;
  /* The monster's throws fly slower and bigger, so they are seen. */
  const FLY_HIT = 0.65;
  const meS = sOf(geo, myM);
  const at = pieceAt(geo, meS);
  const mx = geo.cx;
  const my = geo.cy - geo.unit * 0.08;
  const mr = geo.unit * 0.42;
  /* The last hit on the hull, for the piece's wobble (a small one). */
  const lastHit = b.hits[b.hits.length - 1];
  const hitE = lastHit ? wall - wallAt(lastHit.at) : 99;
  const pieces: Piece[] = [{ id: "me", paint, s: meS, hop, wobble: hitE >= 0 && hitE < 0.3 ? 0.5 * (1 - hitE / 0.3) : 0, mine: true, firing: b.shots.some((s) => wall - wallAt(s.at) < FLY) }];
  const shots: ReactElement[] = [];
  const pops: ReactNode[] = [];
  let hurt = 0;
  /* What is still in the air on this monster: its health shows them when
   * they land, not when they leave. */
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
      if (kb < 1.1) {
        const dx = ((s.n * 41) % 60) - 30;
        const size = [20, 26, 34][s.slot];
        pops.push(
          <Text key={`p${s.n}`} style={{ position: "absolute", left: mx + dx - 60, width: 120, top: HUD + my - mr * 1.5 - kb * 34, textAlign: "center", fontFamily: F.black, fontSize: size, color: col, opacity: 1 - clamp((kb - 0.7) / 0.4), textShadowColor: C.paper, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } }}>
            {`−${s.dmg}`}
          </Text>,
        );
      }
    }
  }
  /* The monster's throws: a rock (a boss's bigger, red) that spins in an
   * arc at the piece and breaks on it. */
  for (const h of b.hits) {
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
      if (kb < 1)
        pops.push(
          <Text key={`mp${h.n}`} style={{ position: "absolute", left: at.x - 50, width: 100, top: HUD + at.y - geo.unit * 0.8 - kb * 28, textAlign: "center", fontFamily: F.black, fontSize: 24, color: BEST, opacity: 1 - clamp((kb - 0.6) / 0.4), textShadowColor: C.paper, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } }}>
            {`−${Math.max(1, Math.round(h.dmg))}`}
          </Text>,
        );
    }
  }
  /* The monster: rising out of the water, on the island, or going KO. The
   * KO plays once the throw that did it has landed. */
  const m = b.monster;
  const ko = b.kos[b.kos.length - 1];
  const koE = ko ? wall - wallAt(ko.at) - FLY : 99;
  const KO_S = 0.7;
  let monster: ReactNode = null;
  if (ko && koE < KO_S && (!m || wallAt(m.born) > wall - 0.05)) {
    monster = <MonsterG x={mx} y={my} r={mr} n={ko.n} boss={ko.boss} seed={ko.seed} t={wall} hurt={koE < 0.2 ? 1 : 0} ko={clamp(koE / KO_S)} />;
  } else if (m) {
    const born = clamp((wall - wallAt(m.born)) / 0.5);
    monster = <MonsterG x={mx} y={my} r={mr} n={m.n} boss={m.boss} seed={m.seed} t={wall} hurt={hurt} born={born} lookX={(at.x - mx) / (geo.W * 0.4)} />;
  }
  /* The word over the board: a boss down, a wreck, or a floor beaten. */
  const ev = b.event;
  const evE = ev ? wall - wallAt(ev.at) - FLY : 99;
  const evOn = !!ev && ev.kind !== "floor" && evE >= 0 && evE < 3.4;
  const word = evOn
    ? ev.kind === "clear"
      ? { big: "BOSS DOWN", small: `FLOOR ${ev.floor} CLEAR · THE HULL IS MENDED`, c: C.good }
      : { big: "WRECKED", small: "BACK TO FLOOR 1 · THE XP IS KEPT", c: BEST }
    : ko && koE >= 0 && koE < 1.8
      ? { big: `${ko.name} DOWN`, small: `FLOOR ${ko.floor} · +${ko.xp} XP`, c: C.good }
      : null;
  const hp = m ? Math.min(m.max, m.hp + inAir) : 0;
  const nextFloor = b.at + 1;
  const toBoss = 5 - (b.at % 5);
  const eyebrow = m ? `FLOOR ${m.floor}${m.boss ? " · THE BOSS" : toBoss > 1 ? ` · BOSS ON FLOOR ${m.floor + toBoss - 1}` : ""} · ITS PACE ${whole(m.pace)}` : `FLOOR ${nextFloor} · ITS PACE ${whole(b.floorPace)}`;
  const hudW = g.W - 28;
  const hud = (
    <View style={{ height: HUD, width: g.W, paddingHorizontal: 14, paddingTop: 4 }}>
      <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.2, color: m?.boss ? BEST : C.soft }}>
        {eyebrow}
      </Text>
      {m ? (
        <>
          <Big text={m.name} width={hudW} max={32} color={m.boss ? BEST : C.ink} align="left" />
          <HealthBar h={Math.ceil(hp)} max={m.max} mine={false} wall={wall} right={`· ${Math.ceil((100 * hp) / Math.max(1, m.max))}%`} />
        </>
      ) : (
        <Big text={b.event?.kind === "wreck" && wall - wallAt(b.event.at) < 8 ? "BACK TO FLOOR 1" : "THE NEXT FLOOR"} width={hudW} max={30} color={C.soft} align="left" />
      )}
    </View>
  );
  const board = (
    <View style={{ width: g.W, height: g.H }}>
      <Board W={g.W} H={g.H} pieces={pieces} t={wall} uid="isle" palm={false}>
        {monster}
        {shots}
      </Board>
      {word ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 6, alignSelf: "center", alignItems: "center", backgroundColor: C.paper, paddingHorizontal: 12, paddingVertical: 3, borderWidth: 2, borderColor: C.ink, borderRadius: 4, maxWidth: g.W - 16 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: evOn ? 26 : 20, color: word.c }}>
            {word.big}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1, color: C.soft }}>
            {word.small}
          </Text>
        </View>
      ) : null}
    </View>
  );
  if (wide)
    return (
      <View style={{ width, height, flexDirection: "row", overflow: "hidden" }}>
        <View style={{ width: g.W }}>
          {hud}
          {board}
          {pops}
        </View>
        <SkillColumn width={SIDE} height={height} hull={b.hull} hullMax={b.hullMax} skills={b.skills} pace={b.pace} wall={wall} dim={!m} />
      </View>
    );
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      {hud}
      {board}
      {pops}
      <SkillBoxes width={width} height={PANEL} hull={b.hull} hullMax={b.hullMax} skills={b.skills} pace={b.pace} wall={wall} dim={!m} />
    </View>
  );
}

/* ---- the skills, as the course and the swarm show them ------------------ */

/* Where a skill stands: RISING (and how fast), or STILL and how much
 * faster to row to start it ("make it clear when it's rising and when it's
 * still, and say how much faster you need to row"). */
function skillState(s: SkillView, pace: number, dim: boolean): { rising: boolean; line: string } {
  if (dim) return { rising: false, line: "WAITING" };
  if (s.q > 0) return { rising: true, line: s.q >= 1.05 ? `RISING ${s.q.toFixed(1)}×` : "RISING" };
  const off = Number.isFinite(pace) && pace > 0 && pace < 600 ? Math.max(0.1, pace - s.target) : NaN;
  return { rising: false, line: Number.isFinite(off) ? `${off.toFixed(1)}S FASTER` : `ROW ${whole(Math.round(s.target))}` };
}

/* Upright: the hull, and three boxes side by side. */
function SkillBoxes({ width, height, hull, hullMax, skills, pace, wall, dim }: { width: number; height: number; hull: number; hullMax: number; skills: SkillView[]; pace: number; wall: number; dim: boolean }) {
  const boxW = (width - 28 - 16) / 3;
  return (
    <View style={{ height, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 14, paddingTop: 6, rowGap: 6 }}>
      <HealthBar name="YOUR HULL" h={Math.ceil(hull)} max={hullMax} mine wall={wall} right={`/ ${hullMax}`} />
      <View style={{ flexDirection: "row", columnGap: 8 }}>
        {skills.map((s) => {
          const st = skillState(s, pace, dim);
          const col = SLOT_COLOR[s.def.slot];
          const pct = Math.floor(100 * clamp(s.charge));
          return (
            <View key={s.def.id} style={{ width: boxW, borderWidth: 2, borderColor: st.rising ? col : C.line, borderRadius: 6, paddingHorizontal: 7, paddingTop: 3, paddingBottom: 5, backgroundColor: C.paper, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 13, color: C.ink }}>
                  {s.def.name}
                </Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 10, color: C.soft }}>{whole(Math.round(s.target))}</Text>
              </View>
              <Num size={Math.min(32, Math.floor(boxW / 3.9))} color={st.rising ? col : C.gray}>{`${pct}%`}</Num>
              <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: boxW < 112 ? 9.5 : 10.5, letterSpacing: 0, color: st.rising ? C.good : BEST }}>
                {`${st.rising ? "▲" : "■"} ${st.line}`}
              </Text>
              <View style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${pct}%`, backgroundColor: col, opacity: st.rising ? 1 : 0.4 }} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* On its side: a right column the shape of the figures on the left, the
 * hull at the top and the three skills as its big numbers. */
function SkillColumn({ width, height, hull, hullMax, skills, pace, wall, dim }: { width: number; height: number; hull: number; hullMax: number; skills: SkillView[]; pace: number; wall: number; dim: boolean }) {
  const size = Math.max(20, Math.min(34, Math.floor((height - 16) / 4) - 36, Math.floor((width - 28) / 4.3)));
  return (
    <View style={{ width, height, paddingLeft: 14, paddingRight: 14, justifyContent: "center", borderLeftWidth: 1, borderColor: C.line, rowGap: 2 }}>
      <View style={{ paddingVertical: 2 }}>
        <Eyebrow>Your hull</Eyebrow>
        <Num size={size} color={hull / Math.max(1, hullMax) < 0.3 ? BEST : C.accent}>{`${Math.ceil(hull)}`}</Num>
        <View style={{ height: 8, backgroundColor: C.line, marginTop: 1 }}>
          <View style={{ width: `${(100 * clamp(hull / Math.max(1, hullMax))).toFixed(1)}%`, height: 8, backgroundColor: hull / Math.max(1, hullMax) < 0.3 ? BEST : C.accent }} />
        </View>
      </View>
      {skills.map((s) => {
        const st = skillState(s, pace, dim);
        const col = SLOT_COLOR[s.def.slot];
        const pct = Math.floor(100 * clamp(s.charge));
        return (
          <View key={s.def.id} style={{ paddingVertical: 2 }}>
            <Eyebrow>{`${s.def.name} · AT ${whole(Math.round(s.target))}`}</Eyebrow>
            <Num size={size} color={st.rising ? col : C.gray}>{`${pct}%`}</Num>
            <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 0.4, color: st.rising ? C.good : BEST }}>
              {`${st.rising ? "▲" : "■"} ${st.line}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ---- single player: the swarm (arcade/swarm.ts) ----------------------- */

const FISH_COLOR = ["#6EC6D9", "#F2A65A", "#F28CB1", "#9AA7B5"];

/* A fish from above, nose along `a`, its tail beating. */
function fishPath(x: number, y: number, a: number, L: number, t: number, seed: number): string {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P = (u: number, w: number) => `${(x + c * u - s * w).toFixed(1)} ${(y + s * u + c * w).toFixed(1)}`;
  const wag = Math.sin(t * 14 + seed) * L * 0.18;
  return `M${P(L * 0.55, 0)} Q${P(L * 0.1, L * 0.32)} ${P(-L * 0.3, 0)} Q${P(L * 0.1, -L * 0.32)} ${P(L * 0.55, 0)}Z M${P(-L * 0.25, 0)} L${P(-L * 0.62, L * 0.24 + wag)} L${P(-L * 0.62, -L * 0.24 + wag)}Z`;
}

/* THE SWARM ON THE MONITOR (owner, 2026-11-24: "I really like the view of
 * Vampire Survivors ... more things moving around, more things exploding").
 * Seen from above, the water going by under the boat; the fish closing in,
 * the skills going off round the boat, the XP the fish leave being drawn
 * in. SMOOTH (his review: "The boat and the timer jitter ... it looks
 * laggy"): the row's clock the show runs on is a smooth one (useRowClock),
 * everything is carried on from the last word at its own speed, and the
 * camera eases after the boat instead of jumping with it. No coin counter:
 * the round's fish and its clock. */
function Swarm(p: P) {
  const { v, width, height, wall, rt, paint, hop } = p;
  const s = v.swarm;
  const cam = useRef({ x: 0, y: 0, wall: 0, t0: -1 });
  if (!s) return null;
  const wide = width >= 520 && width > height * 0.9;
  const HUD = 58;
  const PANEL = wide ? 0 : 154;
  const SIDE = wide ? Math.round(Math.min(250, width * 0.32)) : 0;
  const W = width - SIDE;
  const H = Math.max(120, height - HUD - PANEL);
  const rate = Math.max(0.2, v.rate);
  const wallAt = (at: number) => wall - (rt - at) / rate;
  /* Carried on from the last word at the speeds it gave (back a little too,
   * when the smooth clock is behind it). */
  const ahead = s.over ? 0 : clamp(rt - s.t, -1, 1.5);
  const bx = s.x + s.vx * ahead;
  const by = s.y + s.vy * ahead;
  const C0 = cam.current;
  const dt = clamp(wall - C0.wall, 0, 0.25);
  C0.wall = wall;
  if (C0.t0 !== s.t0) {
    C0.x = bx;
    C0.y = by;
    C0.t0 = s.t0;
  } else {
    const kk = 1 - Math.exp(-dt * 6);
    C0.x += (bx - C0.x) * kk;
    C0.y += (by - C0.y) * kk;
  }
  /* Pixels a meter: about forty-six meters across the short side. */
  const px = Math.min(W, H) / 46;
  const X = (x: number) => W / 2 + (x - C0.x) * px;
  const Y = (y: number) => H / 2 + (y - C0.y) * px;
  const marks: ReactElement[] = [];
  const GAP = 9;
  const gx0 = Math.floor((C0.x - W / 2 / px) / GAP) - 1;
  const gy0 = Math.floor((C0.y - H / 2 / px) / GAP) - 1;
  for (let i = gx0; i <= gx0 + Math.ceil(W / px / GAP) + 2; i++) {
    for (let j = gy0; j <= gy0 + Math.ceil(H / px / GAP) + 2; j++) {
      const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
      if (h % 3) continue;
      const wx = X(i * GAP + (h % 7)) + Math.sin(wall * 1.3 + i) * 2;
      const wy = Y(j * GAP + ((h >> 3) % 7));
      marks.push(<Path key={`w${i}_${j}`} d={`M${wx.toFixed(1)} ${wy.toFixed(1)} q3 -2.6 6 0 t6 0`} stroke={C.accent} strokeOpacity={0.35} strokeWidth={1.6} fill="none" strokeLinecap="round" />);
    }
  }
  const art: ReactElement[] = [];
  /* The boat's wake. */
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > 0.1) {
    const ux = -s.vx / sp;
    const uy = -s.vy / sp;
    for (let i = 1; i <= 5; i++) {
      const d = i * 2.2 + ((wall * 6) % 2.2);
      art.push(<Circle key={`k${i}`} cx={X(bx + ux * d)} cy={Y(by + uy * d)} r={(0.6 + i * 0.35) * px} fill="none" stroke={C.paper} strokeOpacity={0.9 - i * 0.15} strokeWidth={1.5} />);
    }
  }
  /* The jab's reach round the boat, faint: the ring the boat keeps the
   * school on. */
  art.push(<Circle key="reach" cx={X(bx)} cy={Y(by)} r={7 * px} fill="none" stroke={SLOT_COLOR[0]} strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="4 6" />);
  for (const d of s.drops) {
    const x = X(d.x);
    const y = Y(d.y);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    const bob = Math.sin(wall * 5 + d.id) * 1.5;
    const r = d.value > 3 ? 1.1 : 0.8;
    art.push(<Path key={`d${d.id}`} d={`M${x} ${y + bob - r * px} L${x + r * 0.7 * px} ${y + bob} L${x} ${y + bob + r * px} L${x - r * 0.7 * px} ${y + bob}Z`} fill={C.accent} stroke={C.ink} strokeWidth={1.2} />);
  }
  for (const f of s.fish) {
    const fx = f.x + f.vx * ahead;
    const fy = f.y + f.vy * ahead;
    const x = X(fx);
    const y = Y(fy);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const a = Math.atan2(by - fy, bx - fx);
    const hit = wall - wallAt(f.hitAt) < 0.15;
    const L = (f.kind === 3 ? 2.6 : 1.8) * px;
    art.push(<Path key={`f${f.id}`} d={fishPath(x, y, a, L, wall, f.id)} fill={hit ? C.paper : FISH_COLOR[f.kind]} stroke={C.ink} strokeWidth={1.3} strokeLinejoin="round" />);
    art.push(<Circle key={`e${f.id}`} cx={x + Math.cos(a) * L * 0.28} cy={y + Math.sin(a) * L * 0.28} r={Math.max(1, L * 0.07)} fill={C.ink} />);
  }
  for (const b of s.blasts) {
    const e = (wall - wallAt(b.at)) / 0.45;
    if (e < 0 || e > 1) continue;
    const r = b.r * px * (0.35 + 0.65 * ease(e));
    /* The pulse and the ring go with the boat; the blast stays on its fish. */
    const on = b.slot !== 1;
    art.push(<Circle key={`b${b.id}`} cx={on ? X(bx) : X(b.x)} cy={on ? Y(by) : Y(b.y)} r={r} fill={SLOT_COLOR[b.slot]} fillOpacity={0.18 * (1 - e)} stroke={SLOT_COLOR[b.slot]} strokeWidth={3 * (1 - e) + 1} strokeOpacity={1 - e} />);
  }
  for (const d of s.deaths) {
    const e = (wall - wallAt(d.at)) / 0.4;
    if (e < 0 || e > 1) continue;
    art.push(<Path key={`x${d.id}`} d={burst(X(d.x), Y(d.y), 1.8 * px * (0.6 + e), 0.8 * px, 7, d.id)} fill={DOT_ON} stroke={C.ink} strokeWidth={1.2} opacity={1 - e} />);
  }
  const tk = Math.max(48, 7 * px);
  const bit = wall - wallAt(s.bitAt);
  const left = Math.max(0, s.end - (s.over ? s.end : rt));
  const done = s.over;
  const hud = (
    <View style={{ height: HUD, width: W, paddingHorizontal: 14, paddingTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.2, color: C.soft }}>{`THE SWARM · ROUND ${v.swarmTot.rounds + 1}`}</Text>
        <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 28, color: C.ink }}>{`${s.kills} FISH`}</Text>
      </View>
      <Num size={30}>{clockS(Math.ceil(left))}</Num>
    </View>
  );
  const water = (
    <View style={{ width: W, height: H, backgroundColor: "#DDEFF7", overflow: "hidden" }}>
      <Svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {marks}
        {art}
      </Svg>
      <View style={{ position: "absolute", left: X(bx) - (36 * tk) / TOKEN_U, top: Y(by) - (52 * tk) / TOKEN_U, transform: [{ translateX: bit < 0.25 ? Math.sin(bit * 60) * 2 : 0 }] }}>
        <TokenArt paint={paint} size={tk} t={wall} hop={hop} look={Math.cos(s.heading)} uid="swarm" />
      </View>
      {bit >= 0 && bit < 0.3 ? <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H, borderWidth: 6, borderColor: BEST, opacity: 0.5 * (1 - bit / 0.3) }} /> : null}
      {done ? (
        <View pointerEvents="none" style={{ position: "absolute", top: H * 0.3, alignSelf: "center", alignItems: "center", backgroundColor: C.paper, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: C.ink, borderRadius: 4 }}>
          <Text style={{ fontFamily: F.black, fontSize: 26, color: s.wrecked ? BEST : C.good }}>{s.wrecked ? "SUNK" : "ROUND OVER"}</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1, color: C.soft }}>{`${s.kills} FISH · +${s.xp} XP · BACK TO THE COURSE`}</Text>
        </View>
      ) : rt - s.t0 < 3 ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 8, alignSelf: "center", alignItems: "center", backgroundColor: C.paper, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 2, borderColor: C.ink, borderRadius: 4 }}>
          <Text style={{ fontFamily: F.black, fontSize: 24, color: C.ink }}>THE SWARM</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1, color: C.soft }}>THE SKILLS GO OFF ROUND THE BOAT</Text>
        </View>
      ) : null}
    </View>
  );
  if (wide)
    return (
      <View style={{ width, height, flexDirection: "row", overflow: "hidden" }}>
        <View style={{ width: W }}>
          {hud}
          {water}
        </View>
        <SkillColumn width={SIDE} height={height} hull={s.hull} hullMax={s.hullMax} skills={s.skills} pace={s.pace} wall={wall} dim={false} />
      </View>
    );
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      {hud}
      {water}
      <SkillBoxes width={width} height={PANEL} hull={s.hull} hullMax={s.hullMax} skills={s.skills} pace={s.pace} wall={wall} dim={false} />
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

