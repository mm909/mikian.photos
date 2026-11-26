import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { useWallClock } from "../arcade/BoatArt";
import { TOKEN_U, TokenArt } from "../arcade/Token";
import { CHEST_S, ChestOpen } from "../arcade/Chest";
import { CHEST_COST, buyChest, useBoat } from "../arcade/boat";
import { equip, grant, seen, useLocker } from "../arcade/locker";
import { prng } from "../arcade/rng";
import { LAYERS, LAYER_WORD, RARITIES, RARITY_COLOR, RARITY_WORD, SKINS, SKIN_BY_ID, STOCK, rollChest, wear, type Chest, type Layer } from "../arcade/skins";
import { useSession } from "../session";
import { C, F, fmtInt } from "../theme";
import { Btn } from "../ui";

/* THE LOCKER (owner, 2026-11-24: "a locker screen to see what you own and
 * equip one item per layer, with the boat preview drawn with the equipped
 * layers"). The boat became a piece the same night (arcade/Token.tsx: "I
 * am a box. I am shooting circles"). At the top the piece as it is now,
 * hopping along; under it each layer, BOX, SHOT, HAT and TRAIL, with every
 * item there is to find: the ones won are drawn and a press puts them on
 * the piece, the ones not won yet are
 * a shape and a question mark in the colour of their rarity, so the ladder
 * shows what is still out there. The stock item of each layer is always
 * there to go back to.
 *
 * What is won is kept on this phone (arcade/locker.ts); a server table is
 * the next step. The owner has a TRY A CHEST at the foot, to see a chest
 * open with no row, and what it gives is kept like any other. */

/* A card's piece: as big as the card takes, with room for a trail when it
 * is the trail that is shown. */
const cardToken = (cardW: number, trail = false) => Math.min(84, ((cardW - 14) * TOKEN_U) / (trail ? 102 : 78));
const cardArt = (cardW: number) => Math.round((cardToken(cardW) * 72) / TOKEN_U);

/* The piece as it is now, hopping as it would along its board. */
function Hopping({ equipped, size }: { equipped: Record<string, string>; size: number }) {
  const t = useWallClock(true);
  const beat = (t * 26) / 60;
  const q = beat - Math.floor(beat);
  const hop = q < 0.3 ? Math.sin((q / 0.3) * Math.PI) : 0;
  return <TokenArt paint={wear(equipped)} size={size} t={t} trail hop={hop} look={0.5} uid="locker" />;
}

/* A card's piece. The ones that shine or move (a rare, an epic, a
 * legendary) do it here too, so the ladder is seen in the locker; the plain
 * ones are drawn once and left. */
function CardPiece({ layer, id, size, alive }: { layer: Layer; id: string; size: number; alive: boolean }) {
  const t = useWallClock(alive);
  return <TokenArt paint={wear({ ...STOCK, [layer]: id })} size={size} t={alive ? t : 1.3} trail={layer === "aura"} uid={`l${id}`} />;
}

/* The water the piece stands on at the top of the locker. */
function Stage({ w, h }: { w: number; h: number }) {
  const t = useWallClock(true);
  return (
    <Svg width={w} height={h} style={{ position: "absolute", left: 0, bottom: 0 }}>
      <Rect x={0} y={0} width={w} height={h} rx={h / 2} fill={C.accent} fillOpacity={0.12} />
      <Ellipse cx={w / 2} cy={h * 0.5} rx={w * 0.36} ry={h * 0.3} fill={C.paper} fillOpacity={0.5} />
      {[0, 1, 2, 3, 4].map((i) => {
        const x = ((((i * 0.23 + 0.05) * w - t * 14) % w) + w) % w;
        return <Path key={i} d={`M${x.toFixed(1)} ${(h * (0.3 + (i % 3) * 0.22)).toFixed(1)} q4 -3.5 8 0 t8 0`} stroke={C.accent} strokeOpacity={0.45} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
      })}
    </Svg>
  );
}

const RANK = (r: string) => (r === "stock" ? -1 : RARITIES.indexOf(r as (typeof RARITIES)[number]));

