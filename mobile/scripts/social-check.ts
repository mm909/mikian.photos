/* THE SOCIAL RULES, CHECKED AGAINST A SANDBOX (2026-11-21).
 *
 *   B=http://localhost:3001 npx tsx scripts/social-check.ts
 *
 * Walks pass 3 end to end as three accounts of the LOCAL sandbox database
 * (scripts/dev-app-db.mjs seeds them): follow, private, request, accept,
 * the feed filter, block, report, the notification centre. Prints PASS or
 * FAIL a line and exits 1 on any failure. It writes follows, blocks and
 * reports, and logs no rows; run it against a sandbox only. It refuses any
 * address that is not localhost. */

const B = (process.env.B ?? "http://localhost:3001").replace(/\/+$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(B)) {
  console.error("social-check: B must be a localhost dev server.");
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
  console.log(`A = rower ${a}, B = rower ${b}, C = rower ${c}\n`);

  /* A clean start, so the script can be run twice. */
  await Bb("settings", { isPrivate: false, notifyOff: [] });
  for (const [who, nums] of [[A, [b, c]], [Bb, [a, c]], [Cc, [a, b]]] as const) {
    for (const n of nums) {
      await who("block", { num: n, on: false });
      await who("follow", { num: n, action: "unfollow" });
    }
    await who("notifications", { read: true });
  }

  /* SEARCH */
  const s1 = await A(`people?q=${b}`);
  check("search by number leads with that rower", s1.people?.[0]?.rowerNumber === b);
  const s2 = await A(`people?q=${encodeURIComponent(String(mb.me.displayName).slice(0, 4))}`);
  check("search by the start of a name finds them", (s2.people ?? []).some((p: Json) => p.rowerNumber === b));
  const s3 = await anon("people?q=");
  check("search lists rowers for a signed-out visitor", (s3.people ?? []).length === 10);

  /* FOLLOW a public rower */
  const f1 = await A("follow", { num: b, action: "follow" });
  check("following a public rower is immediate", f1.rel?.following === "accepted" && f1.counts?.followers === 1, JSON.stringify(f1.rel));
  const nb = await Bb("notifications");
  check("the followed rower is told", (nb.items ?? []).some((i: Json) => i.kind === "follow" && i.rowerNumber === a));
  check("their bell shows one unread", (await Bb("me")).social?.unread === 1);
  const fl = await anon(`people?num=${b}&list=followers`);
  check("anyone can see who follows a rower", (fl.people ?? []).some((p: Json) => p.rowerNumber === a));
  const bell = await A("follow", { num: b, action: "bell", on: false });
  check("the bell switches off per person", bell.rel?.bell === false);

  /* The FOLLOWING feed */
  const feedAll = await A("feed");
  check("the everyone feed holds others too", (feedAll.items ?? []).some((i: Json) => i.rowerNumber !== a && i.rowerNumber !== b));

  /* PRIVATE */
  await Bb("settings", { isPrivate: true });
  const pa = await A(`profile?num=${b}`);
  check("an accepted follower still sees a private rower's rows", pa.profile?.rel?.locked === false && (pa.profile?.logRows ?? []).length > 0);
  const pc = await Cc(`profile?num=${b}`);
  check("a stranger sees a private page locked", pc.profile?.rel?.locked === true && (pc.profile?.logRows ?? []).length === 0 && (pc.profile?.bests ?? []).length === 0);
  check("the locked page keeps the totals", (pc.profile?.lifetime?.meters ?? 0) > 0 && (pc.profile?.sessions ?? 0) > 0);
  const pAnon = await anon(`profile?num=${b}`);
  check("a signed-out visitor sees it locked too", pAnon.profile?.rel?.locked === true && (pAnon.profile?.logRows ?? []).length === 0);
  const rowId = pa.profile?.logRows?.[0]?.id as string;
  check("a private row is not there for a stranger", (await Cc(`row?id=${rowId}`)).status === 404);
  check("the same row opens for a follower", (await A(`row?id=${rowId}`)).status === 200);
  const feedC = await Cc("feed");
  check("a private rower's rows leave a stranger's feed", !(feedC.items ?? []).some((i: Json) => i.rowerNumber === b));
  const board = await Cc("board");
  check("a private rower stays on the board", (board.rows ?? []).some((r: Json) => r.rowerNumber === b));

  /* REQUEST, ACCEPT */
  const rq = await Cc("follow", { num: b, action: "follow" });
  check("following a private rower is a request", rq.rel?.following === "pending" && rq.rel?.access === "private");
  const reqs = await Bb("people?list=requests");
  check("the request waits in their list", (reqs.people ?? []).some((p: Json) => p.rowerNumber === c));
  check("their bell counts the request", (await Bb("me")).social?.requests === 1);
  const ac = await Bb("follow", { num: c, action: "accept" });
  check("accepting it makes them a follower", ac.rel?.followsYou === "accepted");
  check("the accepted rower now sees the rows", ((await Cc(`profile?num=${b}`)).profile?.logRows ?? []).length > 0);
  check("and is told so", ((await Cc("notifications")).items ?? []).some((i: Json) => i.kind === "accepted" && i.rowerNumber === b));

  /* BLOCK */
  const bl = await Bb("block", { num: c, on: true });
  check("a block answers blocked", bl.rel?.access === "blocked" && bl.rel?.blockedByMe === true);
  const pcb = await Cc(`profile?num=${b}`);
  check("the blocked rower gets no page", !!pcb.blocked && pcb.blocked.byMe === false && !pcb.profile);
  const pbc = await Bb(`profile?num=${c}`);
  check("the blocker sees a stub with the way back", !!pbc.blocked && pbc.blocked.byMe === true);
  check("the block ended the following", ((await anon(`people?num=${b}&list=followers`)).people ?? []).every((p: Json) => p.rowerNumber !== c));
  check("the blocker's feed drops the blocked rower", !((await Bb("feed")).items ?? []).some((i: Json) => i.rowerNumber === c));
  check("the blocked rower cannot find the blocker", !((await Cc(`people?q=${b}`)).people ?? []).some((p: Json) => p.rowerNumber === b));
  check("the blocked list names them", ((await Bb("people?list=blocked")).people ?? []).some((p: Json) => p.rowerNumber === c));
  await Bb("block", { num: c, on: false });
  check("unblocking opens the page again, locked", (await Cc(`profile?num=${b}`)).profile?.rel?.locked === true);

  /* MUTE: out of my feed, and nothing else */
  const mu = await A("follow", { num: c, action: "mute", on: true });
  check("muting answers muted", mu.rel?.muted === true);
  check("a muted rower's rows leave my feed", !((await A("feed")).items ?? []).some((i: Json) => i.rowerNumber === c));
  check("the muted list names them", ((await A("people?list=muted")).people ?? []).some((p: Json) => p.rowerNumber === c));
  await A("follow", { num: c, action: "mute", on: false });
  check("unmuting clears it", ((await A("people?list=muted")).people ?? []).length === 0);

  /* THE BELL is off until turned on; the feed leads with who I follow */
  await Bb("settings", { isPrivate: false });
  await A("follow", { num: b, action: "unfollow" });
  const again = await A("follow", { num: b, action: "follow" });
  check("a new follow has the bell off", again.rel?.following === "accepted" && again.rel?.bell === false);
  const led = await A("feed");
  const leadN = Number(led.lead ?? 0);
  check("the feed leads with me and who I follow", leadN > 0 && (led.items ?? []).slice(0, leadN).every((i: Json) => i.rowerNumber === a || i.rowerNumber === b), `${leadN} lead rows`);
  check("and carries on into everyone else", (led.items ?? []).length > leadN || !!led.older);
  const top = await anon("people?q=");
  const ms = (top.people ?? []).map((p: Json) => p.meters as number);
  check("search opens on the ten with the most lifetime meters", ms.length === 10 && ms.every((m: number, i: number) => i === 0 || ms[i - 1] >= m));

  /* REPORT */
  const rp = await A("report", { num: b, entryId: rowId, reason: "photo", note: "social-check" });
  check("a report of a row goes through", rp.ok === true);
  check("a report needs a reason", (await A("report", { num: b })).status === 400);
  check("nobody reports themselves", (await A("report", { num: a, reason: "spam" })).status === 400);

  /* SETTINGS, and read */
  const st = await A("settings", { notifyOff: ["passed", "nonsense"] });
  check("only real kinds can be switched off", JSON.stringify(st.settings?.notifyOff) === JSON.stringify(["passed"]));
  await A("settings", { notifyOff: [] });
  await Bb("notifications", { read: true });
  check("reading the centre clears the bell", (await Bb("me")).social?.unread === 0);
  await Bb("settings", { isPrivate: false });

  /* SIGNED OUT */
  check("following needs an account", (await anon("follow", { num: b, action: "follow" })).status === 401);
  check("the centre needs an account", (await anon("notifications")).status === 401);

  console.log(failed ? `\n${failed} FAILED` : "\nall passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
