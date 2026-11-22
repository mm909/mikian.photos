import { useEffect, useState, type ReactNode } from "react";
import { Image, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { api, edits, type Best, type Blocked, type Counts, type LogRow, type Profile, type Rel } from "../api";
import { Density, MonthGrid, PaceLine } from "../charts";
import { RingIcon, ShareIcon } from "../icons";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Eye, Ledger, WordMenu, mono } from "../site";
import { C, F, MONTHS, fmtClock, fmtInt, isDark } from "../theme";
import { Avatar, Bar, Blocks, PhotoViewer, Waiting, useLoad, useScrollDir } from "../ui";
import { RowerRows } from "./Feed";
import { Join, SignIn } from "./Account";
import { StickerViewer } from "./RowPage";
import { FollowButton, RowerMenu, type PeopleList } from "./Social";

/* A ROWER'S PROFILE, the site's /r/[num] on a phone (looks/Profile.tsx and
 * its pieces), in the site's order:
 *
 *   the nameplate: 095 MIKIAN MUSSER, the number grey, on a hairline;
 *   the month word (a menu: every month and all time);
 *   the meters of that month as the big blue odometer, seven wheels, the
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
 * tag and the meters to the next one ("it doesn't make sense, at least how
 * it's presented here"), the PRIVATE label, the underlines on the two
 * counts. The name is ONE line, shrunk to fit and cut short only if it
 * still will not ("the name can't be on 2 lines").
 *
 * THREE TABS UNDER THE LEDGER (owner, 2026-11-21: "the profile maybe needs
 * some tabs like the Strava one does ... not having to scroll so far down
 * to look at the log ... one for stats, one for the activities. And then
 * ... maybe it's something about the 100K"):
 *
 *   ROWS    the rower's rows as the feed's own cards, newest first
 *   STATS   the pace, the field, the bests, the telemetry
 *   100K    the month's calendar, and every month against the 100K
 *
 * The followers and the following are STACKED, the figure over its word,
 * as Instagram sets them; the bio sits under them; and on somebody else's
 * page a bell beside FOLLOWING asks to be told when that rower rows.
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
  onErg,
  onScrollDir,
  onBest,
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
  /* An erg piece that no logged row is tied to: open the session itself. */
  onErg?: (id: string) => void;
  onScrollDir?: (down: boolean) => void;
  /* A best, pressed: the rower's own ranking for it. */
  onBest?: (num: number, key: string) => void;
}) {
  const dir = useScrollDir(onScrollDir);
  const { ready, me } = useSession();
  const own = num === undefined;
  const [period, setPeriod] = useState<string>("");
  const mine = me.me?.rowerNumber;
  const path = `/api/row100k/app/profile?${own ? "" : `num=${num}&`}${period ? `m=${period}` : ""}`;
  const { data, error, loading, reload } = useLoad(
    () => (own && !mine ? Promise.resolve(null) : api<{ profile?: Profile; blocked?: Blocked }>(path)),
    [path, mine, own ? edits.n : 0],
    own && !mine ? null : path,
  );
  /* How the two stand after a press here, until the page is read again. */
  const [live, setLive] = useState<{ rel: Rel; counts: Counts } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [tab, setTab] = useState<"rows" | "stats" | "100k">("rows");
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
  /* Only the bests there are: a distance never rowed is not a line. */
  const rowed = p.bests.filter((b) => b.sub !== "not yet rowed" && b.value !== "—");

  return (
    <ScrollView {...dir} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
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
      {menu && onMenu && !p.isMe ? <RowerMenu num={p.rower.rowerNumber} name={p.rower.displayName} rel={rel} adminId={p.adminId} onClose={() => onMenu(false)} onRel={setLive} onBlocked={reload} onGone={() => onGone?.()} /> : null}

      {p.masked ? (
        <DogTag p={p} />
      ) : (
        <>
          {/* THE METERS of the month, and under them which month it is: the
              word is the menu (owner, 2026-11-21: "it's just meters and then
              that time", in place of the hours on the erg, which the ledger
              below already carries). */}
          <Odometer meters={t?.meters ?? 0} />
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", marginTop: 8 }}>
            <Text style={mono(12, false, C.gray)}>Meters · </Text>
            <WordMenu options={p.periodOptions} value={p.period.key} onPick={setPeriod} ariaLabel="Which month" />
          </View>

          {/* The handle, and at the right of its line SHARE: the rower's
              own stickers (owner, 2026-11-22: "I need a shareables menu on
              the profile ... maybe it goes to the right of my Instagram"). */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, minHeight: 34 }}>
            {/* A press on the handle is Instagram, at that account (owner,
                2026-11-22: "if I click on ... their Instagram at, it should
                take me ... to their Instagram page"). */}
            {p.rower.instagram ? (
              <Text accessibilityRole="link" accessibilityLabel={`${p.rower.instagram} on Instagram`} onPress={() => Linking.openURL(`https://www.instagram.com/${encodeURIComponent(p.rower.instagram)}/`).catch(() => null)} suppressHighlighting style={[mono(12, false, C.accent), { paddingVertical: 8 }]}>
                @{p.rower.instagram}
              </Text>
            ) : (
              <View />
            )}
            {p.isMe ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Share your stickers" onPress={() => setSharing(true)} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 7, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.accent, opacity: pressed ? 0.7 : 1 })}>
                <ShareIcon color="#fff" size={16} />
                <Text style={mono(10, true, "#fff", 0.12)}>Share</Text>
              </Pressable>
            ) : null}
          </View>
          {sharing ? <StickerViewer onClose={() => setSharing(false)} /> : null}

          <View style={{ marginTop: 20 }}>
            <Ledger
              cells={[
                [hours(t?.seconds ?? 0), "Time rowed"],
                [fmtInt(t?.sessions ?? 0), "Sessions"],
                [t && t.meters > 0 && t.seconds > 0 ? fmtClock((t.seconds / t.meters) * 500) : "-:--.-", "Average split"],
              ]}
            />
          </View>

          {locked ? (
            <View style={{ borderWidth: 2, borderColor: C.ink, padding: 18, marginTop: 30 }}>
              <Text style={mono(12, true)}>Private account</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>
                {rel.following === "pending" ? "Your request is waiting. The rows open when it is accepted." : "The rows and photos are shown to followers this rower has accepted."}
              </Text>
            </View>
          ) : null}

          {locked ? null : <Tabs value={tab} onPick={setTab} />}

          {tab === "100k" && !locked ? <Hundred p={p} /> : null}

          {tab === "stats" && !locked ? (
          <>
          {p.paceCurve.length >= 2 ? (
            <>
              <Eye left="The pace" right="Each row, and the running average" />
              <PaceLine curve={p.paceCurve} dots={p.paceDots} fmt={(s) => fmtClock(s, false)} />
            </>
          ) : null}

          {p.field ? (
            <>
              <Eye left="The field" right={`${fmtInt(p.field.field.sessions)} rows · ${p.field.field.rowers} rowers`} />
              {/* The two standings side by side (owner, 2026-11-21: "average
                  row and average pace might be able to get moved on the same
                  line"). */}
              <View style={{ flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.ink }}>
                <Standing k="Average row" v={fmtInt(p.field.you.avgLen)} u="m" line={`Longer than ${p.field.you.lenPct}%`} />
                <View style={{ width: 1, backgroundColor: C.ink }} />
                <Standing k="Average pace" v={m2(p.field.you.avgPace)} u="/500m" line={`Faster than ${p.field.you.pacePct}%`} pad />
              </View>
              <ChartHead>Length of every row</ChartHead>
              <Density kde={p.field.field.lengthKde} you={p.field.you.lengthYou} fmt={(x) => (x >= 1000 ? `${Math.round(x / 100) / 10}K` : `${Math.round(x)}`)} />
              <ChartHead>Split of every row</ChartHead>
              <Density kde={p.field.field.paceKde} you={p.field.you.paceYou} fmt={m2} lowerIsBetter />
              {p.field.distances.map((d) => (
                <View key={d.meters}>
                  <ChartHead note={`${d.youN} of ${d.fieldN} timed rows`}>The {d.label}</ChartHead>
                  <Density kde={d.field} you={d.you} fmt={m2} lowerIsBetter />
                </View>
              ))}
            </>
          ) : null}

          {/* THE BESTS, after the field, and only the ones there are (owner,
              2026-11-21: "if I haven't rowed a 10K yet or a 5K, then on the
              best, let's hide it ... let's move the best down after the
              field"). */}
          {rowed.length ? (
            <>
              <Eye left="The bests" right={p.period.label} />
              {rowed.map((b) => (
                <BestRow key={b.key} b={b} onPress={onBest ? () => onBest(p.rower.rowerNumber, b.key) : undefined} />
              ))}
            </>
          ) : null}

          {/* TELEMETRY (owner, 2026-11-21: "instead of the erg, let's label
              that telemetry"): each piece opens the page of its row. */}
          {p.ergRows.length ? (
            <>
              <Eye left="Telemetry" right={`${p.ergRows.length} ${p.ergRows.length === 1 ? "piece" : "pieces"}`} />
              {p.ergRows.map((r) => (
                <Pressable key={r.id} accessibilityRole="link" accessibilityLabel={`Open the row of ${r.when}`} disabled={r.entryId ? !onRow : !onErg} onPress={() => (r.entryId ? onRow?.(r.entryId) : onErg?.(r.id))} style={({ pressed }) => ({ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>
                    {r.when}
                    {r.simulated ? " · demo" : ""}
                  </Text>
                  <Text style={{ fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
                    <Text style={{ fontFamily: F.monoBold }}>{r.meters}</Text> {r.time} {r.split}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {p.paceCurve.length < 2 && !p.field && !rowed.length && !p.ergRows.length ? <Text style={[mono(11, false, C.gray), { paddingVertical: 20 }]}>The stats fill in with the first timed rows.</Text> : null}
          </>
          ) : null}
        </>
      )}

      {locked || p.masked || tab !== "rows" ? null : <RowerRows num={p.rower.rowerNumber} mine={p.isMe} onRower={() => null} onRow={(id) => onRow?.(id)} />}
      {p.masked && !locked ? <Log p={p} onRow={onRow} /> : null}
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
  const n = p.rower.rowerNumber;
  /* SIDE BY SIDE, the figure and then its word on one line (owner,
   * 2026-11-21: "0 followers, 3 following, but side by side instead of one
   * on top of another"). On somebody else's page, where FOLLOW shares the
   * line, the two fold under each other only if the phone is too narrow. */
  const count = (v: number, one: string, many: string, list: PeopleList) => (
    <Pressable accessibilityRole="link" accessibilityLabel={`${v} ${v === 1 ? one : many}`} onPress={() => onPeople?.(list, n)} disabled={!onPeople} hitSlop={8} style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
      <Text style={{ fontFamily: F.black, fontSize: 18, lineHeight: 24, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(v)}</Text>
      <Text style={mono(10, false, C.gray, 0.08)}>{v === 1 ? one : many}</Text>
    </Pressable>
  );
  /* THE BELL on this rower: told when they log a row (and when they pass
   * me), or not. Off until pressed. */
  const [ringing, setRinging] = useState(false);
  const ring = async () => {
    setRinging(true);
    try {
      onChange(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num: n, action: "bell", on: !rel.bell } }));
    } catch {
      /* The bell stays as it was; a second press tries again. */
    }
    setRinging(false);
  };
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14, minHeight: 52, marginTop: 12 }}>
        <Avatar uri={p.avatar} name={p.rower.displayName} size={52} />
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 16, rowGap: 2 }}>
          {count(counts.followers, "follower", "followers", "followers")}
          {count(counts.following, "following", "following", "following")}
        </View>
        {!p.isMe && me.me ? (
          <>
            {rel.following === "accepted" ? (
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: rel.bell }} accessibilityLabel={rel.bell ? `Stop notifications when ${p.rower.displayName} rows` : `Notify me when ${p.rower.displayName} rows`} disabled={ringing} onPress={ring} hitSlop={8} style={({ pressed }) => ({ width: 34, height: 32, alignItems: "center", justifyContent: "center", opacity: pressed || ringing ? 0.5 : 1 })}>
                <RingIcon on={rel.bell} />
              </Pressable>
            ) : null}
            <FollowButton num={n} state={rel.following} onChange={onChange} />
          </>
        ) : null}
      </View>
      {p.bio ? <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.ink, marginTop: 12 }}>{p.bio}</Text> : null}
    </>
  );
}

