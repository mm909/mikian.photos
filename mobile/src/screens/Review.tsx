import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, PanResponder, Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { along, blocks500, computePlot, computeSpread, densityAt, fmtNum, FORCE_GRID, lastAtOrBefore, nearestByX, pieceTicks, resample, spreadWords, stepOf, thinPoints, ticks, type Block, type Pad, type Plot, type Series, type Spread, type Tick, type XY } from "../erg/reviewGeom";
import { analyseSession, comparableRows, fmtGap, fmtSplit, fmtWhen, type AnalysisForce, type AnalysisSplit, type AnalysisTrend, type ErgAnalysis } from "../pm5/analysis";
import { fmtClock, fmtMeters, fmtPace, lbfToNewtons } from "../pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc } from "../pm5/session";
import { Chip, Ctl, Dash, Eye, mono } from "../site";
import { asSaved, loadDoc, type Row } from "../store";
import { C, F, fmtInt } from "../theme";

/* THE READ (owner, 2026-11-14, of the website's saved-session screen: "this
 * needs to be a focus of the app ... make it really good"; and 2026-11-21,
 * of the same screen on the desktop: "this post session screen looks really
 * good ... I want to make sure we capture all these graphs and commentary").
 *
 * So this is the site's page (src/app/erg/s/[id]/Review.tsx), section for
 * section and in its order, redrawn for one phone column: the head with the
 * time big; PLAY IT BACK, the charts of the piece with a playhead; THE READ
 * in plain English; the numbers behind the sentences; the four pictures;
 * how steady it was; the splits; what to do next; and what explains, at the
 * foot.
 *
 * Every figure and every sentence comes out of analyseSession, the same
 * function the website runs (src/pm5/analysis.ts is a copy of the site's),
 * fed the document this phone recorded. It ranks the piece against the
 * other recorded pieces on this phone at the same distance, and lays the
 * best of them behind the force curve.
 *
 * A PIECE CAN BE THIN: a 500 m demo, no force curve, no ticks. A section
 * with nothing to show is not drawn; nothing prints a placeholder chart.
 *
 * NO HEART RATE, as on the site: the document carries it and nothing here
 * reads it. */

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/* The analysis is the site's file, copied: its sentences use a long dash
 * and its empty figure is one. The app prints neither, so a sentence gets a
 * colon where the dash was and an empty figure is two hyphens. */
const plain = (s: string) => s.replace(/\s*—\s*/g, ": ").replace(/([Mm])etre/g, "$1eter");
const fig = (s: string) => (s === "—" ? "--" : s);
const split = (tenths: number | null | undefined) => fig(fmtSplit(tenths));

/* How the axes and the read-outs print. Named once, here, so a chart handed
 * one keeps the same function from one draw to the next. */
const paceFmt = (seconds: number) => fig(fmtPace(seconds));
const xMeters = (x: number) => fmtInt(x);
const xTime = (x: number) => fig(fmtClock(x));
const oneDp = (y: number) => y.toFixed(1);
const whole = (y: number) => String(Math.round(y));

/* `doc` is the recording when the caller already has it (the row page
 * reads it off the site); without it the phone's own copy is opened. */
export function Review({ row, rows, doc: given }: { row: Pick<Row, "id" | "day" | "meters">; rows: Row[]; doc?: TelemetryDoc | null }) {
  const [state, setState] = useState<{ doc: TelemetryDoc; compare: { title: string; doc: TelemetryDoc } | null } | "missing" | null>(null);
  /* The width the page gives the read, measured: every chart is drawn at
   * that many points, so a point on the glass is a point in the chart. */
  const [w, setW] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      const doc = given ?? (await loadDoc(row.id));
      if (!live) return;
      if (!doc) return setState("missing");
      const history = rows.filter((r) => r.hasDoc).map(asSaved);
      const best = comparableRows(doc, history, row.id)[0];
      const other = best ? await loadDoc(best.id) : null;
      if (live) setState({ doc, compare: best && other ? { title: best.title, doc: other } : null });
    })();
    return () => {
      live = false;
    };
  }, [row.id, rows, given]);

  const a = useMemo<ErgAnalysis | null>(() => {
    if (!state || state === "missing") return null;
    try {
      return analyseSession({ doc: state.doc, id: row.id, history: rows.filter((r) => r.hasDoc).map(asSaved), compare: state.compare });
    } catch {
      return null;
    }
  }, [state, row.id, rows]);

  if (state === null) return <ActivityIndicator color={C.ink} style={{ marginVertical: 24 }} />;
  /* No recording, or one too thin to analyse: the row page says what it has. */
  const doc = state === "missing" ? null : state.doc;
  if (!a || !doc) return null;

  const dr = a.driveRecovery;
  const numbers: CellData[] = [
    num(a.avgPaceTenths) ? { k: "Average split", v: split(a.avgPaceTenths), u: "per 500 m" } : null,
    num(a.avgSpm) ? { k: "Rate", v: a.avgSpm.toFixed(0), u: "strokes a minute" } : null,
    num(a.metresPerStroke) ? { k: "Meters a stroke", v: a.metresPerStroke.toFixed(2), u: "distance per stroke" } : null,
    num(a.avgWatts) ? { k: "Watts", v: fmtInt(a.avgWatts), u: "average power" } : null,
    num(a.workPerStrokeJ) ? { k: "Work a stroke", v: fmtInt(a.workPerStrokeJ), u: "joules" } : null,
    dr && num(dr.ratio) ? { k: "Drive to recovery", v: `1 : ${dr.ratio.toFixed(1)}`, u: `${dr.driveS.toFixed(2)} s drive` } : null,
  ].filter((c): c is Exclude<CellData, null> => c !== null);

  const st = a.steady;
  const steady: CellData[] = [
    num(st.paceSdTenths) ? { k: "Split spread", v: `± ${fmtGap(st.paceSdTenths)}`, u: num(st.paceMeanTenths) ? `around ${split(Math.round(st.paceMeanTenths))}` : "" } : null,
    num(st.workSdJ) ? { k: "Work spread", v: `± ${st.workSdJ.toFixed(1)}`, u: num(st.workMeanJ) ? `joules around ${st.workMeanJ.toFixed(0)}` : "joules a stroke" } : null,
    /* Never settling is an answer; having nothing to measure is not. */
    num(st.paceSdTenths) ? (st.settle ? { k: "Strokes to settle", v: String(st.settle.count), u: `settled at stroke ${st.settle.strokeN}` } : { k: "Strokes to settle", v: "Never", u: "never inside the band" }) : null,
    num(st.avgDriveLengthCm) ? { k: "Drive length", v: `${(st.avgDriveLengthCm / 100).toFixed(2)} m`, u: "average drive" } : null,
  ].filter((c): c is Exclude<CellData, null> => c !== null);

  /* The four pictures, each with what it needs to exist. */
  const counted = a.series.filter((s) => s.counted);
  const splitPts = a.splits.filter((s) => num(s.paceTenths) && s.paceTenths > 0);
  const rate = thinPoints(counted.filter((s) => num(s.spm)).map((s) => ({ x: s.n, y: s.spm as number })));
  const len = thinPoints(counted.filter((s) => num(s.mps)).map((s) => ({ x: s.n, y: s.mps as number })));
  const work = thinPoints(counted.filter((s) => num(s.workJ)).map((s) => ({ x: s.n, y: s.workJ as number })));
  const has = { splits: splitPts.length >= 2, rate: rate.length >= 3 || len.length >= 3, force: a.force !== null, work: work.length >= 3 };
  const from = a.splitsFromMeters > 0 ? fmtInt(a.splitsFromMeters) : "";

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      <Head a={a} />

      {w ? <Playback a={a} doc={doc} w={w} /> : null}

      {/* THE READ: the point of the screen. Every sentence is worked out in
          analysis.ts and says only what the numbers carry. */}
      {a.read.length ? (
        <>
          <Eye left="The read" />
          {a.read.map((line, i) => (
            <Text key={i} style={{ color: C.ink, fontSize: i === 0 ? 19 : 17, lineHeight: i === 0 ? 26 : 25, fontFamily: i === 0 ? F.black : F.sans, marginBottom: i < a.read.length - 1 ? 10 : 0 }}>
              {plain(line)}
            </Text>
          ))}
        </>
      ) : null}

      {numbers.length ? (
        <>
          <Eye left="The numbers" />
          <Cells cells={numbers} />
        </>
      ) : null}

      {w && (has.splits || has.rate || has.force || has.work) ? (
        <>
          <Eye left="The shape of it" right={a.splitsDerived && has.splits ? `Splits cut from the tick stream${from ? `, from ${from} m where the recording starts` : ""}` : undefined} />
          <View style={{ gap: 26 }}>
            {has.splits ? <SplitBars splits={splitPts} avgTenths={a.avgSplitTenths} derived={a.splitsDerived} fastest={a.fastestSplit} w={w} /> : null}
            {has.rate ? <RateLength rate={rate} len={len} w={w} /> : null}
            {a.force ? <ForceCurve force={a.force} compare={a.compare} w={w} /> : null}
            {has.work ? <WorkPerStroke pts={work} trend={a.workTrend} w={w} /> : null}
          </View>
        </>
      ) : null}

      {/* The four figures that say whether the piece was held together or
          wrestled. */}
      {steady.length ? (
        <>
          <Eye left="How steady" />
          <Cells cells={steady} />
        </>
      ) : null}

      {/* The splits as the monitor recorded them, or cut out of the tick
          stream and said so when the monitor sent none. */}
      {w && a.splits.length ? (
        <>
          <Eye left="Splits" right={a.splitsDerived ? `Derived, not the monitor's own figures${from ? ` · the first begins at ${from} m, where this recording starts` : ""}` : "As the monitor recorded them"} />
          <SplitsTable splits={a.splits} fastest={a.fastestSplit} w={w} />
        </>
      ) : null}

      {a.next.length ? (
        <>
          <Eye left="What next" />
          <View style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 14, paddingVertical: 2 }}>
            {a.next.map((line, i) => (
              <Text key={i} style={{ fontFamily: F.sans, fontSize: 16, lineHeight: 24, color: C.soft, marginBottom: i < a.next.length - 1 ? 8 : 0 }}>
                {plain(line)}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {/* What explains goes at the foot (owner, 2026-09-17, of the site:
          "whenever we have text that explains something, let us put it on
          the bottom of the page rather than the top"). */}
      <View style={{ marginTop: 40, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.gray }}>
          <Text style={{ fontFamily: F.bold, color: C.soft }}>This is a piece that has already been rowed.</Text> THE READ and WHAT NEXT are written from the numbers on this page. Where the monitor sent no splits they are cut from the tick stream and labelled as derived.
        </Text>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 19, color: C.gray, marginTop: 8 }}>PLAY IT BACK, under the head, lays the piece out chart by chart and lets you scrub through it: drag across any chart and every one reads at that point.</Text>
        {/* What the arithmetic was allowed to see: a monitor sitting between
            pieces keeps sending strokes nobody rowed, and they are left out
            of the averages. This is where that is said. */}
        <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 12, lineHeight: 16 }]}>
          {[
            `${fmtInt(a.packetsRecorded)} packets recorded`,
            a.force ? `${fmtInt(a.force.curves)} force curves` : "no force curves",
            `${fmtInt(a.strokesCounted)} of ${fmtInt(a.series.length)} strokes counted`,
            a.strokesSetAside > 0 ? `${fmtInt(a.strokesSetAside)} set aside as the monitor between pieces` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </View>
  );
}

