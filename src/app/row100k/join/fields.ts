import {
  HOME_GYM_MAX,
  heightCmFromFtIn,
  parseBirthday,
  parseDisplayName,
  parseHeightCm,
  parseHomeGym,
  parseInstagramOptional,
  parseWeightKg,
  weightKgFromLb,
  type Division,
} from "@/lib/row100k";
import { parseSize, type Size } from "../shirt";

/* THE SIGN-UP PAGE'S RULES — pure, safe in the client form and in the join
 * route, so the two cannot drift (owner, 2026-10-01: "there should be like
 * tiers: first tier is your name, your email, your birthday; second tier
 * is what you want to be called on the board, men's or women's board …
 * then their t-shirt size and their height and their weight and their home
 * gym — all of those should be there, not as important").
 *
 * Two readers:
 *   readJoinForm     the form's own boxes (feet, inches, pounds, a gym
 *                    chip) → every refusal at once, keyed by field, or the
 *                    body the join route takes (cm, kg, the gym's name);
 *   parseJoinExtras  the route's read of the third tier out of that body —
 *                    the same checks again, server-side, first refusal only.
 * Every check is one lib/row100k already owns; nothing is re-ruled here. */

export type JoinField =
  | "first"
  | "last"
  | "birthday"
  | "name"
  | "division"
  | "shirt"
  | "height"
  | "weight"
  | "gym"
  | "instagram";

export type JoinErrors = Partial<Record<JoinField, string>>;

/* The refusals, in the words the settings form and the join route already
 * use for the same fields. */
export const JOIN_ERR = {
  name: "Add the name you want on the board.",
  instagram: "That Instagram handle does not look right — letters, numbers, dots and underscores.",
  division: "Pick which board you're competing on.",
  shirt: "Pick a shirt size from the list.",
  height: "Height did not read — 4 to 7 feet, 0 to 11 inches.",
  weight: "Weight did not read — 60 to 500 lb.",
  gym: `Keep the gym to ${HOME_GYM_MAX} characters.`,
} as const;

/* The OTHER chip's own value — never a gym name, never sent (the settings
 * form's constant, the same word). */
export const GYM_OTHER = "__other__";

/* What the form holds, as typed. */
export type JoinValues = {
  first: string;
  last: string;
  birthday: string;
  name: string;
  division: Division | null;
  shirt: Size | "";
  heightFt: string;
  heightIn: string;
  weightLb: string;
  /* "" (none), a HOME_GYMS name, or GYM_OTHER with the words in gymOther. */
  gymPick: string;
  gymOther: string;
  instagram: string;
};

/* What the join route is sent. The first four are the shape it has always
 * taken; the rest is the third tier (null = nothing given) and the ask to
 * be put on this month's 100K board with the join. */
export type JoinBody = {
  displayName: string;
  instagram: string;
  division: Division;
  birthday: string;
  shirtSize: Size | null;
  heightCm: number | null;
  weightKg: number | null;
  homeGym: string | null;
  monthOptIn: true;
};

/* The order the fields stand on the page — the first refusal in this order
 * is the one the form scrolls to. */
export const JOIN_FIELD_ORDER: readonly JoinField[] = [
  "first",
  "last",
  "birthday",
  "name",
  "division",
  "shirt",
  "height",
  "weight",
  "gym",
  "instagram",
];

export function readJoinForm(v: JoinValues, atMs: number = Date.now()): { errors: JoinErrors; body: JoinBody | null } {
  const errors: JoinErrors = {};

  const born = parseBirthday(v.birthday, atMs);
  if (!born.ok) errors.birthday = born.error;

  const displayName = parseDisplayName(v.name);
  if (!displayName) errors.name = JOIN_ERR.name;

  if (!v.division) errors.division = JOIN_ERR.division;

  // Both boxes blank is no height; anything in either must read.
  const ft = v.heightFt.trim();
  const inch = v.heightIn.trim();
  const heightCm = ft || inch ? heightCmFromFtIn(ft, inch) : null;
  if ((ft || inch) && heightCm === null) errors.height = JOIN_ERR.height;

  const lb = v.weightLb.trim();
  const weightKg = lb ? weightKgFromLb(lb) : null;
  if (lb && weightKg === null) errors.weight = JOIN_ERR.weight;

  // A chip is its own name; OTHER is the rower's words, and OTHER with
  // nothing written is no gym.
  let homeGym: string | null = null;
  if (v.gymPick === GYM_OTHER) {
    const g = parseHomeGym(v.gymOther);
    if (g === null) errors.gym = JOIN_ERR.gym;
    else homeGym = g || null;
  } else if (v.gymPick) {
    homeGym = v.gymPick;
  }

  const instagram = parseInstagramOptional(v.instagram);
  if (instagram === null) errors.instagram = JOIN_ERR.instagram;

  if (Object.keys(errors).length > 0 || !displayName || !v.division || instagram === null) {
    return { errors, body: null };
  }
  return {
    errors,
    body: {
      displayName,
      instagram,
      division: v.division,
      birthday: v.birthday.trim(),
      shirtSize: v.shirt || null,
      heightCm,
      weightKg,
      homeGym,
      monthOptIn: true,
    },
  };
}

/* THE THIRD TIER as the join route reads it. A key that is absent stays
 * absent (an old client — the JoinPanel, the settings form's board save —
 * sends none of them and nothing of theirs is touched); null or "" is
 * "none"; anything else must parse, in the column's own units (cm, kg),
 * through the same readers the participants PATCH uses. */
export type JoinExtras = {
  shirtSize?: Size | null;
  heightCm?: number | null;
  weightKg?: number | null;
  homeGym?: string | null;
};

export type ExtrasCheck = { ok: true; value: JoinExtras } | { ok: false; field: JoinField; error: string };

export function parseJoinExtras(body: {
  shirtSize?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  homeGym?: unknown;
}): ExtrasCheck {
  const value: JoinExtras = {};
  const blank = (x: unknown) => x === null || x === "";

  if (body.shirtSize !== undefined) {
    if (blank(body.shirtSize)) value.shirtSize = null;
    else {
      const size = parseSize(body.shirtSize);
      if (!size) return { ok: false, field: "shirt", error: JOIN_ERR.shirt };
      value.shirtSize = size;
    }
  }
  if (body.heightCm !== undefined) {
    if (blank(body.heightCm)) value.heightCm = null;
    else {
      const cm = parseHeightCm(body.heightCm);
      if (cm === null) return { ok: false, field: "height", error: JOIN_ERR.height };
      value.heightCm = cm;
    }
  }
  if (body.weightKg !== undefined) {
    if (blank(body.weightKg)) value.weightKg = null;
    else {
      const kg = parseWeightKg(body.weightKg);
      if (kg === null) return { ok: false, field: "weight", error: JOIN_ERR.weight };
      value.weightKg = kg;
    }
  }
  if (body.homeGym !== undefined) {
    if (blank(body.homeGym)) value.homeGym = null;
    else {
      const gym = parseHomeGym(body.homeGym);
      if (gym === null) return { ok: false, field: "gym", error: JOIN_ERR.gym };
      // Whitespace-only collapses to "", which is none, not a value.
      value.homeGym = gym || null;
    }
  }
  return { ok: true, value };
}
