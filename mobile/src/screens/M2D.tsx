import { useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "../api";
import { useSession } from "../session";
import { Ctl, Dateline, Eye, mono } from "../site";
import { C, F, fmtInt } from "../theme";
import { Bar, Blocks, Waiting, useLoad, useScrollDir } from "../ui";

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
 * Concept2's rule (log.concept2.com/challenges/holiday, read that day): for
 * each person who rows 100,000 m in the window Concept2 gives 2 cents a
 * kilometre, and 4 cents for every kilometre past 100K. A rower's DOLLARS
 * here are that rule run on their meters, as if they reach 100K; LOCKED IN
 * is what Concept2 has promised already (rowers past 100K). Whether a rower
 * is registered with Concept2 we cannot see: it is their own word, pressed
 * here (I'M REGISTERED), and it can be taken back. The figures are the
 * site's (api/row100k/app/m2d, row100k/m2d.ts).
 *
 *   THE TAB (`M2dScreen`): the dollars raised, big and blue; the goal; the
 *     four steps for a rower not yet in; every rower with meters in the
 *     window, their meters and their dollars, the dollars grey for a rower
 *     not registered.
 *   THE PROFILE'S THIRD COLUMN (`M2dPanel`): the rower's own: the steps, or
 *     their dollars, meters and the road to 100K and 200K.
 *   THE STATS TAB (`M2dGoal`): the goal, under the dollars in the bar. */

export type M2dRow = { rowerNumber: number; name: string; meters: number; dollars: number | null; in: boolean; me: boolean; blocks?: number };
export type M2dView = {
  signedIn?: boolean;
  window: { first: string; last: string; days: number; day: number; started: boolean; over: boolean; until?: number };
  link: string;
  signup: string;
  goal: number;
  /* ROWTEMBER's match (row100k/m2d.ts M2D_MATCH; owner, 2026-11-25: no cap
   * shown, matched by "ROWTEMBER"), and the three Las Vegas charities a
   * rower picks it for. Absent on an older site. */
  match?: { on: boolean; by: string };
  charities?: Charity[];
  c2Goal?: number;
  /* raised: Concept2's dollars; matched: ROWTEMBER's; total: both, THE
   * figure; split: the match by charity picked. */
  totals: {
    meters: number;
    raised: number;
    matched?: number;
    total?: number;
    split?: Record<string, number>;
    unpicked?: number;
    locked: number;
    unclaimed: number;
    rowers: number;
    registered: number;
    past100k: number;
  };
  rows: M2dRow[];
  me: { rowerNumber: number; in: boolean; choice?: string | null; meters: number; dollars: number; locked: number } | null;
};

export type Charity = { key: string; name: string; full: string; what: string; url: string | null };

export const M2D_PATH = "/api/row100k/app/m2d";

/* THE FIGURE: everything raised for charity, Concept2 and ROWTEMBER's
 * match together (the stats title in App.tsx too). */
export const totalOf = (v: M2dView): number => v.totals.total ?? v.totals.raised;

/* "$16.38"; "$1,234" once there are a thousand of them. */
export const usd = (d: number): string => (d >= 1000 ? `$${fmtInt(d)}` : `$${d.toFixed(2)}`);

/* The same rule the site runs (row100k/m2d.ts worth). */
export function worth(meters: number): number {
  const km = Math.max(0, meters) / 1000;
  return Math.round((km <= 100 ? 0.02 * km : 2 + 0.04 * (km - 100)) * 100) / 100;
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
    ["Pick a charity in your Logbook", "Invictus Games Foundation, Natural Resources Defense Council, War Child USA or Wood4Good, or Let Concept2 Choose. Do Not Donate means your meters raise nothing."],
    ["Get your meters into the Logbook", "ErgData sends each row there. Nov 26 to Dec 24; meters can be entered until Jan 4."],
    ["Row 100K", "Concept2 gives 2 cents a kilometer, then 4 cents for each one past 100K. 100K earns a certificate, 200K the Holiday Challenge pin (50K for kids and adaptive rowers)."],
    /* Review, 2026-11-25: a rower could do Concept2's four and get no
     * match. The fifth is ours. */
    [
      "Log your rows on ROW too",
      `That's what ${v.match?.by ?? "ROWTEMBER"} matches: only rows logged in ROW count toward the match. Tap + at the top to log one. Sending your rows to Concept2 automatically is coming.`,
    ],
  ];
  const matchOn = !!v.match?.on && !!v.charities?.length;
  const name = v.charities?.find((c) => c.key === pick)?.name;
  return (
    <View style={{ marginTop: 22, borderWidth: 2, borderColor: C.ink, padding: 16 }}>
      <Text style={{ fontFamily: F.black, fontSize: 19, color: C.ink, textTransform: "uppercase" }}>Join in {steps.length} steps</Text>
      <Text style={[mono(10, false, C.gray, 0.12), { marginTop: 6, lineHeight: 16 }]}>Free. Your meters become a donation from Concept2.</Text>
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
            {matchOn && !pick ? "Pick a charity above first." : matchOn && name ? `${name} gets ${v.match?.by}'s match for your meters.` : "Concept2 counts the meters in your Logbook."}
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
  const say = async (on: boolean, choice?: string) => {
    setBusy(true);
    setNote("");
    try {
      await api(M2D_PATH, { body: choice ? { in: on, choice } : { in: on } });
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

/* WHERE ROWTEMBER'S MATCH GOES (owner, 2026-11-25: "I want users to be
 * able to pick where their donations go to ... Project Inclusion, Shine a
 * Light, and Candlelighters"): the three, one picked. */
function Picks({ v, pick, busy, onPick }: { v: M2dView; pick: string | null; busy: boolean; onPick: (k: string) => void }) {
  const by = v.match?.by ?? "ROWTEMBER";
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontFamily: F.black, fontSize: 16, color: C.ink, textTransform: "uppercase" }}>Where {by}'s match goes</Text>
      <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.gray, marginTop: 4 }}>
        Pick one of three Las Vegas charities. {by} gives what Concept2 gives for your meters, and it goes here.{v.window.over ? "" : " You can change it until Dec 24."}
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
              onPress={() => onPick(c.key)}
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

/* THE FIGURE, big: everything raised for charity (owner, 2026-11-25:
 * "let's just show a total amount raised and show where the donated money
 * is coming from"); under it, where it comes from. No cap anywhere. */
function Raised({ v }: { v: M2dView }) {
  const t = v.totals;
  const total = totalOf(v);
  const line = (k: string, d: number) => (
    <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
      <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>{k}</Text>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.accent, fontVariant: ["tabular-nums"] }}>{usd(d)}</Text>
    </View>
  );
  /* Before Nov 26 no page of $0.00 (review, 2026-11-25): the days to go. */
  if (!v.window.started) {
    const until = v.window.until ?? 1;
    return (
      <View style={{ marginTop: 22 }}>
        <Text style={{ fontFamily: F.black, fontSize: 44, lineHeight: 50, color: C.accent, textTransform: "uppercase" }}>{until <= 1 ? "Starts tomorrow" : `Starts in ${until} days`}</Text>
        <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 6 }]}>Nov 26 to Dec 24 · {t.registered} registered so far</Text>
      </View>
    );
  }
  return (
    <View style={{ marginTop: 22 }}>
      <Text accessibilityLabel={`${usd(total)} raised for charity`} style={{ fontFamily: F.black, fontSize: 64, lineHeight: 70, color: C.accent, fontVariant: ["tabular-nums"] }}>
        {usd(total)}
      </Text>
      <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 4 }]}>Raised for charity · {fmtInt(t.meters)} m rowed</Text>
      <View style={{ marginTop: 14, borderTopWidth: 2, borderColor: C.ink }}>
        {line("From Concept2, for your meters", t.raised)}
        {v.match?.on ? line(`Matched by ${v.match.by}`, t.matched ?? t.raised) : null}
      </View>
      {v.match?.on && v.charities?.length && (t.matched ?? 0) > 0 ? (
        <Text style={[mono(9.5, false, C.gray, 0.08), { marginTop: 8, lineHeight: 16 }]}>
          {v.charities.map((c) => `${c.name} ${usd(t.split?.[c.key] ?? 0)}`).join(" · ")}
          {(t.unpicked ?? 0) > 0 ? ` · Not picked yet ${usd(t.unpicked ?? 0)}` : ""}
        </Text>
      ) : null}
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 8, lineHeight: 16 }]}>
        {t.registered} registered · {t.past100k} past 100K
        {t.unclaimed > 0 ? ` · ${usd(t.unclaimed)} more from Concept2 if everyone registers` : ""}
      </Text>
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

