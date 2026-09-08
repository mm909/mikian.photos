import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { shopOpenFor } from "@/app/row100k/shirt";
import { receiptEmail, settledEmail, sizeChangedEmail } from "@/app/row100k/shirtEmail";

export const runtime = "nodejs";

/* THE SHIRT EMAILS, on a page — so the owner can look at the receipt, the
 * size-change note and the two month-end notes as they will land, with
 * made-up numbers and nothing sent. Same gate as every shop surface: open
 * in local dev, admin only in production, 404 otherwise.
 *
 *   GET ?kind=receipt | preorder | changed | free | owed   (default receipt)
 *   GET ?kind=...&text=1                                  the plain twin */

const SAMPLE = { name: "Sasha Vance", rowerNumber: 12 };

export async function GET(req: Request) {
  const actor = await getEffectiveActor();
  const isAdmin = !!actor && isRow100kAdmin(actor.email, actor.roles);
  if (!shopOpenFor(isAdmin)) return new NextResponse("Not found", { status: 404 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "receipt";
  const payUrl = `${url.origin}/row100k/shirt/pay`;
  const mail =
    kind === "preorder"
      ? receiptEmail({ ...SAMPLE, size: "S", kind: "preorder", meters: 104_210 })
      : kind === "changed"
        ? sizeChangedEmail({ ...SAMPLE, from: "L", size: "M", kind: "stock", meters: 52_340 })
        : kind === "free"
          ? settledEmail({ ...SAMPLE, size: "M", meters: 104_210, free: true, payUrl })
          : kind === "owed"
            ? settledEmail({ ...SAMPLE, size: "M", meters: 52_340, free: false, payUrl })
            : receiptEmail({ ...SAMPLE, size: "M", kind: "stock", meters: 52_340 });

  if (url.searchParams.get("text") === "1") {
    return new NextResponse(`${mail.subject}\n\n${mail.text}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" },
    });
  }
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${mail.subject}</title></head><body style="margin:0;background:#F4F3EE">${mail.html}</body></html>`;
  return new NextResponse(page, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" },
  });
}
