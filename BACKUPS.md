# Backups

The site is live; this is how its data survives a mistake, a bad deploy, or
a provider outage. Two layers, checked from the outside in.

## What holds data

| Where | What | Protection |
| --- | --- | --- |
| Neon Postgres (`POSTGRES_URL`) | every table: events, photos + detection, orders, Rowtember rowers/rows, relay, crew applications | Neon history/PITR **and** the daily dumps below |
| Cloudflare R2 (`R2_BUCKET`) | photo originals + previews, Rowtember row photos + gallery, `backups/db/` | R2's own durability; **not versioned** — a deleted object is gone (see "Photos") |
| git | schema (`prisma/schema.prisma`), code, `public/` assets | GitHub |

## Layer 1 — Neon point-in-time restore

Neon keeps a history window on the branch and can restore the database to
any instant inside it (Neon console → project → Branches → *Restore*). The
window depends on the plan (Free: hours; paid: days). **Check it and set it
as long as the plan allows** — it is the fastest way back from "someone
deleted the wrong rows an hour ago", and it needs nothing from us.

## Layer 2 — daily dumps to R2 (ours)

`src/lib/backup.ts` dumps every table in `public` as one consistent snapshot
(a single `REPEATABLE READ` transaction) to

```
backups/db/<id>/<Table>.ndjson.gz    one JSON object per row
backups/db/<id>/manifest.json        row counts + sha256 per file; written last
```

`<id>` is the UTC instant, e.g. `2026-09-04T10-00-03Z`. A folder without a
manifest is an incomplete backup and is ignored everywhere.

- **Schedule:** Vercel Cron, `GET /api/cron/backup-db`, daily at 10:00 UTC
  (`vercel.json`). Needs `CRON_SECRET` in the Vercel env — the same secret the
  detection sweep already requires. The run logs one `[backup] <id>: …` line.
- **Retention** (`selectRetained`): the newest 3 always; everything from the
  last 14 days; the newest per ISO week for 90 days; the newest per month for
  400 days. Pruning runs *after* a successful backup, never before.
- **Size:** ~36 MB of tables today → a few MB gzipped per backup.

### By hand

```bash
npm run db:backup                          # to R2 (no pruning)
npm run db:backup -- --note "before X"     # label it
npm run db:backup -- --local ./backups     # to a folder on this machine
npm run db:restore -- --list               # what is in R2
```

Take one before anything risky: a `prisma db push` that drops a column, a
bulk import, a moderation sweep.

### Proving a backup is good

```bash
npm run db:restore -- --at <id> --verify
```

Loads the backup into a scratch schema on the current database (tables
copied with `LIKE`, no foreign keys), compares row counts to the manifest,
drops the schema. Touches nothing in `public`. Do this monthly; a backup
nobody has restored is a hope, not a backup.

To look at old data next to live data instead of dropping it:

```bash
npm run db:restore -- --at <id> --schema old_data
# … SELECT … FROM old_data."RowEntry" …
# DROP SCHEMA old_data CASCADE;
```

### Restoring for real

```bash
npm run db:backup -- --note "pre-restore"   # keep the current state too
npm run db:restore -- --at <id> --replace --yes
```

Every foreign key is made deferrable, then in **one transaction**: all live
tables are truncated, every table is loaded, constraints are checked at
commit. Any failure rolls back and the live tables are untouched. Load order
does not matter (the Event ⇄ Photographer cycle is fine). Constraints are
set back to `NOT DEFERRABLE` afterwards.

Because rows are matched to columns by **name**, a backup restores into a
schema that has since gained nullable columns or dropped columns. A new
`NOT NULL` column without a default will refuse the load — add a default or
relax it first. Tables that no longer exist are skipped and reported.

If the database itself is gone: create a new Neon project, point
`POSTGRES_URL`/`POSTGRES_URL_NON_POOLING` at it, `npm run prisma:push` to
create the tables, then the restore above.

## Photos

R2 keeps every uploaded object durably but has no versioning: the gallery's
DELETE and the photographer tools remove objects for good. The database
backup carries every key, so a lost bucket is *inventoried*, not restored.
If that ever matters, the next step is a second bucket and a nightly copy
(`rclone sync` from a laptop or a small worker) — not built yet.

## Monthly checklist

1. `npm run db:restore -- --list` — there is a backup from this morning.
2. `npm run db:restore -- --at <latest> --verify` — it loads clean.
3. Neon console — the history window is still what you expect.
