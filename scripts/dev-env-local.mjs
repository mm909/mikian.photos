/**
 * Make a pulled Vercel env safe to run on localhost.
 *
 *   npx vercel env pull .env.local
 *   node scripts/dev-env-local.mjs
 *   npm run dev
 *
 * `vercel env pull` gives you the real keys, but a few of them describe the
 * deployed site rather than your laptop, and one of them is dangerous here:
 *
 *   NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL — point at the live domain, so Google
 *     sign-in bounces you to production and emailed order links go there too.
 *   PAYMENTS_LOCKED — the buy flow is OPEN unless this is exactly "true"
 *     (src/lib/paymentLock.ts:20), so a pulled production env means a click in
 *     your local checkout is a real PayPal charge.
 *   PAYPAL_ENV — "live" bills real money; anything else is the sandbox.
 *
 * This appends a clearly-marked override block to the END of .env.local, where
 * the last assignment of a key wins. Nothing pulled is deleted or rewritten —
 * comment the block out and you're back to exactly what Vercel gave you.
 * Re-running replaces the block instead of stacking another one.
 *
 * Values are never printed. Only key names and whether they're set.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = ".env.local";
const MARK_START = "# ─── local dev overrides (scripts/dev-env-local.mjs) ───";
const MARK_END = "# ─── end local dev overrides ───";

if (!existsSync(FILE)) {
  console.error(
    `\n✖ No ${FILE} here.\n\n` +
      "  Real credentials:  npx vercel login && npx vercel link && npx vercel env pull .env.local\n" +
      "  No credentials:    node scripts/dev-local.mjs\n",
  );
  process.exit(1);
}

const raw = readFileSync(FILE, "utf8");

/* Everything before our block — the pulled file as Vercel wrote it. */
const pulled = raw.includes(MARK_START) ? raw.slice(0, raw.indexOf(MARK_START)) : raw;

const parse = (text) => {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/s, "$2");
  }
  return out;
};

/* `env` is what Vercel gave you; `effective` includes a block from a previous
 * run, so re-running reports "nothing to change" instead of the same diff. */
const env = parse(pulled);
const effective = parse(raw);
const has = (k) => Boolean(env[k]?.trim());

/* ── what you've got ─────────────────────────────────────────────────────── */
const GROUPS = [
  ["database (required)", ["POSTGRES_URL", "POSTGRES_URL_NON_POOLING"]],
  ["Google sign-in", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "NEXTAUTH_SECRET"]],
  ["photos — Cloudflare R2", ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]],
  ["face rec — AWS Rekognition", ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]],
  ["checkout — PayPal", ["PAYPAL_CLIENT_ID", "PAYPAL_SECRET", "NEXT_PUBLIC_PAYPAL_CLIENT_ID"]],
  ["receipts — Resend", ["RESEND_API_KEY"]],
];

console.log(`\nRead ${FILE} — ${Object.keys(env).length} keys.\n`);
for (const [label, keys] of GROUPS) {
  const missing = keys.filter((k) => !has(k));
  const mark = missing.length === 0 ? "✓" : missing.length === keys.length ? "·" : "!";
  const note = missing.length === 0 ? "" : `  (missing: ${missing.join(", ")})`;
  console.log(`  ${mark} ${label}${note}`);
}

if (!has("POSTGRES_URL")) {
  console.log(
    "\n! POSTGRES_URL is missing — nothing that touches the database will load.\n" +
      "  The Development environment may not have it. Try:\n" +
      "    npx vercel env pull .env.local --environment=production\n",
  );
}

/* ── where the data actually lives ───────────────────────────────────────── */
let dbHost = null;
try {
  dbHost = new URL(env.POSTGRES_URL).hostname;
} catch {}
const dbIsLocal = dbHost === "localhost" || dbHost === "127.0.0.1";
if (env.VERCEL_ENV === "production") {
  console.log(
    "\n! VERCEL_ENV=production came through in the pull. Left alone it half-disables\n" +
      "  the /row100k demo: src/lib/row100k.ts:65 zeroes the demo clock on the server,\n" +
      "  but VERCEL_ENV isn't NEXT_PUBLIC_ so it never reaches the browser bundle — the\n" +
      "  countdown keeps ticking on demo time while the server uses the real date. The\n" +
      "  override below sets it to development.\n",
  );
}

if (dbHost && !dbIsLocal) {
  console.log(
    `\n! POSTGRES_URL points at ${dbHost} — a remote database, almost certainly production.\n` +
      "  Everything you do locally reads and writes the live data. The /row100k board is\n" +
      "  the exception: npm run dev reads the demo namespace, which production never shows.\n",
  );
}

/* ── the overrides ───────────────────────────────────────────────────────── */
const changes = [];
const want = (key, value, why) => {
  if (effective[key] !== value) changes.push({ key, value, why, was: env[key] });
  return `${key}=${value}`;
};

const lines = [
  MARK_START,
  "# Appended by scripts/dev-env-local.mjs. Last assignment wins, so these",
  "# override whatever Vercel pulled above. Delete the block to undo.",
  want("NEXTAUTH_URL", "http://localhost:3000", "so Google sign-in returns to your laptop"),
  want("NEXT_PUBLIC_BASE_URL", "http://localhost:3000", "so generated links stay local"),
  want("PAYMENTS_LOCKED", "true", "so a local click can't take a real order"),
  want("PAYPAL_ENV", "sandbox", "so checkout can't bill a real card"),
  want("VERCEL_ENV", "development", "so the /row100k demo clock isn't switched off"),
  MARK_END,
  "",
];

const body = pulled.replace(/\s*$/, "\n\n") + lines.join("\n");
writeFileSync(FILE, body);

if (changes.length === 0) {
  console.log("\n✓ Local overrides already in place — nothing to change.");
} else {
  console.log("\n✓ Appended local overrides:");
  for (const c of changes) {
    /* These four are URLs and flags, never secrets — safe to echo. */
    const from = c.was === undefined ? "unset" : c.was === "" ? "empty" : c.was;
    console.log(`    ${c.key}=${c.value}   (was ${from}) — ${c.why}`);
  }
}

console.log(
  [
    "",
    "─────────────────────────────────────────────",
    "  npm run dev     → http://localhost:3000",
    "",
    "  Google sign-in works: localhost:3000 is already whitelisted on the",
    "  OAuth client. /row100k runs in demo mode against the seeded board.",
    "─────────────────────────────────────────────",
    "",
  ].join("\n"),
);
