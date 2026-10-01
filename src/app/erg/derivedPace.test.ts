/* PACE FROM THE METRES (hub.ts derivedPaceS and the derived ticks): three
 * fake monitors stepped through the hub itself, the way the simulator and
 * playback are — one that never sends 0x32, one whose 0x32 carries no
 * pace, one whose 0x32 is whole. Run: npx tsx src/app/erg/derivedPace.test.ts */
import assert from "node:assert/strict";
import { PM5_UUID, RowingState, StrokeState, WorkoutState } from "@/lib/pm5/pm5";
import { Packet, pkt, type Pm5Packet } from "@/lib/pm5/encode";
import { addSourceErg, derivedPaceS, getErg, liveAvgPaceS, livePaceS, type SourceDriver } from "./hub";

/* A monitor rowing at a steady pace, in seconds per 500 m. */
function monitor(paceS: number, a1: "none" | "zero" | "full"): SourceDriver {
  const mps = 500 / paceS;
  let tMs = 0;
  return {
    label: `fake ${a1}`,
    done: false,
    step(dtMs) {
      tMs += dtMs;
      const elapsedHundredths = Math.round(tMs / 10);
      const distanceTenths = Math.round((tMs / 1000) * mps * 10);
      const out: Pm5Packet[] = [
        pkt(
          PM5_UUID.generalStatus,
          new Packet(19)
            .u24(elapsedHundredths)
            .u24(distanceTenths)
            .u8(2)
            .u8(255)
            .u8(WorkoutState.WORKOUTROW)
            .u8(RowingState.ACTIVE)
            .u8(StrokeState.RECOVERY)
            .u24(5000)
            .u24(5000)
            .u8(0)
            .u8(120),
        ),
      ];
      if (a1 !== "none") {
        const p = a1 === "full" ? Math.round(paceS * 100) : 0;
        out.push(
          pkt(
            PM5_UUID.additionalStatus1,
            new Packet(17).u24(elapsedHundredths).u16(a1 === "full" ? mps * 1000 : 0).u8(26).u8(255).u16(p).u16(p).u16(0).u24(0).u8(0),
          ),
        );
      }
      return out;
    },
  };
}

/* The pure helper on its own: 100 m in 24 s is 2:00. */
{
  const ss = Array.from({ length: 25 }, (_, i) => ({ t: i, dist: i * (500 / 120), pace: 0, avgPace: 0, spm: 0, hr: null, watts: null, drag: 0 }));
  const p = derivedPaceS(ss, 24, 24 * (500 / 120));
  assert.ok(Math.abs(p - 120) < 0.01, `derivedPaceS: ${p}`);
  assert.equal(derivedPaceS([], 5, 20), 0, "nothing to measure from");
}

async function main() {
  const none = addSourceErg({ source: "sim", driver: monitor(120, "none"), device: { name: "no-0x32" }, rate: "ms250" });
  const zero = addSourceErg({ source: "sim", driver: monitor(110, "zero"), device: { name: "zero-pace" }, rate: "ms250" });
  const full = addSourceErg({ source: "sim", driver: monitor(105, "full"), device: { name: "whole" }, rate: "ms250" });

  await new Promise((r) => setTimeout(r, 6500));

  const near = (a: number | null, b: number, tol = 2) => a !== null && Math.abs(a - b) <= tol;

  {
    const e = getErg(none);
    assert.ok(e, "no-0x32 erg");
    const m = e.model;
    assert.equal(m.a1, null, "no 0x32 ever arrived");
    assert.ok(m.samples.length >= 15, `ticks from the clock: ${m.samples.length}`);
    const ts = m.samples.map((s) => s.t);
    assert.ok(ts.every((t, i) => i === 0 || t > ts[i - 1]), "one tick per advance of the clock");
    assert.ok(near(livePaceS(e), 120), `live pace derived: ${livePaceS(e)}`);
    assert.ok(near(liveAvgPaceS(e), 120), `average derived: ${liveAvgPaceS(e)}`);
    assert.ok(m.samples.slice(-5).every((s) => Math.abs(s.pace - 120) < 2), "the last ticks carry the derived pace");
    assert.ok(m.log.some((l) => /pace derived from the metres/.test(l.text)), "the card says so once");
    assert.equal(m.log.filter((l) => /pace derived from the metres/.test(l.text)).length, 1, "and only once");
  }
  {
    const e = getErg(zero);
    assert.ok(e, "zero-pace erg");
    const m = e.model;
    assert.ok(m.a1, "0x32 arrived");
    assert.equal(m.a1?.currentPaceS, 0, "and carried no pace");
    assert.ok(m.samples.length >= 15, `ticks: ${m.samples.length}`);
    const ts = m.samples.map((s) => s.t);
    assert.ok(ts.every((t, i) => i === 0 || t > ts[i - 1]), "no doubled ticks with both packets flowing");
    assert.ok(near(livePaceS(e), 110), `live pace derived from a zero 0x32: ${livePaceS(e)}`);
    assert.ok(near(liveAvgPaceS(e), 110), `average derived: ${liveAvgPaceS(e)}`);
    assert.ok(!m.log.some((l) => /pace derived from the metres/.test(l.text)), "no no-0x32 line when 0x32 flows");
  }
  {
    const e = getErg(full);
    assert.ok(e, "whole erg");
    assert.equal(livePaceS(e), 105, "the monitor's own pace wins");
    assert.equal(liveAvgPaceS(e), 105, "and its own average");
    const s = e.model.samples[e.model.samples.length - 1];
    assert.equal(s.pace, 105, "ticks carry the monitor's pace untouched");
  }

  console.log("derivedPace: every case holds");
  process.exit(0);
}

void main();
