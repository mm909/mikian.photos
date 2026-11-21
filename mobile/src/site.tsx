import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { C, F } from "./theme";

/* THE SITE'S OWN PIECES, for the phone (owner, 2026-11-20: "review the
 * current site for style guides and UI/UX ... those things we have already
 * iterated on while designing the website can come over"). Each of these is
 * a piece the website settled on, redrawn natively with the same measures:
 *
 *   Eye        the section eyebrow (.pf-eye): a mono word left, a quiet word
 *              right, on a 1px ink rule. No big bold section titles.
 *   WordMenu   a word that is a menu (TextMenu.tsx): plain text on a dotted
 *              rule; a press drops the house panel, paper with a 2px ink
 *              rule, mono caps, the chosen line in the blue.
 *   Lead       the lead figure (LeadBlock.tsx): the number big and blue,
 *              the holder on the mono line under it.
 *   Table/Tr   the board table (table.board): mono figures on the warm
 *              tint, dashed rules between rows, the name in Archivo bold
 *              after its grey rower number, the viewer's row on pale blue.
 *   Dateline   the month left, the day of it right, a 2px rule, and a
 *              square for every day with the days gone filled (.bd-date).
 *   Chip       the outlined filter button, ink when it is on.
 *
 * Type sizes, letter spacing and rules are the site's (theme.ts there). */

export const mono = (size = 11, bold = false, color: string = C.ink, spacing = 0.16): TextStyle => ({ fontFamily: bold ? F.monoBold : F.mono, fontSize: size, letterSpacing: size * spacing, color, textTransform: "uppercase" });


/* A dashed rule. Drawn, not a border: a one-sided dashed border is not
 * something every phone draws. */
export function Dash({ color = C.line, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 1 }, style]}>
      <Svg width="100%" height={1}>
        <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={color} strokeWidth={1} strokeDasharray="4 3" />
      </Svg>
    </View>
  );
}

export function Eye({ left, right, style }: { left: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", columnGap: 16, rowGap: 4, borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 8, marginBottom: 14, marginTop: 44 }, style]}>
      <Text style={mono(11, true)}>{left}</Text>
      {typeof right === "string" ? <Text style={mono(11, false, C.gray)}>{right}</Text> : right}
    </View>
  );
}

/* A WORD THAT IS A MENU. The word is whatever type it is given; the panel
 * drops under it, kept inside the screen. `panel` swaps the list for
 * something of the caller's (the day calendar). */
export function WordMenu<T extends string>({
  options = [],
  value,
  onPick,
  label,
  ariaLabel,
  textStyle,
  panel,
  width = 220,
}: {
  options?: { key: T; label: string }[];
  value?: T;
  onPick?: (k: T) => void;
  label?: string;
  ariaLabel: string;
  textStyle?: StyleProp<TextStyle>;
  panel?: (close: () => void) => ReactNode;
  width?: number;
}) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const win = useWindowDimensions();
  const [at, setAt] = useState<{ x: number; y: number; h: number } | null>(null);
  const close = () => setAt(null);
  const open = () => ref.current?.measureInWindow((x: number, y: number, _w: number, h: number) => setAt({ x, y, h }));
  const word = label ?? options.find((o) => o.key === value)?.label ?? "";
  return (
    <>
      <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={`${ariaLabel}: ${word}`} accessibilityState={{ expanded: at !== null }} onPress={open} hitSlop={8}>
        <Text style={[mono(12, true), textStyle, { textDecorationLine: "underline", textDecorationStyle: "dotted" }]}>{word}</Text>
      </Pressable>
      <Modal visible={at !== null} transparent animationType="none" onRequestClose={close}>
        <Pressable accessibilityLabel="Close the menu" style={StyleSheet.absoluteFill} onPress={close}>
          {at ? (
            <Pressable
              onPress={() => {}}
              style={{ position: "absolute", left: Math.max(12, Math.min(at.x, win.width - width - 12)), top: Math.min(at.y + at.h + 8, win.height - 320), width, backgroundColor: C.paper, borderWidth: 2, borderColor: C.ink, paddingVertical: panel ? 0 : 6, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}
            >
              {panel
                ? panel(close)
                : options.map((o) => (
                    <Pressable
                      key={o.key}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: o.key === value }}
                      onPress={() => {
                        close();
                        onPick?.(o.key);
                      }}
                      style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? C.pale : "transparent" })}
                    >
                      <Text style={mono(11, true, o.key === value ? C.accent : C.ink, 0.14)}>{o.label}</Text>
                    </Pressable>
                  ))}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

/* The grey dot between two words on a mono line. */
export function Dot({ size = 12 }: { size?: number }) {
  return <Text style={[mono(size, false, C.gray), { marginHorizontal: 6 }]}>·</Text>;
}

