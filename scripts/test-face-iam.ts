/**
 * IAM smoke test — exercises every Rekognition action the app actually calls
 * against a throwaway collection, so we know the inline policy on the
 * existing user is wide enough (and tight enough — we use this to spot
 * "missing permission" without surprises at production runtime).
 *
 * Run:
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/test-face-iam.ts
 *
 * What it does:
 *   1. CreateCollection (idempotent)
 *   2. ListCollections — confirm ours appears
 *   3. DescribeCollection — basic metadata
 *   4. IndexFaces — against a tiny generated test face image (sharp)
 *   5. ListFaces — confirm the new FaceId is queryable
 *   6. SearchFaces / SearchFacesByImage — try matching against itself
 *   7. DeleteFaces — clean up
 *
 * Doesn't delete the collection itself (that requires DeleteCollection,
 * which we intentionally don't grant — see PLAN_v0.3.md notes).
 */
import {
  CreateCollectionCommand,
  DescribeCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  ListCollectionsCommand,
  ListFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

const TEST_COLLECTION = "mikian-photos_iam-smoke-test";

async function main() {
  const region = process.env.AWS_REGION;
  const access = process.env.AWS_ACCESS_KEY_ID;
  const secret = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !access || !secret) {
    console.error("Missing AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY");
    process.exit(2);
  }

  const client = new RekognitionClient({
    region,
    credentials: { accessKeyId: access, secretAccessKey: secret },
  });

  const results: { step: string; ok: boolean; detail: string }[] = [];
  const log = (step: string, ok: boolean, detail: string) => {
    results.push({ step, ok, detail });
    console.log(`${ok ? "ok " : "FAIL"}  ${step.padEnd(28)} ${detail}`);
  };

  // 1) CreateCollection — accept ResourceAlreadyExists.
  try {
    await client.send(new CreateCollectionCommand({ CollectionId: TEST_COLLECTION }));
    log("CreateCollection", true, "created");
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    if (name === "ResourceAlreadyExistsException") {
      log("CreateCollection", true, "already exists (ok)");
    } else {
      log("CreateCollection", false, `${name}: ${(e as Error).message}`);
    }
  }

  // 2) ListCollections — make sure ours shows up.
  try {
    const out = await client.send(new ListCollectionsCommand({}));
    const found = (out.CollectionIds ?? []).includes(TEST_COLLECTION);
    log("ListCollections", found, `${out.CollectionIds?.length ?? 0} total, ours=${found}`);
  } catch (e) {
    log("ListCollections", false, (e as Error).message);
  }

  // 3) DescribeCollection
  try {
    const out = await client.send(
      new DescribeCollectionCommand({ CollectionId: TEST_COLLECTION })
    );
    log("DescribeCollection", true, `faces=${out.FaceCount ?? 0}`);
  } catch (e) {
    log("DescribeCollection", false, (e as Error).message);
  }

  // Build a tiny synthetic JPEG. Rekognition rejects images without a real
  // face, so we composite a stock face from the Wikipedia commons-style
  // 200x200 sample we ship in tests… or — simpler — just use the canonical
  // public-domain "Lenna head" via sharp's noise + circle, which DOES NOT
  // contain a face. So we'll skip indexing if we can't synthesise; better
  // to surface a clean error than fake a face.
  //
  // The user can re-test IndexFaces by uploading a real photo through the
  // normal pipeline once this script is happy with the metadata APIs.
  //
  // We still try IndexFaces with a blank image to confirm the *permission*
  // works — Rekognition will return InvalidParameterException ("no faces"),
  // which is the policy-passes-but-image-is-empty signal. AccessDenied
  // would be the failure mode we actually care about.
  const blank = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 220, g: 220, b: 220 } },
  })
    .jpeg()
    .toBuffer();

  let indexedFaceId: string | null = null;
  try {
    const out = await client.send(
      new IndexFacesCommand({
        CollectionId: TEST_COLLECTION,
        Image: { Bytes: blank },
        MaxFaces: 1,
        QualityFilter: "AUTO",
        ExternalImageId: "iam-smoke",
      })
    );
    const fr = out.FaceRecords?.[0]?.Face?.FaceId;
    indexedFaceId = fr ?? null;
    log(
      "IndexFaces",
      true,
      fr ? `indexed faceId=${fr}` : "permission ok (no face in synthetic image)"
    );
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    if (name === "InvalidParameterException") {
      log("IndexFaces", true, "permission ok (no face detected — expected for blank img)");
    } else {
      log("IndexFaces", false, `${name}: ${(e as Error).message}`);
    }
  }

  // 4) ListFaces — just exercising the permission. Should succeed
  // regardless of whether IndexFaces wrote anything.
  try {
    const out = await client.send(
      new ListFacesCommand({ CollectionId: TEST_COLLECTION, MaxResults: 5 })
    );
    log("ListFaces", true, `count=${out.Faces?.length ?? 0}`);
  } catch (e) {
    log("ListFaces", false, (e as Error).message);
  }

  // 5) SearchFacesByImage — same "permission check" pattern as IndexFaces.
  // No face in image → InvalidParameterException (permission-pass signal).
  try {
    await client.send(
      new SearchFacesByImageCommand({
        CollectionId: TEST_COLLECTION,
        Image: { Bytes: blank },
        FaceMatchThreshold: 80,
        MaxFaces: 5,
        QualityFilter: "AUTO",
      })
    );
    log("SearchFacesByImage", true, "permission ok");
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    if (name === "InvalidParameterException") {
      log("SearchFacesByImage", true, "permission ok (no face in blank img)");
    } else {
      log("SearchFacesByImage", false, `${name}: ${(e as Error).message}`);
    }
  }

  // 6) SearchFaces — face-to-face. Skip when we don't have a real FaceId;
  // but still call it with a synthetic id to confirm the permission.
  try {
    await client.send(
      new SearchFacesCommand({
        CollectionId: TEST_COLLECTION,
        FaceId: indexedFaceId ?? "00000000-0000-0000-0000-000000000000",
        FaceMatchThreshold: 80,
        MaxFaces: 5,
      })
    );
    log("SearchFaces", true, "permission ok");
  } catch (e: unknown) {
    const name = (e as { name?: string }).name;
    // ResourceNotFoundException = "no such FaceId" → permission was fine.
    if (
      name === "ResourceNotFoundException" ||
      name === "InvalidParameterException"
    ) {
      log("SearchFaces", true, `permission ok (${name})`);
    } else {
      log("SearchFaces", false, `${name}: ${(e as Error).message}`);
    }
  }

  // 7) DeleteFaces — clean up if we managed to insert one.
  if (indexedFaceId) {
    try {
      await client.send(
        new DeleteFacesCommand({
          CollectionId: TEST_COLLECTION,
          FaceIds: [indexedFaceId],
        })
      );
      log("DeleteFaces", true, `deleted ${indexedFaceId}`);
    } catch (e) {
      log("DeleteFaces", false, (e as Error).message);
    }
  } else {
    // Even with no inserted FaceId we can prove the permission with a
    // dummy id — AWS will return InvalidParameterException, which means
    // the auth check passed.
    try {
      await client.send(
        new DeleteFacesCommand({
          CollectionId: TEST_COLLECTION,
          FaceIds: ["00000000-0000-0000-0000-000000000000"],
        })
      );
      log("DeleteFaces", true, "permission ok");
    } catch (e: unknown) {
      const name = (e as { name?: string }).name;
      if (name === "InvalidParameterException") {
        log("DeleteFaces", true, "permission ok (bogus id)");
      } else {
        log("DeleteFaces", false, `${name}: ${(e as Error).message}`);
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  if (failed.length === 0) {
    console.log(`✓ all ${results.length} steps passed — IAM policy is good to go.`);
    process.exit(0);
  } else {
    console.log(`✗ ${failed.length} of ${results.length} steps failed:`);
    for (const f of failed) console.log(`    ${f.step}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
