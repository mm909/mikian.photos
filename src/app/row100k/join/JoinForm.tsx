"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { HOME_GYMS, HOME_GYM_MAX, birthdayBounds, fmtRowerNumber, type Division } from "@/lib/row100k";
import { SIZES, type Size } from "../shirt";
import { splitName } from "../settings/SettingsForm";
import { GYM_OTHER, JOIN_FIELD_ORDER, readJoinForm, type JoinErrors, type JoinField, type JoinValues } from "./fields";

/* THE SIGN-UP FORM (owner, 2026-10-01: "once you log in, it brings you to
 * a dedicated sign up page where you see the information that we filled
 * in, like your name and email address … There should be like tiers: first
 * tier is your name, your email, your birthday; second tier is what you
 * want to be called on the board, men's or women's board; these aren't
 * strict, but there's a hierarchy" — and the rest, "their t-shirt size and
 * their height and their weight and their home gym … not as important").
 *
 * ONE FORM, ONE ACTION. Nothing saves until OPT IN: the whole form is read
 * (join/fields.ts readJoinForm — the settings form's own checks), every
 * refusal prints under its own field at once and the first of them takes
 * the focus, and what was typed stays typed. Then ONE POST to
 * /api/row100k/join makes the rower, with the third tier and the month
 * opt-in in the same request, and the browser goes to the front.
 *
 * FIRST NAME and LAST NAME have no column (SettingsForm.tsx says why):
 * they start as the account name split on its first space, the name on the
 * board follows them while it still spells the two — the JoinPanel prefill,
 * kept live — and on a join they are left in this browser under the key
 * the settings form reads, so settings opens with what was typed here.
 *
 * WHAT WAS TYPED SURVIVES A RELOAD: a draft is kept in sessionStorage per
 * account and dropped on the join (a phone that throws the tab away
 * mid-form must not hand back an empty one).
 *
 * PREVIEW (page.tsx ?preview=1, for an admin, who has a row already): the
 * same form and the same checks; OPT IN sends nothing, keeps no draft and
 * prints one line. */

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "M", label: "MEN" },
  { value: "F", label: "WOMEN" },
];

/* The boxes that hold plain text, for reading a draft back. */
const TEXT_KEYS = [
  "first",
  "last",
  "birthday",
  "name",
  "heightFt",
  "heightIn",
  "weightLb",
  "gymPick",
  "gymOther",
  "instagram",
] as const;

const joinName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();

/* Where the focus goes for a refusal on each field. */
const FOCUS_ID: Record<JoinField, string> = {
  first: "jn-first",
  last: "jn-last",
  birthday: "jn-bday",
  name: "jn-name",
  division: "jn-board-M",
  shirt: "jn-shirt-S",
  height: "jn-ft",
  weight: "jn-lb",
  gym: "jn-gym",
  instagram: "jn-ig",
};

/* What the join route calls a field when it refuses one (the page's own
 * names, since 2026-10-01). */
function serverField(v: unknown): JoinField | null {
  return typeof v === "string" && (JOIN_FIELD_ORDER as readonly string[]).includes(v) ? (v as JoinField) : null;
}

function Err({ field, errors }: { field: JoinField; errors: JoinErrors }) {
  return errors[field] ? (
    <p className="form-err" role="alert">
      {errors[field]}
    </p>
  ) : null;
}

