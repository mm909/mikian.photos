/**
 * Sanity check: render a clean "3498" image and run OCR on it. If this
 * succeeds, the pipeline works and any zero-detection in production is a
 * limitation of the source photos (small bibs, blur, etc.), not a bug.
 */
import sharp from "sharp";
import { extractBibsFromImage } from "../src/lib/bibOcr";

const NUMBER = "3498";
const SIZE = 800;

async function main() {
  // Big clean digits on white — Tesseract's happy place
  const svg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
      <rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>
      <text x="50%" y="50%" dy=".35em" font-family="Arial Black" font-size="280"
        font-weight="900" text-anchor="middle" fill="#000">${NUMBER}</text>
    </svg>`);
  const png = await sharp(svg).png().toBuffer();
  await sharp(png).jpeg({ quality: 92 }).toFile("scripts/_synth-bib.jpg");

  console.log(`generated scripts/_synth-bib.jpg with "${NUMBER}"`);

  const hits = await extractBibsFromImage(png);
  if (hits.length === 0) {
    console.log("RESULT: 0 detections — pipeline issue, OCR isn't working at all");
    process.exit(2);
  } else {
    console.log("RESULT:", hits.map((h) => `${h.bib} (${(h.confidence * 100).toFixed(1)}%)`).join(", "));
    const matched = hits.some((h) => h.bib === Number(NUMBER));
    console.log(matched ? "✓ exact match — pipeline works" : "⚠ found something but wrong bib");
    process.exit(matched ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(3);
});