export function LockerScreen({ start }: { start?: Layer } = {}) {
  const win = useWindowDimensions();
  const { me } = useSession();
  const l = useLocker();
  const [layer, setLayer] = useState<Layer>(start ?? "rower");
  const [chest, setChest] = useState<{ c: Chest; at: number; note?: string } | null>(null);
  /* Whatever was new is seen now: it is marked NEW this once. */
  const [fresh] = useState(() => new Set(l.fresh));
  useEffect(() => {
    if (l.fresh.length) {
      for (const id of l.fresh) fresh.add(id);
      seen().catch(() => null);
    }
  }, [l.fresh, fresh]);
  const W = Math.min(win.width, 720);
  const PAD = 16;
  const cols = W >= 560 ? 5 : 4;
  const cardW = Math.floor((W - PAD * 2 - (cols - 1) * 8) / cols);

  const boat = useBoat();
  const tryChest = () => {
    const c = rollChest(prng(Date.now() % 1e9), Math.random() < 0.5);
    setChest({ c, at: Date.now() / 1000 });
    grant(c.items, false).catch(() => null);
  };
  /* A CHEST FOR COINS (owner, 2026-11-24: "We definitely want to be able to
   * buy a chest with coins"), granted on the press, before it opens. */
  const [buying, setBuying] = useState(false);
  const buyOne = async () => {
    if (buying) return;
    setBuying(true);
    try {
      if (!(await buyChest())) return;
      const c = rollChest(prng(Date.now() % 1e9), false);
      await grant(c.items, false).catch(() => null);
      setChest({ c, at: Date.now() / 1000, note: "BOUGHT WITH COINS · IT'S YOURS" });
    } finally {
      setBuying(false);
    }
  };

  /* THE FIGURE STAYS UP (owner, 2026-11-24: "While he picks items (hats,
   * for example), the whole figure stays visible. Put an item-category
   * selector at the top so the full figure stays up there"): the piece and
   * the four layers are pinned above the one layer's items, which scroll
   * under them. */
  return (
    <View style={{ flex: 1 }}>
      <View style={{ width: W, alignSelf: "center", paddingHorizontal: PAD, paddingTop: 6, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
        <View style={{ alignItems: "center", paddingBottom: 4 }}>
          <Stage w={Math.min(W - PAD * 2, 280)} h={34} />
          <View style={{ zIndex: 1 }}>
            <Hopping equipped={l.equipped} size={Math.min(112, (W - PAD * 2) * 0.32)} />
          </View>
        </View>
        <View style={{ flexDirection: "row", columnGap: 6, paddingBottom: 8 }}>
          {LAYERS.map((ly) => {
            const on = ly === layer;
            return (
              <Pressable key={ly} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={LAYER_WORD[ly]} onPress={() => setLayer(ly)} style={({ pressed }) => ({ flex: 1, paddingVertical: 7, borderCurve: "continuous", borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.paper, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.4, color: on ? C.paper : C.ink }}>{LAYER_WORD[ly].toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 120, width: W, alignSelf: "center" }}>
        <LayerRow layer={layer} equipped={l.equipped[layer]} owned={l.owned} fresh={fresh} cardW={cardW} />
        <Btn label={`Buy a chest · ${fmtInt(CHEST_COST)} coins`} onPress={buyOne} disabled={buying || boat.coins < CHEST_COST} style={{ marginTop: 24 }} />
        <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1, color: C.gray, textAlign: "center", marginTop: 6 }}>{`YOU HAVE ${fmtInt(boat.coins)} COINS`}</Text>
        {me.isAdmin ? <Btn label="Try a chest" quiet onPress={tryChest} style={{ marginTop: 12 }} /> : null}
      </ScrollView>
      {chest ? <ChestSheet chest={chest} onClose={() => setChest(null)} /> : null}
    </View>
  );
}

function LayerRow({ layer, equipped, owned, fresh, cardW }: { layer: Layer; equipped: string; owned: Record<string, number>; fresh: Set<string>; cardW: number }) {
  const items = SKINS.filter((s) => s.layer === layer).sort((a, b) => RANK(a.rarity) - RANK(b.rarity));
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 8 }}>
        {items.map((s) => {
          const have = s.rarity === "stock" || !!owned[s.id];
          const isOn = equipped === s.id;
          const c = RARITY_COLOR[s.rarity];
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={have ? `${s.name}, ${RARITY_WORD[s.rarity]}${isOn ? ", worn" : ". Put it on"}` : `Not found yet, ${RARITY_WORD[s.rarity]}`}
              disabled={!have || isOn}
              onPress={() => equip(layer, s.id).catch(() => null)}
              style={({ pressed }) => ({ width: cardW, borderWidth: isOn ? 2.5 : 1.5, borderColor: isOn ? C.ink : have ? c : C.line, borderCurve: "continuous", borderRadius: 7, padding: 5, opacity: pressed ? 0.6 : 1, backgroundColor: C.paper })}
            >
              <View style={{ height: 4, backgroundColor: c, borderRadius: 2, marginBottom: 3, opacity: have ? 1 : 0.5 }} />
              {have ? (
                <View style={{ height: cardArt(cardW), alignItems: "center", justifyContent: "center" }}>
                  <CardPiece layer={layer} id={s.id} size={cardToken(cardW, layer === "aura")} alive={RANK(s.rarity) >= 2} />
                </View>
              ) : (
                <View style={{ width: cardW - 12, height: cardArt(cardW), alignItems: "center", justifyContent: "center", backgroundColor: C.tint, borderRadius: 4 }}>
                  {/* Not found yet: the shape of a box, in its rarity's colour. */}
                  <View style={{ width: 34, height: 32, borderCurve: "continuous", borderRadius: 9, borderWidth: 2, borderStyle: "dashed", borderColor: c, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: F.black, fontSize: 18, lineHeight: 22, color: c }}>?</Text>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 3, columnGap: 2 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bold, fontSize: 11, color: have ? C.ink : C.gray }}>
                  {have ? s.name : "???"}
                </Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 8, letterSpacing: 1, color: isOn ? C.ink : C.accent }}>{isOn ? "ON" : fresh.has(s.id) ? "NEW" : (owned[s.id] ?? 0) > 1 ? `×${owned[s.id]}` : ""}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* The owner's chest with no row: the same chest a game ends on. */
export function ChestSheet({ chest, onClose }: { chest: { c: Chest; at: number; note?: string }; onClose: () => void }) {
  const win = useWindowDimensions();
  const t = useWallClock(true);
  const w = Math.min(win.width, 560);
  const h = Math.min(win.height * 0.7, 520);
  const done = t - chest.at > CHEST_S;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the chest" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: w, height: h + 70, backgroundColor: C.paper, borderCurve: "continuous", borderRadius: 12, overflow: "hidden" }}>
          <ChestOpen chest={chest.c} at={chest.at} t={t} width={w} height={h} won={false} note={chest.note ?? "A TRY, WITH NO ROW"} />
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: done ? C.ink : C.line, textAlign: "center", paddingVertical: 24 }}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
