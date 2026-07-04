/** Display formatters for the relay tracker — miles/feet/min-per-mile (the
 *  team is American; the audience is family + sponsors). Pure + isomorphic. */

const MI = 1609.34;
const FT = 0.3048;

export function fmtMiles(m: number, digits = 1): string {
  return `${(m / MI).toFixed(digits)} mi`;
}

export function fmtFeet(m: number): string {
  return `${Math.round(m / FT).toLocaleString()} ft`;
}

/** secPerKm → "9:41 /mi". */
export function fmtPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const secPerMi = secPerKm * (MI / 1000);
  let min = Math.floor(secPerMi / 60);
  let sec = Math.round(secPerMi % 60);
  // Rounding can push seconds to 60 ("9:60") — carry into the minute.
  if (sec === 60) {
    min += 1;
    sec = 0;
  }
  return `${min}:${String(sec).padStart(2, "0")} /mi`;
}

/** Seconds → "31h 12m" / "48m". */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** ISO → "Fri 14:32" in the viewer's locale/timezone. */
export function fmtEta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** ISO → "2h ago" / "just now" for the updated stamp. */
export function fmtAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.floor(ms / 60000);
  if (min < 2) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
