"use client";

import { useEffect, useReducer, useState } from "react";
import { fmtClock, fmtMeters, fmtPace, lbfToNewtons } from "@/lib/pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc } from "@/lib/pm5/session";
import { Chart, DistChart, ForceCurveChart, thinPoints, type Series, type SpanControl, type XY } from "../charts";
import { blocksFor } from "../ErgGoal";
import { addSourceErg, getErg, markLoaded, removeErg, subscribe, type Erg, type ErgStroke } from "../hub";
import { createPlayback, forgetPlayback, rememberPlayback } from "../playback";
import { PlaybackBar } from "../PlaybackBar";

/* PLAYBACK INSIDE THE REVIEW (owner, 2026-09-24: "When I'm on the row
 * summary screen (after I click OPEN on a saved erg record) I should have a
 * button to play it back. Take over a bunch of those charts from the live
 * telemetry view and put them in this report, and let me play it back and
 * scrub through it — put the playback menu in this screen, in this
 * screen's color scheme.")
 *
 * The control is one word with a dotted rule under it, the house idiom for
 * a control that is text. Pressing it builds a playback driver from the
 * document this page already holds (the server hands it down as a prop —
 * it is JSON), registers it with the hub as a playback erg exactly the way
 * the monitors screen does (MonitorList.playRow), and renders THE LIVE
 * CHARTS from charts.tsx against that erg: pace, watts, stroke rate,
 * distance per stroke — each with its distribution beside it — the force
 * curve, and the 500 m blocks, under the same PlaybackBar the console
 * uses. The components are reused, not copied: if a replay reads wrong
 * here it reads wrong in the room, which is the point.
 *
 * PAPER, NOT INK. Everything here wears the .eg-paper variables the review
 * already resolves, and reviewPlayCss.ts turns the one bright line of each
 * chart water blue, the way the review charts above it are drawn.
 *
 * LEAVING THE PAGE REMOVES THE ERG. The hub is a module singleton and would
 * otherwise keep the played-back row on the monitors list after this page
 * is gone; the effect cleanup forgets the driver and removes the slot.
 *
 * ?play=1 opens the block on load (and ?at=SECONDS parks the playhead
 * there), so a link — or a headless screenshot — lands on it mounted. */

const WINDOW_S = 120;
const WINDOW_STROKES = 60;
const CHART_POINTS = 600;
/* The same first five seconds the console leaves undrawn (owner,
 * 2026-09-21): the flywheel spinning up sends a 10:00 split. */
const SKIP_S = 5;

type XMode = "meters" | "time";

function Now({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <div className="rv-cell">
      <span className="rv-k">{k}</span>
      <span className="rv-v">{v}</span>
      {u ? <span className="rv-u">{u}</span> : null}
    </div>
  );
}

