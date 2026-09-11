"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtPacificStamp, msToPacificLocal, pacificLocalToIso } from "@/lib/blackoutRules";
import { fmtRaceClock } from "../raceday";
import type { RaceSettingsView } from "../racedaySettings";

/* THE EVENING (owner, 2026-09-11: "let us make the start time and end time
 * and first wave time all changeable in the settings menu", and earlier the
 * same day: "give me the options when assigning racers — number of rowers,
 * number of waves, number of participants — and then let me assign waves
 * based off of those inputs").
 *
 * Three blocks, in the order the evening happens: THE TIMES, THE GRID, THE
 * PICTURE. It sits at the TOP of the console on purpose — every number
 * under it (a wave time in the picker, the grid, the wave note) is drawn
 * against these, so the page reads top to bottom: set the evening, then lay
 * the field into it.
 *
 * TIMES ARE TYPED AND SHOWN AS PACIFIC — the fixed UTC-7 the whole challenge
 * runs on — through the same two helpers the blackout console uses, so the
 * admin browser zone never gets a say. The code default is printed beside
 * every field with a way back to it.
 *
 * TYPING THE DEFAULT IS CLEARING THE OVERRIDE: a field whose value matches
 * the code default saves as null rather than as a copy of today number, so
 * a later deploy that moves the race moves this with it. The one dull edge
 * is that USE THE DEFAULT on a stored override that already equals the
 * default writes nothing — the row stays, meaning exactly what it meant.
 *
 * THE DRY RUN IS THE LIST: everything that would move is on screen, in full,
 * before the first press, and the button then asks a second time. Nothing
 * here is destructive, but it moves the public page, the ads and the wave
 * note all at once, which is close enough.
 *
 * THE CONSOLE IS NOT MONOCHROME. Race day is (white on black, greys of
 * white), but this is the owner admin furniture and it keeps the site
 * palette, the way the wave console already marks NOT TOLD in water blue. */

export type GalleryPick = { key: string; thumb: string };

/* A 5,000 m at 2:30/500 m is 25 minutes, which is the back of a general
 * field rather than the front. It is an allowance, not a prediction — the
 * read-out says ABOUT and means it. */
const FINISH_ALLOW_MIN = 25;

const stamp = (ms: number) => fmtPacificStamp(new Date(ms).toISOString()).toUpperCase();

