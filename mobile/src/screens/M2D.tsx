import { useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Blocks, Waiting, useLoad, useScrollDir } from "../ui";
import { M2D_REELS } from "../stickers";
import { Reels, StickerTiles, StickerViewer } from "./RowPage";

/* M2D, METERS TO DOLLARS: the Concept2 Holiday Challenge, Nov 26 - Dec 24
 * (owner, 2026-11-25, with Concept2's post open: "Let's take over that
 * middle tab that's usually the 100K ... M2D is what we'll call it ... it's
 * the same rankings of this board, but ... that top value is dollars that
 * everyone has generated during this time, and it can differentiate between
 * if someone's opted in and someone's opted out ... it's grayed out because
 * you haven't opted in. It's not to discriminate them, but it's like a hey,
 * make sure you opt in"; of the profile's third column: "if they're not
 * opted in, how do you opt in? What do you need to do ... and then we need
 * to track how much money they have raised").
 *
 * THE RULE (owner, 2026-11-25, the last word that day): CONCEPT2 gives
 * nothing for a rower until 100K in the window, then 2 cents a kilometer
 * and 4 past 100K; ROWTEMBER gives a flat rate on every meter from the
 * first (the rate is the site's, `rate`, set by the owner). Never a match,
 * never "Las Vegas", never a word asking for money. Whether a rower is
 * registered with Concept2 we cannot see: it is their own word, pressed
 * here (I'M REGISTERED), and it can be taken back. The figures are the
 * site's (api/row100k/app/m2d, row100k/m2d.ts).
 *
 *   THE TAB (`M2dScreen`; owner, 2026-11-25: "bring back whatever we had,
 *     like a total ... a receipts up there"): the total, RAISED; the goal;
 *     the receipts, CONCEPT2 and ROWTEMBER, each opening the math
 *     (`M2dFaq`); the board. A rower not in gets one small JOIN M2D.
 *   THE PROFILE'S THIRD COLUMN (`M2dPanel`): the rower's own: the steps,
 *     or their dollars, REGISTERED and their charity (one, or a split).
 *   THE STATS TAB (`M2dStatsView`): M2D as a time frame, in dollars.
 *   THE OWNER'S PLANNER (`M2dPlanner`): what it costs, and the rate. */

export type M2dRow = { rowerNumber: number; name: string; division?: string; meters: number; dollars: number | null; in: boolean; me: boolean; blocks?: number };
export type M2dView = {
  signedIn?: boolean;
  window: { first: string; last: string; days: number; day: number; started: boolean; over: boolean; until?: number };
  link: string;
  signup: string;
  goal: number;
  /* Who gives the second part (ROWTEMBER), its rate in cents a
   * kilometer on every meter, and the three charities a rower picks it
   * for. Absent on an older site. */
  match?: { on: boolean; by: string };
  rate?: number;
  /* ROWTEMBER's rate and every other giver's together (totals.givers). */
  perKm?: number;
  charities?: Charity[];
  /* raised: CONCEPT2 (past 100K only); matched: ROWTEMBER (every meter);
   * total: both, THE figure; split: ROWTEMBER's part by charity picked;
   * inMeters: the meters ROWTEMBER's part is paid on. */
  totals: {
    meters: number;
    raised: number;
    matched?: number;
    total?: number;
    split?: Record<string, number>;
    unpicked?: number;
    inMeters?: number;
    givers?: { name: string; cents?: number; cap?: number; dollars: number }[];
    locked: number;
    unclaimed: number;
    rowers: number;
    registered: number;
    past100k: number;
  };
  rows: M2dRow[];
  me: { rowerNumber: number; in: boolean; choice?: string | null; shares?: Record<string, number> | null; meters: number; dollars: number; concept2?: number; rowtember?: number; locked: number } | null;
};

export type Charity = { key: string; name: string; full: string; what: string; url: string | null };

export const M2D_PATH = "/api/row100k/app/m2d";

/* THE FIGURE: everything raised for charity, Concept2 and ROWTEMBER's
 * match together (the stats title in App.tsx too). */
export const totalOf = (v: M2dView): number => v.totals.total ?? v.totals.raised;

/* "$16.38"; "$1,234" once there are a thousand of them. */
export const usd = (d: number): string => (d >= 1000 ? `$${fmtInt(d)}` : `$${d.toFixed(2)}`);

/* Concept2's rule (row100k/m2d.ts locked): nothing until 100K, then 2
 * cents a kilometer, 4 past 100K. */
export function concept2Of(meters: number): number {
  const km = Math.max(0, meters) / 1000;
  return km < 100 ? 0 : Math.round((2 + 0.04 * (km - 100)) * 100) / 100;
}
/* ROWTEMBER's: every meter at the rate (cents a kilometer). */
export const rowtemberOf = (meters: number, rate: number): number => Math.round(((Math.max(0, meters) / 1000) * rate) / 100 * 100) / 100;
/* "3¢", "2.5¢", "4.25¢", "$1". */
export const centsWord = (c: number): string => (c >= 100 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : `${Math.round(c * 100) / 100}¢`);
const rateOf = (v: M2dView): number => v.rate ?? 4;
/* ROWTEMBER's line, said as a match (owner, 2026-11-25). */
const matchWord = (v: M2dView): string => `Matches Concept2's ${centsWord(rateOf(v))}/km, from your first meter`;
const giversOf = (v: M2dView) => v.totals.givers ?? [];
const perKmOf = (v: M2dView): number => v.perKm ?? rateOf(v);
const windowWord = (v: M2dView): string => (!v.window.started ? "Nov 26 – Dec 24" : v.window.over ? "Final" : `Day ${v.window.day} of ${v.window.days}`);

/* ONE LINE OF A RECEIPT (owner, 2026-11-25: "a really good like itemized
 * receipt type look"): who gives on the left with their rate under it in
 * grey, the dollars on the right. A press opens the math where there is
 * one. */
