import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Animated, Easing, Image, PanResponder, Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { ROWER_URL, shareLink } from "../files";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { api, edits, type Best, type Blocked, type Counts, type FiveK, type LogRow, type Profile, type Rel } from "../api";
import { MonthGrid, PaceLine } from "../charts";
import { GiftIcon, GridIcon, RingIcon, StatsIcon } from "../icons";
import { arcadeFor } from "../arcade/gate";
import { M2dPanel } from "./M2D";
import { useSession } from "../session";
import { Chip, Ctl, Dash, Eye, Ledger, WordMenu, mono } from "../site";
import { C, F, MONTHS, fmtClock, fmtInt, isDark } from "../theme";
import { Avatar, Bar, Blocks, Btn, PhotoViewer, Waiting, modals, scrub, setSideDrag, useLoad, useScrollDir } from "../ui";
import { RowGrid } from "./Feed";
import { Join, SignIn } from "./Account";
import { StickerViewer } from "./RowPage";
import { FieldCards } from "./Stats";
import { Lab } from "./reviewBits";
import { useWallClock } from "../arcade/BoatArt";
import { grant, useLocker } from "../arcade/locker";
import { CHEST_COST, UPGRADES, buy, buyChest, costOf, useBoat } from "../arcade/boat";
import { prng } from "../arcade/rng";
import { ChestSheet } from "./Locker";
import { useProgress } from "../arcade/progress";
import { levelOf } from "../arcade/score";
import { rollChest, wear, type Chest, type Equipped } from "../arcade/skins";
import { TokenArt } from "../arcade/Token";
import { StoryRing } from "./Recap";
import type { SettingsPage } from "./Settings";
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
 * hidden rower is hidden here by the same rule and gets the same dog tag.
 *
 * THE HEAD AND THE FIRST TAB ARE INSTAGRAM'S (owner, 2026-11-22, with his
 * own Instagram page open beside the app: "I need you to rebuild a lot of
 * this Instagram UI. It's just so good"; "we have to make it exactly like
 * Instagram"). What he named, and where it went:
 *
 *   the face at the left, and beside it three counts, the figure over its
 *     word: ROWS ("it's definitely rows, bro. 161 rows"), followers,
 *     following;
 *   the name under them, the black check after it for a rower who has
 *     Telemetry ("it's a black verified check mark");
 *   under the name, where Instagram prints what an account is, THE TOTAL
 *     METERS ROWED, in the secondary grey ("instead of 100X being where
 *     the photographer is, let's put total meters rowed");
 *   the bio; no link to Instagram ("let's not link to their Instagram
 *     anymore"); no highlights;
 *   the first tab a GRID of the rower's photos and nothing else ("the
 *     exact same Instagram grid with just a photo ... none of the stats");
 *   the month word, the meters of that month, the time rowed, the sessions
 *     and the average split moved INTO the stats tab ("I don't want to see
 *     that if I don't have to ... we're always just going to be showing
 *     the total amounts on the main screen").
 *
 * The rower's number is the word in the app's top bar on this page, as it
 * was (App.tsx). The third tab is still the 100K: he had not decided what
 * it becomes ("I kind of want it to be like a trophy case, but not like a
 * badge collector"). Until that day the head was the site's nameplate over
 * the big blue odometer of the month.
 *
 * THE THREE TABS LIE SIDE BY SIDE, AND A DRAG UNDER THE SELECTOR MOVES
 * BETWEEN THEM (owner, 2026-11-22: "if I'm on the Stats tab of the profile
 * and I'm swiping left or right, then that should just swap whether I'm
 * looking at the 100K or the grid view ... those little panels should
 * change. Right now ... it takes me to the rankings page ... it swipes that
 * whole profile through"). A sideways drag that starts under the selector
 * is this page's, and drags the row of the three as the shell drags its
 * own tabs (App.tsx); at either end it is the shell's again ("unless ...
 * I'm on the very far left ... and then I swipe to the right. That should
 * take me to the stats page"), and so is a drag on the head above the
 * selector. The rule under the open tab travels with the finger.
 *
 * A MONTH PICKED IN THE STATS TAB READS THE STATS AGAIN AND NOTHING ELSE
 * (owner, the same day: "why is it that when I select the time frame for
 * the stats section on the profile, it reloads the whole page instead of
 * just ... the stats ... we just can't reload the whole page"). The page
 * was one read keyed by its month, so a new month had nothing to show and
 * the whole screen went to its waiting state. What was last read stays up
 * now, the stats faint under the new word until the month arrives.
 *
 * THE THIRD TAB IS RATINGS, AND THE CALENDAR IS BACK IN THE STATS (owner,
 * 2026-11-24: "the third tab in the player profile. I want to move that
 * stat, the calendar, back to the stats tab, and this tab I need their elo
 * here ... the person's average 5K pace and the standard deviation of that
 * time"). The 100K tab's calendar, and its list of every month against the
 * 100,000 that picks the calendar's month, are the last section of STATS
 * (`Hundred`, as it was). The third tab (`Ratings`) is the rower's 5Ks over
 * all months: the average pace, the spread, how many, and the dots. */

/* M2D IS THE THIRD COLUMN, AND THE GAME A FOURTH FOR THE OWNER ALONE (owner,
 * 2026-11-25: "let's replace where our current thing for game is. That will
 * be the third column. On mine, let's give me 4 columns, but let's just hide
 * the game column ... for everyone else except for me"). The game column is
 * RATINGS (the arcade's Elo, the boat, the 5K spread); it is drawn for whom
 * the arcade is drawn (arcade/gate.ts). M2D is screens/M2D.tsx M2dPanel. */
const ALL_SUBS = ["rows", "stats", "m2d", "ratings"] as const;
type Sub = (typeof ALL_SUBS)[number];
const subsFor = (game: boolean): readonly Sub[] => (game ? ALL_SUBS : ALL_SUBS.filter((t) => t !== "ratings"));

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
  onPlus,
  onEdit,
  onSettings,
  onLocker,
}: {
  num?: number;
  /* The arcade tab's CHANGE THE LOOK: the locker. */
  onLocker?: () => void;
  /* EDIT PROFILE, pressed on the rower's own page: the account's settings. */
  onEdit?: () => void;
  /* A page of the settings, for the bell's question (2026-11-23). */
  onSettings?: (page: SettingsPage) => void;
  /* Whether this rower wears the black check, for the bar over the page. */
  onPlus?: (num: number, on: boolean) => void;
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
  /* The columns this viewer gets: the game only where the arcade is drawn. */
  const subsRef = useRef<readonly Sub[]>(subsFor(arcadeFor(me)));
  subsRef.current = subsFor(arcadeFor(me));
  const own = num === undefined;
  /* ALL TIME FIRST (owner, 2026-11-23: "On the stats page on the profile,
   * we should default to all-time first"). */
  const [period, setPeriod] = useState<string>("all");
  const mine = me.me?.rowerNumber;
  const path = `/api/row100k/app/profile?${own ? "" : `num=${num}&`}${period ? `m=${period}` : ""}`;
  const { data, error, loading, reload } = useLoad(
    () => (own && mine == null ? Promise.resolve(null) : api<{ profile?: Profile; blocked?: Blocked }>(path)),
    [path, mine, own ? edits.n : 0],
    own && mine == null ? null : path,
  );
  /* How the two stand after a press here, until the page is read again. */
  const [live, setLive] = useState<{ rel: Rel; counts: Counts } | null>(null);
  const [sharing, setSharing] = useState(false);
  /* How wide the field's cards are, to page across. */
  const [fieldW, setFieldW] = useState(0);
  const [tab, setTab] = useState<Sub>("rows");
  /* Counts up while the end of the page is near, for the gallery. */
  const [near, setNear] = useState(0);
  const nearAt = useRef(0);
  useEffect(() => setLive(null), [data]);
  /* What was last read of this rower stays up while another month of them
   * is read. */
  const who = own ? `me${mine ?? ""}` : `r${num}`;
  const keep = useRef<{ who: string; d: NonNullable<typeof data> } | null>(null);
  if (data) keep.current = { who, d: data };
  const held = data ?? (keep.current?.who === who ? keep.current.d : null);
  const turning = !data && !!held;
  const shown = held?.profile;

  /* The three tabs as one row, dragged: `pos` is which is in view, counted
   * in tabs. Only the one in view and the one dragged toward are mounted. */
  const win = useWindowDimensions();
  const paneW = Math.min(win.width, 560);
  const paneRef = useRef(paneW);
  paneRef.current = paneW;
  const tabRef = useRef<Sub>(tab);
  tabRef.current = tab;
  const at = subsRef.current.indexOf(tab);
  const pos = useRef(new Animated.Value(at)).current;
  const [peek, setPeek] = useState<Sub | null>(null);
  const peekRef = useRef<Sub | null>(null);
  /* Whether there are tabs to drag: not on a private or a hidden page. */
  const swipeOk = useRef(false);
  swipeOk.current = false;
  useEffect(() => {
    pos.setValue(at);
  }, [pos, at]);
  /* One place for where a tab stands, and a glide that is cut short is
   * finished on the spot: App.tsx says why (the page that came up blank). */
  const glide = useRef<number | null>(null);
  const settle = useCallback(() => {
    const to = glide.current;
    if (to === null) return;
    glide.current = null;
    pos.stopAnimation();
    pos.setValue(to);
    peekRef.current = null;
    setPeek(null);
    if (subsRef.current[to] !== tabRef.current) {
      tabRef.current = subsRef.current[to];
      setTab(subsRef.current[to]);
    }
  }, [pos]);
  const glideTo = useCallback(
    (to: number, ms: number) => {
      glide.current = to;
      Animated.timing(pos, { toValue: to, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => {
        if (finished && glide.current === to) settle();
      });
    },
    [pos, settle],
  );
  const pickTab = useCallback(
    (t: Sub) => {
      glide.current = null;
      pos.stopAnimation();
      pos.setValue(subsRef.current.indexOf(t));
      peekRef.current = null;
      setPeek(null);
      tabRef.current = t;
      setTab(t);
    },
    [pos],
  );
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        if (!swipeOk.current || modals.open !== 0 || scrub.on) return false;
        if (!(Math.abs(g.dx) > 28 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2)) return false;
        /* Past either end there is no tab of this page: the drag is left
         * for the shell, which moves to the tab beside the profile. */
        const i = glide.current ?? subsRef.current.indexOf(tabRef.current);
        return g.dx < 0 ? i < subsRef.current.length - 1 : i > 0;
      },
      onPanResponderTerminationRequest: () => false,
      /* The page does not scroll up and down under a drag across it. */
      onPanResponderGrant: () => {
        settle();
        setSideDrag(true);
      },
      onPanResponderMove: (_e, g) => {
        const i = subsRef.current.indexOf(tabRef.current);
        pos.setValue(Math.max(0, Math.min(subsRef.current.length - 1, i - g.dx / paneRef.current)));
        const n = i + (g.dx < 0 ? 1 : -1);
        const want = n >= 0 && n < subsRef.current.length ? subsRef.current[n] : null;
        if (peekRef.current !== want) {
          peekRef.current = want;
          setPeek(want);
        }
      },
      onPanResponderRelease: (_e, g) => {
        setSideDrag(false);
        const i = subsRef.current.indexOf(tabRef.current);
        const far = Math.abs(g.dx) > paneRef.current * 0.28 || Math.abs(g.vx) > 0.5;
        glideTo(Math.max(0, Math.min(subsRef.current.length - 1, far ? i + (g.dx < 0 ? 1 : -1) : i)), 220);
      },
      onPanResponderTerminate: () => {
        setSideDrag(false);
        glideTo(subsRef.current.indexOf(tabRef.current), 180);
      },
    }),
  ).current;
  useEffect(() => {
    if (shown) onPlus?.(shown.rower.rowerNumber, !!shown.plus);
    // The page's own word about its rower, once it is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.rower.rowerNumber, shown?.plus]);

  if (own && ready && !me.signedIn) return <SignIn why="Your profile, your rows and logging a row need your account. The feed, the board and the stats are open to everyone." />;
  if (own && ready && me.signedIn && !me.me) return <Join />;
  if (!held) return <Waiting error={error} onRetry={reload} />;
  if (held.blocked) return <BlockedPage b={held.blocked} onChange={reload} />;
  if (!held.profile) return <Waiting error="That profile could not be read." onRetry={reload} />;
  const p = held.profile;
  const t = p.totals;
  const rel = live?.rel ?? p.rel;
  const counts = live?.counts ?? p.counts;
  const locked = !!p.rel.locked;
  /* Only the bests there are: a distance never rowed is not a line. */
  const rowed = p.bests.filter((b) => b.sub !== "not yet rowed" && b.value !== "—");

  swipeOk.current = !locked && !p.masked;
  const panel = (sub: Sub): ReactNode =>
    sub === "rows" ? (
      <RowGrid num={p.rower.rowerNumber} mine={p.isMe} onRow={(id) => onRow?.(id)} more={near} />
    ) : sub === "ratings" ? (
      <Ratings p={p} onLocker={onLocker} />
    ) : sub === "m2d" ? (
      <M2dPanel num={p.rower.rowerNumber} own={p.isMe} />
    ) : (
          <>
          {/* WHICH MONTH, and that month's figures, here and not in the
              head (owner, 2026-11-22). The word is the menu. */}
          {/* A centred button with a caret, as on the stats tab (owner,
              2026-11-23: "I just didn't like how the all-time looks on the
              profile"). */}
          {/* Back at the left, as a button (owner, 2026-11-23: "I don't
              really like the placement there in the middle ... maybe just
              back to the left"). */}
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 10, marginTop: 16, marginBottom: 12 }}>
            <WordMenu options={p.periodOptions} value={turning && period ? period : p.period.key} onPick={setPeriod} ariaLabel="Which time frame" chip />
            {turning ? <Text style={mono(11, false, C.gray)}>Reading</Text> : null}
          </View>
          {/* The month before, faint, until the one picked is read. */}
          <View pointerEvents={turning ? "none" : "auto"} style={{ opacity: turning ? 0.3 : 1 }}>
          <Ledger
            cells={[
              [fmtInt(t?.meters ?? 0), "Meters"],
              [fmtInt(t?.sessions ?? 0), "Sessions"],
            ]}
          />
          <View style={{ marginTop: -2 }}>
            <Ledger
              cells={[
                [hours(t?.seconds ?? 0), "Time rowed"],
                [t && t.meters > 0 && t.seconds > 0 ? fmtClock((t.seconds / t.meters) * 500) : "-:--.-", "Average split"],
              ]}
            />
          </View>
          {p.paceCurve.length >= 2 ? (
            <>
              {/* How many rows, not what the marks are (owner, 2026-11-23:
                  "we can remove each row in the running average ... we can
                  instead put how many rows you have"). */}
              <Eye left="The pace" right={`${fmtInt(Math.max(p.paceCurve.length, p.paceDots.length))} rows`} />
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
              {/* The stats tab's own cards, the rower first and everyone a
                  swipe away (owner, 2026-11-23: "make the user page ... the
                  exact same KDEs ... but starts with their data, and then
                  swiping is everyone else's data"). */}
              <View onLayout={(e) => setFieldW(Math.round(e.nativeEvent.layout.width))} style={{ marginTop: 14 }}>
                <FieldCards
                  w={fieldW}
                  youFirst
                  field={p.field.field}
                  you={p.field.you}
                  distances={p.field.distances.map((d) => ({ meters: d.meters, label: d.label, field: d.field, fieldN: d.fieldN, you: d.you, youN: d.youN }))}
                />
              </View>
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
          {/* THE CALENDAR, BACK IN THE STATS (owner, 2026-11-24: "move that
              stat, the calendar, back to the stats tab"): the month's meters
              a day and every month against the 100K, as the third tab had
              them. Read over all months, whatever time frame is picked. */}
          <Hundred p={p} />
          </View>
          </>
    );

  return (
    <ScrollView
      {...dir}
      /* THE GALLERY GOES ON AS IT IS READ (owner, 2026-11-23: "there's a
         button down there that says more rows. I don't want that. I want
         that continuous loading page"): as the end of the page comes near,
         the grid is told, and it shows its next rows (Feed.tsx RowGrid). */
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        dir.onScroll(e);
        const n = e.nativeEvent;
        if (tabRef.current !== "rows" || n.contentOffset.y + n.layoutMeasurement.height < n.contentSize.height - 900) return;
        const now = Date.now();
        if (now - nearAt.current < 350) return;
        nearAt.current = now;
        setNear((x) => x + 1);
      }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.ink} />}>
      <SocialLine
        p={p}
        rel={rel}
        counts={counts}
        onPeople={onPeople}
        onRow={onRow}
        onSettings={onSettings}
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
          {/* Two buttons side by side, as Instagram sets them (owner,
              2026-11-22, of SHARE alone across the page: "it's just so
              large ... what are the other actions that we could even take
              there?"): EDIT PROFILE, which is the account's settings, and
              SHARE, the rower's own stickers. */}
          {p.isMe ? (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              {onEdit ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={onEdit} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", height: 32, borderRadius: 8, backgroundColor: C.pale, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: C.ink }}>Edit profile</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Share your stickers" onPress={() => setSharing(true)} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", height: 32, borderRadius: 8, backgroundColor: C.pale, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: C.ink }}>Share</Text>
              </Pressable>
            </View>
          ) : null}
          {sharing ? <StickerViewer onClose={() => setSharing(false)} /> : null}

          {locked ? (
            <View style={{ borderWidth: 2, borderColor: C.ink, padding: 18, marginTop: 30 }}>
              <Text style={mono(12, true)}>Private account</Text>
              <Text style={{ fontFamily: F.sans, fontSize: 15, lineHeight: 21, color: C.soft, marginTop: 8 }}>
                {rel.following === "pending" ? "Your request is waiting. The rows open when it is accepted." : "The rows and photos are shown to followers this rower has accepted."}
              </Text>
            </View>
          ) : null}

          {locked ? null : <Tabs value={tab} onPick={pickTab} pos={pos} width={paneW - 32} subs={subsRef.current} />}
        </>
      )}

      {/* UNDER THE SELECTOR: the tab in view, and during a drag the one
          beside it, each moved by the finger. The one in view keeps its
          place in the page and the other is laid over the same ground
          beside it, so nothing under the finger changes height mid-drag (a
          page that grew then moved itself, and in a browser that movement
          ended the drag). Tall enough that a drag under a short tab is
          still a drag on it. */}
      {locked || p.masked ? null : (
        <View {...swipe.panHandlers} style={{ marginHorizontal: -16, overflow: "hidden", minHeight: Math.max(360, win.height - 300) }}>
          {subsRef.current.map((t, i) =>
            t === tab || t === peek ? (
              <Animated.View
                key={t}
                pointerEvents={t === tab ? "auto" : "none"}
                style={[
                  t === tab ? null : { position: "absolute", left: 0, top: 0, width: paneW },
                  { paddingHorizontal: t === "rows" ? 0 : 16, transform: [{ translateX: pos.interpolate({ inputRange: [0, subsRef.current.length - 1], outputRange: [i * paneW, (i - (subsRef.current.length - 1)) * paneW] }) }] },
                ]}
              >
                {panel(t)}
              </Animated.View>
            ) : null,
          )}
        </View>
      )}
      {p.masked && !locked ? <Log p={p} onRow={onRow} /> : null}
    </ScrollView>
  );
}

/* THE HEAD, as Instagram sets one: the face, and beside it the name and
 * the three counts, each a figure over its word (ROWS is not a way
 * anywhere; the other two open their lists). Under them the bio, and on
 * somebody else's page FOLLOW and SHARE, with the bell beside them once
 * they are followed.
 *
 * EVERY METER THE ROWER HAS LOGGED IS AFTER THE NAME, on its line (owner,
 * 2026-11-23: "I want it to be a little more prominent ... it should just
 * say that number meters, not meters rowed ... let's put it after the
 * person's name ... their name, hyphen, and then their total number
 * lifetime. And we could probably just put an M"): "Ada Lovelace - 412,300
 * m", the figure in the heavier face. Until that day it was a grey line of
 * its own under the face, "412,300 meters rowed".
 *
 * FOLLOW IS HALF THE WIDTH ("I also don't like how long this follow button
 * is. Like it's so massive ... the follow button and the following button
 * are too big. I don't know if we can come up with some other options"):
 * it was one bar across the page. It is now one of two, as the rower's own
 * page has EDIT PROFILE and SHARE: FOLLOW, in the blue until it is
 * pressed, and SHARE, which hands the address of this rower's page to the
 * phone's share sheet. SHARE beside it is MINE. */
function SocialLine({ p, rel, counts, onPeople, onChange, onRow, onSettings }: { p: Profile; rel: Rel; counts: Counts; onPeople?: (list: PeopleList, num?: number) => void; onChange: (r: { rel: Rel; counts: Counts }) => void; onRow?: (id: string) => void; onSettings?: (page: SettingsPage) => void }) {
  const { me } = useSession();
  const n = p.rower.rowerNumber;
  const count = (v: number, word: string, list?: PeopleList) => (
    <Pressable accessibilityRole={list ? "link" : "text"} accessibilityLabel={`${v} ${word}`} onPress={() => list && onPeople?.(list, n)} disabled={!list || !onPeople} hitSlop={8} style={{ flex: 1 }}>
      <Text style={{ fontFamily: F.semi, fontSize: 16, lineHeight: 21, color: C.ink, fontVariant: ["tabular-nums"] }}>{fmtInt(v)}</Text>
      <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 13.5, color: C.ink }}>
        {word}
      </Text>
    </Pressable>
  );
  /* THE BELL on this rower: told when they log a row (and when they pass
   * me), or not. Off until pressed. */
  const [ringing, setRinging] = useState(false);
  const set = async (on: boolean) => {
    setRinging(true);
    try {
      onChange(await api<{ rel: Rel; counts: Counts }>("/api/row100k/app/follow", { body: { num: n, action: "bell", on } }));
    } catch {
      /* The bell stays as it was; a second press tries again. */
    }
    setRinging(false);
  };
  /* ON FOR EVERYBODY, OFF FOR ONE (owner, 2026-11-23: "If you have the
   * setting for all notifications ... the notification bell is on for every
   * rower. And if we have that setting turned on and we turn off the
   * notification button, we should give them ... a pop-up that says, you
   * have notifications turned on for everyone. Do you want to turn off for
   * just this rower? ... or go to settings and you can change it"). */
  const ring = () => {
    if (!(rel.bell && rel.bellAll)) return void set(!rel.bell);
    const name = p.rower.displayName;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Notifications are on for every rower. Turn them off for ${name} only?`)) void set(false);
      return;
    }
    Alert.alert("Notifications are on for everyone", `You're told about every row. Turn that off for ${name} only, or change it for everyone in Settings.`, [
      { text: `Off for ${name}`, onPress: () => void set(false) },
      ...(onSettings ? [{ text: "Open Settings", onPress: () => onSettings("notifications") }] : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };
  const rows = p.lifetime?.sessions ?? p.sessions;
  /* To his screenshot of it: the name beside the face with the three
   * counts under it, each set from its own left edge; then, under the
   * face, the line in grey, and the bio. The check is in the bar over the
   * page, after the number (App.tsx), where Instagram has it. */
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 18 }}>
        <StoryRing num={p.rower.rowerNumber} size={88} onRow={onRow}>
          <Avatar uri={p.avatar} name={p.rower.displayName} num={p.rower.rowerNumber} size={88} />
        </StoryRing>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 8 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 14, color: C.ink, flexShrink: 1 }}>
              {p.rower.displayName}
            </Text>
            {p.lifetime ? (
              <>
                {/* The hyphen has its room as a margin: a browser folds a
                    space at the start of a line of type away. */}
                <Text style={{ fontFamily: F.sans, fontSize: 14, color: C.ink, marginHorizontal: 5 }}>-</Text>
                <Text numberOfLines={1} accessibilityLabel={`${fmtInt(p.lifetime.meters)} meters`} style={{ fontFamily: F.semi, fontSize: 14, color: C.ink, fontVariant: ["tabular-nums"] }}>
                  {fmtInt(p.lifetime.meters)} m
                </Text>
              </>
            ) : null}
          </View>
          <View style={{ flexDirection: "row" }}>
            {count(rows, rows === 1 ? "row" : "rows")}
            {count(counts.followers, counts.followers === 1 ? "follower" : "followers", "followers")}
            {count(counts.following, "following", "following")}
          </View>
        </View>
      </View>
      {p.bio ? <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 20, color: C.ink, marginTop: 10 }}>{p.bio}</Text> : null}
      {!p.isMe && me.me ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
          <FollowButton block num={n} state={rel.following} onChange={onChange} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Share a link to ${p.rower.displayName}'s page`} onPress={() => shareLink(`${p.rower.displayName} on ROW.`, ROWER_URL(n)).catch(() => null)} style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", height: 32, borderRadius: 8, backgroundColor: C.pale, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontFamily: F.semi, fontSize: 13.5, color: C.ink }}>Share</Text>
          </Pressable>
          {rel.following === "accepted" ? (
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: rel.bell }} accessibilityLabel={rel.bell ? `Stop notifications when ${p.rower.displayName} rows` : `Notify me when ${p.rower.displayName} rows`} disabled={ringing} onPress={ring} hitSlop={8} style={({ pressed }) => ({ width: 40, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: C.pale, opacity: pressed || ringing ? 0.5 : 1 })}>
              <RingIcon on={rel.bell} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

/* THE THREE TABS of a profile, as Instagram draws them: a picture each, a
 * short ink rule under the open one. The grid of photos, the stats, and the
 * ratings (2026-11-24), a bell curve with its middle marked: the average
 * and the spread the tab is. Until that day the third was the word 100K. */
function Tabs({ value, onPick, pos, width, subs }: { value: Sub; onPick: (t: Sub) => void; pos: Animated.Value; width: number; subs: readonly Sub[] }) {
  const cell = width / subs.length;
  const tabs: { id: Sub; label: string }[] = ([
    { id: "rows" as Sub, label: "Photos of every row" },
    { id: "stats", label: "Stats" },
    { id: "m2d", label: "M2D, the Concept2 Holiday Challenge" },
    { id: "ratings", label: "Ratings" },
  ] as { id: Sub; label: string }[]).filter((t) => subs.includes(t.id));
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", marginTop: 18, marginBottom: 2 }}>
      {tabs.map((t) => {
        const on = value === t.id;
        const tone = on ? C.ink : C.gray;
        return (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} onPress={() => onPick(t.id)} style={{ flex: 1, alignItems: "center", paddingTop: 10 }}>
            <View style={{ height: 26, justifyContent: "center" }}>{t.id === "rows" ? <GridIcon color={tone} size={24} /> : t.id === "stats" ? <StatsIcon color={tone} size={24} /> : t.id === "m2d" ? <GiftIcon color={tone} size={24} /> : <CurveIcon color={tone} size={24} />}</View>
            <View style={{ height: 2, marginTop: 10 }} />
          </Pressable>
        );
      })}
      {/* The short ink rule under the open tab: it goes with the finger. */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: (cell - 64) / 2, bottom: 0, width: 64, height: 2, backgroundColor: C.ink, transform: [{ translateX: pos.interpolate({ inputRange: [0, subs.length - 1], outputRange: [0, cell * (subs.length - 1)] }) }] }} />
    </View>
  );
}

