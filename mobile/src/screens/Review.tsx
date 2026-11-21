import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
 * redrawn for one phone column, and since 2026-11-21 its own shape: the
 * head (ANALYTICS) with the time big; THE READ in plain English; the
 * numbers behind the sentences; then each picture in a box of its own with
 * one sentence under it: HOW STEADY (two scores to chase that are not
 * speed), the pace along the piece, rate and length, the force curve, work
 * per stroke; the splits; what to do next; and at the foot what was
 * counted and which monitor it came off.
 *
 * PLAY IT BACK is gone from the app (owner, 2026-11-21: "we can remove the
 * playback functionality for now. I don't want to support that"). The
 * site's page still has it.
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
  const [state, setState] = useState<{ doc: TelemetryDoc; compare: { title: string; doc: TelemetryDoc } | null; usual: number[] | null } | "missing" | null>(null);
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
      const alike = comparableRows(doc, history, row.id);
      const best = alike[0];
      const other = best ? await loadDoc(best.id) : null;
      /* THE USUAL WORK PER STROKE at this distance: the moving average of
       * every other recording of it on this phone (eight at most), each
       * stretched onto the same sixty steps from first stroke to last,
       * and averaged step by step. */
      const lines: number[][] = [];
      for (const r of alike.slice(0, 8)) {
        try {
          const d = r.id === best?.id ? other : await loadDoc(r.id);
          if (!d) continue;
          const pts = trimEnds(
            analyseSession({ doc: d, id: r.id, history: [], compare: null })
              .series.filter((x) => x.counted && num(x.workJ))
              .map((x) => ({ x: x.n, y: x.workJ as number })),
          );
          if (pts.length >= 20) lines.push(resample(smooth(pts, windowOf(pts.length)).map((p) => p.y), 60));
        } catch {
          /* A recording that will not read is left out of the usual. */
        }
      }
      const usual = lines.length ? lines[0].map((_, i) => lines.reduce((sum, l) => sum + l[i], 0) / lines.length) : null;
      if (live) setState({ doc, compare: best && other ? { title: best.title, doc: other } : null, usual });
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
  if (!a || !doc || !state || state === "missing") return null;

  const dr = a.driveRecovery;
  const numbers: CellData[] = [
    num(a.avgPaceTenths) ? { k: "Average split", v: split(a.avgPaceTenths), u: "per 500 m" } : null,
    num(a.avgSpm) ? { k: "Rate", v: a.avgSpm.toFixed(0), u: "strokes a minute" } : null,
    num(a.metresPerStroke) ? { k: "Meters a stroke", v: a.metresPerStroke.toFixed(2), u: "distance per stroke" } : null,
    num(a.avgWatts) ? { k: "Watts", v: fmtInt(a.avgWatts), u: "average power" } : null,
    num(a.workPerStrokeJ) ? { k: "Work a stroke", v: fmtInt(a.workPerStrokeJ), u: "joules" } : null,
    dr && num(dr.ratio) ? { k: "Drive to recovery", v: `1 : ${dr.ratio.toFixed(1)}`, u: `${dr.driveS.toFixed(2)} s drive` } : null,
    num(a.dragFactor) ? { k: "Drag factor", v: fmtInt(a.dragFactor), u: "the damper, as the monitor read it" } : null,
    a.strokes > 0 ? { k: "Strokes", v: fmtInt(a.strokes), u: "in the piece" } : null,
  ].filter((c): c is Exclude<CellData, null> => c !== null);

  const st = a.steady;
  const craft = craftOf(a, doc);
  const steady: CellData[] = [
    num(st.paceSdTenths) ? { k: "Split spread", v: `± ${fmtGap(st.paceSdTenths)}`, u: num(st.paceMeanTenths) ? `around ${split(Math.round(st.paceMeanTenths))}` : "" } : null,
    craft.rateSd !== null ? { k: "Rate held", v: `± ${craft.rateSd.toFixed(1)}`, u: "strokes a minute" } : null,
    /* Never settling is an answer; having nothing to measure is not. */
    num(st.paceSdTenths) ? (st.settle ? { k: "Strokes to settle", v: String(st.settle.count), u: `settled at stroke ${st.settle.strokeN}` } : { k: "Strokes to settle", v: "Never", u: "never inside the band" }) : null,
    a.halves ? { k: "Second half", v: a.halves.level ? "Level" : `${a.halves.negative ? "−" : "+"}${fmtGap(Math.abs(a.halves.deltaTenths))}`, u: a.halves.level ? "with the first" : a.halves.negative ? "faster than the first" : "slower than the first" } : null,
  ].filter((c): c is Exclude<CellData, null> => c !== null);

  /* The pictures, each with what it needs to exist. Every line is a
   * moving average of the strokes of the piece, the first and the last of
   * them left off. */
  const counted = a.series.filter((s) => s.counted);
  const win = windowOf(counted.length);
  const paceRaw = trimEnds(counted.filter((s) => num(s.paceTenths) && (s.paceTenths as number) > 0 && num(s.distanceM)).map((s) => ({ x: s.distanceM, y: (s.paceTenths as number) / 10 })));
  const pace = thinPoints(smooth(paceRaw, win * 2));
  const rate = thinPoints(smooth(trimEnds(counted.filter((s) => num(s.spm)).map((s) => ({ x: s.n, y: s.spm as number }))), win));
  const len = thinPoints(smooth(trimEnds(counted.filter((s) => num(s.mps)).map((s) => ({ x: s.n, y: s.mps as number }))), win));
  const workRaw = trimEnds(counted.filter((s) => num(s.workJ)).map((s) => ({ x: s.n, y: s.workJ as number })));
  const work = thinPoints(workRaw);
  const workAvg = thinPoints(smooth(workRaw, win));
  const has = { pace: pace.length >= 3, rate: rate.length >= 3 || len.length >= 3, force: a.force !== null, work: work.length >= 3 };
  const from = a.splitsFromMeters > 0 ? fmtInt(a.splitsFromMeters) : "";
  /* A chart is drawn inside its box: the box's edge and its padding off
   * each side. */
  const cw = w - 2 * BOX_PAD - 2;
  const avgS = num(a.avgPaceTenths) ? a.avgPaceTenths / 10 : meanOf(paceRaw.map((p) => p.y));

  /* What each picture says. */
  let paceSay: string | null = null;
  if (has.pace) {
    const quick = pace.reduce((m, p) => (p.y < m.y ? p : m), pace[0]);
    const slow = pace.reduce((m, p) => (p.y > m.y ? p : m), pace[0]);
    const halves = a.halves ? (a.halves.level ? "The two halves came in level." : a.halves.negative ? `The second half was ${fmtGap(Math.abs(a.halves.deltaTenths))} a 500 quicker than the first: a negative split.` : `The second half was ${fmtGap(Math.abs(a.halves.deltaTenths))} a 500 slower than the first: it went out harder than it could hold.`) : "";
    paceSay = `Quickest around ${fmtInt(Math.round(quick.x / 50) * 50)} m (${paceFmt(quick.y)}), slowest around ${fmtInt(Math.round(slow.x / 50) * 50)} m (${paceFmt(slow.y)}). ${halves}`.trim();
  }
  let rateSay: string | null = null;
  if (a.rateTrend && a.mpsTrend) {
    const dSpm = a.rateTrend.last - a.rateTrend.first;
    const dMps = a.mpsTrend.last - a.mpsTrend.first;
    rateSay =
      Math.abs(dSpm) < 1 && Math.abs(dMps) < 0.1
        ? `Rate and length both held: about ${a.rateTrend.mean.toFixed(0)} strokes a minute at ${a.mpsTrend.mean.toFixed(1)} m a stroke from start to finish.`
        : dSpm >= 1 && dMps <= -0.1
          ? `The rate climbed (${a.rateTrend.first.toFixed(0)} to ${a.rateTrend.last.toFixed(0)}) while each stroke got shorter (${a.mpsTrend.first.toFixed(1)} m to ${a.mpsTrend.last.toFixed(1)} m): the speed was kept by taking more strokes, not longer ones.`
          : dSpm <= -1 && dMps >= 0.1
            ? `The rate came down (${a.rateTrend.first.toFixed(0)} to ${a.rateTrend.last.toFixed(0)}) and each stroke went further (${a.mpsTrend.first.toFixed(1)} m to ${a.mpsTrend.last.toFixed(1)} m): longer, slower strokes as it went on.`
            : `Rate went ${a.rateTrend.first.toFixed(0)} to ${a.rateTrend.last.toFixed(0)} strokes a minute, and the stroke ${a.mpsTrend.first.toFixed(1)} m to ${a.mpsTrend.last.toFixed(1)} m.`;
  }
  const steadySay =
    craft.steady !== null
      ? `${Math.round(craft.within1 * 100)}% of the piece was rowed within a second of the average split, ${paceFmt(craft.paceMean)}, read five strokes at a time. The score is 100, less ten for every 1% the split wandered from its own average. It does not know how fast the piece was: a 2:30 held dead level beats a 1:50 that swings.`
      : null;

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      <Head a={a} />

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

      {/* HOW STEADY, first among the pictures: the one score here that is
          not about speed. */}
      {w > 0 && (craft.steady !== null || steady.length) ? (
        <Box title="How steady" note="Not about speed" say={steadySay}>
          {craft.steady !== null || craft.same !== null ? (
            <View style={{ flexDirection: "row", gap: 18, marginBottom: 14 }}>
              {craft.steady !== null ? <Score k="Steady pace" v={craft.steady} word={steadyWord(craft.steady)} /> : null}
              {craft.same !== null ? <Score k="Same stroke" v={craft.same} word={craft.same >= 85 ? "One stroke, repeated" : craft.same >= 70 ? "Mostly the same stroke" : "The stroke kept changing"} /> : null}
            </View>
          ) : null}
          <PaceSpread c={craft} w={cw} />
          {steady.length ? (
            <View style={{ marginTop: 10 }}>
              <Cells cells={steady} />
            </View>
          ) : null}
        </Box>
      ) : null}

      {w > 0 && has.pace ? (
        <Box title="Pace along the piece" note="Moving average" say={paceSay}>
          <PaceAlong pts={pace} avgS={avgS} w={cw} />
        </Box>
      ) : null}
      {w > 0 && has.rate ? (
        <Box title="Rate and length" note="Rate solid · length dashed" say={rateSay}>
          <RateLength rate={rate} len={len} w={cw} />
        </Box>
      ) : null}
      {w > 0 && a.force ? (
        <Box title="Force curve" note={`${fmtInt(a.force.curves)} strokes averaged`} say={forceWords(a.force, a.compare)}>
          <ForceCurve force={a.force} compare={a.compare} w={cw} />
        </Box>
      ) : null}
      {w > 0 && has.work ? (
        <Box title="Work per stroke" note="Joules" say={workWords(workAvg, state.usual)}>
          <WorkPerStroke pts={work} avg={workAvg} trend={a.workTrend} usual={state.usual} w={cw} />
        </Box>
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

      {/* AT THE FOOT: what the arithmetic was allowed to see (a monitor
          sitting between pieces keeps sending strokes nobody rowed, and
          they are left out of the averages), and which monitor it was
          (owner, 2026-11-21: "whatever the rower identifier was, we can
          include that down there"). */}
      <View style={{ marginTop: 40, borderTopWidth: 1, borderColor: C.line, paddingTop: 14 }}>
        <Text style={[mono(10, false, C.gray, 0.1), { lineHeight: 16 }]}>
          {[
            `${fmtInt(a.packetsRecorded)} packets recorded`,
            a.force ? `${fmtInt(a.force.curves)} force curves` : "no force curves",
            `${fmtInt(a.strokesCounted)} of ${fmtInt(a.series.length)} strokes counted`,
            a.strokesSetAside > 0 ? `${fmtInt(a.strokesSetAside)} set aside as the monitor between pieces` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 6, lineHeight: 16 }]}>
          {[doc.device.simulated ? "Simulated monitor" : doc.device.name || "Monitor", doc.device.serial ? `serial ${doc.device.serial}` : "", doc.device.model ?? "", doc.device.firmware ? `firmware ${doc.device.firmware}` : ""].filter(Boolean).join(" · ")}
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
      <Eye left="Analytics" />
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

/* ---- THE PICTURES, EACH IN ITS OWN BOX ---------------------------------- */

/* A CHART IS A CARD (owner, 2026-11-21: "should we make the profile page a
 * little less flat and box these charts up a little bit? ... give them a
 * little bit more formal section ... a more formal title"; and "is there
 * anything useful we can say ... below these charts?"). Its name in the
 * head's own face, a quiet word at the right, the picture, and under it ONE
 * thing the picture says, worked out from the same numbers and never made
 * up: a chart with nothing to say says nothing. */
const BOX_PAD = 14;
function Box({ title, note, say, children }: { title: string; note?: string; say?: string | null; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: BOX_PAD, marginTop: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 10, rowGap: 2, marginBottom: 10 }}>
        <Text style={{ fontFamily: F.black, fontSize: 18, lineHeight: 22, color: C.ink }}>{title}</Text>
        {note ? <Text style={mono(10, false, C.gray, 0.1)}>{note}</Text> : null}
      </View>
      {children}
      {say ? (
        <View style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 10, marginTop: 12 }}>
          <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.soft }}>{say}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* A MOVING AVERAGE, centred: each point is the mean of the points around
 * it, `win` of them, fewer at the two ends. What a stroke-by-stroke figure
 * is doing, without each stroke's own wobble. */
