import { Text, View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { C, F } from "../theme";
import { TOKEN_U, TokenArt, star } from "./Token";
import { LAYER_WORD, RARITIES, RARITY_COLOR, RARITY_WORD, SKIN_BY_ID, STOCK, bestOf, wear, type Chest, type Rarity } from "./skins";

/* THE CHEST (owner, 2026-11-24: at the end of every game "a treasure chest
 * drops and opens ... one item, or sometimes it bursts with rainbow light
 * and gives three", as Vampire Survivors opens one). About five seconds of
 * the wall, whatever the row is doing:
 *   0.0  it drops in from the top and bounces;
 *   0.7  it shakes and jumps, a light growing round it in the colour of
 *        the best thing inside, twinkles gathering;
 *   1.7  the lid flies open, light pours out of it in rays (every colour
 *        when there are three) and confetti goes up;
 *   2.1  what was in it rises out: one card, or three side by side, each
 *        the item worn by the plain piece (Token.tsx), its name, and its
 *        rarity on a tag of its colour. A rare card is crossed by a
 *        glint, an epic one has twinkles round it, a legendary one's
 *        border runs through the rainbow.
 *
 * THE CARD NEVER COVERS THE WORDS (seen on a phone, 2026-11-24: the card
 * sat on the line under the title): the cards start under the two lines
 * of the head and are sized to the room left, lying on their side (the
 * piece beside its name) where the stage is short. */

const WOOD = "#A56A35";
const WOOD_LIGHT = "#BF8145";
const WOOD_DARK = "#6E4420";
const BAND = "#E0AA22";
const BAND_DARK = "#A87A10";
const RAINBOW = ["#E8443A", "#F28C28", "#F5C935", "#4CB963", "#3A8FD8", "#7B54C9"];

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
/* A drop that bounces twice on landing. */
const bounce = (x: number): number => {
  const v = clamp(x);
  if (v < 0.6) return (v / 0.6) ** 2;
  if (v < 0.85) return 1 - 0.12 * Math.sin(((v - 0.6) / 0.25) * Math.PI);
  return 1 - 0.04 * Math.sin(((v - 0.85) / 0.15) * Math.PI);
};
/* In, a little past, and back. */
const pop = (x: number) => {
  const v = clamp(x);
  return 1 + 2.2 * (v - 1) ** 3 + 1.2 * (v - 1) ** 2;
};
/* A number from a whole one, 0 to 1, the same every time. */
const rnd = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const rank = (r: Rarity) => RARITIES.indexOf(r as (typeof RARITIES)[number]);

export function ChestOpen({ chest, at, t, width, height, won, note }: { chest: Chest; /* When it began to drop, by the wall. */ at: number; t: number; width: number; height: number; won: boolean; /* The line under CHEST, in place of how the game went. */ note?: string }) {
  const e = t - at;
  const best = bestOf(chest.items);
  const glow = RARITY_COLOR[best];
  const open = e >= 1.7;
  const big = width >= 520;
  const tight = height < 230;
  /* The head: two lines, and where they end. */
  const headSize = tight ? 22 : big ? 34 : 30;
  const noteSize = tight ? 11 : 13;
  const headTop = tight ? 4 : 10;
  const headEnd = headTop + Math.round(headSize * 1.18) + Math.round(noteSize * 1.4);
  /* Where the chest sits, and how big. */
  const cw = Math.min(width * (big ? 0.34 : 0.56), height * 0.5);
  const ch = cw * 0.78;
  const cx = width / 2;
  const restY = Math.max(headEnd + 4, height * (open ? 0.68 : 0.54) - ch / 2);
  const shaking = e > 0.7 && e < 1.7;
  const jump = shaking ? Math.abs(Math.sin((e - 0.7) * 11)) * 10 * (e - 0.7) : 0;
  const y = -ch + (restY + ch) * bounce(e / 0.7) - jump;
  const shake = shaking ? Math.sin(e * 40) * (3 + 6 * (e - 0.7)) : 0;
  /* Open: the lid is thrown up off the box and tips back. */
  const lid = open ? pop((e - 1.7) / 0.3) : 0;
  const light = clamp((e - 0.7) / 1);
  const rays = chest.triple ? RAINBOW : [glow, glow, glow, glow, glow, glow];
  const head = chest.triple ? "TRIPLE CHEST" : "CHEST";
  const oe = e - 1.7;
  const mouth = { x: cx, y: restY + ch * 0.36 };
  const flash = open ? clamp(1 - oe / 0.35) : 0;
  return (
    <View style={{ width, height, overflow: "hidden" }}>
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        {/* The light, behind everything: a glow while it shakes, rays once
            it is open, turning, a long one and a short one by turns. */}
        <Circle cx={cx} cy={restY + ch / 2} r={cw * (0.5 + 0.5 * light) * (1 + 0.04 * Math.sin(e * 9))} fill={glow} fillOpacity={open ? 0.16 : 0.24 * light} />
        <Circle cx={cx} cy={restY + ch / 2} r={cw * (0.3 + 0.3 * light)} fill={glow} fillOpacity={open ? 0.14 : 0.2 * light} />
        {open
          ? Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + oe * 0.6;
              const len = Math.max(width, height) * (i % 2 ? 0.62 : 1);
              const k = pop(oe / 0.4);
              const w = i % 2 ? 0.075 : 0.11;
              return <Path key={i} d={`M${mouth.x} ${mouth.y} L${mouth.x + Math.cos(a - w) * len * k} ${mouth.y + Math.sin(a - w) * len * k} L${mouth.x + Math.cos(a + w) * len * k} ${mouth.y + Math.sin(a + w) * len * k}Z`} fill={rays[i % rays.length]} fillOpacity={chest.triple ? 0.5 : i % 2 ? 0.2 : 0.32} />;
            })
          : null}
        {/* Twinkles gather round it as it shakes, and stay once it is open. */}
        {e > 0.9
          ? Array.from({ length: 7 }, (_, i) => {
              const a = rnd(i) * Math.PI * 2 + e * 0.3;
              const d = cw * (0.62 + 0.3 * rnd(i + 20));
              const k = Math.max(0, Math.sin(e * (3 + rnd(i + 40) * 3) + i * 1.7));
              return <Path key={`tw${i}`} d={star(cx + Math.cos(a) * d, restY + ch * 0.45 + Math.sin(a) * d * 0.7, (1.5 + 6 * k) * clamp((e - 0.9) / 0.6))} fill={chest.triple ? RAINBOW[i % 6] : glow} stroke={C.ink} strokeWidth={0.8} strokeLinejoin="round" />;
            })
          : null}
        <G transform={`translate(${(cx - cw / 2 + shake).toFixed(1)} ${y.toFixed(1)})`}>
          <ChestArt w={cw} h={ch} lid={lid} glow={chest.triple ? RAINBOW[Math.floor(e * 6) % 6] : glow} />
        </G>
        {/* The flash as the lid goes, and the confetti it throws up. */}
        {flash > 0 ? <Circle cx={mouth.x} cy={mouth.y} r={cw * (0.3 + 1.1 * (1 - flash))} fill="#FFFFFF" fillOpacity={0.75 * flash} /> : null}
        {open && oe < 2.6
          ? Array.from({ length: 22 }, (_, i) => {
              const a = -Math.PI / 2 + (rnd(i + 3) - 0.5) * 2.2;
              const v = cw * (1.5 + 1.6 * rnd(i + 60));
              const px = mouth.x + Math.cos(a) * v * oe;
              const py = mouth.y + Math.sin(a) * v * oe + 0.5 * cw * 2.6 * oe * oe;
              const s = Math.max(4, cw * 0.035) * (0.7 + 0.7 * rnd(i + 90));
              const colors = chest.triple ? RAINBOW : [glow, BAND, C.ink, glow];
              return <Rect key={`cf${i}`} x={-s / 2} y={-s / 2} width={s} height={s * (i % 3 ? 1 : 1.8)} fill={colors[i % colors.length]} opacity={clamp(2.6 - oe)} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${((rnd(i) * 360 + oe * (200 + 300 * rnd(i + 5))) % 360).toFixed(0)})`} />;
            })
          : null}
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, top: headTop, alignItems: "center" }}>
        <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: headSize, lineHeight: Math.round(headSize * 1.18), letterSpacing: 1, color: chest.triple ? RAINBOW[Math.floor(e * 6) % 6] : C.ink }}>
          {head}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: noteSize, lineHeight: Math.round(noteSize * 1.4), letterSpacing: tight ? 1.2 : 2, color: C.soft }}>
          {note ?? (won ? "FIELD CLEAR" : "WIPED OUT · A CHEST ANYWAY")}
        </Text>
      </View>
      {e >= 2.1 ? <Items ids={chest.items} e={e - 2.1} width={width} top={headEnd + 6} room={height - headEnd - 12} /> : null}
    </View>
  );
}

/* What came out, rising over the chest: under the head, in the room that
 * is left. */
function Items({ ids, e, width, top, room }: { ids: string[]; e: number; width: number; top: number; room: number }) {
  const n = ids.length;
  const gap = 10;
  /* One item in a short room lies on its side: the piece, and its name
   * beside it. */
  const flat = n === 1 && room < 200;
  const cardW = flat ? Math.min(width - 24, 340) : Math.min(n === 1 ? 260 : 180, (width - 24 - gap * (n - 1)) / n);
  /* The words under a standing card's piece, and the card's own edges. */
  const snug = n > 1 && room < 170;
  const words = n === 1 ? 82 : snug ? 54 : 76;
  const size = flat ? clamp(((Math.min(room, 132) - 22) * TOKEN_U) / 72, 30, 104) : clamp(Math.min(n === 1 ? 110 : 76, ((cardW - 20) * TOKEN_U) / 102, ((room - words) * TOKEN_U) / 72), 24, 110);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top, flexDirection: "row", justifyContent: "center", columnGap: gap }}>
      {ids.map((id, i) => {
        const le = e - i * 0.25;
        const k = clamp(le / 0.45);
        const s = SKIN_BY_ID[id];
        if (!s) return null;
        const c = RARITY_COLOR[s.rarity];
        const r = rank(s.rarity);
        const edge = r >= 4 ? RAINBOW[Math.floor(e * 7 + i) % 6] : c;
        const float = k >= 1 ? Math.sin(le * 2.2) * 2.5 : 0;
        /* The glint across a rare card or better, once as it lands and
         * then now and then. */
        const gl = ((le - 0.35) % 2.6) / 0.6;
        const art = <TokenArt paint={wear({ ...STOCK, [s.layer]: id })} size={size} t={e + 2} trail={s.layer === "aura"} look={0.5} hop={k >= 1 ? Math.max(0, Math.sin(le * 5)) ** 2 * 0.8 : 0} uid={`chest${i}`} />;
        const tag = (
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6, marginTop: 4 }}>
            <View style={{ backgroundColor: c, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ fontFamily: F.monoBold, fontSize: n === 1 ? 12 : 10, letterSpacing: 1.2, color: "#FFFFFF" }}>{RARITY_WORD[s.rarity].toUpperCase()}</Text>
            </View>
            {n === 1 ? <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.2, color: C.soft }}>{LAYER_WORD[s.layer].toUpperCase()}</Text> : null}
          </View>
        );
        const name = (
          <Text numberOfLines={snug ? 1 : 2} style={{ fontFamily: F.black, fontSize: n === 1 ? 24 : snug ? 13 : 15, lineHeight: n === 1 ? 27 : snug ? 16 : 18, color: C.ink, marginTop: flat ? 0 : 2, textAlign: flat ? "left" : "center" }}>
            {s.name}
          </Text>
        );
        return (
          <View key={id} style={{ width: cardW, opacity: clamp(le / 0.2), transform: [{ translateY: (1 - k) * 70 + float }, { scale: 0.55 + 0.45 * pop(le / 0.45) }, { rotate: `${((1 - k) * (i % 2 ? 7 : -7)).toFixed(1)}deg` }] }}>
            <View style={{ backgroundColor: C.paper, borderWidth: 3, borderColor: edge, borderRadius: 12, overflow: "hidden", shadowColor: c, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }}>
              <View style={{ height: 6, backgroundColor: c }} />
              {flat ? (
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, columnGap: 6 }}>
                  {art}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {name}
                    {tag}
                  </View>
                </View>
              ) : (
                <View style={{ alignItems: "center", paddingHorizontal: 8, paddingTop: 2, paddingBottom: 8 }}>
                  {art}
                  {name}
                  {tag}
                  {n > 1 && !snug ? <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.2, color: C.soft, marginTop: 2 }}>{LAYER_WORD[s.layer].toUpperCase()}</Text> : null}
                </View>
              )}
              {r >= 2 && gl > 0 && gl < 1 ? <View style={{ position: "absolute", top: -20, bottom: -20, width: 26, left: -40 + (cardW + 60) * gl, backgroundColor: "#FFFFFF", opacity: 0.55, transform: [{ rotate: "18deg" }] }} /> : null}
            </View>
            {/* An epic or better has twinkles round its card. */}
            {r >= 3 && k >= 1 ? (
              <Svg width={cardW + 40} height={60} style={{ position: "absolute", left: -20, top: -24 }}>
                {[0, 1, 2, 3].map((j) => {
                  const tw = Math.max(0, Math.sin(le * (3 + j) + j * 2));
                  return <Path key={j} d={star([14, cardW * 0.35 + 20, cardW * 0.7 + 20, cardW + 28][j], [38, 14, 10, 34][j], 2 + 7 * tw)} fill={r >= 4 ? RAINBOW[(j + Math.floor(e * 4)) % 6] : c} stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />;
                })}
              </Svg>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/* A chest in line art: the box with its planks, bands and studs, the lock,
 * and the lid, which is thrown back; open, it is dark inside and the light
 * comes up out of it. */
export function ChestArt({ w, h, lid, glow = BAND }: { w: number; h: number; /* 0 shut, 1 open. */ lid: number; /* The colour of the light inside. */ glow?: string }) {
  const ink = C.ink;
  const lidH = h * 0.36;
  const boxY = lidH;
  const boxH = h - lidH;
  const sw = Math.max(2, w * 0.022);
  const bands = [0.12, 0.78];
  const stud = Math.max(1.4, w * 0.014);
  return (
    <G>
      {/* Its shadow on the ground. */}
      <Rect x={w * 0.03} y={h - 2} width={w * 0.94} height={Math.max(4, h * 0.06)} rx={h * 0.03} fill={ink} fillOpacity={0.14} />
      {/* Inside, once the lid is off it: dark, and lit from within. */}
      {lid > 0 ? (
        <G>
          <Rect x={w * 0.04} y={boxY - lidH * 0.5 * lid} width={w * 0.92} height={lidH * 0.5 * lid + 4} fill="#2B1A0C" stroke={ink} strokeWidth={sw * 0.7} />
          <Path d={`M${w * 0.1} ${boxY} L${-w * 0.08} ${boxY - h * 1.1 * lid} H${w * 1.08} L${w * 0.9} ${boxY} Z`} fill={glow} fillOpacity={0.3} />
          <Path d={`M${w * 0.24} ${boxY} L${w * 0.14} ${boxY - h * 0.8 * lid} H${w * 0.86} L${w * 0.76} ${boxY} Z`} fill="#FFFFFF" fillOpacity={0.45} />
          <Rect x={w * 0.08} y={boxY - 3} width={w * 0.84} height={5} fill="#FFF6D0" />
        </G>
      ) : null}
      <Rect x={0} y={boxY} width={w} height={boxH} rx={4} fill={WOOD} stroke={ink} strokeWidth={sw} />
      <Rect x={sw / 2} y={boxY + sw / 2} width={w - sw} height={boxH * 0.16} fill={WOOD_LIGHT} />
      <Line x1={sw / 2} y1={boxY + boxH * 0.5} x2={w - sw / 2} y2={boxY + boxH * 0.5} stroke={WOOD_DARK} strokeWidth={Math.max(1.5, sw * 0.7)} />
      <Rect x={sw / 2} y={boxY + boxH * 0.86} width={w - sw} height={boxH * 0.14 - sw / 2} fill={WOOD_DARK} fillOpacity={0.45} />
      {bands.map((bx) => (
        <G key={bx}>
          <Rect x={w * bx} y={boxY} width={w * 0.1} height={boxH} fill={BAND} stroke={ink} strokeWidth={sw * 0.7} />
          <Rect x={w * bx + w * 0.066} y={boxY + sw / 2} width={w * 0.034 - sw * 0.35} height={boxH - sw} fill={BAND_DARK} fillOpacity={0.55} />
          <Circle cx={w * (bx + 0.05)} cy={boxY + boxH * 0.25} r={stud} fill={ink} />
          <Circle cx={w * (bx + 0.05)} cy={boxY + boxH * 0.75} r={stud} fill={ink} />
        </G>
      ))}
      <G transform={`translate(0 ${(-lidH * 1.25 * lid).toFixed(1)}) rotate(${(-18 * lid).toFixed(1)} ${w} ${lidH})`}>
        <Path d={`M0 ${lidH} V${lidH * 0.45} Q${w / 2} ${-lidH * 0.45} ${w} ${lidH * 0.45} V${lidH} Z`} fill={WOOD} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <Path d={`M${w * 0.06} ${lidH * 0.36} Q${w / 2} ${-lidH * 0.26} ${w * 0.94} ${lidH * 0.36}`} stroke={WOOD_LIGHT} strokeWidth={Math.max(2, lidH * 0.12)} fill="none" strokeLinecap="round" />
        {bands.map((bx) => (
          <G key={bx}>
            <Rect x={w * bx} y={lidH * 0.22} width={w * 0.1} height={lidH * 0.78} fill={BAND} stroke={ink} strokeWidth={sw * 0.7} />
            <Circle cx={w * (bx + 0.05)} cy={lidH * 0.62} r={stud} fill={ink} />
          </G>
        ))}
        <Line x1={0} y1={lidH} x2={w} y2={lidH} stroke={ink} strokeWidth={sw} />
      </G>
      {/* The lock, on the front of the box, and its keyhole. */}
      <Rect x={w / 2 - w * 0.075} y={boxY - h * 0.04} width={w * 0.15} height={h * 0.21} rx={3} fill={BAND} stroke={ink} strokeWidth={sw * 0.8} />
      <Circle cx={w / 2} cy={boxY + h * 0.045} r={Math.max(2, w * 0.022)} fill={ink} />
      <Rect x={w / 2 - Math.max(0.8, w * 0.008)} y={boxY + h * 0.045} width={Math.max(1.6, w * 0.016)} height={h * 0.07} fill={ink} />
    </G>
  );
}
