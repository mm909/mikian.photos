/**
 * R2 connectivity smoke test.
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.json scripts/r2-smoke.ts
 *
 * Puts a tiny test object, reads it back, presigns a GET, and (if R2_PUBLIC_URL
 * is set) verifies the public custom domain serves the same bytes. Cleans up.
 */
import { r2, r2Bucket, r2Configured, r2Put, r2PresignGet, r2GetStream } from "../src/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";

const KEY = "smoke/_connectivity-check.txt";
const BODY = `mikian.photos R2 smoke @ ${new Date().toISOString()}`;

async function main() {
  if (!r2Configured()) {
    console.error("R2 not configured — set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in .env.local");
    process.exit(1);
  }
  console.log("bucket:", r2Bucket());

  // 1. PUT
  await r2Put(KEY, Buffer.from(BODY), "text/plain");
  console.log("✓ put", KEY);

  // 2. GET back via SDK
  const { body, contentLength } = await r2GetStream(KEY);
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.from(c));
  const got = Buffer.concat(chunks).toString();
  if (got !== BODY) {
    throw new Error(`round-trip mismatch (expected ${BODY.length} bytes, got ${got.length})`);
  }
  console.log("✓ get round-trip:", contentLength, "bytes");

  // 3. Presign GET
  const signed = await r2PresignGet(KEY, 120);
  const signedResp = await fetch(signed);
  if (!signedResp.ok) throw new Error(`presigned GET ${signedResp.status}`);
  const signedBody = await signedResp.text();
  if (signedBody !== BODY) throw new Error("presigned body mismatch");
  console.log("✓ presigned URL works");

  // 4. Public custom domain (option A)
  if (process.env.R2_PUBLIC_URL) {
    const pub = `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${KEY}`;
    try {
      const r = await fetch(pub);
      if (r.ok) {
        const t = await r.text();
        if (t === BODY) console.log("✓ public domain serves the object:", pub);
        else console.warn("⚠ public domain reachable but body differs");
      } else {
        console.warn(`⚠ public domain returned ${r.status} — domain may not be connected to the bucket yet (${pub})`);
      }
    } catch (e) {
      console.warn("⚠ public domain fetch failed:", (e as Error).message);
    }
  } else {
    console.log("(R2_PUBLIC_URL not set — skipping option-A check)");
  }

  // 5. Cleanup
  await r2().send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: KEY }));
  console.log("✓ cleaned up");
}

main().catch((e) => {
  console.error("smoke test failed:", e);
  process.exit(1);
});