/* THE GOAL ON THE STATS TAB (owner: "we could have a section of stats
 * that's a goal. For example, a goal can be, can we raise $100?"). The
 * dollars themselves are the mark in the bar over the tab (App.tsx). */
export function M2dStats() {
  const { data } = useM2d();
  if (!data) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Eye left="M2D for charity" right={data.window.started ? (data.window.over ? "Final" : `Day ${data.window.day} of ${data.window.days}`) : "Starts Nov 26"} />
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 10, lineHeight: 16 }]}>
        {data.window.started ? `${usd(totalOf(data))} raised for charity · ${fmtInt(data.totals.meters)} m since Nov 26` : `Starts Nov 26 · ${data.totals.registered} registered so far`}
      </Text>
      <M2dGoal v={data} />
    </View>
  );
}

/* THE M2D TAB. */
export function M2dScreen({ onRower, onScrollDir }: { onRower: (n: number) => void; onScrollDir?: (down: boolean) => void }) {
  const dir = useScrollDir(onScrollDir);
  const { data: v, error, loading, reload } = useM2d();
  const inOut = useIn(v ?? null, reload);
  if (!v) return <Waiting error={error} onRetry={reload} />;
  const w = v.window;
  const matchOn = !!v.match?.on && !!v.charities?.length;
  let place = 0;
  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingTop: 16, paddingBottom: 132 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <View style={{ paddingHorizontal: 20 }}>
        <Dateline left="Concept2 Holiday Challenge" right={!w.started ? "Starts Nov 26" : w.over ? "Final" : `Day ${w.day} of ${w.days}`} days={w.days} day={w.day} />
        <Raised v={v} />
        <M2dGoal v={v} />
        {v.me && !v.me.in && !w.over ? (
          <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick ?? undefined)} />
        ) : null}
        {v.me?.in ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }}>
              <Text style={mono(11, true, C.accent, 0.12)}>✓ You're registered</Text>
              <Ctl label="Concept2 ↗" onPress={() => open(v.link)} />
            </View>
            {matchOn && !inOut.pick && !w.over ? <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 12 }]}>Pick where {v.match?.by}'s match goes</Text> : null}
            {matchOn ? <Picks v={v} pick={inOut.pick} busy={inOut.busy} onPick={inOut.onPick} /> : null}
          </>
        ) : null}
        {!v.me ? (
          <View style={{ marginTop: 18 }}>
            <Ctl label="The rules at Concept2 ↗" onPress={() => open(v.link)} />
          </View>
        ) : null}
        {inOut.note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{inOut.note}</Text> : null}
      </View>

      <View style={{ marginHorizontal: 20, marginTop: 28, paddingBottom: 9, borderBottomWidth: 1, borderColor: C.ink, flexDirection: "row", alignItems: "baseline" }}>
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
        <Text style={[mono(9.5, false, C.gray, 0.1), { paddingHorizontal: 20, paddingTop: 14, lineHeight: 15 }]}>Grey dollars: not registered with Concept2 yet. Register and they count.</Text>
      ) : null}
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
  const row = v.rows.find((r) => r.rowerNumber === num);
  const meters = own ? (v.me?.meters ?? 0) : (row?.meters ?? 0);
  const isIn = own ? !!v.me?.in : !!row?.in;
  const hidden = !own && row?.blocks !== undefined;
  const d = worth(meters);
  const next = meters < 100_000 ? 100_000 : 200_000;
  return (
    <View style={{ paddingTop: 18, paddingBottom: 40 }}>
      <Eye left="M2D for charity" right={!v.window.started ? "Starts Nov 26" : v.window.over ? "Final" : `Day ${v.window.day} of ${v.window.days}`} />
      {hidden ? (
        <View style={{ marginTop: 18 }}>
          <Blocks n={row?.blocks ?? 5} size={20} />
        </View>
      ) : (
        <>
          <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: isIn ? C.accent : C.gray, marginTop: 16, fontVariant: ["tabular-nums"] }}>{usd(d)}</Text>
          <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 2 }]}>
            {fmtInt(meters)} m since Nov 26{isIn ? "" : " · not registered"}
          </Text>
          {meters < 200_000 ? (
            <View style={{ marginTop: 18 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={mono(10, true)}>{next === 100_000 ? "To 100K" : "To 200K · the pin"}</Text>
                <Text style={mono(10, false, C.gray)}>{fmtInt(next - meters)} m to go</Text>
              </View>
              <Bar value={meters} goal={next} height={10} />
            </View>
          ) : (
            <Text style={[mono(11, true, C.accent, 0.12), { marginTop: 14 }]}>200K made · the pin is earned</Text>
          )}
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 12, lineHeight: 16 }]}>
            {meters >= 100_000 ? `${usd(d)} locked in from Concept2. Every km now adds 4 cents.` : "Concept2 gives it once you pass 100K: 2 cents a km, then 4 cents each km past 100K."}
          </Text>
        </>
      )}
      {own && v.me && !v.me.in && !v.window.over ? (
        <Steps v={v} busy={inOut.busy} pick={inOut.pick} onPick={inOut.onPick} onIn={() => inOut.say(true, inOut.pick ?? undefined)} />
      ) : null}
      {own && v.me?.in ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 22, rowGap: 12, alignItems: "center", marginTop: 22 }}>
            <Text style={mono(11, true, C.accent, 0.12)}>✓ Registered</Text>
            <Ctl label="Concept2 ↗" onPress={() => open(v.link)} />
            <Ctl label={inOut.busy ? "Saving" : "Undo"} disabled={inOut.busy} onPress={() => inOut.say(false)} />
          </View>
          {matchOn && !inOut.pick && !v.window.over ? <Text style={[mono(11, true, C.ink, 0.12), { marginTop: 12 }]}>Pick where {v.match?.by}'s match goes</Text> : null}
          {matchOn ? <Picks v={v} pick={inOut.pick} busy={inOut.busy} onPick={inOut.onPick} /> : null}
        </>
      ) : null}
      {!own ? (
        <View style={{ marginTop: 22 }}>
          <Ctl label="The challenge at Concept2 ↗" onPress={() => open(v.link)} />
        </View>
      ) : null}
      {inOut.note ? <Text style={[mono(11, true, C.ink, 0.14), { marginTop: 10, lineHeight: 18 }]}>{inOut.note}</Text> : null}
    </View>
  );
}
