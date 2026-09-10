/* poster/pdf.ts — a dependency-free single-page PDF around one JPEG.
 *
 * A print poster wants a PDF at its TRUE size — a 24x36 print shop reads
 * the page size off the file, not off the pixel count — and the whole
 * document is one image, so a writer of six objects is all it takes:
 * catalog, pages, page, the image XObject (/DCTDecode: the JPEG bytes go
 * in untouched), the content stream that paints it edge to edge, and an
 * xref whose offsets are the exact byte positions of each "N 0 obj". The
 * layout was verified in scratchpad/poster-pdf-probe.mjs (re-parsed and
 * opened in Chrome's viewer) and is written here byte for byte.
 *
 * Built as Uint8Array chunks with a running byte length (the src/lib/zip.ts
 * idiom). The binary-marker line after the header is written as raw
 * bytes — TextEncoder would UTF-8-expand them. */

export type PdfOpts = {
  /* The trim box in points, [x0, y0, x1, y1], when the page carries bleed:
   * MediaBox = trim + bleed, TrimBox = the trim. */
  trimPt?: [number, number, number, number];
};

/* The pixel size out of a baseline or progressive JPEG (the SOFn marker),
 * plus its component count for the colour space. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number; components: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("poster/pdf: not a JPEG");
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error(`poster/pdf: bad JPEG marker at ${i}`);
    const marker = bytes[i + 1];
    // SOF0..SOF15 minus DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      const components = bytes[i + 9];
      return { width, height, components };
    }
    // Standalone markers (D0–D7 RST, D8 SOI, 01 TEM) carry no length.
    if ((marker >= 0xd0 && marker <= 0xd8) || marker === 0x01) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    i += 2 + len;
  }
  throw new Error("poster/pdf: no SOF marker");
}

/* Points as PDF wants them: integers bare, otherwise two decimals with the
 * trailing zeros trimmed (595.28, 841.89, 1728). */
const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ""));

/* The bytes of the PDF. `widthPt` / `heightPt` are the page (inches × 72,
 * bleed included when there is any); the JPEG is scaled to fill it. */
export function pdfBytes(
  jpeg: Uint8Array,
  widthPt: number,
  heightPt: number,
  opts: PdfOpts = {},
): Uint8Array<ArrayBuffer> {
  const { width, height, components } = jpegSize(jpeg);
  const colorSpace = components === 1 ? "/DeviceGray" : components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    if (typeof body === "string") push(body);
    else body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const w = fmt(widthPt);
  const h = fmt(heightPt);
  const trim = opts.trimPt ? ` /TrimBox [${opts.trimPt.map(fmt).join(" ")}]` : "";
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(content);

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}]${trim} /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  obj(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    push(jpeg);
    // The EOL before endstream is not part of the stream's Length.
    push("\nendstream");
  });
  obj(5, () => {
    push(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    // Same as the image: an EOL before endstream that /Length does not
    // count (PDF 32000-1 §7.3.8.1).
    push("\nendstream");
  });

  const xrefAt = length;
  const n = 6; // objects 0..5
  let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 1; i < n; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/* The Blob the studio saves. */
export function jpegToPdf(jpeg: Uint8Array, widthPt: number, heightPt: number, opts: PdfOpts = {}): Blob {
  return new Blob([pdfBytes(jpeg, widthPt, heightPt, opts)], { type: "application/pdf" });
}
