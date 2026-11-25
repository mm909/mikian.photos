import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useWallClock } from "../arcade/BoatArt";
import { ChestOpen } from "../arcade/Chest";
import type { Game } from "../arcade/games";
import { grant } from "../arcade/locker";
import { prng } from "../arcade/rng";
import { takeBox, useRun } from "../arcade/run";
import { levelOf } from "../arcade/score";
import { rollBox, type Chest } from "../arcade/skins";
import { C, F, fmtInt } from "../theme";
import { Btn, Eyebrow, Num } from "../ui";

/* AFTER THE ROW, IN THE HAND (owner, 2026-11-24: the cards after a row ran
 * "while I'm still gasping"; "pace them for a phone in the hand": the
 * finish screen on the rower, then, picked up and logged, "performance
 * first, then progress, then loot boxes. Overwatch order"). Laid over a row
 * just logged that had a run of the arcade on it (RowPage), upright, a tap
 * a step:
 *
 *   PERFORMANCE   the time first and biggest, the meters and the pace; what
 *                 the run did: damage, monsters down, bosses, the floor.
 *   PROGRESS      the level's bar filling with the row's XP (banked now, not
 *                 mid-row), and the all-time meters toward the next mark:
 *                 "640K with the next mark at 650K: close and reachable".
 *                 A step is three of this row, rounded to 5K (10K past 10K).
 *   BOXES         one for every monster down, a rarer one for every boss,
 *                 opened one at a time, slowly, the boss boxes last.
 *
 * Owner only, as the arcade is. The boxes come off the phone's store
 * (run.ts); an item is the rower's the moment its box is opened. */

type Step = "perf" | "progress" | "boxes";

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (x: number) => 1 - (1 - clamp(x)) ** 3;
/* "640K" for the marks. */
const kWord = (m: number) => (m >= 1_000_000 ? `${(m / 1_000_000).toFixed(m % 1_000_000 ? 2 : 0)}M` : `${Math.round(m / 1000)}K`);

export function stepOf(meters: number): number {
  const three = Math.max(5000, meters * 3);
  const unit = three >= 10_000 ? 10_000 : 5000;
  return Math.max(unit, Math.round(three / unit) * unit);
}