function smooth(pts: XY[], win: number): XY[] {
  const half = Math.max(1, Math.floor(win / 2));
  return pts.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(pts.length - 1, i + half); j++) {
      sum += pts[j].y;
      n++;
    }
    return { x: p.x, y: sum / n };
  });
}
/* How wide the window is for a piece of this many strokes: about a
 * twentieth of it, never under five strokes. */
const windowOf = (n: number) => Math.max(5, Math.round(n / 20) | 1);

/* THE FIRST AND THE LAST STROKES ARE NOT THE PIECE (owner, 2026-11-21:
 * "we can also cut off like the last or first stroke ... the meters per
 * stroke dropped a lot because it finished"): the flywheel spinning up and
 * the handle being let go. Two off each end, and then any stroke left at
 * either end that still sits far outside the rest. */
function trimEnds(pts: XY[]): XY[] {
  if (pts.length < 14) return pts;
  let out = pts.slice(2, -2);
  const ys = out.map((p) => p.y);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length) || 1;
  while (out.length > 10 && Math.abs(out[0].y - mean) > 3 * sd) out = out.slice(1);
  while (out.length > 10 && Math.abs(out[out.length - 1].y - mean) > 3 * sd) out = out.slice(0, -1);
  return out;
}

const meanOf = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const sdOf = (v: number[]) => {
  const m = meanOf(v);
  return v.length ? Math.sqrt(meanOf(v.map((x) => (x - m) ** 2))) : 0;
};

