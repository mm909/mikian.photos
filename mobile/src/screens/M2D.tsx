import { useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Bar, Blocks, Waiting, useLoad, useScrollDir } from "../ui";
import { StickerViewer } from "./RowPage";

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
  c2Goal?: number;
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
    givers?: { name: string; rate: number; dollars: number }[];
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
const rateOf = (v: M2dView): number => v.rate ?? 3;
const giversOf = (v: M2dView) => v.totals.givers ?? [];
const perKmOf = (v: M2dView): number => v.perKm ?? rateOf(v) + giversOf(v).reduce((a, g) => a + g.rate, 0);
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
  const by = v.match?.by ?? "ROWTEMBER";
  const all = perKmOf(v);
  const line = (who: string, c: string, note: string) => (
    <View key={who} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", columnGap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink, textTransform: "uppercase" }}>{who}</Text>
        <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 2, lineHeight: 14 }]}>{note}</Text>
      </View>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>{c}</Text>
    </View>
  );
  const sum = (k: string, c: number) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8 }}>
      <Text style={{ fontFamily: F.black, fontSize: 15, color: C.ink, textTransform: "uppercase" }}>{k}</Text>
      <Text style={{ fontFamily: F.black, fontSize: 15, color: C.accent, fontVariant: ["tabular-nums"] }}>{centsWord(c)} / km</Text>
    </View>
  );
  return (
    <View style={{ marginTop: 34 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 8, borderBottomWidth: 2, borderColor: C.ink }}>
        <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase" }}>What a kilometer is worth</Text>
      </View>
      {line("Concept2", "2¢ → 4¢", "Once you pass 100K: 2¢ for each of the first 100 km, 4¢ for every one after")}
      {line(by, centsWord(rateOf(v)), "Every meter logged on ROW, from the first")}
      {giversOf(v).map((g) => line(g.name, centsWord(g.rate), "Pledged on every meter logged on ROW"))}
      {sum("Under 100K", all)}
      {sum("Past 100K", all + 4)}
    </View>
  );
}

/* A SHARE BUTTON: the dollar stickers (share/cards.ts m2d-*), on the dark
 * ground the stickers are made for (owner, 2026-11-25: "this is where a
 * share button should be"). */