/* ---- the head ----------------------------------------------------------- */

/* The time is the headline, in the one colour this product has; everything
 * beside it is what makes that time mean something. */
function Head({ a }: { a: ErgAnalysis }) {
  const when = fig(fmtWhen(a.startedAt));
  const meta = [a.strokes > 0 ? `${fmtInt(a.strokes)} strokes` : "", num(a.avgWatts) ? `${fmtInt(a.avgWatts)} W average` : "", num(a.dragFactor) ? `Drag ${fmtInt(a.dragFactor)}` : "", when === "--" ? "" : when, a.device, a.recordedVia].filter(Boolean);
  /* The totals describe the whole row; when the detail below does not, that
   * is said out loud rather than letting a half-row be read as a row. */
  const flags = [
    a.simulated ? "Simulated" : "",
    a.packetsDropped > 0 ? `${fmtInt(a.packetsDropped)} packets dropped` : "",
    a.headTrimmedFromS !== null ? `Strokes and ticks start at ${fmtTenthsClock(Math.round(a.headTrimmedFromS * 10))}: the head of the piece was dropped` : "",
    a.thinned ? plain(a.thinned) : "",
  ].filter(Boolean);
  const big = { fontFamily: F.black, fontSize: 26, lineHeight: 30, color: C.ink, fontVariant: ["tabular-nums" as const] };
  return (
    <>
      <Eye left="Saved session" />
      <Text style={[mono(10, false, C.gray), { marginBottom: 4 }]}>Time</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ fontFamily: F.black, fontSize: 56, lineHeight: 60, letterSpacing: -1.5, color: C.accent, fontVariant: ["tabular-nums"] }}>
        {a.clock}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 28, rowGap: 10, marginTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderColor: C.line }}>
        {a.meters > 0 ? (
          <View>
            <Text style={[mono(10, false, C.gray), { marginBottom: 4 }]}>Distance</Text>
            <Text style={big}>{fmtMeters(a.meters)}</Text>
          </View>
        ) : null}
        {num(a.avgPaceTenths) ? (
          <View>
            <Text style={[mono(10, false, C.gray), { marginBottom: 4 }]}>Average split</Text>
            <Text style={big}>{split(a.avgPaceTenths)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[mono(11, false, C.gray, 0.1), { marginTop: 12, lineHeight: 18 }]}>{meta.join(" · ")}</Text>
      {flags.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {flags.map((f) => (
            <Text key={f} style={[mono(10, false, C.soft, 0.1), { borderWidth: 1, borderColor: C.line, paddingHorizontal: 6, paddingVertical: 2, lineHeight: 15 }]}>
              {f}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  );
}

/* ---- the figures -------------------------------------------------------- */

type CellData = { k: string; v: string; u: string } | null;

/* Figures two to a row, straight on the page: the word, the number, what it
 * is counted in. */
function Cells({ cells, accent }: { cells: CellData[]; accent?: boolean }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {cells.map((c) =>
        c ? (
          <View key={c.k} style={{ width: "50%", paddingVertical: 9, paddingRight: 10 }}>
            <Text style={[mono(10, false, C.gray), { marginBottom: 5 }]}>{c.k}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.black, fontSize: 24, lineHeight: 27, color: accent ? C.accent : C.ink, fontVariant: ["tabular-nums"] }}>
              {c.v}
            </Text>
            {c.u ? <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4 }]}>{c.u}</Text> : null}
          </View>
        ) : null,
      )}
    </View>
  );
}

/* ---- what every chart is made of ---------------------------------------- */

const PAD: Pad = { l: 40, r: 8, t: 16, b: 28 };

/* A word or a number inside a chart: Space Mono, small, grey unless told. */
function Lab({ x, y, anchor = "start", size = 9, color, bold, children }: { x: number; y: number; anchor?: "start" | "middle" | "end"; size?: number; color?: string; bold?: boolean; children: string }) {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fontSize={size} fontFamily={bold ? F.monoBold : F.mono} fill={color ?? C.gray}>
      {children}
    </SvgText>
  );
}

/* The grid, the labels down the left and the two axes. */
function Axes({ W, H, pad, ys, sy, fmt }: { W: number; H: number; pad: Pad; ys: number[]; sy: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <G>
      {ys.map((v) => (
        <G key={v}>
          <Line x1={pad.l} x2={W - pad.r} y1={sy(v)} y2={sy(v)} stroke={C.line} strokeWidth={1} opacity={0.55} />
          <Lab x={pad.l - 5} y={sy(v) + 3} anchor="end">
            {fmt(v)}
          </Lab>
        </G>
      ))}
      <Line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke={C.line} strokeWidth={1} />
      <Line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={C.ink} strokeWidth={1.5} />
    </G>
  );
}

const pathOf = (pts: XY[], sx: (x: number) => number, sy: (y: number) => number) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

