import { useEffect, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, type Best, type Blocked, type Counts, type LogRow, type Profile, type Rel } from "../api";
import { Density, MonthGrid, PaceLine } from "../charts";
import { BellIcon } from "../icons";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Eye, Ledger, WordMenu, mono } from "../site";
import { C, F, fmtClock, fmtInt } from "../theme";
import { Blocks, Waiting, useLoad } from "../ui";
import { Join, SignIn } from "./Account";
import { FollowButton, RowerMenu, type PeopleList } from "./Social";

/* A ROWER'S PROFILE, the site's /r/[num] on a phone (looks/Profile.tsx and
 * its pieces), in the site's order:
 *
 *   the nameplate: 095 MIKIAN MUSSER, the number grey, on a hairline;
 *   the month word (a menu: every month and all time);
 *   the metres of that month as the big blue odometer, seven wheels, the
 *     leading zeros faint, and "METERS · 6.7 H ON THE ERG" under it;
 *   LOG A ROW, on the rower's own page;
 *   the identity line, and the ledger: time rowed, sessions, average split;
 *   then THE BESTS, THE MONTH, THE PACE, THE FIELD, THE ERG and THE LOG,
 *     each under its eyebrow.
 *
 * UNDER THE NAMEPLATE, ONE LINE THE SITE DOES NOT HAVE (pass 3,
 * 2026-11-21): how many follow the rower and how many they follow, each a
 * way into its list, and at its right, on somebody else's page, the bell
 * and FOLLOW. What else can be done about a rower (block, report) is behind
 * the three dots in the app's top bar; the viewer's own settings are behind
 * the three lines there. A PRIVATE account seen by somebody it has not
 * accepted keeps its totals and shows no rows (owner, 2026-11-20); across
 * a block there is no page at all.
 *
 * TAKEN OFF, on the owner's read of the first version (2026-11-21, "we
 * really just reference the website"): the all-time line with its lifetime
 * tag and the metres to the next one ("it doesn't make sense, at least how
 * it's presented here"), the PRIVATE label, the underlines on the two
 * counts. The name is ONE line, shrunk to fit and cut short only if it
 * still will not ("the name can't be on 2 lines").
 *
 * Everything is the view the site computes (api/row100k/app/profile), so a
 * hidden rower is hidden here by the same rule and gets the same dog tag. */

const m2 = (s: number) => fmtClock(s, false);
const hours = (s: number) => `${(s / 3600).toFixed(1)} h`;

