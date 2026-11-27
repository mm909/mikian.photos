import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/* THE LITTLE BUZZ UNDER THE THUMB (owner, 2026-11-23: "let's build whatever
 * we need for the little buzz. I also want that little buzz whenever we swap
 * screens, just like Instagram does it. Whenever we go to like home, to
 * search, to stats ... I also want a little ding whenever I like a post").
 *
 * Three of them, the phone's own:
 *   tick  the one a picker makes: a tab changed.
 *   tap   a light knock: a like, a photo turned about.
 *   thud  a firmer one: a held row came forward.
 *
 * The part of the phone that makes them is in the build from 1.3.0 on. A
 * build before that has none, and every one of these is then nothing at
 * all: the package finds no module and the call is let fall. Nothing in a
 * browser. */
const run = (f: () => Promise<void>): void => {
  if (Platform.OS === "web") return;
  try {
    f().catch(() => undefined);
  } catch {
    /* No such module in this build. */
  }
};

export const buzz = {
  tick: () => run(() => Haptics.selectionAsync()),
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  thud: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /* THE APPLE PASS (owner, 2026-11-25: "app only, keep the look"): the
   * phone's own "done" when a row is saved, and a knock as the rower passes
   * a boat on the race page. */
  done: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};

/* A KNOCK AS A PULL DOWN REFRESHES (owner, 2026-11-26: "Give a little
 * haptic feedback when we pull down to refresh"): wraps a RefreshControl's
 * onRefresh. */
export const pulled = (f: () => void) => () => {
  buzz.tap();
  f();
};
