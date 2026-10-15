import "server-only";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import sharp from "sharp";
import { db } from "@/lib/db";
import { r2Configured, r2Delete, r2GetStream, r2PresignGet, r2PresignPut, r2Put } from "@/lib/r2";

/**
 * Receipts on an expense line (owner, 2026-10-15: "title, cost, and a
 * picture" — more than one picture is fine). They live in R2, private to
 * the team: the browser PUTs straight to a presigned URL (the shirt-photo
 * pattern, bypassing the 4.5 MB route body limit), then registers the key;
 * reading goes through /api/lasd26/expenses/receipt/[id], which checks
 * membership and 302s to a 15-minute presigned GET.
 *
 * Keys:  lasd26/receipts/<expenseId>/<uuid>.<ext>
 * Thumb: lasd26/receipts/<expenseId>/<uuid>.thumb.jpg   (images only)
 *
 * iPhone HEIC: the picker is <input accept="image/jpeg,image/png,
 * image/webp,application/pdf">. Given an explicit accept list without
 * HEIC, iOS transcodes a HEIC photo to JPEG as it is picked, so the bytes
 * that reach here are always one of the four types below.
 */

export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const RECEIPT_ACCEPT = Object.keys(RECEIPT_TYPES).join(",");
export const MAX_RECEIPT_BYTES = 15_000_000;
const THUMB_PX = 640;
const UPLOAD_TTL_SEC = 600;
const VIEW_TTL_SEC = 900;

const KEY_RE = /^lasd26\/receipts\/([a-z0-9]{10,40})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp|pdf)$/i;

export function receiptKey(expenseId: string, contentType: string): string | null {
  const ext = RECEIPT_TYPES[contentType];
  if (!ext) return null;
  return `lasd26/receipts/${expenseId}/${randomUUID()}.${ext}`;
}

/** The expense a key belongs to, or null when it is not one of ours. */
export function expenseIdOfKey(key: string): string | null {
  const m = KEY_RE.exec(key);
  return m ? m[1] : null;
}

export function isImageType(contentType: string): boolean {
  return contentType.startsWith("image/") && contentType in RECEIPT_TYPES;
}

/* ─── Upload ──────────────────────────────────────────────────────────────── */

export type ReceiptMint = { uploadUrl: string; key: string; headers: Record<string, string> };

/**
 * Presign a PUT for one file. The byte count joins the signature, so the
 * URL takes a body of exactly that size and nothing else; the client sends
 * the same Content-Type it declared here.
 */
export async function mintReceiptUpload(expenseId: string, contentType: string, contentLength: number): Promise<{ ok: true; mint: ReceiptMint } | { ok: false; error: string; status: number }> {
  if (!r2Configured()) return { ok: false, error: "Receipt storage isn't configured on this server.", status: 503 };
  const key = receiptKey(expenseId, contentType);
  if (!key) return { ok: false, error: "Receipts are jpeg, png, webp or pdf.", status: 400 };
  if (!Number.isFinite(contentLength) || contentLength < 1 || contentLength > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "That file is too big — 15 MB max.", status: 400 };
  }
  const uploadUrl = await r2PresignPut(key, contentType, UPLOAD_TTL_SEC, contentLength);
  return { ok: true, mint: { uploadUrl, key, headers: { "Content-Type": contentType } } };
}