export function ProfileScreen({
  num,
  onLog,
  onRow,
  onPeople,
  menu,
  onMenu,
  onGone,
}: {
  num?: number;
  onLog?: () => void;
  onRow?: (id: string) => void;
  onPeople?: (list: PeopleList, num?: number) => void;
  /* The three dots in the top bar, pressed (App.tsx holds it). */
  menu?: boolean;
  onMenu?: (open: boolean) => void;
  /* The rower was deleted from here: leave the page. */
  onGone?: () => void;
}) {
  const { ready, me } = useSession();
  const own = num === undefined;
  const [period, setPeriod] = useState<string>("");
  const mine = me.me?.rowerNumber;
  const { data, error, loading, reload } = useLoad(
    () => (own && !mine ? Promise.resolve(null) : api<{ profile?: Profile; blocked?: Blocked }>(`/api/row100k/app/profile?${own ? "" : `num=${num}&`}${period ? `m=${period}` : ""}`)),
    [num, period, mine],
  );
  /* How the two stand after a press here, until the page is read again. */
  const [live, setLive] = useState<{ rel: Rel; counts: Counts } | null>(null);
  useEffect(() => setLive(null), [data]);

  if (own && ready && !me.signedIn) return <SignIn why="Your profile, your rows and logging a row need your account. The feed, the board and the stats are open to everyone." />;
  if (own && ready && me.signedIn && !me.me) return <Join />;
  if (!data) return <Waiting error={error} onRetry={reload} />;
  if (data.blocked) return <BlockedPage b={data.blocked} onChange={reload} />;
  if (!data.profile) return <Waiting error="That profile could not be read." onRetry={reload} />;
  const p = data.profile;
  const t = p.totals;
  const rel = live?.rel ?? p.rel;
  const counts = live?.counts ?? p.counts;
  const locked = !!p.rel.locked;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 56 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <Nameplate num={p.rower.rowerNumber} name={p.rower.displayName} />

      <SocialLine
        p={p}
        rel={rel}
        counts={counts}
        onPeople={onPeople}
        onChange={(r) => {
          setLive(r);
          /* A follow that opened a private page: read it again. */
          if (r.rel.following !== p.rel.following) reload();
        }}
      />
      {menu && onMenu && !p.isMe ? <RowerMenu num={p.rower.rowerNumber} name={p.rower.displayName} adminId={p.adminId} onClose={() => onMenu(false)} onBlocked={reload} onGone={() => onGone?.()} /> : null}

      {p.masked ? (
        <DogTag p={p} />
      ) : (
        <>
          <View style={{ marginTop: 22 }}>
            <WordMenu options={p.periodOptions} value={p.period.key} onPick={setPeriod} ariaLabel="Which month" />
          </View>
          <Odometer meters={t?.meters ?? 0} />
          <Text style={[mono(12, false, C.gray), { marginTop: 8 }]}>
            Meters · <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{hours(t?.seconds ?? 0)} on the erg</Text>
          </Text>

          {p.isMe && onLog ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Log a row" onPress={onLog} style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 26, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontFamily: F.black, fontSize: 34, lineHeight: 38, color: C.ink }}>
                <Text style={{ textDecorationLine: "underline", textDecorationColor: C.accent }}>LOG A ROW</Text>→
              </Text>
            </Pressable>
          ) : null}

          <Text style={[mono(12, false, C.ink), { marginTop: 22, lineHeight: 20 }]}>
            Rower {String(p.rower.rowerNumber).padStart(3, "0")} · {p.rower.displayName}
            {p.rower.instagram ? <Text style={{ color: C.accent }}> · @{p.rower.instagram}</Text> : null}
            {p.elite ? ` · ${p.blackoutNote}` : p.rank ? ` · ${p.rank.place} of ${p.rank.of}${p.rower.division === "F" ? " women" : p.rower.division === "M" ? " men" : ""}` : ""}
            {p.club ? " · 100K club" : ""}
          </Text>

          <View style={{ marginTop: 22 }}>
            <Ledger
              cells={[
                [hours(t?.seconds ?? 0), "Time rowed"],
                [fmtInt(t?.sessions ?? 0), "Sessions"],
                [t && t.meters > 0 && t.seconds > 0 ? fmtClock((t.seconds / t.meters) * 500) : "-:--.-", "Average split"],
              ]}
            />
          </View>

          {p.bests.length ? (
            <>
              <Eye left="The bests" right={p.period.label} />
              {p.bests.map((b) => (
                <BestRow key={b.key} b={b} />
              ))}
            </>
          ) : null}

          {locked ? (
            <View style={{ borderWidth: 2, borderColor: C.ink, padding: 18, marginTop: 30 }}>
              <Text style={mono(12, true)}>Private account</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>
                {rel.following === "pending" ? "Your request is waiting. The rows open when it is accepted." : "The rows and photos are shown to followers this rower has accepted."}
              </Text>
            </View>
          ) : null}

          {p.month && !locked ? (
            <>
              <Eye left="The month" right="Meters per day" />
              <MonthGrid month={p.month} byDay={p.byDay} today={p.period.key === p.thisMonthKey ? p.days : undefined} marks={marksOf(p.byDay)} />
            </>
          ) : null}

          {p.paceCurve.length >= 2 ? (
            <>
              <Eye left="The pace" right="Split, by meters rowed" />
              <PaceLine curve={p.paceCurve} dots={p.paceDots} fmt={(s) => fmtClock(s)} />
            </>
          ) : null}

          {p.field ? (
            <>
              <Eye left="The field" right={`${fmtInt(p.field.field.sessions)} rows · ${p.field.field.rowers} rowers`} />
              <Standing k="Average row" v={fmtInt(p.field.you.avgLen)} u="m" line={`Longer than ${p.field.you.lenPct}% of rowers`} first />
              <Standing k="Average pace" v={m2(p.field.you.avgPace)} u="/500m" line={`Faster than ${p.field.you.pacePct}% of rowers`} />
              <ChartHead>Length of every row</ChartHead>
              <Density kde={p.field.field.lengthKde} you={p.field.you.lengthYou} fmt={(x) => (x >= 1000 ? `${x / 1000}K` : `${x}`)} />
              <ChartHead>Split of every row</ChartHead>
              <Density kde={p.field.field.paceKde} you={p.field.you.paceYou} fmt={m2} />
              {p.field.distances.map((d) => (
                <View key={d.meters}>
                  <ChartHead>
                    The {d.label} · {d.youN} of {d.fieldN} timed rows
                  </ChartHead>
                  <Density kde={d.field} you={d.you} fmt={m2} />
                </View>
              ))}
            </>
          ) : null}

          {p.ergRows.length ? (
            <>
              <Eye left="The erg" right={`${p.ergRows.length} ${p.ergRows.length === 1 ? "piece" : "pieces"}`} />
              {p.ergRows.map((r) => (
                <View key={r.id} style={{ backgroundColor: C.tint }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 6, paddingVertical: 11 }}>
                    <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>
                      {r.when}
                      {r.simulated ? " · demo" : ""}
                    </Text>
                    <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
                      <Text style={{ fontFamily: F.monoBold }}>{r.meters}</Text> {r.time} {r.split}
                    </Text>
                  </View>
                  <Dash />
                </View>
              ))}
            </>
          ) : null}
        </>
      )}

      {locked ? null : <Log p={p} onRow={onRow} />}
    </ScrollView>
  );
}

