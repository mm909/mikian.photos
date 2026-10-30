/* Renders a link card from one of the og-*.html files next to this script
 * with the pre-installed Chromium (Playwright) and writes the PNG:
 *   node scripts/og-render.mjs og-rowvember.html public/row100k/og-rowvember.png
 * The page needs fonts.googleapis.com reachable; playwright is not a
 * dependency of the site, so point NODE_PATH at an install that has it
 * (NODE_PATH=/opt/node-tools/node_modules on the cloud box). */
import { chromium } from "playwright";
import { resolve } from "node:path";
const [, , html = "og-rowvember.html", out = "public/row100k/og-rowvember.png"] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + resolve("scripts", html));
await page.waitForFunction(() => document.title === "done", null, { timeout: 30_000 });
await page.locator("canvas").screenshot({ path: resolve(out) });
await browser.close();
console.log("wrote", out);