/* THE THREE TABS of a profile: words on a rule, the open one inked and
 * underlined, each a third of the width. */
function Tabs({ value, onPick }: { value: "rows" | "stats" | "100k"; onPick: (t: "rows" | "stats" | "100k") => void }) {
  const tabs: { id: "rows" | "stats" | "100k"; label: string }[] = [
    { id: "rows", label: "Rows" },
    { id: "stats", label: "Stats" },
    { id: "100k", label: "100K" },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", marginTop: 26, marginBottom: 16, borderBottomWidth: 1, borderColor: C.line }}>
      {tabs.map((t) => (
        <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: value === t.id }} onPress={() => onPick(t.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 3, borderColor: value === t.id ? C.ink : "transparent", marginBottom: -1 }}>
          <Text style={mono(12, true, value === t.id ? C.ink : C.gray)}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* THE 100K TAB: the calendar of the month in view, then every month the
 * rower has logged in against the 100,000 (owner, 2026-11-21: "maybe it's
 * something about the 100K"; and his aim for the whole app: "make making
 * the 100K as appealing as possible"). The months are reckoned from the
 * rower's whole log, read once and kept. */
function Hundred({ p }: { p: Profile }) {
  const path = `/api/row100k/app/profile?num=${p.rower.rowerNumber}&m=all`;
  const { data } = useLoad(() => api<{ profile?: Profile }>(path), [path], path);
  const by = new Map<string, number>();
  const days: Record<string, number> = {};
  for (const r of data?.profile?.logRows ?? []) {
    if (r.masked || !r.meters) continue;
    by.set(r.day.slice(0, 7), (by.get(r.day.slice(0, 7)) ?? 0) + r.meters);
    days[r.day] = (days[r.day] ?? 0) + r.meters;
  }
  const months = [...by.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const GOAL = 100_000;
  /* A MONTH PRESSED IN THE LIST IS THE MONTH THE CALENDAR SHOWS (owner,
   * 2026-11-21: "if I click on one of those, then the calendar above it
   * should update"). Worked out here from the log already read, so the
   * page does not read again or move. Until one is pressed: the month the
   * page is on, or the newest. */
  const [pick, setPick] = useState<string | null>(null);
  const open = pick ?? p.month?.key ?? months[0]?.[0] ?? null;
  const ownMonth = open !== null && open === p.month?.key;
  const cal = open ? { key: open, firstDow: new Date(Date.UTC(Number(open.slice(0, 4)), Number(open.slice(5, 7)) - 1, 1)).getUTCDay(), days: new Date(Date.UTC(Number(open.slice(0, 4)), Number(open.slice(5, 7)), 0)).getUTCDate() } : null;
  const calDays: Record<string, number> = ownMonth ? p.byDay : Object.fromEntries(Object.entries(days).filter(([d]) => open !== null && d.startsWith(open)));
  return (
    <>
      {cal ? (
        <>
          <Eye style={{ marginTop: 14 }} left={`${MONTHS[Number(cal.key.slice(5, 7)) - 1]} ${cal.key.slice(0, 4)}`} right="Meters per day" />
          <MonthGrid month={cal} byDay={calDays} today={cal.key === p.thisMonthKey ? p.days : undefined} marks={marksOf(calDays)} />
        </>
      ) : null}
      <Eye style={cal ? undefined : { marginTop: 14 }} left="Every month" right="Against 100,000 m" />
      {months.length === 0 ? <Text style={mono(11, false, C.gray)}>{data ? "No month yet." : "Reading"}</Text> : null}
      {months.map(([key, meters]) => (
        <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: key === open }} accessibilityLabel={`Show ${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)} on the calendar`} onPress={() => setPick(key)} style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderBottomWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderLeftColor: key === open ? C.accent : "transparent", backgroundColor: key === open ? C.tint : "transparent", opacity: pressed ? 0.6 : 1 })}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.ink }}>
              {MONTHS[Number(key.slice(5, 7)) - 1]} <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{key.slice(0, 4)}</Text>
            </Text>
            <Text style={{ fontFamily: F.monoBold, fontSize: 14, color: meters >= GOAL ? C.good : C.ink, fontVariant: ["tabular-nums"] }}>
              {fmtInt(meters)} <Text style={{ fontFamily: F.mono, color: C.gray }}>m</Text>
            </Text>
          </View>
          <Bar value={meters} goal={GOAL} height={10} />
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 8 }]}>{meters >= GOAL ? "100K made" : `${fmtInt(GOAL - meters)} m short of the 100K`}</Text>
        </Pressable>
      ))}
    </>
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

