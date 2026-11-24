import { db } from "@/lib/db";

/* WHEN A ROW WAS ROWED (owner, 2026-11-23: "if it's a PM5 over Bluetooth, we
 * should set the time as the time rowed, not the time submitted ... we know
 * what time this was done at").
 *
 * A row's own clock, `createdAt`, is when it was SUBMITTED: the photos were
 * taken and the form was sent, which is minutes after the last stroke and
 * can be the next morning (a row kept on the phone and logged later). A row
 * that came off a monitor has the monitor's recording tied to it
 * (RowTelemetry.entryId, written by api/row100k/app/erg), and the recording
 * says when the piece started and how long it ran. So the time such a row
 * was rowed is read off its recording: the start plus the length, the
 * moment it finished. A row logged by hand has no recording and keeps the
 * time it was submitted, which is all anybody knows about it.
 *
 * NOTHING IS STORED for this and nothing was changed in the database: the
 * recording has carried these two figures since the first one was saved, so
 * every monitor row already logged shows its rowed time too. Only what is
 * PRINTED changes (the feed's "Today at 9:17 AM", the row's own page). The
 * order of the feed, and which day a row lands under on the site's feed,
 * still go by when it was submitted.
 *
 * A recording is not believed when it is a demo (the simulator runs many
 * times faster than a clock, so its finish is in the future), when it says
 * the row finished after it was submitted, or when it says the row is two
 * months older than its submission (a phone with the wrong date). */

const AFTER_MS = 5 * 60_000;
const BEFORE_MS = 62 * 86_400_000;

export function rowedAtOf(t: { startedAt: Date; tenths: number; simulated: boolean }, landed: Date): Date | null {
  if (t.simulated || !(t.tenths > 0)) return null;
  const end = t.startedAt.getTime() + t.tenths * 100;
  if (!Number.isFinite(end) || end > landed.getTime() + AFTER_MS || end < landed.getTime() - BEFORE_MS) return null;
  return new Date(end);
}

/* The rowed time of each of these rows that has one, by the row's id. Never
 * throws: a feed that cannot read the recordings prints the submitted times,
 * as it always did. */
export async function rowedAtFor(rows: { id: string; createdAt: Date }[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (rows.length === 0) return out;
  try {
    const landed = new Map(rows.map((r) => [r.id, r.createdAt]));
    const found = await db.rowTelemetry.findMany({
      /* A page of the feed asks by id; a read of every row there is (the
       * hours rowers row at) takes every recording tied to a row. */
      where: rows.length > 400 ? { entryId: { not: null }, simulated: false } : { entryId: { in: rows.map((r) => r.id) } },
      select: { entryId: true, startedAt: true, tenths: true, simulated: true },
    });
    for (const t of found) {
      const at = t.entryId ? landed.get(t.entryId) : undefined;
      if (!t.entryId || !at) continue;
      const rowed = rowedAtOf(t, at);
      if (rowed) out.set(t.entryId, rowed);
    }
  } catch (err) {
    console.error("row100k: failed to read when rows were rowed", err);
  }
  return out;
}
