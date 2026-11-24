import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { ticks } from "../erg/reviewGeom";
import { api } from "../api";
import { medianOf, meanOf, placeOf, quantile, SHAPE_STEPS, type FieldStats, type RowMeasure } from "../pm5/craft";
import { Dash, Eye, mono } from "../site";
import { C, F, fmtInt, fmtPace } from "../theme";
import { Dots, Skel, scrub, setSideDrag, useLoad } from "../ui";
import { Axes, Box, FieldDensity, Key, Lab, PAD } from "./reviewBits";
import { Pages } from "./Pages";

/* A ROW AGAINST EVERYONE, CARD BY CARD (owner, 2026-11-22: "for every one
 * of these stats on the telemetry page ... pace along the piece and rates
 * and length and how steady and force curve ... for as many as we're able
 * to, let's create that second pane like we have for the force curve where
 * it compares us against other people. And then ... have either a third
 * pane or just a link on the second pane that links to a FAQ about this
 * metric ... less interested in definitions and more interested in the what
 * does mine look like compared to everyone else, and what does that mean
 * about me ... what direction is it to be better or worse?").
 *
 * So every card on a row's analytics is two cards side by side, as the
 * force curve was: the rower's own, and AGAINST EVERYONE, the same figures
 * laid over the field's (api/row100k/app/field: one figure a rower, every
 * real recording). The second card ends on a line that opens THE CARD'S
 * QUESTIONS (MetricScreen, below): where this row stands, what that says
 * about the rower, which way is better, what the figure is, how to move it.
 *
 * Every figure of the row's is worked out by the same lines the server runs
 * over the field (pm5/craft.ts), and every sentence is worked out from
 * those figures: a card with nobody to compare against has no second card,
 * and a field under five rowers says that it is small. */

export type MetricId = "steady" | "pace" | "rate" | "force" | "work";
export type FieldForce = { points: number[]; peakPct: number; rows: number; rowers: number };
/* `stats` is absent from a server that has not been updated. */
export type FieldAnswer = { force: FieldForce | null; stats?: FieldStats | null };
export const FIELD_PATH = "/api/row100k/app/field";

/* ---- words --------------------------------------------------------------- */

const count = (f: { rows: number; rowers: number }) => `${fmtInt(f.rows)} ${f.rows === 1 ? "row" : "rows"} · ${fmtInt(f.rowers)} ${f.rowers === 1 ? "rower" : "rowers"}`;
export const smallField = (f: { rowers: number }) => (f.rowers < 5 ? ` The field is small so far: ${f.rowers === 1 ? "one rower" : `${f.rowers} rowers`}, so read it as a mark and not a rule.` : "");