export function JoinForm(props: {
  /* The account, as Google gave it. */
  accountName: string;
  email: string;
  /* The number the next rower is handed, or null when it could not be read. */
  nextNumber: number | null;
  /* The front page, for after the join (page.tsx frontHref). */
  front: string;
  preview: boolean;
}) {
  const guess = splitName(props.accountName);
  const [v, setV] = useState<JoinValues>({
    first: guess.first,
    last: guess.last,
    birthday: "",
    name: joinName(guess.first, guess.last),
    division: null,
    shirt: "",
    heightFt: "",
    heightIn: "",
    weightLb: "",
    gymPick: "",
    gymOther: "",
    instagram: "",
  });
  const [errors, setErrors] = useState<JoinErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "preview">("idle");
  const bounds = birthdayBounds();
  const draftKey = `row100k.join.draft.${props.email.toLowerCase()}`;
  /* The draft is written only once the stored one has been read INTO the
   * form — state, not a ref, so the first write happens in the render that
   * already holds the restored values and the prefill can never overwrite
   * a draft (it did, under React's double-run of effects in development). */
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!props.preview) {
      try {
        const raw = sessionStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw) as Partial<Record<keyof JoinValues, unknown>>;
          setV((cur) => {
            const next = { ...cur };
            for (const k of TEXT_KEYS) {
              const s = d[k];
              if (typeof s === "string") next[k] = s;
            }
            if (d.division === "M" || d.division === "F") next.division = d.division;
            if (typeof d.shirt === "string" && (d.shirt === "" || (SIZES as readonly string[]).includes(d.shirt))) {
              next.shirt = d.shirt as Size | "";
            }
            return next;
          });
        }
      } catch {
        /* storage blocked, or not a draft — the prefill stands */
      }
    }
    setRestored(true);
  }, [draftKey, props.preview]);

  useEffect(() => {
    if (props.preview || !restored) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(v));
    } catch {
      /* storage blocked — the form still holds it for this visit */
    }
  }, [v, restored, draftKey, props.preview]);

  /* The OTHER field takes the focus when its chip is picked. */
  const otherRef = useRef<HTMLInputElement>(null);
  const focusOther = useRef(false);
  useEffect(() => {
    if (v.gymPick !== GYM_OTHER || !focusOther.current) return;
    focusOther.current = false;
    otherRef.current?.focus();
  }, [v.gymPick]);

  const clear = (field: JoinField) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    if (status === "preview") setStatus("idle");
  };
  const set = <K extends keyof JoinValues>(key: K, value: JoinValues[K], field: JoinField) => {
    setV((cur) => ({ ...cur, [key]: value }));
    clear(field);
  };
  /* FIRST / LAST: the name on the board follows while it still spells the
   * two (or is empty); a board name the rower typed for themself is left
   * alone. */
  const setNamePart = (key: "first" | "last", value: string) => {
    setV((cur) => {
      const next = { ...cur, [key]: value };
      const before = joinName(cur.first, cur.last);
      const board = cur.name.replace(/\s+/g, " ").trim();
      if (board === before || board === "") next.name = joinName(next.first, next.last);
      return next;
    });
    clear(key);
    clear("name");
  };

  const focusField = (field: JoinField) => {
    const id = field === "gym" && v.gymPick !== GYM_OTHER ? "jn-gym-0" : FOCUS_ID[field];
    // After the paint that prints the refusal, and to the MIDDLE of the
    // screen: a bare focus() scrolls the field to the top edge, which is
    // under the sticky bar.
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.focus({ preventScroll: true });
    }, 0);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setFailure(null);
    const read = readJoinForm(v);
    setErrors(read.errors);
    if (!read.body) {
      setStatus("idle");
      const first = JOIN_FIELD_ORDER.find((f) => read.errors[f]);
      if (first) focusField(first);
      return;
    }
    if (props.preview) {
      setStatus("preview");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/row100k/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(read.body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        field?: unknown;
        participantId?: unknown;
      };
      if (res.ok && data.ok) {
        try {
          // The settings form's copy of the two names (SettingsForm.tsx
          // storageKey), and the note the front page reads to open the
          // share dialog on a new rower's number (JoinPanel.tsx).
          if (typeof data.participantId === "string") {
            localStorage.setItem(
              `row100k.names.${data.participantId}`,
              JSON.stringify({ first: v.first.replace(/\s+/g, " ").trim(), last: v.last.replace(/\s+/g, " ").trim() }),
            );
          }
          sessionStorage.setItem("row100k.justJoined", "1");
          sessionStorage.removeItem(draftKey);
        } catch {
          /* storage blocked — they just miss the two conveniences */
        }
        // A full load, not a client hop: the bar and the front page are
        // another person's now. Stays in "sending" until it lands.
        window.location.assign(props.front);
        return;
      }
      const field = serverField(data.field);
      const message = data.error ?? "Something went wrong — try again.";
      if (field) {
        setErrors((prev) => ({ ...prev, [field]: message }));
        focusField(field);
      } else {
        setFailure(message);
      }
    } catch {
      setFailure("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  return (
    <form className="jn" onSubmit={submit} noValidate>
      <h1 className="jn-h">
        <span>Welcome,</span>
        <span>
          Rower
          {props.nextNumber !== null ? (
            <>
              {" "}
              <b>{fmtRowerNumber(props.nextNumber)}</b>
            </>
          ) : null}
        </span>
      </h1>

      {/* TIER ONE: who you are. */}
      <div className="jn-t1">
        <div className="jn-f">
          <label className="jn-l" htmlFor="jn-first">First name</label>
          <input
            id="jn-first"
            type="text"
            value={v.first}
            maxLength={40}
            onChange={(e) => setNamePart("first", e.target.value)}
            autoComplete="given-name"
          />
          <Err errors={errors} field="first" />
        </div>
        <div className="jn-f">
          <label className="jn-l" htmlFor="jn-last">Last name</label>
          <input
            id="jn-last"
            type="text"
            value={v.last}
            maxLength={40}
            onChange={(e) => setNamePart("last", e.target.value)}
            autoComplete="family-name"
          />
          <Err errors={errors} field="last" />
        </div>
        <div className="jn-f jn-wide">
          {/* The account's, as it is: type on the page, not a field. The
           * whole measure to itself, so a long address stays on one line. */}
          <span className="jn-l">Email</span>
          <span className="jn-mail">{props.email}</span>
        </div>
        <div className="jn-f">
          <label className="jn-l" htmlFor="jn-bday">Birthday</label>
          {/* The picker stops at the age band on its own; the route checks
           * the same band again. Printed nowhere (owner, 2026-09-24). */}
          <input
            id="jn-bday"
            type="date"
            value={v.birthday}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => set("birthday", e.target.value, "birthday")}
            autoComplete="bday"
          />
          <Err errors={errors} field="birthday" />
        </div>
      </div>

      {/* TIER TWO: who you are on the board. */}
      <div className="jn-t2">
        <div className="jn-f">
          <label className="jn-l" htmlFor="jn-name">Name on the board</label>
          <input
            id="jn-name"
            type="text"
            value={v.name}
            maxLength={40}
            onChange={(e) => set("name", e.target.value, "name")}
            autoComplete="nickname"
          />
          <Err errors={errors} field="name" />
        </div>
        <div className="jn-f">
          <span className="jn-l" id="jn-board-l">The board</span>
          <div className="jn-picks" role="radiogroup" aria-labelledby="jn-board-l">
            {DIVISIONS.map((d) => (
              <button
                key={d.value}
                id={`jn-board-${d.value}`}
                type="button"
                role="radio"
                aria-checked={v.division === d.value}
                className={`jn-pick${v.division === d.value ? " on" : ""}`}
                onClick={() => set("division", d.value, "division")}
              >
                {d.label}
              </button>
            ))}
          </div>
          <Err errors={errors} field="division" />
        </div>
      </div>

      {/* TIER THREE: the rest, small. Blank is fine for every one of them;
       * a picked size or gym is let go by picking it again. */}
      <div className="jn-t3">
        <div className="jn-row">
          <span className="jn-l" id="jn-shirt-l">Shirt size</span>
          <div className="jn-f">
            <div className="jn-picks" role="radiogroup" aria-labelledby="jn-shirt-l">
              {SIZES.map((size) => (
                <button
                  key={size}
                  id={`jn-shirt-${size}`}
                  type="button"
                  role="radio"
                  aria-checked={v.shirt === size}
                  className={`jn-pick${v.shirt === size ? " on" : ""}`}
                  onClick={() => set("shirt", v.shirt === size ? "" : size, "shirt")}
                >
                  {size}
                </button>
              ))}
            </div>
            <Err errors={errors} field="shirt" />
          </div>
        </div>

        <div className="jn-row">
          <label className="jn-l" htmlFor="jn-ft">Height</label>
          <div className="jn-f">
            <div className="jn-units">
              <input
                id="jn-ft"
                type="text"
                inputMode="numeric"
                value={v.heightFt}
                maxLength={1}
                onChange={(e) => set("heightFt", e.target.value, "height")}
                autoComplete="off"
                aria-label="Height, feet"
              />
              <span className="jn-unit">FT</span>
              <input
                id="jn-in"
                type="text"
                inputMode="numeric"
                value={v.heightIn}
                maxLength={2}
                onChange={(e) => set("heightIn", e.target.value, "height")}
                autoComplete="off"
                aria-label="Height, inches"
              />
              <span className="jn-unit">IN</span>
            </div>
            <Err errors={errors} field="height" />
          </div>
        </div>

        <div className="jn-row">
          <label className="jn-l" htmlFor="jn-lb">Weight</label>
          <div className="jn-f">
            <div className="jn-units">
              <input
                id="jn-lb"
                className="jn-w3"
                type="text"
                inputMode="numeric"
                value={v.weightLb}
                maxLength={3}
                onChange={(e) => set("weightLb", e.target.value, "weight")}
                autoComplete="off"
              />
              <span className="jn-unit">LB</span>
            </div>
            <Err errors={errors} field="weight" />
          </div>
        </div>

        <div className="jn-row">
          <span className="jn-l" id="jn-gym-l">Home gym</span>
          <div className="jn-f">
            <div className="jn-picks" role="radiogroup" aria-labelledby="jn-gym-l">
              {HOME_GYMS.map((g, i) => (
                <button
                  key={g.name}
                  id={`jn-gym-${i}`}
                  type="button"
                  role="radio"
                  aria-checked={v.gymPick === g.name}
                  className={`jn-pick${v.gymPick === g.name ? " on" : ""}`}
                  onClick={() => set("gymPick", v.gymPick === g.name ? "" : g.name, "gym")}
                >
                  {g.label}
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={v.gymPick === GYM_OTHER}
                className={`jn-pick${v.gymPick === GYM_OTHER ? " on" : ""}`}
                onClick={() => {
                  focusOther.current = v.gymPick !== GYM_OTHER;
                  set("gymPick", v.gymPick === GYM_OTHER ? "" : GYM_OTHER, "gym");
                }}
              >
                OTHER
              </button>
            </div>
            {v.gymPick === GYM_OTHER ? (
              <input
                ref={otherRef}
                id="jn-gym"
                className="jn-other"
                type="text"
                value={v.gymOther}
                /* One past the cap, so the refusal can say so rather than
                 * the box silently stopping. */
                maxLength={HOME_GYM_MAX + 1}
                onChange={(e) => set("gymOther", e.target.value, "gym")}
                autoComplete="off"
                aria-label="Other gym"
              />
            ) : null}
            <Err errors={errors} field="gym" />
          </div>
        </div>

        <div className="jn-row">
          <label className="jn-l" htmlFor="jn-ig">Instagram</label>
          <div className="jn-f">
            <input
              id="jn-ig"
              className="jn-ig"
              type="text"
              value={v.instagram}
              maxLength={31}
              placeholder="@handle"
              onChange={(e) => set("instagram", e.target.value, "instagram")}
              autoComplete="off"
              autoCapitalize="none"
            />
            <Err errors={errors} field="instagram" />
          </div>
        </div>
      </div>

      <div className="jn-act">
        <button type="submit" className="jn-go" disabled={status === "sending"}>
          <span>Opt in</span>
          <span className="arr" aria-hidden="true">
            →
          </span>
        </button>
        {status === "sending" ? <p className="jn-note">Saving…</p> : null}
        {status === "preview" ? (
          <p className="jn-note" role="status">
            Preview · nothing saved
          </p>
        ) : null}
        {failure ? (
          <p className="form-err" role="alert">
            {failure}
          </p>
        ) : null}
      </div>
    </form>
  );
}
