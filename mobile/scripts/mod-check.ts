/* The owner's tools, against the LOCAL sandbox only. */
const B = "http://localhost:3001";
type Json = Record<string, any>;
const tok = async (email: string) => ((await (await fetch(`${B}/api/row100k/app/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: email }) })).json()) as Json).token as string;
const req = async (token: string, path: string, method = "GET", body?: unknown): Promise<Json> => {
  const r = await fetch(`${B}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...((await r.json().catch(() => ({}))) as Json) };
};
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
(async () => {
  const [admin, plain] = await Promise.all(["mikianmusser@gmail.com", "sandbox.one@example.com"].map(tok));
  const feed = await req(plain, "/api/row100k/app/feed");
  const it = (feed.items as Json[]).find((i) => !i.mine && i.photos.length === 2 && i.rowerNumber > 80);
  if (!it) throw new Error("no row with two photos to try");
  const row0 = await req(admin, `/api/row100k/app/row?id=${it.id}`);
  check("an admin's row answer carries the tools", row0.row?.admin === true);
  check("a rower's does not", (await req(plain, `/api/row100k/app/row?id=${it.id}`)).row?.admin === false);
  check("a rower cannot remove a photo", (await req(plain, "/api/row100k/app/moderate", "POST", { entryId: it.id, photo: 0 })).status === 403);
  const m = await req(admin, "/api/row100k/app/moderate", "POST", { entryId: it.id, photo: 0 });
  check("an admin removes one photo and the row stays", m.ok === true && m.photos === 1, JSON.stringify(m));
  const row1 = await req(admin, `/api/row100k/app/row?id=${it.id}`);
  check("the row now has one photo and its metres", row1.row?.photos?.length === 1 && row1.row?.meters === row0.row?.meters);
  check("a rower cannot remove somebody's row", (await req(plain, `/api/row100k/rows/${it.id}`, "DELETE")).status === 403);
  check("an admin removes the row", (await req(admin, `/api/row100k/rows/${it.id}`, "DELETE")).ok === true);
  check("the row is gone", (await req(admin, `/api/row100k/app/row?id=${it.id}`)).status === 404);

  /* Delete a rower: a sample one, high number, with a follow to clear. */
  const num = it.rowerNumber as number;
  await req(plain, "/api/row100k/app/follow", "POST", { num, action: "follow" });
  const prof = await req(admin, `/api/row100k/app/profile?num=${num}`);
  check("an admin's profile answer carries the rower's id", typeof prof.profile?.adminId === "string");
  check("a rower's does not", (await req(plain, `/api/row100k/app/profile?num=${num}`)).profile?.adminId === null);
  check("a rower cannot delete a rower", (await req(plain, `/api/row100k/participants/${prof.profile.adminId}`, "DELETE")).status === 403);
  check("an admin deletes the rower", (await req(admin, `/api/row100k/participants/${prof.profile.adminId}`, "DELETE")).ok === true);
  check("their page is gone", (await req(admin, `/api/row100k/app/profile?num=${num}`)).status === 404);
  const mine = (await req(plain, "/api/row100k/app/me")).me.rowerNumber;
  const following = await req(plain, `/api/row100k/app/people?list=following&num=${mine}`);
  check("and the follow to them went with them", !(following.people as Json[]).some((p) => p.rowerNumber === num));
  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
