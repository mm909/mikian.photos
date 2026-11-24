import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, Animated, Easing, Image, Modal, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import Svg, { Line, Path } from "react-native-svg";
import { milestone, projectedMeters } from "../erg/milestone";
import type { Erg } from "../erg/useErg";
import type { TelemetryDoc } from "../pm5/session";
import { useSession } from "../session";
import { mono } from "../site";
import { ApiError, api } from "../api";
import { autoOf, onAuto, sendPiece, type Saved } from "../autolog";
import { PENDING_MIN_M, dropPending, loadPending, loadPendingDoc, onPending, type Pending } from "../store";
import { C, F, MONTHS, fmtClock, fmtInt, fmtPace, onLook } from "../theme";
import { Btn, Card, Eyebrow, Num, styles } from "../ui";
import { FRAME, finishRow, logRow, pacificToday, pickPhoto, pickPhotos, shiftDay, type Picked, type Progress } from "../upload";
import { SignIn } from "./Account";
import { GhostRace, useRace } from "./GhostRace";
import { Produced, useDirector } from "./Produced";
import { useShow } from "../arcade/useShow";
import { ShowOverlay, ShowPage, overlays } from "./Show";

/* LOG A ROW. Two ways in: connect a Concept2 PM5 and row, or by hand.
 * Both end at the same form: two photos, the day, LOG.
 *
 * A ROW OFF THE MONITOR IS LOGGED BEFORE THE FORM (owner, 2026-11-23:
 * "Strava does this thing where it's like it automatically logs the row and
 * then lets you add the photos ... the intention is that every row gets
 * logged"; autolog.ts has when and which). The monitor says LOGGED at its
 * foot the moment the piece is over, with DONE and ADD PHOTOS under it. The
 * form is the same form, come to with the row already on the board: its
 * photos are two or none, its button adds them, and DELETE THIS ROW at its
 * foot is what DISCARD was. A row typed in by hand still needs its two
 * photos before it is logged at all.
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

export type Logged = { id: string; meters: number; seconds: number; day: string; doc?: TelemetryDoc; demo: boolean; device: string; strokes: number; avgWatts: number; /* A demo row "logged": what the form had in it, for the page it ends on, which is drawn on the phone. Nothing was sent. */ fake?: Faked };

/* A DEMO ROW GOES THROUGH THE WHOLE LOG (owner, 2026-11-24: "if I submit
 * the demo row, I want to run through like the post screen. Like I want to
 * be able to fake submit a row"). Its form is the real form, its bar runs as
 * if it were sending, and it lands on the page a logged row lands on, with
 * the all-time meters, the bars and the board moving, but nothing leaves the
 * phone: no row, no photos, no recording. The page says so at the top. */
export type Faked = { title: string; caption: string; seconds: number; photos: { full: string; thumb: string | null }[] };

/* The demo row's distance, and how many times faster than a clock it runs. */
const DEMO_METERS = 5000;
const DEMO_SPEED = 10;

