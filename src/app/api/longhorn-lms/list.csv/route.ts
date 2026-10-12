import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { RACE } from "@/app/longhorn-lms/race";
import { photoUrl } from "@/app/row100k/photoUrls";

/* GET /api/longhorn-lms/list.csv — the runner list as a CSV, owner only
 * (the shirt pre-orders' export idiom: RFC 4180 quoting, CRLF, a BOM so
 * Excel opens it clean). Photo as a public URL. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvField(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const actor = await requireRole("owner");
  if (!actor) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  const rows = await db.raceRunnerSignup.findMany({ where: { race: RACE }, orderBy: { createdAt: "asc" } });
  const lines = await Promise.all(
    rows.map(async (r, i) => [
      i + 1,
      r.name,
      r.instagram ? `@${r.instagram}` : "",
      r.email,
      r.phone,
      r.bib,
      r.expectedLoops ?? "",
      r.photoKey ? await photoUrl(r.photoKey).catch(() => "") : "",
      r.createdAt.toISOString(),
      r.updatedAt.toISOString(),
    ]),
  );
  const header = ["#", "Name", "Instagram", "Email", "Phone", "Bib", "Expected loops", "Photo", "Signed up", "Updated"];
  const body = "﻿" + [header, ...lines].map((l) => l.map(csvField).join(",")).join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="longhorn-lms-runners.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
