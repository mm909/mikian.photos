/* "SOMEBODY LOGGED A ROW", THE ACCOUNT PAGE AND ONE ROWER'S FEED, CHECKED
 * AGAINST A SANDBOX (2026-11-21).
 *
 *   B=http://localhost:3001 IMG=some.jpg npx tsx scripts/rowed-check.ts
 *
 * Three accounts of the LOCAL sandbox database. The first logs three small
 * rows (two photos each) and removes them at the end; the other two turn
 * the ways of being told on and off. It refuses any address that is not
 * localhost. */
import { readFileSync } from "node:fs";

const B = (process.env.B ?? "http://localhost:3001").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) {
  console.error("rowed-check: B must be a localhost dev server.");
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
const as = (token: string) => async (path: string, body?: unknown, method?: string): Promise<Json> => {
  const r = await fetch(B + path, { method: method ?? (body ? "POST" : "GET"), headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...((await r.json().catch(() => ({}))) as Json) };
};
async function signIn(email: string): Promise<string> {
  const r = await fetch(`${B}/api/row100k/app/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: email }) });
  return ((await r.json()) as Json).token as string;
}

async function main() {
  const [ta, tb, tc] = await Promise.all(EMAILS.map(signIn));
  const A = as(ta);
  const Bb = as(tb);
  const Cc = as(tc);
  const a = (await A("/api/row100k/app/me")).me.rowerNumber as number;
  const made: string[] = [];
  const log = async (): Promise<string> => {
    const keys: string[] = [];
    for (let i = 0; i < 2; i++) {
      const s = await A("/api/row100k/photos/sign", { contentType: "image/jpeg", contentLength: img.length });
      const put = await fetch(s.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: img });
      if (!put.ok) throw new Error(`put ${put.status}`);
      keys.push(s.key);
    }
    const day = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
    const row = await A("/api/row100k/rows", { day, meters: 500, seconds: 130, title: "Rowed check", photos: keys });
    if (!row.id) throw new Error(`no row: ${JSON.stringify(row)}`);
    made.push(row.id);
    return row.id;
  };
  const rowedOf = async (who: ReturnType<typeof as>, id: string) => ((await who("/api/row100k/app/notifications")).items ?? []).filter((i: Json) => i.kind === "rowed" && i.entryId === id).length;

  /* A clean start: B follows A with the bell off, C does not follow A. */
  await A("/api/row100k/app/settings", { isPrivate: false });
  await Bb("/api/row100k/app/follow", { num: a, action: "follow" });
  await Bb("/api/row100k/app/follow", { num: a, action: "bell", on: false });
  await Cc("/api/row100k/app/follow", { num: a, action: "unfollow" });
  const s0 = await Bb("/api/row100k/app/settings", { notifyOn: [] });
  await Cc("/api/row100k/app/settings", { notifyOn: [] });
  check("the two kinds are offered, and off", JSON.stringify(s0.settings?.optIn) === JSON.stringify(["rowed", "rowedAll"]) && s0.settings?.notifyOn?.length === 0, JSON.stringify(s0.settings?.optIn));

  const r1 = await log();
  check("with nothing turned on, nobody is told of a row", (await rowedOf(Bb, r1)) === 0 && (await rowedOf(Cc, r1)) === 0);

  await Bb("/api/row100k/app/follow", { num: a, action: "bell", on: true });
  await Cc("/api/row100k/app/settings", { notifyOn: ["rowed"] });
  const r2 = await log();
  check("the bell on one rower tells of that rower's row", (await rowedOf(Bb, r2)) === 1);
  check("'rowers I follow' tells nothing of a rower not followed", (await rowedOf(Cc, r2)) === 0);

  await Bb("/api/row100k/app/follow", { num: a, action: "bell", on: false });
  await Bb("/api/row100k/app/settings", { notifyOn: ["rowed"] });
  await Cc("/api/row100k/app/settings", { notifyOn: ["rowedAll", "nonsense"] });
  const r3 = await log();
  check("'rowers I follow' tells a follower, once", (await rowedOf(Bb, r3)) === 1);
  check("'anybody' tells somebody who follows nobody", (await rowedOf(Cc, r3)) === 1);
  check("the rower is not told of their own row", (await rowedOf(A, r3)) === 0);
  check("only the known kinds are kept", JSON.stringify((await Cc("/api/row100k/app/settings")).settings?.notifyOn) === JSON.stringify(["rowedAll"]));

  /* ONE ROWER'S FEED */
  const mine = await Bb(`/api/row100k/app/feed?rower=${a}`);
  check("a rower's feed is that rower's rows and nobody else's", (mine.items ?? []).length > 0 && (mine.items ?? []).every((i: Json) => i.rowerNumber === a) && mine.items[0].id === r3, String(mine.items?.length));
  check("a rower who does not exist has an empty one", ((await Bb("/api/row100k/app/feed?rower=999998")).items ?? []).length === 0);

  /* THE ACCOUNT PAGE */
  const keep = (await A("/api/row100k/app/settings")).settings;
  const s1 = await A("/api/row100k/app/settings", { bio: "  Rows   before work.\n\n\nMost days. ", heightCm: 178, weightKg: 77.11, birthday: "1990-01-02" });
  check("a bio, a height, a weight and a birthday are kept", s1.settings?.bio === "Rows before work.\nMost days." && s1.settings?.heightCm === 178 && s1.settings?.weightKg === 77.1 && s1.settings?.birthday === "1990-01-02", JSON.stringify(s1.settings));
  check("the bio is on the profile, for anybody", (await Bb(`/api/row100k/app/profile?num=${a}`)).profile?.bio === "Rows before work.\nMost days.");
  check("a height that cannot be is refused", (await A("/api/row100k/app/settings", { heightCm: 12 })).status === 400);
  check("a date that is not one is refused", (await A("/api/row100k/app/settings", { birthday: "1990-02-31" })).status === 400);
  const s2 = await A("/api/row100k/app/settings", { bio: "x".repeat(400) });
  check("a bio stops at 150", s2.settings?.bio?.length === 150);
  await A("/api/row100k/app/settings", { bio: keep.bio ?? "", heightCm: keep.heightCm ?? null, weightKg: keep.weightKg ?? null, birthday: keep.birthday ?? null });

  /* THE STORIES */
  const st = await Cc("/api/row100k/app/stories");
  check("the two stories answer", st.rowers?.days?.length === 28 && st.rowers?.weeks?.length === 3 && st.when?.hours?.length === 24 && st.when?.weekdays?.length === 7 && st.rowers.months.length > 0);

  /* Put it back. */
  for (const id of made) await A(`/api/row100k/rows/${id}`, undefined, "DELETE");
  await Bb("/api/row100k/app/settings", { notifyOn: [] });
  await Cc("/api/row100k/app/settings", { notifyOn: [] });
  for (const who of [A, Bb, Cc]) await who("/api/row100k/app/notifications", { read: true });
  console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
  process.exit(failed ? 1 : 0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