function Item({ who, rate, d, onPress, strong }: { who: string; rate?: string; d: string; onPress?: () => void; strong?: boolean }) {
  const body = (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", columnGap: 12, paddingVertical: 10, borderBottomWidth: strong ? 0 : 1, borderColor: C.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: strong ? F.black : F.bold, fontSize: strong ? 16 : 14, color: C.ink, textTransform: "uppercase" }}>
          {who}
          {onPress ? <Text style={{ color: C.gray }}> ›</Text> : null}
        </Text>
        {rate ? <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 3, lineHeight: 14 }]}>{rate}</Text> : null}
      </View>
      <Text style={{ fontFamily: strong ? F.black : F.monoBold, fontSize: strong ? 18 : 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{d}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${who}, ${d}. How it adds up`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      {body}
    </Pressable>
  );
}

/* THE TOTAL LINE of a receipt: a rule of ink above it. */
function TotalItem({ d, label = "Total" }: { d: string; label?: string }) {
  return (
    <View style={{ borderTopWidth: 2, borderColor: C.ink, marginTop: 4 }}>
      <Item who={label} d={d} strong />
    </View>
  );
}

/* WHAT A KILOMETER IS WORTH (owner, 2026-11-25: "a section for how much
 * money each meter is worth for the different people that have donated
 * ... I am giving 3 cents per 1K. Concept2 is giving 2 cents per 1K and
 * then 4 cents"). Each giver a line in cents a kilometer, and the sum,
 * under and past 100K. */
function PerKm({ v }: { v: M2dView }) {
  const all = perKmOf(v);
  /* Only the sums (owner, 2026-11-25: "we actually don't need the rows for
   * Concept2 and ROWTEMBER. I only care about the under 100K, after 100K");
   * the givers and their rates are on the receipt above. */
  const sum = (k: string, note: string, c: number) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", columnGap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.black, fontSize: 15, color: C.ink, textTransform: "uppercase" }}>{k}</Text>
        <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 3 }]}>{note}</Text>
      </View>
      <Text style={{ fontFamily: F.black, fontSize: 17, color: C.accent, fontVariant: ["tabular-nums"] }}>{centsWord(c)} / km</Text>
    </View>
  );
  return (
    <View style={{ marginTop: 34 }}>
      <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase", paddingBottom: 8, borderBottomWidth: 2, borderColor: C.ink }}>What a kilometer is worth</Text>
      {sum("Under 100K", "Until Concept2's donation begins at 100K", all)}
      {sum("Past 100K", "Concept2's 4¢ on top", all + 4)}
    </View>
  );
}

/* A SHARE BUTTON: the dollar stickers (share/cards.ts m2d-*), on the dark
 * ground the stickers are made for (owner, 2026-11-25: "this is where a
 * share button should be"). */
function ShareBtn({ label, only }: { label: string; only: string }) {
  /* Small (owner, 2026-11-25: "the share the total button is too big ...
   * what I want people to see first is the amount of money"); a press opens
   * the sticker itself to look at before sharing. */
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={() => setOpen(true)} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
        <Text style={[mono(10, true, C.accent, 0.12), { textDecorationLine: "underline" }]}>{label} ↗</Text>
      </Pressable>
      {open ? <StickerViewer only={only} empty="The M2D stickers open Nov 26, with the first meters." onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function useM2d() {
  const { me } = useSession();
  return useLoad(() => api<M2dView>(M2D_PATH), [me.me?.rowerNumber], M2D_PATH);
}

const open = (url: string) => Linking.openURL(url).catch(() => null);

/* SPLIT EVENLY, THE DEFAULT (owner, 2026-11-25; row100k/m2d.ts EVEN_SHARES):
 * a rower in with no pick is split 34 / 33 / 33. */
const EVEN = "even";
const EVEN_SHARES: Record<string, number> = { candlelighters: 34, shine: 33, inclusion: 33 };

/* THE STEPS, for a rower not yet in (owner: "Tell them it's 4 steps, or I
 * don't know ... it could just be click here, go opt in"). Concept2's own
 * steps, in its words where they are short; then the one press that tells
 * this app. */
function Steps({ v, onIn, busy, pick, onPick }: { v: M2dView; onIn: () => void; busy: boolean; pick: string | null; onPick: (k: string) => void }) {
  const steps: [string, string][] = [
    ["Make a free Concept2 Logbook", "Sign up at log.concept2.com, or sign in if you have one."],
    ["Pick a charity in your Logbook", "Invictus Games Foundation, Natural Resources Defense Council, War Child USA or Wood4Good, or Let Concept2 Choose. Do Not Donate means your meters raise nothing from Concept2."],
    ["Get your meters into the Logbook", "ErgData sends each row there. Nov 26 to Dec 24; meters can be entered until Jan 4."],
    ["Row 100K", "Concept2 donates for every rower who reaches 100K: 2 cents a kilometer, then 4 cents for each one past 100K. 100K earns a certificate, 200K the Holiday Challenge pin (50K for kids and adaptive rowers)."],
    /* The fifth is ours: ROWTEMBER's part is paid on rows logged in ROW. */
    [
      "Log your rows on ROW too",
      `${v.match?.by ?? "ROWTEMBER"} matches Concept2's ${centsWord(rateOf(v))} on every kilometer logged in ROW, from your first meter. Tap + at the top to log one. Sending your rows to Concept2 automatically is coming.`,
    ],
  ];
  const matchOn = !!v.match?.on && !!v.charities?.length;
  const name = v.charities?.find((c) => c.key === pick)?.name;
  return (
    <View style={{ marginTop: 22, borderWidth: 2, borderColor: C.ink, padding: 16 }}>
      <Text style={{ fontFamily: F.black, fontSize: 19, color: C.ink, textTransform: "uppercase" }}>Opt in to M2D: {steps.length} steps</Text>
      <Text style={[mono(10, false, C.gray, 0.12), { marginTop: 6, lineHeight: 16 }]}>You row; Concept2 donates and {v.match?.by ?? "ROWTEMBER"} matches.</Text>
      {steps.map(([h, t], i) => {
        const ours = i === steps.length - 1;
        return (
          <View key={h} style={{ flexDirection: "row", columnGap: 12, marginTop: 14 }}>
            <Text style={{ width: 22, fontFamily: F.black, fontSize: 18, color: ours ? C.ink : C.accent }}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: ours ? C.accent : C.ink }}>{h}</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.gray, marginTop: 2 }}>{t}</Text>
            </View>
          </View>
        );
      })}
      <View style={{ marginTop: 18 }}>
        <Ctl label="Open Concept2 ↗" onPress={() => open(v.link)} />
      </View>
      {matchOn ? <Picks v={v} pick={pick} busy={busy} onPick={onPick} /> : null}
      {v.me ? (
        <View style={{ marginTop: 16 }}>
          <Go label={busy ? "Saving" : "I'm registered"} disabled={busy} onPress={onIn} />
          <Text style={[mono(9.5, false, C.gray, 0.1), { marginTop: 10, lineHeight: 15 }]}>
            {matchOn && name ? `${name} gets ${v.match?.by}'s part for your meters.` : matchOn ? `${v.match?.by}'s part is split evenly across the three.` : "Concept2 counts the meters in your Logbook."}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* The one solid button (review, 2026-11-25: I'M REGISTERED is the primary
 * act, right under the pick). */
function Go({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: disabled ? "transparent" : C.accent, borderWidth: 2, borderColor: disabled ? C.line : C.accent, paddingVertical: 15, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={{ fontFamily: F.black, fontSize: 18, color: disabled ? C.gray : "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
    </Pressable>
  );
}

/* Saying in or out, and the charity ROWTEMBER's match goes to: the site's
 * answer is the new view. Before the rower is in, a tap on a charity is
 * the pick I'M REGISTERED will send; once in, it saves at once (until
 * Dec 24). */
function useIn(v: M2dView | null, reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const pick = picked ?? v?.me?.choice ?? null;
  const say = async (on: boolean, choice?: string, shares?: Record<string, number>) => {
    setBusy(true);
    setNote("");
    try {
      await api(M2D_PATH, { body: shares ? { in: on, shares } : choice ? { in: on, choice } : { in: on } });
      await reload();
      setPicked(null);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not save.");
    }
    setBusy(false);
  };
  const onPick = (k: string) => {
    if (v?.window.over) return;
    if (k === EVEN) {
      if (v?.me?.in) void say(true, undefined, EVEN_SHARES);
      else setPicked(EVEN);
      return;
    }
    if (v?.me?.in) void say(true, k);
    else setPicked(k);
  };
  return { busy, note, say, pick, onPick };
}

/* REGISTERED, said plainly (owner, 2026-11-25: the REGISTERED / CONCEPT2 /
 * UNDO row needed to be clear): a status, not a link; Open Concept2 is the
 * one link; Undo small, quiet and set apart, so it is not hit by mistake. */
function Status({ v, busy, onUndo }: { v: M2dView; busy: boolean; onUndo: () => void }) {
  /* One line, no box (owner, 2026-11-25: "there's just a lot of buttons"). */
  return (
    <View style={{ marginTop: 26, paddingTop: 12, borderTopWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: 12 }}>
      <Text style={mono(10, true, C.accent, 0.12)}>✓ Registered with Concept2</Text>
      <View style={{ flexDirection: "row", columnGap: 16 }}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => open(v.link)}>
          <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>Concept2 ↗</Text>
        </Pressable>
        {!v.window.over ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Undo, I'm not registered" hitSlop={8} disabled={busy} onPress={onUndo}>
            <Text style={[mono(10, false, C.gray, 0.12), { textDecorationLine: "underline" }]}>{busy ? "Saving" : "Undo"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* WHERE ROWTEMBER'S MATCH GOES (owner, 2026-11-25: "I want users to be
 * able to pick where their donations go to ... Project Inclusion, Shine a
 * Light, and Candlelighters"): the three, one picked. Once picked, only
 * that one shows, with CHANGE to open the three again until Dec 24 (owner,
 * the same day: "Once we select a charity we could prob hide the
 * others"). */
function Picks({ v, pick, busy, onPick }: { v: M2dView; pick: string | null; busy: boolean; onPick: (k: string) => void }) {
  const by = v.match?.by ?? "ROWTEMBER";
  const [changing, setChanging] = useState(false);
  const mine = (v.charities ?? []).find((c) => c.key === pick);
  const evenOn = !pick || pick === EVEN;
  if (mine && !changing) {
    return (
      <View style={{ marginTop: 20 }}>
        <Text style={mono(10, true, C.ink, 0.12)}>Your charity</Text>
        <View style={{ marginTop: 8, backgroundColor: C.accent, padding: 12 }}>
          <Text style={{ fontFamily: F.black, fontSize: 15, color: "#FFFFFF", textTransform: "uppercase" }}>✓ {mine.name}</Text>
          <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: "#FFFFFF", marginTop: 3 }}>{mine.what}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          {mine.url ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`${mine.name}'s site`} hitSlop={8} onPress={() => open(mine.url as string)}>
              <Text style={[mono(9.5, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>Their site ↗</Text>
            </Pressable>
          ) : (
            <View />
          )}
          {!v.window.over ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Change the charity" hitSlop={8} disabled={busy} onPress={() => setChanging(true)}>
              <Text style={[mono(9.5, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>Change</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
  const choose = (k: string) => {
    setChanging(false);
    onPick(k);
  };
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontFamily: F.black, fontSize: 16, color: C.ink, textTransform: "uppercase" }}>Your charity</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.gray, marginTop: 4 }}>
        {by} matches Concept2&apos;s {centsWord(rateOf(v))} on every kilometer you row, from your first meter. It is split evenly across the three unless you pick one.{v.window.over ? "" : " You can change it until Dec 24."}
      </Text>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: evenOn, disabled: busy || v.window.over || !v.me }}
        accessibilityLabel="Split evenly across the three"
        disabled={busy || v.window.over || !v.me}
        onPress={() => choose(EVEN)}
        style={({ pressed }) => ({ marginTop: 10, borderWidth: 1, borderColor: evenOn ? C.accent : C.ink, backgroundColor: evenOn ? C.accent : "transparent", padding: 12, opacity: pressed ? 0.6 : 1 })}
      >
        <Text style={{ fontFamily: F.black, fontSize: 15, color: evenOn ? "#FFFFFF" : C.ink, textTransform: "uppercase" }}>{evenOn ? "✓ " : ""}Split evenly</Text>
        <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: evenOn ? "#FFFFFF" : C.gray, marginTop: 3 }}>A third to each of the three.</Text>
      </Pressable>
      {(v.charities ?? []).map((c) => {
        const on = pick === c.key;
        return (
          <View key={c.key} style={{ marginTop: 10 }}>
            {/* The picked one is a solid block of the accent with a check
             * (review, 2026-11-25: an unmistakable selected state). */}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: busy || v.window.over || !v.me }}
              accessibilityLabel={`${c.name}. ${c.what}`}
              disabled={busy || v.window.over || !v.me}
              onPress={() => choose(c.key)}
              style={({ pressed }) => ({ borderWidth: 1, borderColor: on ? C.accent : C.ink, backgroundColor: on ? C.accent : "transparent", padding: 12, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontFamily: F.black, fontSize: 15, color: on ? "#FFFFFF" : C.ink, textTransform: "uppercase" }}>
                {on ? "✓ " : ""}
                {c.name}
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: on ? "#FFFFFF" : C.gray, marginTop: 3 }}>{c.what}</Text>
            </Pressable>
            {c.url ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`${c.name}'s site`} hitSlop={8} onPress={() => open(c.url as string)} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                <Text style={[mono(9.5, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>Their site ↗</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/* "Project Inclusion", or "Candlelighters 50% · Shine A Light 50%". */
function sharesText(v: M2dView, s: Record<string, number>): string {
  const on = (v.charities ?? []).filter((c) => (s[c.key] ?? 0) > 0);
  if (on.length === 1) return on[0].name;
  return on.map((c) => `${c.name} ${s[c.key]}%`).join(" · ");
}

/* THE CHARITY, IN ONE PLACE: THE PROFILE (owner, 2026-11-25: "Let's just
 * have 1 spot and have it be on their profile"). Where ROWTEMBER's match
 * goes, and CHANGE to split it across the three until Dec 24 ("1/3 each,
 * 10/90, 0/50/50"; never at sign-up, where it is one charity, 100%).
 * Three rows with − and + in steps of 10: taking from one gives to the
 * next, so the shares always add to 100. */
function Split({ v, busy, onSave }: { v: M2dView; busy: boolean; onSave: (s: Record<string, number>) => void }) {
  const list = v.charities ?? [];
  const saved = v.me?.shares ?? null;
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const start = () => setDraft(Object.fromEntries(list.map((c) => [c.key, saved?.[c.key] ?? (saved ? 0 : Math.round(100 / list.length))])) as Record<string, number>);
  /* Thirds come out 34 / 33 / 33: the shares always add to 100. */
  const even = () => setDraft(Object.fromEntries(list.map((c, i) => [c.key, Math.floor(100 / list.length) + (i < 100 % list.length ? 1 : 0)])) as Record<string, number>);
  const all = (k: string) => setDraft(Object.fromEntries(list.map((x) => [x.key, x.key === k ? 100 : 0])) as Record<string, number>);
  const step = (i: number, d: 10 | -10) => {
    if (!draft) return;
    const k = list[i].key;
    const next = { ...draft };
    if (d > 0) {
      if (next[k] >= 100) return;
      /* + takes 10 from the next charity that has it. */
      for (let j = 1; j < list.length; j++) {
        const o = list[(i + j) % list.length].key;
        if (next[o] > 0) {
          const take = Math.min(10, next[o], 100 - next[k]);
          next[o] -= take;
          next[k] += take;
          setDraft(next);
          return;
        }
      }
    } else {
      if (next[k] <= 0) return;
      /* − gives 10 to the next charity. */
      const give = Math.min(10, next[k]);
      const o = list[(i + 1) % list.length].key;
      next[k] -= give;
      next[o] += give;
      setDraft(next);
    }
  };
  const link = (label: string, on: () => void, a11y?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={8} disabled={busy} onPress={on}>
      <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>{label}</Text>
    </Pressable>
  );
  /* SAVED: plain lines, the name and its share (owner, 2026-11-25: "a
   * little too many boxes here"). */
  if (!draft) {
    const on = saved ? list.filter((c) => (saved[c.key] ?? 0) > 0) : [];
    return (
      <View style={{ marginTop: 26 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottomWidth: 2, borderColor: C.ink }}>
          <Text style={{ fontFamily: F.black, fontSize: 15, color: C.ink, textTransform: "uppercase" }}>Your charity</Text>
          {!v.window.over ? link(saved ? "Change" : "Pick one", start, "Change or split the charity") : null}
        </View>
        {on.length ? (
          on.map((c) => (
            <View key={c.key} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>✓ {c.name}</Text>
              <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent }}>{saved?.[c.key]}%</Text>
            </View>
          ))
        ) : (
          <Text style={[mono(10, false, C.gray, 0.1), { paddingVertical: 10 }]}>No charity picked yet.</Text>
        )}
      </View>
    );
  }
  const sum = list.reduce((a, c) => a + (draft[c.key] ?? 0), 0);
  const btn = (label: string, on: () => void, off: boolean, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={off || busy} onPress={on} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderWidth: 1, borderColor: off ? C.line : C.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ fontFamily: F.black, fontSize: 18, color: off ? C.line : C.ink }}>{label}</Text>
    </Pressable>
  );
  /* CHANGING: each charity its − share +, and 100% beside it to give it
   * all (owner, 2026-11-25: "the all to a certain one ... can probably
   * just be in line here"); SPLIT EVENLY and SAVE under them. The shares
   * are said once, on the lines. */
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={{ fontFamily: F.black, fontSize: 15, color: C.ink, textTransform: "uppercase", paddingBottom: 8, borderBottomWidth: 2, borderColor: C.ink }}>Your charity</Text>
      {list.map((c, i) => (
        <View key={c.key} style={{ flexDirection: "row", alignItems: "center", columnGap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
          <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: draft[c.key] > 0 ? C.ink : C.gray }}>{c.name}</Text>
          {btn("−", () => step(i, -10), draft[c.key] <= 0, `Less to ${c.name}`)}
          <Text style={{ width: 48, textAlign: "center", fontFamily: F.black, fontSize: 16, color: draft[c.key] > 0 ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{draft[c.key]}%</Text>
          {btn("+", () => step(i, 10), draft[c.key] >= 100, `More to ${c.name}`)}
          <Pressable accessibilityRole="button" accessibilityLabel={`All to ${c.name}`} hitSlop={6} disabled={busy || draft[c.key] === 100} onPress={() => all(c.key)} style={({ pressed }) => ({ marginLeft: 4, paddingHorizontal: 6, height: 36, justifyContent: "center", borderWidth: 1, borderColor: draft[c.key] === 100 ? C.line : C.ink, opacity: pressed ? 0.5 : 1 })}>
            <Text style={mono(9.5, true, draft[c.key] === 100 ? C.line : C.ink, 0.06)}>100%</Text>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: "row", columnGap: 10, marginTop: 14 }}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={even} style={({ pressed }) => ({ flex: 1, borderWidth: 2, borderColor: C.ink, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontFamily: F.black, fontSize: 14, color: C.ink, textTransform: "uppercase" }}>Split evenly</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || sum !== 100}
          onPress={() => {
            onSave(draft);
            setDraft(null);
          }}
          style={({ pressed }) => ({ flex: 1, backgroundColor: C.accent, borderWidth: 2, borderColor: C.accent, paddingVertical: 12, alignItems: "center", opacity: busy || sum !== 100 ? 0.4 : pressed ? 0.7 : 1 })}
        >
          <Text style={{ fontFamily: F.black, fontSize: 14, color: "#FFFFFF", textTransform: "uppercase" }}>{busy ? "Saving" : "Save"}</Text>
        </Pressable>
      </View>
      <View style={{ alignSelf: "flex-start", marginTop: 12 }}>{link("Cancel", () => setDraft(null))}</View>
    </View>
  );
}

/* THE TOTAL, THE GOAL, THE RECEIPTS (owner, 2026-11-25: "bring back
 * whatever we had, like a total ... We had a good, like, a receipts up
 * there"). The total big and blue, labelled RAISED ($0.00 and STARTS NOV 26
 * before the window); the goal; CONCEPT2 and ROWTEMBER, each opening the
 * math (M2dFaq), ROWTEMBER's charities under it. */
function Raised({ v, onFaq }: { v: M2dView; onFaq: (k: "concept2" | "rowtember") => void }) {
  const t = v.totals;
  const total = totalOf(v);
  const by = v.match?.by ?? "ROWTEMBER";
  const sub = (k: string, d: number) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 5, paddingLeft: 14 }}>
      <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.gray }}>{k}</Text>
      <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.gray, fontVariant: ["tabular-nums"] }}>{usd(d)}</Text>
    </View>
  );
  return (
    <View style={{ marginTop: 22 }}>
      <Text accessibilityLabel={`${usd(total)} raised`} style={{ fontFamily: F.black, fontSize: 64, lineHeight: 70, color: C.accent, fontVariant: ["tabular-nums"] }}>
        {usd(total)}
      </Text>
      <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 4 }]}>
        Raised{v.window.started ? <Text style={mono(11, false, C.gray, 0.12)}> · {fmtInt(t.meters)} m rowed</Text> : null}
      </Text>
      {/* NO GOAL (owner, 2026-11-26: "Remove the M2D goal of $1000 I don't
          want the bar or a public goal"). */}
      {/* More room between the bar and the receipts (owner, 2026-11-25). */}
      <View style={{ marginTop: 34, borderTopWidth: 2, borderColor: C.ink }}>
        <Item who="Concept2" rate="2¢/km once a rower passes 100K, 4¢ after" d={usd(t.raised)} onPress={() => onFaq("concept2")} />
        <Item who={by} rate={matchWord(v)} d={usd(t.matched ?? 0)} onPress={() => onFaq("rowtember")} />
        {giversOf(v).map((g) => (
          <Item key={g.name} who={g.name} rate={`${centsWord(g.cents ?? 0)}/km pledged, up to ${usd(g.cap ?? 0)}`} d={usd(g.dollars)} />
        ))}
        {(v.charities ?? []).map((c) => sub(c.name, t.split?.[c.key] ?? 0))}
        {(t.unpicked ?? 0) > 0 ? sub("No charity picked yet", t.unpicked ?? 0) : null}
        <TotalItem d={usd(total)} />
      </View>
    </View>
  );
}

