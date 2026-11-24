import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { Eye, mono } from "../site";
import { C, F } from "../theme";
import { PAGES, pageOf, type Block } from "../wiki/pages";

/* THE WIKI, behind a line on the owner's own settings (owner, 2026-11-24:
 * "give me it in the app just for me ... put it in the settings page. Let
 * me access it on the settings page, and then it can bring me to the
 * wiki"). The words are in wiki/pages.ts; this draws them.
 *
 * THE INDEX is the order of the work, in four stretches: now, being built,
 * next, later; then the background. A page is its words, its lists, and
 * the two drawings he asked for ("I really want a line chart of the minute
 * ... on these 250 games"; "we have 20 units of programming, and I need
 * them like filled out"). */

const GROUPS: { word: string; ids: string[] }[] = [
  { word: "Now", ids: ["start", "today", "order"] },
  { word: "Being built", ids: ["arcade", "g159", "loot"] },
  { word: "Next", ids: ["small", "freethrow", "planner"] },
  { word: "Later", ids: ["duel", "crawler", "posters", "together"] },
  { word: "Background", ids: ["business", "research"] },
];

export function WikiScreen({ id, onPage }: { id?: string; onPage: (id: string) => void }) {
  const page = id ? pageOf(id) : undefined;
  if (!page) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 140 }}>
        {GROUPS.map((g) => (
          <View key={g.word}>
            <Eye left={g.word} style={{ marginTop: 30, marginBottom: 0 }} />
            {g.ids.map((pid) => {
              const p = pageOf(pid);
              return p ? <Row key={pid} title={p.title} sub={p.sub} onPress={() => onPage(pid)} /> : null;
            })}
          </View>
        ))}
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: C.gray, marginTop: 22 }}>Only you can see this. {PAGES.length} pages, written from your notes of Nov 24.</Text>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 140 }}>
      <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink }}>{page.title}</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.gray, marginTop: 4, marginBottom: 6 }}>{page.sub}</Text>
      {page.blocks.map((b, i) => (
        <Piece key={i} b={b} onPage={onPage} />
      ))}
    </ScrollView>
  );
}

function Row({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 60, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>{title}</Text>
        <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.gray, marginTop: 3 }}>{sub}</Text>
      </View>
      <Text style={{ fontFamily: F.black, fontSize: 16, color: C.gray }}>→</Text>
    </Pressable>
  );
}

const body = { fontFamily: F.sans, fontSize: 16, lineHeight: 23, color: C.ink } as const;

function Piece({ b, onPage }: { b: Block; onPage: (id: string) => void }) {
  if ("h" in b) return <Eye left={b.h} style={{ marginTop: 28, marginBottom: 10 }} />;
  if ("p" in b) return <Text style={[body, { marginTop: 10 }]}>{b.p}</Text>;
  if ("quote" in b)
    return (
      <View style={{ borderLeftWidth: 3, borderColor: C.accent, paddingLeft: 14, marginTop: 16 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 19, lineHeight: 26, color: C.ink }}>{b.quote}</Text>
      </View>
    );
  if ("list" in b || "steps" in b) {
    const items = "list" in b ? b.list : b.steps;
    return (
      <View style={{ marginTop: 10 }}>
        {items.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
            <Text style={{ fontFamily: F.black, fontSize: 16, lineHeight: 23, color: C.accent, width: "steps" in b ? 24 : 12 }}>{"steps" in b ? i + 1 : "·"}</Text>
            <Text style={[body, { flex: 1 }]}>{t}</Text>
          </View>
        ))}
      </View>
    );
  }
  if ("link" in b) {
    const p = pageOf(b.link);
    return p ? (
      <Pressable accessibilityRole="link" onPress={() => onPage(b.link)} hitSlop={6} style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.5 : 1 })}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.accent }}>{b.label ?? p.title} →</Text>
      </Pressable>
    ) : null;
  }
  return <Drawing kind={b.draw} />;
}

/* ---- the two drawings -------------------------------------------------- */

function Drawing({ kind }: { kind: "minute" | "program" }) {
  const [w, setW] = useState(0);
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ marginTop: 16 }}>
      {w > 0 ? (kind === "minute" ? <Minute w={w} /> : <Program w={w} />) : null}
    </View>
  );
}

const YELLOW = "#F2C230";

function Key({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, marginTop: 10 }}>
      {items.map(([color, word]) => (
        <View key={word} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 12, height: 12, backgroundColor: color, borderWidth: 1, borderColor: C.ink }} />
          <Text style={mono(10, false, C.gray, 0.08)}>{word}</Text>
        </View>
      ))}
    </View>
  );
}

/* ONE 250 m GAME AS A MINUTE: the title card, the game, the chest, the
 * rest, along the seconds; and over it, the pace the game asks you to
 * hold: free, then locked flat, then free again. */
