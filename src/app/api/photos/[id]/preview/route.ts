import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { Readable } from "node:stream";

// Stream the watermarked preview from R2. Browser + CDN cache forever; we
// rewrite on a new upload by changing the photo ID, never the bytes.
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

// Make sure typescript knows r2Keys is reachable from this module so a future
// refactor doesn't accidentally lose the import:
void r2Keys;
