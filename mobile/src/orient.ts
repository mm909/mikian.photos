import { Platform } from "react-native";

/* UPRIGHT, EXCEPT THE LIVE ROW (owner, 2026-11-24, of the feed and the
 * profile drawn on their side: "The profile view is trying to be rendered
 * horizontally when it shouldn't be able to be viewed horizontally"). The
 * app is held upright everywhere; the phone may turn only while the
 * monitor's live pages are the screen in front (Monitor in RowScreen.tsx,
 * and `monitor` in App.tsx). The form that follows a row, the feed with a
 * row still going under the ROWING strip, every other page: upright.
 *
 * Since 1.4.0 (expo-screen-orientation is native code, so it came with a
 * build; app.json also starts the app upright before any of this runs). A
 * build without the module, or the web, has nothing to lock and is left as
 * it is. */

type Lock = { lockAsync(o: number): Promise<void>; unlockAsync(): Promise<void>; OrientationLock: { PORTRAIT_UP: number } };
let mod: Lock | null = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-screen-orientation") as Lock;
  } catch {
    mod = null;
  }
}

let mounted = 0;
let shown = false;
let last: boolean | null = null;
let queued = false;

/* Said once the changes of one moment are in (a scrubbed demo draws its
 * monitor again: off, then on, in the same instant). */
function apply() {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    const free = mounted > 0 && shown;
    if (free === last || !mod) return;
    last = free;
    (free ? mod.unlockAsync() : mod.lockAsync(mod.OrientationLock.PORTRAIT_UP)).catch(() => null);
  }, 0);
}

/* The monitor's live pages are drawn (each one says so while it lives). */
export function monitorMounted(): () => void {
  mounted++;
  apply();
  return () => {
    mounted = Math.max(0, mounted - 1);
    apply();
  };
}

/* The log screen with a row on it is the screen in front (App.tsx). */
export function monitorShown(on: boolean): void {
  shown = on;
  apply();
}