/* The name of a chart on the left, the quiet word on the right. */
function PanelHead({ title, unit, note }: { title: string; unit?: string; note?: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 10, rowGap: 2, marginBottom: 6 }}>
      <Text style={mono(10, true, C.ink, 0.14)}>
        {title}
        {unit ? <Text style={{ fontFamily: F.mono, color: C.gray }}> {unit}</Text> : null}
      </Text>
      {note ? <Text style={mono(10, false, C.gray, 0.1)}>{note}</Text> : null}
    </View>
  );
}

/* A FINGER ACROSS A CHART. The read sits in a page that scrolls, so a
 * finger has to prove it is going across before it counts: more sideways
 * than down, and more than three points of it. Until then the page scrolls
 * as it always does, and nine stacked charts are not nine scroll traps.
 * Once it counts, the page is held still until the finger lifts. A tap
 * places the hairline too. In a browser a mouse cannot scroll by dragging,
 * so a press is taken at once.
 *
 * It answers in points from the left edge of the layer it is laid on; the
 * chart turns that into a stroke or a meter. */
function useDrag(onX: (px: number) => void) {
  const cb = useRef(onX);
  cb.current = onX;
  const base = useRef(0);
  const tap = useRef<{ x: number; px: number; py: number } | null>(null);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS === "web",
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 3 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => {
        tap.current = null;
        base.current = e.nativeEvent.locationX;
        cb.current(base.current);
      },
      /* Where it was taken plus how far it has gone: the travel is measured
       * on the page, so it stays right when the finger leaves the chart. */
      onPanResponderMove: (_e, g) => cb.current(base.current + g.dx),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const touch =
    Platform.OS === "web"
      ? {}
      : {
          onTouchStart: (e: GestureResponderEvent) => {
            const n = e.nativeEvent;
            tap.current = { x: n.locationX, px: n.pageX, py: n.pageY };
          },
          onTouchEnd: (e: GestureResponderEvent) => {
            const s = tap.current;
            tap.current = null;
            const n = e.nativeEvent;
            if (s && Math.abs(n.pageX - s.px) < 8 && Math.abs(n.pageY - s.py) < 8) cb.current(s.x);
          },
        };
  return { ...pan.panHandlers, ...touch };
}

/* In a browser: an up-and-down swipe still scrolls the page, a sideways one
 * is ours, and a mouse drag selects nothing. */
const WEB_DRAG = (Platform.OS === "web" ? { touchAction: "pan-y", cursor: "crosshair", userSelect: "none" } : {}) as object;

/* The layer the finger lands on: clear, over the whole chart, so where it
 * landed is counted from the chart's own left edge on every kind of phone. */
function Hit({ drag, label }: { drag: ReturnType<typeof useDrag>; label: string }) {
  return <View accessibilityLabel={label} {...drag} style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, WEB_DRAG]} />;
}

/* The line a chart prints its reading on, over the plot: the one thing a
 * thumb is certain to cover is whatever is under it, so the numbers go
 * where the finger is not. Two lines high always, so nothing jumps. */
function Reading({ text, hint }: { text: string | null; hint: string }) {
  return <Text style={[mono(10, text !== null, text !== null ? C.ink : C.gray, 0.08), { lineHeight: 15, minHeight: 30, marginBottom: 2, fontVariant: ["tabular-nums"] }]}>{text ?? hint}</Text>;
}

/* ---- PLAY IT BACK ------------------------------------------------------- */

/* The first five seconds are not drawn, as on the site's console: the
 * flywheel spinning up sends a ten minute split. */
const SKIP_S = 5;
const SPEEDS = [0.5, 1, 2, 4, 8];
type XMode = "meters" | "time";
type StrokeAt = { n: number; t: number; d: number; watts: number | null; mps: number | null };

/* PLAY IT BACK (owner, 2026-09-24, of the site: "I should have a button to
 * play it back ... let me play it back and scrub through it"). One word,
 * closed, as on the site, so THE READ stays near the top; open, the charts
 * of the piece under one playhead. */
function Playback({ a, doc, w }: { a: ErgAnalysis; doc: TelemetryDoc; w: number }) {
  const [open, setOpen] = useState(false);
  const ticksAll = useMemo(() => pieceTicks(doc), [doc]);
  const strokes = useMemo<StrokeAt[]>(() => {
    const out: StrokeAt[] = [];
    a.series.forEach((s, i) => {
      const prev = out[out.length - 1];
      if (!num(s.elapsedS) || !num(s.distanceM) || (prev && (s.elapsedS < prev.t || s.distanceM < prev.d))) return;
      const watts = doc.strokes[i]?.watts ?? 0;
      out.push({ n: s.n, t: s.elapsedS, d: s.distanceM, watts: watts > 0 ? watts : null, mps: s.counted ? s.mps : null });
    });
    return out;
  }, [a, doc]);
  /* Nothing to lay a playhead along: no word to press. */
  if (ticksAll.length < 2 && strokes.length < 2) return null;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", columnGap: 16, rowGap: 4, borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 8, marginBottom: 14, marginTop: 44 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} hitSlop={10}>
          <Text style={[mono(11, true), { textDecorationLine: "underline", textDecorationStyle: "dotted" }]}>{open ? "Close the playback" : "Play it back"}</Text>
        </Pressable>
        <Text style={mono(11, false, C.gray)}>{open ? "Drag across a chart" : "Scrub, pause, half to eight times"}</Text>
      </View>
      {open ? <PlayBody a={a} doc={doc} ticksAll={ticksAll} strokes={strokes} w={w} /> : <Text style={[mono(10, false, C.gray, 0.1), { lineHeight: 16 }]}>The charts of the piece, fed from this recording: pace, watts, rate and length, each with its spread, every force curve and every 500 m.</Text>}
    </View>
  );
}