/* THE ODOMETER: the meters on wheels, big and blue, with ONE faint zero in
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
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`${fmtInt(meters)} meters`} style={{ marginTop: 10 }}>
      <Text numberOfLines={1} style={{ fontFamily: F.black, fontSize: size, lineHeight: Math.round(size * 1.04), letterSpacing: -1, color: C.accent, fontVariant: ["tabular-nums"] }}>
        <Text style={{ opacity: isDark() ? 0.5 : 0.28 }}>{printed.slice(0, faint)}</Text>
        {printed.slice(faint)}
      </Text>
    </View>
  );
}

/* Where the rower stands in the field on one measure: one of two cells. */
function Standing({ k, v, u, line, pad }: { k: string; v: string; u: string; line: string; pad?: boolean }) {
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingLeft: pad ? 12 : 0 }}>
      <Text style={mono(10, false, C.gray, 0.14)}>{k}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 6 }}>
        <Text style={{ fontFamily: F.black, fontSize: 26, color: C.accent, fontVariant: ["tabular-nums"] }}>{v}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.accent }}>{u}</Text>
      </View>
      <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 6 }]}>{line}</Text>
    </View>
  );
}

/* What a chart measures, said plainly over it (owner, 2026-11-21: "I would
 * like the title of what this is measuring to be maybe a little more
 * apparent"). */