/* THE NAMEPLATE, as the site's: the number grey, the name ink, capitals,
 * on a hairline. ONE line: the type comes down from 30 until the name fits
 * the width, and a name too long even at the floor is cut with an ellipsis.
 * (The width of a line of Archivo Black capitals is reckoned, letter by
 * letter, because a phone in a browser cannot shrink type to fit by itself.) */
function Nameplate({ num, name }: { num: number; name: string }) {
  const [w, setW] = useState(0);
  const n3 = String(num).padStart(3, "0");
  const em = `${n3} ${name}`
    .toUpperCase()
    .split("")
    .reduce((sum, ch) => sum + (ch === " " ? 0.3 : /[IJ1.,'-]/.test(ch) ? 0.44 : /[MW]/.test(ch) ? 0.98 : 0.76), 0);
  const size = w ? Math.max(16, Math.min(30, Math.floor(w / em))) : 30;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ borderBottomWidth: 1, borderColor: C.ink, paddingBottom: 6 }}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.14), color: C.ink, textTransform: "uppercase" }}>
        <Text style={{ color: C.gray }}>{n3} </Text>
        {name}
      </Text>
    </View>
  );
}

/* FOLLOWERS AND FOLLOWING, each a way into its list; and, on somebody
 * else's page, the bell (told when this rower passes me, or not) and FOLLOW
 * at the right of the same line. */
function SocialLine({ p, rel, counts, onPeople, onChange }: { p: Profile; rel: Rel; counts: Counts; onPeople?: (list: PeopleList, num?: number) => void; onChange: (r: { rel: Rel; counts: Counts }) => void }) {
  const { me } = useSession();
  const [busy, setBusy] = useState(false);
  const n = p.rower.rowerNumber;
  const count = (v: number, one: string, many: string, list: PeopleList) => (
    <Pressable accessibilityRole="link" accessibilityLabel={`${v} ${v === 1 ? one : many}`} onPress={() => onPeople?.(list, n)} disabled={!onPeople} hitSlop={8}>
      <Text style={mono(11, false, C.gray)}>
        <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(v)}</Text> {v === 1 ? one : many}
      </Text>
    </Pressable>
  );
  const bell = async () => {
    setBusy(true);
    try {
      onChange(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num: n, action: "bell", on: !rel.bell } }));
    } catch {
      /* The bell stays as it was. */
    }
    setBusy(false);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 16, minHeight: 36, marginTop: 10 }}>
      {count(counts.followers, "follower", "followers", "followers")}
      {count(counts.following, "following", "following", "following")}
      <View style={{ flex: 1 }} />
      {!p.isMe && me.me ? (
        <>
          {rel.following === "accepted" ? (
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: rel.bell }} accessibilityLabel={rel.bell ? "Notifications from this rower are on" : "Notifications from this rower are off"} disabled={busy} onPress={bell} hitSlop={8} style={({ pressed }) => ({ opacity: pressed || busy ? 0.5 : 1 })}>
              <BellIcon on={rel.bell} color={C.gray} size={24} />
            </Pressable>
          ) : null}
          <FollowButton num={n} state={rel.following} onChange={onChange} />
        </>
      ) : null}
    </View>
  );
}