/* THE PACE ALONG THE PIECE, as one line (owner, 2026-11-21: "instead of
 * showing split pace in that bar chart with one bar per 500 ... let's show
 * it as a moving average line chart for the whole 5,000 meters"). Faster
 * is up. The dashed rule is the average of the piece. */
function PaceAlong({ pts, avgS, w }: { pts: XY[]; avgS: number; w: number }) {
  const H = 190;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40 || pts.length < 3) return null;
  const x0 = pts[0].x;
  const x1 = Math.max(pts[pts.length - 1].x, x0 + 1);
  const ys = pts.map((p) => p.y);
  let lo = Math.min(...ys, avgS);
  let hi = Math.max(...ys, avgS);
  const air = Math.max(1, (hi - lo) * 0.18);
  lo -= air;
  hi += air;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;
  /* Faster is up: the smaller split is nearer the top. */
  const sy = (v: number) => PAD.t + ((v - lo) / (hi - lo)) * ph;
  return (
    <Svg width={w} height={H}>
      <Axes W={w} H={H} pad={PAD} ys={ticks(lo, hi, 4)} sy={sy} fmt={paceFmt} />
      <Line x1={PAD.l} x2={w - PAD.r} y1={sy(avgS)} y2={sy(avgS)} stroke={C.gray} strokeWidth={1.2} strokeDasharray="5 4" />
      <Lab x={w - PAD.r} y={sy(avgS) - 4} anchor="end" size={8} color={C.soft}>{`AVERAGE ${paceFmt(avgS)}`}</Lab>
      <Path d={pathOf(pts, sx, sy)} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {ticks(x0, x1, 3).map((v) => (
        <Lab key={v} x={sx(v)} y={H - PAD.b + 12} anchor="middle">
          {fmtInt(v)}
        </Lab>
      ))}
      <Lab x={PAD.l} y={PAD.t - 5} size={8}>
        SPLIT PER 500 M · FASTER IS UP
      </Lab>
      <Lab x={w - PAD.r} y={H - 2} anchor="end" size={8}>
        METERS
      </Lab>
    </Svg>
  );
}

