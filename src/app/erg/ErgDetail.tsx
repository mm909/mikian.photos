"use client";

import { useState } from "react";
import {
  ergMachineTypeWord,
  fmtClock,
  fmtElapsedHundredths,
  fmtForce,
  fmtMeters,
  fmtPace,
  fmtWatts,
  fmtWorkoutTarget,
  intervalTypeWord,
  lbfToNewtons,
  strokeStateWord,
  workoutStateWord,
  workoutTypeWord,
} from "@/lib/pm5/pm5";
import { fmtBand as fmtPredBand, fmtTime as fmtPredTime, predictFinish, type Block } from "@/lib/pm5/predict";
import { Chart, ForceCurveChart, thinPoints, type Series, type XY } from "./charts";
import {
  LINK_WORD,
  RATE_KEYS,
  RATE_WORD,
  clearErg,
  disconnect,
  ergTitle,
  ergUnsaved,
  reconnect,
  saveErg,
  setErgTitle,
  setRate,
  type Erg,
  type ErgStroke,
} from "./hub";
import { PlaybackBar } from "./PlaybackBar";

/* ONE ERG (owner, 2026-09-17: "click on that erg and see the telemetry for
 * that person, go back to a page and add another erg and monitor that one,
 * click in on it").
 *
 * The whole console for a single monitor: the head, the tiles, the rolling
 * charts, the per-stroke panel, the force curve, the splits, the summary
 * and the raw feed. It owns NO CONNECTION and NO TELEMETRY. Everything on
 * this screen is read off the Erg record the hub keeps, and every control
 * is one hub call — which is what makes BACK TO MONITORS free: this is a
 * view swapping on one page, not a route, so walking out of an erg and into
 * another drops nothing. Six monitors can be mid-piece while one of them is
 * on screen.
 *
 * NO HEART RATE anywhere here (owner, 2026-09-17: no belt this month).
 * There is no HR tile and no HR chart; DISTANCE PER STROKE took the fourth
 * chart slot, which is a number the owner can actually act on. The belt is
 * still decoded and still written into a saved session — see hub.ts.
 *
 * NOTHING ROWTEMBER: no challenge, no rower number, no board. An erg and
 * the numbers it sends. */

/* Live, the charts roll: the last two minutes and the last sixty strokes,
 * which is what somebody mid-piece wants to see. A saved row read back into
 * a slot is not rolling anywhere and shows all of itself. A PLAYBACK rolls
 * like a live erg on purpose — it is pretending to be one. */
const WINDOW_S = 120;
const WINDOW_STROKES = 60;
/* No line needs more points than the panel has pixels; a played-back
 * forty-five minute row would otherwise hand a chart twelve thousand. */
const CHART_POINTS = 600;

const dash = (v: string | null) => v ?? "—";

/* 113.4 seconds -> "1:53.4". The splits table wants tenths where the clock
 * helpers want whole seconds or hundredths. */
