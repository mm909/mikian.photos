/* NEW CODE WITHOUT A NEW BUILD (owner, 2026-11-21, asked whether every
 * change needs `eas build` again: "lets do this").
 *
 * The installed app asks Expo for a newer bundle as it opens. One that
 * arrives in the first few seconds is put on at once; a slower one waits
 * for the next open, so a rower is never thrown out of a screen they have
 * started using. The web build has nothing to do here: it is served fresh
 * by the site. A development build skips it too. Any failure is silent;
 * the app carries on with the code it has. */
import * as Updates from "expo-updates";
import { Platform } from "react-native";

const SOON_MS = 6000;

export async function freshen(): Promise<void> {
  if (Platform.OS === "web" || __DEV__ || !Updates.isEnabled) return;
  const began = Date.now();
  try {
    const found = await Updates.checkForUpdateAsync();
    if (!found.isAvailable) return;
    await Updates.fetchUpdateAsync();
    if (Date.now() - began < SOON_MS) await Updates.reloadAsync();
  } catch {
    /* offline, or Expo did not answer: next open tries again */
  }
}