export function AfterRow({ g, meters, time, pace, lifeBefore, onClose }: { g: Game; meters: number; time: string; pace: string; lifeBefore: number; onClose: () => void }) {
  const [step, setStep] = useState<Step>("perf");
  const [since, setSince] = useState(0);
  const wall = useWallClock(true);
  const { width, height } = useWindowDimensions();
  useEffect(() => setSince(Date.now() / 1000), [step]);
  const e = since ? wall - since : 0;
  const next = () => setStep((s) => (s === "perf" ? "progress" : s === "progress" ? "boxes" : s));
  const fade = (i: number) => ({ opacity: clamp((e - 0.15 - i * 0.18) / 0.35), transform: [{ translateY: (1 - ease((e - 0.15 - i * 0.18) / 0.35)) * 18 }] });

  let body: ReactNode = null;
  if (step === "perf") {
    const lines: [string, string][] = [
      ["Damage done", fmtInt(g.dealt ?? 0)],
      ["Monsters down", `${g.kills}`],
      ["Bosses", `${g.bosses ?? 0}`],
      [g.lost ? "Run lost on" : "Floor", g.lost ? `FLOOR ${g.floor ?? 1}` : `${g.floor ?? 1}`],
      ...(g.stars ? ([["Runs finished", `★ ${g.stars}`]] as [string, string][]) : []),
    ];
    body = (
      <>
        <View style={fade(0)}>
          <Eyebrow>Time</Eyebrow>
          <Num size={Math.min(84, width / 4.6)}>{time}</Num>
        </View>
        <View style={[{ flexDirection: "row", columnGap: 28, marginTop: 6 }, fade(1)]}>
          <View>
            <Eyebrow>Meters</Eyebrow>
            <Num size={34}>{fmtInt(meters)}</Num>
          </View>
          <View>
            <Eyebrow>Pace</Eyebrow>
            <Num size={34}>{pace}</Num>
          </View>
        </View>
        <View style={[{ marginTop: 26, borderTopWidth: 2, borderColor: C.ink, paddingTop: 10 }, fade(2)]}>
          <Eyebrow style={{ color: C.ink }}>The arcade</Eyebrow>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
            {lines.map(([k, v]) => (
              <View key={k} style={{ width: "50%", paddingVertical: 6 }}>
                <Eyebrow>{k}</Eyebrow>
                <Num size={28} color={k.startsWith("Run lost") ? "#D9381E" : C.ink}>{v}</Num>
              </View>
            ))}
          </View>
        </View>
      </>
    );
  } else if (step === "progress") {
    const k = ease((e - 0.5) / 2.4);
    const was = levelOf(g.xpBefore);
    const lv = levelOf(g.xpBefore + g.xp * k);
    const st = stepOf(meters);
    const life = lifeBefore + meters * ease((e - 1.2) / 2.4);
    const from = Math.floor(lifeBefore / st) * st;
    const mark = from + st;
    const passed = life >= mark;
    const lo = passed ? mark : from;
    const hi = passed ? mark + st : mark;
    body = (
      <>
        <View style={fade(0)}>
          <Eyebrow style={{ color: C.ink }}>{lv.level > was.level ? "Level up" : "Level"}</Eyebrow>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Num size={64} color={lv.level > was.level ? C.accent : C.ink}>{`${lv.level}`}</Num>
            <Num size={30} color={C.accent}>{`+${fmtInt(g.xp * k)} XP`}</Num>
          </View>
          <View style={{ height: 18, borderWidth: 2.5, borderColor: C.ink, borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
            <View style={{ width: `${Math.round((100 * lv.into) / lv.need)}%`, height: "100%", backgroundColor: C.accent }} />
          </View>
        </View>
        <View style={[{ marginTop: 34 }, fade(2)]}>
          <Eyebrow style={{ color: C.ink }}>All-time meters</Eyebrow>
          <Num size={44}>{fmtInt(life)}</Num>
          <View style={{ height: 18, borderWidth: 2.5, borderColor: C.ink, borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
            <View style={{ width: `${(100 * clamp((life - lo) / (hi - lo))).toFixed(1)}%`, height: "100%", backgroundColor: C.ink }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ fontFamily: F.black, fontSize: 16, color: C.soft }}>{kWord(lo)}</Text>
            <Text style={{ fontFamily: F.black, fontSize: 16, color: passed ? C.good : C.ink }}>{passed ? `${kWord(mark)} PASSED · NEXT ${kWord(hi)}` : `NEXT ${kWord(hi)}`}</Text>
          </View>
        </View>
      </>
    );
  } else body = <Boxes width={width - 40} height={Math.max(280, height - 400)} wall={wall} />;

  return (
    <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.paper, paddingHorizontal: 20, paddingTop: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <View style={{ flexDirection: "row", columnGap: 6 }}>
          {(["perf", "progress", "boxes"] as Step[]).map((s) => (
            <View key={s} style={{ width: s === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: s === step ? C.ink : C.line }} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 2, color: C.soft }}>SKIP</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>{body}</View>
      <View style={{ paddingBottom: 110 }}>{step === "boxes" ? <Btn label="Done" quiet onPress={onClose} /> : <Btn label="Next" onPress={next} />}</View>
    </View>
  );
}

/* THE BOXES, one at a time: the plain ones, then the boss boxes. */
function Boxes({ width, height, wall }: { width: number; height: number; wall: number }) {
  const run = useRun();
  const [open, setOpen] = useState<{ chest: Chest; kind: "box" | "boss"; at: number } | null>(null);
  const n = useRef(0);
  const left = run.boxes.box + run.boxes.boss;
  const kind: "box" | "boss" = run.boxes.box > 0 ? "box" : "boss";
  const openOne = async () => {
    if (!left) return;
    const k = kind;
    const chest = rollBox(prng(Math.floor(Date.now() % 1e9) + n.current++ * 7919), k);
    await takeBox(k);
    grant(chest.items, true).catch(() => null);
    setOpen({ chest, kind: k, at: Date.now() / 1000 });
  };
  const SLOW = 1.6;
  const done = open ? wall - open.at > 7.6 * SLOW : true;
  return (
    <View style={{ flex: 1 }}>
      {open ? (
        <ChestOpen chest={open.chest} at={open.at} t={wall} width={width} height={height} won box={open.kind} slow={SLOW} head={open.kind === "boss" ? "BOSS" : open.chest.triple ? "THREE" : " "} note={`${left} LEFT`} />
      ) : (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Num size={72}>{`${left}`}</Num>
          <Text style={{ fontFamily: F.black, fontSize: 20, color: C.ink }}>{left === 1 ? "BOX TO OPEN" : "BOXES TO OPEN"}</Text>
          <Text style={{ fontFamily: F.monoBold, fontSize: 12, letterSpacing: 1.4, color: C.soft, marginTop: 6 }}>{`${run.boxes.box} FROM MONSTERS · ${run.boxes.boss} FROM BOSSES`}</Text>
        </View>
      )}
      {left > 0 && done ? <Btn style={{ marginBottom: 10 }} label={open ? (kind === "boss" ? "Open a boss box" : "Open the next") : kind === "boss" ? "Open a boss box" : "Open one"} onPress={openOne} /> : null}
    </View>
  );
}
