import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || "mikian-photos";

let _client: S3Client | null = null;

/**
 * Returns a Cloudflare-R2 S3-compatible client. Lazily constructed so the app
 * can boot without credentials (the photo APIs will return 503 if called
 * without infra; the rest of the site keeps working).
 */
export function r2(): S3Client {
  if (_client) return _client;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "R2 credentials missing — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
    );
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

export function r2Bucket(): string {
  return R2_BUCKET;
}

/** Upload bytes to a key. Caller chooses content-type. */
export async function r2Put(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Stream an object back. Returns { body, contentType, contentLength }. */
export async function r2GetStream(key: string): Promise<{
  body: Readable;
  contentType: string | undefined;
  contentLength: number | undefined;
}> {
  const out = await r2().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  if (!out.Body) throw new Error(`r2GetStream: empty body for ${key}`);
  return {
    // In Node runtime the SDK returns a Readable; in Edge runtime it returns a
    // ReadableStream. Our routes run in Node, so this cast is safe.
    body: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
  };
}

/** Presign a GET URL with a short TTL — used to hand the buyer the original. */
export async function r2PresignGet(key: string, ttlSeconds = 900): Promise<string> {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), {
    expiresIn: ttlSeconds,
  });
}

/**
 * Presign a PUT URL so a browser can upload directly to R2 — bypasses Vercel's
 * 4.5MB API-route body limit. The client PUTs the bytes; the server then
 * pulls the object back to derive the preview and read EXIF.
 */
export async function r2PresignPut(
  key: string,
  contentType: string,
  ttlSeconds = 900
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: ttlSeconds }
  );
}

/** Key helpers — keep all R2 paths in one place. */
export const r2Keys = {
  original: (photoId: string) => `originals/${photoId}.jpg`,
  preview: (photoId: string) => `previews/${photoId}.jpg`,
};
