import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { C, F } from "../theme";
import { TOKEN_U, TokenArt } from "./Token";
import { LAYER_WORD, RARITY_COLOR, RARITY_WORD, SKIN_BY_ID, STOCK, bestOf, wear, type Chest } from "./skins";

/* THE CHEST (owner, 2026-11-24: at the end of every game "a treasure chest
 * drops and opens ... one item, or sometimes it bursts with rainbow light
 * and gives three", as Vampire Survivors opens one). About five seconds of
 * the wall, whatever the row is doing:
 *   0.0  it drops in from the top and bounces;
 *   0.7  it shakes, a light growing round it in the colour of the best
 *        thing inside;
 *   1.7  the lid flies open and the light comes out in rays, every colour
 *        when there are three;
 *   2.1  what was in it rises out: one card, or three side by side, each
 *        the item worn by the plain piece (Token.tsx), its name, and its
 *        rarity in its colour. */

const WOOD = "#9A6532";
const WOOD_DARK = "#6E4420";
const BAND = "#D9A21B";
const RAINBOW = ["#E8443A", "#F28C28", "#F5C935", "#4CB963", "#3A8FD8", "#7B54C9"];

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
/* A drop that bounces twice on landing. */
const bounce = (x: number): number => {
  const v = clamp(x);
  if (v < 0.6) return (v / 0.6) ** 2;
  if (v < 0.85) return 1 - 0.12 * Math.sin(((v - 0.6) / 0.25) * Math.PI);
  return 1 - 0.04 * Math.sin(((v - 0.85) / 0.15) * Math.PI);
};

export function ChestOpen({ chest, at, t, width, height, won, note }: { chest: Chest; /* When it began to drop, by the wall. */ at: number; t: number; width: number; height: number; won: boolean; /* The line under CHEST, in place of how the game went. */ note?: string }) {
  const e = t - at;
  const best = bestOf(chest.items);
  const glow = RARITY_COLOR[best];
  const open = e >= 1.7;
  const big = width >= 520;
  /* Where the chest sits, and how big. */
  const cw = Math.min(width * (big ? 0.34 : 0.56), height * 0.5);
  const ch = cw * 0.78;
  const cx = width / 2;
  const restY = height * (open ? 0.68 : 0.5) - ch / 2;
  const y = -ch + (restY + ch) * bounce(e / 0.7);
  const shake = e > 0.7 && e < 1.7 ? Math.sin(e * 40) * (3 + 6 * (e - 0.7)) : 0;
  /* Open: the lid is thrown up off the box and tips back. */
  const lid = open ? clamp((e - 1.7) / 0.25) : 0;
  const light = clamp((e - 0.7) / 1);
  const rays = chest.triple ? RAINBOW : [glow, glow, glow, glow, glow, glow];
  const head = chest.triple ? "TRIPLE CHEST" : "CHEST";
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* The light, behind everything: a glow while it shakes, rays once
            it is open, turning. */}
        <Circle cx={cx} cy={restY + ch / 2} r={cw * (0.5 + 0.5 * light)} fill={glow} fillOpacity={open ? 0.16 : 0.22 * light} />
        {open
          ? Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + (e - 1.7) * 0.6;
              const len = Math.max(width, height);
              const k = clamp((e - 1.7) / 0.35);
              const w = 0.11;
              const ox = cx;
              const oy = restY + ch * 0.35;
              return <Path key={i} d={`M${ox} ${oy} L${ox + Math.cos(a - w) * len * k} ${oy + Math.sin(a - w) * len * k} L${ox + Math.cos(a + w) * len * k} ${oy + Math.sin(a + w) * len * k}Z`} fill={rays[i % rays.length]} fillOpacity={chest.triple ? 0.5 : 0.3} />;
            })
          : null}
        <G x={cx - cw / 2 + shake} y={y}>
          <ChestArt w={cw} h={ch} lid={lid} />
        </G>
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, top: 10, alignItems: "center" }}>
        <Text style={{ fontFamily: F.black, fontSize: big ? 34 : 30, letterSpacing: 1, color: chest.triple ? RAINBOW[Math.floor(e * 6) % 6] : C.ink }}>{head}</Text>
        <Text style={{ fontFamily: F.monoBold, fontSize: 13, letterSpacing: 2, color: C.soft }}>{note ?? (won ? "FIELD CLEAR" : "WIPED OUT · A CHEST ANYWAY")}</Text>
      </View>
      {e >= 2.1 ? <Items ids={chest.items} e={e - 2.1} width={width} height={height} /> : null}
    </View>
  );
}

