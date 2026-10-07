/**
 * Load events/*.yaml (+ GPX) into the tracker tables (TRACKER_SPEC.md §7).
 *
 *   npm run track:sync                         → every events/*.yaml
 *   npm run track:sync -- --event lasd26       → one event
 *   npm run track:sync -- --force              → rewrite even when nothing changed
 *   npm run track:sync -- --dry-run            → validate the files and print the
 *                                                plan (ids, crew key status), no database
 *   npm run track:sync -- --help
 *
 * Reads the database in .env.local (POSTGRES_URL). Same code as
 * POST /api/track/sync, without the admin gate (this is the owner's laptop).
 * Exit code 1 when any event failed to sync.
 *
 * The crew key: the YAML names an env var (TRACKER_CREW_KEY_<SLUG>). Unset,
 * the key is written as "" and the crew/van pages refuse every key — the
 * predictable dev fallback is used ONLY when POSTGRES_URL points at a local
 * database (config.ts databaseIsLocal). On the owner's laptop .env.local
 * points at the LIVE database, so an unset variable here is a loud banner,
 * not a quiet default.
 */
import { databaseIsLocal, ids, listEventSlugs, loadEventConfig } from "../src/lib/tracker/config";
import { crewKeyStatus, failedSummary, syncAll, syncEvent, type SyncSummary } from "../src/lib/tracker/sync";

const HELP = `track-sync — events/*.yaml (+ GPX) → the Tracker* tables

  npm run track:sync [-- options]
  npx dotenv -e .env.local -- npx tsx scripts/track-sync.ts [options]

  --event <slug>   one event (default: every events/*.yaml)
  --force          write even when the file, GPX and crew key all match the database
  --dry-run        validate the files and print the plan; opens no database connection
  --help           this text

A sync is a no-op unless something differs: the YAML (config), a GPX file
(route) or the RESOLVED crew key (key). The summary line names what changed.
Rows that left the file are kept (handoffs/positions hang off them) and
listed as warnings.
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function print(s: SyncSummary) {
  if (s.error) {
    console.log(`✗ ${s.slug}: ${s.error}`);
    return;
  }
  const km = (s.lengthM / 1000).toFixed(1);
  const mi = (s.lengthM / 1609.344).toFixed(1);
  const what = s.changed ? `✓ synced   ${s.slug} (${s.forced && s.changes.length === 0 ? "forced, nothing differed" : s.changes.join(" + ") + (s.forced ? ", forced" : "")})` : `= unchanged ${s.slug}`;
  console.log(`${what}: ${s.entries} entries, ${s.participants} participants, ${s.devices} devices, ${s.checkpoints} checkpoints, route ${km} km (${mi} mi), crew key ${s.crewKey}`);
  for (const w of s.warnings) console.log(`    ! ${w}`);
  if (s.crewKey === "missing") {
    console.error(`\n  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n  !!  ${s.slug}: NO CREW KEY — the crew and van pages refuse every key.\n  !!  Set the variable named in events/${s.slug}.yaml and re-run npm run track:sync.\n  !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`);
  }
}

/** --dry-run: what sync WOULD write, from the files alone. Never touches the database. */
function dryRun(slugs: string[]): boolean {
  console.log(`dry run — database host ${databaseIsLocal() ? "is local (dev crew-key fallback allowed)" : "is NOT local or POSTGRES_URL is unset (no dev fallback)"}`);
  let ok = true;
  for (const slug of slugs) {
    try {
      const cfg = loadEventConfig(slug);
      const key = crewKeyStatus(cfg);
      console.log(`\n${slug}: "${cfg.name}" (${cfg.kind}, ${cfg.units}) starts ${cfg.start_time} · route ${cfg.route} · ${cfg.checkpoints.length} checkpoints`);
      console.log(`  crew key: ${key.status}${cfg.crew_key_env ? ` (${cfg.crew_key_env})` : ""}`);
      for (const w of key.warnings) console.log(`    ! ${w}`);
      for (const e of cfg.entries) {
        console.log(`  ${ids.entry(slug, e.short_name)}  "${e.name}" ${e.color}${e.vehicle_device ? ` · van ${e.vehicle_device.source}:${e.vehicle_device.external_id}` : ""}`);
        e.participants.forEach((p, j) => {
          const pid = ids.participant(slug, e.short_name, j + 1, p);
          console.log(`    ${pid}  ${p.name} (${p.initials})${p.device ? ` · ${p.device.source}:${p.device.external_id}` : " · no device"}`);
        });
      }
      console.log(`  hash ${cfg.hash}`);
    } catch (err) {
      ok = false;
      console.log(`\n✗ ${failedSummary(slug, err).error}`);
    }
  }
  return ok;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const slug = arg("--event");
  const force = process.argv.includes("--force");
  if (process.argv.includes("--dry-run")) {
    const slugs = slug ? [slug] : listEventSlugs();
    if (slugs.length === 0) console.log("no events/*.yaml found");
    if (!dryRun(slugs)) process.exitCode = 1;
    return;
  }
  const results: SyncSummary[] = [];
  if (slug) {
    try {
      results.push(await syncEvent(slug, { force }));
    } catch (err) {
      results.push(failedSummary(slug, err));
    }
  } else {
    results.push(...(await syncAll({ force })));
    if (results.length === 0) console.log("no events/*.yaml found");
  }
  for (const r of results) print(r);
  if (results.some((r) => r.error)) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
