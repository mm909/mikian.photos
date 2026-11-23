import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Image, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import Svg, { Line, Path } from "react-native-svg";
import { milestone, projectedMeters } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import type { TelemetryDoc } from "../pm5/session";
import { useSession } from "../session";
import { dropPending, loadPending, loadPendingDoc, onPending, type Pending } from "../store";
import { C, F, fmtClock, fmtInt, fmtPace, onLook } from "../theme";
import { Btn, Card, Eyebrow, Num, styles } from "../ui";
import { FRAME, logRow, pacificToday, pickPhoto, pickPhotos, shiftDay, type Picked } from "../upload";
import { SignIn } from "./Account";
import { GhostRace, useRace } from "./GhostRace";

/* LOG A ROW. Two ways in: connect a Concept2 PM5 and row, or by hand.
 * Both end at the same form: two photos, the day, LOG.
 *
 * THE TWO BUTTONS ARE AT THE FOOT, side by side, under the thumb (owner,
 * 2026-11-21: "should those buttons be down at the bottom, like a connect
 * and then a log by hand, and then the top ... that's where the ...
 * monitors that come up can happen"). The top is how to connect, and the
 * monitors as they are found.
 *
 * THE DEMO ROW IS BACK, as a quiet line under the steps (owner, 2026-11-22,
 * for the App Store's reviewer, who has no rowing machine: "We can bring
 * back the demo row for now"; it had gone on 2026-11-21, "I don't think we
 * need it anymore"). A demo row is never logged outside development, so it
 * ends on its own analytics instead (`onDemoRead`): the read of the piece
 * the simulator rowed, kept nowhere.
 *
 * THERE IS ONE DEMO, 5,000 m at ten times a clock, about two minutes
 * (owner, 2026-11-22: "when I click the plus button, occasionally it brings
 * up like this full animation, and then if I click the plus, after, then it
 * brings me up like a worse demo"). There were two: the address a browser
 * can open the screen with rowed 5,000 m, the distance the field has most
 * rows over, and the line under the steps rowed 2,000 m, which hardly
 * anybody has rowed, so its race page was a lake with nobody on it.
 *
 * THE MONITOR (owner, 2026-11-20): "we don't need an animating wheel. Lets
 * stick to just numbers"; "I would like my avg pace and my current pace. My
 * avg pace should be primary"; "my meters and total time"; "there can be
 * other screens that we can swipe through like a carousel"; "I like the
 * button saying LOG x M"; "Lets make 2 views but should prob be sideways".
 * One monitor for every kind of piece: the four numbers always show; a set
 * distance adds the line to the next 10-second mark (erg/milestone.ts) and
 * the meters left; a set time shows the meters it is on pace for; a plain
 * row shows the four numbers and no line. */

export type Logged = { id: string; meters: number; seconds: number; day: string; doc?: TelemetryDoc; demo: boolean; device: string; strokes: number; avgWatts: number };

/* The demo row's distance, and how many times faster than a clock it runs. */
const DEMO_METERS = 5000;
const DEMO_SPEED = 10;

