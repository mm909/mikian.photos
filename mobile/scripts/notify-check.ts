/* NOTIFICATIONS, CHECKED AGAINST A SANDBOX (2026-11-21).
 *
 *   B=http://localhost:3001 IMG=some.jpg npx tsx scripts/notify-check.ts
 *
 * Of the three accounts of the LOCAL sandbox database, finds the pair that
 * sit closest on this month's board, has the one ahead follow the one
 * behind, and has the one behind LOG A ROW that carries them past. Then
 * reads the notification centre of the one who was passed: it must hold a
 * PASSED line and no line for the row itself, and a second row the same
 * day must not add a second PASSED line.
 *
 * It logs two real rows with two photos each, so: a sandbox only. It
 * refuses any address that is not localhost. */
import { readFileSync } from "node:fs";

const B = (process.env.B ?? "http://localhost:3001").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) {
  console.error("notify-check: B must be a localhost dev server.");
  process.exit(1);
}
const img = readFileSync(process.env.IMG!);
const EMAILS = (process.env.EMAILS ?? "mikianmusser@gmail.com,sandbox.one@example.com,sandbox.two@example.com").split(",");

type Json = Record<string, any>;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const call = async (path: string, token: string, body?: unknown): Promise<Json> => {
  const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = (await r.json()) as Json;
  if (!r.ok || j.ok === false) throw new Error(`${path}: ${r.status} ${JSON.stringify(j)}`);
  return j;
};

async function logRow(token: string, meters: number): Promise<string> {
  const keys: string[] = [];
  for (let i = 0; i < 2; i++) {
    const s = await call("/api/row100k/photos/sign", token, { contentType: "image/jpeg", contentLength: img.length });
    const put = await fetch(s.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: img });
    if (!put.ok) throw new Error(`put ${put.status}`);
    keys.push(s.key);
  }
  const day = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
  /* A steady 2:10 split, whatever the distance. */
  const row = await call("/api/row100k/rows", token, { day, meters, seconds: Math.round((meters / 500) * 130), title: "Notify check", photos: keys });
  return row.id as string;
}

async function main() {
  const who = await Promise.all(
    EMAILS.map(async (email) => {
      const r = await fetch(`${B}/api/row100k/app/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: email }) });
      const token = ((await r.json()) as Json).token as string;
      const me = await call("/api/row100k/app/me", token);
      return { token, num: me.me.rowerNumber as number, month: me.totals.monthMeters as number, in: me.optedIn as boolean };
    }),
  );
  /* The closest pair: `behind` logs, `ahead` is passed. */
  const sorted = [...who].sort((x, y) => x.month - y.month);
  const pairs = [0, 1].map((i) => ({ behind: sorted[i], ahead: sorted[i + 1], gap: sorted[i + 1].month - sorted[i].month })).sort((x, y) => x.gap - y.gap);
  const { behind, ahead, gap } = pairs[0];
  console.log(`rower ${behind.num} (${behind.month} m) will pass rower ${ahead.num} (${ahead.month} m): ${gap} m between them\n`);
  check("both are on this month's board", behind.in && ahead.in);

  await call("/api/row100k/app/block", ahead.token, { num: behind.num, on: false });
  await call("/api/row100k/app/block", behind.token, { num: ahead.num, on: false });
  await call("/api/row100k/app/settings", ahead.token, { notifyOff: [] });
  await call("/api/row100k/app/follow", ahead.token, { num: behind.num, action: "follow" });
  await call("/api/row100k/app/follow", ahead.token, { num: behind.num, action: "bell", on: true });
  await call("/api/row100k/app/notifications", ahead.token, { read: true });
  const before = (await call("/api/row100k/app/notifications", ahead.token)).items as Json[];
  const passedBefore = before.filter((i) => i.kind === "passed").length;

  const id1 = await logRow(behind.token, gap + 500);
  const n1 = await call("/api/row100k/app/notifications", ahead.token);
  /* A row by itself tells nobody anything (owner, 2026-11-21: "you can't
   * get notified when someone logs a row. That's fine"). */
  check("a row alone makes no line", !(n1.items as Json[]).some((i) => i.kind === "rowed" && i.entryId === id1));
  const passed = (n1.items as Json[]).filter((i) => i.kind === "passed");
  check("the follower is told they were passed", passed.length === passedBefore + 1 && passed[0]?.rowerNumber === behind.num && passed[0]?.unread === true, passed[0] ? `"${passed[0].name} ${passed[0].text}"` : "no line");
  check("no metres in the line", !/\d{3,}/.test(`${passed[0]?.text}`));
  check("the bell counts it once", (await call("/api/row100k/app/me", ahead.token)).social.unread === 1);

  await logRow(behind.token, 1000);
  const n2 = await call("/api/row100k/app/notifications", ahead.token);
  check("a second row the same day adds no second PASSED line", (n2.items as Json[]).filter((i) => i.kind === "passed").length === passedBefore + 1);

  /* The bell off: nothing more arrives. */
  await call("/api/row100k/app/follow", ahead.token, { num: behind.num, action: "bell", on: false });
  const count = (n2.items as Json[]).length;
  await logRow(behind.token, 1000);
  check("with the bell off, a row tells them nothing", ((await call("/api/row100k/app/notifications", ahead.token)).items as Json[]).length === count);
  await call("/api/row100k/app/follow", ahead.token, { num: behind.num, action: "bell", on: true });

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
