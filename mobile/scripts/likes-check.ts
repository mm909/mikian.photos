/* LIKES AND COMMENTS, CHECKED AGAINST A SANDBOX (2026-11-22).
 *
 *   B=http://localhost:3001 npx tsx scripts/likes-check.ts
 *
 * Three accounts of the LOCAL sandbox database: a like and its count, the
 * line it sends, a comment, a reply, a reply to a reply, who may remove,
 * what a block hides, the switch that turns the lines off. It writes likes
 * and comments on the first account's newest row and clears them after. It
 * refuses any address that is not localhost. */

const B = (process.env.B ?? "http://localhost:3001").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) {
  console.error("likes-check: B must be a localhost dev server.");
  process.exit(1);
}
const EMAILS = (process.env.EMAILS ?? "mikianmusser@gmail.com,sandbox.one@example.com,sandbox.two@example.com").split(",");

type Json = Record<string, any>;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
async function signIn(email: string): Promise<string> {
  const r = await fetch(`${B}/api/row100k/app/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: email }) });
  const j = (await r.json()) as Json;
  if (!j.token) throw new Error(`no token for ${email}: ${JSON.stringify(j)}`);
  return j.token;
}
const as = (token: string | null) => async (path: string, body?: unknown): Promise<Json> => {
  const r = await fetch(`${B}/api/row100k/app/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, ...((await r.json().catch(() => ({}))) as Json) };
};