/* THE MONTH, at the foot of the stats tab (it was the 100K tab until
 * 2026-11-24): the calendar of the month in view, then every month the
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
          <Eye left={`${MONTHS[Number(cal.key.slice(5, 7)) - 1]} ${cal.key.slice(0, 4)}`} right="Meters per day" />
          <MonthGrid month={cal} byDay={calDays} today={cal.key === p.thisMonthKey ? p.days : undefined} marks={marksOf(calDays)} />
        </>
      ) : null}
      <Eye left="Every month" right="Against 100,000 m" />
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

/* THE RATINGS TAB (owner, 2026-11-24: "this tab I need their elo here ...
 * the person's average 5K pace and the standard deviation of that time").
 *
 *   RATING, the arcade's Elo (arcade/rating.ts), on the rower's own page
 *     and for an admin only while the arcade is the owner's alone: the
 *     figure big, the games, wins and draws beside it;
 *   THE 5K: the average pace of the rower's 5Ks and their spread (one
 *     standard deviation, a 500 m and over the whole 5K), how many 5Ks it
 *     is from, and every 5K as a dot on one line of pace, the average the
 *     blue line and one standard deviation either side of it washed in the
 *     blue. "No 5Ks yet" when there are none.
 *
 * The figures are the server's (api/row100k/app/profile `fiveK`, all
 * months, whatever time frame the stats tab is on). A server from before
 * them sends none, and the same rule is run here over the log in hand. A
 * private or masked page never reaches this tab (no tabs are drawn). */
