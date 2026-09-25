"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  HOME_GYM_MAX,
  birthdayBounds,
  fmtHeightCm,
  fmtWeightKg,
  parseBirthday,
  parseHeightCm,
  parseHomeGym,
  parseInstagramOptional,
  parseWeightKg,
  type Division,
} from "@/lib/row100k";

/* ONE BLOCK, SAVING ITSELF (owner, 2026-09-25: "Combine the two blocks
 * (settings and about you) into one. Make the settings save automatically
 * on change — no SAVE CHANGES button. Users get FIRST NAME, LAST NAME and
 * NAME ON THE BOARD as three fields; prefill first and last name from the
 * Google account name. Remove the copy about kept on your entry only and
 * not printed anywhere").
 *
 * Every field saves on its own — a text field when it loses focus with a
 * new value (Enter blurs it), the board pills and the birthday the moment
 * they change — and says SAVED at the right of its own label for a moment,
 * or prints the refusal under itself. Two doors, the same two as before:
 *   - name on the board, Instagram and the board go through POST
 *     /api/row100k/join (the row's upsert, which takes all three at once,
 *     so a save of one sends the current three);
 *   - birthday, height, weight and home gym go through PATCH
 *     /api/row100k/participants/[id], one key at a time.
 *
 * FIRST NAME and LAST NAME have no column: the participant carries a
 * displayName and nothing else that could honestly hold them, and the
 * schema is not this package's to change. They are kept IN THIS BROWSER
 * (localStorage, per participant) and start as the Google account name
 * split on its first space. They are not decoration: while the name on
 * the board still spells first-and-last, editing either one rewrites the
 * board name with it and saves that — which is how the board name was
 * prefilled at join in the first place (row100kJoin.ts). A board name the
 * rower has typed for themself is left alone.
 *
 * Height and weight are TEXT fields, not number fields, so a rower can type
 * what they know — 180 cm or 5'11, 75 kg or 165 lb — and the same readers
 * the API uses (lib/row100k parseHeightCm/parseWeightKg) turn it metric
 * before it is sent; on save the input re-prints the stored metric value,
 * the one honest answer to what was kept. Blank clears. */

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "M", label: "MEN'S BOARD" },
  { value: "F", label: "WOMEN'S BOARD" },
];

type Field = "first" | "last" | "name" | "instagram" | "division" | "birthday" | "height" | "weight" | "gym";
type Flash = "saving" | "saved";

/* The Google account name, split on its first space: everything before it
 * is the first name, everything after is the last. One word is a first
 * name alone. */
export function splitName(full: string): { first: string; last: string } {
  const t = full.replace(/\s+/g, " ").trim();
  const i = t.indexOf(" ");
  return i < 0 ? { first: t, last: "" } : { first: t.slice(0, i), last: t.slice(i + 1) };
}

const joinName = (first: string, last: string) => `${first.trim()} ${last.trim()}`.replace(/\s+/g, " ").trim();

const storageKey = (participantId: string) => `row100k.names.${participantId}`;

/* A field label with the flash word at its far right (settingsCss.ts
 * .se-lab): SAVED for a moment after the field lands, SAVING in flight.
 * Outside the form component so React keeps the node across renders. */
function FieldLabel({
  field,
  flash,
  htmlFor,
  children,
}: {
  field: Field;
  flash: Partial<Record<Field, Flash>>;
  htmlFor?: string;
  children: ReactNode;
}) {
  const f = flash[field];
  return (
    <label className="fl se-lab" htmlFor={htmlFor}>
      <span>{children}</span>
      <span className={`se-flash${f === "saved" ? " on" : f === "saving" ? " wait" : ""}`} aria-live="polite">
        {f === "saving" ? "SAVING" : "SAVED"}
      </span>
    </label>
  );
}

/* The refusal under the field it belongs to. */
function FieldErr({ field, errors }: { field: Field; errors: Partial<Record<Field, string>> }) {
  return errors[field] ? <p className="form-err">{errors[field]}</p> : null;
}

