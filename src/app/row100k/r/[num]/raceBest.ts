import { inPeriod, pacificDayKey, type Period } from "@/lib/rowPeriod";
import type { RaceDef } from "../../raceday";
import { listRacers } from "../../racedayData";
import { resolvedRace } from "../../racedaySettings";
import { fmtTenths } from "../../raceResults";
import type { ProfileBest } from "./looks/view";

/* THE RACE DAY LINE on a rower's profile (owner, 2026-09-28, the morning
 * after: "give the rowers a small special call out for their race day
 * time"). One more row on THE BESTS: the 5,000 they pulled on race night,
 * the wave and lane they sat in, and their place among the finishers on
 * their own board — the medal chip the other bests wear, top ten only.
 * Nothing until the owner has posted a time; a spectator or a withdrawn
 * entry gets nothing. A race time is never masked: it was on the wall.
 *
 * Fails open: a signup read that hiccups costs the line, never the page. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayWord(r: RaceDef): string {
  const d = new Date(r.firstWaveAt - 7 * 3_600_000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export async function raceDayBest(participantId: string, period: Period): Promise<ProfileBest | null> {
  try {
    const race = await resolvedRace();
    /* Only on the month the race was in, or ALL TIME (rollover review,
     * 2026-09-28): an October page keeps October's bests to itself. */
    if (!inPeriod(pacificDayKey(race.firstWaveAt), period)) return null;
    const all = await listRacers(race);
    const me = all.find((r) => r.participantId === participantId) ?? null;
    if (!me || me.role !== "racer" || me.withdrewAt || me.status !== "finished" || me.tenths === null) return null;
    const field = all
      .filter((r) => r.role === "racer" && !r.withdrewAt && r.status === "finished" && r.tenths !== null && r.division === me.division)
      .sort((a, b) => (a.tenths as number) - (b.tenths as number));
    const place = field.findIndex((r) => r.id === me.id) + 1;
    const where = [
      dayWord(race),
      me.wave !== null ? `wave ${me.wave}` : null,
      me.lane !== null ? `lane ${me.lane}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const label = race.brackets.find((b) => b.key === me.division)?.label ?? "";
    return {
      key: "raceday",
      label: "Race day 5k",
      value: fmtTenths(me.tenths),
      sub: `${where}${field.length > 1 ? ` · ${ordinal(place)} of ${field.length}${label ? ` ${label.toLowerCase()}` : ""}` : ""}`,
      place: place >= 1 && place <= 10 ? place : null,
      href: "/row100k/raceday/results",
      noShare: true,
    };
  } catch (err) {
    console.error("row100k: race day line failed — no line", err);
    return null;
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