/* THE BOAT'S UPGRADES, bought with the coins the course gives (owner,
 * 2026-11-24: "Spend it on boat upgrades: more damage, shorter cooldowns");
 * here, between rows, never while rowing (arcade/boat.ts). */
function Upgrades() {
  const b = useBoat();
  const [chest, setChest] = useState<{ c: Chest; at: number; note?: string } | null>(null);
  const [buying, setBuying] = useState(false);
  /* A chest for coins, the rower's on the press (owner, 2026-11-24). */
  const buyOne = async () => {
    if (buying) return;
    setBuying(true);
    try {
      if (!(await buyChest())) return;
      const c = rollChest(prng(Date.now() % 1e9), false);
      await grant(c.items, false).catch(() => null);
      setChest({ c, at: Date.now() / 1000, note: "BOUGHT WITH COINS · IT'S YOURS" });
    } finally {
      setBuying(false);
    }
  };
  const canChest = !buying && b.coins >= CHEST_COST;
  return (
    <>
      <Eye style={{ marginTop: 14 }} left="The boat" right={`${fmtInt(b.coins)} coins`} />
      {UPGRADES.map((u) => {
        const lv = b[u.id];
        const cost = costOf(u.id, lv);
        const top = lv >= u.max;
        const can = !top && b.coins >= cost;
        return (
          <View key={u.id} style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={mono(11, true)}>{`${u.name} · LEVEL ${lv}`}</Text>
              <Text style={mono(10, false, C.gray, 0.1)}>{u.line}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={top ? `${u.name} is at the top` : `Buy ${u.name} for ${cost} coins`} disabled={!can} onPress={() => buy(u.id).catch(() => null)} style={({ pressed }) => ({ minWidth: 96, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1.5, borderColor: can ? C.ink : C.line, backgroundColor: can ? C.ink : C.paper, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
              <Text style={mono(10, true, can ? C.paper : C.gray)}>{top ? "TOP" : `${fmtInt(cost)} COINS`}</Text>
            </Pressable>
          </View>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 10, paddingVertical: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={mono(11, true)}>A CHEST</Text>
          <Text style={mono(10, false, C.gray, 0.1)}>One item, sometimes three; yours when you press</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Buy a chest for ${CHEST_COST} coins`} disabled={!canChest} onPress={buyOne} style={({ pressed }) => ({ minWidth: 96, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1.5, borderColor: canChest ? C.ink : C.line, backgroundColor: canChest ? C.ink : C.paper, alignItems: "center", opacity: pressed ? 0.6 : 1 })}>
          <Text style={mono(10, true, canChest ? C.paper : C.gray)}>{`${fmtInt(CHEST_COST)} COINS`}</Text>
        </Pressable>
      </View>
      {chest ? <ChestSheet chest={chest} onClose={() => setChest(null)} /> : null}
    </>
  );
}

function Ratings({ p, onLocker }: { p: Profile; onLocker?: () => void }) {
  const [w, setW] = useState(0);
  const five = p.fiveK === undefined ? fiveKFrom(p.logRows) : p.fiveK;
  const n = five?.n ?? 0;
  /* THE RATING: the arcade's Elo, kept on this phone (arcade/rating.ts), so
   * on the rower's own page only, and for an admin only while the arcade is
   * the owner's alone. */
  const { me } = useSession();
  const showRating = p.isMe && arcadeFor(me);
  const locker = useLocker();
  const prog = useProgress();
  const lv = levelOf(prog.xp);
  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {showRating ? (
        <>
          {/* THE ROWER'S PIECE, with the way to the locker (owner,
              2026-11-24: "add a portrait of the rower's avatar and a button
              that opens the Locker to change its look"). */}
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14, marginTop: 16 }}>
            <Portrait equipped={locker.equipped} />
            <View style={{ flex: 1, rowGap: 6 }}>
              <Text style={mono(11, true)}>{`LEVEL ${lv.level}`}</Text>
              <View style={{ height: 8, backgroundColor: C.line }}>
                <View style={{ width: `${Math.round((100 * lv.into) / lv.need)}%`, height: 8, backgroundColor: C.accent }} />
              </View>
              <Text style={mono(10, false, C.gray, 0.1)}>{`${fmtInt(lv.into)} / ${fmtInt(lv.need)} XP`}</Text>
              {onLocker ? <Btn label="Change the look" quiet onPress={onLocker} style={{ marginTop: 2 }} /> : null}
            </View>
          </View>
          {/* PVE FIRST (owner, 2026-11-24: the single player / against
              rowers buttons "don't make sense yet" and "hide the rating: I
              really want to focus on PvE first and then do PvP"): every
              row plays the course; the rating and the switch come back
              with the matches. */}
          <Upgrades />
        </>
      ) : null}
      <Eye style={showRating ? undefined : { marginTop: 14 }} left="The 5K" right={n ? `${n} ${n === 1 ? "5K" : "5Ks"} · all time` : "All time"} />
      {!five || n === 0 ? (
        <Text style={[mono(11, false, C.gray), { paddingVertical: 16 }]}>No 5Ks yet.</Text>
      ) : (
        <>
          <View style={{ flexDirection: "row", borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.ink }}>
            <Standing k="Average pace" v={fmtClock(five.meanPace)} u="/500m" line={`A ${fmtClock(five.meanPace * 10)} 5K`} />
            <View style={{ width: 1, backgroundColor: C.ink }} />
            <Standing k="Spread" v={five.sdPace === null ? "-" : `±${five.sdPace.toFixed(1)}`} u="s /500m" line={five.sdPace === null ? "Needs a second 5K" : `±${five.sdPace * 10 < 60 ? `${Math.round(five.sdPace * 10)} s` : fmtClock(five.sdPace * 10, false)} over the 5K`} pad />
          </View>
          <Text style={[mono(10, false, C.gray, 0.1), { marginTop: 10 }]}>
            From {n} {n === 1 ? "5K" : "5Ks"}: rows within 50 m of 5,000 m. Spread is one standard deviation of their paces.
          </Text>
          <FiveKDots paces={five.paces} mean={five.meanPace} sd={five.sdPace} w={w} />
        </>
      )}
    </View>
  );
}

/* The rower's arcade piece, hopping, in a round frame. */
function Portrait({ equipped }: { equipped: Equipped }) {
  const t = useWallClock(true);
  const q = ((t * 26) / 60) % 1;
  const hop = q < 0.3 ? Math.sin((q / 0.3) * Math.PI) : 0;
  return (
    <View style={{ width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: C.ink, backgroundColor: C.tint, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <TokenArt paint={wear(equipped)} size={78} t={t} hop={hop} look={0.3} uid="portrait" />
    </View>
  );
}

/* The 5K rule the server runs (profileData.ts fiveKOf), for a server that
 * does not yet send `fiveK`: over the log in hand, so over the time frame
 * the page was read for. */
function fiveKFrom(rows: LogRow[]): FiveK {
  const paces = rows.filter((r) => !r.masked && r.meters !== undefined && Math.abs(r.meters - 5000) <= 50 && (r.seconds ?? 0) > 0).map((r) => (r.seconds ?? 0) / ((r.meters ?? 1) / 500)).reverse();
  const n = paces.length;
  if (!n) return { n: 0, meanPace: 0, sdPace: null, paces: [] };
  const mean = paces.reduce((a, b) => a + b, 0) / n;
  const sd = n >= 2 ? Math.sqrt(paces.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return { n, meanPace: mean, sdPace: sd, paces };
}

/* EVERY 5K AS A HASH MARK under one line of pace, quicker to the left, as
 * the other 5K charts mark them (owner, 2026-11-24: he likes "the little
 * hash marks along the bottom" better than the dots): the average the blue
 * line, one standard deviation either side washed in the blue, and from
 * four 5Ks a faint curve of where they fall. */
function FiveKDots({ paces, mean, sd, w }: { paces: number[]; mean: number; sd: number | null; w: number }) {
  if (w < 80 || !paces.length) return null;
  const spread = sd ?? 0;
  const a = Math.min(...paces, mean - spread);
  const b = Math.max(...paces, mean + spread);
  const air = Math.max(1, (b - a) * 0.12);
  const lo = a - air;
  const hi = b + air;
  const edge = 8;
  const sx = (v: number) => edge + ((v - lo) / (hi - lo)) * (w - 2 * edge);
  const RUG = 10;
  const base = 110;
  const H = base + RUG + 30;
  /* The faint curve: a Gaussian over the 5Ks, Silverman's width. */
  let curve: string | null = null;
  if (paces.length >= 4 && spread > 0) {
    const h = Math.max(1.06 * spread * Math.pow(paces.length, -0.2), (hi - lo) / 60);
    const N = 80;
    const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
    const ys = xs.map((x) => paces.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / h) ** 2), 0));
    const top = Math.max(...ys) || 1;
    const room = base - 34;
    curve = `M${xs.map((x, i) => `${sx(x).toFixed(1)} ${(base - (ys[i] / top) * room).toFixed(1)}`).join(" L")}`;
  }
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => (hi - lo) / s <= 5) ?? 60;
  const marks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) marks.push(v);
  const xm = sx(mean);
  return (
    <View style={{ marginTop: 18 }}>
      <Svg width={w} height={H} accessibilityLabel={`${paces.length} 5Ks, averaging ${fmtClock(mean)} a 500 m`}>
        {sd ? <Rect x={sx(mean - sd)} y={22} width={sx(mean + sd) - sx(mean - sd)} height={base - 22} fill={C.accent} opacity={0.12} /> : null}
        {curve ? <Path d={curve} stroke={C.soft} strokeWidth={1.5} fill="none" strokeLinejoin="round" opacity={0.6} /> : null}
        <Line x1={0} x2={w} y1={base} y2={base} stroke={C.ink} strokeWidth={2} />
        <Line x1={xm} x2={xm} y1={18} y2={base} stroke={C.accent} strokeWidth={2.5} />
        <Lab x={xm} y={13} anchor={xm < w * 0.3 ? "start" : xm > w * 0.7 ? "end" : "middle"} color={C.accent} bold>
          {`AVERAGE ${fmtClock(mean)}`}
        </Lab>
        {paces.map((v, i) => (
          <Line key={i} x1={sx(v)} x2={sx(v)} y1={base + 3} y2={base + 3 + RUG} stroke={C.accent} strokeWidth={1.5} opacity={0.7} />
        ))}
        {marks.map((v) => (
          <Lab key={v} x={sx(v)} y={base + RUG + 18} anchor={sx(v) < 16 ? "start" : sx(v) > w - 16 ? "end" : "middle"}>
            {fmtClock(v, false)}
          </Lab>
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={mono(9, false, C.gray, 0.1)}>← Quicker</Text>
        <Text style={mono(9, false, C.gray, 0.1)}>A mark a 5K · /500m</Text>
      </View>
    </View>
  );
}

/* THE RATINGS TAB'S PICTURE: a bell curve on its line, the middle marked. */
function CurveIcon({ color, size }: { color: string; size: number }) {
  const s = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2.5 19 C7 19 8.5 6 12 6 C15.5 6 17 19 21.5 19" {...s} />
      <Path d="M12 9.5 V19" {...s} />
    </Svg>
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
      <Text numberOfLines={1} style={{ fontFamily: F.semi, fontSize: 18, color: C.ink }}>
        {b.displayName}
      </Text>
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
        {/* In the ink, white on the dark look (owner, 2026-11-23: "Let's
            change the color of average row and average pace, make them
            white"); they were the blue. */}
        <Text style={{ fontFamily: F.black, fontSize: 26, color: C.ink, fontVariant: ["tabular-nums"] }}>{v}</Text>
        <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink }}>{u}</Text>
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
/* A best's own rankings board on the stats tab. */
const RANK_OF: Record<string, string> = { fastest5000: "5000", fastest10000: "10000", longest: "longest", bigday: "bigday" };
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

export function BestsScreen({ num, best, onRow, onRower, onRankings }: { num: number; best: string; onRow: (id: string) => void; onRower?: (n: number) => void; onRankings?: (period: string, rec: string) => void }) {
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
      {/* EVERYBODY'S, A PRESS AWAY (owner, 2026-11-23: "I can't see who has
          the fastest 10K ... I need a link to that rankings page after my
          best, so that way I can see where I fall"). */}
      {onRankings ? (
        <Pressable accessibilityRole="link" onPress={() => onRankings("all", RANK_OF[def.key] ?? "total")} hitSlop={6} style={({ pressed }) => ({ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: C.line, opacity: pressed ? 0.5 : 1 })}>
          <Text style={mono(11, true, C.ink, 0.1)}>Everyone's {def.label.toLowerCase()} · rankings</Text>
          <Text style={{ fontFamily: F.black, fontSize: 15, color: C.ink }}>→</Text>
        </Pressable>
      ) : null}
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