function ShareBtn({ label, only }: { label: string; only: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ alignSelf: "stretch", marginTop: 18, backgroundColor: C.ink, paddingVertical: 13, alignItems: "center", opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ fontFamily: F.black, fontSize: 14, color: C.paper, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
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

/* THE STEPS, for a rower not yet in (owner: "Tell them it's 4 steps, or I
 * don't know ... it could just be click here, go opt in"). Concept2's own
 * steps, in its words where they are short; then the one press that tells
 * this app. */
function Steps({ v, onIn, busy, pick, onPick }: { v: M2dView; onIn: () => void; busy: boolean; pick: string | null; onPick: (k: string) => void }) {
  const steps: [string, string][] = [
    ["Make a free Concept2 Logbook", "Sign up at log.concept2.com, or sign in if you have one."],
    ["Pick a charity in your Logbook", "Invictus Games Foundation, Natural Resources Defense Council, War Child USA or Wood4Good, or Let Concept2 Choose. Do Not Donate means your meters raise nothing from Concept2."],
    ["Get your meters into the Logbook", "ErgData sends each row there. Nov 26 to Dec 24; meters can be entered until Jan 4."],
    ["Row 100K", "Concept2 gives once you pass 100K: 2 cents a kilometer, then 4 cents for each one past 100K. 100K earns a certificate, 200K the Holiday Challenge pin (50K for kids and adaptive rowers)."],
    /* The fifth is ours: ROWTEMBER's part is paid on rows logged in ROW. */
    [
      "Log your rows on ROW too",
      `${v.match?.by ?? "ROWTEMBER"} gives ${centsWord(rateOf(v))} for every kilometer logged in ROW, from your first meter. Tap + at the top to log one. Sending your rows to Concept2 automatically is coming.`,
    ],
  ];
  const matchOn = !!v.match?.on && !!v.charities?.length;
  const name = v.charities?.find((c) => c.key === pick)?.name;
  return (
    <View style={{ marginTop: 22, borderWidth: 2, borderColor: C.ink, padding: 16 }}>
      <Text style={{ fontFamily: F.black, fontSize: 19, color: C.ink, textTransform: "uppercase" }}>Join in {steps.length} steps</Text>
      <Text style={[mono(10, false, C.gray, 0.12), { marginTop: 6, lineHeight: 16 }]}>Free. You row; Concept2 and {v.match?.by ?? "ROWTEMBER"} give.</Text>
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
          <Go label={busy ? "Saving" : "I'm registered"} disabled={busy || (matchOn && !pick)} onPress={onIn} />
          <Text style={[mono(9.5, false, C.gray, 0.1), { marginTop: 10, lineHeight: 15 }]}>
            {matchOn && !pick ? "Pick a charity above first." : matchOn && name ? `${name} gets ${v.match?.by}'s part for your meters.` : "Concept2 counts the meters in your Logbook."}
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
    if (v?.me?.in) void say(true, k);
    else setPicked(k);
  };
  return { busy, note, say, pick, onPick };
}

/* REGISTERED, said plainly (owner, 2026-11-25: the REGISTERED / CONCEPT2 /
 * UNDO row needed to be clear): a status, not a link; Open Concept2 is the
 * one link; Undo small, quiet and set apart, so it is not hit by mistake. */
function Status({ v, busy, onUndo }: { v: M2dView; busy: boolean; onUndo: () => void }) {
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ borderWidth: 1, borderColor: C.accent, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={mono(12, true, C.accent, 0.12)}>✓ Registered</Text>
        <Ctl label="Open Concept2 ↗" onPress={() => open(v.link)} />
      </View>
      {!v.window.over ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Undo, I'm not registered" hitSlop={6} disabled={busy} onPress={onUndo} style={{ alignSelf: "flex-end", marginTop: 14 }}>
          <Text style={mono(9, false, C.gray, 0.1)}>{busy ? "Saving" : "Not registered? Undo"}</Text>
        </Pressable>
      ) : null}
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
        {by} gives {centsWord(rateOf(v))} for every kilometer you row, from your first meter. Pick where it goes.{v.window.over ? "" : " You can change it until Dec 24."}
      </Text>
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
  const by = v.match?.by ?? "ROWTEMBER";
  const start = () => setDraft(Object.fromEntries(list.map((c) => [c.key, saved?.[c.key] ?? (saved ? 0 : Math.round(100 / list.length))])) as Record<string, number>);
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
  if (!draft) {
    return (
      <View style={{ marginTop: 22 }}>
        <Text style={mono(10, true, C.ink, 0.12)}>Your charity</Text>
        {saved ? (
          list
            .filter((c) => (saved[c.key] ?? 0) > 0)
            .map((c) => (
              <View key={c.key} style={{ marginTop: 8, backgroundColor: C.accent, padding: 12, flexDirection: "row", alignItems: "center", columnGap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.black, fontSize: 15, color: "#FFFFFF", textTransform: "uppercase" }}>✓ {c.name}</Text>
                  <Text style={{ fontFamily: F.sans, fontSize: 13, lineHeight: 18, color: "#FFFFFF", marginTop: 3 }}>{c.what}</Text>
                </View>
                <Text style={{ fontFamily: F.black, fontSize: 20, color: "#FFFFFF", fontVariant: ["tabular-nums"] }}>{saved[c.key]}%</Text>
              </View>
            ))
        ) : (
          <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 8 }]}>No charity picked yet</Text>
        )}
        {!v.window.over ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Change or split the charity" hitSlop={8} disabled={busy} onPress={start} style={{ alignSelf: "flex-start", marginTop: 10 }}>
            <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>{saved ? "Change or split" : "Pick a charity"}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  const sum = list.reduce((a, c) => a + (draft[c.key] ?? 0), 0);
  const btn = (label: string, on: () => void, off: boolean, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={off || busy} onPress={on} hitSlop={6} style={({ pressed }) => ({ width: 40, height: 40, borderWidth: 1, borderColor: off ? C.line : C.ink, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ fontFamily: F.black, fontSize: 20, color: off ? C.line : C.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ fontFamily: F.black, fontSize: 16, color: C.ink, textTransform: "uppercase" }}>Your charity</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.gray, marginTop: 4 }}>
        {by} gives {centsWord(rateOf(v))} for every kilometer you row. All to one charity, or split it; the shares always add up to 100%.
      </Text>
      {list.map((c, i) => (
        <View key={c.key} style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ flex: 1, fontFamily: F.black, fontSize: 14, color: draft[c.key] > 0 ? C.ink : C.gray, textTransform: "uppercase" }}>{c.name}</Text>
          {btn("−", () => step(i, -10), draft[c.key] <= 0, `Less to ${c.name}`)}
          <Text style={{ width: 52, textAlign: "center", fontFamily: F.black, fontSize: 18, color: draft[c.key] > 0 ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{draft[c.key]}%</Text>
          {btn("+", () => step(i, 10), draft[c.key] >= 100, `More to ${c.name}`)}
        </View>
      ))}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 8, marginTop: 10 }}>
        {list.map((c) => (
          <Pressable key={c.key} accessibilityRole="button" hitSlop={6} onPress={() => setDraft(Object.fromEntries(list.map((x) => [x.key, x.key === c.key ? 100 : 0])) as Record<string, number>)}>
            <Text style={[mono(9.5, false, C.gray, 0.1), { textDecorationLine: "underline" }]}>All to {c.name}</Text>
          </Pressable>
        ))}
        {list.length === 3 ? (
          <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setDraft({ [list[0].key]: 34, [list[1].key]: 33, [list[2].key]: 33 })}>
            <Text style={[mono(9.5, false, C.gray, 0.1), { textDecorationLine: "underline" }]}>⅓ each</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 14 }}>{sharesText(v, draft)}</Text>
      <View style={{ marginTop: 12 }}>
        <Go
          label={busy ? "Saving" : "Save"}
          disabled={busy || sum !== 100}
          onPress={() => {
            onSave(draft);
            setDraft(null);
          }}
        />
      </View>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setDraft(null)} style={{ alignSelf: "flex-start", marginTop: 12 }}>
        <Text style={[mono(10, false, C.gray, 0.12), { textDecorationLine: "underline" }]}>Cancel</Text>
      </Pressable>
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
      <M2dGoal v={v} />
      {/* More room between the bar and the receipts (owner, 2026-11-25). */}
      <View style={{ marginTop: 34, borderTopWidth: 2, borderColor: C.ink }}>
        <Item who="Concept2" rate="2¢/km once a rower passes 100K, 4¢ after" d={usd(t.raised)} onPress={() => onFaq("concept2")} />
        <Item who={by} rate={`${centsWord(rateOf(v))}/km on every meter`} d={usd(t.matched ?? 0)} onPress={() => onFaq("rowtember")} />
        {giversOf(v).map((g) => (
          <Item key={g.name} who={g.name} rate={`${centsWord(g.rate)}/km pledged, every meter`} d={usd(g.dollars)} />
        ))}
        {(v.charities ?? []).map((c) => sub(c.name, t.split?.[c.key] ?? 0))}
        {(t.unpicked ?? 0) > 0 ? sub("No charity picked yet", t.unpicked ?? 0) : null}
        <TotalItem d={usd(total)} />
      </View>
    </View>
  );
}

