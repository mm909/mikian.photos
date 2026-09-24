"use client";

import { useState } from "react";
import {
  birthdayBounds,
  fmtHeightCm,
  fmtWeightKg,
  parseBirthday,
  parseHeightCm,
  parseWeightKg,
} from "@/lib/row100k";

/* ABOUT YOU — birthday, height, weight, on the settings page under the
 * name/handle/board form (owner, 2026-09-24: "collect their birthday — we
 * don't have to display it anywhere right now. Height and weight optional,
 * in the settings page"). Its own small panel with its own SAVE, because it
 * saves through a different door (PATCH /api/row100k/participants/[id],
 * the rower's own row only) than the board form above it (POST join).
 *
 * Height and weight are TEXT fields, not number fields, so a rower can type
 * what they know — 180 cm or 5'11, 75 kg or 165 lb — and the same readers
 * the API uses (lib/row100k parseHeightCm/parseWeightKg) turn it metric
 * before it is sent. On save the inputs re-print the stored metric value,
 * which is the one honest answer to "what did it keep". Blank clears.
 *
 * Nothing here is printed anywhere else on the site, by the owner's word;
 * the mono chip in the head says so to the rower. */
export function AboutYou(props: {
  participantId: string;
  birthday: string; // "YYYY-MM-DD" or ""
  heightCm: number | null;
  weightKg: number | null;
}) {
  const [birthday, setBirthday] = useState(props.birthday);
  const [height, setHeight] = useState(fmtHeightCm(props.heightCm));
  const [weight, setWeight] = useState(fmtWeightKg(props.weightKg));
  const [status, setStatus] = useState<"idle" | "sending" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const bounds = birthdayBounds();

  const submit = async () => {
    if (status === "sending") return;
    setError(null);

    /* Read locally first so a typo is caught before the round trip, with
     * the same words the API would use. Blank means clear (null). */
    const bday = birthday.trim();
    if (bday) {
      const checked = parseBirthday(bday);
      if (!checked.ok) {
        setError(checked.error);
        return;
      }
    }
    const h = height.trim();
    const heightCm = h ? parseHeightCm(h) : null;
    if (h && heightCm === null) {
      setError("Height did not read — try 180 cm or 5'11.");
      return;
    }
    const w = weight.trim();
    const weightKg = w ? parseWeightKg(w) : null;
    if (w && weightKg === null) {
      setError("Weight did not read — try 75 kg or 165 lb.");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch(`/api/row100k/participants/${props.participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthday: bday || null, heightCm, weightKg }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        birthday?: string;
        heightCm?: number | null;
        weightKg?: number | null;
      };
      if (res.ok && data.ok) {
        setBirthday(data.birthday ?? bday);
        setHeight(fmtHeightCm(data.heightCm ?? heightCm));
        setWeight(fmtWeightKg(data.weightKg ?? weightKg));
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 4000);
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div className="p-head">
        <h3>About you</h3>
        <span className="mono">NOT PRINTED ANYWHERE</span>
      </div>
      <form
        className="join-v"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label className="fl" htmlFor="about-bday">Birthday</label>
        <input
          id="about-bday"
          type="date"
          value={birthday}
          min={bounds.min}
          max={bounds.max}
          onChange={(e) => setBirthday(e.target.value)}
          autoComplete="bday"
        />
        <label className="fl" htmlFor="about-height">Height · optional</label>
        <input
          id="about-height"
          type="text"
          inputMode="decimal"
          value={height}
          maxLength={16}
          placeholder="180 cm or 5'11"
          onChange={(e) => setHeight(e.target.value)}
          autoComplete="off"
        />
        <label className="fl" htmlFor="about-weight">Weight · optional</label>
        <input
          id="about-weight"
          type="text"
          inputMode="decimal"
          value={weight}
          maxLength={16}
          placeholder="75 kg or 165 lb"
          onChange={(e) => setWeight(e.target.value)}
          autoComplete="off"
        />
        <button className="send" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "…" : "Save"}
        </button>
        {status === "saved" && <p className="form-ok">SAVED.</p>}
        {error && <p className="form-err">{error}</p>}
        <p className="signed-note">KEPT ON YOUR ENTRY ONLY — THE BOARD, THE FEED AND THE CARDS NEVER SHOW THESE.</p>
      </form>
    </div>
  );
}
