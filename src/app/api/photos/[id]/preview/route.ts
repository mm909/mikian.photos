import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { Readable } from "node:stream";

// Serve the (resized, un-watermarked) preview from R2.
//
// Two modes, controlled by R2_PUBLIC_URL:
//   • set    → 302-redirect to `${R2_PUBLIC_URL}/${previewKey}`. Zero-egress
//              "option-A" path — direct from R2 via the Cloudflare custom
//              domain. Used in prod when DNS is wired.
//   • unset  → stream the bytes through this route. Safe fallback for local
//              dev, env-not-yet-set deploys, or when the custom domain is
//              broken and we need to roll back without a deploy.
//
// Previews are immutable per photo ID, so the URL never has to bust.
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { hidden: true, r2PreviewKey: true },
  });
  if (!photo || photo.hidden) return new NextResponse("Not found", { status: 404 });

  // Option-A path — redirect to the public CDN domain.
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase) {
    const url = `${publicBase.replace(/\/$/, "")}/${photo.r2PreviewKey}`;
    return NextResponse.redirect(url, 302);
  }

  // Fallback: stream from R2 through this route.
  try {
    const { body, contentType, contentLength } = await r2GetStream(photo.r2PreviewKey);
    return new NextResponse(Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": contentType ?? "image/jpeg",
        ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        // Photos are immutable per ID — aggressive cache is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Keep this import alive — used implicitly by routes that build preview URLs
// from a photo id without going through this endpoint.
void r2Keys;