/* ACROSS A BLOCK there is no page: the name, and the way back if the block
 * is the viewer's own. */
function BlockedPage({ b, onChange }: { b: Blocked; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const unblock = async () => {
    setBusy(true);
    try {
      await api("/api/row100k/app/block", { body: { num: b.rowerNumber, on: false } });
    } catch {
      /* Read again either way. */
    }
    setBusy(false);
    onChange();
  };
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
      <Nameplate num={b.rowerNumber} name={b.displayName} />
      <Text style={[mono(12, true), { marginTop: 22 }]}>{b.byMe ? "You blocked this rower" : "This page is not available"}</Text>
      {b.byMe ? (
        <>
          <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>Neither of you sees the other's rows or page. Unblocking does not bring back a follow.</Text>
          <View style={{ marginTop: 18 }}>
            <Ctl label={busy ? "Unblocking" : "Unblock"} disabled={busy} onPress={unblock} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function marksOf(byDay: Record<string, number>): [number, number, number] {
  const max = Math.max(1, ...Object.values(byDay));
  return [max * 0.25, max * 0.5, max * 0.75];
}

/* THE ODOMETER: the metres on wheels, big and blue, with ONE faint zero in
 * front (owner, 2026-11-21: "only show 7 digits if there's 6 digits worth
 * of meters rowed ... 83,000, we just show the 083,000. But if it was
 * 100,000, then we could add that extra 0 up front"). Six wheels up to
 * 99,999; seven from 100,000; and from a million on, as many as it takes. */
function Odometer({ meters }: { meters: number }) {
  const [w, setW] = useState(0);
  const n = String(Math.max(0, Math.round(meters)));
  const wheels = n.length >= 7 ? n.length : n.length === 6 ? 7 : 6;
  const lead = wheels - n.length;
  const printed = n.padStart(wheels, "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  /* How many characters of the printed string are leading zeros, with the
   * comma that follows them when a group is all zeros. */
  let faint = 0;
  for (let seen = 0; faint < printed.length && (seen < lead || (printed[faint] === "," && seen === lead && lead > 0 && n !== "0")); faint++) if (printed[faint] !== ",") seen++;
  const commas = printed.length - wheels;
  /* An Archivo Black figure runs about two thirds of an em, a comma a third. */
  const size = w ? Math.min(76, Math.floor(w / (wheels * 0.68 + commas * 0.34))) : 60;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`${fmtInt(meters)} metres`} style={{ marginTop: 10 }}>
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.04), letterSpacing: -1, color: C.accent, fontVariant: ["tabular-nums"] }}>
        <Text style={{ opacity: 0.28 }}>{printed.slice(0, faint)}</Text>
        {printed.slice(faint)}
      </Text>
    </View>
  );
}

/* Where the rower stands in the field on one measure. */
function Standing({ k, v, u, line, first }: { k: string; v: string; u: string; line: string; first?: boolean }) {
  return (
    <View style={{ borderTopWidth: first ? 2 : 1, borderBottomWidth: first ? 0 : 2, borderColor: C.ink, paddingVertical: 14 }}>
      <Text style={mono(11, false, C.gray)}>{k}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 6 }}>
        <Text style={{ fontFamily: F.black, fontSize: 28, color: C.accent, fontVariant: ["tabular-nums"] }}>{v}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.accent }}>{u}</Text>
      </View>
      <Text style={[mono(11, false, C.accent, 0.12), { marginTop: 6 }]}>{line}</Text>
    </View>
  );
}

function ChartHead({ children }: { children: ReactNode }) {
  return (
    <View style={{ marginTop: 26, marginBottom: 10 }}>
      <Dash />
      <Text style={[mono(11, false, C.gray), { marginTop: 12 }]}>{children}</Text>
    </View>
  );
}

