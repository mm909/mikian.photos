import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { r2Configured, r2GetStream } from "@/lib/r2";

export const runtime = "nodejs";

/* Serve one row's proof photo from R2. The id is the UUID minted at upload;
 * the key shape is fixed here so the client never handles raw R2 keys. The
 * feed is public, so the photos are too — same deal as the board itself. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[a-f0-9-]{36}$/.test(params.id)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!r2Configured()) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { body, contentType, contentLength } = await r2GetStream(`row100k/rows/${params.id}.jpg`);
    return new NextResponse(Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>, {
      status: 200,
      headers: {
        "Content-Type": contentType ?? "image/jpeg",
        ...(contentLength ? { "Content-Length": String(contentLength) } : {}),
        // A row's photo never changes once posted — aggressive cache is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
