/* THE SCHEMA REACHES PRODUCTION WITH THE DEPLOY (owner, 2026-10-13: "I
 * don't have access to a terminal right now, so run the command to push
 * to the new table"). On a Vercel PRODUCTION build — VERCEL_ENV is
 * "production", which only a deploy of main gets — this runs
 * `prisma db push` against the project's database before `next build`, so
 * a new table or column is there when the code that reads it goes live.
 * Preview builds and local builds skip it: a branch's schema must never
 * touch the production database.
 *
 * Never `--accept-data-loss`: a change that would drop a column or a
 * table makes Prisma refuse, the build fails loudly, and the owner runs
 * that one by hand after a backup (BACKUPS.md). */
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`db-push-prod: VERCEL_ENV=${process.env.VERCEL_ENV ?? "(unset)"} — not a production deploy, skipping prisma db push`);
  process.exit(0);
}
if (!process.env.POSTGRES_URL_NON_POOLING && !process.env.POSTGRES_URL) {
  console.error("db-push-prod: no POSTGRES_URL in the build environment — cannot push the schema");
  process.exit(1);
}
console.log("db-push-prod: production deploy — prisma db push");
const r = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