const signed = (v: number, dp: number, unit: string) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(dp)}${unit}`;
const plusMinus = (v: number) => `± ${v.toFixed(1)} s`;
const score = (v: number) => String(Math.round(v));
const perMin = (v: number) => v.toFixed(v % 1 && v < 100 ? 1 : 0);
const meters2 = (v: number) => `${v.toFixed(2)} m`;
const joules = (v: number) => `${fmtInt(v)} J`;
const pct = (v: number) => signed(v, 0, "%");
const peakAt = (v: number) => `${Math.round(v)}%`;

/* Where a figure stands among the rowers, in words: `win` is the word for
 * the better side of it ("tighter"), `lose` for the other ("wider"). */
function against(vals: number[], mine: number, better: "low" | "high", tie: number, win: string, lose: string): string {
  const p = placeOf(vals, mine, tie);
  const worse = better === "low" ? p.over : p.under;
  const ahead = better === "low" ? p.under : p.over;
  if (p.n === 1) return worse ? `${win} than the one rower on record` : ahead ? `${lose} than the one rower on record` : "level with the one rower on record";
  if (worse === p.n) return `${win} than all ${p.n} rowers on record`;
  if (ahead === p.n) return `${lose} than all ${p.n} rowers on record`;
  if (!worse && !ahead) return `level with all ${p.n} rowers on record`;
  /* Said from the side most of them are on. */
  return worse >= ahead ? `${win} than ${worse} of the ${p.n} rowers on record` : `${lose} than ${ahead} of the ${p.n} rowers on record`;
}

/* ---- the two cards ------------------------------------------------------- */

/* TWO CARDS, SIDE BY SIDE (owner, 2026-11-21, of the force curve: "if I
 * swipe the card ... it would show us the averages across everyone"). The
 * first is the rower's own; a swipe to the left brings the second. The two
 * are the same height, whichever has more to say. With nothing to compare
 * against there is the one card and no swipe. `name` is what the card is
 * of, for a screen reader.
 *
 * The stats tab's cards turn the same way with the faces the other way
 * about, everyone first and the rower over them second (Stats.tsx): `words`
 * are the two lines under the dots, and `labels` what a screen reader is
 * told each dot is. */
export function Flip({ w, name, own, other, labels }: { w: number; name: string; own: (fill: boolean) => ReactNode; other: ReactNode | null; words?: [string, string]; labels?: [string, string] }) {
  /* IT GOES ROUND (owner, 2026-11-23: "let them wrap around. So if I have
   * 2 and I keep swiping right, let it just wrap around"). The strip is the
   * two faces with a copy at each end, [second, FIRST, SECOND, first]: a
   * swipe off either face lands on a copy, and the strip is set back onto
   * the real one under it, which looks the same, once it has stopped. */
  /* AIR ROUND EACH FACE (owner, 2026-11-23: "the momentum swings it off to
   * the left side. That edge like gets cut off ... it just looks a little
   * buggy ... increase those margins just a little bit ... right now, those
   * two cards are like touching"). Each face sits in a slot GUTTER wider on
   * both sides, and the window is as wide as the slot, reaching into the
   * page's own margin: the spring's swing shows the gap, not a clipped card,
   * and two faces side by side stand 2 × GUTTER apart. */
  const slot = w + 2 * GUTTER;
  const [page, setPage] = useState(0);
  const at = useRef(1);
  const x = useRef(new Animated.Value(-slot)).current;
  const width = useRef(slot);
  width.current = slot;
  useEffect(() => {
    x.setValue(-at.current * slot);
  }, [slot, x]);
  const go = (i: number, v = 0) => {
    const real = i === 0 ? 2 : i === 3 ? 1 : i;
    at.current = real;
    setPage(real - 1);
    Animated.spring(x, { toValue: -i * width.current, velocity: v, friction: 9, tension: 70, useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => {
      if (finished && real !== i) x.setValue(-real * width.current);
    });
  };
  /* A JS PAGER, NOT A SCROLLER (owner, 2026-11-23: "as I'm scrubbing
   * through the KDE to look at the values, I'm also moving those cards, and
   * we shouldn't move the card if I'm scrubbing"). A native horizontal
   * scroller takes every sideways drag before a chart can, so the card slid
   * under a scrubbing finger. Now the card turns from a sideways drag that
   * no chart inside it has claimed: a chart asks first (it is deeper) and
   * holds the touch once it has it. */
  const pan = useMemo(
    () =>
      PanResponder.create({
        /* Taken early, at 6 points and anything more across than down
         * (owner, 2026-11-23: "Sometimes when I swipe to the right or the
         * left ... it scrolls vertically ... it just sometimes it jumps up
         * and down"): the longer the card waited, the further the page had
         * already slid before it was held still. */
        onMoveShouldSetPanResponder: (_e, g) => !scrub.chart && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        /* Once the card has the drag it keeps it: the tabs' own swipe, an
         * ancestor, would otherwise take it over and turn the page. */
        onPanResponderGrant: () => {
          scrub.on = true;
          setSideDrag(true);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          x.setValue(-at.current * width.current + Math.max(-width.current, Math.min(width.current, g.dx)));
        },
        onPanResponderRelease: (_e, g) => {
          scrub.on = false;
          setSideDrag(false);
          const far = Math.abs(g.dx) > width.current * 0.22 || Math.abs(g.vx) > 0.35;
          go(far ? at.current + (g.dx < 0 ? 1 : -1) : at.current, g.vx);
        },
        onPanResponderTerminate: () => {
          scrub.on = false;
          setSideDrag(false);
          go(at.current);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  if (!other) return <>{own(false)}</>;
  return (
    <>
      <View {...pan.panHandlers} style={{ width: slot, marginHorizontal: -GUTTER, overflow: "hidden" }}>
        <Animated.View style={{ width: slot * 4, flexDirection: "row", transform: [{ translateX: x }] }}>
          <View style={{ width: slot, paddingHorizontal: GUTTER }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {other}
          </View>
          <View style={{ width: slot, paddingHorizontal: GUTTER }}>{own(true)}</View>
          <View style={{ width: slot, paddingHorizontal: GUTTER }}>{other}</View>
          <View style={{ width: slot, paddingHorizontal: GUTTER }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {own(true)}
          </View>
        </Animated.View>
      </View>
      {/* The two dots and no words (owner, 2026-11-23: "I don't think that I
          like the copy that says swipe you over everyone. I think we can
          leave the 2 little dots there"). */}
      {/* With room above and below, to be pressed (owner, 2026-11-23: "I
          need some more breathing room vertically between some of the
          charts, so I can click on the dots"). */}
      <Dots n={2} at={page} onGo={(i) => go(i + 1)} labels={labels ?? [`Your ${name}`, `Your ${name} against everyone`]} style={{ marginTop: 10, marginBottom: 18 }} />
    </>
  );
}
const GUTTER = 14;

/* The last line of a card: the way to its questions. */
export function Ask({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Dash />
      <Pressable accessibilityRole="link" accessibilityLabel="What this says about you" onPress={onPress} hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40, paddingTop: 6, opacity: pressed ? 0.5 : 1 })}>
        <Text style={mono(10, true, C.ink, 0.1)}>What this says about you</Text>
        <Text style={{ fontFamily: F.black, fontSize: 15, color: C.accent }}>→</Text>
      </Pressable>
    </View>
  );
}

/* Whether a card has anybody to be compared against. */
export function fieldHas(id: MetricId, m: RowMeasure, f: FieldStats | null | undefined): f is FieldStats {
  if (!f || f.rowers < 1) return false;
  if (id === "steady") return (m.spread !== null && f.spread.length > 0) || (m.steady !== null && f.steady.length > 0) || (m.same !== null && f.same.length > 0);
  if (id === "pace") return !!m.pacing && !!f.pacing;
  if (id === "rate") return m.rate !== null && m.length !== null && f.pairs.length > 0;
  if (id === "work") return (m.work !== null && f.work.length > 0) || (m.fade !== null && f.fade.length > 0);
  return m.peak !== null && f.peak.length > 0;
}

/* ---- one figure, every rower, as a curve -------------------------------- */

/* NO MORE LINES WITH MARKS ON THEM (owner, 2026-11-23: "if we're going to
 * show this sort of like you against everyone on a line chart, the line
 * chart's probably not the way to go. It's definitely like a KDE ... Show
 * me the KDE where I lie. Show me the distribution, because this line chart
 * doesn't mean anything ... I don't like the line charts"). Each figure is
 * the curve of every rower's (reviewBits.tsx FieldDensity), one figure to a
 * face of the card (Pages.tsx), with this row on it and one plain line
 * saying where it lies; the sentence under it says how big the gap to the
 * middle is against how spread the field is ("441 and everyone else is
 * 446. Is that a big difference? Is that a little difference?").
 *
 * `side` is the side `win` is said of ("Steadier" is the low side of a
 * split spread); `better` is whether that side is the better one, which
 * washes in the blue the part of the field the row beats. `key` is what is
 * compared when it is not the figure itself: the fade is nearer zero, not
 * smaller. `gap` says a difference in the figure's own unit. */
type FigKey = "steady" | "same" | "spread" | "rateSd" | "rate" | "length" | "work" | "fade" | "peak";
type FigDef = {
  name: string;
  word: string;
  fmt: (v: number) => string;
  tick: (v: number) => string;
  gap: (v: number) => string;
  side: "low" | "high";
  better: boolean;
  key?: (v: number) => number;
  tie: number;
  win: string;
  lose: string;
  say: (mine: string, mid: string) => string;
};
const oneDp = (v: number) => v.toFixed(1);
const whole = (v: number) => String(Math.round(v));
const points = (v: number) => `${Math.round(v)} ${Math.round(v) === 1 ? "point" : "points"}`;
const FIGS: Record<FigKey, FigDef> = {
  spread: { name: "Split spread", word: "Lower is steadier", fmt: plusMinus, tick: oneDp, gap: (v) => `${v.toFixed(1)} s`, side: "low", better: true, tie: 0.05, win: "Steadier", lose: "Less steady", say: (y, m) => `Your split wandered ${y} around its average; the rower in the middle wanders ${m}.` },
  steady: { name: "Steady pace", word: "Higher is steadier", fmt: score, tick: whole, gap: points, side: "high", better: true, tie: 0.5, win: "Steadier", lose: "Less steady", say: (y, m) => `Steady pace ${y} out of 100; the rower in the middle scores ${m}.` },
  same: { name: "Same stroke", word: "Higher is more alike", fmt: score, tick: whole, gap: points, side: "high", better: true, tie: 0.5, win: "More alike stroke to stroke", lose: "Less alike stroke to stroke", say: (y, m) => `Same stroke ${y} out of 100, how alike one stroke's force curve is to the next; the rower in the middle scores ${m}.` },
  rateSd: { name: "Rate held", word: "Lower is steadier", fmt: (v) => `± ${v.toFixed(1)}`, tick: oneDp, gap: (v) => `${v.toFixed(1)} strokes a minute`, side: "low", better: true, tie: 0.05, win: "Held the rate closer", lose: "Let the rate wander more", say: (y, m) => `Your rate wandered ${y} strokes a minute around its average; the rower in the middle's wanders ${m}.` },
  rate: { name: "Strokes a minute", word: "Neither way is better", fmt: perMin, tick: whole, gap: (v) => `${v.toFixed(1)} strokes a minute`, side: "high", better: false, tie: 0.5, win: "More strokes a minute", lose: "Fewer strokes a minute", say: (y, m) => `You rowed ${y} strokes a minute; the rower in the middle rates ${m}. Neither is the better rate.` },
  length: { name: "Meters a stroke", word: "Longer goes further", fmt: meters2, tick: oneDp, gap: meters2, side: "high", better: true, tie: 0.01, win: "Longer strokes", lose: "Shorter strokes", say: (y, m) => `Each stroke carried you ${y}; the rower in the middle travels ${m}. At the same rate, longer is faster.` },
  work: { name: "Joules a stroke", word: "Follows size and split", fmt: joules, tick: (v) => fmtInt(v), gap: joules, side: "high", better: false, tie: 2, win: "Bigger strokes", lose: "Smaller strokes", say: (y, m) => `Each stroke did ${y}; the rower in the middle does ${m}. It follows size and split, so it is not a score.` },
  fade: { name: "Kept to the end", word: "Nearer zero is better", fmt: pct, tick: whole, gap: points, side: "low", better: true, key: Math.abs, tie: 0.5, win: "Held nearer level", lose: "Moved further from level", say: (y, m) => `From the first third to the last, the work in your stroke changed ${y}; the rower in the middle's changes ${m}.` },
  peak: { name: "Where the push peaks", word: "A third to a half is the mark", fmt: peakAt, tick: whole, gap: points, side: "high", better: false, tie: 1, win: "Later in the drive", lose: "Earlier in the drive", say: (y, m) => `Your push peaks ${y} of the way through the drive; the rower in the middle's peaks at ${m}.` },
};

