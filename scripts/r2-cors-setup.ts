/**
 * One-time R2 CORS setup. Required so the photographer-upload browser PUT to
 * presigned R2 URLs is allowed cross-origin from mikianmusser.com.
 *
 *   npx tsx --env-file=.env.local scripts/r2-cors-setup.ts
 *
 * Safe to re-run; the PUT replaces the existing CORS config.
 */
import { PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { r2, r2Bucket } from "../src/lib/r2";

const ALLOWED_ORIGINS = [
  "https://mikianmusser.com",
  "https://www.mikianmusser.com",
  "http://localhost:3000",
];

async function main() {
  const client = r2();
  const Bucket = r2Bucket();
  console.log("bucket:", Bucket);
  console.log("origins:", ALLOWED_ORIGINS);

  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    })
  );
  console.log("✓ CORS applied");

  // Read it back so we can eyeball it
  const got = await client.send(new GetBucketCorsCommand({ Bucket }));
  console.log("active rules:", JSON.stringify(got.CORSRules, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