export function RowScreen({ erg, onLogged, onLeave, onDemoRead }: { erg: Erg; onLogged: (r: Logged) => void; onLeave: () => void; /* A demo row, finished or left: its analytics open, and nothing is logged. */ onDemoRead: (doc: TelemetryDoc, meters: number) => void }) {
  const { ready, me } = useSession();
  const [form, setForm] = useState<"none" | "manual" | "erg" | "old">("none");
  /* The piece as it stood when LOG was pressed: the monitor may still be
   * talking, and the row being logged must not move under the form. */
  const [snap, setSnap] = useState<{ meters: number; seconds: number; strokes: number; avgWatts: number; doc?: TelemetryDoc } | null>(null);
  /* ROWS RECORDED AND NOT LOGGED (store.ts, Pending): read as the screen
   * opens and again whenever one is kept, logged or deleted. */
  const [pending, setPending] = useState<Pending[]>([]);
  /* The one being logged, with its recording read back off the phone. */
  const [old, setOld] = useState<{ p: Pending; doc?: TelemetryDoc } | null>(null);
  useEffect(() => {
    let on = true;
    const read = () => loadPending().then((list) => on && setPending(list));
    read();
    const off = onPending(read);
    return () => {
      on = false;
      off();
    };
  }, []);
  const openOld = async (p: Pending) => {
    const doc = p.hasDoc ? ((await loadPendingDoc(p.id)) ?? undefined) : undefined;
    setOld({ p, doc });
    setForm("old");
  };

  /* A DEMO ROW BY ADDRESS, in a browser only: ?demo=5000 starts the
   * simulator over that distance as this screen opens, and &speed=4 sets
   * how many times faster than a clock it runs. For looking at the
   * monitor's pages with no rowing machine in the room; a demo row is
   * never logged outside development (Monitor, canLog). */
  useEffect(() => {
    if (Platform.OS !== "web" || erg.phase !== "idle" || typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const m = Number(q.get("demo"));
    if (!(m >= 100 && m <= 100_000)) return;
    const sp = Number(q.get("speed"));
    erg.startDemo(Math.round(m), sp >= 1 && sp <= 40 ? sp : DEMO_SPEED);
    // Once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  if (form === "old" && old) {
    const { p, doc } = old;
    return (
      <LogForm
        fixed={{ meters: p.meters, seconds: p.seconds }}
        doc={doc}
        day0={pacificToday(p.at)}
        onCancel={() => setForm("none")}
        onDone={(id, day, meters, seconds, d) => {
          dropPending(p.id).catch(() => null);
          setForm("none");
          setOld(null);
          onLogged({ id, meters, seconds, day, doc: d, demo: false, device: p.device || "PM5", strokes: p.strokes, avgWatts: p.avgWatts });
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
    /* The monitor went back to its menu, or a new piece has not started:
     * what was rowed before is one press away, over the monitor. */
    const waiting = l.meters < 1 ? pending[pending.length - 1] : undefined;
    return (
      <View style={{ flex: 1 }}>
        {waiting ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Log the ${fmtInt(waiting.meters)} meters you rowed`} onPress={() => openOld(waiting)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, minHeight: 52, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.paper, opacity: pressed ? 0.6 : 1 })}>
            <Text style={[styles.body, { flex: 1, color: C.ink }]} numberOfLines={1}>
              Not logged: <Text style={{ fontFamily: F.bold }}>{fmtInt(waiting.meters)} m</Text> in {fmtClock(waiting.seconds, false)}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>LOG IT</Text>
          </Pressable>
        ) : null}
      <Monitor
        erg={erg}
        onLog={() => {
          setSnap({ meters: Math.floor(l.meters), seconds: Math.max(1, Math.round(l.elapsedS)), strokes: l.strokes, avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0, doc: erg.doc() });
          setForm("erg");
        }}
        onRead={() => {
          const doc = erg.doc();
          if (!doc) return;
          const meters = Math.floor(l.meters);
          erg.discard();
          onDemoRead(doc, meters);
        }}
        onLeave={onLeave}
      />
      </View>
    );
  }

  const looking = erg.phase === "scanning" || erg.phase === "connecting";
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {pending.length ? <Unlogged rows={pending} onLog={openOld} /> : null}
        <Eyebrow>Telemetry · Concept2 PM5</Eyebrow>
        <Text style={{ fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.ink, marginVertical: 6 }}>
          Connect your <Text style={{ color: C.accent }}>erg</Text>
        </Text>
        {["On the monitor: Menu, then Connect. Leave it on that screen.", "Press CONNECT here and tap your monitor when it shows up.", "Set the piece on the monitor as usual. The app reads what you set."].map((line, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.line }}>
            <Text style={{ fontFamily: F.black, fontSize: 18, lineHeight: 22, color: C.accent, width: 18 }}>{i + 1}</Text>
            <Text style={[styles.body, { flex: 1 }]}>{line}</Text>
          </View>
        ))}
        {erg.phase === "idle" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Run a demo row" onPress={() => erg.startDemo(DEMO_METERS, DEMO_SPEED)} hitSlop={6} style={({ pressed }) => ({ paddingVertical: 16, opacity: pressed ? 0.5 : 1 })}>
            <Text style={[styles.body, { fontSize: 14 }]}>
              No rowing machine here? <Text style={{ fontFamily: F.bold, color: C.ink, textDecorationLine: "underline" }}>Run a demo row</Text>
            </Text>
          </Pressable>
        ) : null}
        {erg.phase === "connecting" ? (
          <View style={[styles.row, { gap: 10, marginTop: 18 }]}>
            <ActivityIndicator color={C.ink} />
            <Text style={styles.body}>Connecting...</Text>
          </View>
        ) : null}
        {erg.phase === "scanning" ? (
          <View style={{ marginTop: 18 }}>
            <View style={[styles.row, { gap: 10, marginBottom: 8 }]}>
              <ActivityIndicator color={C.ink} />
              <Text style={styles.body}>{erg.found.length ? "Tap your monitor" : "Looking for monitors..."}</Text>
            </View>
            {erg.found.map((d) => (
              <Pressable key={d.id} accessibilityRole="button" onPress={() => erg.pick(d)} style={{ borderTopWidth: 1, borderColor: C.line, paddingVertical: 16 }}>
                <Text style={{ fontSize: 17, fontFamily: F.bold, color: C.ink }}>{d.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {erg.error ? <Text style={[styles.body, { color: C.accent, marginTop: 12 }]}>{erg.error}</Text> : null}
      </ScrollView>
      {/* The foot, clear of the app's own bar. */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 92, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.paper }}>
        <Btn label="Log by hand" quiet onPress={() => setForm("manual")} disabled={erg.phase !== "idle"} style={{ flex: 1 }} />
        {looking ? <Btn label="Stop looking" quiet onPress={erg.discard} style={{ flex: 1 }} /> : <Btn label="Connect" onPress={erg.connect} style={{ flex: 1 }} />}
      </View>
    </View>
  );
}

/* ---- rows not logged yet ----------------------------------------------- */

/* What the phone recorded off a monitor and the rower never logged (owner,
 * 2026-11-22: "if I go to log a row, maybe there should be a history of all
 * my rows that have been done on a rower"), newest first. A press opens the
 * same form a row ends on, with the meters and the time already in it; the
 * photos are added there. DELETE asks once more in place, and then the
 * recording is gone from the phone. */
function Unlogged({ rows, onLog }: { rows: Pending[]; onLog: (p: Pending) => void }) {
  const [sure, setSure] = useState("");
  const today = pacificToday();
  const when = (p: Pending) => {
    const day = pacificToday(p.at);
    const word = day === today ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : day;
    const d = new Date(p.at);
    const h = d.getHours();
    return `${word}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  };
  return (
    <View style={{ marginBottom: 26 }}>
      <Eyebrow>Rowed, not logged yet</Eyebrow>
      {[...rows].reverse().map((p) => (
        <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: C.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Log ${fmtInt(p.meters)} meters, ${when(p)}`} onPress={() => onLog(p)} style={({ pressed }) => ({ flex: 1, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
              <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(p.meters)} m</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.soft, fontVariant: ["tabular-nums"] }}>
                {fmtClock(p.seconds, false)} · {fmtPace(p.meters > 0 ? (p.seconds / p.meters) * 500 : 0)}
              </Text>
            </View>
            <Text style={[styles.body, { fontSize: 13 }]}>
              {when(p)}
              {p.hasDoc ? "" : " · totals only"}
            </Text>
          </Pressable>
          <Text accessibilityRole="button" accessibilityLabel={sure === p.id ? "Delete this recording for good" : "Delete this recording"} onPress={() => (sure === p.id ? (setSure(""), void dropPending(p.id).catch(() => null)) : setSure(p.id))} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.soft, paddingVertical: 14 }}>
            {sure === p.id ? "SURE?" : "DELETE"}
          </Text>
          <Text accessibilityRole="button" accessibilityLabel={`Log ${fmtInt(p.meters)} meters`} onPress={() => onLog(p)} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent, paddingVertical: 14 }}>
            LOG
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ---- the monitor ------------------------------------------------------- */

const signed = (v: number) => `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)} s`;
/* How long the meters stand still before the row counts as stopped. */
const IDLE_MS = 6000;
/* The monitor's pages count from 0: the race and the numbers (the race
 * first when the piece is a set distance), the four figures, the split,
 * the splits, and the way out, which is the last. */
const LAST = 5;

function Monitor({ erg, onLog, onRead, onLeave }: { erg: Erg; onLog: () => void; onRead: () => void; onLeave: () => void }) {
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
   * plain row, or a piece abandoned, the meters standing still for a few
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
  /* A demo row ends on its analytics: it is not logged, so that is what
   * there is to see of it. Eight strokes in, there is a piece to read. In
   * development it can be logged as well, and the read is a second line. */
  const canRead = demo && live.strokes >= 8;
  const ends =
    demo && !canLog ? (
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label="Discard" quiet onPress={erg.discard} style={{ flex: 1 }} />
        <Btn label="See its analytics" onPress={onRead} disabled={!canRead} style={{ flex: 2 }} />
      </View>
    ) : (
      <View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Discard" quiet onPress={erg.discard} style={{ flex: 1 }} />
          <Btn label={canLog ? `Log ${fmtInt(meters)} m` : "Log 0 m"} onPress={onLog} disabled={!canLog} style={{ flex: 2 }} />
        </View>
        {demo ? <Btn label="See its analytics, not logged" quiet onPress={onRead} disabled={!canRead} style={{ marginTop: 10 }} /> : null}
      </View>
    );
  /* THE RACE (GhostRace.tsx) IS THE FIRST PAGE of a set distance (owner,
   * 2026-11-22: "let's have that be the main screen"), with the numbers one
   * swipe on. A plain row or a set time has nobody to race, so there the
   * numbers stay first and the race page, which says so, is the second.
   * Drawn only while it is the page in view. */
  const raceFirst = live.targetM > 0;
  const shared = useRace(live.targetM);
  /* The monitor names its distance a moment after it connects, and the
   * race page arrives ahead of the numbers when it does: the pages go back
   * to the first, so the race is what the rower lands on. */
  const pages = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    pages.current?.scrollTo({ x: 0, animated: false });
    setPage(0);
  }, [raceFirst]);
  /* Edge to edge: the lanes are the width of the page ("let's extend the
   * lanes to be the full width"), and the race page keeps its own margins
   * for its figures. */
  /* THE SAME RACE UP THE PAGE is the page after it while the phone is
   * upright (owner, 2026-11-22: "make a vertical option for when my phone
   * is vertical ... the boat still goes side to side ... I do want another
   * option. Like another slide on that thing for now can be the vertical
   * version"). One race for the two (GhostRace.tsx useRace): the page in
   * view moves it on and says who has a lane; the other draws the same
   * boats. On its side the phone has the one page, across the screen. */
  const upPage = raceFirst && !wide ? 1 : -1;
  const last = LAST + (upPage > 0 ? 1 : 0);
  const race = (
    <View style={{ width: w, height: h }}>
      <GhostRace erg={erg} width={w} height={h} race={shared} drive={page !== upPage} active={page === (raceFirst ? 0 : 1)} />
    </View>
  );
  const raceUp =
    upPage > 0 ? (
      <View style={{ width: w, height: h }}>
        <GhostRace erg={erg} width={w} height={h} race={shared} upright drive={page === upPage} active={page === upPage} />
      </View>
    ) : null;
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
          <ScrollView ref={pages} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={64}>
            {raceFirst ? race : null}
            {raceUp}
            <View style={{ width: w, height: h, paddingHorizontal: 20 }}>
              <Main erg={erg} wide={wide} width={w - 40} />
            </View>
            {raceFirst ? null : race}
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
              <Text style={[styles.body, { marginBottom: 18 }]}>{canLog ? `${fmtInt(meters)} m in ${fmtClock(live.elapsedS, false)} so far. Logging asks for the two photos next.` : demo && meters >= 1 ? "A demo row is not logged. Its analytics open from here." : "Nothing rowed yet."}</Text>
              {ends}
            </View>
          </ScrollView>
        ) : null}
      </View>

      <View accessibilityLabel={`Page ${page + 1} of ${last + 1}`} style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: wide ? 4 : 10 }}>
        {Array.from({ length: last + 1 }, (_, i) => i).map((i) => (
          <View key={i} style={{ width: i === page ? 18 : 6, height: 6, backgroundColor: i === page ? C.accent : C.line }} />
        ))}
      </View>
      {error ? <Text style={[styles.body, { color: C.accent, paddingHorizontal: 20, marginBottom: 6 }]}>{error}</Text> : null}
      {/* While the rower is rowing the screen is numbers and nothing else.
          The buttons come up by themselves once the piece is over or the
          handle has been down a few seconds. */}
      {over && page !== last ? <View style={{ paddingHorizontal: 20, paddingBottom: wide ? 8 : 16 }}>{ends}</View> : <View style={{ height: wide ? 4 : 8 }} />}
    </View>
  );
}

/* PAGE ONE: the average split, big, in the blue; under it what it takes to
 * hit the next mark; then the split right now, the meters and the time. */
function Main({ erg, wide, width }: { erg: Erg; wide: boolean; width: number }) {
  const { live } = erg;
  const ms = milestone(live);
  const pm = projectedMeters(live);
  /* THE AVERAGE KEEPS ITS TENTH AND STAYS ON ONE LINE (owner, 2026-11-22,
   * of the phone on its side: "the average pace number has that decimal and
   * it doesn't fit in the box. It's two lines"; "I'd like having the average
   * pace decimal there"). Six characters of Archivo Black run close to four
   * times the type size wide on the phone, wider than the 3.6 this was cut
   * to, and on its side the column is 1.35 parts of 2.35 less the gap. The
   * size is cut for that, and the phone is told to shrink the line, never
   * to break it, should a face come out wider still. */
  const avgBox = wide ? (width * 1.35) / 2.35 - 8 : width;
  const avgSize = Math.min(wide ? 150 : 132, Math.floor(avgBox / 4.05));
  const avg = (
    <View style={{ flex: wide ? 1.35 : undefined, justifyContent: "center" }}>
      <Eyebrow style={{ color: C.ink }}>Average /500 m</Eyebrow>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ fontFamily: F.black, fontSize: avgSize, lineHeight: Math.round(avgSize * 1.08), color: C.accent, fontVariant: ["tabular-nums"], letterSpacing: -2 }}>
        {fmtPace(live.avgPace)}
      </Text>
      {live.ended && live.targetM > 0 ? (
        <Eyebrow style={{ marginTop: 4 }}>Finished · {fmtInt(live.targetM)} m</Eyebrow>
      ) : (
        <Eyebrow style={{ marginTop: 4 }}>{live.targetM > 0 ? `${fmtInt(Math.max(0, live.targetM - live.meters))} m to go` : " "}</Eyebrow>
      )}
    </View>
  );
  /* WHAT THE ROW WILL FINISH IN, AT THE HEAD OF THE FIGURES AT THE RIGHT
   * (owner, 2026-11-22: it was a line under the average, "like subtitle
   * text ... I actually want to move that just on to the right with the
   * other stats there ... the most important stat there is probably that
   * expected finish time"). To the second, as he asked of it the day
   * before ("just the minute second, not the dot"). A set time has no
   * finish to name: its line is the meters it is on pace for. */
  const finish = ms ? fmtClock(ms.projected, false) : pm ? `${fmtInt(pm)} m` : null;
  /* One figure to a line, the word on the left and the number on the right,
   * so each can be as big as the line is tall. */
  const cell = (k: string, v: string, lead = false) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: lead ? 2 : 1, borderColor: lead ? C.ink : C.line, paddingVertical: wide ? (finish ? 2 : 4) : 10 }}>
      <Eyebrow style={lead ? { color: C.ink } : undefined}>{k}</Eyebrow>
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: wide ? (finish ? 40 : 44) : 52, lineHeight: wide ? (finish ? 45 : 50) : 58, color: C.ink, fontVariant: ["tabular-nums"], letterSpacing: -1 }}>
        {v}
      </Text>
    </View>
  );
  const three = (
    <View style={wide ? { flex: 1, justifyContent: "center", paddingLeft: 28 } : { marginTop: 26 }}>
      {finish ? cell("On pace for", finish, true) : null}
      {/* The split right now, to the second: its tenths only flicker. */}
      {cell("Now /500 m", live.pace > 0 && live.pace < 600 ? fmtClock(live.pace, false) : "-:--")}
      {cell("Meters", fmtInt(Math.floor(live.meters)))}
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
  /* The plot gives up a strip at its left for the labels of the split. */
  const AXIS = 44;
  const plot = Math.max(60, width - AXIS);
  const sx = (m: number) => (m / xMax) * plot;
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
  /* THE AXES (owner, 2026-11-21: "we do need some x-axis labels and some
   * y-axis labels for some of these graphs ... especially when I'm looking
   * at the demo"). Down the left, the split at the top, the middle and the
   * bottom of the window; along the foot, the meters. */
  const tick = (v: string) => <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, fontVariant: ["tabular-nums"] }}>{v}</Text>;
  const short = (p: number) => fmtClock(p, false);
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Eyebrow style={{ color: C.ink }}>Split /500 m along the piece</Eyebrow>
        <Eyebrow>Faster is up</Eyebrow>
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: AXIS, height, justifyContent: "space-between" }}>
          {tick(short(lo))}
          {tick(short(mid))}
          {tick(short(hi))}
        </View>
        <Svg width={plot} height={height}>
          <Line x1={0} y1={height / 2} x2={plot} y2={height / 2} stroke={C.gray} strokeWidth={1} strokeDasharray="4 4" />
          <Path d={d} stroke={C.accent} strokeWidth={3} fill="none" strokeLinejoin="round" />
          <Line x1={0} y1={height - 1} x2={plot} y2={height - 1} stroke={C.ink} strokeWidth={2} />
          <Line x1={1} y1={0} x2={1} y2={height} stroke={C.ink} strokeWidth={2} />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginLeft: AXIS }}>
        {tick("0 m")}
        {tick(`${fmtInt(Math.round(xMax / 2))} m`)}
        {tick(`${fmtInt(Math.round(xMax))} m`)}
      </View>
      <Eyebrow style={{ marginTop: 8, marginLeft: AXIS }}>- - The average, {fmtPace(mid)}</Eyebrow>
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

const fieldOf = () => ({ borderBottomWidth: 1, borderColor: C.ink, fontSize: 30, fontFamily: F.black, paddingVertical: 6, color: C.ink, minWidth: 84 }) as const;
let field = fieldOf();
onLook(() => {
  field = fieldOf();
});

/* A typed time, in seconds: "20:00", "1:02:30", or a bare number for whole
 * minutes. The website's own reading of it (lib/row100k parseDurationText). */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":").map((p) => p.trim());
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  const seconds = nums.length === 1 ? nums[0] * 60 : nums.length === 2 ? nums[0] * 60 + nums[1] : nums[0] * 3600 + nums[1] * 60 + nums[2];
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null;
}

function LogForm({ fixed, doc, day0, onCancel, onDone }: { fixed?: { meters: number; seconds: number }; doc?: TelemetryDoc; /* The day it was rowed, for a row logged later; today when left out. */ day0?: string; onCancel: () => void; onDone: (id: string, day: string, meters: number, seconds: number, doc?: TelemetryDoc) => void }) {
  const today = pacificToday();
  const [meters, setMeters] = useState(fixed ? String(fixed.meters) : "");
  /* The time as ONE entry, as the website takes it (owner, 2026-11-21:
   * "let's keep it meters, and then the time is one enter. Don't split up
   * minutes and seconds, just like we do on the website"): 20:00, 1:02:30,
   * or a bare number for whole minutes. */
  const [time, setTime] = useState("");
  const [day, setDay] = useState(day0 && day0 <= today ? day0 : today);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<(Picked | null)[]>([null, null]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const m = fixed ? fixed.meters : Math.round(Number(meters));
  const s = fixed ? fixed.seconds : (parseTime(time) ?? 0);
  const ok = m > 0 && s > 0 && photos[0] !== null && photos[1] !== null;

  /* BOTH PHOTOS IN ONE VISIT to the library: two picked fill both frames;
   * one picked fills the frame that was pressed. The camera takes one, into
   * the first frame still empty. */
  const pick = async (i: number, from: "camera" | "library") => {
    setError("");
    try {
      if (from === "camera") {
        const p = await pickPhoto("camera");
        if (p) setPhotos((prev) => prev.map((x, k) => (k === i ? p : x)));
        return;
      }
      const got = await pickPhotos(2);
      if (got.length >= 2) setPhotos([got[0], got[1]]);
      else if (got.length === 1) setPhotos((prev) => prev.map((x, k) => (k === i ? got[0] : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be read.");
    }
  };
  const empty = photos[0] === null ? 0 : 1;

  const submit = async () => {
    if (!photos[0] || !photos[1]) return;
    setError("");
    try {
      const r = await logRow({ day, meters: m, seconds: s, title, caption, photos: [photos[0], photos[1]], doc }, setBusy);
      setBusy("");
      onDone(r.id, day, m, s, doc);
    } catch (err) {
      setBusy("");
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 124 }} keyboardShouldPersistTaps="handled">
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
          {/* Side by side (owner, 2026-11-22: "let's put meters and time on
              the same row"). */}
          <View style={{ flexDirection: "row", gap: 18 }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Meters</Eyebrow>
              <TextInput style={field} keyboardType="number-pad" value={meters} onChangeText={setMeters} placeholder="5000" placeholderTextColor={C.line} accessibilityLabel="Meters" />
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>Time</Eyebrow>
              <TextInput style={field} keyboardType="numbers-and-punctuation" autoCorrect={false} value={time} onChangeText={setTime} placeholder="20:00" placeholderTextColor={C.line} accessibilityLabel="Time, as minutes and seconds" />
            </View>
          </View>
        </View>
      )}

      <Card style={{ marginTop: 20 }}>
        {/* Two frames and no names on them (owner, 2026-11-21: "you can
            just put 2 photos, you and the monitor, but it doesn't need to be
            this one you, this one the monitor"). */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <Eyebrow style={{ color: C.ink }}>Two photos: you, and the monitor</Eyebrow>
          {/* WHICH IS FIRST (owner, 2026-11-22: "let's allow people to
              rearrange which photo is first or second when they're
              submitting"). With two photos, moving one is swapping them:
              one press. The first is the one the feed opens on and the
              tile on the rower's grid. */}
          {photos[0] && photos[1] ? (
            <Text accessibilityRole="button" accessibilityLabel="Swap which photo is first" onPress={() => setPhotos((prev) => [prev[1], prev[0]])} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.ink }}>
              ⇄ SWAP
            </Text>
          ) : null}
          {Platform.OS !== "web" ? (
            <Text accessibilityRole="button" onPress={() => pick(empty, "camera")} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>
              CAMERA
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1].map((i) => {
            const p = photos[i];
            return (
              <CropFrame key={i} p={p} label={p ? `Photo ${i + 1}: drag to move it in its frame, tap to change it` : "Choose the two photos"} onPress={() => pick(i, "library")} onMove={(fx, fy) => setPhotos((prev) => prev.map((x, k) => (k === i && x ? { ...x, fx, fy } : x)))} />
            );
          })}
        </View>
        {photos[0] || photos[1] ? <Text style={[styles.body, { fontSize: 13, marginTop: 8 }]}>Drag a photo to choose the part that shows.</Text> : null}
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

      {/* A CAPTION, shown under the photos (owner, 2026-11-22). */}
      <Card>
        <Eyebrow style={{ color: C.ink }}>A description (optional)</Eyebrow>
        <TextInput style={{ borderBottomWidth: 1, borderColor: C.ink, fontSize: 16, lineHeight: 22, fontFamily: F.sans, paddingVertical: 8, color: C.ink, minHeight: 44 }} value={caption} onChangeText={setCaption} multiline maxLength={500} accessibilityLabel="Description" />
      </Card>

      {error ? <Text style={[styles.body, { color: C.accent, marginBottom: 12 }]}>{error}</Text> : null}
      <Btn label={busy || (m > 0 ? `Log ${fmtInt(m)} m` : "Log")} onPress={submit} disabled={!ok || !!busy} />
      {!ok && !busy ? <Text style={[styles.body, { fontSize: 14, marginTop: 8 }]}>{m > 0 && s > 0 ? "Both photos are needed: you, and the monitor." : "Enter the meters and the time."}</Text> : null}
      <Btn label={fixed ? "Back to the monitor" : "Cancel"} quiet onPress={onCancel} disabled={!!busy} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

/* ONE OF THE TWO FRAMES, the shape a row's photo is shown in everywhere,
 * three by four (owner, 2026-11-22: "we also need to be considerate now
 * of crop whenever we upload ... let's allow a nice user interface for
 * that"; and, reading that it had not been built: "why do we not build
 * cropping on upload?"). The photo fills the frame and what does not fit
 * hangs over two of its edges; A DRAG SLIDES THE PHOTO under the frame, so
 * the rower chooses which part is kept, and what is in the frame as LOG is
 * pressed is the picture that is sent (upload.ts frameOf). A tap, as
 * before, goes to the library for another photo. It does not zoom: a
 * photo is as large as fills the frame and no larger. */
function CropFrame({ p, label, onPress, onMove }: { p: Picked | null; label: string; onPress: () => void; onMove: (fx: number, fy: number) => void }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const fx = p?.fx ?? 0.5;
  const fy = p?.fy ?? 0.5;
  /* How the photo sits: as wide or as tall as the frame, whichever makes
   * it cover, and how much of it hangs over each way. */
  const r = p && p.height > 0 ? p.width / p.height : FRAME;
  const wider = r > FRAME;
  const iw = wider ? box.h * r : box.w;
  const ih = wider ? box.h : r > 0 ? box.w / r : box.h;
  const overX = Math.max(0, iw - box.w);
  const overY = Math.max(0, ih - box.h);
  const now = useRef({ fx, fy, overX, overY, onMove });
  now.current = { fx, fy, overX, overY, onMove };
  const from = useRef({ fx: 0.5, fy: 0.5 });
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 5 && now.current.overX + now.current.overY > 0,
      onPanResponderGrant: () => {
        from.current = { fx: now.current.fx, fy: now.current.fy };
      },
      onPanResponderMove: (_, g) => {
        const c = now.current;
        const clamp = (v: number) => Math.min(1, Math.max(0, v));
        c.onMove(c.overX > 0 ? clamp(from.current.fx - g.dx / c.overX) : 0.5, c.overY > 0 ? clamp(from.current.fy - g.dy / c.overY) : 0.5);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  return (
    <View {...(p ? pan.panHandlers : {})} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ flex: 1, aspectRatio: FRAME, backgroundColor: C.pale, borderWidth: 1, borderColor: p ? C.ink : C.line, borderStyle: p ? "solid" : "dashed", overflow: "hidden" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {p && box.w ? <Image source={{ uri: p.uri }} resizeMode="cover" style={{ position: "absolute", left: -overX * fx, top: -overY * fy, width: iw, height: ih }} /> : p ? null : <Text style={{ fontFamily: F.black, fontSize: 34, color: C.ink }}>+</Text>}
      </Pressable>
    </View>
  );
}