/* One best: the name and its place, the day under it, the figure right. */
function BestRow({ b }: { b: Best }) {
  return (
    <View style={{ backgroundColor: C.tint }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{b.label}</Text>
            {b.place ? <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.soft, borderWidth: 1, borderColor: C.gray, paddingHorizontal: 5 }}>#{b.place}</Text> : null}
          </View>
          {b.sub ? <Text style={[mono(11, false, C.gray, 0.1), { marginTop: 4 }]}>{b.sub}</Text> : null}
        </View>
        {b.value ? <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>{b.value}</Text> : <Blocks n={b.digits ?? b.shape?.replace(/[^#]/g, "").length ?? 4} size={14} />}
      </View>
      <Dash />
    </View>
  );
}

/* THE LOG: the distance filter the site has, the count and the metres of
 * what is showing, and each row on the tint; PHOTOS opens its pair. */
function Log({ p, onRow }: { p: Profile; onRow?: (id: string) => void }) {
  const [only, setOnly] = useState<0 | 5000 | 10000>(0);
  const rows = p.logRows.filter((r) => only === 0 || (r.meters !== undefined && Math.abs(r.meters - only) <= 50));
  const meters = rows.reduce((n, r) => n + (r.meters ?? 0), 0);
  return (
    <>
      <Eye left="The log" />
      {p.masked ? null : (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          <Chip label="All" on={only === 0} onPress={() => setOnly(0)} />
          <Chip label="5K" on={only === 5000} onPress={() => setOnly(5000)} />
          <Chip label="10K" on={only === 10000} onPress={() => setOnly(10000)} />
        </View>
      )}
      <Text style={[mono(12, false, C.gray), { marginBottom: 12 }]}>
        <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{rows.length}</Text> {rows.length === 1 ? "row" : "rows"}
        {p.masked ? "" : " · "}
        {p.masked ? null : <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{fmtInt(meters)} m</Text>}
      </Text>
      {rows.length === 0 ? <Text style={mono(11, false, C.gray)}>{p.isMe ? "Nothing logged in this stretch yet." : "Nothing logged in this stretch."}</Text> : null}
      {rows.map((r) => (
        <LogLine key={r.id} r={r} onRow={onRow} />
      ))}
    </>
  );
}

/* One logged row on the tint. A tap opens the page of that row, where its
 * photos, its stickers and its read are. */
function LogLine({ r, onRow }: { r: LogRow; onRow?: (id: string) => void }) {
  return (
    <View style={{ backgroundColor: C.tint }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open the row of ${r.dayStr}: ${r.metersStr || "hidden"}`} onPress={() => onRow?.(r.id)} disabled={!onRow} style={{ paddingHorizontal: 8, paddingVertical: 11 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <Text numberOfLines={1} style={[mono(11, false, C.gray, 0.1), { flexShrink: 1 }]}>
            <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{r.dayStr}</Text>
            {r.title ? ` · ${r.title}` : ""}
          </Text>
          {onRow ? <Text style={mono(11, true, C.accent)}>→</Text> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14, marginTop: 6 }}>
          {r.masked ? <Blocks n={r.digits ?? 4} size={14} /> : <Text style={{ fontFamily: F.monoBold, fontSize: 15, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.metersStr}</Text>}
          {r.masked ? null : (
            <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {r.durationStr} <Text style={{ color: C.gray }}> {r.splitStr} /500m</Text>
            </Text>
          )}
        </View>
      </Pressable>
      <Dash />
    </View>
  );
}

/* One of the hidden elite, seen by anybody else while the lights are out:
 * the tag the site prints in place of the page. The split is the one
 * figure of theirs that stays public. */
function DogTag({ p }: { p: Profile }) {
  return (
    <View style={{ borderWidth: 2, borderColor: C.ink, padding: 22, marginTop: 26 }}>
      <Text style={mono(12, true, C.accent)}>{p.blackoutNote}</Text>
      <Text style={{ fontFamily: F.black, fontSize: 56, lineHeight: 62, color: C.ink, marginTop: 10 }}>{p.paceTag ?? "-:--"}</Text>
      <Text style={mono(11, false, C.gray)}>
        Average /500m · {p.sessions} sessions
      </Text>
      <Text style={[mono(11, false, C.gray, 0.12), { marginTop: 14, lineHeight: 18 }]}>The numbers are hidden while the lights are out{p.until ? `, through ${p.until}` : ""}.</Text>
    </View>
  );
}
