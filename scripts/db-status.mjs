/**
 * Which database is each npm script pointed at?
 *
 *   npm run db:status
 *
 * The swap between databases is stateless: `npm run dev` reads .env.local
 * (keep your DEV database there), and `npm run dev:proddb` layers
 * .env.proddb.local on top of it — dotenv-cli takes the FIRST file's value
 * for a duplicate key, so the three URLs in .env.proddb.local win and
 * everything else (auth, PAYMENTS_LOCKED=true, R2 keys…) still comes from
 * .env.local. Nothing is toggled or rewritten; which database you get is
 * decided by which script you run.
 *
 * Also the guard for the proddb scripts (`--require <file>`): dotenv-cli
 * silently skips a missing -e file, so without this check a missing
 * .env.proddb.local would quietly fall through to the dev database while
 * you believe you're on prod. The guard demands all three URLs because a
 * partial file is worse than a missing one: layering backfills the absent
 * keys from .env.local, and Prisma's directUrl (POSTGRES_URL_NON_POOLING)
 * would point at the dev database while the runtime pool points at prod.
 */
import { existsSync, readFileSync } from "node:fs";

/* All three must be present and usable — see the guard comment above. */
const REQUIRED = ["POSTGRES_URL", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"];

/* Last assignment wins (dotenv's behavior within a file — what makes the
 * override block at the bottom of .env.local authoritative). Split tolerates
 * CRLF: these files are hand-made, often on Windows. */
const parse = (file) => {
  const out = {};
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/s, "$2");
  }
  return out;
};

/* Why this value can't be used as a database URL, or null if it can. */
const problem = (url) => {
  if (!url?.trim()) return "missing";
  if (url === "[SENSITIVE]")
    return 'the literal "[SENSITIVE]" — a write-only Vercel value, see scripts/dev-env-local.mjs';
  if (!/^postgres(ql)?:\/\//.test(url)) return "not a postgres:// URL";
  try {
    if (!new URL(url).hostname) return "has no host";
  } catch {
    return "not a parseable URL";
  }
  return null;
};

const describe = (env) => {
  const url = env?.POSTGRES_URL ?? "";
  const bad = problem(url);
  if (bad) return bad === "missing" ? null : `POSTGRES_URL is ${bad}`;
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, "") || "?";
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return `${u.hostname}/${db}${local ? " (local sandbox)" : ""}`;
};

const req = process.argv.indexOf("--require");
if (req !== -1) {
  const file = process.argv[req + 1];
  const env = parse(file);
  const bad = env ? REQUIRED.map((k) => [k, problem(env[k])]).filter(([, p]) => p) : [];
  if (!env || bad.length) {
    console.error(
      `\n✖ ${env ? "unusable database URLs in " + file : file + " does not exist"} — refusing to start.\n` +
        (env ? "\n" + bad.map(([k, p]) => `    ${k}: ${p}`).join("\n") + "\n" : "") +
        "\n  dotenv silently skips what's missing and falls through to the dev database\n" +
        "  in .env.local — a partial prod file would run Prisma's direct connection\n" +
        "  against dev while the pool hits prod. The file needs exactly these three\n" +
        "  lines, with the PRODUCTION connection strings:\n\n" +
        "    POSTGRES_URL=postgres://...\n" +
        "    POSTGRES_URL_NON_POOLING=postgres://...\n" +
        "    DATABASE_URL=postgres://...\n",
    );
    process.exit(1);
  }
  console.log(`\n▲ PRODUCTION DATABASE: ${describe(env)} — writes are real. (${file})\n`);
  process.exit(0);
}

const local = parse(".env.local");
const prod = parse(".env.proddb.local");
console.log("");
console.log(`  npm run dev / dev:live      → ${local ? (describe(local) ?? "no POSTGRES_URL in .env.local") : ".env.local missing"}`);
console.log(`  npm run dev:proddb          → ${prod ? (describe(prod) ?? "no POSTGRES_URL in .env.proddb.local") : "not configured (.env.proddb.local missing)"}`);
console.log("");
