import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useWallClock } from "../arcade/BoatArt";
import { TOKEN_U, TokenArt } from "../arcade/Token";
import { ChestOpen } from "../arcade/Chest";
import { REWARD_S } from "../arcade/game159";
import { equip, grant, seen, useLocker } from "../arcade/locker";
import { prng } from "../arcade/rng";
import { DROPPABLE, LAYERS, LAYER_WORD, RARITIES, RARITY_COLOR, RARITY_WORD, SKINS, SKIN_BY_ID, STOCK, rollChest, wear, type Chest, type Layer } from "../arcade/skins";
import { useSession } from "../session";
import { C, F } from "../theme";
import { Btn, Eyebrow, styles } from "../ui";

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

const RANK = (r: string) => (r === "stock" ? -1 : RARITIES.indexOf(r as (typeof RARITIES)[number]));

export function LockerScreen() {
  const win = useWindowDimensions();
  const { me } = useSession();
  const l = useLocker();
  const [chest, setChest] = useState<{ c: Chest; at: number } | null>(null);
  /* Whatever was new is seen now: it is marked NEW this once. */
  const [fresh] = useState(() => new Set(l.fresh));
  useEffect(() => {
    if (l.fresh.length) {
      for (const id of l.fresh) fresh.add(id);
      seen().catch(() => null);
    }
  }, [l.fresh, fresh]);
  const W = Math.min(win.width, 720);
  const PAD = 20;
  const cols = W >= 560 ? 4 : 3;
  const cardW = Math.floor((W - PAD * 2 - (cols - 1) * 10) / cols);
  const found = DROPPABLE.filter((s) => l.owned[s.id]).length;

  const tryChest = () => {
    const c = rollChest(prng(Date.now() % 1e9), Math.random() < 0.5);
    setChest({ c, at: Date.now() / 1000 });
    grant(c.items, false).catch(() => null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 120, width: W, alignSelf: "center" }}>
        <Eyebrow>The locker</Eyebrow>
        <Text style={{ fontFamily: F.black, fontSize: 32, lineHeight: 36, color: C.ink, marginTop: 4 }}>
          Your <Text style={{ color: C.accent }}>piece</Text>
        </Text>
        <View style={{ alignItems: "center", marginVertical: 8 }}>
          <Hopping equipped={l.equipped} size={Math.min(150, (W - PAD * 2) * 0.42)} />
        </View>
        <Text style={[styles.body, { marginBottom: 4 }]}>
          {found} of {DROPPABLE.length} found · {l.games.played} {l.games.played === 1 ? "game" : "games"}, {l.games.won} won
        </Text>
        <Text style={[styles.body, { fontSize: 13, marginBottom: 6 }]}>Every match of the arcade ends on a chest, and so does every 5K. What comes out goes here; press one to put it on your piece.</Text>
        {/* The ladder, so the colours mean something. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginBottom: 8 }}>
          {RARITIES.map((r) => (
            <View key={r} style={{ flexDirection: "row", alignItems: "center", columnGap: 5 }}>
              <View style={{ width: 10, height: 10, backgroundColor: RARITY_COLOR[r] }} />
              <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.4, color: C.soft }}>{RARITY_WORD[r].toUpperCase()}</Text>
            </View>
          ))}
        </View>

        {LAYERS.map((layer) => (
          <LayerRow key={layer} layer={layer} equipped={l.equipped[layer]} owned={l.owned} fresh={fresh} cardW={cardW} />
        ))}

        {me.isAdmin ? <Btn label="Try a chest" quiet onPress={tryChest} style={{ marginTop: 24 }} /> : null}
      </ScrollView>
      {chest ? <ChestSheet chest={chest} onClose={() => setChest(null)} /> : null}
    </View>
  );
}

function LayerRow({ layer, equipped, owned, fresh, cardW }: { layer: Layer; equipped: string; owned: Record<string, number>; fresh: Set<string>; cardW: number }) {
  const items = SKINS.filter((s) => s.layer === layer).sort((a, b) => RANK(a.rarity) - RANK(b.rarity));
  const on = SKIN_BY_ID[equipped];
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 4, marginBottom: 10 }}>
        <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>{LAYER_WORD[layer]}</Text>
        <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.6, color: on ? RARITY_COLOR[on.rarity] : C.soft }}>
          ON: {(on?.name ?? "Stock").toUpperCase()}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 10 }}>
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
              style={({ pressed }) => ({ width: cardW, borderWidth: isOn ? 3 : 1.5, borderColor: isOn ? C.ink : have ? c : C.line, borderRadius: 8, padding: 6, opacity: pressed ? 0.6 : 1, backgroundColor: C.paper })}
            >
              <View style={{ height: 4, backgroundColor: c, borderRadius: 2, marginBottom: 4, opacity: have ? 1 : 0.5 }} />
              {have ? (
                <View style={{ height: cardArt(cardW), alignItems: "center", justifyContent: "center" }}>
                  <TokenArt paint={wear({ ...STOCK, [layer]: s.id })} size={cardToken(cardW, layer === "aura")} t={1.3} trail={layer === "aura"} uid={`l${s.id}`} />
                </View>
              ) : (
                <View style={{ width: cardW - 14, height: cardArt(cardW), alignItems: "center", justifyContent: "center", backgroundColor: C.tint, borderRadius: 4 }}>
                  <Text style={{ fontFamily: F.black, fontSize: 26, color: c }}>?</Text>
                </View>
              )}
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 13, color: have ? C.ink : C.gray, marginTop: 4 }}>
                {have ? s.name : "???"}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: c }}>{RARITY_WORD[s.rarity].toUpperCase()}</Text>
                <Text style={{ fontFamily: F.monoBold, fontSize: 9, letterSpacing: 1.2, color: isOn ? C.ink : C.accent }}>{isOn ? "ON" : fresh.has(s.id) ? "NEW" : (owned[s.id] ?? 0) > 1 ? `×${owned[s.id]}` : ""}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* The owner's chest with no row: the same chest a game ends on. */
function ChestSheet({ chest, onClose }: { chest: { c: Chest; at: number }; onClose: () => void }) {
  const win = useWindowDimensions();
  const t = useWallClock(true);
  const w = Math.min(win.width, 560);
  const h = Math.min(win.height * 0.7, 520);
  const done = t - chest.at > REWARD_S;
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close the chest" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: w, height: h + 70, backgroundColor: C.paper, borderRadius: 12, overflow: "hidden" }}>
          <ChestOpen chest={chest.c} at={chest.at} t={t} width={w} height={h} won={false} note="A TRY, WITH NO ROW" />
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: done ? C.ink : C.line, textAlign: "center", paddingVertical: 24 }}>TAP TO CLOSE</Text>
        </View>
      </Pressable>
    </Modal>
  );
}