function PlayBody({ a, doc, ticksAll, strokes, w }: { a: ErgAnalysis; doc: TelemetryDoc; ticksAll: Tick[]; strokes: StrokeAt[]; w: number }) {
  const [xMode, setXMode] = useState<XMode>("meters");
  /* THE PLAYHEAD, in seconds of the piece, and null until it is placed.
   * Seconds and never a point on the glass, so it means the same thing on
   * every chart and in either x mode. */
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  /* What the playhead runs along: the ticks, or the strokes when a piece
   * has no ticks. */
  const track = useMemo<{ t: number; d: number }[]>(() => (ticksAll.length >= 2 ? ticksAll : strokes), [ticksAll, strokes]);
  const tEnd = track[track.length - 1].t;
  const t0 = Math.min(tEnd, Math.max(track[0].t, SKIP_S));

  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => Math.min(tEnd, (prev ?? t0) + dt * speed));
    }, 100);
    return () => clearInterval(id);
  }, [playing, speed, t0, tEnd]);
  /* The end of the piece stops the clock. */
  useEffect(() => {
    if (playing && t !== null && t >= tEnd) setPlaying(false);
  }, [playing, t, tEnd]);

  const series = useMemo(() => {
    const kx = (k: { t: number; d: number }) => (xMode === "meters" ? k.d : k.t);
    const shown = ticksAll.filter((k) => k.t >= SKIP_S);
    const sShown = strokes.filter((s) => s.t >= SKIP_S);
    /* The running average counts every stroke, drawn or not. */
    let sum = 0;
    let n = 0;
    const running: XY[] = [];
    for (const s of strokes) {
      if (s.watts === null) continue;
      sum += s.watts;
      n++;
      if (s.t >= SKIP_S) running.push({ x: kx(s), y: sum / n });
    }
    const pace: Series[] = [
      { kind: "line", label: "CURRENT", points: thinPoints(shown.filter((k) => k.pace > 0).map((k) => ({ x: kx(k), y: k.pace }))) },
      { kind: "dashed", label: "AVERAGE", points: thinPoints(shown.filter((k) => k.avgPace > 0).map((k) => ({ x: kx(k), y: k.avgPace }))) },
    ];
    const watts: Series[] = [
      { kind: "bars", label: "PER STROKE", points: thinPoints(sShown.filter((s) => s.watts !== null).map((s) => ({ x: kx(s), y: s.watts as number })), 140) },
      { kind: "dashed", label: "RUNNING AVG", points: thinPoints(running) },
    ];
    const spm: Series[] = [{ kind: "line", label: "SPM", points: thinPoints(shown.filter((k) => k.spm > 0).map((k) => ({ x: kx(k), y: k.spm }))) }];
    const mps: Series[] = [{ kind: "line", label: "M", points: thinPoints(sShown.filter((s) => num(s.mps)).map((s) => ({ x: kx(s), y: s.mps as number }))) }];
    return { pace, watts, spm, mps };
  }, [ticksAll, strokes, xMode]);

  const blocks = useMemo(() => blocks500(ticksAll), [ticksAll]);

  const onCursor = useCallback(
    (x: number) => {
      setPlaying(false);
      setT(Math.max(track[0].t, Math.min(tEnd, xMode === "time" ? x : along(track, "d", x))));
    },
    [track, tEnd, xMode],
  );

  const at = t ?? tEnd;
  const dist = along(track, "t", at);
  const cursor = t === null ? null : xMode === "time" ? t : dist;
  const tick = ticksAll[lastAtOrBefore(ticksAll, (k) => k.t, at)] ?? null;
  const strokeI = lastAtOrBefore(strokes, (s) => s.t, at);
  const stroke = strokes[strokeI] ?? null;
  const ended = t !== null && t >= tEnd;

  const toggle = () => {
    if (playing) return setPlaying(false);
    /* PLAY at the end starts the piece over. */
    if (t === null || ended) setT(t0);
    setPlaying(true);
  };
  const step = (dir: -1 | 1) => {
    setPlaying(false);
    const next = dir === 1 ? strokes.find((s) => s.t > at + 0.001) : [...strokes].reverse().find((s) => s.t < at - 0.001);
    setT(next ? next.t : dir === 1 ? tEnd : track[0].t);
  };
  const bar = useDrag((px) => {
    setPlaying(false);
    setT(track[0].t + Math.max(0, Math.min(1, px / w)) * (tEnd - track[0].t));
  });

  /* The monitor as it read at the playhead. A figure the piece never had is
   * left out; one it has, but not at this second, prints two hyphens so the
   * strip does not reflow as the playhead moves. */
  const now: CellData[] = [
    { k: "Elapsed", v: xTime(at), u: t === null ? "at the finish" : "at the playhead" },
    { k: "Distance", v: fmtInt(Math.floor(dist)), u: "meters" },
    ticksAll.some((k) => k.pace > 0) ? { k: "Pace", v: tick && tick.pace > 0 ? paceFmt(tick.pace) : "--", u: "per 500 m" } : null,
    ticksAll.some((k) => k.spm > 0) ? { k: "Rate", v: tick && tick.spm > 0 ? String(tick.spm) : "--", u: "strokes a minute" } : null,
    strokes.some((s) => s.watts !== null) ? { k: "Watts", v: stroke && stroke.watts !== null ? String(stroke.watts) : "--", u: "this stroke" } : null,
    strokes.length ? { k: "Stroke", v: stroke ? String(stroke.n) : "--", u: stroke && num(stroke.mps) ? `${stroke.mps.toFixed(2)} m per stroke` : "count" } : null,
  ];

  const span = tEnd - track[0].t;
  const xWord = xMode === "meters" ? "METERS" : "ELAPSED";
  const xFmt = xMode === "meters" ? xMeters : xTime;
  const shared = { w, cursor, onCursor, xWord, xFmt };

  return (
    <View>
      {/* THE TRANSPORT. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 14 }}>
        <Ctl label={playing ? "Pause" : ended ? "Play again" : "Play"} onPress={toggle} />
        <Ctl
          label="Restart"
          onPress={() => {
            setPlaying(false);
            setT(t0);
          }}
        />
        {strokes.length ? <Ctl label="Previous stroke" onPress={() => step(-1)} /> : null}
        {strokes.length ? <Ctl label="Next stroke" onPress={() => step(1)} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {SPEEDS.map((x) => (
          <Chip key={x} label={`${x}×`} on={speed === x} onPress={() => setSpeed(x)} />
        ))}
      </View>
      <View style={{ height: 30, justifyContent: "center", marginTop: 10 }}>
        <View style={{ height: 6, backgroundColor: C.pale }}>
          <View style={{ height: 6, width: `${span > 0 ? Math.max(0, Math.min(100, ((at - track[0].t) / span) * 100)) : 100}%`, backgroundColor: C.accent }} />
        </View>
        <Hit drag={bar} label="Scrub through the piece" />
      </View>
      <Text style={[mono(11, true), { fontVariant: ["tabular-nums"] }]}>
        {fmtTenthsClock(Math.round(at * 10))} <Text style={{ fontFamily: F.mono, color: C.gray }}>of {fmtTenthsClock(Math.round(tEnd * 10))}</Text>
      </Text>

      <View style={{ marginTop: 14 }}>
        <Cells cells={now} accent />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Chip label="Meters" on={xMode === "meters"} onPress={() => setXMode("meters")} />
        <Chip label="Time" on={xMode === "time"} onPress={() => setXMode("time")} />
      </View>
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 10, lineHeight: 16 }]}>The whole piece · first {SKIP_S} s not drawn · drag across a chart</Text>

      <Pair title="Pace" unit="/500 m" series={series.pace} yLabel="FASTER UP" yFmt={paceFmt} invertY refY={120} refLabel="2:00" {...shared} />
      <Pair title="Watts" unit="per stroke" distUnit="W" series={series.watts} yLabel="W" {...shared} />
      <Pair title="Stroke rate" unit="SPM" series={series.spm} yLabel="SPM" yMin={0} {...shared} />
      <Pair title="Distance per stroke" unit="m" series={series.mps} yLabel="M" yFmt={oneDp} yMin={0} {...shared} />

      <ForceBundle doc={doc} strokeN={stroke ? stroke.n : null} placed={t !== null} w={w} />

      {blocks.length ? <Every500 blocks={blocks} on={t === null ? -1 : Math.floor(dist / 500) + 1} w={w} /> : null}
    </View>
  );
}

type PairProps = {
  title: string;
  unit: string;
  /* What the distribution counts in, when it is not the chart's unit. */
  distUnit?: string;
  series: Series[];
  w: number;
  cursor: number | null;
  onCursor: (x: number) => void;
  xWord: string;
  xFmt: (x: number) => string;
  yFmt?: (y: number) => string;
  yLabel: string;
  invertY?: boolean;
  refY?: number;
  refLabel?: string;
  yMin?: number;
};

/* ONE MEASURE, TWICE (owner, 2026-09-21, of the site: "there should be a
 * view that I can see the KDE on its own, not on the same chart as the line
 * chart. So it would be two different graphs"): the line through the piece,
 * and under it what the piece was made of. Both are handed the same points,
 * so they can never describe different strokes. */
const Pair = memo(function Pair(p: PairProps) {
  /* The spread describes the first SOLID series. A dashed companion is a
   * running average: its deviation shrinks as a row goes on whatever the
   * rower does, which is arithmetic and not a fact about anybody. */
  const lead = p.series.find((s) => s.kind !== "dashed" && s.points.length >= 2) ?? null;
  const spread = useMemo(() => (lead ? computeSpread(lead.points) : null), [lead]);
  if (!p.series.some((s) => s.points.length >= 2)) return null;
  const yFmt = p.yFmt ?? fmtNum;
  /* Where the rower is on their own hill: at the playhead, else the last
   * point of the piece. */
  const here = lead ? (p.cursor !== null ? nearestByX(lead.points, p.cursor) : lead.points[lead.points.length - 1]) : null;
  return (
    <View style={{ marginTop: 30 }}>
      <LineChart {...p} yFmt={yFmt} spread={spread} />
      {spread ? <DistChart title={p.title} unit={p.distUnit ?? p.unit} spread={spread} now={here ? here.y : null} fmt={yFmt} faster={p.invertY ?? false} w={p.w} /> : null}
    </View>
  );
});

/* A line through the piece, with the playhead on it. The drawing that does
 * not change is built once; only the hairline, its dots and the line of
 * numbers over the plot move with the finger. */
function LineChart({ title, unit, series, spread, w, cursor, onCursor, xWord, xFmt, yFmt, yLabel, invertY = false, refY, refLabel, yMin }: PairProps & { yFmt: (y: number) => string; spread: Spread | null }) {
  const H = 176;
  const plot = useMemo(() => computePlot(series, { W: w, H, pad: PAD, invertY, refY, yMin }), [series, w, invertY, refY, yMin]);
  const live = useRef<Plot | null>(plot);
  live.current = plot;
  const drag = useDrag((px) => {
    if (live.current) onCursor(live.current.ix(px));
  });

  const still = useMemo(() => {
    if (!plot) return null;
    const { sx, sy } = plot;
    const right = w - PAD.r;
    const base = H - PAD.b;
    const meanY = spread ? sy(spread.mean) : null;
    /* One deviation either side of the mean, as a slab under the data. Min
     * and max, not an assumed order: on an inverted axis the mean plus one
     * deviation is the lower point. */
    const bandA = spread && spread.sd > 0 ? Math.max(PAD.t, Math.min(sy(spread.mean + spread.sd), sy(spread.mean - spread.sd))) : 0;
    const bandB = spread && spread.sd > 0 ? Math.min(base, Math.max(sy(spread.mean + spread.sd), sy(spread.mean - spread.sd))) : 0;
    return (
      <G>
        <Axes W={w} H={H} pad={PAD} ys={plot.yt} sy={sy} fmt={yFmt} />
        {plot.xt.map((v) => (
          <Lab key={v} x={sx(v)} y={base + 12} anchor="middle">
            {xFmt(v)}
          </Lab>
        ))}
        {bandB > bandA ? <Rect x={PAD.l} y={bandA} width={right - PAD.l} height={bandB - bandA} fill={C.accent} opacity={0.07} /> : null}
        {spread && meanY !== null && meanY >= PAD.t && meanY <= base ? (
          <G>
            <Line x1={PAD.l} x2={right} y1={meanY} y2={meanY} stroke={C.gray} strokeWidth={1} strokeDasharray="6 4" />
            <Lab x={PAD.l + 3} y={meanY - 3} size={8}>{`MEAN ${yFmt(spread.mean)}`}</Lab>
          </G>
        ) : null}
        {refY !== undefined && refY >= Math.min(plot.lo, plot.hi) && refY <= Math.max(plot.lo, plot.hi) ? (
          <G>
            <Line x1={PAD.l} x2={right} y1={sy(refY)} y2={sy(refY)} stroke={C.gray} strokeWidth={1} strokeDasharray="4 4" />
            {refLabel ? (
              <Lab x={right} y={sy(refY) - 3} anchor="end" size={8}>
                {refLabel}
              </Lab>
            ) : null}
          </G>
        ) : null}
        {series.map((s, i) => {
          const pts = plot.drawn[i];
          if (!pts.length) return null;
          /* Every bar in one path: a stroke as wide as a bar, from the value
           * down to the base. */
          if (s.kind === "bars") return <Path key={i} d={pts.map((p) => `M${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}V${plot.barBaseY.toFixed(1)}`).join("")} stroke={C.accent} strokeWidth={Math.min(6, plot.barW)} fill="none" />;
          if (pts.length < 2) return null;
          return s.kind === "dashed" ? <Path key={i} d={pathOf(pts, sx, sy)} stroke={C.gray} strokeWidth={1.4} strokeDasharray="4 3" fill="none" strokeLinejoin="round" /> : <Path key={i} d={pathOf(pts, sx, sy)} stroke={C.accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />;
        })}
        <Lab x={right} y={H - 2} anchor="end" size={8}>
          {xWord}
        </Lab>
        <Lab x={PAD.l} y={PAD.t - 5} size={8}>
          {yLabel}
        </Lab>
      </G>
    );
  }, [plot, spread, series, w, xFmt, yFmt, xWord, yLabel, refY, refLabel]);

  if (!plot) return null;
  const lead = plot.lead >= 0 ? plot.drawn[plot.lead] : null;
  /* A playhead outside what this chart draws is not pulled to its edge: it
   * would go on reporting the first point as though it were under the
   * finger. It is simply not drawn here. */
  const slack = (plot.x1 - plot.x0) * 0.01;
  const snapped = cursor !== null && lead && cursor >= plot.x0 - slack && cursor <= plot.x1 + slack ? (nearestByX(lead, cursor)?.x ?? null) : null;
  const reads =
    snapped === null
      ? []
      : plot.drawn.map((pts, i) => {
          const p = nearestByX(pts, snapped);
          /* A series with nothing near the hairline prints two hyphens
           * rather than a value forty strokes away. */
          const near = p !== null && Math.abs(p.x - snapped) <= stepOf(plot, pts) * 1.5;
          return { label: series[i].label, p: near ? p : null };
        });
  const leadRead = reads[plot.lead]?.p ?? null;
  /* The one question a rower asks of a chart with a reference on it: how
   * far off two minutes am I, right here. */
  const delta = refY !== undefined && leadRead ? ` · VS ${refLabel ?? fmtNum(refY)} ${leadRead.y - refY < 0 ? "−" : "+"}${Math.abs(leadRead.y - refY).toFixed(1)} S` : "";
  const text = snapped === null ? null : `${xWord} ${xFmt(snapped)} · ${reads.map((r) => `${r.label} ${r.p ? yFmt(r.p.y) : "--"}`).join(" · ")}${delta}`;

  return (
    <View>
      <PanelHead title={title} unit={unit} note={series.map((s) => s.label).join(" · ")} />
      <Reading text={text} hint="Drag across the chart" />
      <View style={{ width: w, height: H }}>
        <Svg width={w} height={H}>
          {still}
          {snapped !== null ? (
            <G>
              <Line x1={plot.sx(snapped)} x2={plot.sx(snapped)} y1={PAD.t} y2={H - PAD.b} stroke={C.ink} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
              {reads.map((r, i) => (r.p ? <Circle key={i} cx={plot.sx(r.p.x)} cy={plot.sy(r.p.y)} r={3.4} fill={C.paper} stroke={series[i].kind === "dashed" ? C.gray : C.accent} strokeWidth={1.6} /> : null))}
            </G>
          ) : null}
        </Svg>
        <Hit drag={drag} label={`${title}. ${text ?? "Drag across the chart to read it."}`} />
      </View>
    </View>
  );
}

/* THE DISTRIBUTION, ON ITS OWN: the value along x, how much of the piece
 * sat there up y, the mean as a rule, one deviation as a slab, and a dot
 * for where the playhead sits on its own hill. Where the line above draws
 * faster upward, a faster pace here is to the LEFT, and the axis says so. */
function DistChart({ title, unit, spread: sp, now, fmt, faster, w }: { title: string; unit: string; spread: Spread; now: number | null; fmt: (v: number) => string; faster: boolean; w: number }) {
  const H = 124;
  const pad: Pad = { l: 8, r: 8, t: 16, b: 28 };
  const geo = useMemo(() => {
    if (!sp.xs || !sp.ys || sp.xs.length < 2 || w - pad.l - pad.r < 20) return null;
    const x0 = sp.xs[0];
    const x1 = sp.xs[sp.xs.length - 1];
    const ph = H - pad.t - pad.b;
    const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (w - pad.l - pad.r);
    const sy = (d: number) => pad.t + (1 - d) * ph;
    return { x0, x1, ph, sx, sy };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, w]);
  const still = useMemo(() => {
    if (!geo || !sp.xs || !sp.ys) return null;
    const { x0, x1, ph, sx, sy } = geo;
    const ys = sp.ys;
    const line = sp.xs.map((v, i) => `${i ? "L" : "M"}${sx(v).toFixed(1)} ${sy(ys[i]).toFixed(1)}`).join(" ");
    const a = Math.max(pad.l, sx(sp.mean - sp.sd));
    const b = Math.min(w - pad.r, sx(sp.mean + sp.sd));
    const mx = sx(sp.mean);
    const flip = mx > w * 0.6;
    return (
      <G>
        {b > a ? <Rect x={a} y={pad.t} width={b - a} height={ph} fill={C.accent} opacity={0.07} /> : null}
        <Path d={`${line} L${sx(x1).toFixed(1)} ${sy(0).toFixed(1)} L${sx(x0).toFixed(1)} ${sy(0).toFixed(1)} Z`} fill={C.accent} opacity={0.14} />
        <Path d={line} stroke={C.gray} strokeWidth={1.2} fill="none" strokeLinejoin="round" />
        <Line x1={pad.l} x2={w - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={C.ink} strokeWidth={1.5} />
        {mx >= pad.l && mx <= w - pad.r ? (
          <G>
            <Line x1={mx} x2={mx} y1={pad.t} y2={H - pad.b} stroke={C.gray} strokeWidth={1} strokeDasharray="6 4" />
            <Lab x={mx + (flip ? -4 : 4)} y={pad.t + 9} anchor={flip ? "end" : "start"} size={8}>{`MEAN ${fmt(sp.mean)}`}</Lab>
          </G>
        ) : null}
        {ticks(x0, x1, 3).map((v) => (
          <Lab key={v} x={sx(v)} y={H - pad.b + 12} anchor="middle">
            {fmt(v)}
          </Lab>
        ))}
        <Lab x={w - pad.r} y={H - 2} anchor="end" size={8}>
          {faster ? "FASTER TO THE LEFT" : unit.toUpperCase()}
        </Lab>
        <Lab x={pad.l} y={pad.t - 5} size={8}>
          DENSITY
        </Lab>
      </G>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, sp, w, fmt, faster, unit]);

  return (
    <View style={{ marginTop: 16 }}>
      <PanelHead title={title} unit={unit} note="Distribution" />
      <Text style={[mono(9, false, C.gray, 0.1), { lineHeight: 14, minHeight: 28, marginBottom: 2, fontVariant: ["tabular-nums"] }]}>{spreadWords(sp, now, fmt, faster)}</Text>
      {/* Every value the same is a real answer and not a curve: the words
          above say it and no hill is drawn over data with no width. */}
      {geo && still ? (
        <Svg width={w} height={H}>
          {still}
          {now !== null && now >= geo.x0 && now <= geo.x1 ? <Circle cx={geo.sx(now)} cy={geo.sy(densityAt(sp, now))} r={3.6} fill={C.paper} stroke={C.accent} strokeWidth={1.6} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

/* THE FORCE CURVES (owner, 2026-09-21, of the site: "I want to see it drawn
 * out like it does on the erg — it draws every force curve ... but I would
 * also like to see the average of my force curves"). Every stroke faint on
 * one frame: a tight bundle is a repeatable stroke, a wide one is not. Over
 * it the average, dashed, and the stroke at the playhead in the blue. The
 * frame is the drive, start to finish, because strokes are not all the same
 * length.
 *
 * A finger here reads ALONG THE DRIVE, not along the piece, so this chart
 * keeps a hairline of its own. */
const FORCE_DRAWN = 80;
const FORCE_PAD: Pad = { l: 34, r: 8, t: 16, b: 28 };

const ForceBundle = memo(function ForceBundle({ doc, strokeN, placed, w }: { doc: TelemetryDoc; strokeN: number | null; placed: boolean; w: number }) {
  const H = 210;
  const pad = FORCE_PAD;
  const [cur, setCur] = useState<number | null>(null);
  const usable = useMemo(() => doc.forceCurves.filter((c) => c.points.length >= 2 && c.points.some((p) => p > 0)), [doc]);
  /* At most eighty, taken evenly through the piece, so the bundle is the
   * whole row and not its last minute. */
  const bundle = useMemo(() => thinPoints(usable, FORCE_DRAWN).map((c) => resample(c.points)), [usable]);
  const avg = useMemo(() => (bundle.length ? Array.from({ length: FORCE_GRID }, (_, i) => bundle.reduce((s, c) => s + c[i], 0) / bundle.length) : []), [bundle]);
  /* The curve of the stroke at the playhead: the last one at or before it,
   * else the first there is; with no playhead, the last of the piece. */
  const at = !usable.length ? -1 : strokeN === null || !placed ? usable.length - 1 : Math.max(0, lastAtOrBefore(usable, (c) => c.n, strokeN));
  const here = useMemo(() => (at >= 0 ? resample(usable[at].points) : []), [usable, at]);
  const series = useMemo<Series[]>(() => {
    const xy = (c: number[]) => c.map((v, i) => ({ x: i / (FORCE_GRID - 1), y: v }));
    return [
      { points: xy(here), kind: "line", label: "THIS STROKE" },
      { points: xy(avg), kind: "dashed", label: "AVERAGE" },
    ];
  }, [here, avg]);
  const peak = useMemo(() => Math.max(1, ...bundle.flat(), ...here), [bundle, here]);
  const plot = useMemo(() => (bundle.length ? computePlot(series, { W: w, H, pad, yMin: 0, yMax: peak * 1.08 }) : null), [series, bundle.length, peak, w, pad]);
  const live = useRef<Plot | null>(plot);
  live.current = plot;
  const drag = useDrag((px) => {
    if (live.current) setCur(live.current.ix(px));
  });
  const faint = useMemo(() => {
    if (!plot) return null;
    return bundle.map((c, k) => <Path key={k} d={c.map((v, i) => `${i ? "L" : "M"}${plot.sx(i / (FORCE_GRID - 1)).toFixed(1)} ${plot.sy(v).toFixed(1)}`).join(" ")} stroke={C.ink} strokeWidth={0.8} opacity={0.09} fill="none" />);
  }, [plot, bundle]);

  if (!plot) return null;
  const { sx, sy } = plot;
  const snapped = cur === null ? null : (nearestByX(plot.drawn[0].length ? plot.drawn[0] : plot.drawn[1], cur)?.x ?? null);
  const read = (i: number) => (snapped === null ? null : nearestByX(plot.drawn[i], snapped));
  const mine = read(0);
  const mean = read(1);
  const herePeak = here.length ? Math.max(...here) : null;
  const text = snapped === null ? null : `DRIVE ${Math.round(snapped * 100)}% · THIS STROKE ${mine ? whole(mine.y) : "--"} · AVERAGE ${mean ? whole(mean.y) : "--"} LBF${mine ? ` · ${Math.round(lbfToNewtons(mine.y))} N` : ""}`;

  return (
    <View style={{ marginTop: 34 }}>
      <PanelHead title="Force curves" unit="lbf" note={`${bundle.length} strokes · ${placed ? "at the playhead" : "the last"} in blue · average dashed`} />
      <Reading text={text} hint="Drag along the drive" />
      <View style={{ width: w, height: H }}>
        <Svg width={w} height={H}>
          <Axes W={w} H={H} pad={pad} ys={plot.yt} sy={sy} fmt={whole} />
          {faint}
          {plot.drawn[1].length >= 2 ? <Path d={pathOf(plot.drawn[1], sx, sy)} stroke={C.soft} strokeWidth={1.8} strokeDasharray="6 4" fill="none" strokeLinejoin="round" /> : null}
          {plot.drawn[0].length >= 2 ? <Path d={pathOf(plot.drawn[0], sx, sy)} stroke={C.accent} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {herePeak !== null && at >= 0 ? <Lab x={pad.l + 4} y={pad.t + 10} color={C.ink}>{`PEAK ${whole(herePeak)} LBF · ${Math.round(lbfToNewtons(herePeak))} N · STROKE ${usable[at].n}`}</Lab> : null}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <Lab key={v} x={sx(v)} y={H - pad.b + 12} anchor={v === 1 ? "end" : v === 0 ? "start" : "middle"}>{`${Math.round(v * 100)}%`}</Lab>
          ))}
          <Lab x={w - pad.r} y={H - 2} anchor="end" size={8}>
            SHARE OF THE DRIVE
          </Lab>
          <Lab x={pad.l} y={pad.t - 5} size={8}>
            LBF
          </Lab>
          {snapped !== null ? (
            <G>
              <Line x1={sx(snapped)} x2={sx(snapped)} y1={pad.t} y2={H - pad.b} stroke={C.ink} strokeWidth={1} strokeDasharray="3 3" opacity={0.8} />
              {mean ? <Circle cx={sx(mean.x)} cy={sy(mean.y)} r={3.4} fill={C.paper} stroke={C.gray} strokeWidth={1.6} /> : null}
              {mine ? <Circle cx={sx(mine.x)} cy={sy(mine.y)} r={3.4} fill={C.paper} stroke={C.accent} strokeWidth={1.6} /> : null}
            </G>
          ) : null}
        </Svg>
        <Hit drag={drag} label={`Force curves. ${text ?? "Drag along the drive to read it."}`} />
      </View>
    </View>
  );
});

/* ---- tables ------------------------------------------------------------- */

type Col = { label: string; width: number; black?: boolean };

/* A table in the board's manner: grey mono words over it, mono figures on
 * the warm tint, a dashed rule between rows. The first column takes what
 * room is left; when the columns want more than the page has, the table
 * scrolls sideways and nothing is squeezed. `on` is a row to mark. */
function Table({ cols, rows, w, on = -1, accent = -1 }: { cols: Col[]; rows: string[][]; w: number; on?: number; accent?: number }) {
  const need = cols.reduce((s, c) => s + c.width, 0) + 12;
  const cell = (c: Col, i: number) => ({ width: i === 0 ? undefined : c.width, flex: i === 0 ? 1 : undefined, textAlign: i === 0 ? ("left" as const) : ("right" as const) });
  const body = (
    <View style={{ width: Math.max(w, need) }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 6, paddingVertical: 8, backgroundColor: C.tint, borderBottomWidth: 1, borderColor: C.ink }}>
        {cols.map((c, i) => (
          <Text key={c.label} style={[mono(9, false, C.gray, 0.06), cell(c, i)]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, k) => (
        <View key={k} style={{ backgroundColor: k === on ? C.pale : C.tint }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, paddingVertical: 9 }}>
            {r.map((v, i) => (
              <Text key={i} numberOfLines={1} style={[{ fontFamily: cols[i].black ? F.black : F.mono, fontSize: cols[i].black ? 13 : 11.5, color: i === 0 ? C.gray : cols[i].black && k === accent ? C.accent : C.ink, fontVariant: ["tabular-nums"] }, cell(cols[i], i)]}>
                {v}
              </Text>
            ))}
          </View>
          <Dash />
        </View>
      ))}
    </View>
  );
  return need > w ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {body}
    </ScrollView>
  ) : (
    body
  );
}

/* EVERY 500 M, cut from the tick stream; the block the playhead is in is
 * marked. */
const Every500 = memo(function Every500({ blocks, on, w }: { blocks: Block[]; on: number; w: number }) {
  let cum = 0;
  const rows = blocks.map((b, i) => {
    cum += b.seconds;
    const d = i > 0 ? b.seconds - blocks[i - 1].seconds : null;
    return [fmtMeters(b.n * b.meters), fmtTenthsClock(Math.round(b.seconds * 10)), paceFmt((b.seconds * 500) / b.meters), d === null ? "" : Math.abs(d) < 0.05 ? "even" : `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} s`, fmtTenthsClock(Math.round(cum * 10))];
  });
  return (
    <View style={{ marginTop: 34 }}>
      <PanelHead title="Every 500 m" note="Cut from the tick stream" />
      <Table
        w={w}
        on={blocks.findIndex((b) => b.n === on)}
        cols={[
          { label: "At", width: 62 },
          { label: "500 m in", width: 56 },
          { label: "Per 500 m", width: 60, black: true },
          { label: "Vs last", width: 56 },
          { label: "Elapsed", width: 68 },
        ]}
        rows={rows}
      />
    </View>
  );
});

/* The splits. A column the monitor sent nothing for (a derived split has no
 * rate, watts or drag) is left off, so the table does not carry three
 * columns of nothing. The fastest split's figure is in the blue. */
function SplitsTable({ splits, fastest, w }: { splits: AnalysisSplit[]; fastest: AnalysisSplit | null; w: number }) {
  const extra = [
    { label: "Rate", width: 40, pick: (s: AnalysisSplit) => s.spm },
    { label: "Watts", width: 46, pick: (s: AnalysisSplit) => s.watts },
    { label: "Drag", width: 40, pick: (s: AnalysisSplit) => s.drag },
  ].filter((c) => splits.some((s) => num(c.pick(s))));
  return (
    <Table
      w={w}
      accent={fastest ? splits.indexOf(fastest) : -1}
      cols={[{ label: "Split", width: 104 }, { label: "Meters", width: 50 }, { label: "Time", width: 60 }, { label: "Per 500 m", width: 60, black: true }, ...extra]}
      rows={splits.map((s) => [`${s.n} · to ${fmtInt(s.endMeters)} m`, fmtInt(s.meters), fmtTenthsClock(Math.round(s.seconds * 10)), split(s.paceTenths), ...extra.map((c) => (num(c.pick(s)) ? fmtInt(c.pick(s) as number) : "--"))])}
    />
  );
}

/* ---- THE SHAPE OF IT: the four pictures --------------------------------- */

/* A bar that rises as the screen opens. */
function Bar({ left, width, height, base, delay, color }: { left: number; width: number; height: number; base: number; delay: number; color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [a, delay]);
  return <Animated.View style={{ position: "absolute", left, bottom: base, width, height: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, height)] }), backgroundColor: color }} />;
}

/* SPLIT BY SPLIT. Taller is slower: the bars are splits, so a tall bar is
 * time spent. The baseline is not zero and the axis says so: every tick is
 * a split, and the dashed rule is the average of the piece. Only the
 * fastest is in the blue and its figure says so (owner, 2026-11-20: "What
 * are those colors for the splits? green, blue, black?"); the rest are
 * ink. */
function SplitBars({ splits, avgTenths, derived, fastest, w }: { splits: AnalysisSplit[]; avgTenths: number | null; derived: boolean; fastest: AnalysisSplit | null; w: number }) {
  const H = 206;
  const values = splits.map((s) => s.paceTenths as number);
  const avg = num(avgTenths) && avgTenths > 0 ? avgTenths : values.reduce((x, y) => x + y, 0) / values.length;
  const rawLo = Math.min(...values, avg);
  const rawHi = Math.max(...values, avg);
  const span = Math.max(rawHi - rawLo, 10);
  const lo = rawLo - span * 0.45;
  const hi = rawHi + span * 0.25;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40) return null;
  const slot = pw / splits.length;
  const barW = Math.max(2, slot * 0.66);
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;
  /* As many labels as fit: a figure is about 36 points wide. */
  const every = Math.max(1, Math.ceil(splits.length / Math.max(1, Math.floor(pw / 36))));
  const avgY = sy(avg);
  return (
    <View>
      <PanelHead title="Split by split" note={`${splits.length} · ${derived ? "cut from the tick stream" : "as the monitor recorded them"}`} />
      <View style={{ width: w, height: H }}>
        <Svg width={w} height={H}>
          <Axes W={w} H={H} pad={PAD} ys={ticks(lo, hi, 4)} sy={sy} fmt={split} />
          {splits.map((s, i) => {
            const x = PAD.l + i * slot + slot / 2;
            const quick = s === fastest;
            return i % every === 0 || quick ? (
              <G key={`${s.n}-${s.endMeters}`}>
                <Lab x={x} y={sy(s.paceTenths as number) - 4} anchor="middle" size={8} bold={quick} color={quick ? C.accent : C.soft}>
                  {split(s.paceTenths)}
                </Lab>
                {i % every === 0 ? (
                  <Lab x={x} y={H - PAD.b + 12} anchor="middle">
                    {fmtInt(s.endMeters)}
                  </Lab>
                ) : null}
              </G>
            ) : null;
          })}
          <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
            METERS
          </Lab>
          <Lab x={PAD.l} y={PAD.t - 5} size={8}>
            SPLIT PER 500 M · TALLER IS SLOWER · FASTEST IN BLUE
          </Lab>
        </Svg>
        {splits.map((s, i) => (
          <Bar key={`${s.n}-${s.endMeters}`} left={PAD.l + i * slot + slot / 2 - barW / 2} width={barW} height={H - PAD.b - sy(s.paceTenths as number)} base={PAD.b} delay={Math.min(i * 40, 600)} color={s === fastest ? C.accent : C.ink} />
        ))}
        {/* The average goes over the bars, so it is drawn after them. */}
        <Dash color={C.gray} style={{ position: "absolute", left: PAD.l, right: PAD.r, top: avgY }} />
        <Text style={[mono(8, false, C.soft, 0.1), { position: "absolute", right: PAD.r, top: avgY - 13, backgroundColor: C.paper, paddingHorizontal: 3 }]}>Average {split(avg)}</Text>
      </View>
    </View>
  );
}

