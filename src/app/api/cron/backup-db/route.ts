import { NextResponse } from "next/server";
import { r2Configured } from "@/lib/r2";
import { runBackup } from "@/lib/backup";

/**
 * Daily database backup (Vercel Cron — see vercel.json).
 *
 *   GET /api/cron/backup-db
 *
 * Dumps every table to R2 under backups/db/<id>/ as one consistent snapshot,
 * then applies the retention policy (src/lib/backup.ts). The same code runs
 * from a laptop as `npm run db:backup`; restores are `npm run db:restore`.
 * See BACKUPS.md.
 *
 * Auth: REQUIRES CRON_SECRET (Vercel sends it as a Bearer token). Fails
 * CLOSED — without CRON_SECRET the endpoint is disabled — same as the
 * detection sweep next door.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }
  try {
    const { manifest, pruned, ms } = await runBackup({ prune: true, note: "cron" });
    console.info(
      `[backup] ${manifest.id}: ${manifest.totalRows} rows, ${manifest.totalGzipBytes} bytes gz, ${ms}ms` +
        (pruned ? `, kept ${pruned.kept.length}, pruned ${pruned.deleted.length}` : ""),
    );
    return NextResponse.json({
      ok: true,
      id: manifest.id,
      tables: manifest.tables.length,
      rows: manifest.totalRows,
      gzipBytes: manifest.totalGzipBytes,
      ms,
      kept: pruned?.kept.length,
      pruned: pruned?.deleted,
    });
  } catch (err) {
    console.error("[backup] failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
