import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import Svg, { Line, Path } from "react-native-svg";
import { milestone, projectedMeters } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import type { TelemetryDoc } from "../pm5/session";
import { useSession } from "../session";
import { C, F, fmtClock, fmtInt, fmtPace, onLook } from "../theme";
import { Btn, Card, Eyebrow, Num, styles } from "../ui";
import { logRow, pacificToday, pickPhoto, shiftDay, type Picked } from "../upload";
import { SignIn } from "./Account";

/* LOG A ROW. Three ways in: connect a Concept2 PM5 and row, a demo row
 * (the simulator, for trying the screens with no erg in the room), or by
 * hand. All three end at the same form: two photos, the day, LOG.
 *
 * THE MONITOR (owner, 2026-11-20): "we don't need an animating wheel. Lets
 * stick to just numbers"; "I would like my avg pace and my current pace. My
 * avg pace should be primary"; "my meters and total time"; "there can be
 * other screens that we can swipe through like a carousel"; "I like the
 * button saying LOG x M"; "Lets make 2 views but should prob be sideways".
 * One monitor for every kind of piece: the four numbers always show; a set
 * distance adds the line to the next 10-second mark (erg/milestone.ts) and
 * the metres left; a set time shows the metres it is on pace for; a plain
 * row shows the four numbers and no line. */

export type Logged = { id: string; meters: number; seconds: number; day: string; doc?: TelemetryDoc; demo: boolean; device: string; strokes: number; avgWatts: number };

