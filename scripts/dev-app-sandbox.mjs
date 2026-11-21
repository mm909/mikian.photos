/* THE SITE, AS A SANDBOX FOR THE PHONE APP (2026-11-20).
 *
 *   node scripts/dev-app-sandbox.mjs        (launch.json: row-app-sandbox)
 *
 * The dev server on the DEMO namespace (the hundred sample rowers, never the
 * real board), with today's real date instead of the demo's fixed September
 * day, and with mail switched off, so a row logged from the app while it is
 * being built lands nowhere real and writes to nobody. Point the app at it
 * with EXPO_PUBLIC_API in mobile/.env.local.
 *
 *   node scripts/dev-app-sandbox.mjs --local
 *
 * The same, on the LOCAL database (scripts/dev-app-db.mjs) instead of the
 * sample namespace inside the live one. Needed while the branch carries
 * tables the live database does not have yet; and nothing written there
 * can reach anything real.
 *
 * To read the REAL board from the app, run `npm run dev:live` instead and
 * do not log rows: that server writes to the live challenge. */
import { spawn } from "node:child_process";
import { LOCAL_ENV } from "./dev-app-db.mjs";

const local = process.argv.includes("--local");

const env = {
  ...process.env,
  NEXT_PUBLIC_ROW100K_DEMO: "1",
  NEXT_PUBLIC_ROW100K_NOW: new Date().toISOString(),
  /* Set but empty: Next does not overwrite a variable that is already
   * defined, so .env.local's key is not loaded and email.ts logs instead. */
  RESEND_API_KEY: "",
  ...(local ? LOCAL_ENV : {}),
};

const child = spawn("npx", ["next", "dev", ...process.argv.slice(2).filter((a) => a !== "--local")], { stdio: "inherit", env, shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
