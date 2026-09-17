import { HR_INVALID, PM5_UUID } from "./pm5";

/* THE BYTE BUILDERS (owner, 2026-09-17: "I want to be able to play back a
 * row like how simulate data simulates data").
 *
 * Two things in this codebase write PM5 packets rather than read them: the
 * simulator, which invents a 2,000 m piece, and the playback, which reads a
 * saved session back off the wire it was recorded from. They build the same
 * little-endian bytes in the same layouts, so the builder lives here once
 * and both import it. Nothing in this file knows what a piece is — it is
 * numbers to bytes and nothing else.
 *
 * WHY BYTES AT ALL. Either source could hand the console decoded objects
 * and save itself the trouble. It does not, on purpose: a packet that goes
 * through the real parsers is a packet the console cannot tell from a
 * monitor, which is the only way a replay is worth anything as a check of
 * the screens.
 *
 * NO DOM, NO REACT, NO DATABASE: the scratchpad check imports this
 * straight. */

export type Pm5Packet = { uuid: string; dv: DataView };

/* Little-endian, clamped, in the order the spec tables list the fields. A
 * value past the width of its field is pinned rather than wrapped: a
 * wrapped one would read as a plausible number and lie. */
export class Packet {
  readonly bytes: Uint8Array;
  private i = 0;
  constructor(n: number) {
    this.bytes = new Uint8Array(n);
  }
  u8(v: number) {
    this.bytes[this.i++] = clamp(v, 0xff);
    return this;
  }
  u16(v: number) {
    const x = clamp(v, 0xffff);
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    return this;
  }
  u24(v: number) {
    const x = clamp(v, 0xffffff);
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    this.bytes[this.i++] = (x >> 16) & 0xff;
    return this;
  }
  u32(v: number) {
    const x = clamp(v, 0xffffffff);
    this.bytes[this.i++] = x & 0xff;
    this.bytes[this.i++] = (x >> 8) & 0xff;
    this.bytes[this.i++] = (x >> 16) & 0xff;
    this.bytes[this.i++] = (x >>> 24) & 0xff;
    return this;
  }
  dv(): DataView {
    return new DataView(this.bytes.buffer);
  }
}

function clamp(v: number, max: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, Math.round(v)));
}

export const pkt = (uuid: string, p: Packet): Pm5Packet => ({ uuid, dv: p.dv() });

/* A heart rate the way the monitor sends it: 255 means no belt. Kept even
 * though no surface shows heart rate this month (owner, 2026-09-17) — the
 * byte has to be right or every field after it moves. */
export const hrByte = (hr: number | null | undefined): number => (hr === null || hr === undefined ? HR_INVALID : hr);

/* 0x3D, the force curve of one stroke, as the monitor sends it: up to nine
 * uint16 points a notification, byte 0 the total number of notifications in
 * the high nibble and this one's point count in the low one, byte 1 the
 * sequence. A curve of no points sends nothing at all. */
export function encodeForceCurve(pointsLbf: number[], perChunk = 9): Pm5Packet[] {
  if (!pointsLbf.length) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < pointsLbf.length; i += perChunk) chunks.push(pointsLbf.slice(i, i + perChunk));
  return chunks.map((c, seq) => {
    const p = new Packet(2 + c.length * 2).u8((chunks.length << 4) | c.length).u8(seq);
    for (const v of c) p.u16(v);
    return pkt(PM5_UUID.forceCurve, p);
  });
}