/* RATE AND LENGTH. Two things on one picture because they are one thing:
 * rate solid on the left axis, meters a stroke dashed on the right, each a
 * moving average. A piece that holds its speed by shortening and rating up
 * shows here as the lines moving away from each other. */
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
    const air = (hi - lo) * 0.2;
    return { lo: lo - air, hi: hi + air };
  };
  const rb = band(rate.map((p) => p.y));
  const lb = band(len.map((p) => p.y));
  const syR = (v: number) => pad.t + (1 - (v - rb.lo) / (rb.hi - rb.lo)) * ph;
  const syL = (v: number) => pad.t + (1 - (v - lb.lo) / (lb.hi - lb.lo)) * ph;
  return (
    <Svg width={w} height={H}>
      <Axes W={w} H={H} pad={pad} ys={rate.length > 1 ? ticks(rb.lo, rb.hi, 4) : []} sy={syR} fmt={oneDp} />
      {len.length > 1
        ? ticks(lb.lo, lb.hi, 4).map((v) => (
            <Lab key={v} x={w - pad.r + 4} y={syL(v) + 3}>
              {v.toFixed(1)}
            </Lab>
          ))
        : null}
      {len.length > 1 ? <Path d={pathOf(len, sx, syL)} stroke={C.gray} strokeWidth={1.6} strokeDasharray="5 4" fill="none" strokeLinejoin="round" /> : null}
      {rate.length > 1 ? <Path d={pathOf(rate, sx, syR)} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
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
  );
}