function ChartHead({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", columnGap: 12 }}>
      <Text style={mono(12, true)}>{children}</Text>
      {note ? <Text style={mono(10, false, C.gray, 0.12)}>{note}</Text> : null}
    </View>
  );
}

/* One best: the name and its place, the day under it, the figure right. */
function BestRow({ b, onPress }: { b: Best; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole={onPress ? "link" : undefined} accessibilityLabel={`${b.label}: every row, ranked`} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ backgroundColor: C.tint, opacity: pressed ? 0.6 : 1 })}>
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
    </Pressable>
  );
}

/* A ROWER'S OWN RANKING FOR ONE BEST (owner, 2026-11-22: "if I click on the
 * best, then let it take me to a page that ranks my rows in order of my
 * fastest 5Ks. Same thing with longest row, 10Ks ... we don't need to show
 * just 10. We can just rank"). Every row of theirs that counts for it, all
 * time, best first; a row opens its page. The word at the top switches
 * which best. */
const BESTS: { key: string; label: string; at?: number }[] = [
  { key: "fastest5000", label: "Fastest 5k", at: 5000 },
  { key: "fastest10000", label: "Fastest 10k", at: 10000 },
  { key: "longest", label: "Longest row" },
  { key: "bigday", label: "Biggest day" },
];
/* RACE DAY IS ITS OWN KIND OF BEST (owner, 2026-11-21: "when we click on
 * the race day 5K for the best, we can just show all the results from race
 * day ... it's okay if it's a little different than all the other ones"):
 * not the rower's own rows ranked, but everybody who raced, in order of
 * time, the rower's own line marked. Only on the menu of a rower who came
 * here from that line. */