/* Where the row lies, said plainly: from the side most of the field is on,
 * as a share of rowers once there are ten, as a count before that. */
function standOf(d: FigDef, vals: number[], mine: number): string {
  const list = d.key ? vals.map(d.key).sort((a, b) => a - b) : vals;
  const p = placeOf(list, d.key ? d.key(mine) : mine, d.tie);
  const beaten = d.side === "low" ? p.over : p.under;
  const ahead = d.side === "low" ? p.under : p.over;
  const of = (c: number) => (p.n >= 10 ? `${Math.max(1, Math.min(99, Math.round((100 * c) / p.n)))}% of rowers` : `${c} of the ${p.n} rowers`);
  if (p.n === 1) return beaten ? `${d.win} than the one rower on record` : ahead ? `${d.lose} than the one rower on record` : "Level with the one rower on record";
  if (beaten === p.n) return `${d.win} than every rower on record`;
  if (ahead === p.n) return `${d.lose} than every rower on record`;
  if (!beaten && !ahead) return "Level with every rower on record";
  return beaten >= ahead ? `${d.win} than ${of(beaten)}` : `${d.lose} than ${of(ahead)}`;
}

/* How big the gap to the middle is, against the middle half of the field. */
function sizeOf(d: FigDef, vals: number[], mine: number): string {
  if (vals.length < 4) return "";
  const q1 = quantile(vals, 0.25);
  const q3 = quantile(vals, 0.75);
  const iqr = q3 - q1;
  const gap = Math.abs(mine - medianOf(vals));
  const how = !(iqr > 0) ? "" : gap < 0.25 * iqr ? "a small difference" : gap < 0.75 * iqr ? "a clear difference" : "a big difference";
  return ` The middle half of rowers sit between ${d.fmt(q1)} and ${d.fmt(q3)}${how ? `, so the ${d.gap(gap)} between you and the middle is ${how}` : ""}.`;
}

const has = (k: FigKey, m: RowMeasure, f: FieldStats) => m[k] !== null && f[k].length > 0;

/* One figure's curve with the row on it, and its plain line. */
function Fig({ k, m, f, w }: { k: FigKey; m: RowMeasure; f: FieldStats; w: number }) {
  const d = FIGS[k];
  const mine = m[k];
  if (mine === null || !f[k].length) return null;
  return <FieldDensity name={d.name} word={d.word} vals={f[k]} mine={mine} fmt={d.fmt} tick={d.tick} beats={d.better && !d.key ? d.side : null} stand={standOf(d, f[k], mine)} w={w} />;
}

/* The faces of a card for these figures, each a card of its own: the curve,
 * then what the numbers are and how big the gap is. */
function figurePages(keys: FigKey[], m: RowMeasure, f: FieldStats, w: number, foot?: ReactNode): ReactNode[] {
  return keys
    .filter((k) => has(k, m, f))
    .map((k) => {
      const d = FIGS[k];
      const mine = m[k] as number;
      const n = f[k].length;
      return (
        <Box key={k} fill title="Against everyone" note={`${fmtInt(f.rows)} ${f.rows === 1 ? "row" : "rows"} · ${fmtInt(n)} ${n === 1 ? "rower" : "rowers"}`} say={`${d.say(d.fmt(mine), d.fmt(medianOf(f[k])))}${sizeOf(d, f[k], mine)}${smallField({ rowers: n })}`} foot={foot}>
          <Fig k={k} m={m} f={f} w={w} />
        </Box>
      );
    });
}
/* The same curves bare, for a card's questions page. */
function figureCharts(keys: FigKey[], m: RowMeasure, f: FieldStats, w: number): ReactNode[] {
  return keys.filter((k) => has(k, m, f)).map((k) => <Fig key={k} k={k} m={m} f={f} w={w} />);
}
const figureNames = (keys: FigKey[], m: RowMeasure, f: FieldStats) => keys.filter((k) => has(k, m, f)).map((k) => `${FIGS[k].name} against everyone`);

