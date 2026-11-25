/* NOTIFICATIONS ON THE PHONE ITSELF (owner, 2026-11-21: "I'd rather a push
 * notification. So can we test push notifications?"). Once somebody is
 * signed in as a rower, the phone is asked, once, whether ROW may notify;
 * on a yes it is given an Expo push token and the site is told
 * (api/row100k/app/push), so every line the notification centre gets
 * (lib/rowNotify.ts on the site) also arrives on the lock screen.
 *
 * Only a real phone with the build that carries expo-notifications: a
 * browser and a simulator have no token to give. Any failure is silent:
 * the lines are still in the app's own notification centre. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

let asked = false;

/* A notification that lands while the app is open still shows its banner. */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

/* A TAP ON A NOTIFICATION: `cb` gets its data, for a tap while the app
 * runs and for the one that opened it. The owner's M2D line carries
 * { kind: "m2d" } and opens the M2D tab (App.tsx). */
const TAPPED = "row.push.tapped";
export function onPushTap(cb: (data: Record<string, unknown>) => void): () => void {
  if (Platform.OS === "web") return () => undefined;
  /* Each tap is acted on once: the last response is kept by the system
   * and would otherwise open the same row on every launch after. */
  const once = async (r: Notifications.NotificationResponse) => {
    const id = `${r.notification.request.identifier}:${r.actionIdentifier}`;
    const was = await AsyncStorage.getItem(TAPPED).catch(() => null);
    if (was === id) return;
    await AsyncStorage.setItem(TAPPED, id).catch(() => null);
    cb((r.notification.request.content.data ?? {}) as Record<string, unknown>);
  };
  const sub = Notifications.addNotificationResponseReceivedListener((r) => void once(r));
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (r) void once(r);
    })
    .catch(() => null);
  return () => sub.remove();
}

export async function registerPush(): Promise<void> {
  if (Platform.OS === "web" || asked) return;
  asked = true;
  try {
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api("/api/row100k/app/push", { body: { token, platform: Platform.OS === "android" ? "android" : "ios" } });
  } catch {
    /* No token (a simulator, no network, the phone said no): nothing to do. */
  }
}