const RACE = { key: "raceday", label: "Race day 5k" };
type RaceLine = { place: number; rowerNumber: number; name: string; division: string; bracket: string; bracketPlace: number; time: string; wave: number | null };
function RaceDay({ num, onRower }: { num: number; onRower?: (n: number) => void }) {
  const path = "/api/row100k/app/raceday";
  const { data, error, reload } = useLoad(() => api<{ title: string; dayStr: string; results: RaceLine[] }>(path), [path], path);
  if (!data) return <Waiting error={error} onRetry={reload} />;
  const nth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
  return (
    <>
      <Text style={[mono(11, true), { borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, marginTop: 24 }]}>
        {data.results.length} {data.results.length === 1 ? "finisher" : "finishers"} · {data.dayStr}
      </Text>
      {data.results.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 16 }]}>No times posted yet.</Text> : null}
      {data.results.map((r) => {
        const me = r.rowerNumber === num;
        return (
          <Pressable key={r.rowerNumber} accessibilityRole="link" accessibilityLabel={`${r.name}, ${r.time}`} disabled={!onRower} onPress={() => onRower?.(r.rowerNumber)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: 1, borderColor: C.line, backgroundColor: me ? C.pale : "transparent", paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ width: 30, fontFamily: F.mono, fontSize: 13, color: me ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{r.place}</Text>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>
                <Text style={{ fontFamily: F.mono, fontSize: 12, color: C.gray }}>{String(r.rowerNumber).padStart(3, "0")} </Text>
                {r.name}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 2 }}>
                {[r.bracket ? `${nth(r.bracketPlace)} ${r.bracket.toLowerCase()}` : "", r.wave !== null ? `wave ${r.wave}` : ""].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text style={{ fontFamily: F.black, fontSize: 17, color: me ? C.accent : C.ink, fontVariant: ["tabular-nums"] }}>{r.time}</Text>
          </Pressable>
        );
      })}
    </>
  );
}

