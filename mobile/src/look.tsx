import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";
import { setLook } from "./theme";

/* WHICH LOOK THIS PHONE WEARS: the cream one, or the dark one a rower has
 * switched on in SETTINGS (theme.ts has the colours and the owner's words).
 * Kept on the phone, not on the account: it is about a screen in a room.
 * Cream unless the phone says otherwise. */

const KEY = "look/1";

/* Before the first screen is drawn: put on the look this phone last chose. */
export async function loadLook(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEY).catch(() => null);
  const dark = v === "dark";
  setLook(dark);
  return dark;
}

export async function saveLook(dark: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, dark ? "dark" : "light").catch(() => null);
}

export const LookCtx = createContext<{ dark: boolean; setDark: (v: boolean) => void }>({ dark: false, setDark: () => {} });
export const useLookSwitch = () => useContext(LookCtx);
