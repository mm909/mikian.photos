/* A tiny ZIP writer — STORE method only, no dependency.
 *
 * Why it exists: on a phone a burst of <a download> clicks only ever saves
 * the first file, and navigator.share isn't everywhere. So the fallback for
 * "give me every slide at once" is a single .zip the browser downloads like
 * any other file. The payload is PNGs, which are already deflated, so there
 * is nothing to gain from compressing again — every entry is stored raw and
 * the writer stays about a hundred lines instead of pulling in a deflate
 * implementation.
 *
 * Format (APPNOTE 6.3.3), in the order bytes are written:
 *   [local header + name + data] per file
 *   [central directory header + name] per file
 *   [end of central directory]
 * Everything is little-endian. No Zip64: a carousel of PNGs is a few tens of
 * megabytes, nowhere near the 4 GB fields would overflow.
 */

export type ZipFile = {
  /** Path inside the archive — forward slashes, no leading slash. */
  name: string;
  data: Uint8Array;
};

/* CRC-32 (IEEE 802.3), the checksum every zip entry carries. The table is
 * built once, on first use, rather than at module load. */
let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* MS-DOS packed date/time — the only timestamp the base format has. Seconds
 * land on even values because the field only gets five bits. */
function dosTime(at: Date): { time: number; date: number } {
  const year = Math.max(1980, at.getFullYear());
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

const LOCAL_HEADER = 30;
const CENTRAL_HEADER = 46;
const EOCD = 22;

/* Pack the files into one uncompressed archive. Names are written as UTF-8
 * with the language-encoding flag set, so a non-ASCII name still unpacks
 * correctly. */
export function zipStore(files: ZipFile[], at: Date = new Date()): Blob {
  const encoder = new TextEncoder();
  const entries = files.map((f) => {
    const name = encoder.encode(f.name);
    return { name, data: f.data, crc: crc32(f.data), offset: 0 };
  });

  const total =
    entries.reduce(
      (sum, e) => sum + LOCAL_HEADER + e.name.length + e.data.length + CENTRAL_HEADER + e.name.length,
      0,
    ) + EOCD;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const { time, date } = dosTime(at);
  let at32 = 0;

  const u16 = (v: number) => {
    view.setUint16(at32, v, true);
    at32 += 2;
  };
  const u32 = (v: number) => {
    view.setUint32(at32, v >>> 0, true);
    at32 += 4;
  };
  const raw = (bytes: Uint8Array) => {
    out.set(bytes, at32);
    at32 += bytes.length;
  };

  // Local headers + the file bytes themselves.
  for (const e of entries) {
    e.offset = at32;
    u32(0x04034b50); // local file header signature
    u16(20); // version needed to extract (2.0 = store/deflate)
    u16(0x0800); // flags: filename is UTF-8
    u16(0); // method: 0 = stored
    u16(time);
    u16(date);
    u32(e.crc);
    u32(e.data.length); // compressed size == uncompressed size
    u32(e.data.length);
    u16(e.name.length);
    u16(0); // extra field length
    raw(e.name);
    raw(e.data);
  }

  // Central directory: one record per entry, pointing back at its header.
  const centralStart = at32;
  for (const e of entries) {
    u32(0x02014b50); // central file header signature
    u16(20); // version made by
    u16(20); // version needed
    u16(0x0800);
    u16(0);
    u16(time);
    u16(date);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0); // extra
    u16(0); // comment
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(e.offset);
    raw(e.name);
  }

  // End of central directory.
  u32(0x06054b50);
  u16(0); // this disk
  u16(0); // disk with the central directory
  u16(entries.length);
  u16(entries.length);
  u32(at32 - centralStart);
  u32(centralStart);
  u16(0); // comment length

  return new Blob([out], { type: "application/zip" });
}
