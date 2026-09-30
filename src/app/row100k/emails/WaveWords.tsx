"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { MailWave, MailWaveField } from "@/lib/rowSettings";

/* THE WORDS (owner, 2026-09-30: "I should be able to edit the emails inside
 * of this application ... I don't need a full rich text editor, keeping the
 * same font, I should be able to change some of the copy. I'm thinking
 * specifically of the wave note ... I should be able to swap the order of
 * those on my own"). One block under the wave note's envelope: three plain
 * textareas in the page's own type, one per line the letter lets him
 * retype (raceEmail.ts WAVE_WORDS), each prefilled with what prints today,
 * and a mono line of the placeholders under them.
 *
 * SAVED ON BLUR, the whole mail.wave object at once, the way the shareables
 * switch writes the whole list. A line left empty, or typed back to the
 * built-in one, is dropped from what is sent, so the row only ever holds
 * real changes; RESET puts the built-in line back and saves. A blur with
 * nothing changed sends nothing. On a save the page re-renders
 * (router.refresh) and the frame below shows the letter as it will go out.
 *
 * The draft is this component's after mount: a refresh must not put the
 * server's copy back into a field the owner is typing in. */

const FIELDS: { key: MailWaveField; label: string }[] = [
  { key: "arrive", label: "Arrive" },
  { key: "waiver", label: "Waiver" },
  { key: "signoff", label: "Sign-off" },
];

/* The same cap as rowSettings.MAIL_WAVE_MAX. Not imported: that module
 * carries the db and this one runs in the browser. */
const MAX = 300;

type Draft = Record<MailWaveField, string>;

function fromSetting(words: MailWave, defaults: Draft): Draft {
  return {
    arrive: words.arrive ?? defaults.arrive,
    waiver: words.waiver ?? defaults.waiver,
    signoff: words.signoff ?? defaults.signoff,
  };
}

/* What goes to the setting: only the lines that differ from the built-in. */
function toSetting(d: Draft, defaults: Draft): MailWave {
  const out: MailWave = {};
  for (const f of FIELDS) {
    const t = d[f.key].trim();
    if (t && t !== defaults[f.key]) out[f.key] = t;
  }
  return out;
}

const same = (a: MailWave, b: MailWave) => FIELDS.every((f) => (a[f.key] ?? "") === (b[f.key] ?? ""));

export function WaveWords({
  words,
  defaults,
  placeholders,
}: {
  /* The setting as the server read it. */
  words: MailWave;
  /* The built-in line per field, placeholders unfilled. */
  defaults: Draft;
  /* Each placeholder and what it prints for the wave shown. */
  placeholders: { name: string; value: string }[];
}) {
  const router = useRouter();
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => fromSetting(words, defaults));
  const [saved, setSaved] = useState<MailWave>(words);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const save = async (d: Draft) => {
    if (FIELDS.some((f) => /[<>]/.test(d[f.key]))) {
      setErr("Plain text only — no angle brackets.");
      return;
    }
    const next = toSetting(d, defaults);
    if (same(next, saved)) return;
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const res = await fetch("/api/row100k/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "mail.wave", value: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setSaved(next);
        setOk(true);
        // The letter is built on the server: re-render the frame below.
        router.refresh();
      } else {
        setErr(
          data.error ??
            (res.status === 503
              ? "Couldn't save that — has the RowSetting table been pushed?"
              : "Couldn't save that — try again."),
        );
      }
    } catch {
      setErr("Couldn't save that — try again.");
    }
    setBusy(false);
  };

  const reset = (k: MailWaveField) => {
    const d = { ...draft, [k]: defaults[k] };
    setDraft(d);
    void save(d);
  };

  return (
    <div className="em-copy">
      <div className="pf-eye">
        <span>The words</span>
        <span className="r">{busy ? "Saving…" : ok ? "Saved" : ""}</span>
      </div>
      {FIELDS.map((f) => {
        const fid = `${id}-${f.key}`;
        const changed = draft[f.key].trim() !== defaults[f.key];
        return (
          <div className="em-cf" key={f.key}>
            <div className="em-cf-head">
              <label htmlFor={fid}>{f.label}</label>
              {changed && (
                <button
                  type="button"
                  className="quiet-btn em-cf-reset"
                  disabled={busy}
                  /* A press must not take focus off the textarea, or the
                   * blur would save the typed line a beat before the reset
                   * clears it (and, busy, disable this very button). */
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => reset(f.key)}
                >
                  Reset
                </button>
              )}
            </div>
            <textarea
              id={fid}
              rows={2}
              maxLength={MAX}
              spellCheck
              value={draft[f.key]}
              onChange={(e) => {
                setDraft({ ...draft, [f.key]: e.target.value });
                setErr(null);
                setOk(false);
              }}
              onBlur={(e) => {
                /* A blur INTO a Reset word is not a save: the reset saves,
                 * and it sends the whole draft, so nothing typed is lost
                 * and the two do not race each other to the row. */
                const to = e.relatedTarget as HTMLElement | null;
                if (to && to.classList.contains("em-cf-reset")) return;
                void save(draft);
              }}
            />
          </div>
        );
      })}
      <p className="em-copy-ph">
        {placeholders.map((p, i) => (
          <span key={p.name}>
            {i > 0 && " · "}
            {`{${p.name}}`}
            {p.value && <b> {p.value}</b>}
          </span>
        ))}
      </p>
      {err && <p className="form-err">{err}</p>}
    </div>
  );
}