/* The faces after a card's own, for Review.tsx: one a figure. The labels
 * are what a screen reader is told each dot is. */
export function steadyPages(m: RowMeasure, f: FieldStats, w: number, foot?: ReactNode): { pages: ReactNode[]; labels: string[] } {
  const keys: FigKey[] = ["spread", "steady", "same", "rateSd"];
  return { pages: figurePages(keys, m, f, w, foot), labels: figureNames(keys, m, f) };
}
export function workPages(m: RowMeasure, f: FieldStats, w: number, foot?: ReactNode): { pages: ReactNode[]; labels: string[] } {
  const keys: FigKey[] = ["work", "fade"];
  return { pages: figurePages(keys, m, f, w, foot), labels: figureNames(keys, m, f) };
}
/* Rate and length: the dot a rower first, then each figure's curve. */
export function ratePages(m: RowMeasure, f: FieldStats, w: number, foot?: ReactNode): { pages: ReactNode[]; labels: string[] } {
  const keys: FigKey[] = ["rate", "length"];
  return { pages: [<RateField key="pairs" m={m} f={f} w={w} foot={foot} />, ...figurePages(keys, m, f, w, foot)], labels: ["Rate and length against everyone", ...figureNames(keys, m, f)] };
}

/* A questions page's curves, one a face. */
function FigDeck({ keys, m, f, w, first }: { keys: FigKey[]; m: RowMeasure; f: FieldStats; w: number; first?: ReactNode }) {
  const pages = [...(first ? [first] : []), ...figureCharts(keys, m, f, w)];
  return <Pages w={w} pages={pages} labels={[...(first ? ["Rate and length against everyone"] : []), ...figureNames(keys, m, f)]} />;
}

/* ---- HOW STEADY, against everyone --------------------------------------- */

function steadyWords(m: RowMeasure, f: FieldStats): string | null {
  const out: string[] = [];
  if (m.spread !== null && f.spread.length) out.push(`Your split wandered ${plusMinus(m.spread)} around its average; the rower in the middle of the field wanders ${plusMinus(medianOf(f.spread))}. Lower is steadier: this row was ${against(f.spread, m.spread, "low", 0.05, "tighter", "wider")}.`);
  else if (m.steady !== null && f.steady.length) out.push(`Steady pace ${score(m.steady)} out of 100 against ${score(medianOf(f.steady))} for the rower in the middle of the field. Higher is steadier: this row was ${against(f.steady, m.steady, "high", 0.5, "steadier", "less steady")}.`);
  if (m.same !== null && f.same.length) out.push(`Same stroke ${score(m.same)} against ${score(medianOf(f.same))}: ${against(f.same, m.same, "high", 0.5, "more alike, stroke to stroke,", "less alike, stroke to stroke,")}.`);
  return out.length ? out.join(" ") + smallField(f) : null;
}


/* ---- PACE ALONG THE PIECE, against everyone ------------------------------ */

/* The first sixth of a piece and the last, each as a percent off the
 * piece's own average: negative is quicker. */
const sixth = Math.max(1, Math.round(SHAPE_STEPS / 6));
const opening = (p: number[]) => meanOf(p.slice(0, sixth));
const closing = (p: number[]) => meanOf(p.slice(-sixth));

function paceWords(m: RowMeasure, f: FieldStats): string | null {
  if (!m.pacing || !f.pacing) return null;
  /* Percent of a split, said in seconds at this rower's own split. */
  const k = m.pace !== null ? m.pace / 100 : null;
  const size = (p: number) => (k !== null ? Math.abs(p) * k : Math.abs(p));
  const by = (p: number) => `${size(p).toFixed(1)}${k !== null ? " s" : "%"} ${p < 0 ? "quicker" : "slower"}`;
  const went = (p: number, own: string) => (size(p) < 0.3 ? `level with ${own}` : `${by(p)} than ${own}`);
  const came = (p: number) => (size(p) < 0.3 ? "level with it" : by(p));
  const out = [`You went out ${went(opening(m.pacing), "your average split")} and came home ${came(closing(m.pacing))}. The field goes out ${went(opening(f.pacing), "its own")} and comes home ${came(closing(f.pacing))}.`];
  if (m.halves !== null && f.halves.length) {
    const mid = medianOf(f.halves);
    const half = (v: number, you: boolean) => (Math.abs(v) < 0.3 ? (you ? "level with your first" : "comes in level") : you ? `${Math.abs(v).toFixed(1)} s ${v > 0 ? "slower" : "quicker"} than your first` : v > 0 ? `gives back ${v.toFixed(1)} s` : `finds ${Math.abs(v).toFixed(1)} s`);
    out.push(`Your second half was ${half(m.halves, true)}; the rower in the middle ${half(mid, false)}. Nearer level is better paced.`);
  }
  return out.join(" ") + smallField(f);
}

/* THE SHAPE OF THE PACING, the rower's over the field's: each line is a
 * split against its OWN average, so a 1:45 rower and a 2:30 rower share the
 * picture, and both are drawn in seconds at this rower's split so the
 * seconds are theirs. The middle rule is the average; faster is up. */
