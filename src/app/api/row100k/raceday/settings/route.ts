import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { isRow100kAdmin } from "@/lib/row100k";
import { currentRace, raceBySlug, withOverrides, type RaceOverrides } from "@/app/row100k/raceday";
import { GALLERY_PREFIX } from "@/app/row100k/galleryList";
import {
  mergeOverrides,
  raceOverridesStrict,
  raceRuleBreak,
  raceWithSettings,
  saveRaceOverrides,
  type RaceSettingsPatch,
} from "@/app/row100k/racedaySettings";

export const runtime = "nodejs";

/* THE RACE SETTINGS (owner, 2026-09-11: "let us make the start time and end
 * time and first wave time all changeable in the settings menu"). Admin
 * only, from /row100k/race-admin.
 *
 * POST { race, patch } — where patch may carry any of opensAt / endsAt /
 * firstWaveAt (an ISO string, or null to go back to the code default),
 * waveMinutes / waveSize (a whole number, or null), photoKey (a gallery key,
 * or null for the newest shot) and photoBw (a boolean). A key the patch does
 * not carry is not touched, so two fields moved from two tabs do not undo
 * each other.
 *
 * THE PATCH IS TRIED BEFORE IT IS WRITTEN: the merge is folded onto the code
 * default in memory and the RESULT is what gets checked, not the two or
 * three numbers that came in. That is the only way the rules hold when the
 * owner moves one field at a time — dragging the doors shut to 6:30 has to
 * be refused while a first wave sits at 7:15, and the request that does it
 * mentions neither wave nor 7:15.
 *
 * The answer is always the race as it now STANDS (defaults and all), so the
 * console redraws from the truth in the database rather than from what it
 * hoped it had just written.
 *
 * Writes touch RowRaceSettings and nothing else. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!isRow100kAdmin(actor.email, actor.roles)) return { res: bad("Not allowed.", 403) };
  /* Roomy — settling on a start time takes a few passes — but not so roomy
   * that a stuck button can rewrite the evening all afternoon. */
  const limit = await rateLimit({
    key: `row100k-raceday-settings:${actor.photographerId}`,
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

/* ----------------------------------------------------------- the patch */

const TIME_LABEL: Record<string, string> = {
  opensAt: "The time the doors open",
  endsAt: "The time the doors shut",
  firstWaveAt: "The first wave",
};

/* A gallery key as our own sign route mints them. Anything else is either a
 * typo or somebody pointing the ads at an object that is not ours. */
const KEY_RE = /^[A-Za-z0-9/._-]{1,300}$/;

function readPatch(raw: Record<string, unknown>): { patch: RaceSettingsPatch } | { error: string } {
  const patch: RaceSettingsPatch = {};

  for (const k of ["opensAt", "endsAt", "firstWaveAt"] as const) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (v === null) {
      patch[k] = null;
      continue;
    }
    if (typeof v !== "string") return { error: `${TIME_LABEL[k]} has to be a time, or null for the default.` };
    const ms = Date.parse(v);
    if (!Number.isFinite(ms)) return { error: `${TIME_LABEL[k]} is not a time I can read.` };
    patch[k] = ms;
  }

  if ("waveMinutes" in raw) {
    const v = raw.waveMinutes;
    if (v === null) patch.waveMinutes = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 240) return { error: "Minutes between waves is a whole number from 1 to 240." };
      patch.waveMinutes = n;
    }
  }

  if ("waveSize" in raw) {
    const v = raw.waveSize;
    if (v === null) patch.waveSize = null;
    else {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 60) return { error: "Ergs in a wave is a whole number from 1 to 60." };
      patch.waveSize = n;
    }
  }

  if ("photoKey" in raw) {
    const v = raw.photoKey;
    if (v === null) patch.photoKey = null;
    else if (typeof v !== "string") return { error: "That is not a photo." };
    else {
      const key = v.trim();
      /* An empty pick is how the console says BACK TO THE NEWEST SHOT. */
      if (!key) patch.photoKey = null;
      else if (!KEY_RE.test(key) || !key.startsWith(GALLERY_PREFIX)) {
        return { error: "Pick a photo from the gallery." };
      } else patch.photoKey = key;
    }
  }

  if ("photoBw" in raw) {
    if (typeof raw.photoBw !== "boolean") return { error: "Black and white is yes or no." };
    patch.photoBw = raw.photoBw;
  }

  return { patch };
}

/* -------------------------------------------------------------- the verb */

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  let body: { race?: unknown; patch?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const base = typeof body.race === "string" ? raceBySlug(body.race) : currentRace();
  if (!base) return bad("No such race.", 404);
  if (!body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) return bad("Send a patch.");

  const read = readPatch(body.patch as Record<string, unknown>);
  if ("error" in read) return bad(read.error);
  const { patch } = read;

  /* Try it on: the code default, plus what is already stored, plus this.
   *
   * THE STORED HALF IS READ STRICT. Everywhere else a settings read fails
   * open, because a page is better off printing the code default than not
   * printing; here it would mean checking the patch against a race nobody
   * is running. A read that hiccups while the write then lands is how the
   * doors get shut at 8:00 PM in front of a stored 8:45 PM first wave —
   * refused on any honest read, waved through on a blind one. So: no save
   * without the truth to check it against. */
  let stored: RaceOverrides;
  try {
    stored = await raceOverridesStrict(base.slug);
  } catch (err) {
    console.error("row100k raceday: settings read failed before a save — nothing written", err);
    return bad("Couldn't save that — try again.", 503);
  }
  const merged = mergeOverrides(stored, patch);
  const refuse = raceRuleBreak(withOverrides(base, merged));
  if (refuse) return bad(refuse);

  try {
    await saveRaceOverrides(base.slug, patch, g.actor.email);
  } catch (err) {
    console.error("row100k raceday: settings save failed", err);
    return bad("Couldn't save that — try again.", 503);
  }

  /* Read it back rather than answering with what we sent: the console
   * redraws from the database, so a column that did not take is visible. */
  const { view } = await raceWithSettings(base.slug);
  return NextResponse.json({ ok: true, race: view });
}