export function RowScreen({ erg, onLogged, onLeave, onDemoRead }: { erg: Erg; onLogged: (r: Logged) => void; onLeave: () => void; /* A demo row, finished or left: its analytics open, and nothing is logged. */ onDemoRead: (doc: TelemetryDoc, meters: number) => void }) {
  const { ready, me } = useSession();
  const [form, setForm] = useState<"none" | "manual" | "erg" | "old">("none");
  /* The piece as it stood when LOG was pressed: the monitor may still be
   * talking, and the row being logged must not move under the form. */
  const [snap, setSnap] = useState<{ meters: number; seconds: number; strokes: number; avgWatts: number; doc?: TelemetryDoc; /* The row is on the site already (autolog.ts). */ logged?: Saved } | null>(null);
  /* ROWS RECORDED AND NOT LOGGED (store.ts, Pending): read as the screen
   * opens and again whenever one is kept, logged or deleted. */
  const [pending, setPending] = useState<Pending[]>([]);
  /* The one being logged, with its recording read back off the phone. */
  const [old, setOld] = useState<{ p: Pending; doc?: TelemetryDoc; logged?: Saved } | null>(null);
  /* The kept piece LOG was pressed on, while it is on its way in; and a
   * fresh look at the list whenever the sender has news of any of them. */
  const [sending, setSending] = useState("");
  const [, setNews] = useState(0);
  useEffect(() => onAuto(() => setNews((n) => n + 1)), []);
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
  /* LOG on a kept piece. With its recording it is logged there and then,
   * and the form comes up on a row that exists; a piece the phone kept only
   * the totals of goes in the old way, with its two photos. */
  const openOld = async (p: Pending) => {
    if (sending) return;
    const doc = p.hasDoc ? ((await loadPendingDoc(p.id)) ?? undefined) : undefined;
    if (!doc) {
      setOld({ p, doc });
      setForm("old");
      return;
    }
    setSending(p.id);
    const st = await sendPiece(p.id);
    setSending("");
    if (st.state !== "saved") return;
    setOld({ p, doc, logged: st });
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
    /* &as=real, in development only (useErg.ts): the simulator's row as a
     * row off a monitor, so a row logging itself can be seen end to end
     * against the sandbox. The site's build ignores it. */
    erg.startDemo(Math.round(m), sp >= 1 && sp <= 40 ? sp : DEMO_SPEED, q.get("as") === "real");
    // Once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (ready && !me.signedIn) return <SignIn why="Logging a row needs your account." />;

  if (form === "erg" && snap) {
    /* Is the piece on the monitor still the one this form is about? A
     * rower who started another piece while the form was open keeps that
     * piece: the monitor is let go of only when it is still on this row. */
    const stillIt = !snap.logged || (erg.auto?.state === "saved" && erg.auto.rowId === snap.logged.rowId);
    return (
      <LogForm
        fixed={{ meters: snap.meters, seconds: snap.seconds }}
        doc={snap.doc}
        fake={erg.demo}
        logged={snap.logged}
        onCancel={() => setForm("none")}
        onGone={() => {
          if (stillIt) erg.discard();
          setForm("none");
        }}
        onDone={(id, day, meters, seconds, doc, fake) => {
          const out: Logged = { id, meters, seconds, day, doc, demo: erg.demo, device: erg.name || "PM5", strokes: snap.strokes, avgWatts: snap.avgWatts, fake };
          if (stillIt) erg.discard();
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
        logged={old.logged}
        back="Back"
        onCancel={() => setForm("none")}
        onGone={() => {
          setForm("none");
          setOld(null);
        }}
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
    /* To the form, with the piece as it stands; `logged` when it is on the
     * site already, whose own count of the meters and the time is the one
     * the form shows. */
    const toForm = (logged?: Saved) => {
      setSnap({ meters: logged?.meters ?? Math.floor(l.meters), seconds: logged?.seconds ?? Math.max(1, Math.round(l.elapsedS)), strokes: l.strokes, avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0, doc: erg.doc(), logged });
      setForm("erg");
    };
    return (
      <View style={{ flex: 1 }}>
        {waiting ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Log the ${fmtInt(waiting.meters)} meters you rowed`} onPress={() => openOld(waiting)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, minHeight: 52, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.paper, opacity: pressed ? 0.6 : 1 })}>
            <Text style={[styles.body, { flex: 1, color: C.ink }]} numberOfLines={1}>
              Not logged: <Text style={{ fontFamily: F.bold }}>{fmtInt(waiting.meters)} m</Text> in {fmtClock(waiting.seconds, false)}
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>{sending === waiting.id ? "LOGGING" : "LOG IT"}</Text>
          </Pressable>
        ) : null}
      <Monitor
        erg={erg}
        onLog={async () => {
          /* A piece too short to have a recording (under 100 m, or a few
           * pulls) goes in the old way: the form first, two photos. */
          if (!erg.demo && (l.meters < PENDING_MIN_M || l.strokes < 8)) {
            toForm();
            return;
          }
          const st = await erg.logNow();
          if (st?.state === "saved") toForm(st);
        }}
        onAdd={() => {
          if (erg.auto?.state === "saved") toForm(erg.auto);
        }}
        onDone={() => {
          const a = erg.auto;
          if (a?.state !== "saved") return;
          const out: Logged = { id: a.rowId, meters: a.meters, seconds: a.seconds, day: a.day, doc: erg.doc(), demo: erg.demo, device: erg.name || "PM5", strokes: l.strokes, avgWatts: l.wattN ? Math.round(l.wattSum / l.wattN) : 0, ...(erg.demo ? { fake: { title: "", caption: "", seconds: a.seconds, photos: [] } } : {}) };
          erg.discard();
          onLogged(out);
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
        {pending.length ? <Unlogged rows={pending} sending={sending} onLog={openOld} /> : null}
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
function Unlogged({ rows, sending, onLog }: { rows: Pending[]; /* The one LOG was pressed on, on its way in. */ sending: string; onLog: (p: Pending) => void }) {
  const [sure, setSure] = useState("");
  const today = pacificToday();
  const when = (p: Pending) => {
    const day = pacificToday(p.at);
    const word = day === today ? "Today" : day === shiftDay(today, -1) ? "Yesterday" : day;
    const d = new Date(p.at);
    const h = d.getHours();
    return `${word}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  };
  /* WHY IT IS STILL HERE, when there is a reason to give: the site would
   * not take it (its own words), it has not got through yet, or it is the
   * short half of a piece that was logged whole (autolog.ts). */
  const why = (p: Pending) => {
    const st = autoOf(p.id);
    if (st?.state === "saving") return "Logging it now";
    if (p.refused) return p.refused;
    if (st?.state === "refused") return st.error;
    if (st?.state === "waiting") return "Not sent yet. It sends itself when there is a signal.";
    if (p.dup) return "The first part of a longer row that is logged. Delete it, unless it was a row of its own.";
    return "";
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
            {why(p) ? <Text style={[styles.body, { fontSize: 13, color: C.accent }]}>{why(p)}</Text> : null}
          </Pressable>
          <Text accessibilityRole="button" accessibilityLabel={sure === p.id ? "Delete this recording for good" : "Delete this recording"} onPress={() => (sure === p.id ? (setSure(""), void dropPending(p.id).catch(() => null)) : setSure(p.id))} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.soft, paddingVertical: 14 }}>
            {sure === p.id ? "SURE?" : "DELETE"}
          </Text>
          <Text accessibilityRole="button" accessibilityLabel={`Log ${fmtInt(p.meters)} meters`} onPress={() => onLog(p)} style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent, paddingVertical: 14 }}>
            {sending === p.id ? "LOGGING" : "LOG"}
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
/* How long the monitor has to have called a piece finished before the
 * buttons come up for it. */
const END_HOLD_MS = 1200;
/* The monitor's pages count from 0: the race and the numbers (the race
 * first when the piece is a set distance), the four figures, the split,
 * the splits, and the way out, which is the last. A set distance has the
 * produced row after the race, and upright the race up the page after
 * that; those are counted where they are added. */
const LAST = 5;

function Monitor({ erg, onLog, onAdd, onDone, onRead, onLeave }: { erg: Erg; /* LOG, on a piece that has not logged itself. */ onLog: () => void | Promise<void>; /* The row is logged: on to the form for its photos, or straight to its page. */ onAdd: () => void; onDone: () => void; onRead: () => void; onLeave: () => void }) {
  const { live, name, error, demo, auto } = erg;
  /* LOG was pressed and the row is on its way in. */
  const [asking, setAsking] = useState(false);
  const log = async () => {
    if (asking) return;
    setAsking(true);
    try {
      await onLog();
    } finally {
      setAsking(false);
    }
  };
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
  /* The width the pages were last put in their place at: while the phone
   * is being turned the pages are a new width and the strip is still where
   * the old one left it, and what it says of itself then is not a swipe. */
  const settled = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => w && settled.current === w && setPage(Math.round(e.nativeEvent.contentOffset.x / w));
  const meters = Math.floor(live.meters);
  /* A demo row is the simulator: it shows the screens, and its LOG walks
   * through the form and the page a row lands on without sending anything
   * (Faked, above). It was never logged outside development, and is not
   * logged in development now either. */
  const canLog = meters >= 1;
  /* HAS THE ROWER STOPPED (owner, 2026-11-20: "have them only pop up when
   * the rower is either just starting or just finished, prob just
   * finished"). The monitor says so itself when a set piece ends; for a
   * plain row, or a piece abandoned, the meters standing still for a few
   * seconds says it. Before the first stroke there is nothing to log, so
   * nothing shows: the way out then is the last page. */
  const moved = useRef({ m: 0, at: Date.now() });
  if (live.meters !== moved.current.m) moved.current = { m: live.meters, at: Date.now() };
  /* NEVER ON THE FIRST STROKE (owner, 2026-11-23: "As soon as I started
   * rowing on the race view for live, like the first stroke, it pulled up
   * those buttons to like submit and cancel my row, and then they went
   * away. They just flashed for a moment"). What did it: "the meters have
   * stood still" was a note taken once a second, and before a row the
   * meters have stood at nothing for as long as the rower took to sit
   * down, so the note said STILL. The first stroke made the meters 1, the
   * note was up to a second old, and for that long the two together read
   * as a row that had stopped. Now it is worked out as the screen is
   * drawn, off the moment the meters last moved, so the stroke that moves
   * them is the one that clears it; the clock below only has the screen
   * drawn again a few times a second so the six seconds are noticed. And a piece
   * the monitor calls finished has to have been finished for a moment
   * (END_HOLD_MS) before it counts, so one stray word from the monitor as a
   * piece starts cannot bring the buttons up either. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 400);
    return () => clearInterval(t);
  }, []);
  const endedSince = useRef(0);
  if (!live.ended) endedSince.current = 0;
  else if (!endedSince.current) endedSince.current = Date.now();
  const at = Date.now();
  const still = at - moved.current.at > IDLE_MS;
  const finished = live.ended && at - endedSince.current >= END_HOLD_MS;
  const over = meters >= 1 && (finished || !!error || still || !!auto);
  /* A demo row's LOG is a pretend one (Faked); its analytics on their own
   * are the second line. Eight strokes in, there is a piece to read. */
  const canRead = demo && live.strokes >= 8;
  /* THE FOOT OF A ROW THAT IS OVER. A piece that logs itself (autolog.ts)
   * says so here, big enough to read from the seat: LOGGED, and under it
   * DONE and ADD PHOTOS. While it is on its way in the two wait. A piece
   * that did not get through says why, and keeps DISCARD and a second try.
   * A piece that does not log itself (stopped short of 500 m, or still
   * being rowed) has DISCARD and LOG as it always had, and LOG now logs it
   * there and then. */
  const said = (big: string, small: string, color: string) => (
    <View style={{ marginBottom: 10 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: F.black, fontSize: 24, lineHeight: 28, color, fontVariant: ["tabular-nums"] }}>
        {big}
      </Text>
      {small ? <Text style={{ fontFamily: F.mono, fontSize: 12, lineHeight: 17, color: C.soft, marginTop: 2 }}>{small}</Text> : null}
    </View>
  );
  const analytics = demo ? <Btn label="Just its analytics" quiet onPress={onRead} disabled={!canRead} style={{ marginTop: 10 }} /> : null;
  const ends =
    auto?.state === "saved" || auto?.state === "saving" || asking ? (
      <View>
        {auto?.state === "saved" ? said(`Logged · ${fmtInt(auto.meters)} m`, demo ? "A demo: nothing was saved. The photos are next, or not at all." : "It is on the board. Add the two photos now, or later from the row.", C.good) : said(`Logging ${fmtInt(meters)} m`, "Sending the row.", C.ink)}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Done" quiet onPress={onDone} disabled={auto?.state !== "saved"} style={{ flex: 1 }} />
          <Btn label="Add photos" onPress={onAdd} disabled={auto?.state !== "saved"} style={{ flex: 2 }} />
        </View>
        {analytics}
      </View>
    ) : (
      <View>
        {auto?.state === "waiting" ? said("Not sent yet", `${auto.error} The row is kept on this phone and sends itself when it can.`, C.accent) : auto?.state === "refused" ? said("Not logged", auto.error, C.accent) : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Btn label="Discard" quiet onPress={erg.discard} style={{ flex: 1 }} />
          <Btn label={auto ? "Try again" : canLog ? `Log ${fmtInt(meters)} m` : "Log 0 m"} onPress={log} disabled={!canLog} style={{ flex: 2 }} />
        </View>
        {analytics}
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
  /* THE PRODUCED ROW is the page after the race (owner, 2026-11-23: "I want
   * to produce a screen that they're looking at ... like a 20-minute
   * television show"; Produced.tsx, and its director in erg/director.ts).
   * One more page, and every page there was is still there. A set distance
   * only, as the race is. The director is held here, beside the race, so
   * it has watched the whole row whichever page was up. MINE: one swipe
   * from the race and not ahead of it, until he has seen it on a phone;
   * the race is the page he said to land on. */
  /* THE SHOW (owner, 2026-11-24, 3 AM: the 5K as a show by the clock, with
   * 159 as a match against bots; arcade/show.ts, screens/Show.tsx). For the
   * owner the produced page IS the show, from the intro to the last chest,
   * and for a plain row too, where it is the page after the numbers. The
   * ready check, the match and its celebration are laid over whichever
   * other page is in view, so they are seen without a swipe; not on the way
   * out, and not once the row has stopped. OWNER ONLY for now: the App
   * Store build has no games, and everybody else's produced page is as it
   * was. (The single-player 159 against rocks, arcade/useArcade.ts, is kept
   * in the code and no longer dropped into the row.) */
  const { me } = useSession();
  const showOn = !!me.isAdmin;
  const prodPage = raceFirst || showOn ? 1 : -1;
  const directed = useDirector(erg, shared);
  const showed = useShow(erg, showOn);
  const upPage = raceFirst && !wide ? 2 : -1;
  const last = LAST + (prodPage > 0 ? 1 : 0) + (upPage > 0 ? 1 : 0);
  /* A PHONE THAT IS TURNED KEEPS ITS PAGE. The pages are as wide as the
   * screen, so turning it left the strip between two of them, or on the
   * first: nothing to notice while the race was the first page and the
   * one looked at, and the produced page is the second. */
  useEffect(() => {
    if (!w) return;
    pages.current?.scrollTo({ x: page * w, animated: false });
    settled.current = w;
    // Only as the width changes; `page` is the one it was on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);
  /* A TAP TURNS THE PAGE (owner, 2026-11-23: "Let me just tap the screen
   * instead of swiping to change the view that I'm looking at during the
   * live row"). Anywhere on a page that is not a button goes to the next
   * one, and from the last back to the first. The swipe is as it was: a
   * finger that moves is a swipe and one that does not is a tap, as on any
   * list of rows. The buttons on the last page, and the ones that come up
   * under the pages when the row stops, are their own presses. */
  const next = () => {
    if (!w) return;
    const n = page >= last ? 0 : page + 1;
    pages.current?.scrollTo({ x: n * w, animated: n !== 0 });
    setPage(n);
  };
  /* SINGLE PLAYER DROPS STRAIGHT IN (owner, 2026-11-24: "keep the same
   * intro/show screens, then drop straight into single player"): as the
   * island starts, the pages go to the show, once a row; a swipe away from
   * it after that is the rower's own. */
  const dropped = useRef(false);
  useEffect(() => {
    if (showed.phase === "intro") dropped.current = false;
    if (showed.phase !== "battle" || dropped.current || !w || prodPage < 0) return;
    dropped.current = true;
    const n = prodPage;
    pages.current?.scrollTo({ x: n * w, animated: true });
    setPage(n);
  }, [showed.phase, w, prodPage]);
  const plain = Platform.OS === "web" ? ({ cursor: "auto" } as ViewStyle) : null;
  const leaf = (children: ReactNode, style?: ViewStyle) => (
    <Pressable accessible={false} onPress={next} style={[{ width: w, height: h }, plain, style]}>
      {children}
    </Pressable>
  );
  /* The show has no race on it, so the race page keeps the race going while
   * the show is the page in view. */
  const race = leaf(<GhostRace erg={erg} width={w} height={h} race={shared} drive={page !== upPage && (page !== prodPage || showOn)} active={page === (raceFirst ? 0 : prodPage > 0 ? 2 : 1)} />);
  const produced = showOn ? leaf(<ShowPage showed={showed} erg={erg} width={w} height={h} active={page === prodPage} />) : prodPage > 0 ? leaf(<Produced erg={erg} race={shared} directed={directed} width={w} height={h} active={page === prodPage} />) : null;
  const raceUp = upPage > 0 ? leaf(<GhostRace erg={erg} width={w} height={h} race={shared} upright drive={page === upPage} active={page === upPage} />) : null;
  const status = error ? "Disconnected" : auto?.state === "saved" ? "Logged" : live.ended ? "Piece finished" : live.awake ? "Live" : "Connected, waiting";
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
            {raceFirst ? produced : null}
            {raceUp}
            {leaf(<Main erg={erg} wide={wide} width={w - 40} />, { paddingHorizontal: 20 })}
            {raceFirst ? null : produced}
            {raceFirst ? null : race}
            {leaf(
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Big k="Strokes a minute" v={live.spm > 0 ? `${live.spm}` : "--"} wide={wide} />
                <Big k="Watts" v={live.watts > 0 ? fmtInt(live.watts) : "---"} wide={wide} />
                <Big k="Heart rate" v={live.hr ? `${live.hr}` : "--"} wide={wide} />
                <Big k="Drag factor" v={live.drag > 0 ? `${live.drag}` : "--"} wide={wide} />
              </View>,
              { paddingHorizontal: 20, justifyContent: "center" },
            )}
            {leaf(<PacePage erg={erg} width={w - 40} height={Math.max(90, Math.min(260, h - 70))} />, { paddingHorizontal: 20, justifyContent: "center" })}
            <ScrollView style={{ width: w, height: h }} contentContainerStyle={{ minHeight: h }}>
              <Pressable accessible={false} onPress={next} style={[{ flex: 1, minHeight: h, paddingHorizontal: 20, paddingTop: 10 }, plain]}>
                <SplitsPage erg={erg} />
              </Pressable>
            </ScrollView>
            {/* THE LAST PAGE: the way out, always a swipe away. */}
            {leaf(
              <>
                <Eyebrow style={{ color: C.ink, marginBottom: 6 }}>End the row</Eyebrow>
                <Text style={[styles.body, { marginBottom: 18 }]}>{canLog ? (demo ? `${fmtInt(meters)} m in ${fmtClock(live.elapsedS, false)}. A demo: logging it goes through the form and the page after, and nothing is saved.` : auto?.state === "saved" ? `${fmtInt(meters)} m in ${fmtClock(live.elapsedS, false)}.` : `${fmtInt(meters)} m in ${fmtClock(live.elapsedS, false)} so far. Logging it puts it on the board at once; the two photos can be added after.`) : "Nothing rowed yet."}</Text>
                {ends}
              </>,
              { paddingHorizontal: 20, justifyContent: "center" },
            )}
          </ScrollView>
        ) : null}
        {w && showOn && showed.key && overlays(showed.view.current) && page !== prodPage && page !== last && !over ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
            <ShowOverlay showed={showed} erg={erg} width={w} height={h} />
          </View>
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

function LogForm({
  fixed,
  doc,
  day0,
  fake,
  logged,
  back,
  onCancel,
  onGone,
  onDone,
}: {
  fixed?: { meters: number; seconds: number };
  doc?: TelemetryDoc;
  /* The day it was rowed, for a row logged later; today when left out. */
  day0?: string;
  /* A demo row: the form is the same, the photos are not required, and LOG sends nothing (Faked). */
  fake?: boolean;
  /* THE ROW IS ON THE SITE ALREADY (a row off the monitor: autolog.ts). The
   * form adds to it: two photos or none, the title the site gave it there
   * to be typed over, the words, another day. Its button says what it will
   * do, and DELETE THIS ROW is at the foot. */
  logged?: Saved;
  /* The word on the way back out, when it is not the monitor behind it. */
  back?: string;
  onCancel: () => void;
  /* The logged row was deleted from here. */
  onGone?: () => void;
  onDone: (id: string, day: string, meters: number, seconds: number, doc?: TelemetryDoc, fake?: Faked) => void;
}) {
  const today = pacificToday();
  const [meters, setMeters] = useState(fixed ? String(fixed.meters) : "");
  /* The time as ONE entry, as the website takes it (owner, 2026-11-21:
   * "let's keep it meters, and then the time is one enter. Don't split up
   * minutes and seconds, just like we do on the website"): 20:00, 1:02:30,
   * or a bare number for whole minutes. */
  const [time, setTime] = useState("");
  const [day, setDay] = useState(logged && !fake ? logged.day : day0 && day0 <= today ? day0 : today);
  /* THE TITLE COMES FILLED IN (owner, 2026-11-23: "when I'm manually
   * logging a row, fill in the title as like November number X, and we can
   * leave the description blank"): the month and which row of it this will
   * be, "November #12", the title the site gives a row logged with none
   * (lib/row100k defaultRowTitle), so what is in the field is what the row
   * would have been called anyway, there to be typed over. It is numbered
   * off this month's rows, so a row dated into another month goes without
   * and the site numbers it there. */
  const { me } = useSession();
  const count = me.totals?.monthSessions;
  const auto = me.month && count !== undefined ? `${me.month.label.split(" ")[0]} #${count + 1}` : "";
  /* A row that is logged has the title the site gave it, which is the same
   * count made where the rows are. */
  const [title, setTitle] = useState(logged?.title ? logged.title : day.slice(0, 7) === today.slice(0, 7) ? auto : "");
  /* The title the form opened with: what "changed" is measured against. */
  const title0 = useRef(title).current;
  const pickDay = (d: string) => {
    if (logged?.title) return setDay(d);
    const was = day.slice(0, 7) === today.slice(0, 7);
    const is = d.slice(0, 7) === today.slice(0, 7);
    if (was && !is && title === auto) setTitle("");
    if (!was && is && title === "") setTitle(auto);
    setDay(d);
  };
  const [picking, setPicking] = useState(false);
  const [caption, setCaption] = useState("");
  const [photos, setPhotos] = useState<(Picked | null)[]>([null, null]);
  /* How far the row has got on its way in, while it is going (upload.ts
   * Progress); null when nothing is being sent. */
  const [busy, setBusy] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  const m = fixed ? fixed.meters : Math.round(Number(meters));
  const s = fixed ? fixed.seconds : (parseTime(time) ?? 0);
  const both = photos[0] !== null && photos[1] !== null;
  const none = photos[0] === null && photos[1] === null;
  /* A row typed in needs its two. A row that is logged, and a demo, take
   * two or none: one photo is neither. */
  const ok = m > 0 && s > 0 && (logged ? both || none : !!fake || both);
  /* What the form would change on a row that is logged. */
  const changed = !!logged && (both || title.trim() !== title0.trim() || !!caption.trim() || (!fake && day !== logged.day));
  const [sure, setSure] = useState(false);

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

  /* The pretend send: the steps a real one goes through, at about the pace
   * of a good signal, and then the page. */
  const pretend = async () => {
    const shownNow = photos.filter((p): p is Picked => p !== null).map((p) => ({ full: p.uri, thumb: null }));
    /* A demo that is "logged" already and has no photos to pretend to send. */
    if (logged && none) return onDone("demo", day, m, s, doc, { title, caption, seconds: s, photos: shownNow });
    const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    const steps: Progress[] = [
      { at: 0, to: 0.1, word: "Getting photo 1 ready" },
      { at: 0.1, to: 0.2, word: "Getting photo 2 ready" },
      { at: 0.2, to: 0.5, word: "Sending photo 1" },
      { at: 0.5, to: 0.8, word: "Sending photo 2" },
      { at: 0.8, to: 0.95, word: "Saving the row" },
      { at: 1, to: 1, word: "Logged" },
    ];
    for (const p of steps) {
      setBusy(p);
      await wait(p.at === 1 ? 350 : 500);
    }
    setBusy(null);
    const shown = photos.filter((p): p is Picked => p !== null).map((p) => ({ full: p.uri, thumb: null }));
    onDone("demo", day, m, s, doc, { title, caption, seconds: s, photos: shown });
  };

  const submit = async () => {
    if (fake) return pretend();
    if (logged) {
      /* Nothing to add: the row is as the site has it. */
      if (!changed) return onDone(logged.rowId, day, m, s, doc);
      setError("");
      setBusy({ at: 0, to: 0.02, word: both ? "Getting photo 1 ready" : "Saving" });
      try {
        await finishRow({ id: logged.rowId, day, meters: m, seconds: s, ...(title.trim() && title.trim() !== title0.trim() ? { title: title.trim() } : {}), caption, photos: photos[0] && photos[1] ? [photos[0], photos[1]] : undefined }, setBusy);
        setBusy(null);
        onDone(logged.rowId, day, m, s, doc);
      } catch (err) {
        setBusy(null);
        setError(err instanceof Error ? err.message : "That did not work.");
      }
      return;
    }
    if (!photos[0] || !photos[1]) return;
    setError("");
    setBusy({ at: 0, to: 0.02, word: "Getting photo 1 ready" });
    try {
      const r = await logRow({ day, meters: m, seconds: s, title, caption, photos: [photos[0], photos[1]], doc }, setBusy);
      setBusy(null);
      onDone(r.id, day, m, s, doc);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 124 }} keyboardShouldPersistTaps="handled">
      {fake && !logged ? <Text style={[mono(10, true, C.accent, 0.12), { lineHeight: 16, marginBottom: 12 }]}>Demo row · nothing is saved · photos optional</Text> : null}
      {fixed ? (
        <View>
          {logged ? <Eyebrow style={{ color: C.good }}>{fake ? "Logged · a demo, nothing was saved" : "Logged · it is on the board"}</Eyebrow> : <Eyebrow>The row</Eyebrow>}
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 12 }}>
            <Num size={56} color={C.accent}>
              {fmtInt(m)} m
            </Num>
            <Text style={{ fontFamily: F.sans, fontSize: 16, color: C.soft, fontVariant: ["tabular-nums"] }}>
              {fmtClock(s, false)} · {fmtPace(m > 0 ? (s / m) * 500 : 0)}
            </Text>
          </View>
          {logged ? <Text style={[styles.body, { fontSize: 14, marginTop: 4 }]}>Add the two photos now, or later from the row's own page.</Text> : null}
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

      {/* THE DATE, as a date, and a calendar behind it (owner, 2026-11-23:
          "the date it was rowed, instead of have it being today with this
          weird picker, we can just have it be like a normal date and then
          have a date picker for it"). It was a word, Today or Yesterday,
          between two arrows that stepped a day at a time. */}
      <Card>
        <Eyebrow style={{ color: C.ink }}>Date rowed</Eyebrow>
        <Pressable accessibilityRole="button" accessibilityLabel={`Date rowed: ${dateWord(day)}. Change it`} onPress={() => setPicking(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderBottomWidth: 1, borderColor: C.ink, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink, fontVariant: ["tabular-nums"] }}>{dateWord(day)}</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>{day === today ? "TODAY · CHANGE" : "CHANGE"}</Text>
        </Pressable>
      </Card>
      {picking ? <DaySheet day={day} today={today} onPick={pickDay} onClose={() => setPicking(false)} /> : null}

      {/* Title, Description: no "(optional)" after either (the same day:
          "We can also remove the optional section there. Like we can also
          just say title, description"). */}
      <Card>
        <Eyebrow style={{ color: C.ink }}>Title</Eyebrow>
        <TextInput style={{ borderBottomWidth: 1, borderColor: C.ink, fontSize: 18, fontFamily: F.bold, paddingVertical: 8, color: C.ink }} value={title} onChangeText={setTitle} maxLength={60} accessibilityLabel="Title" />
      </Card>

      {/* A CAPTION, shown under the photos (owner, 2026-11-22). */}
      <Card>
        <Eyebrow style={{ color: C.ink }}>Description</Eyebrow>
        <TextInput style={{ borderBottomWidth: 1, borderColor: C.ink, fontSize: 16, lineHeight: 22, fontFamily: F.sans, paddingVertical: 8, color: C.ink, minHeight: 44 }} value={caption} onChangeText={setCaption} multiline maxLength={500} accessibilityLabel="Description" />
      </Card>

      {error ? <Text style={[styles.body, { color: C.accent, marginBottom: 12 }]}>{error}</Text> : null}
      {/* While the row is going in, the button gives its place to the bar. */}
      {busy ? <Sending p={busy} fake={fake} /> : <Btn label={logged ? (both ? "Add the photos" : changed ? "Save" : "Done") : m > 0 ? `Log ${fmtInt(m)} m` : "Log"} onPress={submit} disabled={!ok} />}
      {!ok && !busy ? <Text style={[styles.body, { fontSize: 14, marginTop: 8 }]}>{m > 0 && s > 0 ? (logged ? "Two photos, or none: you, and the monitor." : "Both photos are needed: you, and the monitor.") : "Enter the meters and the time."}</Text> : null}
      <Btn label={back ?? (fixed ? "Back to the monitor" : "Cancel")} quiet onPress={onCancel} disabled={!!busy} style={{ marginTop: 10 }} />
      {/* WHAT DISCARD WAS: the row is logged, so throwing it away is
          deleting it, and that is asked twice. */}
      {logged && onGone && !busy ? (
        <Text
          accessibilityRole="button"
          accessibilityLabel={sure ? "Delete this row for good" : "Delete this row"}
          onPress={async () => {
            if (!sure) return setSure(true);
            if (fake) return onGone();
            setError("");
            try {
              await api(`/api/row100k/rows/${logged.rowId}`, { method: "DELETE" });
              onGone();
            } catch (err) {
              /* Gone already is gone. */
              if (err instanceof ApiError && err.status === 404) return onGone();
              setSure(false);
              setError(err instanceof Error ? err.message : "That did not delete. Try again.");
            }
          }}
          suppressHighlighting
          style={{ fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: sure ? C.accent : C.soft, textAlign: "center", paddingVertical: 18 }}
        >
          {sure ? "SURE? DELETE THIS ROW" : "DELETE THIS ROW"}
        </Text>
      ) : null}
    </ScrollView>
  );
}

/* THE BAR WHILE A ROW IS SENT (owner, 2026-11-23: "we need like a animation
 * for loading/sending or a % going up. Whenever we hit the submit row, we
 * need something to indicate like the progress bar or a % ... it's a little
 * unclear, like how long does it have left, or is it working"). A big
 * percentage, the step it is on beside it, and a bar filling under them.
 *
 * WHAT MOVES IT. The count comes from upload.ts (Progress): mostly the
 * bytes of the photos that have left the phone. This draws it so that it
 * is never standing still and never goes back: the fill runs up to what is
 * done for certain, then creeps on along the stretch the running step was
 * given, slower the nearer it gets to the end of it, until the next count
 * comes in. And a light band crosses the whole bar over and over, which is
 * the sign that it is working while a count is slow to come (a weak signal
 * in a gym). */
function Sending({ p, fake }: { p: Progress; fake?: boolean }) {
  const [shown, setShown] = useState(0);
  const now = useRef(p);
  now.current = p;
  useEffect(() => {
    const id = setInterval(() => {
      setShown((v) => {
        const { at, to } = now.current;
        if (at > v) return Math.min(1, v + Math.max(0.004, (at - v) * 0.35));
        if (to > v) return v + (to - v) * 0.03;
        return v;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);
  const [w, setW] = useState(0);
  const band = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(band, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== "web" }));
    loop.start();
    return () => loop.stop();
  }, [band]);
  const pct = Math.min(100, Math.floor(shown * 100));
  const BAND = 90;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${p.word}, ${pct} percent`} accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ minHeight: 86 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <Text style={{ fontFamily: F.black, fontSize: 40, lineHeight: 44, color: C.ink, fontVariant: ["tabular-nums"] }}>{pct}%</Text>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.monoBold, fontSize: 11, letterSpacing: 2, color: C.accent }}>
          {p.word.toUpperCase()}
        </Text>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 16, borderWidth: 2, borderColor: C.ink, overflow: "hidden", backgroundColor: C.paper }}>
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, shown * 100)}%`, backgroundColor: C.accent }} />
        {w > 0 ? <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: BAND, backgroundColor: C.paper, opacity: 0.38, transform: [{ translateX: band.interpolate({ inputRange: [0, 1], outputRange: [-BAND, w] }) }] }} /> : null}
      </View>
      <Text style={[styles.body, { fontSize: 13, marginTop: 8 }]}>{fake ? "A demo: nothing is being sent." : "Keep the app open until this is done."}</Text>
    </View>
  );
}

/* "Nov 23, 2026", off a day written 2026-11-23. */
function dateWord(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/* THE CALENDAR BEHIND THE DATE: a sheet up from the foot with one month on
 * it, a week to a line, the arrows at its head going a month back or on.
 * A press on a day takes it and puts the sheet away. No day after today
 * can be taken, and no month after this one is shown; how far back a row
 * may be dated is the site's to say, as it was with the arrows. Made here
 * and not with the phone's own date wheel: that is a piece of the phone the
 * app would have to be built again to carry. */
function DaySheet({ day, today, onPick, onClose }: { day: string; today: string; onPick: (d: string) => void; onClose: () => void }) {
  const [ym, setYm] = useState(day.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const step = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const cells: (number | null)[] = [...Array.from({ length: firstDow }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const atEnd = ym >= today.slice(0, 7);
  const arrow = (label: string, glyph: string, by: number, off: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={() => step(by)} hitSlop={8} style={{ width: 52, height: 48, alignItems: "center", justifyContent: "center", opacity: off ? 0.2 : 1 }}>
      <Text style={{ fontFamily: F.black, fontSize: 22, color: C.ink }}>{glyph}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close the calendar" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
      <View style={{ backgroundColor: C.paper, borderTopWidth: 2, borderColor: C.ink, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 34 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {arrow("The month before", "←", -1, false)}
          <Text style={{ fontFamily: F.black, fontSize: 20, color: C.ink }}>
            {MONTHS[m - 1]} {y}
          </Text>
          {arrow("The month after", "→", 1, atEnd)}
        </View>
        <View style={{ flexDirection: "row" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Text key={i} style={{ flex: 1, textAlign: "center", fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.gray, paddingVertical: 6 }}>
              {d}
            </Text>
          ))}
        </View>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map((n, i) => {
              if (n === null) return <View key={i} style={{ flex: 1, height: 46 }} />;
              const d = `${ym}-${String(n).padStart(2, "0")}`;
              const off = d > today;
              const on = d === day;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${dateWord(d)}${d === today ? ", today" : ""}`}
                  accessibilityState={{ selected: on, disabled: off }}
                  disabled={off}
                  onPress={() => {
                    onPick(d);
                    onClose();
                  }}
                  style={{ flex: 1, height: 46, alignItems: "center", justifyContent: "center" }}
                >
                  <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: on ? C.ink : "transparent", borderWidth: d === today && !on ? 1 : 0, borderColor: C.ink }}>
                    <Text style={{ fontFamily: on ? F.black : F.bold, fontSize: 17, color: on ? C.paper : C.ink, opacity: off ? 0.22 : 1, fontVariant: ["tabular-nums"] }}>{n}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Btn label="Cancel" quiet onPress={onClose} style={{ flex: 1 }} />
          <Btn
            label="Today"
            onPress={() => {
              onPick(today);
              onClose();
            }}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
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
