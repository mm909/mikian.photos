import type { Pm5Packet } from "../pm5/encode";
import { PM5_UUID } from "../pm5/pm5";
import { createPm5Sim } from "../pm5/simulate";

/* What the two Bluetooth files (ble.ts on the web, ble.native.ts on a
 * phone) and the simulator all hand back. */
export type Found = { id: string; name: string };
export type ErgLink = { name: string; stop(): void };
export type Handlers = { onPacket(p: Pm5Packet): void; onDrop(reason: string): void };

/* The characteristics the app listens to, on the rowing service. */
export const LISTEN = [
  PM5_UUID.generalStatus,
  PM5_UUID.additionalStatus1,
  PM5_UUID.additionalStatus2,
  PM5_UUID.strokeData,
  PM5_UUID.additionalStrokeData,
  PM5_UUID.splitData,
  PM5_UUID.additionalSplitData,
  PM5_UUID.workoutSummary,
  PM5_UUID.additionalWorkoutSummary1,
  PM5_UUID.forceCurve,
];

/* A DEMO ROW: the site's PM5 simulator, sped up. It sends the same bytes a
 * monitor does, so the screens can be tried (and an app reviewer can see
 * the app work) with no erg in the room. */
export function simulate(h: Handlers, opts: { distanceM?: number; speed?: number } = {}): ErgLink {
  const sim = createPm5Sim({ distanceM: opts.distanceM ?? 2000 });
  const speed = opts.speed ?? 12;
  const STEP_MS = 100;
  const timer = setInterval(() => {
    for (const p of sim.step(STEP_MS * speed)) h.onPacket(p);
    if (sim.done) clearInterval(timer);
  }, STEP_MS);
  return { name: "Demo erg", stop: () => clearInterval(timer) };
}