/* THE M2D TAB: the total, the goal, the receipts, the board. Registering
 * and the charity live on the profile (owner, 2026-11-25: "get rid of the
 * register ... all this shit should be gone. It's already done"); a rower
 * not yet in gets one small JOIN M2D, which opens the steps here. A tap on
 * CONCEPT2 or ROWTEMBER opens the math (M2dFaq) in place. */
export function M2dScreen({ onRower, onScrollDir, onShareables }: { onRower: (n: number) => void; onScrollDir?: (down: boolean) => void; onShareables?: () => void }) {
  const dir = useScrollDir(onScrollDir);
  const { data: v, error, loading, reload } = useM2d();
  const inOut = useIn(v ?? null, reload);
  const [faq, setFaq] = useState<"concept2" | "rowtember" | "all" | null>(null);
  const [joining, setJoining] = useState(false);
  if (!v) return <Waiting error={error} onRetry={reload} />;
  if (faq) return <M2dFaq v={v} focus={faq} onBack={() => setFaq(null)} onScrollDir={onScrollDir} onCharity={v.me ? () => onRower(v.me!.rowerNumber) : undefined} />;
  const w = v.window;
  let place = 0;
  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        <Dateline left="Concept2 Holiday Challenge" right={windowWord(v)} days={w.days} day={w.day} />
        <Raised v={v} onFaq={setFaq} />
        {/* WHAT A KILOMETER IS WORTH LIVES IN THE FAQ (owner, 2026-11-26:
            "What a kilo is worth might be better on the faqs"), reached by
            the one M2D FAQ link under the board. */}
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 36, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink, flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ flex: 1, fontFamily: F.black, fontSize: 17, lineHeight: 18, color: C.ink, textTransform: "uppercase" }}>The board</Text>
        {/* ONE WAY TO SHARE (owner, 2026-11-26: "We already have 2 links for
            shareable, could prob condense"): the board's head opens the
            Shareables page. */}
        {v.me && onShareables ? (
          <Pressable accessibilityRole="link" accessibilityLabel="Shareables" hitSlop={10} onPress={onShareables} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={[mono(10, true, C.accent, 0.12), { textDecorationLine: "underline" }]}>Shareables ↗</Text>
          </Pressable>
        ) : <Text style={mono(10, false, C.gray, 0.1)}>Meters · $</Text>}
      </View>
      {!w.started ? (
        <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14, lineHeight: 18 }]}>The board opens Nov 26. Every meter from then counts.</Text>
      ) : v.rows.length === 0 ? (
        <Text style={[mono(11, false, C.gray), { paddingHorizontal: 20, paddingVertical: 14 }]}>Nobody has rowed yet.</Text>
      ) : (
        v.rows.map((r) => <Line key={r.rowerNumber} r={r} place={r.blocks === undefined ? ++place : null} onPress={() => onRower(r.rowerNumber)} />)
      )}
      {v.rows.some((r) => !r.in) ? (
        <Text style={[mono(9.5, false, C.gray, 0.1), { paddingHorizontal: 20, paddingTop: 14, lineHeight: 15 }]}>Grey dollars: not registered yet. Register and they count.</Text>
      ) : null}

      {/* JOINING, BELOW THE BOARD (owner, 2026-11-25: "they just need to be
          at the bottom, I think, below the board"). */}
      <View style={{ paddingHorizontal: 20 }}>
        {v.me && !v.me.in && !w.over ? (
          joining ? (
            <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick && inOut.pick !== EVEN ? inOut.pick : undefined)} />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setJoining(true)}
              style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 18, backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: F.black, fontSize: 14, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.4 }}>Opt in to M2D</Text>
            </Pressable>
          )
        ) : null}
        {inOut.note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{inOut.note}</Text> : null}
      </View>
      {/* THE REELS AND STICKERS ON A PAGE OF THEIR OWN (owner, 2026-11-26:
          "when I scroll left and right, it actually just moves the tab ...
          we should also have this on a shareables page maybe, instead of
          just right here ... We should probably have a shareables link"). */}
      <View style={{ flexDirection: "row", columnGap: 18, marginHorizontal: 20, marginTop: 14 }}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => setFaq("all")}>
          <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>M2D FAQ</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Line({ r, place, onPress }: { r: M2dRow; place: number | null; onPress: () => void }) {
  const hidden = r.blocks !== undefined;
  const frac = hidden ? 0 : Math.min(1, r.meters / 100_000);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${place ? `Place ${place}, ` : ""}rower ${r.rowerNumber}, ${r.name}, ${hidden ? "hidden" : `${fmtInt(r.meters)} meters, ${usd(r.dollars ?? 0)}${r.in ? "" : ", not registered"}`}`} onPress={onPress} style={{ paddingHorizontal: 20 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 150, top: 0, bottom: 1 }}>
        <View style={{ height: "100%", width: `${frac * 100}%`, backgroundColor: r.me ? C.washMe : C.wash }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10, minHeight: 42, paddingTop: 11, paddingBottom: 10, borderBottomWidth: 1, borderColor: C.line }}>
        <Text style={{ width: 26, fontFamily: r.me ? F.monoBold : F.mono, fontSize: 13, color: r.me ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{place ?? ""}</Text>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.ink }}>
          <Text style={{ fontFamily: r.me ? F.monoBold : F.mono, fontSize: 12, color: r.me ? C.accent : C.gray }}>{String(r.rowerNumber).padStart(3, "0")} · </Text>
          {r.name}
        </Text>
        {hidden ? (
          <Blocks n={r.blocks ?? 5} size={13} />
        ) : (
          <>
            <Text style={{ width: 72, textAlign: "right", fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(r.meters)}</Text>
            <Text style={{ width: 62, textAlign: "right", fontFamily: F.monoBold, fontSize: 13, color: r.in ? C.accent : C.line, fontVariant: ["tabular-nums"] }}>{usd(r.dollars ?? 0)}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

/* THE PROFILE'S THIRD COLUMN (owner: "for everyone else, that third column
 * can be a tracker for this thing, and it needs to link to their site ...
 * if they're not opted in, how do you opt in?"). On the rower's own page:
 * the steps until they are in, then their dollars. On somebody else's:
 * their line of the board. */
export function M2dPanel({ num, own, onFaq }: { num: number; own: boolean; onFaq?: () => void }) {
  const { data: v, error, reload } = useM2d();
  const inOut = useIn(v ?? null, reload);
  if (!v) return <Waiting error={error} onRetry={reload} />;
  const matchOn = !!v.match?.on && !!v.charities?.length;
  const by = v.match?.by ?? "ROWTEMBER";
  const row = v.rows.find((r) => r.rowerNumber === num);
  const meters = own ? (v.me?.meters ?? 0) : (row?.meters ?? 0);
  const isIn = own ? !!v.me?.in : !!row?.in;
  const hidden = !own && row?.blocks !== undefined;
  const c2 = own && v.me?.concept2 !== undefined ? v.me.concept2 : concept2Of(meters);
  const ours = own && v.me?.rowtember !== undefined ? v.me.rowtember : rowtemberOf(meters, rateOf(v));
  /* Gifts are fixed sums on the M2D tab's receipt, not a rower's own. */
  const theirs: { name: string; rate: number; d: number }[] = [];
  const d = own ? (v.me?.dollars ?? 0) : (row?.dollars ?? 0);
  return (
    <View style={{ paddingTop: 18, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={mono(10, true, C.ink, 0.12)}>M2D · {windowWord(v)}</Text>
        {own && v.me ? <ShareBtn label="Share" only="m2d-me,m2d-day,m2d-mark" /> : null}
      </View>
      {hidden ? (
        <View style={{ marginTop: 18 }}>
          <Blocks n={row?.blocks ?? 5} size={20} />
        </View>
      ) : (
        <>
          <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: isIn ? C.accent : C.gray, marginTop: 16, fontVariant: ["tabular-nums"] }}>{usd(d)}</Text>
          <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 2 }]}>{isIn ? (own ? "Your meters raised" : "Raised") : "Not registered yet"}</Text>
          {/* THE RECEIPT (owner, 2026-11-25: "It needs to be you rowed this
              many meters, Concept2 is giving you this much money for your
              meters, we are giving you this much money for your meters").
              No graph. */}
          <View style={{ marginTop: 22, borderTopWidth: 2, borderColor: C.ink }}>
            <Item who={own ? "You rowed" : "Rowed"} rate="Nov 26 to Dec 24" d={`${fmtInt(meters)} m`} />
            <Item who="Concept2" rate={meters < 100_000 ? `Starts at 100K · ${fmtInt(100_000 - meters)} m to go` : "2¢/km for the first 100 km, 4¢ after"} d={usd(c2)} />
            <Item who={by} rate={matchWord(v)} d={usd(ours)} />
            {theirs.map((g) => (
              <Item key={g.name} who={g.name} rate={`${centsWord(g.rate)}/km pledged`} d={usd(g.d)} />
            ))}
            <TotalItem d={usd(c2 + ours + theirs.reduce((a, g) => a + g.d, 0))} />
          </View>
        </>
      )}
      {own && v.me?.in && matchOn ? <Split v={v} busy={inOut.busy} onSave={(s) => inOut.say(true, undefined, s)} /> : null}
      {/* WHERE IT GOES IS THE FAQ'S (owner, 2026-11-26: "Put the where it
          goes ... below the split of your charities actually maybe we just
          link to the faqs for it"). */}
      {own && onFaq ? (
        <Pressable accessibilityRole="link" hitSlop={8} onPress={onFaq} style={{ alignSelf: "flex-start", marginTop: 16 }}>
          <Text style={[mono(10, true, C.accent, 0.12), { textDecorationLine: "underline" }]}>Where it goes · M2D FAQ ↗</Text>
        </Pressable>
      ) : null}
      {/* Registering and Concept2 at the foot (owner, 2026-11-25). */}
      {own && v.me && !v.me.in && !v.window.over ? (
        <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick && inOut.pick !== EVEN ? inOut.pick : undefined)} />
      ) : null}
      {own && v.me?.in ? <Status v={v} busy={inOut.busy} onUndo={() => inOut.say(false)} /> : null}
      {!own ? (
        <View style={{ marginTop: 22 }}>
          <Ctl label="The challenge at Concept2 ↗" onPress={() => open(v.link)} />
        </View>
      ) : null}
      {inOut.note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{inOut.note}</Text> : null}
    </View>
  );
}

/* THE MATH (owner, 2026-11-25: tapping CONCEPT2 or ROWTEMBER in the
 * receipts opens a page that shows it). Concept2's rule and its total;
 * ROWTEMBER's meters x rate and its split by charity; the short questions.
 * The site's twin is /m2d/faq (row100k/m2d/faq/page.tsx). */
/* THE MATH AS A PAGE, behind the ? in the bar on the M2D tab (owner,
 * 2026-11-25: "The how it adds up button should be ... up at the top where
 * we have the bell ... a little question mark thing"). */
/* M2D SHAREABLES, opened from the M2D tab: the stickers, then the
 * count-up reels (owner, 2026-11-26: "an animation for a reel for
 * animating the money and meters going up for M2D"), my meters and dollars
 * rolling up and everyone's, to film over a video. A page over the tabs, so
 * scrolling the reel tiles sideways no longer swipes to the next tab. */
export function M2dSharePage({ onScrollDir }: { onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { data: v, error, reload } = useM2d();
  if (!v) return <Waiting error={error} onRetry={reload} />;
  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 132 }}>
      <StickerTiles title="M2D stickers" only={v.me ? "m2d-all,m2d-me,m2d-day,m2d-mark" : "m2d-all,m2d-day,m2d-mark"} empty="The M2D stickers open Nov 26, with the first meters." />
      {v.me ? <Reels src={M2D_REELS} title="M2D reels" aside="Counting up" /> : <Text style={[mono(11, false, C.gray), { marginTop: 18 }]}>Sign in for the reels.</Text>}
    </ScrollView>
  );
}

export function M2dFaqPage({ onScrollDir, onRower }: { onScrollDir?: (down: boolean) => void; onRower?: (n: number) => void }) {
  const { data: v, error, reload } = useM2d();
  if (!v) return <Waiting error={error} onRetry={reload} />;
  return <M2dFaq v={v} focus="all" onScrollDir={onScrollDir} onCharity={v.me && onRower ? () => onRower(v.me!.rowerNumber) : undefined} />;
}

/* THE M2D FAQ (owner, 2026-11-26: "this page should be a M2D FAQ and a
 * section of that is the how it adds up"): HOW IT ADDS UP, HOW DO I LOG A
 * ROW, QUESTIONS. */
export function M2dFaq({ v, focus, onBack, onScrollDir, onCharity }: { v: M2dView; focus: "concept2" | "rowtember" | "all"; onBack?: () => void; onScrollDir?: (down: boolean) => void; onCharity?: () => void }) {
  const dir = useScrollDir(onScrollDir);
  const t = v.totals;
  const by = v.match?.by ?? "ROWTEMBER";
  const rate = rateOf(v);
  const [y, setY] = useState<{ concept2: number; rowtember: number }>({ concept2: 0, rowtember: 0 });
  const ref = useRef<{ scrollTo: (o: { y: number; animated?: boolean }) => void } | null>(null);
  const jumped = useRef(false);
  const head = (k: "concept2" | "rowtember", label: string, d: number) => (
    <View
      onLayout={(e) => {
        const at = e.nativeEvent.layout.y;
        setY((o) => ({ ...o, [k]: at }));
        if (!jumped.current && focus === k && at > 0) {
          jumped.current = true;
          ref.current?.scrollTo({ y: at - 10, animated: false });
        }
      }}
      style={{ marginTop: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}
    >
      <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontFamily: F.black, fontSize: 26, color: C.accent, fontVariant: ["tabular-nums"] }}>{usd(d)}</Text>
    </View>
  );
  const para = (s: string) => <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 22, color: C.ink, marginTop: 10 }}>{s}</Text>;
  const row = (k: string, d: string) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{d}</Text>
    </View>
  );
  const q = (h: string, a: string) => (
    <View key={h} style={{ marginTop: 16 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{h}</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 14.5, lineHeight: 21, color: C.gray, marginTop: 3 }}>{a}</Text>
    </View>
  );
  void y;
  const section = (h: string) => (
    <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink, textTransform: "uppercase", marginTop: 30, paddingBottom: 8, borderBottomWidth: 2, borderColor: C.ink }}>{h}</Text>
  );
  return (
    <ScrollView ref={ref as never} {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132, paddingHorizontal: 20 }}>
      {onBack ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onBack} style={{ alignSelf: "flex-start", marginBottom: 14 }}>
          <Text style={mono(11, true, C.ink, 0.12)}>‹ M2D</Text>
        </Pressable>
      ) : null}
      <Text style={{ fontFamily: F.black, fontSize: 30, lineHeight: 34, color: C.ink, textTransform: "uppercase" }}>M2D FAQ</Text>
      {section("How it adds up")}
      <PerKm v={v} />

      {head("concept2", "Concept2", t.raised)}
      {para("Every rower who reaches 100,000 meters between Nov 26 and Dec 24 earns a donation from Concept2: 2¢ a kilometer for the first 100, then 4¢ a kilometer after that. It goes to the charity the rower picks in their Concept2 Logbook.")}
      {/* A TABLE, NOT A SENTENCE (owner, 2026-11-26: "When showing the list
          of meters and dollars prob better in a table"). */}
      <View style={{ marginTop: 10, borderTopWidth: 2, borderColor: C.ink }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderColor: C.ink }}>
          <Text style={mono(10, true, C.ink, 0.12)}>Meters</Text>
          <Text style={mono(10, true, C.ink, 0.12)}>From Concept2</Text>
        </View>
        {([[100_000, 2], [150_000, 4], [200_000, 6], [300_000, 10]] as const).map(([m, d]) => row(`${fmtInt(m)} m`, usd(d)))}
      </View>
      {para(`Our figure adds that up for every registered Rowtember rower past 100K, from the rows logged on ROW: ${t.past100k} ${t.past100k === 1 ? "rower" : "rowers"} so far, ${usd(t.raised)}. Concept2 counts the meters in each Logbook, so its own number can differ.`)}

      {head("rowtember", by, t.matched ?? 0)}
      {para(`${by} matches Concept2: ${centsWord(rate)} for every kilometer a registered rower logs on ROW, from the first meter.`)}
      <View style={{ marginTop: 10, borderTopWidth: 2, borderColor: C.ink }}>
        {row("Meters by registered rowers", `${fmtInt(t.inMeters ?? 0)} m`)}
        {row(`Kilometers × ${centsWord(rate)}`, `${fmtInt((t.inMeters ?? 0) / 1000)} km`)}
        {row(by, usd(t.matched ?? 0))}
      </View>
      {/* WHERE IT GOES, SHORT (owner, 2026-11-26: "this can mostly be
          replaced by less text or even just a button that takes them to
          where they can select their charity"). */}
      {para("Where it goes, so far:")}
      <View style={{ marginTop: 6, borderTopWidth: 2, borderColor: C.ink }}>
        {(v.charities ?? []).map((c) => row(c.full, usd(t.split?.[c.key] ?? 0)))}
        {(t.unpicked ?? 0) > 0 ? row("No charity picked yet", usd(t.unpicked ?? 0)) : null}
      </View>
      {onCharity ? (
        <View style={{ marginTop: 14 }}>
          <Ctl label="Pick my charity" onPress={onCharity} />
        </View>
      ) : null}

      {/* HOW TO LOG (owner, 2026-11-26: "we don't want to have them connect
          to the rower with their phone and submit that way we instead want to
          show them how to log on the concept 2 site ... We want users to use
          our app to connect the ergs"): ROW on the monitor, then the same row
          typed into log.concept2.com. Both places. */}
      {section("How do I log a row?")}
      {para("Log every row in both places: on ROW for the board and the match, and in your Concept2 Logbook for Concept2's part.")}
      {(
        [
          ["1. On ROW", [["Connect ROW to the monitor", "Tap the + at the top of the ROW app and connect to the monitor by Bluetooth before you start."], ["Row", "The row logs itself, with the full telemetry. Save it, and it counts for M2D right away."]]],
          ["2. On Concept2", [["Open log.concept2.com", "Sign in to your Concept2 Logbook."], ["Add Workout", "Type the same row in: the meters, the time and the date. Save."], ["Check it counted", "Open the Holiday Challenge in your Logbook: your meters toward 100K are there. Meters can go in until Jan 4."]]],
        ] as [string, [string, string][]][]
      ).map(([who, steps]) => (
        <View key={who} style={{ marginTop: 16 }}>
          <Text style={mono(10, true, C.ink, 0.12)}>{who}</Text>
          {steps.map(([h, t], i) => (
            <View key={h} style={{ flexDirection: "row", columnGap: 12, marginTop: 12 }}>
              <Text style={{ width: 20, fontFamily: F.black, fontSize: 17, color: C.accent }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{h}</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.gray, marginTop: 2 }}>{t}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      {section("Questions")}
      {q("When is it?", "Thursday, Nov 26 to Thursday, Dec 24. Concept2 takes meters into the Logbook until Jan 4.")}
      {q("How do I register?", `Make a free Concept2 Logbook, pick a charity there, and add your rows there at log.concept2.com. Then press Opt in to M2D on the M2D tab, pick where ${by}'s part goes, and press I'm registered.`)}
      {q("How do I change my charity?", "On your profile, under M2D, until Dec 24. You can split it across the three there too.")}
      {q("What counts?", `For ${by}: rows logged on ROW from Nov 26 to Dec 24 by registered rowers. For Concept2: the meters in your Concept2 Logbook.`)}
      {q("Is there a limit?", `${by} matches up to $1,000.`)}
      {q("Does it cost me anything?", "No. It is free.")}
      <View style={{ marginTop: 18 }}>
        <Ctl label="The challenge at Concept2 ↗" onPress={() => open(v.link)} />
      </View>
    </ScrollView>
  );
}

/* M2D ON THE STATS TAB (owner, 2026-11-25: M2D a time frame in the
 * picker, "Dollars raised" its metric, the top men and the top women in
 * dollars, and a See all rankings). Drawn by Stats.tsx when the time frame
 * is M2D. Dollars are Concept2's and ROWTEMBER's for each rower's meters,
 * the board's own; a hidden rower stays hidden. */
export function M2dStatsView({ onRower }: { onRower: (n: number) => void }) {
  const { data: v, error, reload } = useM2d();
  const [all, setAll] = useState(false);
  const [who, setWho] = useState<"all" | "M" | "F">("all");
  if (!v) return <Waiting error={error} onRetry={reload} />;
  const shown = v.rows.filter((r) => r.blocks === undefined && (r.dollars ?? 0) > 0).sort((a, b) => (b.dollars ?? 0) - (a.dollars ?? 0));
  const top = shown[0];
  const table = (label: string, rows: M2dRow[]) => (
    <View key={label} style={{ marginTop: 22 }}>
      <Text style={[mono(10, true, C.ink, 0.12), { paddingBottom: 8, borderBottomWidth: 1, borderColor: C.ink }]}>{label}</Text>
      {rows.length === 0 ? (
        <Text style={[mono(10, false, C.gray, 0.1), { paddingVertical: 10 }]}>Nobody yet.</Text>
      ) : (
        rows.map((r, i) => (
          <Pressable key={r.rowerNumber} accessibilityRole="link" onPress={() => onRower(r.rowerNumber)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ width: 24, fontFamily: F.mono, fontSize: 13, color: C.gray }}>{i + 1}</Text>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: r.me ? C.accent : C.ink }}>
              {r.name}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: r.in ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{usd(r.dollars ?? 0)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
  return (
    <View>
      {top ? (
        <View style={{ marginTop: 18 }}>
          <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.accent, fontVariant: ["tabular-nums"] }}>{usd(top.dollars ?? 0)}</Text>
          <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 2 }]}>
            {top.name} · {fmtInt(top.meters)} m
          </Text>
        </View>
      ) : (
        <Text style={[mono(11, false, C.gray, 0.1), { marginTop: 18 }]}>{v.window.started ? "Nobody has rowed yet." : "M2D starts Nov 26."}</Text>
      )}
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 10, lineHeight: 16 }]}>
        {usd(totalOf(v))} raised · {fmtInt(v.totals.meters)} m · dollars are Concept2&apos;s and {v.match?.by ?? "ROWTEMBER"}&apos;s for each rower
      </Text>
      {all ? (
        <>
          <View style={{ flexDirection: "row", columnGap: 18, marginTop: 22 }}>
            {(["all", "M", "F"] as const).map((k) => (
              <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: who === k }} onPress={() => setWho(k)} hitSlop={6}>
                <Text style={[mono(11, true, who === k ? C.accent : C.gray, 0.12), who === k ? { textDecorationLine: "underline" } : null]}>{k === "all" ? "Everyone" : k === "M" ? "Men" : "Women"}</Text>
              </Pressable>
            ))}
          </View>
          {table("M2D rankings · Dollars raised", shown.filter((r) => who === "all" || r.division === who))}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAll(false)} style={{ alignSelf: "flex-start", marginTop: 14 }}>
            <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>Back to the top five</Text>
          </Pressable>
        </>
      ) : (
        <>
          {table("Men · Dollars raised", shown.filter((r) => r.division === "M").slice(0, 5))}
          {table("Women · Dollars raised", shown.filter((r) => r.division === "F").slice(0, 5))}
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAll(true)} style={{ alignSelf: "flex-start", marginTop: 16 }}>
            <Text style={[mono(11, true, C.ink, 0.12), { textDecorationLine: "underline" }]}>See all rankings</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/* THE OWNER'S COST PLANNER (owner, 2026-11-25), in the developer
 * settings: what M2D costs at the rate, projected low / likely / high, what
 * each cent a kilometer costs, a budget's rate, a rate's cost, and the
 * rate itself, set here and live at once (api/row100k/app/m2d/plan). The
 * site's twin is /dev/m2d-plan. 1¢ a kilometer is $1 for every 100K m. */
type Plan = {
  window: { day: number; days: number };
  rate: number;
  givers?: { name: string; cents: number }[];
  picks?: { key: string; name: string; rowers: number; pct: number }[];
  unpicked?: number;
  soFar: { meters: number; inMeters: number; rowers: number; registered: number; cost: number };
  history: { high: { label: string; meters: number; rowers: number }; low: { label: string; meters: number; rowers: number } };
  projected: { low: number; likely: number; high: number };
  basis: "pace" | "history";
};
const PLAN_PATH = "/api/row100k/app/m2d/plan";
const costOf = (meters: number, c: number) => (meters / 1000) * (c / 100);
/* The rate a budget covers, down to a hundredth of a cent. */
const rateFor = (budget: number, meters: number) => (meters > 0 ? Math.floor(((budget * 100) / (meters / 1000)) * 100) / 100 : 0);
export function M2dPlanner() {
  const { data, error, reload } = useLoad(() => api<Plan>(PLAN_PATH), [], PLAN_PATH);
  const [p, setP] = useState<Plan | null>(null);
  const [rateIn, setRateIn] = useState("");
  const [budget, setBudget] = useState("1000");
  const [tryRate, setTryRate] = useState("10");
  const [say, setSay] = useState("");
  const [busy, setBusy] = useState(false);
  const [gift, setGift] = useState("50");
  const [gName, setGName] = useState("");
  const [gRate, setGRate] = useState("");
  const plan = p ?? data;
  if (!plan) return <Waiting error={error} onRetry={reload} />;
  const { low, likely, high } = plan.projected;
  const b = Number(budget) || 0;
  const r = Number(tryRate) || 0;
  const save = async () => {
    setBusy(true);
    setSay("");
    try {
      const next = await api<Plan>(PLAN_PATH, { body: { rate: Number(rateIn) } });
      setP(next);
      setRateIn("");
      setSay(`Saved. ROWTEMBER matches at ${centsWord(next.rate)} a kilometer, on every meter in the window.`);
    } catch (err) {
      setSay(err instanceof Error ? err.message : "That did not save.");
    }
    setBusy(false);
  };
  const givers = plan.givers ?? [];
  const g = Number(gift) || 0;
  const saveGivers = async (next: { name: string; cents: number }[]) => {
    setBusy(true);
    setSay("");
    try {
      const res = await api<Plan>(PLAN_PATH, { body: { givers: next } });
      setP(res);
      setGName("");
      setGRate("");
      setSay("Saved. The receipts show it now.");
    } catch (err) {
      setSay(err instanceof Error ? err.message : "That did not save.");
    }
    setBusy(false);
  };
  const row = (k: string, d: string) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{d}</Text>
    </View>
  );
  const head = (s: string) => <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase", marginTop: 24, paddingBottom: 6, borderBottomWidth: 2, borderColor: C.ink }}>{s}</Text>;
  const input = (value: string, set: (s: string) => void, label: string) => (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={set}
      keyboardType="decimal-pad"
      placeholder={label}
      placeholderTextColor={C.gray}
      style={{ marginTop: 10, borderWidth: 1, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: 8, fontFamily: F.mono, fontSize: 16, color: C.ink }}
    />
  );
  /* THE EXPOSURE, first and big (owner, 2026-11-25: "exposure liability
   * for M2D"): the high case at the rate, then what is owed so far. */
  const pledged = (plan.givers ?? []).reduce((a, x) => a + x.cents, 0);
  return (
    <View>
      <Text style={[mono(10, true, C.ink, 0.12), { marginTop: 8 }]}>Exposure · high case at {centsWord(plan.rate)}/km</Text>
      <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 6 }}>{usd(costOf(high, plan.rate))}</Text>
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4, lineHeight: 16 }]}>
        Likely {usd(costOf(likely, plan.rate))} · low {usd(costOf(low, plan.rate))} · owed so far {usd(plan.soFar.cost)}
        {pledged ? ` · pledges add ${centsWord(pledged)}/km` : ""}
      </Text>
      {head(`So far · day ${plan.window.day} of ${plan.window.days}`)}
      {row("Meters in the window", `${fmtInt(plan.soFar.meters)} m`)}
      {row(`By registered rowers (${plan.soFar.registered})`, `${fmtInt(plan.soFar.inMeters)} m`)}
      {row(`ROWTEMBER so far at ${centsWord(plan.rate)}/km`, usd(plan.soFar.cost))}
      {plan.picks ? (
        <>
          {head(`What rowers picked · ${plan.soFar.registered} registered`)}
          {plan.picks.map((c) => row(`${c.name} · ${c.rowers} ${c.rowers === 1 ? "rower" : "rowers"}`, `${c.pct}%`))}
          {plan.unpicked ? row("No pick yet", `${plan.unpicked}`) : null}
        </>
      ) : null}
      {head(`Projected · ${plan.basis === "pace" ? "from the pace" : "from history"}`)}
      {row(`Low · ${fmtInt(low)} m`, usd(costOf(low, plan.rate)))}
      {row(`Likely · ${fmtInt(likely)} m`, usd(costOf(likely, plan.rate)))}
      {row(`High · ${fmtInt(high)} m`, usd(costOf(high, plan.rate)))}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>
        High is {plan.history.high.label}: {fmtInt(plan.history.high.meters)} m by {plan.history.high.rowers}. Low is {plan.history.low.label}: {fmtInt(plan.history.low.meters)} m by {plan.history.low.rowers}. Everyone&apos;s meters: ROWTEMBER pays registered rowers&apos; only, so these are ceilings.
      </Text>
      {head("Each 1¢ a kilometer")}
      {/* THE PRICE TO SELL A CENT AT (owner, 2026-11-25: "give me a best
          guess somewhere here that says sell 1 cent at this amount"): the
          likely case rounded up to $5, the same as /m2d/give (m2d.ts
          m2dPrice). */}
      {row("Sell 1¢ at", usd(Math.max(5, Math.ceil(costOf(likely, 1) / 5) * 5)))}
      {row("Low · likely · high", `${usd(costOf(low, 1))} · ${usd(costOf(likely, 1))} · ${usd(costOf(high, 1))}`)}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8 }]}>1¢/km is $1 for every 100K meters.</Text>
      {/* A DONATION, IN CENTS A KILOMETER (owner, 2026-11-25: "I just got a
          donation of $50. How much does that raise our cents per whatever?"). */}
      {head("A donation → ¢/km")}
      {input(gift, setGift, "Donation, $")}
      {row("Adds, if the high case is rowed", `${centsWord(rateFor(g, high))}/km`)}
      {row("Adds, if the likely case is rowed", `${centsWord(rateFor(g, likely))}/km`)}
      {row("Adds, on the meters so far", `${centsWord(rateFor(g, plan.soFar.inMeters))}/km`)}
      {head("Budget → rate")}
      {input(budget, setBudget, "Budget, $")}
      {row("Covers, high case", `${centsWord(rateFor(b, high))}/km`)}
      {row("Covers, likely case", `${centsWord(rateFor(b, likely))}/km`)}
      {head("Rate → cost")}
      {input(tryRate, setTryRate, "Cents a km")}
      {row("Low · likely · high", `${usd(costOf(low, r))} · ${usd(costOf(likely, r))} · ${usd(costOf(high, r))}`)}
      {/* THE OTHER GIVERS: a line each on the receipts, a pledge in cents a
          kilometer. Live at once. */}
      {head(`Pledges · ${givers.length} · up to $75 a cent`)}
      {givers.map((x, i) => (
        <View key={x.name} style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{x.name}</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent }}>{centsWord(x.cents)}/km · ≤{usd(x.cents * 75)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Take ${x.name} off`} hitSlop={8} disabled={busy} onPress={() => void saveGivers(givers.filter((_, j) => j !== i))}>
            <Text style={[mono(10, true, C.gray, 0.1), { textDecorationLine: "underline" }]}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <TextInput
        accessibilityLabel="Giver's name"
        value={gName}
        onChangeText={setGName}
        placeholder="Name on the receipt"
        placeholderTextColor={C.gray}
        maxLength={40}
        style={{ marginTop: 10, borderWidth: 1, borderColor: C.ink, paddingHorizontal: 10, paddingVertical: 8, fontFamily: F.sans, fontSize: 16, color: C.ink }}
      />
      {input(gRate, setGRate, "Pledge, cents a km")}
      <View style={{ marginTop: 12 }}>
        <Go label={busy ? "Saving" : "Add the giver"} disabled={busy || !gName.trim() || !(Number(gRate) > 0)} onPress={() => void saveGivers([...givers, { name: gName.trim(), cents: Math.round(Number(gRate) * 100) / 100 }])} />
      </View>
      {head(`ROWTEMBER's rate · ${centsWord(plan.rate)}/km`)}
      <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.gray, marginTop: 8 }}>Live at once, no update. It applies to every meter in the window, the ones already rowed included.</Text>
      {input(rateIn, setRateIn, `Cents a km (now ${plan.rate})`)}
      <View style={{ marginTop: 12 }}>
        <Go label={busy ? "Saving" : "Set the rate"} disabled={busy || !rateIn || Number(rateIn) === plan.rate} onPress={() => void save()} />
      </View>
      {say ? <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 10, lineHeight: 17 }]}>{say}</Text> : null}
    </View>
  );
}

