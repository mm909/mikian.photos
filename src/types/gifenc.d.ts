/* gifenc ships no types; these are the three calls the reel's GIF uses
 * (src/app/erg/reel/serverReel.ts). */
declare module "gifenc" {
  type Rgba = number[];
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: { format?: "rgb565" | "rgb444" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean; clearAlphaThreshold?: number; clearAlphaColor?: number }): Rgba[];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Rgba[], format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: Rgba[]; first?: boolean; transparent?: boolean; transparentIndex?: number; delay?: number; repeat?: number; dispose?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