/* THE LEAD: the figure, and who holds it. */
export function Lead({ value, unit, children, size = 56 }: { value: ReactNode; unit?: string; children?: ReactNode; size?: number }) {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        {typeof value === "string" ? (
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.05), letterSpacing: -0.5, color: C.accent, fontVariant: ["tabular-nums"], flexShrink: 1 }}>
            {value}
          </Text>
        ) : (
          value
        )}
        {unit ? <Text style={{ fontFamily: F.bold, fontSize: Math.round(size * 0.36), color: C.gray }}>{unit}</Text> : null}
      </View>
      {children ? <Text style={[mono(12, false, C.gray, 0.14), { marginTop: 10, lineHeight: 20 }]}>{children}</Text> : null}
    </View>
  );
}

/* The division word over a table. */
export function TableHead({ children }: { children: string }) {
  return <Text style={[mono(11, true), { borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, marginTop: 30 }]}>{children}</Text>;
}

/* The grey column words over a full table. */
export function Cols({ cols }: { cols: { label: string; flex?: number; width?: number; right?: boolean }[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.tint, paddingHorizontal: 6, paddingVertical: 9, borderBottomWidth: 1, borderColor: C.ink }}>
      {cols.map((c) => (
        <Text key={c.label} style={[mono(10, false, C.gray, 0.12), { flex: c.flex, width: c.width, textAlign: c.right ? "right" : "left" }]}>
          {c.label}
        </Text>
      ))}
    </View>
  );
}

/* One row of a table: the place, the grey number, the name, and what is
 * given as the figure. */
export function Tr({ place, num, name, me, you, tag, children, onPress, label }: { place: number | string | null; num: number; name: string; me?: boolean; you?: boolean; tag?: string; children: ReactNode; onPress?: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole={onPress ? "link" : undefined} accessibilityLabel={label} onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: me ? C.pale : C.tint, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 6, minHeight: 44, paddingVertical: 9 }}>
        <Text style={{ width: 34, fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums"] }}>{place ?? ""}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, fontVariant: ["tabular-nums"] }}>{String(num).padStart(3, "0")}</Text>
        <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray, marginHorizontal: 7 }}>·</Text>
        {you ? <You /> : null}
        {tag ? <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.paper, backgroundColor: C.ink, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 }}>{tag}</Text> : null}
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
          {name}
        </Text>
        {children}
      </View>
      <Dash />
    </Pressable>
  );
}

/* A figure in a table cell: mono, right, the unit after it. */
export function Fig({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"], textAlign: "right", marginLeft: 10 }}>{children}</Text>;
}

/* The YOU badge the site puts before the viewer's name. */
export function You() {
  return <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.2, color: "#fff", backgroundColor: C.accent, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 }}>YOU</Text>;
}

/* THE DATELINE: the month, the day of it, and a square a day. */
export function Dateline({ left, right, days, day }: { left: string; right: string; days?: number; day?: number }) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8 }}>
        <Text style={mono(11, true)}>{left}</Text>
        <Text style={mono(11, true)}>{right}</Text>
      </View>
      {days ? (
        <View accessibilityLabel={`Day ${day} of ${days}`} style={{ flexDirection: "row", gap: 3, marginTop: 8 }}>
          {Array.from({ length: days }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 8, borderWidth: 1, borderColor: i < (day ?? 0) ? C.ink : C.line, backgroundColor: i < (day ?? 0) ? C.ink : "transparent" }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* A filter button: outlined, ink when on. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ borderWidth: 2, borderColor: C.ink, backgroundColor: on ? C.ink : "transparent", minHeight: 40, paddingHorizontal: 14, justifyContent: "center" }}>
      <Text style={mono(12, true, on ? C.paper : C.ink, 0.08)}>{label}</Text>
    </Pressable>
  );
}

/* A text control: a word in mono caps on a rule of the blue (.bd-ctl). */
export function Ctl({ label, onPress, disabled, big }: { label: string; onPress: () => void; disabled?: boolean; big?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={10} style={({ pressed }) => ({ borderBottomWidth: 2, borderColor: C.accent, paddingBottom: 2, opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}>
      <Text style={mono(big ? 16 : 12, true, disabled ? C.gray : C.ink)}>{label}</Text>
    </Pressable>
  );
}

/* The ledger: figures in a row between two ink rules, a rule between each
 * (the profile's three cells). */
export function Ledger({ cells }: { cells: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.ink }}>
      {cells.map(([v, k], i) => (
        <View key={k} style={{ flex: 1, paddingVertical: 14, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 1 : 0, borderColor: C.ink }}>
          <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: 22, color: C.ink, fontVariant: ["tabular-nums"] }}>
            {v}
          </Text>
          <Text style={[mono(10, false, C.gray, 0.14), { marginTop: 6 }]}>{k}</Text>
        </View>
      ))}
    </View>
  );
}
