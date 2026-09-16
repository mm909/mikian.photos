import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { LOOK_COOKIE, parseLook, siteSettings, type Look } from "@/lib/rowSettings";
import { archivo, archivoBlack, spaceMono, css } from "../theme";
import { RowBar } from "../RowBar";
import { RowFooter } from "../RowFooter";
import { LookSwitch } from "./LookSwitch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The look — 100K September",
  robots: { index: false, follow: false },
};

/* Page-local styles — .lk- prefix, theme.ts untouched. Rendered as the
 * text child of a style tag, so no double quotes, no angle brackets and
 * no apostrophes anywhere in the string (the note in theme.ts). Every
 * colour is a variable, so the page reads the same in both looks. */
const lkCss = `
.row100k .lk-lede{font-size:15px;color:var(--ink-soft);max-width:60ch;margin-bottom:6px;line-height:1.6}
.row100k .lk-note{font-size:11px;letter-spacing:.12em;color:var(--gray);text-transform:uppercase;line-height:1.7;margin:0 0 12px}
.row100k .lk-panel .tabs{margin:0 0 12px}
.row100k .lk-panel + .lk-panel{margin-top:22px}
`;

/* Admin-only: the paper-or-ink switch (owner, 2026-09-16: the blackout
 * starts the 20th, let us see what the whole site looks like in a white on
 * black colour scheme). Two switches — a preview on this browser, and the
 * site for everyone (src/lib/rowSettings.ts). The rest of the world gets a
 * 404, the same gate as /row100k/blackout.
 * Ink is FULLY MONOCHROME since later that day (owner: we will stick with
 * the paper look for now — work on a fully mono chrome UI, keep the ui
 * colors the same, and give me the admin switch to see it on my side
 * still): black, white and greys, no blue; the preview switch is that
 * admin side. */
export default async function LookPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isRow100kAdmin(actor.email, actor.roles)) notFound();

  // Fails open to paper if the RowSetting table is not there yet; a save
  // from the switch below is what says so.
  const settings = await siteSettings();

  let preview: Look | null = null;
  try {
    preview = parseLook(cookies().get(LOOK_COOKIE)?.value);
  } catch {
    preview = null;
  }

  return (
    <div className={`row100k ${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable}`}>
      <style>{css}</style>
      <style>{lkCss}</style>
      <RowBar />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <h2>The look</h2>
            <span className="mono">{settings.look === "ink" ? "INK — MONOCHROME" : "PAPER"}</span>
          </div>

          <p className="lk-lede">
            The blackout starts Sep 20, and race week can go ink — white on black, the whole site
            and the front door. The ink look is monochrome: black, white and greys only, no blue.
            Paper keeps its colours. The preview only changes this browser; the site switch
            changes it for everyone on their next page load.
          </p>

          <LookSwitch preview={preview} site={settings.look} />
        </div>
      </section>

      <RowFooter />
    </div>
  );
}