/* RATE AND LENGTH. Two things on one picture because they are one thing:
 * rate solid on the left axis, meters a stroke dashed on the right. A piece
 * that holds its speed by shortening and rating up shows here as the lines
 * moving away from each other. */
function RateLength({ rate, len, w }: { rate: XY[]; len: XY[]; w: number }) {
  const H = 190;
  const pad: Pad = { l: 30, r: 30, t: 16, b: 28 };
  const pw = w - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const all = [...rate, ...len];
  if (pw < 40 || all.length < 2) return null;
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x), x0 + 1);
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * pw;
  const band = (vals: number[]) => {
    if (!vals.length) return { lo: 0, hi: 1 };
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi === lo) {
      lo -= 1;
      hi += 1;
    }
    const air = (hi - lo) * 0.12;
    return { lo: lo - air, hi: hi + air };
  };
  const rb = band(rate.map((p) => p.y));
  const lb = band(len.map((p) => p.y));
  const syR = (v: number) => pad.t + (1 - (v - rb.lo) / (rb.hi - rb.lo)) * ph;
  const syL = (v: number) => pad.t + (1 - (v - lb.lo) / (lb.hi - lb.lo)) * ph;
  return (
    <View>
      <PanelHead title="Rate and length" note="Rate solid · length dashed" />
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={pad} ys={rate.length > 1 ? ticks(rb.lo, rb.hi, 4) : []} sy={syR} fmt={whole} />
        {len.length > 1
          ? ticks(lb.lo, lb.hi, 4).map((v) => (
              <Lab key={v} x={w - pad.r + 4} y={syL(v) + 3}>
                {v.toFixed(1)}
              </Lab>
            ))
          : null}
        {len.length > 1 ? <Path d={pathOf(len, sx, syL)} stroke={C.gray} strokeWidth={1.4} strokeDasharray="5 4" fill="none" strokeLinejoin="round" /> : null}
        {rate.length > 1 ? <Path d={pathOf(rate, sx, syR)} stroke={C.accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {ticks(x0, x1, 3).map((v) => (
          <Lab key={v} x={sx(v)} y={H - pad.b + 12} anchor="middle">
            {whole(v)}
          </Lab>
        ))}
        {rate.length > 1 ? (
          <Lab x={pad.l} y={pad.t - 5} size={8}>
            STROKES A MINUTE
          </Lab>
        ) : null}
        {len.length > 1 ? (
          <Lab x={w - pad.r} y={pad.t - 5} anchor="end" size={8}>
            METERS A STROKE
          </Lab>
        ) : null}
        <Lab x={w - pad.r} y={H - 2} anchor="end" size={8}>
          STROKE
        </Lab>
      </Svg>
    </View>
  );
}

/* THE FORCE CURVE: the average stroke of the piece, filled, with the peak
 * marked and said in words under it. Where the peak sits along the drive is
 * the number that moves when the legs come in earlier. The dashed curve
 * behind it, when there is one, is the best piece already recorded at this
 * distance, on the same axis because both are stretched onto their own
 * drive. */
function ForceCurve({ force, compare, w }: { force: AnalysisForce; compare: { title: string; force: AnalysisForce } | null; w: number }) {
  const H = 190;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const n = force.points.length;
  if (pw < 40 || n < 2 || !num(force.peakLbf)) return null;
  const hi = Math.max(force.peakLbf, compare?.force.peakLbf ?? 0, 1) * 1.12;
  const sy = (v: number) => PAD.t + (1 - Math.max(0, v) / hi) * ph;
  const line = (pts: number[]) => pts.map((v, i) => `${i ? "L" : "M"}${(PAD.l + (i / (pts.length - 1)) * pw).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
  const mine = line(force.points);
  const px = PAD.l + (force.peakIndex / (n - 1)) * pw;
  const right = px > w * 0.55;
  return (
    <View>
      <PanelHead title="Force curve" note={`${fmtInt(force.curves)} strokes averaged`} />
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={PAD} ys={ticks(0, hi, 4)} sy={sy} fmt={whole} />
        {compare && compare.force.points.length >= 2 ? <Path d={line(compare.force.points)} stroke={C.gray} strokeWidth={1.4} strokeDasharray="5 4" fill="none" strokeLinejoin="round" /> : null}
        <Path d={`${mine} L${(PAD.l + pw).toFixed(1)} ${sy(0).toFixed(1)} L${PAD.l.toFixed(1)} ${sy(0).toFixed(1)} Z`} fill={C.accent} opacity={0.14} />
        <Path d={mine} stroke={C.accent} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={px} cy={sy(force.peakLbf)} r={3.4} fill={C.accent} />
        <Lab x={px + (right ? -7 : 7)} y={sy(force.peakLbf) - 6} anchor={right ? "end" : "start"} color={C.ink}>{`PEAK ${force.peakLbf.toFixed(0)} LBF`}</Lab>
        {[0, 25, 50, 75, 100].map((p) => (
          <Lab key={p} x={PAD.l + (p / 100) * pw} y={H - PAD.b + 12} anchor={p === 100 ? "end" : "middle"}>
            {String(p)}
          </Lab>
        ))}
        <Lab x={PAD.l} y={PAD.t - 5} size={8}>
          POUNDS OF FORCE
        </Lab>
        <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
          PERCENT OF THE DRIVE
        </Lab>
      </Svg>
      <Text style={[mono(10, false, C.soft, 0.1), { marginTop: 6, lineHeight: 16 }]}>
        Peak {force.peakLbf.toFixed(0)} lbf at {force.peakPct.toFixed(0)}% of the drive{compare ? ` · Dashed: ${compare.title}` : ""}
      </Text>
    </View>
  );
}

/* WORK PER STROKE: one dot a stroke and the least squares line through
 * them. A piece that held together is a flat line; one that came apart
 * slopes. */
function WorkPerStroke({ pts, trend, w }: { pts: XY[]; trend: AnalysisTrend | null; w: number }) {
  const H = 190;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40 || pts.length < 3) return null;
  const x0 = pts[0].x;
  const x1 = Math.max(pts[pts.length - 1].x, x0 + 1);
  let lo = Math.min(...pts.map((p) => p.y));
  let hi = Math.max(...pts.map((p) => p.y));
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const air = (hi - lo) * 0.14;
  lo -= air;
  hi += air;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;
  const dot = Math.max(1.2, Math.min(2.6, 220 / pts.length));
  const line = trend && num(trend.first) && num(trend.last) ? trend : null;
  return (
    <View>
      <PanelHead title="Work per stroke" note={line ? `${line.first.toFixed(0)} J to ${line.last.toFixed(0)} J on the trend` : "Joules"} />
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={PAD} ys={ticks(lo, hi, 4)} sy={sy} fmt={whole} />
        {/* Every dot in one path: a stroke of no length with a round cap. */}
        <Path d={pts.map((p) => `M${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}h0.01`).join("")} stroke={C.gray} strokeWidth={dot * 2} strokeLinecap="round" fill="none" />
        {line ? <Path d={`M${sx(x0).toFixed(1)} ${sy(line.first).toFixed(1)} L${sx(x1).toFixed(1)} ${sy(line.last).toFixed(1)}`} stroke={C.ink} strokeWidth={1.4} strokeDasharray="6 4" fill="none" /> : null}
        {ticks(x0, x1, 3).map((v) => (
          <Lab key={v} x={sx(v)} y={H - PAD.b + 12} anchor="middle">
            {whole(v)}
          </Lab>
        ))}
        <Lab x={PAD.l} y={PAD.t - 5} size={8}>
          JOULES A STROKE
        </Lab>
        <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
          STROKE
        </Lab>
      </Svg>
    </View>
  );
}