/* M2D'S RETURN (owner, 2026-11-25 evening: "a section for my ROI. And that
 * should keep going and analyzing after M2D is done ... I started during
 * M2D versus I just rowed during M2D. And then keep track of if they
 * continue"), in his settings under M2D exposure. The site works it out
 * (row100k/m2dReturn.ts, api/row100k/app/m2d/return); this only prints it.
 * STARTED: first row ever on ROW in the window. ROWED: rowed on ROW before
 * Nov 26 and in the window too. After Dec 24, each stretch shows how many
 * of each class logged a row in it. */
type Klass = { rowers: number; registered: number; meters: number; after: number[]; last30: number };
type Return = {
  window: { first: string; last: string; over: boolean };
  today: string;
  cost: number;
  cap: number;
  started: Klass;
  rowed: Klass;
  stretches: { label: string; first: string; last: string; partial: boolean }[];
  perStarted: number | null;
  perStartedStill: number | null;
};
const RETURN_PATH = "/api/row100k/app/m2d/return";
const pctOf = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "—");
export function M2dReturn() {
  const { data, error, reload } = useLoad(() => api<Return>(RETURN_PATH), [], RETURN_PATH);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const d = data;
  const row = (k: string, v: string, sub?: string) => (
    <View key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", columnGap: 10 }}>
        <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{k}</Text>
        <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{v}</Text>
      </View>
      {sub ? <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 3 }]}>{sub}</Text> : null}
    </View>
  );
  const head = (s: string) => <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase", marginTop: 24, paddingBottom: 6, borderBottomWidth: 2, borderColor: C.ink }}>{s}</Text>;
  const klass = (name: string, k: Klass, what: string) => (
    <>
      {head(`${name} · ${k.rowers}`)}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 6, lineHeight: 15 }]}>{what}</Text>
      {row("Opted in to M2D", `${k.registered}`, k.rowers ? `${pctOf(k.registered, k.rowers)} of them` : undefined)}
      {row("Meters in the window", `${fmtInt(k.meters)} m`)}
      {d.stretches.length ? (
        <>
          {d.stretches.map((s, i) => row(`Rowed in ${s.label}${s.partial ? " (so far)" : ""}`, `${k.after[i]}`, pctOf(k.after[i], k.rowers)))}
          {row("Rowed in the last 30 days", `${k.last30}`, pctOf(k.last30, k.rowers))}
        </>
      ) : null}
    </>
  );
  return (
    <View>
      <Text style={[mono(10, true, C.ink, 0.12), { marginTop: 8 }]}>Cost per rower who started in M2D</Text>
      <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.accent, fontVariant: ["tabular-nums"], marginTop: 6 }}>{d.perStarted == null ? "—" : usd(d.perStarted)}</Text>
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 4, lineHeight: 16 }]}>
        ROWTEMBER&apos;s match {usd(d.cost)} of the {usd(d.cap)} cap · {d.started.rowers} started
        {d.perStartedStill != null ? ` · ${usd(d.perStartedStill)} per starter still rowing` : ""}
      </Text>
      {klass("Started in M2D", d.started, "Their first row on ROW was between Nov 26 and Dec 24.")}
      {klass("Rowed in M2D", d.rowed, "They rowed on ROW before Nov 26, and in M2D too.")}
      {!d.stretches.length ? (
        <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 14, lineHeight: 15 }]}>
          Who keeps rowing starts counting on Dec 25: the rest of December, then every month after, for as long as the site runs.
        </Text>
      ) : null}
    </View>
  );
}