function PaceShape({ m, f, w }: { m: RowMeasure; f: FieldStats; w: number }) {
  const H = 190;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40 || !m.pacing || !f.pacing) return null;
  const k = m.pace !== null ? m.pace / 100 : 1;
  const mine = m.pacing.map((v) => v * k);
  const all = f.pacing.map((v) => v * k);
  let lo = Math.min(...mine, ...all, -1 * (m.pace !== null ? 1 : 0.5));
  let hi = Math.max(...mine, ...all, 1 * (m.pace !== null ? 1 : 0.5));
  const air = (hi - lo) * 0.16;
  lo -= air;
  hi += air;
  /* Faster is up: the smaller split is nearer the top. */
  const sy = (v: number) => PAD.t + ((v - lo) / (hi - lo)) * ph;
  const line = (pts: number[]) => pts.map((v, i) => `${i ? "L" : "M"}${(PAD.l + (i / (pts.length - 1)) * pw).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  return (
    <>
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={PAD} ys={ticks(lo, hi, 4)} sy={sy} fmt={(v) => (Math.abs(v) < 1e-9 ? "0" : signed(v, Math.abs(hi - lo) < 4 ? 1 : 0, ""))} />
        <Line x1={PAD.l} x2={w - PAD.r} y1={sy(0)} y2={sy(0)} stroke={C.gray} strokeWidth={1.2} strokeDasharray="5 4" />
        <Path d={line(all)} stroke={C.gray} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Path d={line(mine)} stroke={C.accent} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {[0, 25, 50, 75, 100].map((p) => (
          <Lab key={p} x={PAD.l + (p / 100) * pw} y={H - PAD.b + 12} anchor={p === 100 ? "end" : "middle"}>
            {String(p)}
          </Lab>
        ))}
        <Lab x={PAD.l} y={PAD.t - 5} size={8}>
          {m.pace !== null ? "SECONDS OFF THE AVERAGE SPLIT · FASTER IS UP" : "PERCENT OFF THE AVERAGE SPLIT · FASTER IS UP"}
        </Lab>
        <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
          PERCENT OF THE PIECE
        </Lab>
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 2, marginTop: 4 }}>
        <Key color={C.accent} label="You" />
        <Key color={C.gray} label="Everyone" />
        <Text style={mono(9, false, C.gray, 0.1)}>{m.pace !== null ? "Each against its own average, at your split" : "Each against its own average"}</Text>
      </View>
    </>
  );
}

export function PaceField({ m, f, w, foot }: { m: RowMeasure; f: FieldStats; w: number; foot?: ReactNode }) {
  return (
    <Box fill title="Against everyone" note={count(f)} say={paceWords(m, f)} foot={foot}>
      <PaceShape m={m} f={f} w={w} />
    </Box>
  );
}

/* ---- RATE AND LENGTH, against everyone ----------------------------------- */

const midPair = (f: FieldStats) => ({ rate: medianOf(f.pairs.map((p) => p[0]).sort((a, b) => a - b)), length: medianOf(f.pairs.map((p) => p[1]).sort((a, b) => a - b)) });

/* Which of the nine corners the rower is in: fewer or more strokes, longer
 * or shorter ones, or the field's own. */
function rateCorner(m: RowMeasure, f: FieldStats): { rate: -1 | 0 | 1; length: -1 | 0 | 1; mid: { rate: number; length: number } } | null {
  if (m.rate === null || m.length === null || !f.pairs.length) return null;
  const mid = midPair(f);
  const dR = m.rate - mid.rate;
  const dL = m.length - mid.length;
  return { rate: Math.abs(dR) < 1 ? 0 : dR > 0 ? 1 : -1, length: Math.abs(dL) < 0.2 ? 0 : dL > 0 ? 1 : -1, mid };
}

function rateWords(m: RowMeasure, f: FieldStats): string | null {
  const c = rateCorner(m, f);
  if (!c || m.rate === null || m.length === null) return null;
  const strokes = c.rate === 0 ? "about as many strokes" : c.rate < 0 ? "fewer strokes" : "more strokes";
  const reach = c.length === 0 ? "about the same length" : c.length > 0 ? "longer ones" : "shorter ones";
  const which = c.rate === 0 && c.length === 0 ? "you sit in the middle of the field on both" : `you take ${strokes} than most, and ${c.length === 0 ? "of " : ""}${reach}`;
  return `You rowed ${m.rate.toFixed(0)} strokes a minute at ${m.length.toFixed(1)} m a stroke. The rower in the middle rates ${c.mid.rate.toFixed(0)} and travels ${c.mid.length.toFixed(1)} m: ${which}. Neither rate is the better one; more meters from each stroke at the same rate is.${smallField(f)}`;
}

/* RATE ACROSS, LENGTH UP: a dot a rower, the two grey rules crossing at the
 * rower in the middle, and this row as the blue dot. Up and to the right is
 * faster; up and to the left is the long, slow stroke. */
function RatePairs({ m, f, w }: { m: RowMeasure; f: FieldStats; w: number }) {
  const H = 190;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40 || m.rate === null || m.length === null || !f.pairs.length) return null;
  const band = (vals: number[], least: number) => {
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < least) {
      const c = (hi + lo) / 2;
      lo = c - least / 2;
      hi = c + least / 2;
    }
    const air = (hi - lo) * 0.18;
    return { lo: lo - air, hi: hi + air };
  };
  const xb = band([...f.pairs.map((p) => p[0]), m.rate], 4);
  const yb = band([...f.pairs.map((p) => p[1]), m.length], 1);
  const sx = (v: number) => PAD.l + ((v - xb.lo) / (xb.hi - xb.lo)) * pw;
  const sy = (v: number) => PAD.t + (1 - (v - yb.lo) / (yb.hi - yb.lo)) * ph;
  const mid = midPair(f);
  const right = sx(m.rate) > w * 0.7;
  const high = sy(m.length) < PAD.t + 22;
  return (
    <>
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={PAD} ys={ticks(yb.lo, yb.hi, 4)} sy={sy} fmt={(v) => v.toFixed(1)} />
        <Line x1={sx(mid.rate)} x2={sx(mid.rate)} y1={PAD.t} y2={H - PAD.b} stroke={C.gray} strokeWidth={1.2} strokeDasharray="3 3" />
        <Line x1={PAD.l} x2={w - PAD.r} y1={sy(mid.length)} y2={sy(mid.length)} stroke={C.gray} strokeWidth={1.2} strokeDasharray="3 3" />
        {f.pairs.map((p, i) => (
          <Circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={3.2} fill={C.gray} opacity={0.6} />
        ))}
        <Circle cx={sx(m.rate)} cy={sy(m.length)} r={5} fill={C.accent} />
        {/* Over the dot, or under it at the top of the picture: the other
            dots are to its sides more often than above it. */}
        <Lab x={sx(m.rate)} y={sy(m.length) + (high ? 17 : -9)} anchor={right ? "end" : sx(m.rate) < w * 0.3 ? "start" : "middle"} color={C.accent} bold>
          YOU
        </Lab>
        {ticks(xb.lo, xb.hi, 4).map((v) => (
          <Lab key={v} x={sx(v)} y={H - PAD.b + 12} anchor="middle">
            {String(Math.round(v))}
          </Lab>
        ))}
        <Lab x={PAD.l} y={PAD.t - 5} size={8}>
          METERS A STROKE
        </Lab>
        <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
          STROKES A MINUTE
        </Lab>
      </Svg>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 2, marginTop: 4 }}>
        <Text style={mono(9, false, C.gray, 0.1)}>A dot a rower · the rules cross at the rower in the middle</Text>
      </View>
    </>
  );
}

export function RateField({ m, f, w, foot }: { m: RowMeasure; f: FieldStats; w: number; foot?: ReactNode }) {
  return (
    <Box fill title="Against everyone" note={count(f)} say={rateWords(m, f)} foot={foot}>
      <RatePairs m={m} f={f} w={w} />
    </Box>
  );
}

/* ---- WORK PER STROKE, against everyone ----------------------------------- */

function workWords(m: RowMeasure, f: FieldStats): string | null {
  const out: string[] = [];
  if (m.work !== null && f.work.length) {
    const mid = medianOf(f.work);
    const d = mid > 0 ? Math.round((m.work / mid - 1) * 100) : 0;
    out.push(`Each stroke did ${fmtInt(m.work)} joules; the rower in the middle does ${fmtInt(mid)}${Math.abs(d) < 3 ? ", much the same" : `, so yours is ${Math.abs(d)}% ${d > 0 ? "bigger" : "smaller"}`}. That figure follows size and split, so it is not a score.`);
  }
  if (m.fade !== null && f.fade.length) {
    const kept = (v: number) => (Math.abs(v) < 1.5 ? "held level" : v < 0 ? `gave back ${Math.abs(v).toFixed(0)}%` : `added ${v.toFixed(0)}%`);
    out.push(`The one to chase is what was kept: from the first third to the last you ${kept(m.fade)}, and the rower in the middle ${kept(medianOf(f.fade))}. Nearer zero is better.`);
  }
  return out.length ? out.join(" ") + smallField(f) : null;
}


/* ---- THE CARD'S QUESTIONS ------------------------------------------------ */

const TITLES: Record<MetricId, string> = { steady: "How steady", pace: "Pace along the piece", rate: "Rate and length", force: "Force curve", work: "Work per stroke" };

type Page = { value: string; unit: string; stands: string; charts: ReactNode; qa: [string, string][] };

/* One card's page: the row's figure big and where it stands, the pictures
 * against everyone, then the questions in the order he asked them (owner,
 * 2026-11-22: "less interested in definitions and more interested in the
 * what does mine look like compared to everyone else, and what does that
 * mean about me ... what direction is it to be better or worse?"): what
 * this says about you, which way is better, what the figure is, and how to
 * move it. `mine` is the row the page was opened from. */
export function MetricScreen({ id, mine }: { id: MetricId; mine: RowMeasure }) {
  const { data, error } = useLoad(() => api<FieldAnswer>(FIELD_PATH), [], FIELD_PATH);
  const [w, setW] = useState(0);
  const f = data?.stats ?? null;
  const has = fieldHas(id, mine, f);
  const page = pageOf(id, mine, has ? f : null, w);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }}>
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
        <Text style={{ fontFamily: F.black, fontSize: 28, lineHeight: 32, color: C.ink }}>{TITLES[id]}</Text>
        <View style={{ marginTop: 22, borderTopWidth: 2, borderBottomWidth: 1, borderColor: C.ink, paddingVertical: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ fontFamily: F.black, fontSize: 60, lineHeight: 64, color: C.accent, fontVariant: ["tabular-nums"] }}>{page.value}</Text>
            <Text style={mono(12, true)}>{page.unit}</Text>
          </View>
          <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>{page.stands}</Text>
        </View>

        {has && f ? (
          <>
            <Eye left="Against everyone" right={count(f)} />
            {w > 0 ? page.charts : null}
          </>
        ) : data === null && !error ? (
          <Skel h={120} r={8} style={{ marginTop: 22 }} />
        ) : null}

        {page.qa.map(([q, a]) => (
          <View key={q} style={{ marginTop: 22, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
            <Text style={{ fontFamily: F.black, fontSize: 19, lineHeight: 24, color: C.ink }}>{q}</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 22, color: C.soft, marginTop: 6 }}>{a}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* THE ADVICE ON THESE PAGES IS FOR A GOAL (owner, 2026-11-23: "if you want
 * a faster time, or if you want to be more consistent, or if you want to try
 * and lower your heart rate, or if you want to try and not burn out, then
 * here are the things that you can do"): each "how do you move it" and each
 * tip in "what does this say about you" says first what it is for. */
const NOBODY = "Nobody else's recordings are in to set this against yet, so this page says what the figure is and which way is better.";

function pageOf(id: MetricId, m: RowMeasure, f: FieldStats | null, w: number): Page {
  if (id === "steady") return steadyPage(m, f, w);
  if (id === "pace") return pacePage(m, f, w);
  if (id === "rate") return ratePage(m, f, w);
  if (id === "work") return workPage(m, f, w);
  return forcePage(m, f, w);
}

/* -1 when the row is on the better side of the rower in the middle, 1 on
 * the other, 0 when level or when there is nothing to say. */
function sideOf(vals: number[] | undefined, mine: number | null, better: "low" | "high", tie: number): -1 | 0 | 1 | null {
  if (!vals || !vals.length || mine === null) return null;
  const d = mine - medianOf(vals);
  if (Math.abs(d) < tie) return 0;
  return (better === "low" ? d < 0 : d > 0) ? -1 : 1;
}

function steadyPage(m: RowMeasure, f: FieldStats | null, w: number): Page {
  const s = sideOf(f?.spread, m.spread, "low", 0.15) ?? sideOf(f?.steady, m.steady, "high", 2);
  const about =
    s === null
      ? "With nobody to set it against, read it against your own rows: the same distance rowed with a smaller spread was rowed better, whatever the time."
      : s < 0
        ? "You hold a split better than most of the field. For a faster time on a piece like this one, the seconds are not hiding in the pacing: they are in a quicker split, held the same way."
        : s > 0
          ? "Your split moves about more than most rowers' does. That usually means going out quicker than the piece can hold, or chasing the monitor from one stroke to the next. The same average split rowed level would have cost you less."
          : "You sit in the middle of the field: about as steady as most. For a faster time, there are a few easy seconds in holding the split closer, before any of it has to come from pulling harder.";
  const eg = m.spread !== null && m.pace !== null ? ` Yours was ${plusMinus(m.spread)} on an average of ${fmtPace(m.pace)}: most of your strokes were between ${fmtPace(m.pace - m.spread)} and ${fmtPace(m.pace + m.spread)}.` : "";
  return {
    value: m.spread !== null ? `± ${m.spread.toFixed(1)}` : m.steady !== null ? score(m.steady) : "--",
    unit: m.spread !== null ? "seconds, your split spread" : "steady pace, out of 100",
    stands: f ? (steadyWords(m, f) ?? NOBODY) : NOBODY,
    charts: f ? <FigDeck keys={["spread", "steady", "same", "rateSd"]} m={m} f={f} w={w} /> : null,
    qa: [
      ["What does this say about you?", about],
      ["Which way is better?", "A lower spread is better, and a higher score is better. A split that stays within a second of its average is a piece rowed at one effort. Every surge above the average costs more than easing off below it gives back, because the work goes up much faster than the speed does, so the level piece is the cheapest way to row any time."],
      ["What is the split spread?", `Every stroke has a split. The spread is how far those splits sat from their average: about two strokes in three fall inside it.${eg}`],
      ["What are the two scores?", "STEADY PACE is 100, less ten for every 1% the split wandered from its own average, so a 2:00 held within a second and a bit scores 90. SAME STROKE is 100, less three for every 1% the shape of a stroke's force curve differed from your average stroke. Neither knows how fast the piece was: a 2:30 rowed level outscores a 1:50 that wandered."],
      ["How do you move it?", "To hold one pace: pick the split before the first stroke and hold it through the first third, when it feels too easy. Watch the average split on the monitor and not the one under it. A steady rate makes a steady split: RATE HELD is the same idea for strokes a minute, and lower is better there too."],
    ],
  };
}

function pacePage(m: RowMeasure, f: FieldStats | null, w: number): Page {
  const h = m.halves;
  const mid = f && f.halves.length ? medianOf(f.halves) : null;
  const about =
    h === null
      ? "This piece was too short to cut into two halves, so the line itself is the read: where it sits above the middle rule you were quicker than your average, and below it slower."
      : Math.abs(h) < 0.3
        ? `Your two halves came in level, which is how the quickest pieces are rowed.${mid !== null && mid > 0.5 ? ` Most of the field gives back ${mid.toFixed(1)} s a 500 over the second half, so pacing is something you already do better than most.` : ""} The time is in the split itself now, not in how it is shared out.`
        : h > 0
          ? `You went out harder than you could hold: the second half cost ${h.toFixed(1)} s a 500 more than the first.${mid !== null ? (h > mid + 0.3 ? ` Most rowers do the same, but less of it (${signed(mid, 1, " s")} at the middle of the field).` : h < mid - 0.3 ? ` Most rowers do more of it (${signed(mid, 1, " s")} at the middle of the field), so you pace better than most, with room still.` : " That is about what the middle of the field does.") : ""} The seconds you gained early were paid for twice at the end.`
          : `You finished quicker than you started: ${Math.abs(h).toFixed(1)} s a 500 faster over the second half.${mid !== null && mid > 0 ? " Most of the field goes the other way and fades." : ""} A small negative split is a well paced row. A large one means the first half had more in it than you asked for.`;
  return {
    value: h === null ? "--" : Math.abs(h) < 0.05 ? "0.0" : signed(h, 1, ""),
    unit: "seconds a 500, second half against first",
    stands: f ? (paceWords(m, f) ?? NOBODY) : NOBODY,
    charts: f ? <PaceShape m={m} f={f} w={w} /> : null,
    qa: [
      ["What does this say about you?", about],
      ["Which way is better?", "Nearer level is better. The quickest way to cover a distance on an erg is very nearly one split from the first stroke to the last, with a little more in the final tenth. A second half slower than the first means the first half cost more than it gave; a second half much quicker means there was more to spend."],
      ["What is the picture?", "The blue line is your split through the piece as a moving average, set against your own average: above the dashed rule you were quicker than your average, below it slower. The grey line is the same thing for everybody's rows, each measured against its own average, so a 1:45 rower and a 2:30 rower share one picture. Both are drawn in seconds at your split, so the seconds are yours."],
      ["How do you move it?", "For a faster time, or to not fade at the end: start a second or two a 500 slower than you mean to finish, hold the middle, and spend what is left over the last 500. To hold one pace the whole way: pick the split and row it from the first stroke to the last. The coaching under the splits gives the number for this row."],
    ],
  };
}

function ratePage(m: RowMeasure, f: FieldStats | null, w: number): Page {
  const c = f ? rateCorner(m, f) : null;
  const about = !c
    ? "With nobody to set it against, read it against your own rows: at the same rate, the row with more meters a stroke was the faster one."
    : c.rate === 0 && c.length === 0
      ? "You row about the stroke the field rows: the same count and the same length. For a faster time, either one moves the split: a little more length at this rate, or this stroke a beat higher."
      : c.length > 0 && c.rate <= 0
        ? "You get your speed from the length of the stroke and not the count: fewer, longer strokes than most. That is the cheap way to go fast, and it leaves rate in hand: for a faster time, the same stroke a beat or two higher is a quicker split."
        : c.length < 0 && c.rate >= 0
          ? "You get your speed from the count: more, shorter strokes than most. That costs more for the same split, because every stroke spends something on turning round at each end. For a faster time on the same effort, length is the thing to find before more rate."
          : c.length > 0
            ? "More strokes than most, and longer ones: you are simply moving faster than the middle of the field. The thing to watch is whether the length holds to the end, which the chart on the first card shows."
            : c.length < 0
              ? "Fewer strokes than most, and shorter ones: an easy row, or one with more in it. For a faster time, length first: reach the same catch every stroke and finish the legs before the arms bend, then bring the rate up."
              : c.rate > 0
                ? "You rate higher than most at about the same length: a quicker split than the middle of the field, bought with strokes. It holds as long as the length does."
                : "You rate lower than most at about the same length: a steadier, cheaper piece than the middle of the field. For a faster time, the same stroke a beat or two higher is where the next seconds are.";
  const sum = m.rate !== null && m.length !== null ? ` Yours: ${m.rate.toFixed(0)} strokes a minute at ${m.length.toFixed(1)} m is ${fmtInt(m.rate * m.length)} m a minute, which is a ${fmtPace((500 / (m.rate * m.length)) * 60)} split.` : "";
  return {
    value: m.length !== null ? m.length.toFixed(1) : "--",
    unit: m.rate !== null ? `meters a stroke, at ${m.rate.toFixed(0)} a minute` : "meters a stroke",
    stands: f ? (rateWords(m, f) ?? NOBODY) : NOBODY,
    charts: f ? <FigDeck keys={["rate", "length"]} m={m} f={f} w={w} first={<RatePairs m={m} f={f} w={w} />} /> : null,
    qa: [
      ["What does this say about you?", about],
      ["Which way is better?", `Neither rate is the better one. Rate times length is your speed, so the same split can be rowed many ways.${sum} At the same rate, more meters a stroke is faster, so length is the one with a better direction. A taller rower travels further each stroke for the same effort, so read your length against your own other rows before anybody else's.`],
      ["What are the two figures?", "Rate is strokes a minute. Length is how far the flywheel carried you for each stroke: the meters of the piece over its strokes. On the first card they are drawn together, because a piece that holds its speed by shortening and rating up shows as the two lines moving apart."],
      ["How do you move it?", "For more meters a stroke, a faster time on the same effort: a full reach at the catch, the legs finished before the arms bend, and a recovery slower than the drive so the wheel runs between strokes. For a faster time by more rate at the same length: quicker hands away from the finish, and the same drive."],
    ],
  };
}