export function BestsScreen({ num, best, onRow, onRower }: { num: number; best: string; onRow: (id: string) => void; onRower?: (n: number) => void }) {
  const options = best === RACE.key ? [...BESTS, RACE] : BESTS;
  const [key, setKey] = useState(options.some((b) => b.key === best) ? best : "longest");
  const path = `/api/row100k/app/profile?num=${num}&m=all`;
  const { data, error, reload } = useLoad(() => api<{ profile?: Profile }>(path), [path], path);
  if (!data?.profile) return <Waiting error={error} onRetry={reload} />;
  const p = data.profile;
  const def = BESTS.find((b) => b.key === key) ?? BESTS[2];
  const rows = p.logRows.filter((r) => !r.masked && (r.meters ?? 0) > 0);
  type Line = { id: string | null; head: string; sub: string; value: string };
  let lines: Line[];
  if (def.at) {
    const at = def.at;
    lines = rows
      .filter((r) => Math.abs((r.meters ?? 0) - at) <= 50 && (r.seconds ?? 0) > 0)
      .sort((a, b) => (a.seconds ?? 0) / (a.meters ?? 1) - (b.seconds ?? 0) / (b.meters ?? 1))
      .map((r) => ({ id: r.id, head: r.dayStr, sub: `${r.splitStr} /500m`, value: r.durationStr }));
  } else if (def.key === "longest") {
    lines = [...rows].sort((a, b) => (b.meters ?? 0) - (a.meters ?? 0)).map((r) => ({ id: r.id, head: r.dayStr, sub: `${r.durationStr} · ${r.splitStr} /500m`, value: r.metersStr }));
  } else {
    const days = new Map<string, { head: string; meters: number; n: number }>();
    for (const r of rows) {
      const d = days.get(r.day) ?? { head: r.dayStr, meters: 0, n: 0 };
      d.meters += r.meters ?? 0;
      d.n += 1;
      days.set(r.day, d);
    }
    lines = [...days.values()].sort((a, b) => b.meters - a.meters).map((d) => ({ id: null, head: d.head, sub: `${d.n} ${d.n === 1 ? "row" : "rows"}`, value: `${fmtInt(d.meters)} m` }));
  }
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", rowGap: 8 }}>
        <Text style={mono(12, false, C.gray)}>{p.rower.displayName} · </Text>
        <WordMenu options={options} value={key} onPick={setKey} ariaLabel="Which best" />
      </View>
      {key === RACE.key ? (
        <RaceDay num={num} onRower={onRower} />
      ) : (
        <>
      <Text style={[mono(11, true), { borderBottomWidth: 2, borderColor: C.ink, paddingBottom: 8, marginTop: 24 }]}>
        {lines.length} {def.key === "bigday" ? (lines.length === 1 ? "day" : "days") : lines.length === 1 ? "row" : "rows"} · all time
      </Text>
      {lines.length === 0 ? <Text style={[mono(11, false, C.gray), { paddingVertical: 16 }]}>None yet.</Text> : null}
      {lines.map((l, i) => (
        <Pressable key={`${l.id ?? l.head}${i}`} accessibilityRole={l.id ? "link" : undefined} disabled={!l.id} onPress={() => l.id && onRow(l.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 54, borderBottomWidth: 1, borderColor: C.line, backgroundColor: i === 0 ? C.pale : "transparent", paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ width: 30, fontFamily: F.mono, fontSize: 13, color: i === 0 ? C.accent : C.gray, fontVariant: ["tabular-nums"] }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink }}>{l.head}</Text>
            <Text numberOfLines={1} style={{ fontFamily: F.mono, fontSize: 11, color: C.gray, marginTop: 2 }}>
              {l.sub}
            </Text>
          </View>
          <Text style={{ fontFamily: F.black, fontSize: 17, color: i === 0 ? C.accent : C.ink, fontVariant: ["tabular-nums"] }}>{l.value}</Text>
        </Pressable>
      ))}
        </>
      )}
    </ScrollView>
  );
}

