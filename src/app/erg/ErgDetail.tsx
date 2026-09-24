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
import { Chart, DistChart, ForceCurveChart, thinPoints, type Series, type SpanControl, type XY } from "./charts";
import { blocksFor, expectedFinish, goalOf, goalWord, pieceEnded, typedErgName } from "./ErgGoal";
import { RowerPick, type Roster } from "./RowerPick";
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
  type ErgFeedLine,
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
/* THE FIRST FIVE SECONDS ARE NOT CHARTED (owner, 2026-09-21: "the beginning
 * five seconds of every row are going to really skew what the chart looks
 * like, so we can adjust our axes to ignore the first five seconds"). The
 * flywheel spinning up sends a 10:00 split and a 300 W stroke, and one of
 * those on a chart drags every axis to fit it. They are still recorded and
 * still saved; they are simply not drawn. */
const SKIP_S = 5;

/* WHAT THE X AXIS COUNTS (owner, 2026-09-21: "let us make the x axis always
 * metres, not strokes. Metres and time should be the x axis, but metres by
 * default"). One setting for every chart on the console. */
type XMode = "meters" | "time";

/* THE CHARACTERISTICS THE TABLE HAS A ROW FOR, in the order the spec lists
 * them, whether or not this monitor has sent one yet — a row that has never
 * arrived is an empty row, which is the honest way to show it is missing. */
const FEED_ROWS: { id: number; word: string }[] = [
  { id: 0x31, word: "General status" },
  { id: 0x32, word: "Additional status" },
  { id: 0x33, word: "Additional status 2" },
  { id: 0x35, word: "Stroke" },
  { id: 0x36, word: "Additional stroke" },
  { id: 0x37, word: "Split" },
  { id: 0x38, word: "Additional split" },
  { id: 0x39, word: "Workout summary" },
  { id: 0x3a, word: "Additional summary" },
  { id: 0x3c, word: "Additional summary 2" },
  { id: 0x3b, word: "Heart rate belt" },
  { id: 0x3d, word: "Force curve" },
];

/* A decoded value as one cell. Arrays are the force curve, which is a
 * picture and not a number. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return `${v.length} pts`;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

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

/* HINT is the long line a tile cannot print — what the expected finish's
 * band is and where it came from — held on the tile rather than on the
 * screen, the same way the monitors row holds it (review, 2026-09-17). */
