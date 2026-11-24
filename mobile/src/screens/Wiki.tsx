import { useEffect, useState } from "react";
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
  { word: "Built, to tune", ids: ["arcade", "g159", "loot"] },
  { word: "Next: the arcade's world", ids: ["look", "home", "show", "match", "ratings"] },
  { word: "Then", ids: ["small", "freethrow", "planner"] },
  { word: "Later", ids: ["crawler", "posters", "together", "duel"] },
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

/* ---- the drawings ------------------------------------------------------ */

/* WHAT IF I ROW A 2:30 (owner, 2026-11-24: "a useful thing on these charts
 * whenever you show them in the wiki, is going to be a tool where I can
 * change what if I'm rowing at a 2:30? How does that change things"). One
 * pace for every drawing in the wiki, kept while the app is open; the
 * seconds stay, the meters move. */
const PACES = [105, 120, 135, 150];
let pace0 = 120;
const hear = new Set<(p: number) => void>();
function usePace(): [number, (p: number) => void] {
  const [p, setP] = useState(pace0);
  useEffect(() => {
    hear.add(setP);
    return () => {
      hear.delete(setP);
    };
  }, []);
  return [
    p,
    (v: number) => {
      pace0 = v;
      hear.forEach((f) => f(v));
    },
  ];
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function Drawing({ kind }: { kind: "minute" | "program" | "show" | "match" }) {
  const [w, setW] = useState(0);
  const [pace, setPace] = usePace();
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ marginTop: 16 }}>
      {kind !== "program" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Text style={mono(10, false, C.gray, 0.1)}>Rowing at</Text>
          {PACES.map((p) => (
            <Pressable key={p} accessibilityRole="button" accessibilityLabel={`At ${clock(p)} a 500`} onPress={() => setPace(p)} hitSlop={4} style={{ paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.ink, borderRadius: 6, backgroundColor: p === pace ? C.ink : "transparent" }}>
              <Text style={mono(11, true, p === pace ? C.paper : C.ink, 0.06)}>{clock(p)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {w > 0 ? kind === "minute" ? <Minute w={w} pace={pace} /> : kind === "show" ? <Show w={w} pace={pace} /> : kind === "match" ? <Match w={w} pace={pace} /> : <Program w={w} /> : null}
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
function Minute({ w, pace }: { w: number; pace: number }) {
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
            {Math.round(((k * 12) / pace) * 500)} m
          </SvgText>
        ))}
        <Line x1={0} x2={w} y1={top + bar + 26} y2={top + bar + 26} stroke={C.line} strokeWidth={1} />
      </Svg>
      <Key items={parts.map(([, , c, word]) => [c, word])} />
      <Text style={[mono(10, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>Seconds above, meters below, at {clock(pace)} a 500.</Text>
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

/* A BAR OF STRETCHES along the seconds, with the clock above and the
 * meters at the chosen pace under it, and moments marked over it. */
type Seg = [number, number, string, string];
function Timeline({ w, pace, from, to, segs, marks, tickS, meterTicks, foot }: { w: number; pace: number; from: number; to: number; segs: Seg[]; marks: [number, string][]; tickS: number; meterTicks: number[]; foot: string }) {
  const H = 120;
  const top = 34;
  const bar = 36;
  const x = (s: number) => ((Math.max(from, Math.min(to, s)) - from) / (to - from)) * w;
  const at = (s: number) => Math.min(w - 2, Math.max(2, x(s)));
  const anchor = (s: number) => (x(s) < 20 ? "start" : x(s) > w - 20 ? "end" : "middle");
  const ticks: number[] = [];
  for (let s = Math.ceil(from / tickS) * tickS; s <= to + 0.01; s += tickS) ticks.push(s);
  const seen = new Map<string, string>();
  segs.forEach(([, , c, word]) => seen.set(word, c));
  return (
    <View>
      <Svg width={w} height={H}>
        {marks.map(([s, word], i) => (
          <SvgText key={`k${i}`} x={at(s)} y={10 + (i % 2) * 12} fontSize={9} fill={C.accent} fontFamily={F.monoBold} textAnchor={anchor(s)}>
            {word}
          </SvgText>
        ))}
        {marks.map(([s], i) => (
          <Line key={`l${i}`} x1={x(s)} x2={x(s)} y1={14 + (i % 2) * 12} y2={top + bar} stroke={C.accent} strokeWidth={1.5} />
        ))}
        {segs.map(([a, b, color], i) => (b > a ? <Rect key={i} x={x(a)} y={top} width={Math.max(0.5, x(b) - x(a))} height={bar} fill={color} stroke={C.ink} strokeWidth={0.75} /> : null))}
        {ticks.map((s) => (
          <SvgText key={`t${s}`} x={at(s)} y={top + bar + 15} fontSize={9} fill={C.gray} fontFamily={F.mono} textAnchor={anchor(s)}>
            {s < 0 ? `−${clock(-s)}` : clock(s)}
          </SvgText>
        ))}
        <Line x1={0} x2={w} y1={top + bar + 23} y2={top + bar + 23} stroke={C.line} strokeWidth={1} />
        {meterTicks.map((m) => {
          const s = (m / 500) * pace;
          return s >= from && s <= to + 0.01 ? (
            <SvgText key={`m${m}`} x={at(s)} y={top + bar + 37} fontSize={9} fill={C.gray} fontFamily={F.mono} textAnchor={anchor(s)}>
              {m >= 1000 && m % 1000 === 0 ? `${m / 1000}K` : `${m} m`}
            </SvgText>
          ) : null;
        })}
      </Svg>
      <Key items={[...seen.entries()].map(([word, c]) => [c, word])} />
      <Text style={[mono(10, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>{foot}</Text>
    </View>
  );
}

/* A 5K AS A SHOW, by the clock (owner, 2026-11-24: "we really have to key
 * off of time and not meters"): the intro, home while matchmaking looks,
 * the lobby together with the ready check at its end, a match until
 * somebody is out, the celebration, home again; no new game past 4,000 m;
 * the level up at 4,500, the finish line, the chest at 5,000. Two matches
 * drawn as an example. */
function Show({ w, pace }: { w: number; pace: number }) {
  const T = 10 * pace;
  const t4000 = 8 * pace;
  const t4500 = 9 * pace;
  const segs: Seg[] = [];
  const HOME = C.pale;
  const put = (a: number, b: number, c: string, word: string) => {
    const end = Math.min(b, t4500);
    if (end > a) segs.push([a, end, c, word]);
  };
  put(0, 60, C.ink, "Intro");
  put(60, 120, HOME, "Home, matchmaking");
  let t = 120;
  for (let k = 0; k < 2; k++) {
    if (t + 60 >= t4000) break;
    put(t, t + 48, C.accentLight, "Lobby together");
    put(t + 48, t + 60, YELLOW, "Ready check");
    const end = Math.min(t + 60 + 240, t4000);
    put(t + 60, end, C.accent, "159, the match");
    put(end, end + 12, C.good, "Celebration");
    t = end + 12;
    const back = t + 120;
    put(t, back, HOME, "Home, matchmaking");
    t = back;
  }
  put(t, t4500, HOME, "Home, matchmaking");
  segs.push([t4500, t4500 + 12, "#D98E04", "Level up"]);
  segs.push([t4500 + 12, T, C.soft, "Finish line"]);
  return <Timeline w={w} pace={pace} from={0} to={T} segs={segs} marks={[[t4000, "NO NEW GAME"], [t4500, "LEVEL UP"], [T, "CHEST"]]} tickS={300} meterTicks={[1000, 2000, 3000, 4000, 5000]} foot={`A 5K at ${clock(pace)} takes ${clock(T)}. The clock runs the show; the end is fixed in meters. Two matches of 4 minutes drawn as an example.`} />;
}

/* ONE MATCH OF 159 (owner, 2026-11-24): the ready check from 12 seconds
 * before, then every gun cools for 3 seconds and aims for 3, over and
 * over, firing at the end of each aim, until somebody is out of lives;
 * then 12 seconds of celebration. */
function Match({ w, pace }: { w: number; pace: number }) {
  const segs: Seg[] = [[-12, 0, YELLOW, "Ready check"]];
  const marks: [number, string][] = [];
  for (let s = 0; s < 36; s += 6) {
    segs.push([s, s + 3, C.pale, "Cooldown"]);
    segs.push([s + 3, s + 6, C.accent, "Aim: hold your pace"]);
  }
  marks.push([6, "FIRE"], [12, "FIRE"]);
  segs.push([36, 48, C.good, "Celebration"]);
  marks.push([36, "SOMEBODY IS OUT"]);
  return <Timeline w={w} pace={pace} from={-12} to={48} segs={segs} marks={marks} tickS={12} meterTicks={[0, 50, 100, 150, 200]} foot={`Every 6 seconds a shot: about ${Math.round((6 / pace) * 500)} m at ${clock(pace)}. Drawn ending at 36 s; a real match goes on until somebody is out.`} />;
}
