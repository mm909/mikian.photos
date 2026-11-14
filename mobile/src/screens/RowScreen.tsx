import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ble from "../erg/ble";
import { simulate, type ErgLink, type Found, type Handlers } from "../erg/link";
import { EMPTY_LIVE, createLive, type Live } from "../erg/model";
import type { TelemetryDoc } from "../pm5/session";
import type { Row } from "../store";
import { C, F, dayKey, fmtClock, fmtInt, fmtPace } from "../theme";
import { Bar, Btn, Card, Eyebrow, Num, styles } from "../ui";
import { Wheel } from "./Wheel";

/* ROW: connect a Concept2 PM5, watch the piece, bank it.
 *
 * Three ways in. CONNECT is the real thing: on a phone it lists the
 * monitors in range, in a desktop browser it opens the browser's own
 * chooser. DEMO ROW runs the simulator through the same decoder. LOG BY
 * HAND is for a row that was not recorded. */

type Phase = "idle" | "scanning" | "connecting" | "live";

export function RowScreen({ dailyGoal, todayMeters, onSave }: { dailyGoal: number; todayMeters: number; onSave: (r: Row, doc?: TelemetryDoc) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState<Found[]>([]);
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [name, setName] = useState("");
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);
  /* The live screen has two faces: the pace wheel and the numbers. */
  const [face, setFace] = useState<"wheel" | "numbers">("wheel");
  /* The distance the wheel aims at when the monitor is not set to one. */
  const [goalPick, setGoalPick] = useState(5000);
  const model = useRef(createLive()).current;
  const link = useRef<ErgLink | null>(null);
  const stopScan = useRef<(() => void) | null>(null);

  const handlers: Handlers = {
    onPacket: (p) => {
      model.feed(p);
      setLive(model.get());
    },
    onDrop: (reason) => {
      setError(reason);
      link.current = null;
      /* The numbers stay on screen so a dropped piece can still be banked. */
    },
  };

  const leave = () => {
    stopScan.current?.();
    stopScan.current = null;
    link.current?.stop();
    link.current = null;
  };
  useEffect(() => leave, []);

  const begin = (l: ErgLink, isDemo: boolean) => {
    link.current = l;
    setName(l.name);
    setDemo(isDemo);
    setPhase("live");
  };

  const startScan = async () => {
    setError("");
    model.reset();
    setLive(EMPTY_LIVE);
    if (!ble.available()) return setError("This browser has no Bluetooth. Use the phone app, or Chrome on a computer.");
    try {
      if (ble.hasScanList) {
        setFound([]);
        setPhase("scanning");
        stopScan.current = await ble.scan((d) => setFound((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d])));
      } else {
        setPhase("connecting");
        begin(await ble.connect(null, handlers), false);
      }
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not start Bluetooth.");
    }
  };

  const pick = async (d: Found) => {
    stopScan.current?.();
    stopScan.current = null;
    setPhase("connecting");
    try {
      begin(await ble.connect(d.id, handlers), false);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not connect to that monitor.");
    }
  };

  const startDemo = () => {
    setError("");
    model.reset();
    setLive(EMPTY_LIVE);
    begin(simulate(handlers), true);
  };

  const cancel = () => {
    leave();
    setPhase("idle");
  };

  const bank = () => {
    const l = model.get();
    /* The whole piece, for THE READ. A piece too short to analyse is banked without one. */
    let doc: TelemetryDoc | undefined;
    try {
      if (l.strokes >= 8) doc = model.toDoc(name || "PM5", demo);
    } catch {
      doc = undefined;
    }
    leave();
    setPhase("idle");
    onSave(
      {
        id: `${Date.now()}`,
        day: dayKey(),
        at: Date.now(),
        meters: Math.floor(l.meters),
        seconds: l.elapsedS,
        strokes: l.strokes,
        avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0,
        source: demo ? "demo" : "erg",
        hasDoc: !!doc,
        device: name || "PM5",
      },
      doc,
    );
  };

  if (phase === "live") {
    const peak = Math.max(1, ...live.curve);
    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={[styles.row, { justifyContent: "space-between", marginBottom: 10 }]}>
          <Eyebrow style={{ color: error ? C.accent : C.good }}>{error ? "Disconnected" : live.ended ? "Piece finished" : live.awake ? "Live" : "Connected, waiting"}</Eyebrow>
          <Eyebrow>{name}</Eyebrow>
        </View>

        <View style={{ flexDirection: "row", gap: 22, borderBottomWidth: 2, borderColor: C.ink, marginBottom: 14 }}>
          {(["wheel", "numbers"] as const).map((v) => (
            <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: face === v }} onPress={() => setFace(v)} style={{ paddingVertical: 10, borderBottomWidth: 3, borderColor: face === v ? C.accent : "transparent", marginBottom: -2 }}>
              <Text style={{ fontFamily: face === v ? F.monoBold : F.mono, fontSize: 13, letterSpacing: 2.2, color: face === v ? C.ink : C.gray }}>{v.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>

        {face === "wheel" ? (
          <View style={{ marginBottom: 18 }}>
            <Wheel live={live} goalM={live.targetM > 0 ? live.targetM : goalPick} />
            {live.targetM > 0 ? null : (
              <View style={[styles.row, { gap: 8, marginTop: 14 }]}>
                <Eyebrow>Goal</Eyebrow>
                {[2000, 5000, 10000].map((g) => (
                  <Pressable key={g} accessibilityRole="button" accessibilityState={{ selected: goalPick === g }} onPress={() => setGoalPick(g)} style={{ borderWidth: 1, borderColor: goalPick === g ? C.accent : C.line, paddingHorizontal: 12, minHeight: 40, justifyContent: "center" }}>
                    <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.5, color: goalPick === g ? C.accent : C.soft }}>{g / 1000}K</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            <Card>
              <Eyebrow>Meters</Eyebrow>
              <Num size={96} color={C.accent}>
                {fmtInt(Math.floor(live.meters))}
              </Num>
              <Bar value={todayMeters + live.meters} goal={dailyGoal} height={10} />
              <Text style={[styles.body, { marginTop: 6 }]}>
                {fmtInt(todayMeters + Math.floor(live.meters))} of {fmtInt(dailyGoal)} m today
              </Text>
            </Card>

            <View style={[styles.row, { gap: 14 }]}>
              <Card style={{ flex: 1 }}>
                <Eyebrow>Time</Eyebrow>
                <Num size={34}>{fmtClock(live.elapsedS)}</Num>
              </Card>
              <Card style={{ flex: 1 }}>
                <Eyebrow>/500m</Eyebrow>
                <Num size={34}>{fmtPace(live.pace)}</Num>
              </Card>
            </View>
            <View style={[styles.row, { gap: 14 }]}>
              <Card style={{ flex: 1 }}>
                <Eyebrow>S/M</Eyebrow>
                <Num size={30}>{live.spm > 0 ? live.spm : "--"}</Num>
              </Card>
              <Card style={{ flex: 1 }}>
                <Eyebrow>Watts</Eyebrow>
                <Num size={30}>{live.watts > 0 ? fmtInt(live.watts) : "---"}</Num>
              </Card>
              <Card style={{ flex: 1 }}>
                <Eyebrow>Avg</Eyebrow>
                <Num size={30}>{fmtPace(live.avgPace)}</Num>
              </Card>
            </View>

            <Card>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Eyebrow>Your stroke</Eyebrow>
                <Eyebrow>{live.peakLbf > 0 ? `Peak ${Math.round(live.peakLbf)} lbf` : `Stroke ${live.strokes}`}</Eyebrow>
              </View>
              <View style={{ height: 110, flexDirection: "row", alignItems: "flex-end", marginTop: 10, borderBottomWidth: 2, borderColor: C.ink }}>
                {live.curve.length ? (
                  live.curve.map((p, i) => <View key={i} style={{ flex: 1, height: `${Math.max(2, (p / peak) * 100)}%`, backgroundColor: C.accent, marginHorizontal: 0.5 }} />)
                ) : (
                  <Text style={[styles.body, { paddingBottom: 40 }]}>The force curve draws here once you take a stroke.</Text>
                )}
              </View>
            </Card>
          </>
        )}

        {error ? <Text style={[styles.body, { color: C.accent, marginBottom: 10 }]}>{error}</Text> : null}
        <Btn label={`Bank ${fmtInt(Math.floor(live.meters))} m`} onPress={bank} disabled={live.meters < 1} />
        <Btn label="Discard" quiet onPress={cancel} style={{ marginTop: 10 }} />
        {demo ? <Text style={[styles.body, { marginTop: 12 }]}>A demo row: the simulator, sped up. It is saved marked as a demo.</Text> : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Card>
        <Eyebrow>Concept2 PM5</Eyebrow>
        <Text style={{ fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.ink, marginVertical: 6 }}>
          Connect your <Text style={{ color: C.accent }}>erg</Text>
        </Text>
        <Text style={[styles.body, { marginBottom: 14 }]}>On the monitor: Menu, then Connect. Leave it on that screen and press the button.</Text>
        {phase === "idle" ? <Btn label="Connect" onPress={startScan} /> : null}
        {phase === "connecting" ? (
          <View style={[styles.row, { gap: 10 }]}>
            <ActivityIndicator color={C.ink} />
            <Text style={styles.body}>Connecting...</Text>
          </View>
        ) : null}
        {phase === "scanning" ? (
          <View>
            <View style={[styles.row, { gap: 10, marginBottom: 8 }]}>
              <ActivityIndicator color={C.ink} />
              <Text style={styles.body}>{found.length ? "Tap your monitor" : "Looking for monitors..."}</Text>
            </View>
            {found.map((d) => (
              <Pressable key={d.id} onPress={() => pick(d)} style={{ borderTopWidth: 1, borderColor: C.line, paddingVertical: 16 }}>
                <Text style={{ fontSize: 17, fontFamily: F.bold, color: C.ink }}>{d.name}</Text>
              </Pressable>
            ))}
            <Btn label="Stop looking" quiet onPress={cancel} style={{ marginTop: 10 }} />
          </View>
        ) : null}
        {error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{error}</Text> : null}
      </Card>

      <Btn label="Demo row" quiet onPress={startDemo} disabled={phase !== "idle"} />
      <Btn label={manual ? "Close" : "Log by hand"} quiet onPress={() => setManual(!manual)} style={{ marginTop: 10 }} disabled={phase !== "idle"} />
      {manual ? <Manual onSave={onSave} /> : null}
    </ScrollView>
  );
}

function Manual({ onSave }: { onSave: (r: Row) => void }) {
  const [meters, setMeters] = useState("5000");
  const [mins, setMins] = useState("20");
  const [secs, setSecs] = useState("00");
  const m = Math.round(Number(meters));
  const s = Math.round(Number(mins)) * 60 + Number(secs);
  const ok = m > 0 && m <= 500000 && s > 0;
  const field = { borderBottomWidth: 1, borderColor: C.ink, fontSize: 30, fontFamily: F.black, paddingVertical: 6, color: C.ink, minWidth: 84 } as const;
  return (
    <Card style={{ marginTop: 14 }}>
      <Eyebrow>Meters</Eyebrow>
      <TextInput style={[field, { marginBottom: 12 }]} keyboardType="number-pad" value={meters} onChangeText={setMeters} accessibilityLabel="Meters" />
      <Eyebrow>Time</Eyebrow>
      <View style={[styles.row, { gap: 8, marginBottom: 14 }]}>
        <TextInput style={field} keyboardType="number-pad" value={mins} onChangeText={setMins} accessibilityLabel="Minutes" />
        <Text style={styles.mid}>:</Text>
        <TextInput style={field} keyboardType="number-pad" value={secs} onChangeText={setSecs} accessibilityLabel="Seconds" />
      </View>
      <Btn label="Bank it" disabled={!ok} onPress={() => onSave({ id: `${Date.now()}`, day: dayKey(), at: Date.now(), meters: m, seconds: s, strokes: 0, avgWatts: 0, source: "manual" })} />
    </Card>
  );
}
