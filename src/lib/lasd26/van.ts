import "server-only";
import { db } from "@/lib/db";
import { TEAM } from "./team";

/**
 * THE VAN'S PIN (owner, 2026-10-21: "a 'van location' button … only
 * clickable/visible by team members. The van location button should put a
 * pin/van indicator on the map so the runners will be able to view where
 * the van is on their turn by turn. We don't need to make this live. It can
 * just take the location of the user who is clicking the button as the
 * van's location."). ONE pin for the team (owner: "One van pin").
 *
 * Every tap is a new TeamVanPin row; the newest row without clearedAt is
 * the pin. The rows are kept as the check-in log the ETAs read
 * (src/app/lasd26/route/eta.ts infers the pace from the latest one).
 * CLEAR stamps clearedAt on the live row. Lat/lon are stored as sent; the
 * course mile is worked out wherever the pin is read, from course.json.
 */

export type VanPinRow = {
  id: string;
  lat: number;
  lon: number;
  accuracyM: number;
  at: Date;
  byName: string;
};

const PIN_SELECT = { id: true, lat: true, lon: true, accuracyM: true, at: true, byName: true } as const;

/** The live pin, or null. Never throws: no table yet = no pin. */
export async function getVanPin(team: string = TEAM): Promise<VanPinRow | null> {
  try {
    return await db.teamVanPin.findFirst({ where: { team, clearedAt: null }, orderBy: { at: "desc" }, select: PIN_SELECT });
  } catch (err) {
    console.error("lasd26/van: pin lookup failed (table pushed?)", err);
    return null;
  }
}

/** A new pin from a member's phone. The previous pin is left as history (clearedAt set so only one is live). */
export async function setVanPin(args: { lat: number; lon: number; accuracyM: number; byId: string | null; byName: string; team?: string }): Promise<VanPinRow> {
  const team = args.team ?? TEAM;
  const now = new Date();
  await db.teamVanPin.updateMany({ where: { team, clearedAt: null }, data: { clearedAt: now } });
  return db.teamVanPin.create({
    data: { team, lat: args.lat, lon: args.lon, accuracyM: Math.round(args.accuracyM), at: now, byId: args.byId, byName: args.byName.slice(0, 80) },
    select: PIN_SELECT,
  });
}

/** Take the pin down. True when there was one. */
export async function clearVanPin(team: string = TEAM): Promise<boolean> {
  const r = await db.teamVanPin.updateMany({ where: { team, clearedAt: null }, data: { clearedAt: new Date() } });
  return r.count > 0;
}

/** The wire shape the page and the API hand around. */
export function wirePin(row: VanPinRow | null): { lat: number; lon: number; accuracyM: number; at: string; byName: string } | null {
  return row ? { lat: row.lat, lon: row.lon, accuracyM: row.accuracyM, at: row.at.toISOString(), byName: row.byName } : null;
}