/* What came out, rising over the chest. */
function Items({ ids, e, width, height }: { ids: string[]; e: number; width: number; height: number }) {
  const n = ids.length;
  const gap = 10;
  const cardW = Math.min(n === 1 ? 260 : 180, (width - 24 - gap * (n - 1)) / n);
  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: height * 0.15, flexDirection: "row", justifyContent: "center", columnGap: gap }}>
      {ids.map((id, i) => {
        const k = clamp((e - i * 0.25) / 0.45);
        const s = SKIN_BY_ID[id];
        if (!s) return null;
        const c = RARITY_COLOR[s.rarity];
        return (
          <View key={id} style={{ width: cardW, opacity: k, transform: [{ translateY: (1 - k) * 60 }, { scale: 0.7 + 0.3 * k }], backgroundColor: C.paper, borderWidth: 3, borderColor: c, borderRadius: 10, padding: 8, alignItems: "center" }}>
            <TokenArt paint={wear({ ...STOCK, [s.layer]: id })} size={Math.min(n === 1 ? 110 : 76, ((cardW - 20) * TOKEN_U) / 102)} t={e + 2} trail={s.layer === "aura"} look={0.5} uid={`chest${i}`} />
            <Text numberOfLines={2} style={{ fontFamily: F.black, fontSize: n === 1 ? 24 : 15, lineHeight: n === 1 ? 28 : 18, color: C.ink, marginTop: 2, textAlign: "center" }}>
              {s.name}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: n === 1 ? 12 : 10, letterSpacing: 1.2, color: c, textAlign: "center" }}>{RARITY_WORD[s.rarity].toUpperCase()}</Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: n === 1 ? 12 : 10, letterSpacing: 1.2, color: C.soft }}>{LAYER_WORD[s.layer].toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

/* A chest in line art: the box with its planks and bands, the lock, and the
 * lid, which swings back about its hinge at the back. */
export function ChestArt({ w, h, lid }: { w: number; h: number; /* 0 shut, 1 open. */ lid: number }) {
  const ink = C.ink;
  const lidH = h * 0.36;
  const boxY = lidH;
  const boxH = h - lidH;
  return (
    <G>
      {/* Inside, once the lid is off it: dark, and lit from within. */}
      {lid > 0 ? <Rect x={w * 0.04} y={boxY - lidH * 0.5 * lid} width={w * 0.92} height={lidH * 0.5 * lid + 4} fill="#2B1A0C" stroke={ink} strokeWidth={2} /> : null}
      <Rect x={0} y={boxY} width={w} height={boxH} rx={4} fill={WOOD} stroke={ink} strokeWidth={3} />
      <Line x1={0} y1={boxY + boxH * 0.5} x2={w} y2={boxY + boxH * 0.5} stroke={WOOD_DARK} strokeWidth={2} />
      <Rect x={w * 0.12} y={boxY} width={w * 0.1} height={boxH} fill={BAND} stroke={ink} strokeWidth={2} />
      <Rect x={w * 0.78} y={boxY} width={w * 0.1} height={boxH} fill={BAND} stroke={ink} strokeWidth={2} />
      <G y={-lidH * 1.25 * lid} rotation={-16 * lid} origin={`${w}, ${lidH}`}>
        <Path d={`M0 ${lidH} V${lidH * 0.45} Q${w / 2} ${-lidH * 0.45} ${w} ${lidH * 0.45} V${lidH} Z`} fill={WOOD} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <Rect x={w * 0.12} y={lidH * 0.22} width={w * 0.1} height={lidH * 0.78} fill={BAND} stroke={ink} strokeWidth={2} />
        <Rect x={w * 0.78} y={lidH * 0.22} width={w * 0.1} height={lidH * 0.78} fill={BAND} stroke={ink} strokeWidth={2} />
      </G>
      {/* The lock, on the front of the box. */}
      <Rect x={w / 2 - w * 0.07} y={boxY - h * 0.04} width={w * 0.14} height={h * 0.2} rx={3} fill={BAND} stroke={ink} strokeWidth={2.4} />
      <Circle cx={w / 2} cy={boxY + h * 0.05} r={Math.max(2, w * 0.02)} fill={ink} />
    </G>
  );
}
