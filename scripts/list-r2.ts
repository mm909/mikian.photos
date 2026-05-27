import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2, r2Bucket } from "../src/lib/r2";

async function main() {
  const prefix = process.argv[2] ?? "";
  const r = await r2().send(new ListObjectsV2Command({
    Bucket: r2Bucket(),
    Prefix: prefix,
    MaxKeys: 50,
  }));
  console.log(`prefix=${prefix} count=${r.KeyCount}`);
  for (const o of r.Contents ?? []) {
    console.log(`  ${o.Key}  (${o.Size}b)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