/* THE LOG: the distance filter the site has, the count and the meters of
 * what is showing, and each row on the tint; PHOTOS opens its pair. */
function Log({ p, onRow }: { p: Profile; onRow?: (id: string) => void }) {
  const [only, setOnly] = useState<0 | 5000 | 10000>(0);
  const rows = p.logRows.filter((r) => only === 0 || (r.meters !== undefined && Math.abs(r.meters - only) <= 50));
  const meters = rows.reduce((n, r) => n + (r.meters ?? 0), 0);
  /* EVERY PHOTO IN THE LOG, in one run (owner, 2026-11-22: "if I click
   * specifically on the photos of a row on the log, then just bring up the
   * photo viewer and let me scroll through all photos ... if I keep
   * swiping, then show me the ones after that row"). */
  const all = rows.filter((r) => !r.masked).flatMap((r) => r.photos.slice(0, 2).map((ph) => ({ row: r.id, ph })));
  const [open, setOpen] = useState<number | null>(null);
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
        <LogLine key={r.id} r={r} onRow={onRow} onPhoto={(i) => setOpen(all.findIndex((x) => x.row === r.id) + i)} />
      ))}
      {open !== null && open >= 0 ? <PhotoViewer photos={all.map((x) => x.ph)} start={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/* One logged row on the tint. A tap opens the page of that row, where its
 * photos, its stickers and its read are. */
function LogLine({ r, onRow, onPhoto }: { r: LogRow; onRow?: (id: string) => void; onPhoto?: (i: number) => void }) {
  return (
    <View style={{ backgroundColor: C.tint }}>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open the row of ${r.dayStr}: ${r.metersStr || "hidden"}`} onPress={() => onRow?.(r.id)} disabled={!onRow} style={{ paddingHorizontal: 8, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <Text numberOfLines={1} style={[mono(11, false, C.gray, 0.1), { flexShrink: 1 }]}>
            <Text style={{ fontFamily: F.monoBold, color: C.ink }}>{r.dayStr}</Text>
            {r.title ? ` · ${r.title}` : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14, marginTop: 6 }}>
          {r.masked ? <Blocks n={r.digits ?? 4} size={14} /> : <Text numberOfLines={1} style={{ fontFamily: F.monoBold, fontSize: 15, color: C.ink, fontVariant: ["tabular-nums"] }}>{r.metersStr}</Text>}
          {r.masked ? null : (
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.mono, fontSize: 13, color: C.ink, fontVariant: ["tabular-nums"] }}>
              {r.durationStr} <Text style={{ color: C.gray }}> {r.splitStr} /500m</Text>
            </Text>
          )}
        </View>
        </View>
        {/* The row's two photos, small (owner, 2026-11-21: "I should see the
            photos on the log ... they should be small in the log, kind of
            like they are in the live version"). */}
        {r.masked
          ? null
          : r.photos.slice(0, 2).map((ph, i) => (
              <Pressable key={i} accessibilityRole="imagebutton" accessibilityLabel="Open the photo" onPress={() => onPhoto?.(i)}>
                <Image source={{ uri: ph.thumb ?? ph.full }} resizeMode="cover" style={{ width: 40, height: 50, backgroundColor: C.pale }} />
              </Pressable>
            ))}
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