export function M2dGoal({ v }: { v: M2dView }) {
  const total = totalOf(v);
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <Text style={mono(11, true)}>Goal · {usd(v.goal)} to charity</Text>
        <Text style={mono(11, true, total >= v.goal ? C.accent : C.ink)}>{total >= v.goal ? "Made it" : `${usd(Math.max(0, v.goal - total))} to go`}</Text>
      </View>
      <Bar value={Math.min(total, v.goal)} goal={v.goal} height={10} />
    </View>
  );
}

/* THE M2D TAB: the total, the goal, the receipts, the board. Registering
 * and the charity live on the profile (owner, 2026-11-25: "get rid of the
 * register ... all this shit should be gone. It's already done"); a rower
 * not yet in gets one small JOIN M2D, which opens the steps here. A tap on
 * CONCEPT2 or ROWTEMBER opens the math (M2dFaq) in place. */
export function M2dScreen({ onRower, onScrollDir }: { onRower: (n: number) => void; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { data: v, error, loading, reload } = useM2d();
  const inOut = useIn(v ?? null, reload);
  const [faq, setFaq] = useState<"concept2" | "rowtember" | "all" | null>(null);
  const [joining, setJoining] = useState(false);
  if (!v) return <Waiting error={error} onRetry={reload} />;
  if (faq) return <M2dFaq v={v} focus={faq} onBack={() => setFaq(null)} onScrollDir={onScrollDir} />;
  const w = v.window;
  let place = 0;
  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        <Dateline left="Concept2 Holiday Challenge" right={windowWord(v)} days={w.days} day={w.day} />
        <Raised v={v} onFaq={setFaq} />
        {v.me ? <ShareBtn label="Share the total" only="m2d-all" /> : null}
        <PerKm v={v} />
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 36, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink, flexDirection: "row", alignItems: "baseline" }}>
        <Text style={{ flex: 1, fontFamily: F.black, fontSize: 17, lineHeight: 18, color: C.ink, textTransform: "uppercase" }}>The board</Text>
        <Text style={mono(10, false, C.gray, 0.1)}>Meters · $</Text>
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
            <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick ?? undefined)} />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setJoining(true)}
              style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 18, backgroundColor: C.accent, paddingHorizontal: 16, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontFamily: F.black, fontSize: 14, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: 0.4 }}>Join M2D</Text>
            </Pressable>
          )
        ) : null}
        {inOut.note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{inOut.note}</Text> : null}
        {v.me?.in ? <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 18, lineHeight: 16 }]}>You are registered. Your charity and your dollars are on your profile, under M2D.</Text> : null}
      </View>
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => setFaq("all")} style={{ alignSelf: "flex-start", marginHorizontal: 20, marginTop: 14 }}>
        <Text style={[mono(10, true, C.gray, 0.12), { textDecorationLine: "underline" }]}>How it adds up</Text>
      </Pressable>
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
export function M2dPanel({ num, own }: { num: number; own: boolean }) {
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
  const theirs = giversOf(v).map((g) => ({ ...g, d: rowtemberOf(meters, g.rate) }));
  const d = own ? (v.me?.dollars ?? 0) : (row?.dollars ?? 0);
  return (
    <View style={{ paddingTop: 18, paddingBottom: 40 }}>
      <Eye left="M2D" right={windowWord(v)} />
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
            <Item who={by} rate={`${centsWord(rateOf(v))}/km on every meter`} d={usd(ours)} />
            {theirs.map((g) => (
              <Item key={g.name} who={g.name} rate={`${centsWord(g.rate)}/km pledged`} d={usd(g.d)} />
            ))}
            <TotalItem d={usd(c2 + ours + theirs.reduce((a, g) => a + g.d, 0))} />
          </View>
          {own && isIn ? (
            <View style={{ marginTop: 22 }}>
              <Text style={mono(10, true, C.ink, 0.12)}>Where it goes</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 6 }}>
                <Text style={{ fontFamily: F.bold }}>Concept2&apos;s</Text> goes to the charity you picked in your Concept2 Logbook.
              </Text>
              <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 4 }}>
                <Text style={{ fontFamily: F.bold }}>{by}&apos;s{theirs.length ? " and the pledges" : ""}</Text> go to the charity you pick here.
              </Text>
            </View>
          ) : null}
        </>
      )}
      {own && v.me?.in && matchOn ? <Split v={v} busy={inOut.busy} onSave={(s) => inOut.say(true, undefined, s)} /> : null}
      {own && v.me ? <ShareBtn label="Share my dollars" only="m2d-me" /> : null}
      {/* Registering and Concept2 at the foot (owner, 2026-11-25). */}
      {own && v.me && !v.me.in && !v.window.over ? (
        <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick ?? undefined)} />
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
export function M2dFaq({ v, focus, onBack, onScrollDir }: { v: M2dView; focus: "concept2" | "rowtember" | "all"; onBack: () => void; onScrollDir?: (down: boolean) => void }) {
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
  return (
    <ScrollView ref={ref as never} {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132, paddingHorizontal: 20 }}>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={onBack} style={{ alignSelf: "flex-start" }}>
        <Text style={mono(11, true, C.ink, 0.12)}>‹ M2D</Text>
      </Pressable>
      <Text style={{ fontFamily: F.black, fontSize: 30, lineHeight: 34, color: C.ink, textTransform: "uppercase", marginTop: 14 }}>How it adds up</Text>

      {head("concept2", "Concept2", t.raised)}
      {para("Concept2 gives nothing for a rower until they pass 100,000 meters between Nov 26 and Dec 24. Then 2¢ for each of the first 100 kilometers, which is $2, and 4¢ for every kilometer after: 150K is $4, 200K is $6, 300K is $10. It goes to the charity the rower picks in their Concept2 Logbook.")}
      {para(`Our figure adds that up for every registered Rowtember rower past 100K, from the rows logged on ROW: ${t.past100k} ${t.past100k === 1 ? "rower" : "rowers"} so far, ${usd(t.raised)}. Concept2 counts the meters in each Logbook, so its own number can differ.`)}

      {head("rowtember", by, t.matched ?? 0)}
      {para(`${by} gives ${centsWord(rate)} for every kilometer a registered rower logs on ROW, from the first meter. There is no minimum.`)}
      <View style={{ marginTop: 10, borderTopWidth: 2, borderColor: C.ink }}>
        {row("Meters by registered rowers", `${fmtInt(t.inMeters ?? 0)} m`)}
        {row(`Kilometers × ${centsWord(rate)}`, `${fmtInt((t.inMeters ?? 0) / 1000)} km`)}
        {row(by, usd(t.matched ?? 0))}
      </View>
      {para("Each rower's part goes to the charity they picked, or across the three by the shares they set on their profile:")}
      <View style={{ marginTop: 6, borderTopWidth: 2, borderColor: C.ink }}>
        {(v.charities ?? []).map((c) => row(c.full, usd(t.split?.[c.key] ?? 0)))}
        {(t.unpicked ?? 0) > 0 ? row("No charity picked yet", usd(t.unpicked ?? 0)) : null}
      </View>
      {para(`${by} pays its part itself. Nobody is asked for money.`)}

      <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink, textTransform: "uppercase", marginTop: 30 }}>Questions</Text>
      {q("When is it?", "Thursday, Nov 26 to Thursday, Dec 24. Concept2 takes meters into the Logbook until Jan 4.")}
      {q("How do I register?", `Make a free Concept2 Logbook, pick a charity there, and get your meters into it (ErgData does that). Then press Join M2D on the M2D tab, pick where ${by}'s part goes, and press I'm registered.`)}
      {q("How do I change my charity?", "On your profile, under M2D, until Dec 24. You can split it across the three there too.")}
      {q("What counts?", `For ${by}: rows logged on ROW from Nov 26 to Dec 24 by registered rowers. For Concept2: the meters in your Concept2 Logbook.`)}
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
  givers?: { name: string; rate: number }[];
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
      setSay(`Saved. ROWTEMBER gives ${centsWord(next.rate)} a kilometer, on every meter in the window.`);
    } catch (err) {
      setSay(err instanceof Error ? err.message : "That did not save.");
    }
    setBusy(false);
  };
  const givers = plan.givers ?? [];
  const g = Number(gift) || 0;
  const saveGivers = async (next: { name: string; rate: number }[]) => {
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
  return (
    <View>
      {head(`So far · day ${plan.window.day} of ${plan.window.days}`)}
      {row("Meters in the window", `${fmtInt(plan.soFar.meters)} m`)}
      {row(`By registered rowers (${plan.soFar.registered})`, `${fmtInt(plan.soFar.inMeters)} m`)}
      {row(`ROWTEMBER so far at ${centsWord(plan.rate)}/km`, usd(plan.soFar.cost))}
      {head(`Projected · ${plan.basis === "pace" ? "from the pace" : "from history"}`)}
      {row(`Low · ${fmtInt(low)} m`, usd(costOf(low, plan.rate)))}
      {row(`Likely · ${fmtInt(likely)} m`, usd(costOf(likely, plan.rate)))}
      {row(`High · ${fmtInt(high)} m`, usd(costOf(high, plan.rate)))}
      <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8, lineHeight: 15 }]}>
        High is {plan.history.high.label}: {fmtInt(plan.history.high.meters)} m by {plan.history.high.rowers}. Low is {plan.history.low.label}: {fmtInt(plan.history.low.meters)} m by {plan.history.low.rowers}. Everyone&apos;s meters: ROWTEMBER pays registered rowers&apos; only, so these are ceilings.
      </Text>
      {head("Each 1¢ a kilometer")}
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
      {head(`Other givers · ${givers.length}`)}
      {givers.map((x, i) => (
        <View key={x.name} style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
          <Text style={{ flex: 1, fontFamily: F.sans, fontSize: 14, color: C.ink }}>{x.name}</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent }}>{centsWord(x.rate)}/km</Text>
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
        <Go label={busy ? "Saving" : "Add the giver"} disabled={busy || !gName.trim() || !(Number(gRate) > 0)} onPress={() => void saveGivers([...givers, { name: gName.trim(), rate: Math.round(Number(gRate) * 100) / 100 }])} />
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