function Minute({ w }: { w: number }) {
  const H = 112;
  const top = 30;
  const bar = 34;
  const x = (s: number) => (s / 60) * w;
  const parts: [number, number, string, string][] = [
    [0, 5, C.ink, "Title"],
    [5, 35, C.accent, "The game"],
    [35, 40, YELLOW, "Chest"],
    [40, 60, C.pale, "Rest"],
  ];
  /* The pace line: wanders, is held flat while the game runs, wanders. */
  const wander = (s: number) => top - 18 + Math.sin(s * 1.7) * 5 + Math.sin(s * 0.6) * 3;
  const pts: string[] = [];
  for (let s = 0; s <= 60; s += 0.5) pts.push(`${x(s).toFixed(1)},${(s >= 5 && s <= 35 ? top - 18 : wander(s)).toFixed(1)}`);
  return (
    <View>
      <Svg width={w} height={H}>
        <SvgText x={0} y={8} fontSize={9} fill={C.gray} fontFamily={F.mono}>
          PACE
        </SvgText>
        <Rect x={x(5)} y={top - 24} width={x(30)} height={12} fill={C.accentLight} opacity={0.25} />
        {pts.slice(1).map((p, i) => {
          const [x1, y1] = pts[i].split(",").map(Number);
          const [x2, y2] = p.split(",").map(Number);
          return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.ink} strokeWidth={2} />;
        })}
        {parts.map(([a, b, color]) => (
          <Rect key={a} x={x(a)} y={top} width={x(b - a)} height={bar} fill={color} stroke={C.ink} strokeWidth={1} />
        ))}
        <SvgText x={x(20)} y={top + bar / 2 + 4} fontSize={12} fill="#FFFFFF" fontFamily={F.monoBold} textAnchor="middle">
          HOLD THE PACE
        </SvgText>
        {[0, 5, 35, 40, 60].map((s) => (
          <SvgText key={s} x={Math.min(w - 2, Math.max(2, x(s)))} y={top + bar + 16} fontSize={10} fill={C.gray} fontFamily={F.mono} textAnchor={s === 0 ? "start" : s === 60 ? "end" : "middle"}>
            {s} s
          </SvgText>
        ))}
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <SvgText key={k} x={Math.min(w - 2, Math.max(2, x(k * 12)))} y={top + bar + 40} fontSize={9} fill={C.gray} fontFamily={F.mono} textAnchor={k === 0 ? "start" : k === 5 ? "end" : "middle"}>
            {k * 50} m
          </SvgText>
        ))}
        <Line x1={0} x2={w} y1={top + bar + 26} y2={top + bar + 26} stroke={C.line} strokeWidth={1} />
      </Svg>
      <Key items={parts.map(([, , c, word]) => [c, word])} />
      <Text style={[mono(10, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>Seconds above, meters below, at 1:59 a 500.</Text>
    </View>
  );
}

/* A 5K AS TWENTY BLOCKS of 250 m, one example of how the director could
 * fill them. */
const BLOCKS: string[] = ["intro", "race", "game", "rest", "duel", "duel", "duel", "duel", "duel", "duel", "half", "race", "game", "rest", "game", "rest", "curve", "race", "finish", "finish"];
function Program({ w }: { w: number }) {
  const kinds: Record<string, [string, string]> = {
    intro: [C.ink, "Intro"],
    race: [C.pale, "The race"],
    game: [C.accent, "A 250 game"],
    duel: [C.accentLight, "The Duel"],
    rest: ["transparent", "Rest"],
    half: [C.gray, "Half way"],
    curve: [C.soft, "The curves"],
    finish: [YELLOW, "Finish line"],
  };
  const gap = 2;
  const cell = (w - gap * 19 - 4) / 20;
  const H = 120;
  return (
    <View>
      <Svg width={w} height={H}>
        {BLOCKS.map((k, i) => (
          <Rect key={i} x={i * (cell + gap)} y={10} width={cell} height={56} fill={kinds[k][0]} stroke={C.ink} strokeWidth={1} />
        ))}
        {BLOCKS.map((_, i) => (
          <SvgText key={`n${i}`} x={i * (cell + gap) + cell / 2} y={82} fontSize={8} fill={C.gray} fontFamily={F.mono} textAnchor="middle">
            {i + 1}
          </SvgText>
        ))}
        {[0, 1000, 2000, 3000, 4000, 5000].map((m) => {
          const xx = Math.min(w - 2, Math.max(2, (m / 250) * (cell + gap) - (m === 5000 ? gap : 0)));
          return (
            <SvgText key={m} x={xx} y={102} fontSize={9} fill={C.gray} fontFamily={F.mono} textAnchor={m === 0 ? "start" : m === 5000 ? "end" : "middle"}>
              {m === 0 ? "0" : `${m / 1000}K`}
            </SvgText>
          );
        })}
        <SvgText x={w - 2} y={117} fontSize={9} fill={C.accent} fontFamily={F.monoBold} textAnchor="end">
          LEVEL UP · CHEST · CREDITS
        </SvgText>
      </Svg>
      <Key items={Object.values(kinds).map(([c, word]) => [c === "transparent" ? C.paper : c, word])} />
      <Text style={[mono(10, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>Twenty blocks of 250 m, about a minute each at 1:59. An example, not a rule.</Text>
    </View>
  );
}
