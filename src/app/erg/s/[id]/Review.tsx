import Link from "next/link";
import { fmtMeters } from "@/lib/pm5/pm5";
import { fmtTenthsClock, type TelemetryDoc, type TelemetrySavedRow } from "@/lib/pm5/session";
import { fmtGap, fmtSplit, fmtWhen, type ErgAnalysis } from "@/lib/pm5/analysis";
import { DeleteSession } from "../DeleteSession";
import { ForceCurves, RateLength, SplitBars, WorkPerStroke } from "../ReviewCharts";
import { ReviewPlayback } from "../ReviewPlayback";

/* THE POST HOC ANALYSIS SCREEN (owner, 2026-09-17: "I really want to
 * emphasise the post hoc analysis screen — let us build it, and keep
 * Rowtember out of it").
 *
 * A finished piece read back in the order a rower actually reads one: the
 * time first and big, then THE READ in plain English, then the numbers
 * behind the sentences, then the pictures, then how steady it was, then
 * the splits the monitor recorded, then what to do about it. Nothing on
 * this screen knows there is a challenge in September.
 *
 * NO HEART RATE (owner, same day: no belt this month). The document still
 * carries it; no row of this page reads it.
 *
 * Server rendered end to end — a saved piece never changes — except the
 * DELETE, which has to ask twice. */

const dash = (v: string | null) => v ?? "—";
const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : null);
const n1 = (v: number | null | undefined, digits = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : null);

function Cell({ k, v, u }: { k: string; v: string; u?: string }) {
  return (
    <div className="rv-cell">
      <span className="rv-k">{k}</span>
      <span className="rv-v">{v}</span>
      {u ? <span className="rv-u">{u}</span> : null}
    </div>
  );
}

