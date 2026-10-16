/**
 * Small formatters the team pages and their routes share. No server-only
 * imports here so a client file could use them too.
 */

/**
 * The site's origin from request headers — the invite link the owner copies
 * must carry the host the owner is looking at (www.rowtember.com,
 * mikianmusser.com, a preview, a laptop), not a hard-coded one.
 */
export function originFrom(get: (name: string) => string | null): string {
  const host = get("x-forwarded-host") ?? get("host") ?? "mikianmusser.com";
  const proto = get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** MM.DD HH:MM in Pacific time — the crossing's clock (same as the-list). */
export function stampPacific(d: Date): string {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

/** MM.DD in Pacific time. */
export function datePacific(d: Date): string {
  return stampPacific(d).slice(0, 5);
}
