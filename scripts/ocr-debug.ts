/**
 * Diagnostic: run Tesseract OCR on every photo's preview and dump every
 * number-like word it sees, with confidence, regardless of filters.
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/ocr-debug.ts
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/ocr-debug.ts --id=<photoId>
 *
 * Use this when bib OCR is missing things — shows you exactly what Tesseract
 * found vs. what got filtered out.
 */
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { r2GetStream, r2Keys, r2Configured } from "../src/lib/r2";

const db = new PrismaClient();

async function getBytes(photoId: string): Promise<Buffer> {
  const { body } = await r2GetStream(r2Keys.preview(photoId));
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

async function main() {
  const idArg = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];
  if (!r2Configured()) {
    console.error("R2 not configured");
    process.exit(1);
  }
  const tesseractMod = (await import("tesseract.js")) as unknown as {
    recognize?: typeof import("tesseract.js").recognize;
    default?: { recognize: typeof import("tesseract.js").recognize };
  };
  const recognize = tesseractMod.recognize ?? tesseractMod.default?.recognize;
  if (!recognize) {
    console.error("tesseract.recognize not found in the loaded module");
    process.exit(1);
  }

  const photos = idArg
    ? await db.photo.findMany({ where: { id: idArg } })
    : await db.photo.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  for (const p of photos) {
    console.log("\n=== photo", p.id);
    try {
      const raw = await getBytes(p.id);
      const prep = await sharp(raw, { failOn: "none" })
        .rotate()
        .resize({ width: 1400, withoutEnlargement: true, fit: "inside" })
        .grayscale()
        .normalize()
        .toFormat("png")
        .toBuffer();
      const { data } = await recognize(prep, "eng");
      const allText = (data?.text ?? "").trim();
      console.log("  raw text (overall conf:", data?.confidence?.toFixed(1) ?? "?", "):");
      if (!allText) {
        console.log("    (empty — Tesseract found nothing)");
      } else {
        const head = allText.split("\n").slice(0, 4).join(" | ");
        console.log("    ", head.slice(0, 200));
      }
      const lines: string[] = [];
      for (const block of data?.blocks ?? []) {
        for (const para of block.paragraphs ?? []) {
          for (const line of para.lines ?? []) {
            for (const w of line.words ?? []) {
              if (!w.text) continue;
              const digits = w.text.replace(/[^0-9]/g, "");
              if (digits.length >= 1 && digits.length <= 6) {
                lines.push(`  ${digits.padStart(6)}  conf=${w.confidence.toFixed(1)}  raw="${w.text}"`);
              }
            }
          }
        }
      }
      if (lines.length === 0) {
        console.log("  (no number-like words detected)");
      } else {
        lines.forEach((l) => console.log(l));
      }
    } catch (e) {
      console.warn("  error:", e instanceof Error ? e.message : e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