function forcePage(m: RowMeasure, f: FieldStats | null, w: number): Page {
  const p = m.peak;
  const mid = f && f.peak.length ? medianOf(f.peak) : null;
  const d = p !== null && mid !== null ? Math.round(p - mid) : null;
  const stands =
    p === null
      ? "This recording carries no force curve."
      : mid === null || d === null || !f
        ? NOBODY
        : `${Math.abs(d) < 4 ? `Your push peaks where the field's does: ${peakAt(p)} of the way through the drive against ${peakAt(mid)} for the rower in the middle.` : `Your push peaks ${peakAt(p)} of the way through the drive; the rower in the middle peaks at ${peakAt(mid)}, ${Math.abs(d)} points ${d > 0 ? "earlier" : "later"}.`}${smallField(f)}`;
  const about =
    p === null
      ? "A row recorded with the monitor connected for the whole piece has one."
      : p > 50
        ? "The handle is still building as your legs run out, so the top of the work is being done by the back and the arms, which are the smaller engines. The legs are going down before the handle has taken the load."
        : p < 33
          ? "You hit hard off the catch and the pressure falls away after: the legs are doing their part early, and the back is not carrying it on. There is work left in the second half of the drive."
          : "The push comes where a connected stroke puts it: the legs load first and the back joins before the pressure falls. From here the thing to look at is how full the curve is either side of the peak, and how alike your strokes are (SAME STROKE, on the steady card).";
  return {
    value: p !== null ? String(Math.round(p)) : "--",
    unit: "percent of the drive, where the push peaks",
    stands,
    charts: f ? <FigDeck keys={["peak", "same"]} m={m} f={f} w={w} /> : null,
    qa: [
      ["What does this say about you?", about],
      ["Which way is better?", "There is not one right curve, and the field's is a mark and not a rule. What to look for is a peak between a third and a half of the way through the drive, and one smooth hump with no dip in it: the legs, the strongest thing you have, take the load first, and the back joins before the pressure falls. A peak past half way usually means the legs went without the handle. A fuller, rounder curve is better than a taller, sharper one."],
      ["What is the force curve?", "How hard you pulled on the handle at each moment of one drive, the catch at the left and the finish at the right. The card draws the average of every stroke in the piece. Against everyone, each curve is drawn as a percent of its own peak, so it compares when the push comes and not how strong it is: a light rower and a strong one with the same timing draw the same line."],
      ["How do you move it?", "For more speed from each stroke. With a late peak: squeeze the legs down off the catch with the arms still long, and the peak moves forward. With an early peak: keep pushing as the back opens, and the rest of the curve fills in. With a dip in the middle: one unbroken push, with no pause where the legs hand over to the back."],
    ],
  };
}