function fmtTenthsS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const t = Math.round(seconds * 10);
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${t % 10}`;
}

function dotClass(e: Erg): string {
  if (e.link === "live") return "eg-dot eg-dot-live";
  if (e.link === "connecting") return "eg-dot eg-dot-wait";
  if (e.link === "dropped") return "eg-dot eg-dot-gone";
  return "eg-dot";
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="eg-big">
      <span className="l">{label}</span>
      <span className="v">
        {value}
        {unit ? <span className="u">{unit}</span> : null}
      </span>
      <span className="s">{sub ?? ""}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}

export function ErgDetail({ erg, onBack, signedIn = false }: { erg: Erg; onBack: () => void; signedIn?: boolean }) {
  const [showFeed, setShowFeed] = useState(false);
  const [busy, setBusy] = useState(false);

  const m = erg.model;
  const g = m.general;
  const a1 = m.a1;
  const a2 = m.a2;
  const last: ErgStroke | null = m.strokes.length ? m.strokes[m.strokes.length - 1] : null;
  const playback = erg.source === "playback";
  const whole = erg.loaded !== null && !playback;

  /* ---- the chart windows --------------------------------------------- */

  const tEnd = m.samples.length ? m.samples[m.samples.length - 1].t : 0;
  const win = whole ? m.samples.filter((s) => s.t > 0) : m.samples.filter((s) => s.t >= tEnd - WINDOW_S && s.t > 0);
  const strokesWin = whole ? m.strokes : m.strokes.slice(-WINDOW_STROKES);

  /* The running average of every stroke so far, drawn only over the strokes
   * the window shows — so the dashed line is the piece average, not the
   * window average. */
  let runSum = 0;
  let runN = 0;
  const runningAvg: XY[] = [];
  for (const s of m.strokes) {
    if (s.watts === null) continue;
    runSum += s.watts;
    runN++;
    if (s.n >= (strokesWin[0]?.n ?? 0)) runningAvg.push({ x: s.n, y: runSum / runN });
  }

  const per = (pick: (s: ErgStroke) => number | null): XY[] =>
    thinPoints(
      strokesWin.flatMap((s) => {
        const y = pick(s);
        return y === null ? [] : [{ x: s.n, y }];
      }),
      CHART_POINTS,
    );

  const paceSeries: Series[] = [
    { kind: "line", label: "CURRENT", points: thinPoints(win.filter((s) => s.pace > 0).map((s) => ({ x: s.t, y: s.pace })), CHART_POINTS) },
    { kind: "dashed", label: "AVERAGE", points: thinPoints(win.filter((s) => s.avgPace > 0).map((s) => ({ x: s.t, y: s.avgPace })), CHART_POINTS) },
  ];
  const wattsSeries: Series[] = [
    { kind: "bars", label: "PER STROKE", points: per((s) => s.watts) },
    { kind: "dashed", label: "RUNNING AVG", points: thinPoints(runningAvg, CHART_POINTS) },
  ];
  const spmSeries: Series[] = [{ kind: "line", label: "SPM", points: thinPoints(win.map((s) => ({ x: s.t, y: s.spm })), CHART_POINTS) }];
  /* Where the heart rate chart used to be. Metres a stroke is the number
   * that says whether a rate went up because the rower did more work or
   * because the handle came back shorter. */
  const perStrokeSeries: Series[] = [{ kind: "line", label: "M", points: per((s) => s.strokeDistanceM) }];

  const avgPowerW = a2?.averagePowerW ?? a1?.averagePowerW ?? null;
  /* No 0x3D on the monitor, or one that took the subscription and then sent
   * no curve in three strokes. */
  const forceMissing = m.forceChar === false || (erg.link === "live" && erg.source === "live" && m.strokes.length >= 3 && m.forceCount === 0);

  const canSave = m.strokes.length > 0 || m.samples.length > 0;

  /* ---- where this row finishes, and how sure ------------------------- */

  /* The monitor's own projection is the current average multiplied out: it
   * says 20:00 at 200 m in exactly the voice it says 20:00 with 200 m to
   * go. predict.ts answers the question the rower is actually asking —
   * a finish WITH A BAND, built from how much the finished splits varied
   * and how many are left, so it starts wide and closes as the piece does.
   * The splits are the blocks; before the first one lands it falls back to
   * a prior and says so. */
  const blocks: Block[] = m.splits.flatMap((s) => {
    const a = s.a;
    if (!a) return [];
    const meters = a.splitDistanceM > 0 ? a.splitDistanceM : 0;
    const seconds = a.splitTimeS > 0 ? a.splitTimeS : 0;
    return meters > 0 && seconds > 0 ? [{ n: s.n, meters, seconds }] : [];
  });
  const pred = g
    ? predictFinish({
        targetMeters: g.totalWorkDistanceM > 0 ? g.totalWorkDistanceM : null,
        distanceM: g.distanceM,
        elapsedS: g.elapsedHundredths / 100,
        blocks,
        blockM: blocks.length ? blocks[blocks.length - 1].meters : 500,
        currentPaceS: a1 && a1.currentPaceS > 0 ? a1.currentPaceS : null,
      })
    : null;

  /* What the tile prints. A fixed distance gets the band; a just-row or a
   * timed piece has no finish to predict, so it falls back to the
   * monitor's own number and says where it came from. */
  const finishTile = (() => {
    if (pred?.ready && pred.finishS !== null) {
      const done = pred.remainingS === 0;
      const band = pred.bandS !== null && pred.bandS > 0 ? `± ${fmtPredBand(pred.bandS)}` : "EXACT";
      const how = done ? "THE PIECE IS ROWED" : pred.sigmaFromPrior ? "BAND FROM A PRIOR, NOT YET FROM THIS PIECE" : `FROM ${pred.blocksDone.toFixed(1)} SPLITS ROWED`;
      return { value: fmtPredTime(pred.finishS), sub: done ? how : `${band} · ${how}` };
    }
    const monitor = last?.projTimeS !== null && last?.projTimeS !== undefined ? fmtClock(last.projTimeS) : "—";
    const why = pred?.note ? pred.note.toUpperCase() : last?.projDistM !== null && last?.projDistM !== undefined ? `PROJECTED ${fmtMeters(last.projDistM)}` : "";
    return { value: monitor, sub: why ? `${why} · THE MONITOR'S OWN PROJECTION` : "" };
  })();

  const save = async () => {
    setBusy(true);
    await saveErg(erg.id, ergTitle(erg));
    setBusy(false);
  };

  const clear = () => {
    if (ergUnsaved(erg) && !window.confirm(`Clear ${erg.name}? ${erg.rec.packets.length.toLocaleString("en-US")} recorded packets go with it — SAVE first to keep them.`)) return;
    clearErg(erg.id);
  };

  return (
    <div className="eg-detail">
      {/* ---- the head ---- */}
      <div className="eg-dhead">
        <div className="eg-dwho">
          <button type="button" className="eg-btn eg-btn-quiet" onClick={onBack}>
            Back to monitors
          </button>
          <h2 className="eg-dname">{erg.name}</h2>
          <dl className="eg-dfacts">
            <dt>Serial</dt>
            <dd>{erg.serial || "—"}</dd>
            <dt>Model</dt>
            <dd>{erg.device.model ?? "—"}</dd>
            <dt>Firmware</dt>
            <dd>{erg.device.firmware ?? "—"}</dd>
            <dt>Machine</dt>
            <dd>{erg.device.machineType === null ? "—" : ergMachineTypeWord(erg.device.machineType)}</dd>
            <dt>Source</dt>
            <dd>{erg.sourceLabel ?? (erg.source === "live" ? "BLUETOOTH" : erg.source.toUpperCase())}</dd>
          </dl>
        </div>

        <div className="eg-dctl">
          <span className="eg-link-state">
            <span className={dotClass(erg)} aria-hidden="true" />
            {LINK_WORD[erg.link]}
            {erg.via ? ` · ${erg.via.toUpperCase()}` : ""}
            {erg.pps ? ` · ${erg.pps} PACKETS/S` : ""}
          </span>

          <span className="eg-dstate">
            {g ? workoutStateWord(g.workoutState) : "NO STATUS PACKET YET"}
            {g ? <span>{strokeStateWord(g.strokeState)}</span> : null}
          </span>

          <span className="eg-chips">
            <span className="eg-pb-k">Status every</span>
            {RATE_KEYS.map((k) => (
              <button key={k} type="button" className={erg.rate === k ? "eg-chip on" : "eg-chip"} aria-pressed={erg.rate === k} onClick={() => setRate(erg.id, k)}>
                {RATE_WORD[k]}
              </button>
            ))}
          </span>

          <span className="eg-btns" style={{ margin: 0 }}>
            {erg.source === "live" && erg.link !== "live" ? (
              <button type="button" className="eg-btn eg-btn-quiet" onClick={() => void reconnect(erg.id)}>
                Reconnect
              </button>
            ) : null}
            {erg.source === "live" && erg.link === "live" ? (
              <button type="button" className="eg-btn eg-btn-quiet" onClick={() => disconnect(erg.id)}>
                Disconnect
              </button>
            ) : null}
            <button type="button" className="eg-btn eg-btn-quiet" onClick={clear} disabled={!erg.rec.packets.length}>
              Clear
            </button>
          </span>

          {/* SAVE is this erg only. A playback has no SAVE at all: the row
           * it is playing is already saved, and a second copy of the same
           * piece helps nobody. */}
          {playback ? null : (
            <span className="eg-save">
              <label className="eg-note" htmlFor={`dtitle-${erg.id}`} style={{ position: "absolute", left: -10000 }}>
                Title for this session
              </label>
              <input id={`dtitle-${erg.id}`} value={ergTitle(erg)} onChange={(ev) => setErgTitle(erg.id, ev.target.value)} placeholder="Title for this session" />
              <button
                type="button"
                className="eg-btn"
                onClick={save}
                disabled={busy || erg.save.busy || !canSave || !signedIn}
                title={signedIn ? undefined : "Saving needs an account — sign in first"}
              >
                {busy || erg.save.busy ? "Saving…" : "Save"}
              </button>
            </span>
          )}
          {/* The only thing on this screen that needs an account. Said on
           * the button rather than by a 401 at the end of the piece. */}
          {!playback && !signedIn ? <span className="eg-note">Saving needs an account — sign in before you row, or this stays in the tab</span> : null}
          {!playback && erg.save.note ? <span className={erg.save.note.ok ? "eg-note" : "eg-note eg-bad"}>{erg.save.note.text}</span> : null}
          {erg.loaded ? <span className="eg-loaded">Loaded · {erg.loaded.title}</span> : null}
        </div>
      </div>

      {/* ---- the transport, when this erg is a row being played back ---- */}
      {playback ? <PlaybackBar erg={erg} /> : null}

      {/* ---- the tiles ---- */}
      <div className="eg-bigs">
        <Tile
          label="Elapsed"
          value={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"}
          sub={g ? `${workoutTypeWord(g.workoutType)} · ${fmtWorkoutTarget(g.workoutDuration, g.workoutDurationType)}` : ""}
        />
        <Tile
          label="Distance"
          value={g ? Math.floor(g.distanceM).toLocaleString("en-US") : "—"}
          unit="m"
          sub={g && g.totalWorkDistanceM ? `OF ${fmtMeters(g.totalWorkDistanceM)}` : ""}
        />
        <Tile label="Pace /500m" value={a1 ? fmtPace(a1.currentPaceS) : "—"} sub={a2 ? `SPLIT AVG ${fmtPace(a2.splitAvgPaceS)}` : ""} />
        <Tile
          label="Avg pace"
          value={a1 ? fmtPace(a1.averagePaceS) : "—"}
          sub={a2?.lastSplitTimeS ? `LAST SPLIT ${fmtTenthsS(a2.lastSplitTimeS)} · ${fmtMeters(a2.lastSplitDistanceM)}` : ""}
        />
        <Tile label="Stroke rate" value={a1 ? String(a1.strokeRate) : "—"} unit="spm" sub={g ? strokeStateWord(g.strokeState) : ""} />
        <Tile
          label="Watts"
          value={last?.watts !== null && last?.watts !== undefined ? String(last.watts) : "—"}
          unit="W"
          sub={avgPowerW !== null ? `AVG ${fmtWatts(avgPowerW)}${a2 ? ` · SPLIT ${fmtWatts(a2.splitAvgPowerW)}` : ""}` : ""}
        />
        <Tile label="Drag factor" value={g ? String(g.dragFactor) : "—"} sub={m.summary ? `PIECE AVG ${m.summary.dragFactorAvg}` : ""} />
        <Tile label="Speed" value={a1 ? a1.speedMps.toFixed(2) : "—"} unit="m/s" sub={a1 ? `${(a1.speedMps * 3.6).toFixed(1)} KM/H` : ""} />
        <Tile
          label="Calories"
          value={a2 ? String(a2.totalCalories) : "—"}
          unit="cal"
          sub={[last?.calPerHr !== null && last?.calPerHr !== undefined ? `${last.calPerHr} CAL/HR` : "", a2 ? `SPLIT AVG ${a2.splitAvgCalories}` : ""].filter(Boolean).join(" · ")}
        />
        <Tile
          label="Stroke count"
          value={last ? String(last.n) : "—"}
          sub={last?.strokeDistanceM !== null && last?.strokeDistanceM !== undefined ? `${last.strokeDistanceM.toFixed(2)} M PER STROKE` : ""}
        />
        <Tile label="Projected finish" value={finishTile.value} sub={finishTile.sub} />
        <Tile
          label="Work per stroke"
          value={last?.workJ !== null && last?.workJ !== undefined ? last.workJ.toFixed(0) : "—"}
          unit="J"
          sub={last?.driveLengthM !== null && last?.driveLengthM !== undefined ? `DRIVE ${last.driveLengthM.toFixed(2)} M` : ""}
        />
      </div>

      {/* ---- the charts ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Charts</h3>
          <span className="eg-note">{whole ? "THE WHOLE PIECE · LOADED" : `LAST ${WINDOW_S} S · LAST ${WINDOW_STROKES} STROKES`}</span>
        </div>
        <div className="eg-charts">
          <Chart title="Pace" unit="/500 M" series={paceSeries} xLabel="ELAPSED S" yLabel="FASTER UP" xFmt={(x) => fmtClock(x)} yFmt={(y) => fmtPace(y)} invertY refY={120} refLabel="2:00" />
          <Chart title="Watts" unit="PER STROKE" series={wattsSeries} xLabel="STROKE" yLabel="W" />
          <Chart title="Stroke rate" unit="SPM" series={spmSeries} xLabel="ELAPSED S" yLabel="SPM" xFmt={(x) => fmtClock(x)} yMin={0} />
          <Chart title="Distance per stroke" unit="M" series={perStrokeSeries} xLabel="STROKE" yLabel="M" yFmt={(y) => y.toFixed(1)} yMin={0} empty="WAITING FOR A STROKE" />
        </div>

        <div className="eg-sec-head" style={{ marginTop: 26 }}>
          <h3>The stroke</h3>
          <span className="eg-note">0X35 · 0X36 · PER STROKE</span>
        </div>
        <div className="eg-charts four">
          <Chart small title="Drive length" unit="M" series={[{ kind: "line", label: "M", points: per((s) => s.driveLengthM) }]} xLabel="STROKE" yLabel="M" yFmt={(y) => y.toFixed(2)} />
          <Chart
            small
            title="Drive / recovery"
            unit="S"
            series={[
              { kind: "line", label: "DRIVE", points: per((s) => s.driveTimeS) },
              { kind: "dashed", label: "RECOVERY", points: per((s) => s.recoveryTimeS) },
            ]}
            xLabel="STROKE"
            yLabel="S"
            yFmt={(y) => y.toFixed(2)}
            yMin={0}
          />
          <Chart
            small
            title="Drive force"
            unit="LBF"
            series={[
              { kind: "line", label: "PEAK", points: per((s) => s.peakLbf) },
              { kind: "dashed", label: "AVERAGE", points: per((s) => s.avgLbf) },
            ]}
            xLabel="STROKE"
            yLabel="LBF"
            yMin={0}
          />
          <Chart small title="Work per stroke" unit="J" series={[{ kind: "line", label: "J", points: per((s) => s.workJ) }]} xLabel="STROKE" yLabel="J" yMin={0} />
        </div>
      </section>

      {/* ---- the force curve ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Force curve</h3>
          <span className="eg-note">
            0X3D · LATEST STROKE{last?.peakLbf !== null && last?.peakLbf !== undefined ? ` · 0X35 PEAK ${fmtForce(last.peakLbf)}` : ""}
          </span>
        </div>
        {forceMissing ? (
          <div className="eg-none">
            <b>Force curve not sent by this monitor</b>
            PM5v1 or old firmware — characteristic 0x3D {m.forceChar === false ? "is not there" : "never fired"}.
          </div>
        ) : (
          <div className="eg-charts">
            <ForceCurveChart curve={m.force} newtons={lbfToNewtons} />
          </div>
        )}
      </section>

      {/* ---- the splits ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Splits</h3>
          <span className="eg-note">0X37 · 0X38</span>
        </div>
        {m.splits.length === 0 ? (
          <p className="eg-note">No split yet — they land at each split or interval boundary.</p>
        ) : (
          <div className="eg-scroll">
            <table className="eg-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Time</th>
                  <th>Distance</th>
                  <th>Avg pace</th>
                  <th>Avg power</th>
                  <th>SPM</th>
                  <th>Cal</th>
                  <th>Cal/hr</th>
                  <th>Speed</th>
                  <th>Rest time</th>
                  <th>Rest dist</th>
                  <th>Drag</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {m.splits.map((s) => (
                  <tr key={s.n}>
                    <td>{s.n}</td>
                    <td>{s.a ? fmtTenthsS(s.a.splitTimeS) : "—"}</td>
                    <td>{s.a ? fmtMeters(s.a.splitDistanceM) : "—"}</td>
                    <td>{s.b ? fmtPace(s.b.avgPaceS) : "—"}</td>
                    <td>{s.b ? fmtWatts(s.b.powerW) : "—"}</td>
                    <td>{s.b ? s.b.avgStrokeRate : "—"}</td>
                    <td>{s.b ? s.b.totalCalories : "—"}</td>
                    <td>{s.b ? s.b.avgCalories : "—"}</td>
                    <td>{s.b ? `${s.b.speedMps.toFixed(2)} m/s` : "—"}</td>
                    <td>{s.a ? fmtClock(s.a.intervalRestTimeS) : "—"}</td>
                    <td>{s.a ? fmtMeters(s.a.intervalRestDistanceM) : "—"}</td>
                    <td>{s.b ? s.b.avgDragFactor : "—"}</td>
                    <td>{s.a ? intervalTypeWord(s.a.splitType) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- the summary ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Summary</h3>
          <span className="eg-note">0X39 · 0X3A · 0X3C · AT THE LINE</span>
        </div>
        {!m.summary && !m.summary1 && !m.summary2 ? (
          <p className="eg-note">No summary yet — the monitor sends it when the piece ends.</p>
        ) : (
          <div className="eg-sum">
            {m.summary && (
              <>
                <Kv k="Elapsed" v={fmtElapsedHundredths(m.summary.elapsedHundredths)} />
                <Kv k="Distance" v={fmtMeters(m.summary.distanceM)} />
                <Kv k="Avg pace" v={m.summary.avgPaceS !== null ? fmtPace(m.summary.avgPaceS) : m.summary2 ? fmtPace(m.summary2.avgPaceS) : "—"} />
                <Kv k="Avg SPM" v={String(m.summary.avgStrokeRate)} />
                <Kv k="Drag avg" v={String(m.summary.dragFactorAvg)} />
                <Kv k="Workout type" v={workoutTypeWord(m.summary.workoutType)} />
                <Kv k="Log date / time" v={`${m.summary.logDate} / ${m.summary.logTime}`} />
              </>
            )}
            {m.summary1 && (
              <>
                <Kv k="Avg power" v={fmtWatts(m.summary1.watts)} />
                <Kv k="Total calories" v={String(m.summary1.totalCalories)} />
                <Kv k="Avg cal/hr" v={String(m.summary1.avgCalories)} />
                <Kv k="Split type" v={m.summary1.splitType !== null ? intervalTypeWord(m.summary1.splitType) : "—"} />
                <Kv k="Split size" v={String(m.summary1.splitSize)} />
                <Kv k="Interval count" v={String(m.summary1.splitCount)} />
                <Kv k="Rest distance" v={fmtMeters(m.summary1.totalRestDistanceM)} />
                <Kv k="Rest time" v={fmtClock(m.summary1.intervalRestTimeS)} />
              </>
            )}
            {m.summary2 && (
              <>
                <Kv k="Avg pace (0x3C)" v={fmtPace(m.summary2.avgPaceS)} />
                <Kv k="Verified" v={m.summary2.workoutVerified ? "YES" : "NO"} />
                <Kv k="Game" v={m.summary2.gameId ? `${m.summary2.gameId} · SCORE ${m.summary2.gameScore}` : "NONE"} />
                <Kv k="Machine" v={ergMachineTypeWord(m.summary2.ergMachineType)} />
              </>
            )}
          </div>
        )}
      </section>

      {/* ---- the raw feed and the log ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Feed</h3>
          <button type="button" className="eg-btn eg-btn-quiet" onClick={() => setShowFeed((v) => !v)}>
            {showFeed ? "Hide raw packets" : "Show raw packets"}
          </button>
        </div>
        <div className="eg-two">
          {showFeed ? (
            <div className="eg-feed" aria-live="off">
              {m.feed.length === 0
                ? "NO PACKETS YET"
                : m.feed
                    .slice()
                    .reverse()
                    .map((f, i) => (
                      <div key={`${f.at}-${i}`}>
                        <span className="ts">{f.at}</span>
                        <span className="id">
                          0x{f.id.toString(16).toUpperCase().padStart(2, "0")} {f.via === "mux" ? "via 0x80" : "direct"} · {f.bytes} B
                        </span>
                        <span className="hx">{f.hex}</span>
                        {f.decoded && (
                          <div className="dc">
                            {f.kind}:{" "}
                            {Object.entries(f.decoded)
                              .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(",")}]` : String(v)}`)
                              .join(" · ")}
                          </div>
                        )}
                      </div>
                    ))}
            </div>
          ) : (
            <p className="eg-note">
              {m.feed.length
                ? `${m.feed.length} packets in the raw feed · ${erg.rec.packets.length.toLocaleString("en-US")} recorded${erg.rec.dropped ? ` · ${erg.rec.dropped.toLocaleString("en-US")} dropped off the front` : ""}`
                : "The raw feed is hidden."}
            </p>
          )}
          <div className="eg-log">
            {m.log.length === 0
              ? "Nothing yet."
              : m.log
                  .slice()
                  .reverse()
                  .map((l, i) => (
                    <div key={`${l.at}-${i}`}>
                      <span className="ts">{l.at}</span>
                      {l.text}
                    </div>
                  ))}
          </div>
        </div>
      </section>

      <div className="eg-btns">
        <button type="button" className="eg-btn eg-btn-quiet" onClick={onBack}>
          Back to monitors
        </button>
        <span className="eg-note">{dash(erg.device.manufacturer)}</span>
      </div>
    </div>
  );
}
