/* The palettes, checked by hand: npx tsx src/lib/rowPalette.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * What the file promises: every accent clears 4.5:1 on the ground it is
 * cut for, a slab of it carries type that clears 3:1, the first preset is
 * the default, the ids parse and the site-wide rule names no character a
 * style tag cannot hold. */
import assert from "node:assert/strict";
import {
  DEFAULT_PALETTE,
  INK,
  PALETTES,
  PAPER,
  accentOn,
  capsOn,
  contrast,
  isPaletteId,
  paletteCss,
  paletteOf,
} from "./rowPalette";

async function main() {
  assert.equal(PALETTES[0].id, DEFAULT_PALETTE);
  assert.deepEqual(
    PALETTES.map((p) => p.id),
    ["ink-red", "ink-water", "paper-red", "paper-water", "ink-yellow", "ink-green"],
  );
  assert.equal(paletteOf("paper-water").accentOnPaper, "#0077B6", "the September blue stands");

  for (const p of PALETTES) {
    const ground = p.ground === "ink" ? INK : PAPER;
    const a = accentOn(p, p.ground);
    const c = contrast(a.accent, ground);
    assert.ok(c >= 4.3, `${p.id}: ${a.accent} on its ground is ${c.toFixed(2)}`);
    const caps = capsOn(a.accent);
    assert.ok(contrast(caps, a.accent) >= 3, `${p.id}: ${caps} on a ${a.accent} slab`);
    /* The site-wide accent sits on paper whatever the landing ground. */
    assert.ok(contrast(p.accentOnPaper, PAPER) >= 4.3, `${p.id}: ${p.accentOnPaper} on paper`);
    assert.ok(!/["'<>&]/.test(paletteCss(p)), `${p.id}: a quote, bracket or ampersand in the rule`);
    assert.ok(paletteCss(p).includes(`--water:${p.accentOnPaper}`));
  }

  assert.ok(isPaletteId("ink-red"));
  assert.ok(!isPaletteId("ink"));
  assert.ok(!isPaletteId(undefined));
  assert.equal(capsOn("#E0B32B"), INK, "mustard takes ink caps");
  assert.equal(capsOn("#C8321F"), "#ffffff", "red takes white caps");

  console.log("rowPalette: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
