/* THE BOAT'S SKINS, and the chest they come out of (owner, 2026-11-24: at
 * the end of every game a treasure chest drops and opens, "one item, or
 * sometimes it bursts with rainbow light and gives three", the
 * Vampire-Survivors chest; and the skins go on the rower's boat, "my boat
 * turned red"). Pure: no React, no phone, so the check rolls a hundred
 * thousand chests through it.
 *
 * FOUR LAYERS, drawn one over the other so each swaps on its own
 * (arcade/BoatArt.tsx): the HULL, the OARS, the ROWER (a little person
 * rowing), and the AURA (whatever is around the boat: a halo, sparkles in
 * the wake). One item of each is on the boat at a time; the STOCK item of
 * each layer is the boat before any chest, owned from the start.
 *
 * THE LADDER. Each step looks unlike the one under it, so a common never
 * passes for a rare:
 *   COMMON     one flat colour ("my boat turned red");
 *   UNCOMMON   two colours: two-tone, a stripe;
 *   RARE       shine: a gloss over a pattern (checks, carbon, chrome);
 *   EPIC       a thing added: a bird on the bow, a halo, a crown;
 *   LEGENDARY  it moves: flaming oars, a rainbow wake.
 * Drops are 60 / 25 / 10 / 4 / 1 in a hundred. */

export type Layer = "hull" | "oars" | "rower" | "aura";
export const LAYERS: Layer[] = ["hull", "oars", "rower", "aura"];
/* THE PIECE IS A BOX NOW (Token.tsx, 2026-11-24), and the layers keep their
 * ids so every item won is still worn: the hull is the box, the oars the
 * circle it shoots, the rower its hat, the aura its trail. These are the
 * words the locker and the chest say. */
export const LAYER_WORD: Record<Layer, string> = { hull: "Box", oars: "Shot", rower: "Hat", aura: "Trail" };

