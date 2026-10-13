import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { categoryLabel, eventBySlug, readCategory } from "@/app/hyrox/events";

/* GET /api/hyrox/<event>/list.csv — the entries as a CSV, owner only (the
 * Longhorn list's idiom: RFC 4180 quoting, CRLF, a BOM so Excel opens it
 * clean). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvField(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: Request, { params }: { params: { event: string } }) {
  const ev = eventBySlug(params.event);
  if (!ev) return new NextResponse(null, { status: 404 });
  const actor = await requireRole("owner");
  if (!actor) return new NextResponse(null, { status: 404 });

  const rows = await db.hyroxEntry.findMany({ where: { event: ev.slug }, orderBy: { createdAt: "asc" } });
  const head = ["name", "email", "instagram", "category", "format", "division", "gender", "day", "partners", "team", "start_time", "created_at"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const cat = readCategory(r.format, r.division, r.gender);
    lines.push(
      [r.name, r.email, r.instagram, cat ? categoryLabel(cat) : "", r.format, r.division, r.gender, r.day, r.partners.join("; "), r.teamName, r.startTime, r.createdAt.toISOString()]
        .map(csvField)
        .join(","),
    );
  }
  const body = "﻿" + lines.join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hyrox-${ev.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
