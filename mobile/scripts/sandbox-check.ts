import { readFileSync } from "node:fs";
import { createLive } from "../src/erg/model";
import { createPm5Sim } from "../src/pm5/simulate";
import { milestone } from "../src/erg/milestone";

const B = process.env.B!;
const img = readFileSync(process.env.IMG!);
const call = async (path: string, token: string, body?: unknown) => {
  const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (!r.ok || j.ok === false) throw new Error(`${path}: ${r.status} ${JSON.stringify(j)}`);
  return j;
};
(async () => {
  // the owner's example, as a check of the milestone line
  const ms = milestone({ targetM: 5000, meters: 2500, elapsedS: 605, avgPace: 121, ended: false });
  console.log("milestone example:", ms);

  const { token } = await (await fetch(B + "/api/row100k/app/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ devEmail: process.env.EMAIL }) })).json();
  const before = await call("/api/row100k/app/me", token);
  console.log("before:", before.totals);

  // a simulated 2k through the app's own decoder
  const model = createLive();
  const sim = createPm5Sim({ distanceM: 2000 });
  while (!sim.done) for (const p of sim.step(1000)) model.feed(p);
  const live = model.get();
  const doc = model.toDoc("Demo erg", true);
  console.log("piece:", Math.floor(live.meters), "m", Math.round(live.elapsedS), "s, strokes", live.strokes, "docBytes", JSON.stringify(doc).length);

  const keys: string[] = [];
  for (let i = 0; i < 2; i++) {
    const s = await call("/api/row100k/photos/sign", token, { contentType: "image/jpeg", contentLength: img.length });
    const put = await fetch(s.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: img });
    if (!put.ok) throw new Error("put " + put.status + " " + (await put.text()).slice(0, 200));
    const t = await call("/api/row100k/photos/sign", token, { contentType: "image/jpeg", contentLength: img.length, thumbFor: s.key }).catch((e) => ({ err: String(e) }));
    if (t.url) await fetch(t.url, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: img });
    else console.log("thumb sign:", t.err);
    keys.push(s.key);
  }
  const day = new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);
  const row = await call("/api/row100k/rows", token, { day, meters: Math.floor(live.meters), seconds: Math.round(live.elapsedS), title: "App sandbox test", photos: keys });
  console.log("row:", row);
  const erg = await call("/api/row100k/app/erg", token, { doc, entryId: row.id });
  console.log("erg:", erg);
  const after = await call("/api/row100k/app/me", token);
  console.log("after:", after.totals);
  const feed = await call("/api/row100k/app/feed", token);
  const it = feed.items.find((x: { id: string }) => x.id === row.id);
  console.log("feed item:", it && { name: it.name, metersStr: it.metersStr, durationStr: it.durationStr, photos: it.photos.length, erg: it.erg, mine: it.mine });
  const prof = await call("/api/row100k/app/profile", token);
  console.log("profile log top:", prof.profile.logRows[0] && { title: prof.profile.logRows[0].title, m: prof.profile.logRows[0].metersStr, photos: prof.profile.logRows[0].photos.length }, "erg rows:", prof.profile.ergRows.length);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