export type Rarity = "stock" | "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITIES: Exclude<Rarity, "stock">[] = ["common", "uncommon", "rare", "epic", "legendary"];
/* Out of a hundred. */
export const DROP: Record<Exclude<Rarity, "stock">, number> = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
/* The colour each step is named in, the same in the dark look and the light. */
export const RARITY_COLOR: Record<Rarity, string> = { stock: "#8A8A8A", common: "#8A9199", uncommon: "#2EA05A", rare: "#2F7FE0", epic: "#9B4DE0", legendary: "#F08A1C" };
export const RARITY_WORD: Record<Rarity, string> = { stock: "Stock", common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

/* What each layer's drawing is told. A colour of "ink" or "paper" is the
 * look's own (C.ink, C.paper), so the stock boat reads in the dark too. */
export type HullPaint = {
  fill: string;
  /* A second colour: the lower half (two-tone), or a band along it (stripe). */
  second?: string;
  pattern?: "twotone" | "stripe" | "checker" | "carbon" | "chrome" | "molten";
  gloss?: boolean;
  /* A little bird sitting on the bow. */
  bird?: boolean;
};
export type OarsPaint = {
  blade: string;
  shaft?: string;
  second?: string;
  pattern?: "split" | "tip" | "gloss";
  /* Ribbons off the shaft; flames or lightning off the blade. */
  extra?: "ribbon" | "flame" | "bolt";
};
export type RowerPaint = {
  kit: string;
  second?: string;
  pattern?: "stripe" | "twotone" | "gloss";
  hat?: "cap" | "crown" | "viking" | "headband";
  /* Gold that shimmers. */
  shimmer?: boolean;
};
export type AuraPaint = {
  kind: "none" | "foam" | "bubbles" | "ripples" | "speed" | "confetti" | "stars" | "halo" | "cloud" | "rainbow" | "starfall";
  color?: string;
};

type Base = { id: string; name: string; rarity: Rarity };
export type Skin =
  | (Base & { layer: "hull"; paint: HullPaint })
  | (Base & { layer: "oars"; paint: OarsPaint })
  | (Base & { layer: "rower"; paint: RowerPaint })
  | (Base & { layer: "aura"; paint: AuraPaint });

const RED = "#D8362A";
const BLUE = "#1F6FD1";
const GREEN = "#2F8F4E";
const YELLOW = "#F2C230";
const ORANGE = "#EE7A1E";
const PINK = "#E8559A";
const NAVY = "#1C2E5A";
const CREAM = "#F1E6C8";
const BLACK = "#1A1A1A";
const WHITE = "#FAFAFA";
const GOLD = "#D9A21B";
const TEAL = "#169C9C";
const PURPLE = "#7A3FC4";

export const SKINS: Skin[] = [
  /* ---- the hull -------------------------------------------------------- */
  { id: "hull-stock", layer: "hull", name: "Plain box", rarity: "stock", paint: { fill: "paper" } },
  { id: "hull-red", layer: "hull", name: "Red", rarity: "common", paint: { fill: RED } },
  { id: "hull-yellow", layer: "hull", name: "Yellow", rarity: "common", paint: { fill: YELLOW } },
  { id: "hull-green", layer: "hull", name: "Green", rarity: "common", paint: { fill: GREEN } },
  { id: "hull-black", layer: "hull", name: "Black", rarity: "common", paint: { fill: BLACK } },
  { id: "hull-navy-cream", layer: "hull", name: "Navy and cream", rarity: "uncommon", paint: { fill: CREAM, second: NAVY, pattern: "twotone" } },
  { id: "hull-racing", layer: "hull", name: "Racing stripe", rarity: "uncommon", paint: { fill: WHITE, second: RED, pattern: "stripe" } },
  { id: "hull-checker", layer: "hull", name: "Checkered", rarity: "rare", paint: { fill: WHITE, second: BLACK, pattern: "checker", gloss: true } },
  { id: "hull-carbon", layer: "hull", name: "Carbon", rarity: "rare", paint: { fill: "#2A2D33", second: "#4A4F58", pattern: "carbon", gloss: true } },
  { id: "hull-chrome", layer: "hull", name: "Chrome", rarity: "rare", paint: { fill: "#C9CED6", pattern: "chrome", gloss: true } },
  { id: "hull-bird", layer: "hull", name: "Shoulder bird", rarity: "epic", paint: { fill: "#B5793F", second: "#8A5A2B", pattern: "stripe", bird: true } },
  { id: "hull-molten", layer: "hull", name: "Molten", rarity: "legendary", paint: { fill: "#2B1A14", second: ORANGE, pattern: "molten", gloss: true } },

  /* ---- the oars -------------------------------------------------------- */
  { id: "oars-stock", layer: "oars", name: "Plain ring", rarity: "stock", paint: { blade: "ink" } },
  { id: "oars-red", layer: "oars", name: "Red shot", rarity: "common", paint: { blade: RED } },
  { id: "oars-blue", layer: "oars", name: "Blue shot", rarity: "common", paint: { blade: BLUE } },
  { id: "oars-orange", layer: "oars", name: "Orange shot", rarity: "common", paint: { blade: ORANGE } },
  { id: "oars-split", layer: "oars", name: "Split shot", rarity: "uncommon", paint: { blade: WHITE, second: GREEN, pattern: "split" } },
  { id: "oars-tipped", layer: "oars", name: "Bullseye", rarity: "uncommon", paint: { blade: NAVY, second: YELLOW, pattern: "tip" } },
  { id: "oars-gold", layer: "oars", name: "Gold shot", rarity: "rare", paint: { blade: GOLD, shaft: "#8C6A12", pattern: "gloss" } },
  { id: "oars-ribbon", layer: "oars", name: "Ribbon shot", rarity: "epic", paint: { blade: PINK, extra: "ribbon" } },
  { id: "oars-flame", layer: "oars", name: "Fireball", rarity: "legendary", paint: { blade: "#3A1A10", extra: "flame" } },
  { id: "oars-bolt", layer: "oars", name: "Ball lightning", rarity: "legendary", paint: { blade: "#1B2A4A", second: YELLOW, extra: "bolt" } },

  /* ---- the rower ------------------------------------------------------- */
  { id: "rower-stock", layer: "rower", name: "Bare head", rarity: "stock", paint: { kit: "ink" } },
  { id: "rower-red", layer: "rower", name: "Red beanie", rarity: "common", paint: { kit: RED } },
  { id: "rower-teal", layer: "rower", name: "Teal beanie", rarity: "common", paint: { kit: TEAL } },
  { id: "rower-purple", layer: "rower", name: "Purple beanie", rarity: "common", paint: { kit: PURPLE } },
  { id: "rower-hoops", layer: "rower", name: "Hooped beanie", rarity: "uncommon", paint: { kit: WHITE, second: BLUE, pattern: "stripe" } },
  { id: "rower-twotone", layer: "rower", name: "Club headband", rarity: "uncommon", paint: { kit: GREEN, second: YELLOW, pattern: "twotone", hat: "headband" } },
  { id: "rower-neon", layer: "rower", name: "Neon beanie", rarity: "rare", paint: { kit: "#2BD46A", second: BLACK, pattern: "gloss" } },
  { id: "rower-cap", layer: "rower", name: "Captain", rarity: "epic", paint: { kit: NAVY, second: WHITE, pattern: "stripe", hat: "cap" } },
  { id: "rower-viking", layer: "rower", name: "Viking", rarity: "epic", paint: { kit: "#6B4A2B", hat: "viking" } },
  { id: "rower-gold", layer: "rower", name: "Golden crown", rarity: "legendary", paint: { kit: GOLD, hat: "crown", shimmer: true } },

  /* ---- the aura -------------------------------------------------------- */
  { id: "aura-none", layer: "aura", name: "No trail", rarity: "stock", paint: { kind: "none" } },
  { id: "aura-foam", layer: "aura", name: "Foam trail", rarity: "common", paint: { kind: "foam" } },
  { id: "aura-ripples", layer: "aura", name: "Ripples", rarity: "common", paint: { kind: "ripples", color: BLUE } },
  { id: "aura-bubbles", layer: "aura", name: "Bubbles", rarity: "uncommon", paint: { kind: "bubbles", color: TEAL } },
  { id: "aura-speed", layer: "aura", name: "Speed lines", rarity: "uncommon", paint: { kind: "speed", color: RED } },
  { id: "aura-stars", layer: "aura", name: "Star trail", rarity: "rare", paint: { kind: "stars", color: YELLOW } },
  { id: "aura-halo", layer: "aura", name: "Halo", rarity: "epic", paint: { kind: "halo", color: GOLD } },
  { id: "aura-cloud", layer: "aura", name: "Own raincloud", rarity: "epic", paint: { kind: "cloud", color: "#8A96A8" } },
  { id: "aura-rainbow", layer: "aura", name: "Rainbow trail", rarity: "legendary", paint: { kind: "rainbow" } },
  { id: "aura-starfall", layer: "aura", name: "Starfall", rarity: "legendary", paint: { kind: "starfall", color: YELLOW } },
];

export const SKIN_BY_ID: Record<string, Skin> = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const STOCK: Record<Layer, string> = { hull: "hull-stock", oars: "oars-stock", rower: "rower-stock", aura: "aura-none" };
/* What can come out of a chest: everything but the stock items. */
export const DROPPABLE = SKINS.filter((s) => s.rarity !== "stock");

export type Equipped = Record<Layer, string>;
export const STOCK_BOAT: Equipped = { ...STOCK };

/* The skin on each layer, the stock one where an id is unknown (an item
 * renamed or gone since it was kept on the phone). */
export function wear(eq: Partial<Equipped> | null | undefined): { hull: HullPaint; oars: OarsPaint; rower: RowerPaint; aura: AuraPaint } {
  const pick = <L extends Layer>(l: L) => {
    const s = SKIN_BY_ID[eq?.[l] ?? ""];
    return (s && s.layer === l ? s : SKIN_BY_ID[STOCK[l]]).paint;
  };
  return { hull: pick("hull") as HullPaint, oars: pick("oars") as OarsPaint, rower: pick("rower") as RowerPaint, aura: pick("aura") as AuraPaint };
}

/* ---- the chest ----------------------------------------------------------- */

/* How often a chest bursts and gives three: one in ten, one in four after
 * a win. */
export const TRIPLE = { lose: 0.1, win: 0.25 };

export function rollRarity(rnd: () => number): Exclude<Rarity, "stock"> {
  let x = rnd() * 100;
  for (const r of RARITIES) {
    x -= DROP[r];
    if (x < 0) return r;
  }
  return "common";
}

export type Chest = { triple: boolean; items: string[] };

/* One chest. Three items are three different ones. */
export function rollChest(rnd: () => number, won: boolean): Chest {
  const triple = rnd() < (won ? TRIPLE.win : TRIPLE.lose);
  const items: string[] = [];
  for (let i = 0; i < (triple ? 3 : 1); i++) {
    const rarity = rollRarity(rnd);
    const pool = DROPPABLE.filter((s) => s.rarity === rarity && !items.includes(s.id));
    const from = pool.length ? pool : DROPPABLE.filter((s) => !items.includes(s.id));
    items.push(from[Math.floor(rnd() * from.length)].id);
  }
  return { triple, items };
}

/* The best of what came out, for the colour of the light. */
export function bestOf(ids: string[]): Rarity {
  let at = 0;
  for (const id of ids) at = Math.max(at, RARITIES.indexOf((SKIN_BY_ID[id]?.rarity ?? "common") as Exclude<Rarity, "stock">));
  return RARITIES[at];
}