export function Review({ row, a, doc, play }: { row: TelemetrySavedRow; a: ErgAnalysis; doc: TelemetryDoc; play: { open: boolean; atS: number } }) {
  const dr = a.driveRecovery;

  return (
    <>
      {/* a. THE HEAD — the time is the headline, in the one colour this
       * product has; everything beside it is what makes that time mean
       * something. */}
      <div className="rv-top">
        <div>
          <span className="rv-eyebrow">Saved session</span>
          <h1 className="rv-title">{row.title}</h1>
        </div>
        <div className="eg-btns" style={{ margin: 0 }}>
          <Link className="eg-btn eg-btn-quiet" href="/erg/sessions">
            All sessions
          </Link>
        </div>
      </div>

      <div className="rv-headline">
        <div>
          <span className="rv-k">Time</span>
          <span className="rv-time">{a.clock}</span>
        </div>
        <div>
          <span className="rv-k">Distance</span>
          <span className="rv-big">{fmtMeters(a.meters)}</span>
        </div>
        <div>
          <span className="rv-k">Average split</span>
          <span className="rv-big">{fmtSplit(a.avgPaceTenths)}</span>
        </div>
      </div>

      <p className="rv-meta">
        <span>{a.strokes.toLocaleString("en-US")} strokes</span>
        <span>·</span>
        <span>{dash(n0(a.avgWatts))} W average</span>
        <span>·</span>
        <span>Drag {dash(n0(a.dragFactor))}</span>
        <span>·</span>
        <span>{fmtWhen(a.startedAt)}</span>
        <span>·</span>
        <span>{a.device}</span>
        <span>·</span>
        <span>{a.recordedVia}</span>
        {a.simulated ? <span className="rv-flag">Simulated</span> : null}
        {a.packetsDropped > 0 ? <span className="rv-flag">{a.packetsDropped.toLocaleString("en-US")} packets dropped</span> : null}
        {/* The console ran long enough to drop the front of the piece, or
         * the save was thinned to fit. Either way the totals describe the
         * whole row and the detail below does not, which is a thing to say
         * out loud rather than let somebody read a half-row as a row. */}
        {a.headTrimmedFromS !== null ? (
          <span className="rv-flag">Strokes and ticks start at {fmtTenthsClock(Math.round(a.headTrimmedFromS * 10))} — the head of the piece was dropped</span>
        ) : null}
        {a.thinned ? <span className="rv-flag">{a.thinned}</span> : null}
      </p>

      {/* PLAY IT BACK, up here under the head (owner, 2026-09-24: "I should
       * have a button to play it back ... put the playback menu in this
       * screen"). One word, closed; open, the live charts fed from this
       * document with the transport over them. The analysis below is what
       * it always was. */}
      <ReviewPlayback doc={doc} rowId={row.id} title={row.title} startOpen={play.open} startAtS={play.atS} />

      {/* b. THE READ — the whole point of the screen. Every sentence is
       * computed in analysis.ts and says only what the numbers carry. */}
      <div className="rv-read">
        <h2>The read</h2>
        {a.read.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {/* c. THE NUMBERS the sentences are made of. */}
      <section className="rv-sec">
        <h2>The numbers</h2>
        <div className="rv-strip">
          <Cell k="Average split" v={fmtSplit(a.avgPaceTenths)} u="per 500 m" />
          <Cell k="Rate" v={dash(n1(a.avgSpm, 0))} u="strokes a minute" />
          <Cell k="Metres a stroke" v={dash(n1(a.metresPerStroke, 2))} u="distance per stroke" />
          <Cell k="Watts" v={dash(n0(a.avgWatts))} u="average power" />
          <Cell k="Work a stroke" v={dash(n0(a.workPerStrokeJ))} u="joules" />
          <Cell k="Drive to recovery" v={dr ? `1 : ${dr.ratio.toFixed(1)}` : "—"} u={dr ? `${dr.driveS.toFixed(2)} s drive` : "no stroke data"} />
        </div>
      </section>

      {/* d. THE PICTURES. */}
      <section className="rv-sec">
        <h2>
          The shape of it{" "}
          {a.splitsDerived ? <em>· splits cut from the tick stream{a.splitsFromMeters > 0 ? `, from ${Math.round(a.splitsFromMeters).toLocaleString("en-US")} m where the recording starts` : ""}</em> : null}
        </h2>
        <div className="rv-panels">
          <SplitBars splits={a.splits} avgTenths={a.avgSplitTenths} derived={a.splitsDerived} />
          <RateLength series={a.series} />
          <ForceCurves force={a.force} compare={a.compare} />
          <WorkPerStroke series={a.series} trend={a.workTrend} />
        </div>
      </section>

      {/* e. HOW STEADY — the four figures that say whether the piece was
       * held together or wrestled. */}
      <section className="rv-sec">
        <h2>How steady</h2>
        <div className="rv-strip rv-strip-4">
          <Cell
            k="Split spread"
            v={a.steady.paceSdTenths === null ? "—" : `± ${fmtGap(a.steady.paceSdTenths)}`}
            u={a.steady.paceMeanTenths === null ? "too few strokes" : `around ${fmtSplit(Math.round(a.steady.paceMeanTenths))}`}
          />
          <Cell
            k="Work spread"
            v={a.steady.workSdJ === null ? "—" : `± ${a.steady.workSdJ.toFixed(1)}`}
            u={a.steady.workMeanJ === null ? "joules a stroke" : `joules around ${a.steady.workMeanJ.toFixed(0)}`}
          />
          <Cell
            k="Strokes to settle"
            v={a.steady.settle === null ? "—" : String(a.steady.settle.count)}
            u={a.steady.settle === null ? "never inside the band" : `settled at stroke ${a.steady.settle.strokeN}`}
          />
          <Cell k="Drive length" v={a.steady.avgDriveLengthCm === null ? "—" : `${(a.steady.avgDriveLengthCm / 100).toFixed(2)} m`} u="average drive" />
        </div>
      </section>

      {/* f. THE SPLITS, as the monitor recorded them — or cut out of the
       * tick stream, said so, when the monitor sent none. */}
      <section className="rv-sec">
        <h2>
          Splits{" "}
          {a.splitsDerived ? (
            <em>
              · derived, not the monitor’s own figures
              {a.splitsFromMeters > 0 ? ` · the first bar begins at ${Math.round(a.splitsFromMeters).toLocaleString("en-US")} m, where this recording starts` : ""}
            </em>
          ) : (
            <em>· as the monitor recorded them</em>
          )}
        </h2>
        {a.splits.length ? (
          <div className="rv-tablewrap">
            <table className="rv-table">
              <thead>
                <tr>
                  <th className="lead">Split</th>
                  <th>Metres</th>
                  <th>Time</th>
                  <th>Per 500 m</th>
                  <th>Rate</th>
                  <th>Watts</th>
                  <th>Drag</th>
                </tr>
              </thead>
              <tbody>
                {a.splits.map((s) => (
                  <tr key={`${s.n}-${s.endMeters}`}>
                    <td className="lead">
                      {s.n} · to {s.endMeters.toLocaleString("en-US")} m
                    </td>
                    <td>{s.meters.toLocaleString("en-US")}</td>
                    <td>{fmtTenthsClock(Math.round(s.seconds * 10))}</td>
                    <td className="pace">{fmtSplit(s.paceTenths)}</td>
                    <td>{dash(n0(s.spm))}</td>
                    <td>{dash(n0(s.watts))}</td>
                    <td>{dash(n0(s.drag))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="eg-empty">This piece has no splits — the monitor sent none and there were too few ticks to cut any.</div>
        )}
      </section>

      {/* g. WHAT NEXT — the same generator, pointed forward. */}
      <div className="rv-next">
        <h2>What next</h2>
        {a.next.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {/* h. THE CONTROLS. The playback lives on this screen now (owner,
       * 2026-09-24); this button hands the id to the monitors screen
       * instead, for a row that wants to sit beside live ergs on the ink
       * ground. EXPORT is the document itself, straight off the route. */}
      <div className="rv-acts">
        <Link className="eg-btn eg-btn-quiet" href={`/erg?play=${encodeURIComponent(row.id)}`}>
          Play it back on the monitors
        </Link>
        <a className="eg-btn eg-btn-quiet" href={`/api/erg/sessions/${encodeURIComponent(row.id)}`} download={`${row.id}.json`}>
          Export the document
        </a>
        <span className="rv-spacer" />
        <DeleteSession id={row.id} redirectTo="/erg/sessions" label="Delete this session" />
      </div>

      {/* WHAT EXPLAINS, AT THE FOOT (owner, 2026-09-17: "whenever we have
       * text that explains something, let us put it on the bottom of the
       * page rather than the top"). The top of this screen is the time. */}
      <div className="eg-tail">
        <p>
          <b>This is a piece that has already been rowed.</b> THE READ and WHAT NEXT are written from the numbers
          on this page alone — no baseline from other sessions, nothing borrowed from a challenge. Where the
          monitor sent no splits they are cut from the tick stream and labelled as derived.
        </p>
        <p>
          PLAY IT BACK, under the head, feeds this document to the live charts on this page and lets you scrub
          through it. PLAY IT BACK ON THE MONITORS hands it to the monitors screen instead, where it plays as a
          row beside any erg in the room. EXPORT THE DOCUMENT is the saved file itself, exactly as it went into
          the database.
        </p>
      </div>

      {/* What the arithmetic above was allowed to see. A monitor sitting
       * between pieces keeps sending stroke packets at impossible rates;
       * those are kept in the document and left out of the averages, and
       * this line is where that is said out loud. */}
      <p className="eg-foot">
        {a.packetsRecorded.toLocaleString("en-US")} packets recorded · {a.force ? `${a.force.curves.toLocaleString("en-US")} force curves` : "no force curves"} ·{" "}
        {a.strokesCounted.toLocaleString("en-US")} of {a.series.length.toLocaleString("en-US")} strokes counted
        {a.strokesSetAside > 0 ? ` · ${a.strokesSetAside.toLocaleString("en-US")} set aside as the monitor between pieces` : ""}
      </p>
    </>
  );
}
