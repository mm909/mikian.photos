/* PROFILE PHOTOS, CHECKED AGAINST A SANDBOX (2026-11-22).
 *
 *   B=http://localhost:3001 IMG=some.jpg npx tsx scripts/avatar-check.ts
 *
 * As a sandbox account: send a picture up the way the app does, name it as
 * the profile photo, and see it come back beside the rower's name in the
 * profile, the feed, search and the row; then that somebody else's key is
 * refused, that the owner can take it down, and that the rower can. It
 * uploads one picture, so: a sandbox only. Refuses anything not localhost. */
import { readFileSync } from "node:fs";

const B = (process.env.B ?? "http://localhost:3001").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) {
  console.error("avatar-check: B must be a localhost dev server.");
  process.exit(1);
}
const img = readFileSync(process.env.IMG!);
type Json = Record<string, any>;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const tok = async (email: string) => ((await (await fetch(`${B}/api/row100k/app/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: email }) })).json()) as Json).token as string;
const req = async (token: string | null, path: string, body?: unknown): Promise<Json> => {
  const r = await fetch(`${B}${path}`, { method: body === undefined ? "GET" : "POST", headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, ...((await r.json().catch(() => ({}))) as Json) };
};

(async () => {
  const [admin, one, two] = await Promise.all(["mikianmusser@gmail.com", "sandbox.one@example.com", "sandbox.two@example.com"].map(tok));
  const me = (await req(one, "/api/row100k/app/me")).me;
  const num = me.rowerNumber as number;

  const signed = await req(one, "/api/row100k/photos/sign", { contentType: "image/jpeg", contentLength: img.length });
  const put = await fetch(signed.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: img });
  check("the picture goes up", put.ok, String(put.status));

  check("somebody else's key is refused", (await req(two, "/api/row100k/app/settings", { avatarKey: signed.key })).status === 400);
  const set = await req(one, "/api/row100k/app/settings", { avatarKey: signed.key });
  check("the rower names it as their photo", typeof set.settings?.avatar === "string" && set.settings.avatar.startsWith("http"), String(set.settings?.avatar).slice(0, 60));

  check("it shows on their profile, to anybody", typeof (await req(null, `/api/row100k/app/profile?num=${num}`)).profile?.avatar === "string");
  check("and on me", typeof (await req(one, "/api/row100k/app/me")).avatar === "string");
  const found = ((await req(null, `/api/row100k/app/people?q=${num}`)).people ?? []).find((p: Json) => p.rowerNumber === num);
  check("and in search", typeof found?.avatar === "string");
  const feed = ((await req(two, "/api/row100k/app/feed")).items ?? []) as Json[];
  const mine = feed.find((i) => i.rowerNumber === num);
  check("and beside their rows in the feed", !mine || typeof mine.avatar === "string", mine ? "" : "no row of theirs on the first page");
  check("a rower without one has none", feed.some((i) => i.rowerNumber !== num && i.avatar === null));

  const prof = await req(admin, `/api/row100k/app/profile?num=${num}`);
  check("a rower cannot take another's photo down", (await req(two, "/api/row100k/app/moderate", { avatarOf: prof.profile.adminId })).status === 403);
  check("the owner can", (await req(admin, "/api/row100k/app/moderate", { avatarOf: prof.profile.adminId })).ok === true);
  check("and it is gone", (await req(null, `/api/row100k/app/profile?num=${num}`)).profile?.avatar === null);

  await req(one, "/api/row100k/app/settings", { avatarKey: signed.key });
  const off = await req(one, "/api/row100k/app/settings", { avatarKey: null });
  check("the rower can take their own off", off.settings?.avatar === null);
  await req(one, "/api/row100k/app/settings", { avatarKey: signed.key });

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
