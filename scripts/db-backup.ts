/**
 * Take a database backup by hand — the same dump the daily cron makes.
 *
 *   npm run db:backup                     → R2, backups/db/<id>/ (no pruning)
 *   npm run db:backup -- --prune          → R2, then apply the retention policy
 *   npm run db:backup -- --local ./backups  → a folder on this machine
 *   npm run db:backup -- --note "before the roster import"
 *
 * Reads the database in .env.local (POSTGRES_URL). See BACKUPS.md.
 */
import { runBackup, type BackupDest } from "../src/lib/backup";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const local = arg("--local");
  const dest: BackupDest = local ? { kind: "local", dir: local } : { kind: "r2" };
  const prune = process.argv.includes("--prune");
  const note = arg("--note");

  const res = await runBackup({ dest, prune, note, log: (s) => console.log("  " + s) });
  const { manifest } = res;
  console.log(`\nbackup ${manifest.id} → ${dest.kind === "r2" ? "R2" : local}`);
  for (const t of manifest.tables) {
    console.log(`  ${t.table.padEnd(24)} ${String(t.rows).padStart(8)} rows  ${String(t.gzipBytes).padStart(9)} b gz`);
  }
  console.log(`  ${"total".padEnd(24)} ${String(manifest.totalRows).padStart(8)} rows  ${String(manifest.totalGzipBytes).padStart(9)} b gz  in ${res.ms} ms`);
  if (res.pruned) {
    console.log(`  retention: kept ${res.pruned.kept.length}, deleted ${res.pruned.deleted.length}${res.pruned.deleted.length ? " (" + res.pruned.deleted.join(", ") + ")" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
