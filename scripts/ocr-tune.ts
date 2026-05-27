/**
 * OCR tuning experiment: try multiple pre-processing variants on every photo
 * and dump anything that looks like a 3-5 digit number.
 *
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/ocr-tune.ts
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/ocr-tune.ts --id=<photoId>
 *   npx -y dotenv-cli -e .env.local -- npx tsx scripts/ocr-tune.ts --use-original
 *
 * Variants tested:
 *   - prep@1400 (current default)
 *   - prep@2400 (less aggressive downscale; bigger characters for Tesseract)
 *   - prep@native (no resize — only used when source is reasonable)
 *
 * Use --use-original to OCR the originals/ object instead of previews/.
 */
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { r2GetStream, r2Keys, r2Configured } from "../src/lib/r2";

const db = new PrismaClient();

async function getBytes(key: string): Promise<Buffer> {
  const { body } = await r2GetStream(key);
  const chunks: Buffer[] = [];
  for await (const c of body) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}

type RecognizeFn = (img: Buffer | string, langs?: string, opts?: unknown) => Promise<{ data: unknown }>;

async function getRecognize(): Promise<RecognizeFn> {
  const mod = (await import("tesseract.js")) as unknown as {
    recognize?: RecognizeFn;
    default?: { recognize: RecognizeFn };
  };
  const fn = mod.recognize ?? mod.default?.recognize;
  if (!fn) throw new Error("tesseract.recognize missing");
  return fn;
}

async function prep(bytes: Buffer, width: number | null): Promise<Buffer> {
  let s = sharp(bytes, { failOn: "none" }).rotate();
  if (width) s = s.resize({ width, withoutEnlargement: true, fit: "inside" });
  return s.grayscale().normalize().toFormat("png").toBuffer();
}

type Hit = { text: string; digits: string; conf: number };

function digitWords(data: unknown): Hit[] {
  const d = data as {
    blocks?: { paragraphs?: { lines?: { words?: { text?: string; confidence?: number }[] }[] }[] }[];
  };
  const out: Hit[] = [];
  for (const b of d.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const w of l.words ?? []) {
          if (!w?.text || typeof w.confidence !== "number") continue;
          const digits = w.text.replace(/[^0-9]/g, "");
          if (digits.length >= 2 && digits.length <= 5) {
            out.push({ text: w.text, digits, conf: w.confidence });
          }
        }
      }
    }
  }
  return out;
}

async function main() {
  if (!r2Configured()) {
    console.error("R2 not configured");
    process.exit(1);
  }
  const idArg = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];
  const useOriginal = process.argv.includes("--use-original");
  const recognize = await getRecognize();

  const photos = idArg
    ? await db.photo.findMany({ where: { id: idArg } })
    : await db.photo.findMany({ orderBy: { createdAt: "asc" }, take: 40 });

  for (const p of photos) {
    console.log(`\n=== ${p.id} (${useOriginal ? "original" : "preview"})`);
    let raw: Buffer;
    try {
      raw = await getBytes(useOriginal ? r2Keys.original(p.id) : r2Keys.preview(p.id));
    } catch (e) {
      console.log("  fetch error:", e instanceof Error ? e.message : e);
      continue;
    }

    for (const w of [1400, 2400, null] as const) {
      let prepBuf: Buffer;
      try {
        prepBuf = await prep(raw, w);
      } catch {
        continue;
      }
      const tag = w === null ? "native" : String(w);
      try {
        const { data } = await recognize(prepBuf, "eng");
        const hits = digitWords(data);
        if (hits.length === 0) {
          console.log(`  prep@${tag}: 0 hits`);
        } else {
          const sorted = hits.sort((a, b) => b.conf - a.conf).slice(0, 8);
          console.log(
            `  prep@${tag}: ${hits.length} hits → ${sorted
              .map((h) => `${h.digits}(${h.conf.toFixed(0)})`)
              .join(", ")}`
          );
        }
      } catch (e) {
        console.log(`  prep@${tag}: error`, e instanceof Error ? e.message : e);
      }
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