async function main() {
  const [ta, tb, tc] = await Promise.all(EMAILS.map(signIn));
  const A = as(ta);
  const Bb = as(tb);
  const Cc = as(tc);
  const anon = as(null);
  const [ma, mb, mc] = await Promise.all([A("me"), Bb("me"), Cc("me")]);
  const a = ma.me.rowerNumber as number;
  const b = mb.me.rowerNumber as number;
  const c = mc.me.rowerNumber as number;

  /* A's newest row. */
  const prof = await A(`profile?num=${a}`);
  const feed = await A("feed");
  const mine = (feed.items ?? []).find((i: Json) => i.rowerNumber === a) ?? null;
  const id: string | undefined = mine?.id ?? prof.profile?.log?.[0]?.id;
  if (!id) throw new Error("the first account has no row to like; log one in the sandbox first");
  console.log(`A = rower ${a}, B = rower ${b}, C = rower ${c}; row ${id}\n`);

  /* A clean start. */
  const clear = async () => {
    for (const who of [A, Bb, Cc]) {
      await who("like", { entryId: id, on: false });
      await who("notifications", { read: true });
    }
    const all = await A(`comments?entry=${id}`);
    for (const cm of all.comments ?? []) await A("comments", { remove: cm.id });
  };
  for (const [who, nums] of [[A, [b, c]], [Bb, [a, c]], [Cc, [a, b]]] as const) for (const n of nums) await who("block", { num: n, on: false });
  await A("settings", { isPrivate: false, notifyOff: [] });
  await clear();

  /* LIKE */
  const l0 = await anon("like", { entryId: id, on: true });
  check("a signed-out visitor cannot like", l0.status === 401 || l0.status === 403, String(l0.status));
  const l1 = await Bb("like", { entryId: id, on: true });
  check("a like counts", l1.likes === 1 && l1.liked === true, JSON.stringify(l1));
  const l2 = await Bb("like", { entryId: id, on: true });
  check("a second like by the same rower does not", l2.likes === 1);
  const l3 = await Cc("like", { entryId: id, on: true });
  check("another rower's does", l3.likes === 2);
  const fb = (await Bb("feed")).items?.find((i: Json) => i.id === id);
  if (fb) check("the feed carries the count and the viewer's own like", fb.likes === 2 && fb.liked === true, JSON.stringify({ likes: fb.likes, liked: fb.liked }));
  const ra = await A(`row?id=${id}`);
  check("the row's page carries the count, not liked by its rower", ra.row?.likes === 2 && ra.row?.liked === false);
  const na = await A("notifications");
  const likedLines = (na.items ?? []).filter((i: Json) => i.kind === "liked" && i.entryId === id);
  check("the rower is told once for each liker", likedLines.length === 2, String(likedLines.length));
  const l4 = await Bb("like", { entryId: id, on: false });
  check("a like can be taken back", l4.likes === 1 && l4.liked === false);
  const self = await A("like", { entryId: id, on: true });
  const na2 = await A("notifications");
  check("a rower's own like counts and sends them nothing", self.likes === 2 && (na2.items ?? []).filter((i: Json) => i.kind === "liked").length === 2);

  /* COMMENT */
  const c0 = await anon("comments", { entryId: id, text: "hello" });
  check("a signed-out visitor cannot comment", c0.status === 401 || c0.status === 403, String(c0.status));
  const c1 = await Bb("comments", { entryId: id, text: "  Strong row.  " });
  check("a comment is taken", !!c1.id, JSON.stringify(c1));
  const c2 = await Bb("comments", { entryId: id, text: "   " });
  check("an empty one is not", c2.status === 400);
  const r1 = await A("comments", { entryId: id, text: "Thanks.", parentId: c1.id });
  const r2 = await Cc("comments", { entryId: id, text: "Agreed.", parentId: r1.id });
  const read = await anon(`comments?entry=${id}`);
  const top = (read.comments ?? [])[0];
  check("anyone can read them, trimmed, oldest first", read.count === 3 && top?.text === "Strong row." && top?.rowerNumber === b, JSON.stringify(read.count));
  check("a reply sits under its comment, and a reply to a reply beside it", top?.replies?.length === 2 && top.replies[1].id === r2.id);
  const nb = await Bb("notifications");
  check("a comment's writer is told of a reply", (nb.items ?? []).some((i: Json) => i.kind === "replied" && i.entryId === id && i.rowerNumber === a));
  const na3 = await A("notifications");
  check("the row's rower is told of a comment", (na3.items ?? []).some((i: Json) => i.kind === "commented" && i.rowerNumber === b));
  check("and of a reply written to them, as a reply", (na3.items ?? []).some((i: Json) => i.kind === "replied" && i.rowerNumber === c));
  const viewB = (await Bb(`comments?entry=${id}`)).comments?.[0];
  check("a writer may remove their own, not another's", viewB?.canRemove === true && viewB?.replies?.[1]?.canRemove === false);
  const viewA = (await A(`comments?entry=${id}`)).comments?.[0];
  check("the row's rower may remove any", viewA?.canRemove === true && viewA?.replies?.[1]?.canRemove === true);
  const bad = await Bb("comments", { remove: r2.id });
  check("removing another's comment is refused", bad.status === 403, String(bad.status));
  check("the counts are on the row", (await A(`row?id=${id}`)).row?.comments === 3);

  /* A LIKE OF A COMMENT */
  await Bb("notifications", { read: true });
  const k1 = await A("like", { commentId: c1.id, on: true });
  const k2 = await Cc("like", { commentId: c1.id, on: true });
  check("a comment can be liked, and counts", k1.likes === 1 && k2.likes === 2, JSON.stringify([k1.likes, k2.likes]));
  const seen = (await A(`comments?entry=${id}`)).comments?.[0];
  const seenB = (await Bb(`comments?entry=${id}`)).comments?.[0];
  check("the comment carries its likes, and whose", seen?.likes === 2 && seen?.liked === true && seenB?.liked === false);
  check("its writer is told", ((await Bb("notifications")).items ?? []).some((i: Json) => i.kind === "likedComment" && i.entryId === id));
  const k3 = await A("like", { commentId: c1.id, on: false });
  check("and the like can be taken back", k3.likes === 1 && k3.liked === false);

  /* A ROWER TAGGED IN A COMMENT */
  await Cc("notifications", { read: true });
  const beforeC = ((await Cc("notifications")).items ?? []).filter((i: Json) => i.kind === "mentioned").length;
  const t1 = await Bb("comments", { entryId: id, text: `Race you, @[${c}] and @[${a}]` });
  const tagRead = await anon(`comments?entry=${id}`);
  check("a tag travels as a number and comes back with the name", !!t1.id && tagRead.tags?.[String(c)] === mc.me.displayName && tagRead.tags?.[String(a)] === ma.me.displayName, JSON.stringify(tagRead.tags));
  const afterC = ((await Cc("notifications")).items ?? []).filter((i: Json) => i.kind === "mentioned").length;
  check("the rower tagged is told", afterC === beforeC + 1, `${beforeC} -> ${afterC}`);
  check("the row's rower, tagged on their own row, is told once, of the comment", !((await A("notifications")).items ?? []).some((i: Json) => i.kind === "mentioned"));
  await Bb("comments", { remove: t1.id });

  /* BLOCK */
  await A("block", { num: c, on: true });
  const blockedView = await A(`comments?entry=${id}`);
  check("a blocked rower's comment is not shown to who blocked them", blockedView.count === 2);
  const cant = await Cc("comments", { entryId: id, text: "still here" });
  check("and they cannot write on that rower's row", cant.status === 404, String(cant.status));
  const cantLike = await Cc("like", { entryId: id, on: true });
  check("nor like it", cantLike.status === 404, String(cantLike.status));
  await A("block", { num: c, on: false });

  /* THE SWITCH */
  await A("settings", { notifyOff: ["liked", "commented"] });
  await A("notifications", { read: true });
  const before = ((await A("notifications")).items ?? []).length;
  await Bb("like", { entryId: id, on: true });
  await Bb("comments", { entryId: id, text: "One more." });
  const after = ((await A("notifications")).items ?? []).length;
  check("switched off, neither a like nor a comment sends a line", after === before, `${before} -> ${after}`);
  await A("settings", { notifyOff: [] });

  /* REMOVE */
  const gone = await A("comments", { remove: c1.id });
  const left = await A(`comments?entry=${id}`);
  check("a removed comment takes its replies with it", gone.ok !== false && !(left.comments ?? []).some((x: Json) => x.id === c1.id) && left.count === 1, String(left.count));

  await clear();
  console.log(failed ? `\n${failed} FAILED` : "\nAll passed.");
  process.exit(failed ? 1 : 0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