/* THE FORCE CURVE: the average stroke of the piece, filled, with the peak
 * marked. Where the peak sits along the drive is the number that moves when
 * the legs come in earlier. The dashed curve behind it, when there is one,
 * is the best piece already recorded at this distance, on the same axis
 * because both are stretched onto their own drive. */
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
  );
}

/* What the shape of the average stroke says. Two things can be read off it
 * without guessing: where the peak sits, and whether the push is one hump
 * or two. Nothing is said about legs, back and arms beyond what those two
 * carry. */
function forceWords(f: AnalysisForce, compare: { title: string } | null): string {
  const pts = f.points;
  const peak = f.peakLbf;
  /* A dip: a low between two highs, each at least a twelfth of the peak
   * above it, somewhere in the middle of the drive. */
  let dipAt = -1;
  for (let i = Math.round(pts.length * 0.15); i < Math.round(pts.length * 0.85); i++) {
    const before = Math.max(...pts.slice(0, i));
    const after = Math.max(...pts.slice(i + 1));
    if (before - pts[i] > peak / 12 && after - pts[i] > peak / 12 && (dipAt < 0 || pts[i] < pts[dipAt])) dipAt = i;
  }
  const at = f.peakPct.toFixed(0);
  const where =
    f.peakPct < 33
      ? `The peak comes early, at ${at}% of the drive: the legs hit hard off the catch. Holding that pressure on longer, through the back, is what fills the rest of the curve.`
      : f.peakPct <= 50
        ? `The peak sits at ${at}% of the drive, which is where a connected stroke puts it: legs first, and the back joining before the pressure falls.`
        : `The peak comes late, at ${at}% of the drive: the handle is still building as the legs finish. Loading the legs sooner off the catch moves it forward.`;
  const dip = dipAt >= 0 ? ` There is a dip at ${Math.round((dipAt / (pts.length - 1)) * 100)}%: the pressure dropped where the legs hand over to the back. One unbroken push takes it out.` : " It is one smooth hump, with no dip where the legs hand over to the back.";
  return `${where}${dip}${compare ? ` Dashed: ${compare.title}.` : ""}`;
}

