/* ANDROID'S OWN BARS (owner, 2026-11-23: "def start making an android build
 * of the app"). An Android phone draws the app from edge to edge, under its
 * status bar at the top and its navigation bar at the foot, and the
 * react-native SafeAreaView that keeps an iPhone clear does nothing there.
 * This pads the app by the sizes the phone itself reports, so the header
 * clears the clock and the tab bar clears the back and home bar.
 *
 * Android only, and loaded only there (App.tsx): the iPhone builds out in
 * the world (1.2.0, 1.3.0) were made before this module was in the app, so
 * an update over the air must never reach for it on an iPhone. */
import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

function Pad({ color, children }: { color: string; children: ReactNode }) {
  const i = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: color, paddingTop: i.top, paddingBottom: i.bottom, paddingLeft: i.left, paddingRight: i.right }}>{children}</View>;
}

export default function Insets({ color, children }: { color: string; children: ReactNode }) {
  return (
    <SafeAreaProvider>
      <Pad color={color}>{children}</Pad>
    </SafeAreaProvider>
  );
}