function Tile({ label, value, unit, sub, hint }: { label: string; value: string; unit?: string; sub?: string; hint?: string | null }) {
  /* The tile is about 180px wide whatever the screen is, so the size the
   * clamp reaches holds six characters. A longer number steps down a size
   * rather than being cut off (owner, 2026-09-17, playing a row back: in the
   * expected 5,000 metres the numbers go out of the box). */
  const fit = value.length >= 9 ? "v v-tight" : value.length >= 7 ? "v v-snug" : "v";
  return (
    <div className="eg-big" title={hint ?? undefined}>
      <span className="l">{label}</span>
      <span className={fit}>
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

export function ErgDetail({ erg, onBack, signedIn = false, roster = null }: { erg: Erg; onBack: () => void; signedIn?: boolean; roster?: Roster | null }) {
  const [showFeed, setShowFeed] = useState(false);
  /* Whether the charts hold the whole piece rather than the rolling
   * window. Here rather than in a chart, because all nine share it. */
  const [wholePiece, setWholePiece] = useState(false);
  const [busy, setBusy] = useState(false);
  /* Metres by default. */
  const [xMode, setXMode] = useState<XMode>("meters");
  /* THE SETTINGS DRAWER (owner, 2026-09-21: "the goal and the targets and the
   * status every should all be in a little menu option and not prominently
   * displayed — same with serial number, model, firmware, all of that should
   * be in a settings or information section"). Closed by default. */
  const [settings, setSettings] = useState(false);

  const m = erg.model;
  const g = m.general;
  const a1 = m.a1;
  const a2 = m.a2;
  const last: ErgStroke | null = m.strokes.length ? m.strokes[m.strokes.length - 1] : null;
  const playback = erg.source === "playback";
  const whole = erg.loaded !== null && !playback;

  /* ---- the chart windows --------------------------------------------- */

  /* THE WINDOW, AND THE WHOLE PIECE (owner, 2026-09-17: open a chart up and
   * scrub through it). A playback rolls exactly like a live erg, so opening
   * a chart on a forty-five minute row and scrubbing it would otherwise
   * scrub the last two minutes of it. The chips in the charts head and in
   * the foot of an opened chart are the same one control: one window for all
   * nine charts, which is what that head already claims. A LOADED row was
   * never windowed, so it has nothing to offer. */
  const tEnd = m.samples.length ? m.samples[m.samples.length - 1].t : 0;
  const wide = whole || wholePiece;
  const win = wide ? m.samples.filter((s) => s.t >= SKIP_S) : m.samples.filter((s) => s.t >= tEnd - WINDOW_S && s.t >= SKIP_S);
  const strokesAll = m.strokes.filter((s) => s.elapsedS === null || s.elapsedS >= SKIP_S);
  const strokesWin = wide ? strokesAll : strokesAll.slice(-WINDOW_STROKES);

  /* THE X OF A SAMPLE AND OF A STROKE, in the mode the console is in. A
   * stroke with no distance on it — rare, a 0x35 that arrived before the
   * first status packet — is left out rather than plotted at zero. */
  const sampleX = (s: { t: number; dist: number }) => (xMode === "meters" ? s.dist : s.t);
  const strokeX = (s: ErgStroke): number | null => (xMode === "meters" ? s.distanceM : s.elapsedS);
  const xLabel = xMode === "meters" ? "METRES" : "ELAPSED";
  const xFmt = xMode === "meters" ? (x: number) => Math.round(x).toLocaleString("en-US") : (x: number) => fmtClock(x);
  const span: SpanControl = {
    whole: wide,
    can: !whole && (tEnd > WINDOW_S || m.strokes.length > WINDOW_STROKES),
    set: setWholePiece,
    note: wide ? (whole ? "THE WHOLE PIECE · LOADED" : "THE WHOLE PIECE") : `LAST ${WINDOW_S} S · LAST ${WINDOW_STROKES} STROKES`,
  };

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
  /* ZERO IS NOT A STROKE RATE, it is the monitor saying nobody is pulling
   * (review, 2026-09-17: the new mean and deviation were being computed over
   * every paused second, so a piece with two breaks in it reported a rate
   * several spm below anything the rower ever rowed). The pace series has
   * always filtered its own sentinel one line above; this one now does too,
   * which also takes the dip out of the drawn line. */
  const spmSeries: Series[] = [{ kind: "line", label: "SPM", points: thinPoints(win.filter((s) => s.spm > 0).map((s) => ({ x: sampleX(s), y: s.spm })), CHART_POINTS) }];
  /* Where the heart rate chart used to be. Metres a stroke is the number
   * that says whether a rate went up because the rower did more work or
   * because the handle came back shorter. */
  const perStrokeSeries: Series[] = [{ kind: "line", label: "M", points: per((s) => s.strokeDistanceM) }];
  const driveLenPts = per((s) => s.driveLengthM);
  const driveTimePts = per((s) => s.driveTimeS);
  const recoveryPts = per((s) => s.recoveryTimeS);
  const peakPts = per((s) => s.peakLbf);
  const avgLbfPts = per((s) => s.avgLbf);
  const workPts = per((s) => s.workJ);

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
   *
   * IT IS READ AGAINST THE GOAL, not against the monitor's workout (owner,
   * 2026-09-17: "infer the goal distance to be a five K always. But allow
   * us to change it"). ErgGoal.tsx owns that call and the monitors row
   * makes exactly the same one, so the two screens cannot disagree. Where
   * the monitor is set to a different fixed distance, the line under the
   * head says so and neither number is overruled. */
  const finish = expectedFinish(erg);

  /* Before there are metres to work with there is no band to print, so the
   * tile falls back to the monitor's own number and says where it came
   * from — with the reason the prediction is not ready yet. */
  const monitorProj = last?.projTimeS !== null && last?.projTimeS !== undefined ? fmtClock(last.projTimeS) : null;
  /* A PIECE THAT HAS ENDED PRINTS WHAT IT DID, not what it is going to do
   * (review, 2026-09-17: the tile kept predicting a finish after WORKOUT END
   * unless the goal distance happened to be the one the monitor was set to,
   * which the monitors row already refused to do). */
  const ended = pieceEnded(erg);
  /* AND IT DOES NOT REPEAT THE CLOCK (review, 2026-09-17: printing the
   * elapsed time here put the identical number in two tiles side by side,
   * because ELAPSED is the very next one). The monitors row already answers
   * this by printing the average split instead; the console now agrees. */
  const finishTile = ended
    ? { value: a1 && a1.averagePaceS > 0 ? fmtPace(a1.averagePaceS) : "—", sub: g ? `OVER ${fmtMeters(g.distanceM)}` : "" }
    : finish.ready
      ? { value: finish.value, sub: finish.under }
      : { value: monitorProj ?? "—", sub: monitorProj ? `${finish.under} · THE MONITOR'S OWN PROJECTION` : finish.under };

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
          {/* THE NAME IS THE FIELD (owner, 2026-09-21: "I should be able to
            * rename the row in the viewer"). What is typed here is the row
            * heading on the monitors page, the lane on the race board and
            * the title the piece is saved under: one gesture. */}
          <label className="eg-away" htmlFor={`dtitle-${erg.id}`}>
            Name this erg
          </label>
          <input
            id={`dtitle-${erg.id}`}
            className="eg-dname eg-dname-box"
            value={erg.save.title ?? ""}
            onChange={(ev) => setErgTitle(erg.id, ev.target.value)}
            placeholder={erg.name}
            aria-label="Name this erg"
          />
          <span className="eg-note">{typedErgName(erg) ? `${erg.name} · ` : ""}{erg.serial || "NO SERIAL"}</span>
          {/* THE ROWER, under the name: the same search box the monitors
            * row carries (RowerPick.tsx). */}
          <RowerPick ergId={erg.id} rower={erg.rower} roster={roster} signedIn={signedIn} />
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

          <span className="eg-btns" style={{ margin: 0 }}>
            <button type="button" className="eg-btn eg-btn-quiet" aria-expanded={settings} onClick={() => setSettings((v) => !v)}>
              {settings ? "Close settings" : "Settings"}
            </button>
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
          {erg.race.note ? <span className={erg.race.note.ok ? "eg-note" : "eg-note eg-bad"}>{erg.race.note.text}</span> : null}
          {erg.loaded ? <span className="eg-loaded">Loaded · {erg.loaded.title}</span> : null}
        </div>
      </div>

      {/* ---- THE SETTINGS DRAWER: everything that is set once ------------
        * (owner, 2026-09-21). How often the monitor reports, and the facts
        * about the monitor itself. The goal and the target are gone (owner,
        * 2026-09-23): the piece is whatever the monitor is set to. */}
      {settings ? (
        <div className="eg-settings">
          <div className="eg-settings-col">
            <span className="eg-eyebrow">Reporting</span>
            <span className="eg-chips">
              <span className="eg-pb-k">Status every</span>
              {RATE_KEYS.map((k) => (
                <button key={k} type="button" className={erg.rate === k ? "eg-chip on" : "eg-chip"} aria-pressed={erg.rate === k} onClick={() => setRate(erg.id, k)}>
                  {RATE_WORD[k]}
                </button>
              ))}
            </span>
          </div>
          <div className="eg-settings-col">
            <span className="eg-eyebrow">The monitor</span>
            <dl className="eg-dfacts">
              <dt>Advertised</dt>
              <dd>{erg.name}</dd>
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
        </div>
      ) : null}

      {/* ---- the transport, when this erg is a row being played back ---- */}
      {playback ? <PlaybackBar erg={erg} /> : null}

      {/* ---- the tiles ----
        *
        * IN THE ORDER HE READS THEM (owner, 2026-09-17: "let us order this in
        * terms of importance — distance, then pace, then expected finish,
        * then time elapsed"). He said it of the monitors row and it is the
        * same question on the same screen, so the console leads with the same
        * four. The other eight follow in the order they always were. */}
      <div className="eg-bigs">
        <Tile
          label="Distance"
          value={g ? Math.floor(g.distanceM).toLocaleString("en-US") : "—"}
          unit="m"
          sub={g && g.totalWorkDistanceM ? `OF ${fmtMeters(g.totalWorkDistanceM)}` : ""}
        />
        <Tile label="Pace /500m" value={a1 ? fmtPace(a1.currentPaceS) : "—"} sub={a2 ? `SPLIT AVG ${fmtPace(a2.splitAvgPaceS)}` : ""} />
        {/* THE LABEL IS SHORT SO THE CLOCK IS NOT (review, 2026-09-17: the
          * goal was in the label, which made a seventeen-character eyebrow
          * over a number in a 168px column). The goal moved down into the
          * quiet line, where it sits in front of the band. */}
        <Tile
          label={ended ? "Average /500m" : "Expected finish"}
          value={finishTile.value}
          sub={ended ? finishTile.sub : [goalWord(goalOf(erg)), finishTile.sub].filter(Boolean).join(" · ")}
          hint={ended ? null : finish.hint}
        />
        <Tile
          label={ended ? "Final" : "Elapsed"}
          value={g ? fmtElapsedHundredths(g.elapsedHundredths) : "—"}
          sub={ended ? "THE PIECE HAS ENDED" : g ? `${workoutTypeWord(g.workoutType)} · ${fmtWorkoutTarget(g.workoutDuration, g.workoutDurationType)}` : ""}
        />
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
          {/* CLICK ANY CHART TO OPEN IT (owner, 2026-09-17). The window is
            * said here and changed here, and the same pair of chips sits in
            * the foot of an opened chart — one window for all nine, which is
            * what this line has always claimed. */}
          {span.can ? (
            <span className="eg-chips">
              <button type="button" className={span.whole ? "eg-chip" : "eg-chip on"} aria-pressed={!span.whole} onClick={() => span.set(false)}>
                Rolling window
              </button>
              <button type="button" className={span.whole ? "eg-chip on" : "eg-chip"} aria-pressed={span.whole} onClick={() => span.set(true)}>
                Whole piece
              </button>
            </span>
          ) : null}
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

        {/* EACH KPI IS A PAIR: what happened in order, and what it was made of
          * (owner, 2026-09-21: the distribution on its own chart, not on the
          * line chart). The distribution is handed the same points the line
          * draws, so the two can never describe different strokes. */}
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

        <div className="eg-sec-head" style={{ marginTop: 26 }}>
          <h3>The stroke</h3>
          <span className="eg-note">0X35 · 0X36 · PER STROKE</span>
        </div>
        <div className="eg-pairs">
          <div className="eg-pair">
            <Chart small title="Drive length" unit="M" series={[{ kind: "line", label: "M", points: driveLenPts }]} xLabel={xLabel} yLabel="M" xFmt={xFmt} yFmt={(y) => y.toFixed(2)} xWord={xLabel} span={span} stat />
            <DistChart small title="Drive length" unit="M" points={driveLenPts} fmt={(y) => y.toFixed(2)} />
          </div>
          <div className="eg-pair">
            <Chart
              small
              title="Drive / recovery"
              unit="S"
              series={[
                { kind: "line", label: "DRIVE", points: driveTimePts },
                { kind: "dashed", label: "RECOVERY", points: recoveryPts },
              ]}
              xLabel={xLabel}
              yLabel="S"
              xFmt={xFmt}
              yFmt={(y) => y.toFixed(2)}
              yMin={0}
              xWord={xLabel}
              span={span}
              stat
            />
            <DistChart small title="Drive time" unit="S" points={driveTimePts} fmt={(y) => y.toFixed(2)} />
          </div>
          <div className="eg-pair">
            <Chart
              small
              title="Drive force"
              unit="LBF"
              series={[
                { kind: "line", label: "PEAK", points: peakPts },
                { kind: "dashed", label: "AVERAGE", points: avgLbfPts },
              ]}
              xLabel={xLabel}
              yLabel="LBF"
              xFmt={xFmt}
              yMin={0}
              xWord={xLabel}
              span={span}
              stat
            />
            <DistChart small title="Peak force" unit="LBF" points={peakPts} />
          </div>
          <div className="eg-pair">
            <Chart small title="Work per stroke" unit="J" series={[{ kind: "line", label: "J", points: workPts }]} xLabel={xLabel} yLabel="J" xFmt={xFmt} yMin={0} xWord={xLabel} span={span} stat />
            <DistChart small title="Work per stroke" unit="J" points={workPts} />
          </div>
        </div>
      </section>

      {/* ---- the force curve ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Force curves</h3>
          <span className="eg-note">
            0X3D · EVERY STROKE · THE LATEST BRIGHT · THE AVERAGE DASHED{last?.peakLbf !== null && last?.peakLbf !== undefined ? ` · 0X35 PEAK ${fmtForce(last.peakLbf)}` : ""}
          </span>
        </div>
        {forceMissing ? (
          <div className="eg-none">
            <b>Force curve not sent by this monitor</b>
            PM5v1 or old firmware — characteristic 0x3D {m.forceChar === false ? "is not there" : "never fired"}.
          </div>
        ) : (
          <div className="eg-charts">
            <ForceCurveChart curves={m.forces} latest={m.force} newtons={lbfToNewtons} />
          </div>
        )}
      </section>

      {/* ---- the splits ---- */}
      <section className="eg-sec">
        <div className="eg-sec-head">
          <h3>Splits</h3>
          <span className="eg-note">EVERY 500 M, CUT FROM THE TICK STREAM · THEN THE MONITOR&apos;S OWN, 0X37 · 0X38</span>
        </div>
        {/* EVERY FIVE HUNDRED (owner, 2026-09-21: "split should be in 500
          * metres, not kilometres"). The same blocks the prediction and the
          * band are built from. */}
        {(() => {
          const { blocks } = blocksFor(erg);
          if (!blocks.length) return <p className="eg-note">No 500 m yet.</p>;
          let cum = 0;
          return (
            <div className="eg-scroll">
              <table className="eg-table">
                <thead>
                  <tr>
                    <th>At</th>
                    <th>500 m in</th>
                    <th>Pace /500m</th>
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
                        <td>{fmtMeters(b.n * b.meters)}</td>
                        <td>{fmtTenthsS(b.seconds)}</td>
                        <td>{fmtPace((b.seconds * 500) / b.meters)}</td>
                        <td>{d === null ? "—" : Math.abs(d) < 0.05 ? "even" : `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} s`}</td>
                        <td>{fmtTenthsS(cum)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
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
          <span className="eg-note">
            {erg.rec.packets.length ? `${erg.rec.packets.length.toLocaleString("en-US")} RECORDED` : "NO PACKETS YET"}
            {erg.rec.dropped ? ` · ${erg.rec.dropped.toLocaleString("en-US")} DROPPED OFF THE FRONT` : ""}
          </span>
          <button type="button" className="eg-btn eg-btn-quiet" onClick={() => setShowFeed((v) => !v)}>
            {showFeed ? "Hide the log" : "Show the log"}
          </button>
        </div>
        {/* THE FEED IS A TABLE THAT UPDATES IN PLACE (owner, 2026-09-21:
          * "we get the same data every packet and those numbers just update,
          * so it can be a table. If we do not get a value, show an empty
          * space. It is more like: is it grabbing data?"). One row per
          * characteristic in the order the spec lists them; a row that has
          * never arrived is an empty row. Nothing scrolls. */}
        <div className="eg-scroll">
          <table className="eg-table eg-feedtab">
            <thead>
              <tr>
                <th>Char</th>
                <th>What</th>
                <th>Last</th>
                <th>Via</th>
                <th>Bytes</th>
                <th>Decoded</th>
              </tr>
            </thead>
            <tbody>
              {FEED_ROWS.map((r) => {
                const f: ErgFeedLine | undefined = m.latest[r.id];
                return (
                  <tr key={r.id} className={f ? "" : "eg-feed-none"}>
                    <td className="eg-mono">0x{r.id.toString(16).toUpperCase()}</td>
                    <td>{r.word}</td>
                    <td className="eg-mono">{f ? f.at : ""}</td>
                    <td>{f ? (f.via === "mux" ? "0x80" : "direct") : ""}</td>
                    <td className="eg-mono">{f ? f.bytes : ""}</td>
                    <td className="eg-feed-dc">
                      {f && f.decoded
                        ? Object.entries(f.decoded).map(([k, v]) => (
                            <span className="eg-kv" key={k}>
                              <span className="k">{k}</span>
                              <span className="v">{cell(v)}</span>
                            </span>
                          ))
                        : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="eg-two">
          {showFeed ? (
            <div className="eg-feed" aria-live="off">
              {m.feed.length === 0
                ? "NO PACKETS YET"
                : m.feed
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((f, i) => (
                      <div key={`${f.at}-${i}`}>
                        <span className="ts">{f.at}</span>
                        <span className="id">
                          0x{f.id.toString(16).toUpperCase().padStart(2, "0")} {f.via === "mux" ? "via 0x80" : "direct"} · {f.bytes} B
                        </span>
                        <span className="hx">{f.hex}</span>
                      </div>
                    ))}
            </div>
          ) : null}
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
