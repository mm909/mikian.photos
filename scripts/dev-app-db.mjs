/* A LOCAL DATABASE FOR THE PHONE APP'S SANDBOX (2026-11-21).
 *
 *   node scripts/dev-app-db.mjs          start it (leave it running)
 *   node scripts/dev-app-db.mjs --seed   in another shell, once it is up:
 *                                        push the schema and seed the board
 *
 * WHY: this folder's .env.local points at the LIVE database, and work on
 * the app adds tables (follows, blocks, reports, notifications). A new
 * table reaches the live database through a production build and no other
 * way (CLAUDE.md), so until the work is merged the sandbox needs somewhere
 * of its own to keep them. This is a real Postgres, from npm
 * (`embedded-postgres`), kept whole in .rowapp-db/ (git-ignored): nothing
 * to install on the machine and nothing shared with any other checkout.
 *
 * First time: `npm install` inside .rowapp-db/ (its package.json names the
 * one package). Then start it, seed it, and run the site against it with
 * `node scripts/dev-app-sandbox.mjs --local`.
 *
 * Deleting .rowapp-db/data loses only sample rowers; --seed makes them again. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const LOCAL_PORT = 5433;
export const LOCAL_DB = `postgresql://postgres:postgres@localhost:${LOCAL_PORT}/rowapp?schema=public`;
export const LOCAL_ENV = { POSTGRES_URL: LOCAL_DB, POSTGRES_URL_NON_POOLING: LOCAL_DB, DATABASE_URL: LOCAL_DB };

const HOME = path.resolve(".rowapp-db");
const me = process.argv[1] && path.resolve(process.argv[1]) === path.resolve("scripts/dev-app-db.mjs");

if (me && process.argv.includes("--seed")) {
  const env = { ...process.env, ...LOCAL_ENV };
  const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    const r = spawnSync(cmd, { stdio: "inherit", env, shell: true });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  /* The schema, whole, into the empty database. Nothing here can reach the
   * live one: every address Prisma reads is overridden above. */
  run("npx prisma db push --skip-generate");
  /* The accounts to sign in with: the owner's first (an admin), then two
   * plain ones. --me=a,b,c names others. */
  const meFlag = process.argv.find((a) => a.startsWith("--me="));
  const emails = (meFlag ? meFlag.slice(5) : "mikianmusser@gmail.com,sandbox.one@example.com,sandbox.two@example.com").split(",").map((e) => e.trim()).filter(Boolean);
  run(`npx tsx scripts/dev-app-db-accounts.ts accounts ${emails.join(" ")}`);
  /* Three months of the sample board, the last through today; each account
   * above is handed a rower on it. */
  const day = new Date().getDate();
  run(`npx tsx scripts/row100k-demo-seed.ts --months=3 --through=${day} --me=${emails.join(",")}`);
  /* The board lists who opted in to the month; the seed opts nobody in. */
  run("npx tsx scripts/dev-app-db-accounts.ts optin");
  process.exit(0);
}

/* --ghosts: a field for the race page of the phone's monitor (rows over
 * 5,000 m, recordings, follows) for the first account, or the one --me
 * names. scripts/dev-app-ghosts-seed.ts; run it again any time. */
if (me && process.argv.includes("--ghosts")) {
  const meFlag = process.argv.find((a) => a.startsWith("--me="));
  const email = (meFlag ? meFlag.slice(5).split(",")[0] : "mikianmusser@gmail.com").trim();
  const r = spawnSync(`npx tsx scripts/dev-app-ghosts-seed.ts ${email}`, { stdio: "inherit", env: { ...process.env, ...LOCAL_ENV }, shell: true });
  process.exit(r.status ?? 1);
}

/* --field: whole recordings for nine sample rowers and one for the first
 * account (or the one --me names), so the cards of a row's analytics have
 * somebody to be compared against. mobile/scripts/field-seed.ts; run it
 * again any time. */
if (me && process.argv.includes("--field")) {
  const meFlag = process.argv.find((a) => a.startsWith("--me="));
  const email = (meFlag ? meFlag.slice(5).split(",")[0] : "mikianmusser@gmail.com").trim();
  const r = spawnSync(`npx tsx mobile/scripts/field-seed.ts ${email}`, { stdio: "inherit", env: { ...process.env, ...LOCAL_ENV }, shell: true });
  process.exit(r.status ?? 1);
}

/* --photos: real photos on the sandbox's newest rows, read off the live
 * board (scripts/dev-app-photos-seed.ts: it reads live and writes only
 * here). .env.local supplies the live address; this supplies the local. */
if (me && process.argv.includes("--photos")) {
  const r = spawnSync("npx dotenv -e .env.local -- npx tsx scripts/dev-app-photos-seed.ts", { stdio: "inherit", env: { ...process.env, SANDBOX_DB_URL: LOCAL_DB }, shell: true });
  process.exit(r.status ?? 1);
}

if (me) {
  if (!existsSync(path.join(HOME, "node_modules", "embedded-postgres"))) {
    console.error("\n.rowapp-db/ has no Postgres yet. Run `npm install` inside .rowapp-db/ first.\n");
    process.exit(1);
  }
  const EmbeddedPostgres = createRequire(path.join(HOME, "package.json"))("embedded-postgres").default;
  const data = path.join(HOME, "data");
  const fresh = !existsSync(path.join(data, "PG_VERSION"));
  const pg = new EmbeddedPostgres({ databaseDir: data, user: "postgres", password: "postgres", port: LOCAL_PORT, persistent: true, onLog: () => null });
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("rowapp");
  console.log(`\nLocal database up on port ${LOCAL_PORT}${fresh ? " (new and empty: run this script with --seed in another shell)" : ""}. Ctrl-C stops it.\n`);
  const stop = async () => {
    await pg.stop().catch(() => null);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => null, 1 << 30);
}