function workPage(m: RowMeasure, f: FieldStats | null, w: number): Page {
  const s = sideOf(f?.fade.map((v) => -Math.abs(v)).sort((a, b) => a - b), m.fade !== null ? -Math.abs(m.fade) : null, "high", 1.5);
  const about =
    m.fade === null
      ? "This piece was too short to say how much of the stroke was kept from its start to its end."
      : Math.abs(m.fade) < 1.5
        ? `Your stroke at the end was the stroke at the start: the work in it held level.${s !== null && s < 0 ? " Most of the field does not manage that." : ""} If the split still slipped, it was the rate that dropped and not the push.`
        : m.fade < 0
          ? `Each stroke did ${Math.abs(m.fade).toFixed(0)}% less by the last third than in the first.${s === null ? "" : s > 0 ? " That is more than most of the field gives back." : s < 0 ? " Most of the field gives back more than that." : " That is about what the middle of the field gives back."} If the split held anyway, the rate rose to cover it, which is the dearer way to hold a split.`
          : `Each stroke did ${m.fade.toFixed(0)}% more by the last third than in the first: you grew into the piece. There was more there at the start: for a faster time, a warm-up before the next one finds it.`;
  const watts = m.work !== null && m.rate !== null ? ` Yours: ${fmtInt(m.work)} joules at ${m.rate.toFixed(0)} strokes a minute is ${fmtInt((m.work * m.rate) / 60)} watts.` : "";
  return {
    value: m.work !== null ? fmtInt(m.work) : "--",
    unit: "joules a stroke",
    stands: f ? (workWords(m, f) ?? NOBODY) : NOBODY,
    charts: f ? <FigDeck keys={["work", "fade"]} m={m} f={f} w={w} /> : null,
    qa: [
      ["What does this say about you?", about],
      ["Which way is better?", "More joules is a bigger stroke, but it is not a score: it rises with your size and with the split you are rowing, and it falls as the rate goes up at the same split. The figure with a direction is how much of it you kept. Nearer zero from the first third to the last is better; giving back more than a few percent means the strokes got smaller and the rate had to cover for them."],
      ["What is it?", `The energy you put into the flywheel with one stroke, in joules: how hard you pulled on the handle, times how far it travelled. Your watts are this times your rate.${watts}`],
      ["How do you move it?", "For a bigger stroke: a longer one with the legs finished, the same things that make length. To keep it to the end and not burn out: open a little lighter than feels right and warm up first, so the piece starts where the strokes are already at their strongest."],
    ],
  };
}
