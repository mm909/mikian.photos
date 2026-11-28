import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { buzz } from "../buzz";
import { clubDo, clubRowing, readClub, useClub } from "../club";
import { C, F, fmtInt } from "../theme";
import { Btn, Eyebrow, Picks } from "../ui";

/* ROW CLUB'S LOBBY (owner, 2026-11-28: "I should have an option to make a
 * row club lobby and then be able to start row club ... whenever I click
 * start row club, it'll give a 10-second timer or something, and then the
 * row starts ... a bunch of other people have it open on their phone,
 * connected, and have started rowing"). The first cut (club.ts).
 *
 * The host (an admin) opens a lobby at a distance; anybody signed in joins
 * it; each sets the monitor to that distance and connects it; the host
 * presses START ROW CLUB and every phone in it counts down ten seconds
 * (ClubCountdown, over the whole app, the monitor included). Then the race
 * page's lanes carry the club's rowers, LIVE, where they are this second.
 * PRETEND ROWERS, the host's switch, row even splits beside him so it can
 * be seen working alone. */

const DISTANCES = [
  { key: "1000", label: "1K" },
  { key: "2000", label: "2K" },
  { key: "5000", label: "5K" },
  { key: "10000", label: "10K" },
] as const;

/* The seconds from the start on this phone's clock: under nothing while
 * counting down. A few times a second while it matters. */
function useSince(startAt: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (startAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [startAt]);
  return startAt === null ? null : (now - startAt) / 1000;
}

const clock = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

export function RowClubScreen({ onRow }: { onRow: () => void }) {
  const c = useClub();
  const l = c.lobby;
  const [meters, setMeters] = useState<(typeof DISTANCES)[number]["key"]>("2000");
  const [pretend, setPretend] = useState(false);
  const [busy, setBusy] = useState(false);
  const since = useSince(c.startAt);
  useEffect(() => {
    readClub();
  }, []);
  const go = async (action: Parameters<typeof clubDo>[0], extra?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    buzz.tap();
    await clubDo(action, extra);
    setBusy(false);
  };

  const big = { fontFamily: F.black, color: C.ink } as const;
  const mono = { fontFamily: F.monoBold, letterSpacing: 1.4, color: C.gray } as const;

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Eyebrow>Row Club</Eyebrow>
        <Text style={[big, { fontSize: 34, lineHeight: 38 }]}>{l ? l.title : "ROW CLUB"}</Text>
        {l ? <Text style={[mono, { fontSize: 13 }]}>{fmtInt(l.meters)} M · {l.members.length} {l.members.length === 1 ? "ROWER" : "ROWERS"}{l.pretend ? " · PRETEND ROWERS ON" : ""}</Text> : null}
      </View>

      {c.error ? <Text style={{ fontFamily: F.bold, color: C.accent }}>{c.error}</Text> : null}

      {!l ? (
        c.canHost ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.ink }}>Open a lobby. Everyone in it sets their monitor to the distance, and you start the row for all of them at once.</Text>
            <Picks options={DISTANCES.map((d) => ({ key: d.key, label: d.label }))} value={meters} onPick={setMeters} />
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: pretend }} onPress={() => setPretend((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: C.ink, backgroundColor: pretend ? C.ink : "transparent" }} />
              <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>Pretend rowers (three even-split boats, to see it alone)</Text>
            </Pressable>
            <Btn label={busy ? "OPENING…" : "OPEN A LOBBY"} disabled={busy} onPress={() => go("open", { meters: Number(meters), pretend })} />
          </View>
        ) : (
          <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.gray }}>{c.read ? "No Row Club right now. When one opens, the plus at the top lights up." : "Looking…"}</Text>
        )
      ) : (
        <View style={{ gap: 14 }}>
          {since === null ? (
            <Text style={{ fontFamily: F.sans, fontSize: 15, color: C.ink }}>
              Set your PM5 to <Text style={{ fontFamily: F.bold }}>{fmtInt(l.meters)} m</Text>, connect it, and sit ready. {c.canHost ? "When everyone is in, press START." : "The host starts it for everyone, with a ten second count."}
            </Text>
          ) : since < 0 ? (
            <Text style={[big, { fontSize: 22, color: C.accent }]}>STARTING IN {Math.ceil(-since)}</Text>
          ) : (
            <Text style={[big, { fontSize: 22, color: C.good }]}>LIVE · {clock(since)}</Text>
          )}

          {!l.joined ? <Btn label={busy ? "JOINING…" : "JOIN ROW CLUB"} disabled={busy} onPress={() => go("join")} /> : null}
          {l.joined ? <Btn label={since !== null && since >= 0 ? "GO TO YOUR ROW" : "CONNECT YOUR PM5"} quiet={since === null} onPress={onRow} /> : null}

          {c.canHost && since === null ? <Btn label={busy ? "STARTING…" : "START ROW CLUB"} disabled={busy} onPress={() => go("start")} /> : null}

          <View style={{ gap: 6 }}>
            <Eyebrow>In the lobby</Eyebrow>
            {l.members.map((m, i) => (
              <View key={`${m.numStr}${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={[mono, { fontSize: 12, width: 44 }]}>{m.numStr ? `#${m.numStr}` : ""}</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink, flex: 1 }}>{m.name.toUpperCase()}{m.me ? "  (YOU)" : ""}</Text>
              </View>
            ))}
            {l.pretend ? <Text style={[mono, { fontSize: 11 }]}>+ 3 PRETEND ROWERS (1:52, 1:58, 2:05 /500 M)</Text> : null}
          </View>

          {c.canHost ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Btn quiet label={l.pretend ? "TURN PRETEND ROWERS OFF" : "TURN PRETEND ROWERS ON"} disabled={busy} onPress={() => go("pretend", { on: !l.pretend })} />
              <Btn quiet label="END ROW CLUB" disabled={busy} onPress={() => go("end")} />
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

/* THE COUNT, OVER EVERYTHING (the spec: "it'll give a 10-second timer or
 * something, and then the row starts"), on every phone in the club,
 * whatever it is showing: the last ten seconds, ROW at the start, gone a
 * second and a half after. A knock each second, a longer one at ROW. */
export function ClubCountdown() {
  const c = useClub();
  const on = clubRowing(c);
  const since = useSince(on ? c.startAt : null);
  const left = since === null ? null : -since;
  const shown = left !== null && left <= c.countdown + 0.5 && left > -1.5;
  const n = left === null ? 0 : Math.ceil(left);
  useEffect(() => {
    if (!shown) return;
    if (n > 0) buzz.tick();
    else if (n === 0) buzz.done();
  }, [shown, n]);
  if (!shown) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }}>
      <Text style={{ fontFamily: F.monoBold, fontSize: 14, letterSpacing: 2, color: "#FFFFFF" }}>ROW CLUB · {fmtInt(c.lobby?.meters ?? 0)} M</Text>
      <Text style={{ fontFamily: F.black, fontSize: n > 0 ? 160 : 120, lineHeight: n > 0 ? 180 : 140, color: n > 0 ? "#FFFFFF" : C.good }}>{n > 0 ? n : "ROW"}</Text>
    </View>
  );
}
