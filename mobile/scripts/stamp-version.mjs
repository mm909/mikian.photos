/* THE VERSION STAMP (owner, 2026-11-24: the splash's version "must NOT be
 * live. It is a snapshot of the all-time meters taken when an update is
 * published, so it only changes when an update ships. It works like a
 * timestamp. If two updates go out at the same meters, add letters at the
 * end: A, B, C").
 *
 * Run in mobile/ just before `eas update`, and commit what it writes:
 *   node scripts/stamp-version.mjs
 * It reads every meter anybody has logged (the site's /api/row100k/app/total)
 * and writes src/build.ts. The same meters as the stamp already there takes
 * the next letter (none, then A, B, C ... Z, then AA). The letters are kept in
 * the file, so it must be committed for the next stamp to know them. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(here, "..", "src", "build.ts");
const api = (process.env.STAMP_API ?? "https://www.rowtember.com").replace(/\/+$/, "");

const res = await fetch(`${api}/api/row100k/app/total`);
const body = await res.json().catch(() => null);
const meters = Math.floor(Number(body?.meters));
if (!res.ok || !(meters > 0)) {
  console.error(`stamp-version: no total from ${api} (${res.status})`);
  process.exit(1);
}

let was = { meters: 0, letter: "" };
try {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/meters:\s*(\d+),\s*letter:\s*"([A-Z]*)"/);
  if (m) was = { meters: Number(m[1]), letter: m[2] };
} catch {
  /* The first stamp. */
}
const next = (l) => {
  if (!l) return "A";
  const last = l[l.length - 1];
  return last === "Z" ? `${l}A` : l.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
};
const letter = was.meters === meters ? next(was.letter) : "";
fs.writeFileSync(
  file,
  `/* THE VERSION STAMP: every meter anybody had logged when this update was
 * published, and a letter when two went out at the same meters. Written by
 * scripts/stamp-version.mjs at publish time; never by hand, never live. */
export const BUILD = { meters: ${meters}, letter: "${letter}" };
`,
);
console.log(`stamped ${meters}${letter}`);