export function SettingsForm(props: {
  participantId: string;
  displayName: string;
  instagram: string;
  division: Division | null;
  /* The Google account name, for the first and last name prefill. */
  googleName: string;
  /* The About you columns, or null while they are not in the database. */
  about: { birthday: string; heightCm: number | null; weightKg: number | null; homeGym: string } | null;
}) {
  const router = useRouter();
  const guess = splitName(props.googleName);
  const [first, setFirst] = useState(guess.first);
  const [last, setLast] = useState(guess.last);
  const [name, setName] = useState(props.displayName);
  const [instagram, setInstagram] = useState(props.instagram);
  const [division, setDivision] = useState<Division | null>(props.division);
  const [birthday, setBirthday] = useState(props.about?.birthday ?? "");
  const [height, setHeight] = useState(fmtHeightCm(props.about?.heightCm));
  const [weight, setWeight] = useState(fmtWeightKg(props.about?.weightKg));
  const [gym, setGym] = useState(props.about?.homeGym ?? "");
  const [flash, setFlash] = useState<Partial<Record<Field, Flash>>>({});
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const bounds = birthdayBounds();

  /* What the server (or the browser store) last accepted, so a blur with
   * nothing new sends nothing. */
  const saved = useRef({
    first: guess.first,
    last: guess.last,
    name: props.displayName,
    instagram: props.instagram,
    division: props.division,
    birthday: props.about?.birthday ?? "",
    height: fmtHeightCm(props.about?.heightCm),
    weight: fmtWeightKg(props.about?.weightKg),
    gym: props.about?.homeGym ?? "",
  });
  const timers = useRef<Partial<Record<Field, number>>>({});

  /* The browser's copy of the two names, read after mount (the server
   * cannot see it, and reading it during render would hydrate a different
   * form than it sent). */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(props.participantId));
      if (!raw) return;
      const v = JSON.parse(raw) as { first?: unknown; last?: unknown };
      const f = typeof v.first === "string" ? v.first : guess.first;
      const l = typeof v.last === "string" ? v.last : guess.last;
      setFirst(f);
      setLast(l);
      saved.current.first = f;
      saved.current.last = l;
    } catch {
      /* storage blocked — the Google split stands */
    }
    // The guess is derived from a prop that never changes on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.participantId]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of Object.values(t)) window.clearTimeout(id);
    };
  }, []);

  const mark = (field: Field, f: Flash | null) => {
    setFlash((prev) => ({ ...prev, [field]: f ?? undefined }));
    window.clearTimeout(timers.current[field]);
    if (f === "saved") {
      timers.current[field] = window.setTimeout(() => {
        setFlash((prev) => ({ ...prev, [field]: undefined }));
      }, 2200);
    }
  };
  const fail = (field: Field, message: string) => {
    mark(field, null);
    setErrors((prev) => ({ ...prev, [field]: message }));
  };
  const clearError = (field: Field) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  /* THE BOARD DOOR: name, handle and board, all three every time, since
   * the join POST is the row's upsert. `field` is the one that changed
   * and wears the flash or the refusal. */
  const saveBoard = async (field: Field, next: { name: string; instagram: string; division: Division | null }) => {
    clearError(field);
    const displayName = next.name.replace(/\s+/g, " ").trim();
    if (displayName.length < 2) return fail(field, "Add the name you want on the board.");
    const handle = parseInstagramOptional(next.instagram);
    if (handle === null) return fail(field, "That Instagram handle does not look right — letters, numbers, dots and underscores.");
    if (!next.division) return fail(field === "division" ? "division" : field, "Pick which board you're competing on.");
    mark(field, "saving");
    try {
      const res = await fetch("/api/row100k/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, instagram: handle, division: next.division }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) return fail(field, data.error ?? "Something went wrong — try again.");
    } catch {
      return fail(field, "Something went wrong — try again.");
    }
    saved.current.name = displayName;
    saved.current.instagram = handle;
    saved.current.division = next.division;
    setName(displayName);
    setInstagram(handle);
    mark(field, "saved");
    // The bar prints the board name; let the server re-render it.
    router.refresh();
  };

  /* THE ROWER'S OWN DOOR: one key at a time. */
  const saveAbout = async (field: Field, body: Record<string, string | number | null>, after: () => void) => {
    clearError(field);
    mark(field, "saving");
    try {
      const res = await fetch(`/api/row100k/participants/${props.participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        birthday?: string;
        heightCm?: number | null;
        weightKg?: number | null;
        homeGym?: string | null;
      };
      if (!res.ok || !data.ok) return fail(field, data.error ?? "Something went wrong — try again.");
      // The inputs re-print what was kept, metric and trimmed.
      if ("birthday" in body) {
        const v = data.birthday ?? "";
        setBirthday(v);
        saved.current.birthday = v;
      }
      if ("heightCm" in body) {
        const v = fmtHeightCm(data.heightCm ?? null);
        setHeight(v);
        saved.current.height = v;
      }
      if ("weightKg" in body) {
        const v = fmtWeightKg(data.weightKg ?? null);
        setWeight(v);
        saved.current.weight = v;
      }
      if ("homeGym" in body) {
        const v = data.homeGym ?? "";
        setGym(v);
        saved.current.gym = v;
      }
    } catch {
      return fail(field, "Something went wrong — try again.");
    }
    after();
    mark(field, "saved");
  };

  /* FIRST / LAST: the browser keeps them; the board name follows while it
   * still spells the two. */
  const saveNames = (field: "first" | "last", f: string, l: string) => {
    const before = joinName(saved.current.first, saved.current.last);
    const nf = f.replace(/\s+/g, " ").trim();
    const nl = l.replace(/\s+/g, " ").trim();
    if (nf === saved.current.first && nl === saved.current.last) return;
    saved.current.first = nf;
    saved.current.last = nl;
    setFirst(nf);
    setLast(nl);
    try {
      localStorage.setItem(storageKey(props.participantId), JSON.stringify({ first: nf, last: nl }));
    } catch {
      /* storage blocked — the fields still stand for this visit */
    }
    const after = joinName(nf, nl);
    if (name.trim() === before && after.length >= 2 && after !== before) {
      setName(after);
      void saveBoard(field, { name: after, instagram, division });
      return;
    }
    mark(field, "saved");
  };

  const onName = () => {
    const v = name.replace(/\s+/g, " ").trim();
    if (v === saved.current.name) return clearError("name");
    void saveBoard("name", { name: v, instagram, division });
  };
  const onInstagram = () => {
    const v = instagram.trim().replace(/^@+/, "");
    if (v === saved.current.instagram) return clearError("instagram");
    void saveBoard("instagram", { name, instagram: v, division });
  };
  const onDivision = (d: Division) => {
    setDivision(d);
    if (d === saved.current.division) return;
    void saveBoard("division", { name, instagram, division: d });
  };
  const onBirthday = (v: string) => {
    setBirthday(v);
    if (v === saved.current.birthday) return clearError("birthday");
    if (v) {
      const checked = parseBirthday(v);
      if (!checked.ok) return fail("birthday", checked.error);
    }
    void saveAbout("birthday", { birthday: v || null }, () => undefined);
  };
  const onHeight = () => {
    const h = height.trim();
    if (h === saved.current.height) return clearError("height");
    const cm = h ? parseHeightCm(h) : null;
    if (h && cm === null) return fail("height", "Height did not read — try 180 cm or 5'11.");
    void saveAbout("height", { heightCm: cm }, () => undefined);
  };
  const onWeight = () => {
    const w = weight.trim();
    if (w === saved.current.weight) return clearError("weight");
    const kg = w ? parseWeightKg(w) : null;
    if (w && kg === null) return fail("weight", "Weight did not read — try 75 kg or 165 lb.");
    void saveAbout("weight", { weightKg: kg }, () => undefined);
  };
  const onGym = () => {
    const g = parseHomeGym(gym);
    if (g === null) return fail("gym", `Keep the gym to ${HOME_GYM_MAX} characters.`);
    if (g === saved.current.gym) return clearError("gym");
    void saveAbout("gym", { homeGym: g || null }, () => undefined);
  };

  /* Enter in a text field is a blur, which is a save; nothing submits. */
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  return (
    <div className="panel">
      <form className="join-v se-form" onSubmit={onSubmit}>
        <div className="se-pair">
          <div>
            <FieldLabel flash={flash} field="first" htmlFor="se-first">First name</FieldLabel>
            <input
              id="se-first"
              type="text"
              value={first}
              maxLength={40}
              onChange={(e) => setFirst(e.target.value)}
              onBlur={() => saveNames("first", first, last)}
              autoComplete="given-name"
            />
            <FieldErr errors={errors} field="first" />
          </div>
          <div>
            <FieldLabel flash={flash} field="last" htmlFor="se-last">Last name</FieldLabel>
            <input
              id="se-last"
              type="text"
              value={last}
              maxLength={40}
              onChange={(e) => setLast(e.target.value)}
              onBlur={() => saveNames("last", first, last)}
              autoComplete="family-name"
            />
            <FieldErr errors={errors} field="last" />
          </div>
        </div>

        <FieldLabel flash={flash} field="name" htmlFor="se-name">Name on the board</FieldLabel>
        <input
          id="se-name"
          type="text"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={onName}
          autoComplete="nickname"
        />
        <FieldErr errors={errors} field="name" />

        <FieldLabel flash={flash} field="instagram" htmlFor="se-ig">Instagram · optional</FieldLabel>
        <input
          id="se-ig"
          type="text"
          value={instagram}
          maxLength={31}
          placeholder="@handle"
          onChange={(e) => setInstagram(e.target.value)}
          onBlur={onInstagram}
          autoComplete="off"
          autoCapitalize="none"
        />
        <FieldErr errors={errors} field="instagram" />

        <FieldLabel flash={flash} field="division">Compete on</FieldLabel>
        <div className="pills col" role="radiogroup" aria-label="Which board you compete on">
          {DIVISIONS.map((d) => (
            <label className="pill" key={d.value}>
              <input type="radio" name="division" checked={division === d.value} onChange={() => onDivision(d.value)} />
              <span>{d.label}</span>
            </label>
          ))}
        </div>
        <FieldErr errors={errors} field="division" />

        {props.about ? (
          <>
            <FieldLabel flash={flash} field="birthday" htmlFor="se-bday">Birthday</FieldLabel>
            <input
              id="se-bday"
              type="date"
              value={birthday}
              min={bounds.min}
              max={bounds.max}
              onChange={(e) => onBirthday(e.target.value)}
              autoComplete="bday"
            />
            <FieldErr errors={errors} field="birthday" />

            <FieldLabel flash={flash} field="height" htmlFor="se-height">Height · optional</FieldLabel>
            <input
              id="se-height"
              type="text"
              inputMode="decimal"
              value={height}
              maxLength={16}
              placeholder="180 cm or 5'11"
              onChange={(e) => setHeight(e.target.value)}
              onBlur={onHeight}
              autoComplete="off"
            />
            <FieldErr errors={errors} field="height" />

            <FieldLabel flash={flash} field="weight" htmlFor="se-weight">Weight · optional</FieldLabel>
            <input
              id="se-weight"
              type="text"
              inputMode="decimal"
              value={weight}
              maxLength={16}
              placeholder="75 kg or 165 lb"
              onChange={(e) => setWeight(e.target.value)}
              onBlur={onWeight}
              autoComplete="off"
            />
            <FieldErr errors={errors} field="weight" />

            <FieldLabel flash={flash} field="gym" htmlFor="se-gym">Home gym · optional</FieldLabel>
            <input
              id="se-gym"
              type="text"
              value={gym}
              maxLength={HOME_GYM_MAX}
              placeholder="Where you row"
              onChange={(e) => setGym(e.target.value)}
              onBlur={onGym}
              autoComplete="off"
            />
            <FieldErr errors={errors} field="gym" />
          </>
        ) : (
          <p className="se-off">BIRTHDAY, HEIGHT, WEIGHT AND HOME GYM ARE NOT AVAILABLE YET.</p>
        )}

        {/* Enter in a field still submits: with no visible submit button a
         * form of text fields swallows implicit submission, and onSubmit
         * above turns it into a blur. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </div>
  );
}