/* A datetime-local the admin typed, as an instant. Null when half-typed. */
const msOf = (local: string): number | null => {
  const iso = pacificLocalToIso(local);
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

const intOf = (raw: string, lo: number, hi: number): number | null => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

/* The tail of a gallery key — the whole thing is a uuid under a prefix and
 * no use to anybody on screen. */
const shortKey = (key: string) => key.split("/").pop()?.slice(0, 18) ?? key;

/* What the code says, under every field — and, when the stored settings have
 * moved off it, the one click back. Every input on the panel wears the same
 * line, so nothing on screen can be an override without saying so. */
function Default({ shown, moved, onUse }: { shown: string; moved: boolean; onUse: () => void }) {
  return (
    <div className="ra-def">
      DEFAULT {shown}
      {moved ? (
        <>
          {" · "}
          <b>MOVED</b>{" "}
          <button type="button" className="quiet-btn" onClick={onUse}>
            use the default
          </button>
        </>
      ) : null}
    </div>
  );
}

export function RaceSettings({
  view,
  gallery,
  field,
}: {
  view: RaceSettingsView;
  gallery: GalleryPick[];
  /* Racers signed up right now — the read-out starts from the real field. */
  field: number;
}) {
  const router = useRouter();
  /* What the database holds, as far as this panel knows: seeded by the
   * server render, replaced by whatever a save answers with. */
  const [saved, setSaved] = useState<RaceSettingsView>(view);
  const [opens, setOpens] = useState(msToPacificLocal(view.opensAt));
  const [ends, setEnds] = useState(msToPacificLocal(view.endsAt));
  const [first, setFirst] = useState(msToPacificLocal(view.firstWaveAt));
  const [size, setSize] = useState(String(view.waveSize));
  const [mins, setMins] = useState(String(view.waveMinutes));
  /* PLAN FOR — the only input here that saves nothing. It starts at the
   * field as it stands and lets the owner ask what twenty-four would look
   * like before twenty-four turn up. */
  const [plan, setPlan] = useState(String(Math.max(1, field)));
  const [photoKey, setPhotoKey] = useState<string | null>(view.photoKey);
  const [bw, setBw] = useState(view.photoBw);
  const [picking, setPicking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const seed = (v: RaceSettingsView) => {
    setOpens(msToPacificLocal(v.opensAt));
    setEnds(msToPacificLocal(v.endsAt));
    setFirst(msToPacificLocal(v.firstWaveAt));
    setSize(String(v.waveSize));
    setMins(String(v.waveMinutes));
    setPhotoKey(v.photoKey);
    setBw(v.photoBw);
  };

  /* ----------------------------------------------------------- the plan */

  const opensMs = msOf(opens);
  const endsMs = msOf(ends);
  const firstMs = msOf(first);
  const sizeN = intOf(size, 1, 60);
  const minsN = intOf(mins, 1, 240);
  /* An empty box plans for one rather than for none — a grid of zero waves
   * says nothing useful, and the owner is mid-keystroke. */
  const planN = Math.max(1, intOf(plan, 0, 999) ?? 0);

  const waves = sizeN === null ? null : Math.max(1, Math.ceil(planN / sizeN));
  const lastWaveMs = firstMs !== null && minsN !== null && waves !== null ? firstMs + (waves - 1) * minsN * 60_000 : null;
  const lastDoneMs = lastWaveMs === null ? null : lastWaveMs + FINISH_ALLOW_MIN * 60_000;

  const warnings: string[] = [];
  /* THE DAY, BEFORE THE CLOCK. These are datetime-local boxes, so the date
   * sits one arrow key from the hour, and race day itself is not something
   * the console can move: SUN SEP 27 is printed from race.day on the flyer,
   * the ads and every stamp. A time that has wandered onto the 28th is
   * refused on save, so it is said here first, in the dry run. The typed
   * value is already Pacific wall clock, so its first ten characters ARE
   * the Pacific day — no conversion to get wrong. */
  if (opensMs !== null && opens.slice(0, 10) !== saved.day) warnings.push("THE DOORS OPEN ON ANOTHER DAY, NOT RACE DAY.");
  if (firstMs !== null && first.slice(0, 10) !== saved.day) warnings.push("THE FIRST WAVE IS ON ANOTHER DAY, NOT RACE DAY.");
  if (opensMs !== null && endsMs !== null && endsMs <= opensMs) warnings.push("THE DOORS SHUT BEFORE THEY OPEN.");
  if (firstMs !== null && opensMs !== null && endsMs !== null && (firstMs < opensMs || firstMs > endsMs)) {
    warnings.push("THE FIRST WAVE IS NOT BETWEEN THE DOORS.");
  }
  if (lastWaveMs !== null && endsMs !== null && lastWaveMs > endsMs) {
    warnings.push(`THE LAST WAVE GOES OFF AT ${fmtRaceClock(lastWaveMs)}, AFTER THE DOORS SHUT.`);
  } else if (lastDoneMs !== null && endsMs !== null && lastDoneMs > endsMs) {
    warnings.push(`THE LAST FINISHER IS STILL PULLING AT ${fmtRaceClock(endsMs)} WHEN THE DOORS SHUT.`);
  }

  /* -------------------------------------------------------- the changes */

  /* Built fresh on every render: what would be sent, and the plain list of
   * it for the owner to read before he presses anything. A value equal to
   * the code default goes as null — the override is cleared, not copied. */
  const patch: Record<string, unknown> = {};
  const lines: string[] = [];

  const timeChange = (key: string, label: string, now: number | null, was: number, def: number) => {
    if (now === null || now === was) return;
    patch[key] = now === def ? null : new Date(now).toISOString();
    lines.push(`${label} ${stamp(was)} → ${stamp(now)}${now === def ? " (BACK TO THE DEFAULT)" : ""}`);
  };
  timeChange("opensAt", "DOORS OPEN", opensMs, saved.opensAt, saved.defaults.opensAt);
  timeChange("endsAt", "DOORS SHUT", endsMs, saved.endsAt, saved.defaults.endsAt);
  timeChange("firstWaveAt", "FIRST WAVE", firstMs, saved.firstWaveAt, saved.defaults.firstWaveAt);

  if (sizeN !== null && sizeN !== saved.waveSize) {
    patch.waveSize = sizeN === saved.defaults.waveSize ? null : sizeN;
    lines.push(`ERGS IN A WAVE ${saved.waveSize} → ${sizeN}`);
  }
  if (minsN !== null && minsN !== saved.waveMinutes) {
    patch.waveMinutes = minsN === saved.defaults.waveMinutes ? null : minsN;
    lines.push(`MINUTES BETWEEN WAVES ${saved.waveMinutes} → ${minsN}`);
  }
  if (photoKey !== saved.photoKey) {
    patch.photoKey = photoKey;
    lines.push(`THE PICTURE → ${photoKey ? shortKey(photoKey) : "THE NEWEST SHOT"}`);
  }
  if (bw !== saved.photoBw) {
    patch.photoBw = bw;
    lines.push(`THE PICTURE → ${bw ? "BLACK AND WHITE" : "IN COLOUR"}`);
  }
  const dirty = lines.length > 0;

  /* ----------------------------------------------------------- the save */

  const save = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/row100k/raceday/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ race: saved.slug, patch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        race?: RaceSettingsView;
      };
      if (res.ok && data.ok && data.race) {
        setSaved(data.race);
        seed(data.race);
        /* EVENING, not morning: the race is 6–9 PM (owner, 2026-09-11:
         * "6-9pm on the 27th") and the panel says so everywhere else. */
        setOk(`THE EVENING MOVED — DOORS ${data.race.hours} · FIRST WAVE ${fmtRaceClock(data.race.firstWaveAt)}`);
        /* Every wave time further down the console is server-rendered off
         * the same race, so the page is asked to draw itself again. */
        router.refresh();
      } else {
        setError(data.error ?? "Couldn't save that — try again.");
      }
    } catch {
      setError("Couldn't save that — try again.");
    }
    setBusy(false);
    setConfirm(false);
  };

  const current = photoKey ? gallery.find((g) => g.key === photoKey) : gallery[0];

  return (
    <div className="panel ra-set">
      <div className="p-head">
        <h3>The evening</h3>
        <span className="mono">PACIFIC TIME</span>
      </div>

      {/* -------------------------------------------------------- times */}
      <div className="ra-block">
        <div className="ra-eye">The times</div>
        <div className="ra-3">
          <div>
            <label className="fl" htmlFor="rs-opens">
              Doors open
            </label>
            <input
              id="rs-opens"
              type="datetime-local"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
            />
            <Default
              shown={stamp(saved.defaults.opensAt)}
              moved={saved.opensAt !== saved.defaults.opensAt}
              onUse={() => setOpens(msToPacificLocal(saved.defaults.opensAt))}
            />
          </div>

          <div>
            <label className="fl" htmlFor="rs-ends">
              Doors shut
            </label>
            <input id="rs-ends" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
            <Default
              shown={stamp(saved.defaults.endsAt)}
              moved={saved.endsAt !== saved.defaults.endsAt}
              onUse={() => setEnds(msToPacificLocal(saved.defaults.endsAt))}
            />
          </div>

          <div>
            <label className="fl" htmlFor="rs-first">
              First wave
            </label>
            <input id="rs-first" type="datetime-local" value={first} onChange={(e) => setFirst(e.target.value)} />
            <Default
              shown={stamp(saved.defaults.firstWaveAt)}
              moved={saved.firstWaveAt !== saved.defaults.firstWaveAt}
              onUse={() => setFirst(msToPacificLocal(saved.defaults.firstWaveAt))}
            />
          </div>
        </div>
        <div className="ra-def">THE DOORS AS THEY STAND: {saved.hours}. THE ROWERS ARE ONLY EVER TOLD THEIR OWN WAVE.</div>
      </div>

      {/* --------------------------------------------------------- grid */}
      <div className="ra-block">
        <div className="ra-eye">The grid</div>
        <div className="ra-3">
          <div>
            <label className="fl" htmlFor="rs-size">
              Ergs in a wave
            </label>
            <input
              id="rs-size"
              type="number"
              min={1}
              max={60}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
            <Default
              shown={String(saved.defaults.waveSize)}
              moved={saved.waveSize !== saved.defaults.waveSize}
              onUse={() => setSize(String(saved.defaults.waveSize))}
            />
          </div>
          <div>
            <label className="fl" htmlFor="rs-mins">
              Minutes between waves
            </label>
            <input
              id="rs-mins"
              type="number"
              min={1}
              max={240}
              value={mins}
              onChange={(e) => setMins(e.target.value)}
            />
            <Default
              shown={String(saved.defaults.waveMinutes)}
              moved={saved.waveMinutes !== saved.defaults.waveMinutes}
              onUse={() => setMins(String(saved.defaults.waveMinutes))}
            />
          </div>
          <div>
            <label className="fl" htmlFor="rs-plan">
              Plan for this many racers
            </label>
            <input
              id="rs-plan"
              type="number"
              min={0}
              max={999}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            />
            <div className="ra-def">
              {field} SIGNED UP ·{" "}
              <button type="button" className="quiet-btn" onClick={() => setPlan(String(Math.max(1, field)))}>
                use the field
              </button>{" "}
              — SAVES NOTHING
            </div>
          </div>
        </div>

        <p className="ra-read">
          <b>{planN}</b> {planN === 1 ? "RACER" : "RACERS"} · <b>{sizeN ?? "—"}</b> ERGS ·{" "}
          <b>{waves ?? "—"}</b> {waves === 1 ? "WAVE" : "WAVES"} · LAST WAVE{" "}
          <b>{lastWaveMs === null ? "—" : fmtRaceClock(lastWaveMs)}</b> · LAST FINISHER ABOUT{" "}
          <b>{lastDoneMs === null ? "—" : fmtRaceClock(lastDoneMs)}</b>
        </p>
        {warnings.map((w) => (
          <p className="ra-warn" key={w}>
            {w}
          </p>
        ))}
      </div>

      {/* ------------------------------------------------------ picture */}
      <div className="ra-block">
        <div className="ra-eye">The picture</div>
        <p className="ra-def">THE SHOT THE ADS CARRY. NO PICK MEANS THE NEWEST IN THE GALLERY, WHICH MOVES ON ITS OWN.</p>
        {/* ONLY THE THUMBNAILS NEED THE GALLERY. Black and white is a way of
         * drawing whatever picture the ads land on — it is true of the
         * newest shot as much as of a pick — so the switch stays on screen
         * when the listing comes back empty (an R2 hiccup, or photos not
         * servable at all). The whole block used to go with it, which meant
         * flipping the ads to colour had to wait on the bucket. */}
        <div className="ra-cur">
          {current ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={current.thumb} alt="" style={bw ? { filter: "grayscale(1)" } : undefined} />
          ) : (
            <div className="none" />
          )}
          <div>
            <div className="ra-def">
              {photoKey ? `PICKED · ${shortKey(photoKey)}` : "THE NEWEST SHOT"}
              {bw ? " · BLACK AND WHITE" : " · IN COLOUR"}
              {/* A pick older than the thumbnails on this page is still the
               * pick, and the ads still carry it; say so rather than leave
               * an empty box sitting under the word PICKED. Only worth
               * saying when there IS a strip to be missing from — an empty
               * listing has its own line below. */}
              {photoKey && !current && gallery.length > 0 ? " · NOT IN THE NEWEST 60" : ""}
            </div>
            <div className="tabs ra-tabs" role="group" aria-label="How the picture is drawn">
              <button type="button" className={bw ? "on" : undefined} aria-pressed={bw} onClick={() => setBw(true)}>
                Black and white
              </button>
              <button type="button" className={!bw ? "on" : undefined} aria-pressed={!bw} onClick={() => setBw(false)}>
                In colour
              </button>
            </div>
            <div className="ra-act">
              {gallery.length > 0 && (
                <button type="button" className="outline-btn" onClick={() => setPicking((p) => !p)}>
                  {picking ? "Close the gallery" : "Pick a photo"}
                </button>
              )}
              {photoKey !== null && (
                <button type="button" className="outline-btn" onClick={() => setPhotoKey(null)}>
                  Use the newest
                </button>
              )}
            </div>
            {gallery.length === 0 && <div className="ra-def">NO GALLERY PHOTOS TO PICK FROM RIGHT NOW.</div>}
          </div>
        </div>
        {picking && gallery.length > 0 && (
          <div className="ra-pics">
            {gallery.map((g) => (
              <button
                type="button"
                key={g.key}
                className={`ra-pic${g.key === photoKey ? " on" : ""}`}
                aria-label={`Use ${shortKey(g.key)}`}
                aria-pressed={g.key === photoKey}
                onClick={() => {
                  setPhotoKey(g.key);
                  setPicking(false);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.thumb} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------ the save */}
      {dirty && (
        <ul className="ra-chg">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
      <div className="ra-act">
        {confirm ? (
          <>
            <button type="button" className="send" disabled={busy} onClick={() => void save()}>
              {busy ? "…" : "Yes, move the evening"}
            </button>
            <button type="button" className="outline-btn" disabled={busy} onClick={() => setConfirm(false)}>
              Leave it alone
            </button>
          </>
        ) : (
          <button type="button" className="send" disabled={!dirty || busy} onClick={() => setConfirm(true)}>
            {dirty ? `Move the evening — ${lines.length} ${lines.length === 1 ? "change" : "changes"}` : "Nothing to move"}
          </button>
        )}
      </div>
      {ok && <p className="ra-ok">{ok}</p>}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}
