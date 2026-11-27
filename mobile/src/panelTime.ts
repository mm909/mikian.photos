import { AppState } from "react-native";
import { api } from "./api";

/* WHICH PANEL OF THE LIVE ERG VIEW IS LOOKED AT (owner, 2026-11-26: "I also
 * need a stat for which panel user on the live erg view, which panel users
 * are spending their time on"). The seconds each panel was on screen while
 * a monitor was up, added up on the phone and sent to the site when the
 * view closes or the app goes behind another (api/row100k/app/panels).
 * Nothing waits on it, and a failed send is let go. */
let on: { panel: string; since: number } | null = null;
let held: Record<string, number> = {};

function close(): void {
  if (!on) return;
  const s = (Date.now() - on.since) / 1000;
  if (s > 0 && s < 6 * 3600) held[on.panel] = (held[on.panel] ?? 0) + s;
  on = null;
}

function send(): void {
  const panels = Object.fromEntries(Object.entries(held).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => (v as number) > 0));
  held = {};
  if (Object.keys(panels).length === 0) return;
  api("/api/row100k/app/panels", { body: { panels } }).catch(() => null);
}

/* The panel on screen now, while a monitor is up. */
export function panelOn(panel: string): void {
  if (on?.panel === panel) return;
  close();
  on = { panel, since: Date.now() };
}

/* No panel on screen (the view closed, or no monitor): what was kept goes. */
export function panelOff(): void {
  close();
  send();
}

AppState.addEventListener("change", (s) => {
  if (s === "active") {
    if (on) on.since = Date.now();
    return;
  }
  const was = on?.panel ?? null;
  close();
  send();
  if (was) on = { panel: was, since: Date.now() };
});