/* WORK PER STROKE: one dot a stroke, THE MOVING AVERAGE through them (owner,
 * 2026-11-21: "I really want to see like a moving average line drawn
 * through here"), the straight trend as a quiet dashed rule, and, when this
 * phone holds other recordings of the same distance, their moving average
 * laid behind in the blue ("the line that I want to see on this chart is
 * the average, moving average of the work per stroke" over "all my rows
 * that are 5Ks"). */
function WorkPerStroke({ pts, avg, trend, usual, w }: { pts: XY[]; avg: XY[]; trend: AnalysisTrend | null; usual: number[] | null; w: number }) {
  const H = 200;
  const pw = w - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  if (pw < 40 || pts.length < 3) return null;
  const x0 = pts[0].x;
  const x1 = Math.max(pts[pts.length - 1].x, x0 + 1);
  let lo = Math.min(...pts.map((p) => p.y), ...(usual ?? []));
  let hi = Math.max(...pts.map((p) => p.y), ...(usual ?? []));
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const air = (hi - lo) * 0.14;
  lo -= air;
  hi += air;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph;
  const dot = Math.max(1.1, Math.min(2.4, 200 / pts.length));
  const line = trend && num(trend.first) && num(trend.last) ? trend : null;
  return (
    <>
      <Svg width={w} height={H}>
        <Axes W={w} H={H} pad={PAD} ys={ticks(lo, hi, 4)} sy={sy} fmt={whole} />
        {/* Every dot in one path: a stroke of no length with a round cap. */}
        <Path d={pts.map((p) => `M${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}h0.01`).join("")} stroke={C.line} strokeWidth={dot * 2} strokeLinecap="round" fill="none" />
        {line ? <Path d={`M${sx(x0).toFixed(1)} ${sy(line.first).toFixed(1)} L${sx(x1).toFixed(1)} ${sy(line.last).toFixed(1)}`} stroke={C.gray} strokeWidth={1.2} strokeDasharray="6 4" fill="none" /> : null}
        {usual && usual.length > 1 ? <Path d={usual.map((v, i) => `${i ? "L" : "M"}${(PAD.l + (i / (usual.length - 1)) * pw).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ")} stroke={C.accent} strokeWidth={1.6} strokeDasharray="2 4" strokeLinecap="round" fill="none" /> : null}
        {avg.length > 1 ? <Path d={pathOf(avg, sx, sy)} stroke={C.ink} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
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
      <Text style={[mono(9, false, C.gray, 0.1), { marginTop: 4, lineHeight: 15 }]}>Solid: moving average · dashed grey: the straight trend{usual ? " · dotted blue: your other rows at this distance" : ""}</Text>
    </>
  );
}

/* The three thirds of the moving average, said. */
function workWords(avg: XY[], usual: number[] | null): string | null {
  if (avg.length < 9) return null;
  const third = Math.floor(avg.length / 3);
  const a = meanOf(avg.slice(0, third).map((p) => p.y));
  const b = meanOf(avg.slice(third, 2 * third).map((p) => p.y));
  const c = meanOf(avg.slice(2 * third).map((p) => p.y));
  const all = meanOf(avg.map((p) => p.y));
  const pct = (x: number, y: number) => Math.round((Math.abs(x - y) / y) * 100);
  const f = (v: number) => v.toFixed(0);
  const flat = Math.max(a, b, c) - Math.min(a, b, c) < all * 0.03;
  let said: string;
  if (flat) said = `Every third of the piece took the same push, about ${f(all)} joules a stroke: nothing built and nothing faded.`;
  else if (b > a && b > c) said = `It built through the first third (${f(a)} to ${f(b)} joules) and then gave ${pct(c, b)}% of it back by the end (${f(c)}). The middle was the strongest part of the row.`;
  else if (c < a) said = `Each stroke did less as the piece went on: ${f(a)} joules in the first third, ${f(c)} in the last, ${pct(c, a)}% down. If the split held, the rate rose to cover it.`;
  else said = `Each stroke did more as the piece went on: ${f(a)} joules in the first third, ${f(c)} in the last. There was more there at the start.`;
  if (usual && usual.length) {
    const u = meanOf(usual);
    if (u > 0 && Math.abs(all - u) / u >= 0.02) said += ` Against your other rows at this distance it ran ${pct(all, u)}% ${all > u ? "higher" : "lower"} (${f(all)} against ${f(u)}).`;
  }
  return said;
}

/* ---- HOW STEADY --------------------------------------------------------- */

/* A SCORE TO CHASE THAT IS NOT SPEED (owner, 2026-11-21: "I really like the
 * idea of the how steady metric ... giving you like a rating for how steady
 * you are that you can work on ... it doesn't matter if I'm rowing a 201 or
 * a 230 if I am going for this like constant rate"; "the consistency of
 * your force curve is probably something that you would want to optimize").
 *
 *   STEADY        100, less ten for every 1% the split wandered from its
 *                 own average, read five strokes at a time (the standard
 *                 deviation of the split over its mean). A 2:00 split held within a
 *                 second and a bit scores 90.
 *   SAME STROKE   100, less three for every 1% the shape of a stroke
 *                 differed from the average stroke, each curve first scaled
 *                 to its own peak, so pulling harder does not count against
 *                 it: only pulling differently does.
 *
 * Both leave out the first strokes and the last, which are the flywheel
 * and the finish. Neither knows how fast the piece was. */
export type Craft = { steady: number | null; paceMean: number; paceSd: number; within1: number; paces: number[]; same: number | null; rateSd: number | null };
function craftOf(a: ErgAnalysis, doc: TelemetryDoc): Craft {
  const counted = a.series.filter((s) => s.counted);
  /* Five strokes at a time: one stroke's split jumps a second or two by
   * itself on any monitor, and that is not the rower wandering. */
  const paces = smooth(trimEnds(counted.filter((s) => num(s.paceTenths) && (s.paceTenths as number) > 0).map((s) => ({ x: s.n, y: (s.paceTenths as number) / 10 }))), 5).map((p) => p.y);
  const paceMean = meanOf(paces);
  const paceSd = sdOf(paces);
  const steady = paces.length >= 10 && paceMean > 0 ? Math.max(0, Math.min(100, Math.round(100 - (paceSd / paceMean) * 1000))) : null;
  const within1 = paces.length ? paces.filter((p) => Math.abs(p - paceMean) <= 1).length / paces.length : 0;
  /* The shape of each stroke against the average shape. */
  const shapes = doc.forceCurves
    .slice(3, -2)
    .filter((c) => c.points.length >= 6 && Math.max(...c.points) > 0)
    .map((c) => {
      const r = resample(c.points, 32);
      const peak = Math.max(...r) || 1;
      return r.map((v) => v / peak);
    });
  let same: number | null = null;
  if (shapes.length >= 8) {
    const mean = shapes[0].map((_, i) => meanOf(shapes.map((s) => s[i])));
    const rms = meanOf(shapes.map((s) => Math.sqrt(meanOf(s.map((v, i) => (v - mean[i]) ** 2)))));
    same = Math.max(0, Math.min(100, Math.round(100 - rms * 300)));
  }
  const rates = trimEnds(counted.filter((s) => num(s.spm)).map((s) => ({ x: s.n, y: s.spm as number }))).map((p) => p.y);
  return { steady, paceMean, paceSd, within1, paces, same, rateSd: rates.length >= 10 ? sdOf(rates) : null };
}
const steadyWord = (n: number) => (n >= 92 ? "Metronome" : n >= 85 ? "Steady" : n >= 75 ? "Mostly steady" : n >= 60 ? "Wandering" : "All over the place");

/* WHERE EVERY STROKE'S SPLIT FELL: columns of how many strokes were rowed
 * at each split, the average marked, and the band one deviation either
 * side of it shaded. A tall, narrow stack is a steady piece. Faster is at
 * the left. */
function PaceSpread({ c, w }: { c: Craft; w: number }) {
  const H = 150;
  const pad: Pad = { l: 8, r: 8, t: 14, b: 26 };
  const pw = w - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  if (pw < 40 || c.paces.length < 10) return null;
  const span = Math.max(c.paceSd * 3.2, 2);
  const lo = c.paceMean - span;
  const hi = c.paceMean + span;
  const BINS = 25;
  const counts = Array.from({ length: BINS }, () => 0);
  for (const p of c.paces) counts[Math.max(0, Math.min(BINS - 1, Math.floor(((p - lo) / (hi - lo)) * BINS)))]++;
  const top = Math.max(1, ...counts);
  const sx = (v: number) => pad.l + ((v - lo) / (hi - lo)) * pw;
  const bw = pw / BINS;
  const base = H - pad.b;
  return (
    <Svg width={w} height={H}>
      <Rect x={sx(c.paceMean - c.paceSd)} y={pad.t} width={Math.max(0, sx(c.paceMean + c.paceSd) - sx(c.paceMean - c.paceSd))} height={ph} fill={C.accent} opacity={0.12} />
      {counts.map((n, i) => (n ? <Rect key={i} x={pad.l + i * bw + 1} y={base - (n / top) * ph} width={Math.max(1, bw - 2)} height={(n / top) * ph} fill={C.ink} /> : null))}
      <Line x1={sx(c.paceMean)} x2={sx(c.paceMean)} y1={pad.t - 4} y2={base} stroke={C.accent} strokeWidth={2} />
      <Line x1={pad.l} x2={w - pad.r} y1={base} y2={base} stroke={C.ink} strokeWidth={1.5} />
      {[lo + span * 0.2, c.paceMean, hi - span * 0.2].map((v, i) => (
        <Lab key={i} x={sx(v)} y={base + 12} anchor="middle" bold={i === 1} color={i === 1 ? C.accent : undefined}>
          {paceFmt(v)}
        </Lab>
      ))}
      <Lab x={pad.l} y={H - 2} size={8}>
        ← FASTER
      </Lab>
      <Lab x={w - pad.r} y={H - 2} anchor="end" size={8}>
        SLOWER →
      </Lab>
    </Svg>
  );
}

/* One score: its name, the figure out of a hundred, and its bar. */
function Score({ k, v, word }: { k: string; v: number; word: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={mono(10, false, C.gray)}>{k}</Text>
      <Text style={{ fontFamily: F.black, fontSize: 44, lineHeight: 48, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 2 }}>
        {v}
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}> /100</Text>
      </Text>
      <View style={{ height: 6, backgroundColor: C.pale, marginTop: 4 }}>
        <View style={{ height: 6, width: `${v}%`, backgroundColor: C.accent }} />
      </View>
      <Text style={[mono(10, true, C.ink, 0.1), { marginTop: 6 }]}>{word}</Text>
    </View>
  );
}