export function RowScreen({ erg, onLogged, onLeave }: { erg: Erg; onLogged: (r: Logged) => void; onLeave: () => void }) {
  const { ready, me } = useSession();
  const [form, setForm] = useState<"none" | "manual" | "erg">("none");
  /* The piece as it stood when LOG was pressed: the monitor may still be
   * talking, and the row being logged must not move under the form. */
  const [snap, setSnap] = useState<{ meters: number; seconds: number; strokes: number; avgWatts: number; doc?: TelemetryDoc } | null>(null);

  if (ready && !me.signedIn) return <SignIn why="Logging a row needs your account." />;

  if (form === "erg" && snap) {
    return (
      <LogForm
        fixed={{ meters: snap.meters, seconds: snap.seconds }}
        doc={snap.doc}
        onCancel={() => setForm("none")}
        onDone={(id, day, meters, seconds, doc) => {
          const out: Logged = { id, meters, seconds, day, doc, demo: erg.demo, device: erg.name || "PM5", strokes: snap.strokes, avgWatts: snap.avgWatts };
          erg.discard();
          setForm("none");
          onLogged(out);
        }}
      />
    );
  }
  if (form === "manual") {
    return (
      <LogForm
        onCancel={() => setForm("none")}
        onDone={(id, day, meters, seconds) => {
          setForm("none");
          onLogged({ id, meters, seconds, day, demo: false, device: "", strokes: 0, avgWatts: 0 });
        }}
      />
    );
  }
  if (erg.phase === "live") {
    const l = erg.live;
    return (
      <Monitor
        erg={erg}
        onLog={() => {
          setSnap({ meters: Math.floor(l.meters), seconds: Math.max(1, Math.round(l.elapsedS)), strokes: l.strokes, avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0, doc: erg.doc() });
          setForm("erg");
        }}
        onLeave={onLeave}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Eyebrow>Concept2 PM5</Eyebrow>
      <Text style={{ fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.ink, marginVertical: 6 }}>
        Connect your <Text style={{ color: C.accent }}>erg</Text>
      </Text>
      <Text style={[styles.body, { marginBottom: 14 }]}>On the monitor: Menu, then Connect. Leave it on that screen and press the button. Set the piece on the monitor as usual; the app reads what you set.</Text>
      {erg.phase === "idle" ? <Btn label="Connect" onPress={erg.connect} /> : null}
      {erg.phase === "connecting" ? (
        <View style={[styles.row, { gap: 10 }]}>
          <ActivityIndicator color={C.ink} />
          <Text style={styles.body}>Connecting...</Text>
        </View>
      ) : null}
      {erg.phase === "scanning" ? (
        <View>
          <View style={[styles.row, { gap: 10, marginBottom: 8 }]}>
            <ActivityIndicator color={C.ink} />
            <Text style={styles.body}>{erg.found.length ? "Tap your monitor" : "Looking for monitors..."}</Text>
          </View>
          {erg.found.map((d) => (
            <Pressable key={d.id} accessibilityRole="button" onPress={() => erg.pick(d)} style={{ borderTopWidth: 1, borderColor: C.line, paddingVertical: 16 }}>
              <Text style={{ fontSize: 17, fontFamily: F.bold, color: C.ink }}>{d.name}</Text>
            </Pressable>
          ))}
          <Btn label="Stop looking" quiet onPress={erg.discard} style={{ marginTop: 10 }} />
        </View>
      ) : null}
      {erg.error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{erg.error}</Text> : null}

      <View style={{ marginTop: 26, borderTopWidth: 2, borderColor: C.ink, paddingTop: 16 }}>
        <Eyebrow style={{ color: C.ink, marginBottom: 10 }}>No erg connected</Eyebrow>
        <Btn label="Log by hand" quiet onPress={() => setForm("manual")} disabled={erg.phase !== "idle"} />
        <Btn label="Demo row" quiet onPress={() => erg.startDemo()} disabled={erg.phase !== "idle"} style={{ marginTop: 10 }} />
        <Text style={[styles.body, { fontSize: 14, marginTop: 8 }]}>A demo row runs the simulator, sped up, so the monitor can be tried with no erg in the room.</Text>
      </View>
    </ScrollView>
  );
}

/* ---- the monitor ------------------------------------------------------- */

const signed = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)} s`;
/* How long the metres stand still before the row counts as stopped. */
const IDLE_MS = 6000;

function Monitor({ erg, onLog, onLeave }: { erg: Erg; onLog: () => void; onLeave: () => void }) {
  const { live, name, error, demo } = erg;
  /* The screen stays on for as long as the monitor is up: a rower's hands
   * are on the handle, not the phone. */
  useKeepAwake();
  const win = useWindowDimensions();
  const wide = win.width > win.height;
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);
  const [page, setPage] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    setW(Math.round(e.nativeEvent.layout.width));
    setH(Math.round(e.nativeEvent.layout.height));
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w));
  const meters = Math.floor(live.meters);
  /* A demo row is the simulator: it shows the screens, it is never logged
   * to the board outside development. */
  const canLog = meters >= 1 && (!demo || __DEV__);
  /* HAS THE ROWER STOPPED (owner, 2026-11-20: "have them only pop up when
   * the rower is either just starting or just finished, prob just
   * finished"). The monitor says so itself when a set piece ends; for a
   * plain row, or a piece abandoned, the metres standing still for a few
   * seconds says it. Before the first stroke there is nothing to log, so
   * nothing shows: the way out then is the last page. */
  const moved = useRef({ m: 0, at: Date.now() });
  const [still, setStill] = useState(false);
  if (live.meters !== moved.current.m) moved.current = { m: live.meters, at: Date.now() };
  useEffect(() => {
    const t = setInterval(() => setStill(Date.now() - moved.current.at > IDLE_MS), 1000);
    return () => clearInterval(t);
  }, []);
  const over = meters >= 1 && (live.ended || !!error || still);
  const ends = (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Btn label="Discard" quiet onPress={erg.discard} style={{ flex: 1 }} />
      <Btn label={canLog ? `Log ${fmtInt(meters)} m` : demo ? "Demo row" : "Log 0 m"} onPress={onLog} disabled={!canLog} style={{ flex: 2 }} />
    </View>
  );
  const status = error ? "Disconnected" : live.ended ? "Piece finished" : live.awake ? "Live" : "Connected, waiting";
  const piece = live.targetM > 0 ? `${fmtInt(live.targetM)} m` : live.targetS > 0 ? `${fmtClock(live.targetS, false)} piece` : "Just row";

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: wide ? 6 : 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to the app. The row keeps recording." onPress={onLeave} hitSlop={10} style={{ minHeight: 40, justifyContent: "center" }}>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2.2, color: C.ink }}>← APP</Text>
        </Pressable>
        <Eyebrow style={{ color: error ? C.accent : C.good }}>
          {status} · {piece}
        </Eyebrow>
        <Eyebrow>{demo ? "Demo" : name}</Eyebrow>
      </View>

      <View style={{ flex: 1 }} onLayout={onLayout}>
        {w ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={64}>
            <View style={{ width: w, height: h, paddingHorizontal: 20 }}>
              <Main erg={erg} wide={wide} width={w - 40} />
            </View>
            <View style={{ width: w, height: h, paddingHorizontal: 20, justifyContent: "center" }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Big k="Strokes a minute" v={live.spm > 0 ? `${live.spm}` : "--"} wide={wide} />
                <Big k="Watts" v={live.watts > 0 ? fmtInt(live.watts) : "---"} wide={wide} />
                <Big k="Heart rate" v={live.hr ? `${live.hr}` : "--"} wide={wide} />
                <Big k="Drag factor" v={live.drag > 0 ? `${live.drag}` : "--"} wide={wide} />
              </View>
            </View>
            <View style={{ width: w, height: h, paddingHorizontal: 20, justifyContent: "center" }}>
              <PacePage erg={erg} width={w - 40} height={Math.max(90, Math.min(260, h - 70))} />
            </View>
            <ScrollView style={{ width: w, height: h }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}>
              <SplitsPage erg={erg} />
            </ScrollView>
            {/* THE LAST PAGE: the way out, always a swipe away. */}
            <View style={{ width: w, height: h, paddingHorizontal: 20, justifyContent: "center" }}>
              <Eyebrow style={{ color: C.ink, marginBottom: 6 }}>End the row</Eyebrow>
              <Text style={[styles.body, { marginBottom: 18 }]}>{canLog ? `${fmtInt(meters)} m in ${fmtClock(live.elapsedS, false)} so far. Logging asks for the two photos next.` : demo && meters >= 1 ? "A demo row shows the monitor. It is not logged." : "Nothing rowed yet."}</Text>
              {ends}
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View accessibilityLabel={`Page ${page + 1} of 5`} style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: wide ? 4 : 10 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ width: i === page ? 18 : 6, height: 6, backgroundColor: i === page ? C.accent : C.line }} />
        ))}
      </View>
      {error ? <Text style={[styles.body, { color: C.accent, paddingHorizontal: 20, marginBottom: 6 }]}>{error}</Text> : null}
      {/* While the rower is rowing the screen is numbers and nothing else.
          The buttons come up by themselves once the piece is over or the
          handle has been down a few seconds. */}
      {over && page !== 4 ? <View style={{ paddingHorizontal: 20, paddingBottom: wide ? 8 : 16 }}>{ends}</View> : <View style={{ height: wide ? 4 : 8 }} />}
    </View>
  );
}

/* PAGE ONE: the average split, big, in the blue; under it what it takes to
 * hit the next mark; then the split right now, the metres and the time. */
function Main({ erg, wide, width }: { erg: Erg; wide: boolean; width: number }) {
  const { live } = erg;
  const ms = milestone(live);
  const pm = projectedMeters(live);
  /* Six characters of Archivo Black run about 3.6 times the type size wide. */
  const avgSize = Math.min(wide ? 150 : 132, Math.floor((wide ? width * 0.56 : width) / 3.65));
  const avg = (
    <View style={{ flex: wide ? 1.35 : undefined, justifyContent: "center" }}>
      <Eyebrow style={{ color: C.ink }}>Average /500 m</Eyebrow>
      <Text style={{ fontFamily: F.black, fontSize: avgSize, lineHeight: Math.round(avgSize * 1.08), color: C.accent, fontVariant: ["tabular-nums"], letterSpacing: -2 }}>{fmtPace(live.avgPace)}</Text>
      {ms ? (
        <View>
          <Text accessibilityLabel={`${Math.abs(ms.delta).toFixed(1)} seconds ${ms.delta < 0 ? "faster" : "slower"} per 500 for ${fmtClock(ms.mark, false)}`} style={{ fontFamily: F.monoBold, fontSize: 22, color: C.ink, fontVariant: ["tabular-nums"] }}>
            {signed(ms.delta)} FOR {fmtClock(ms.mark, false)}
          </Text>
          <Eyebrow style={{ marginTop: 4 }}>
            On pace for {fmtClock(ms.projected)} · {fmtInt(ms.metersLeft)} m to go
          </Eyebrow>
        </View>
      ) : pm ? (
        <Text style={{ fontFamily: F.monoBold, fontSize: 22, color: C.ink }}>ON PACE FOR {fmtInt(pm)} M</Text>
      ) : live.ended && live.targetM > 0 ? (
        <Eyebrow style={{ marginTop: 4 }}>Finished · {fmtInt(live.targetM)} m</Eyebrow>
      ) : (
        <Eyebrow style={{ marginTop: 4 }}>{live.targetM > 0 ? `${fmtInt(Math.max(0, live.targetM - live.meters))} m to go` : " "}</Eyebrow>
      )}
    </View>
  );
  /* One figure to a line, the word on the left and the number on the right,
   * so each can be as big as the line is tall. */
  const cell = (k: string, v: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.line, paddingVertical: wide ? 4 : 10 }}>
      <Eyebrow>{k}</Eyebrow>
      <Text style={{ fontFamily: F.black, fontSize: wide ? 44 : 52, lineHeight: wide ? 50 : 58, color: C.ink, fontVariant: ["tabular-nums"], letterSpacing: -1 }}>{v}</Text>
    </View>
  );
  const three = (
    <View style={wide ? { flex: 1, justifyContent: "center", paddingLeft: 28 } : { marginTop: 26 }}>
      {cell("Now /500 m", fmtPace(live.pace))}
      {cell("Metres", fmtInt(Math.floor(live.meters)))}
      {cell("Time", fmtClock(live.elapsedS, false))}
    </View>
  );
  return (
    <View style={{ flex: 1, flexDirection: wide ? "row" : "column", justifyContent: "center" }}>
      {avg}
      {three}
    </View>
  );
}

function Big({ k, v, wide }: { k: string; v: string; wide: boolean }) {
  return (
    <View style={{ width: wide ? "25%" : "50%", paddingVertical: 14 }}>
      <Eyebrow>{k}</Eyebrow>
      <Num size={wide ? 56 : 64}>{v}</Num>
    </View>
  );
}

/* THE SPLIT ALONG THE PIECE (owner, 2026-11-20: "we only need to see +/- 5
 * seconds from where we are currently rowing, the pace doesn't change that
 * much"): the window is the average, five seconds either side, so a second
 * is a visible move. Faster is up. A stroke outside the window sits on its
 * edge. */
function PacePage({ erg, width, height }: { erg: Erg; width: number; height: number }) {
  const { live, trail } = erg;
  const mid = live.avgPace > 0 ? live.avgPace : live.pace;
  if (!(mid > 0) || trail.length < 2) return <Text style={styles.body}>The split draws here once you are rowing.</Text>;
  const lo = mid - 5;
  const hi = mid + 5;
  const xMax = Math.max(live.targetM, trail[trail.length - 1].m, 500);
  const sx = (m: number) => (m / xMax) * width;
  const sy = (p: number) => ((Math.min(hi, Math.max(lo, p)) - lo) / (hi - lo)) * height;
  /* The monitor's split jumps a second or two stroke to stroke; the line is
   * the mean of the last ten readings (about 100 m), so it shows where the
   * pace is going and not each stroke. */
  let d = "";
  let sum = 0;
  const step = Math.max(1, Math.floor(trail.length / 400));
  for (let i = 0; i < trail.length; i++) {
    sum += trail[i].pace;
    if (i >= 10) sum -= trail[i - 10].pace;
    if (i % step === 0 || i === trail.length - 1) d += `${d ? "L" : "M"}${sx(trail[i].m).toFixed(1)} ${sy(sum / Math.min(i + 1, 10)).toFixed(1)}`;
  }
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Eyebrow style={{ color: C.ink }}>Split along the piece</Eyebrow>
        <Eyebrow>Faster ↑ · {fmtPace(lo)}</Eyebrow>
      </View>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={C.gray} strokeWidth={1} strokeDasharray="4 4" />
        <Path d={d} stroke={C.accent} strokeWidth={3} fill="none" strokeLinejoin="round" />
        <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={C.ink} strokeWidth={2} />
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <Eyebrow>- - Average {fmtPace(mid)}</Eyebrow>
        <Eyebrow>Slower ↓ · {fmtPace(hi)}</Eyebrow>
      </View>
    </View>
  );
}

/* Every 500 m so far, the newest on top, the fastest named. */
function SplitsPage({ erg }: { erg: Erg }) {
  const rows = erg.marks.map((mk, i) => ({ m: mk.m, s: mk.t - (i ? erg.marks[i - 1].t : 0) }));
  if (!rows.length) return <Text style={styles.body}>The 500 m splits list here as you pass each one.</Text>;
  const best = Math.min(...rows.map((r) => r.s));
  return (
    <View>
      <Eyebrow style={{ color: C.ink, marginBottom: 4 }}>500 m splits so far</Eyebrow>
      {[...rows].reverse().map((r) => (
        <View key={r.m} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderColor: C.line, paddingVertical: 8 }}>
          <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.soft }}>{fmtInt(r.m)} m</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            {r.s === best && rows.length > 1 ? <Text style={{ fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1.6, color: C.accent }}>FASTEST</Text> : null}
            <Num size={24} color={r.s === best && rows.length > 1 ? C.accent : C.ink}>
              {fmtClock(r.s)}
            </Num>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ---- the form every row ends at ---------------------------------------- */

const SLOTS = ["You", "The monitor"] as const;
const fieldOf = () => ({ borderBottomWidth: 1, borderColor: C.ink, fontSize: 30, fontFamily: F.black, paddingVertical: 6, color: C.ink, minWidth: 84 }) as const;
let field = fieldOf();
onLook(() => {
  field = fieldOf();
});

function LogForm({ fixed, doc, onCancel, onDone }: { fixed?: { meters: number; seconds: number }; doc?: TelemetryDoc; onCancel: () => void; onDone: (id: string, day: string, meters: number, seconds: number, doc?: TelemetryDoc) => void }) {
  const today = pacificToday();
  const [meters, setMeters] = useState(fixed ? String(fixed.meters) : "");
  const [mins, setMins] = useState("");
  const [secs, setSecs] = useState("");
  const [day, setDay] = useState(today);
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<(Picked | null)[]>([null, null]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const m = fixed ? fixed.meters : Math.round(Number(meters));
  const s = fixed ? fixed.seconds : Math.round(Number(mins)) * 60 + Math.round(Number(secs));
  const ok = m > 0 && s > 0 && photos[0] !== null && photos[1] !== null;

  const pick = async (i: number, from: "camera" | "library") => {
    setError("");
    try {
      const p = await pickPhoto(from);
      if (p) setPhotos((prev) => prev.map((x, k) => (k === i ? p : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be read.");
    }
  };

  const submit = async () => {
    if (!photos[0] || !photos[1]) return;
    setError("");
    try {
      const r = await logRow({ day, meters: m, seconds: s, title, photos: [photos[0], photos[1]], doc }, setBusy);
      setBusy("");
      onDone(r.id, day, m, s, doc);
    } catch (err) {
      setBusy("");
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {fixed ? (
        <View>
          <Eyebrow>The row</Eyebrow>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Num size={56} color={C.accent}>
              {fmtInt(m)} m
            </Num>
            <Text style={{ fontFamily: F.sans, fontSize: 16, color: C.soft, fontVariant: ["tabular-nums"] }}>
              {fmtClock(s, false)} · {fmtPace(m > 0 ? (s / m) * 500 : 0)}
            </Text>
          </View>
        </View>
      ) : (
        <View>
          <Eyebrow>Metres</Eyebrow>
          <TextInput style={[field, { marginBottom: 14 }]} keyboardType="number-pad" value={meters} onChangeText={setMeters} placeholder="5000" placeholderTextColor={C.line} accessibilityLabel="Metres" />
          <Eyebrow>Time</Eyebrow>
          <View style={[styles.row, { gap: 8 }]}>
            <TextInput style={field} keyboardType="number-pad" value={mins} onChangeText={setMins} placeholder="20" placeholderTextColor={C.line} accessibilityLabel="Minutes" />
            <Text style={styles.mid}>:</Text>
            <TextInput style={field} keyboardType="number-pad" value={secs} onChangeText={setSecs} placeholder="00" placeholderTextColor={C.line} accessibilityLabel="Seconds" />
          </View>
        </View>
      )}

      <Card style={{ marginTop: 20 }}>
        <Eyebrow style={{ color: C.ink, marginBottom: 10 }}>Two photos</Eyebrow>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {SLOTS.map((label, i) => {
            const p = photos[i];
            return (
              <View key={label} style={{ flex: 1 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${p ? "change the photo" : "choose a photo"}`} onPress={() => pick(i, "library")} style={{ aspectRatio: 4 / 5, backgroundColor: C.pale, borderWidth: 1, borderColor: p ? C.ink : C.line, borderStyle: p ? "solid" : "dashed", alignItems: "center", justifyContent: "center" }}>
                  {p ? <Image source={{ uri: p.uri }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontFamily: F.black, fontSize: 34, color: C.accent }}>+</Text>}
                </Pressable>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                  <Eyebrow style={{ color: C.ink }}>{label}</Eyebrow>
                  {Platform.OS !== "web" ? (
                    <Text accessibilityRole="button" onPress={() => pick(i, "camera")} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>
                      CAMERA
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card>
        <Eyebrow style={{ color: C.ink }}>The day it was rowed</Eyebrow>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="The day before" onPress={() => setDay(shiftDay(day, -1))} hitSlop={6} style={{ width: 48, height: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>{day === today ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : day}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="The day after" disabled={day >= today} onPress={() => setDay(shiftDay(day, 1))} hitSlop={6} style={{ width: 48, height: 44, justifyContent: "center", alignItems: "flex-end", opacity: day >= today ? 0.25 : 1 }}>
            <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>→</Text>
          </Pressable>
        </View>
      </Card>

      <Card>
        <Eyebrow style={{ color: C.ink }}>A title (optional)</Eyebrow>
        <TextInput style={{ borderBottomWidth: 1, borderColor: C.ink, fontSize: 18, fontFamily: F.bold, paddingVertical: 8, color: C.ink }} value={title} onChangeText={setTitle} maxLength={60} accessibilityLabel="Title" />
      </Card>

      {error ? <Text style={[styles.body, { color: C.accent, marginBottom: 12 }]}>{error}</Text> : null}
      <Btn label={busy || (m > 0 ? `Log ${fmtInt(m)} m` : "Log")} onPress={submit} disabled={!ok || !!busy} />
      {!ok && !busy ? <Text style={[styles.body, { fontSize: 14, marginTop: 8 }]}>{m > 0 && s > 0 ? "Both photos are needed: you, and the monitor." : "Enter the metres and the time."}</Text> : null}
      <Btn label={fixed ? "Back to the monitor" : "Cancel"} quiet onPress={onCancel} disabled={!!busy} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