async function readAll(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export type RegisteredReceipt = { id: string; contentType: string; bytes: number; thumbKey: string | null; createdAt: Date };

/**
 * After the browser's PUT landed: pull the object back (which also proves
 * it landed and gives the true byte count), make the 640 px jpeg for an
 * image, write the TeamReceipt row. A thumb that fails (a file that is not
 * really an image) is not fatal — the receipt registers without one and
 * the page shows a chip instead of a picture.
 */
export async function registerReceipt(args: { expenseId: string; key: string; contentType: string; addedById: string | null }): Promise<{ ok: true; receipt: RegisteredReceipt } | { ok: false; error: string; status: number }> {
  const { expenseId, key, contentType } = args;
  if (expenseIdOfKey(key) !== expenseId) return { ok: false, error: "That upload does not belong to this expense.", status: 400 };
  const ext = RECEIPT_TYPES[contentType];
  if (!ext || !key.toLowerCase().endsWith(`.${ext}`)) return { ok: false, error: "The file type does not match the upload.", status: 400 };
  if (!r2Configured()) return { ok: false, error: "Receipt storage isn't configured on this server.", status: 503 };

  // Refuse to register the same key twice (a retried register after a slow
  // network would otherwise show the receipt twice).
  const dup = await db.teamReceipt.findFirst({ where: { key }, select: { id: true } });
  if (dup) return { ok: false, error: "That receipt is already attached.", status: 409 };

  let bytes = 0;
  let thumbKey: string | null = null;
  try {
    const obj = await r2GetStream(key);
    if (isImageType(contentType)) {
      const buf = await readAll(obj.body);
      bytes = buf.length;
      try {
        const thumb = await sharp(buf, { failOn: "none" })
          .rotate() // auto-orient from EXIF, phones shoot sideways
          .resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 72, mozjpeg: true })
          .toBuffer();
        thumbKey = key.replace(/\.[a-z0-9]+$/i, ".thumb.jpg");
        await r2Put(thumbKey, thumb, "image/jpeg");
      } catch (err) {
        console.warn("lasd26/receipts: thumb failed, registering without one", key, err instanceof Error ? err.message : err);
        thumbKey = null;
      }
    } else {
      bytes = obj.contentLength ?? 0;
      obj.body.destroy();
    }
  } catch (err) {
    console.warn("lasd26/receipts: upload not found in R2", key, err instanceof Error ? err.message : err);
    return { ok: false, error: "The upload did not land — try that file again.", status: 404 };
  }
  if (bytes < 1 || bytes > MAX_RECEIPT_BYTES) {
    await r2Delete([key, ...(thumbKey ? [thumbKey] : [])]).catch(() => {});
    return { ok: false, error: "That file is empty or too big.", status: 400 };
  }

  const row = await db.teamReceipt.create({
    data: { expenseId, key, thumbKey, contentType, bytes, addedById: args.addedById },
    select: { id: true, contentType: true, bytes: true, thumbKey: true, createdAt: true },
  });
  return { ok: true, receipt: row };
}

/* ─── Reading & deleting ──────────────────────────────────────────────────── */

export type ReceiptRow = {
  id: string;
  expenseId: string;
  key: string;
  thumbKey: string | null;
  contentType: string;
  /** The member who attached it (null when the owner did without a row). */
  addedById: string | null;
  expense: { team: string; addedById: string | null; deletedAt: Date | null };
};

/**
 * A receipt with the team its expense belongs to, for the access check, and
 * its own addedById: whoever attached a receipt may take it back off (the
 * review, 2026-10-15: a member who put a receipt on someone else's line —
 * a seeded one included — could not remove it).
 */
export async function getReceipt(receiptId: string): Promise<ReceiptRow | null> {
  if (!/^[a-z0-9]{10,40}$/i.test(receiptId)) return null;
  const row = await db.teamReceipt.findUnique({
    where: { id: receiptId },
    select: { id: true, expenseId: true, key: true, thumbKey: true, contentType: true, addedById: true, expense: { select: { team: true, addedById: true, deletedAt: true } } },
  });
  return row ?? null;
}

/** A 15-minute link to the original, or to the thumb when it has one. */
export async function receiptUrl(receipt: { key: string; thumbKey: string | null }, thumb: boolean): Promise<string> {
  const key = thumb && receipt.thumbKey ? receipt.thumbKey : receipt.key;
  return r2PresignGet(key, VIEW_TTL_SEC);
}

/** Drop the object(s) from R2, then the row. A missing object is not an error. */
export async function deleteReceipt(receipt: { id: string; key: string; thumbKey: string | null }): Promise<void> {
  if (r2Configured()) {
    try {
      await r2Delete([receipt.key, ...(receipt.thumbKey ? [receipt.thumbKey] : [])]);
    } catch (err) {
      console.warn("lasd26/receipts: R2 delete failed (row removed anyway)", receipt.key, err instanceof Error ? err.message : err);
    }
  }
  await db.teamReceipt.delete({ where: { id: receipt.id } });
}