export function ReviewPlayback({ doc, rowId, title, startOpen = false, startAtS = 0 }: { doc: TelemetryDoc; rowId: string; title: string; startOpen?: boolean; startAtS?: number }) {
  const [open, setOpen] = useState(startOpen);
  const [ergId, setErgId] = useState<string | null>(null);
  /* THE HUB MUTATES ITS ERG IN PLACE and notifies with the same object, so
   * holding the erg in state would never re-render: a counter is bumped on
   * every notification and the erg is read fresh off the hub each render. */
  const [, tick] = useReducer((n: number) => n + 1, 0);
  /* THE WHOLE PIECE BY DEFAULT: a piece being read back is not mid-row,
   * and a scrub across it should show where the playhead is against all
   * of it. The rolling window the console starts in is one chip away. */
  const [wholePiece, setWholePiece] = useState(true);
  const [xMode, setXMode] = useState<XMode>("meters");

  /* Build the erg when the block opens, take it down when it closes or
   * the page goes. */
  useEffect(() => {
    if (!open) return;
    const driver = createPlayback(doc, title);
    if (startAtS > 0) driver.seekMs(startAtS * 1000);
    const id = addSourceErg({
      source: "playback",
      driver,
      device: {
        name: doc.device.name,
        serial: doc.device.serial,
        model: doc.device.model ?? null,
        firmware: doc.device.firmware ?? null,
        hardware: doc.device.hardware ?? null,
        simulated: doc.device.simulated,
      },
    });
    rememberPlayback(id, driver);
    markLoaded(id, { id: rowId, title });
    setErgId(id);
    const off = subscribe(tick);
    return () => {
      off();
      forgetPlayback(id);
      removeErg(id);
      setErgId(null);
    };
    /* The document and the title are fixed for the life of the page. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const erg: Erg | null = open && ergId ? getErg(ergId) : null;

  return (
    <section className="rv-sec rv-play">
      <h2>
        <button type="button" className="rv-word" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Close the playback" : "Play it back"}
        </button>
        <em>· the live charts, fed from this document · scrub, pause, half to eight times</em>
      </h2>
      {open && erg ? <PlayBody erg={erg} wholePiece={wholePiece} setWholePiece={setWholePiece} xMode={xMode} setXMode={setXMode} /> : null}
    </section>
  );
}

/* The console's chart glue, cut down to the charts the review wants: the
 * same windows, the same sentinels filtered, the same x modes. */
function PlayBody({ erg, wholePiece, setWholePiece, xMode, setXMode }: { erg: Erg; wholePiece: boolean; setWholePiece: (v: boolean) => void; xMode: XMode; setXMode: (m: XMode) => void }) {
  const m = erg.model;
  const g = m.general;
  const a1 = m.a1;
  const last: ErgStroke | null = m.strokes.length ? m.strokes[m.strokes.length - 1] : null;

  const tEnd = m.samples.length ? m.samples[m.samples.length - 1].t : 0;
  const win = wholePiece ? m.samples.filter((s) => s.t >= SKIP_S) : m.samples.filter((s) => s.t >= tEnd - WINDOW_S && s.t >= SKIP_S);
  const strokesAll = m.strokes.filter((s) => s.elapsedS === null || s.elapsedS >= SKIP_S);
  const strokesWin = wholePiece ? strokesAll : strokesAll.slice(-WINDOW_STROKES);

  const sampleX = (s: { t: number; dist: number }) => (xMode === "meters" ? s.dist : s.t);
  const strokeX = (s: ErgStroke): number | null => (xMode === "meters" ? s.distanceM : s.elapsedS);
  const xLabel = xMode === "meters" ? "METRES" : "ELAPSED";
  const xFmt = xMode === "meters" ? (x: number) => Math.round(x).toLocaleString("en-US") : (x: number) => fmtClock(x);
  const span: SpanControl = {
    whole: wholePiece,
    can: true,
    set: setWholePiece,
    note: wholePiece ? "THE WHOLE PIECE" : `LAST ${WINDOW_S} S · LAST ${WINDOW_STROKES} STROKES`,
  };

  let runSum = 0;
  let runN = 0;
  const runningAvg: XY[] = [];
  for (const s of m.strokes) {
    if (s.watts === null) continue;
    runSum += s.watts;
    runN++;
    const x = strokeX(s);
    if (x !== null && s.n >= (strokesWin[0]?.n ?? 0)) runningAvg.push({ x, y: runSum / runN });
  }

  const per = (pick: (s: ErgStroke) => number | null): XY[] =>
    thinPoints(
      strokesWin.flatMap((s) => {
        const y = pick(s);
        const x = strokeX(s);
        return y === null || x === null ? [] : [{ x, y }];
      }),
      CHART_POINTS,
    );

  const paceSeries: Series[] = [
    { kind: "line", label: "CURRENT", points: thinPoints(win.filter((s) => s.pace > 0).map((s) => ({ x: sampleX(s), y: s.pace })), CHART_POINTS) },
    { kind: "dashed", label: "AVERAGE", points: thinPoints(win.filter((s) => s.avgPace > 0).map((s) => ({ x: sampleX(s), y: s.avgPace })), CHART_POINTS) },
  ];
  const wattsSeries: Series[] = [
    { kind: "bars", label: "PER STROKE", points: per((s) => s.watts) },
    { kind: "dashed", label: "RUNNING AVG", points: thinPoints(runningAvg, CHART_POINTS) },
  ];
  const spmSeries: Series[] = [{ kind: "line", label: "SPM", points: thinPoints(win.filter((s) => s.spm > 0).map((s) => ({ x: sampleX(s), y: s.spm })), CHART_POINTS) }];
  const perStrokeSeries: Series[] = [{ kind: "line", label: "M", points: per((s) => s.strokeDistanceM) }];

  const { blocks } = blocksFor(erg);
  let cum = 0;

  return (
    <div className="rv-playbody">
      <PlaybackBar erg={erg} />

      {/* WHERE THE PLAYHEAD IS, in the review's own strip: the monitor as
        * it read at this instant of the piece. */}
      <div className="rv-strip rv-now">
        <Now k="Elapsed" v={g ? fmtClock(g.elapsedHundredths / 100) : "—"} u="at the playhead" />
        <Now k="Distance" v={g ? Math.floor(g.distanceM).toLocaleString("en-US") : "—"} u="metres" />
        <Now k="Pace" v={a1 ? fmtPace(a1.currentPaceS) : "—"} u="per 500 m" />
        <Now k="Rate" v={a1 ? String(a1.strokeRate) : "—"} u="strokes a minute" />
        <Now k="Watts" v={last?.watts !== null && last?.watts !== undefined ? String(last.watts) : "—"} u="this stroke" />
        <Now k="Stroke" v={last ? String(last.n) : "—"} u={last?.strokeDistanceM !== null && last?.strokeDistanceM !== undefined ? `${last.strokeDistanceM.toFixed(2)} m per stroke` : "count"} />
      </div>

      <div className="eg-sec-head rv-playhead">
        <span className="eg-chips">
          <button type="button" className={span.whole ? "eg-chip" : "eg-chip on"} aria-pressed={!span.whole} onClick={() => span.set(false)}>
            Rolling window
          </button>
          <button type="button" className={span.whole ? "eg-chip on" : "eg-chip"} aria-pressed={span.whole} onClick={() => span.set(true)}>
            Whole piece
          </button>
        </span>
        <span className="eg-chips">
          <button type="button" className={xMode === "meters" ? "eg-chip on" : "eg-chip"} aria-pressed={xMode === "meters"} onClick={() => setXMode("meters")}>
            Metres
          </button>
          <button type="button" className={xMode === "time" ? "eg-chip on" : "eg-chip"} aria-pressed={xMode === "time"} onClick={() => setXMode("time")}>
            Time
          </button>
        </span>
        <span className="eg-note">{span.note} · FIRST {SKIP_S} S NOT DRAWN · CLICK A CHART TO OPEN IT</span>
      </div>

      <div className="eg-pairs">
        <div className="eg-pair">
          <Chart
            title="Pace"
            unit="/500 M"
            series={paceSeries}
            xLabel={xLabel}
            yLabel="FASTER UP"
            xFmt={xFmt}
            yFmt={(y) => fmtPace(y)}
            invertY
            refY={120}
            refLabel="2:00"
            refDeltaFmt={(d) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} S`}
            xWord={xLabel}
            span={span}
            stat
          />
          <DistChart title="Pace" unit="/500 M" points={paceSeries[0].points} fmt={(y) => fmtPace(y)} invertY />
        </div>
        <div className="eg-pair">
          <Chart title="Watts" unit="PER STROKE" series={wattsSeries} xLabel={xLabel} yLabel="W" xFmt={xFmt} xWord={xLabel} span={span} stat />
          <DistChart title="Watts" unit="W" points={wattsSeries[0].points} />
        </div>
        <div className="eg-pair">
          <Chart title="Stroke rate" unit="SPM" series={spmSeries} xLabel={xLabel} yLabel="SPM" xFmt={xFmt} yMin={0} xWord={xLabel} span={span} stat />
          <DistChart title="Stroke rate" unit="SPM" points={spmSeries[0].points} />
        </div>
        <div className="eg-pair">
          <Chart
            title="Distance per stroke"
            unit="M"
            series={perStrokeSeries}
            xLabel={xLabel}
            yLabel="M"
            xFmt={xFmt}
            yFmt={(y) => y.toFixed(1)}
            yMin={0}
            empty="WAITING FOR A STROKE"
            xWord={xLabel}
            span={span}
            stat
          />
          <DistChart title="Distance per stroke" unit="M" points={perStrokeSeries[0].points} fmt={(y) => y.toFixed(1)} />
        </div>
      </div>

      <div className="eg-sec-head rv-playhead">
        <h3>Force curves</h3>
        <span className="eg-note">EVERY STROKE SO FAR · THE LATEST IN BLUE · THE AVERAGE DASHED</span>
      </div>
      <div className="eg-charts">
        <ForceCurveChart curves={m.forces} latest={m.force} newtons={lbfToNewtons} />
      </div>

      <div className="eg-sec-head rv-playhead">
        <h3>Every 500 m</h3>
        <span className="eg-note">CUT FROM THE TICK STREAM, UP TO THE PLAYHEAD</span>
      </div>
      {blocks.length ? (
        <div className="rv-tablewrap">
          <table className="rv-table">
            <thead>
              <tr>
                <th className="lead">At</th>
                <th>500 m in</th>
                <th>Per 500 m</th>
                <th>Vs last</th>
                <th>Elapsed</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b, i) => {
                cum += b.seconds;
                const prev = i > 0 ? blocks[i - 1] : null;
                const d = prev ? b.seconds - prev.seconds : null;
                return (
                  <tr key={b.n}>
                    <td className="lead">{fmtMeters(b.n * b.meters)}</td>
                    <td>{fmtTenthsClock(Math.round(b.seconds * 10))}</td>
                    <td className="pace">{fmtPace((b.seconds * 500) / b.meters)}</td>
                    <td>{d === null ? "—" : Math.abs(d) < 0.05 ? "even" : `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} s`}</td>
                    <td>{fmtTenthsClock(Math.round(cum * 10))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="eg-note">No 500 m yet — play, or scrub forward.</p>
      )}
    </div>
  );
}
