/**
 * Inspect and restore database backups (see src/lib/backup.ts, BACKUPS.md).
 *
 *   npm run db:restore -- --list
 *       every complete backup in R2, newest first
 *
 *   npm run db:restore -- --at <id> --verify
 *       prove a backup is good: load it into a scratch schema on the current
 *       database, compare row counts to the manifest, drop the schema.
 *       Touches nothing in public.
 *
 *   npm run db:restore -- --at <id> --schema old_data
 *       load a backup into a named scratch schema and KEEP it, to look at
 *       old rows next to live ones (drop it yourself: DROP SCHEMA old_data CASCADE)
 *
 *   npm run db:restore -- --at <id> --replace --yes
 *       THE DISASTER BUTTON: truncate every live table and load the backup,
 *       in one transaction (all or nothing). Run `npm run db:backup` first
 *       if there is anything worth keeping in the current state.
 *
 * Add --local <dir> to read backups written with `db:backup --local`.
 * Targets the database in .env.local (POSTGRES_URL).
 */
import { listBackupIds, readManifest, restoreBackup, type BackupDest } from "../src/lib/backup";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

function target(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable POSTGRES_URL)";
  }
}

async function main() {
  const local = arg("--local");
  const src: BackupDest = local ? { kind: "local", dir: local } : { kind: "r2" };

  if (has("--list")) {
    const ids = await listBackupIds(src);
    if (ids.length === 0) {
      console.log("no complete backups found");
      return;
    }
    console.log(`${ids.length} backup(s), newest first:`);
    for (const id of ids) {
      const m = await readManifest(id, src);
      const mb = (m.totalGzipBytes / 1e6).toFixed(1);
      console.log(`  ${id}  ${String(m.totalRows).padStart(8)} rows  ${mb.padStart(6)} MB gz  ${m.tables.length} tables${m.note ? "  · " + m.note : ""}`);
    }
    return;
  }

  const id = arg("--at");
  if (!id) {
    console.error("usage: --list | --at <id> (--verify | --schema <name> | --replace --yes) [--local <dir>]");
    process.exit(2);
  }

  const log = (s: string) => console.log("  " + s);

  if (has("--verify")) {
    const schema = `backup_verify_${Date.now().toString(36)}`;
    console.log(`verifying ${id} into scratch schema ${schema} on ${target()}`);
    const r = await restoreBackup({ id, src, schema, dropAfter: true, log });
    console.log(`ok: ${r.tables.length} tables, ${r.tables.reduce((s, t) => s + t.loaded, 0)} rows loaded and dropped in ${r.ms} ms`);
    if (r.skipped.length) console.log(`  skipped (no longer in the schema): ${r.skipped.join(", ")}`);
    return;
  }

  const schema = arg("--schema");
  if (schema) {
    console.log(`loading ${id} into schema ${schema} on ${target()} (kept)`);
    const r = await restoreBackup({ id, src, schema, log });
    console.log(`ok: ${r.tables.length} tables in ${r.ms} ms — DROP SCHEMA ${schema} CASCADE when done`);
    return;
  }

  if (has("--replace")) {
    if (!has("--yes")) {
      console.error(`refusing: --replace truncates every table on ${target()} and loads ${id}. Add --yes to confirm.`);
      process.exit(2);
    }
    console.log(`RESTORING ${id} INTO public ON ${target()} — every live table is replaced`);
    const r = await restoreBackup({ id, src, schema: "public", replace: true, log });
    console.log(`done: ${r.tables.length} tables, ${r.tables.reduce((s, t) => s + t.loaded, 0)} rows in ${r.ms} ms`);
    if (r.skipped.length) console.log(`  skipped (no longer in the schema): ${r.skipped.join(", ")}`);
    return;
  }

  console.error("nothing to do: add --verify, --schema <name>, or --replace --yes");
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
