import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ApiError, api } from "./api";
import { Ctl, mono } from "./site";
import { C, F, fmtInt } from "./theme";

/* THE ROWER'S CONCEPT2 LOGBOOK (2026-11-26; owner, of every M2D row being
 * logged twice: "is there a way for us to auto write to the log book?" then
 * "Def do this."). mobile/CONCEPT2-LOGBOOK.md is the plan; the site does
 * the talking (src/lib/concept2.ts, api/row100k/app/concept2).
 *
 * CONNECT opens Concept2's own sign-in page in the phone's sign-in sheet
 * (the same sheet as signing in through the site, session.tsx). The rower
 * signs in there and presses Allow; ROW never sees their Concept2
 * password, and the tokens stay on the site. The sheet comes back to
 * rowtember://concept2, and the site is asked to send the rows: every row
 * off the monitor since M2D began, then each new one as it is logged
 * (autolog.ts) and whatever is waiting as the app opens.
 *
 * IN DEVELOPMENT (CLAUDE.md): shown to an admin only, and the site's routes
 * answer an admin only in production. */

export type C2Status = {
  configured: boolean;
  server: "test" | "live" | null;
  connected: boolean;
  revoked: boolean;
  name: string;
  connectedAt: string | null;
  lastPushAt: string | null;
  counts: { sent: number; already: number; pending: number; failed: number };
  failed: { day: string; meters: number; error: string }[];
};

const PATH = "/api/row100k/app/concept2";
const zone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  } catch {
    return "America/Los_Angeles";
  }
};

/* What the site last said, for as long as the app is open. */
let known: C2Status | null = null;
const subs = new Set<(s: C2Status | null) => void>();
const tell = (s: C2Status | null): C2Status | null => {
  known = s;
  subs.forEach((f) => f(s));
  return s;
};

export async function loadConcept2(): Promise<C2Status | null> {
  return tell((await api<{ concept2: C2Status }>(PATH)).concept2);
}

/* Send what is due. Quiet: asked after every row and as the app opens, and
 * only does anything once a Logbook is connected. */
let syncing: Promise<C2Status | null> | null = null;
export function syncConcept2(): Promise<C2Status | null> {
  if (!known?.connected) return Promise.resolve(known);
  if (syncing) return syncing;
  syncing = api<{ concept2: C2Status }>(`${PATH}/sync`, { body: { tz: zone() } })
    .then((r) => tell(r.concept2))
    .catch(() => known)
    .finally(() => {
      syncing = null;
    });
  return syncing;
}

/* As the app opens, for an admin while this is in development. */
export function armConcept2(): void {
  loadConcept2()
    .then((s) => (s?.connected ? syncConcept2() : null))
    .catch(() => null);
}

/* Connect: Concept2's page, then back. Answers an error sentence or "". */
export async function connectConcept2(): Promise<string> {
  try {
    const { url } = await api<{ url: string }>(`${PATH}/start`, { body: { tz: zone() } });
    const res = await WebBrowser.openAuthSessionAsync(url, "rowtember://concept2");
    if (res.type !== "success") return "";
    const q = res.url.split("?")[1] ?? "";
    const got = Object.fromEntries(q.split("&").map((p) => p.split("=").map((x) => decodeURIComponent(x.replace(/\+/g, " "))) as [string, string]));
    if (got.error) return got.error;
    await loadConcept2();
    await syncConcept2();
    return "";
  } catch (err) {
    return err instanceof ApiError || err instanceof Error ? err.message : "That did not work.";
  }
}

export async function disconnectConcept2(): Promise<string> {
  try {
    tell((await api<{ concept2: C2Status }>(PATH, { method: "DELETE" })).concept2);
    return "";
  } catch (err) {
    return err instanceof Error ? err.message : "That did not disconnect.";
  }
}

export function useConcept2(): { s: C2Status | null; error: string } {
  const [s, setS] = useState<C2Status | null>(known);
  const [error, setError] = useState("");
  useEffect(() => {
    subs.add(setS);
    loadConcept2().catch((e) => setError(e instanceof Error ? e.message : "The Concept2 link could not be read."));
    return () => {
      subs.delete(setS);
    };
  }, []);
  return { s, error };
}

/* "14 rows sent · 3 were already there · 2 waiting". */
function tally(s: C2Status): string {
  const bits = [`${fmtInt(s.counts.sent)} ${s.counts.sent === 1 ? "row" : "rows"} sent`];
  if (s.counts.already) bits.push(`${fmtInt(s.counts.already)} already there`);
  if (s.counts.pending) bits.push(`${fmtInt(s.counts.pending)} waiting`);
  if (s.counts.failed) bits.push(`${fmtInt(s.counts.failed)} not taken`);
  return bits.join(" · ");
}

/* THE CARD: on the M2D tab and on its own page in Settings. */
export function Concept2Card({ full }: { full?: boolean }) {
  const { s, error } = useConcept2();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const run = async (f: () => Promise<string>) => {
    setBusy(true);
    setSaid("");
    const e = await f();
    setSaid(e);
    setBusy(false);
  };
  const head = <Text style={{ fontFamily: F.black, fontSize: 17, color: C.ink, textTransform: "uppercase" }}>Concept2 Logbook</Text>;
  const body = (t: string) => <Text style={{ fontFamily: F.sans, fontSize: 13.5, lineHeight: 19, color: C.gray, marginTop: 6 }}>{t}</Text>;

  let inner;
  if (!s) inner = error ? body(error) : <ActivityIndicator color={C.ink} style={{ marginTop: 10, alignSelf: "flex-start" }} />;
  else if (!s.configured) inner = body("Not set up on ROW yet. When it is, your rows go to your Concept2 Logbook by themselves.");
  else if (!s.connected)
    inner = (
      <>
        {body(
          s.revoked
            ? "Concept2 stopped taking rows from ROW. Connect again to carry on."
            : "Connect once, and every row you row with ROW on the monitor goes to your Concept2 Logbook by itself, from Nov 26 on. Rows already in your Logbook are left as they are, never sent twice.",
        )}
        <View style={{ marginTop: 14 }}>
          <Ctl label={busy ? "Opening Concept2…" : "Connect your Concept2 Logbook"} disabled={busy} onPress={() => run(connectConcept2)} />
        </View>
      </>
    );
  else
    inner = (
      <>
        <Text style={[mono(11, true, C.good, 0.12), { marginTop: 6 }]}>Connected{s.name ? ` · ${s.name}` : ""}</Text>
        {body(`Your rows off the monitor go there by themselves. ${tally(s)}.`)}
        {full && s.failed.length
          ? s.failed.map((f, i) => (
              <Text key={i} style={[mono(10, false, C.accent, 0.08), { marginTop: 6, lineHeight: 15 }]}>
                {f.day} · {fmtInt(f.meters)} m · {f.error}
              </Text>
            ))
          : null}
        <View style={{ flexDirection: "row", columnGap: 22, marginTop: 14 }}>
          <Ctl label={busy ? "Sending…" : "Send now"} disabled={busy} onPress={() => run(async () => ((await syncConcept2()) ? "" : "That did not send."))} />
          {full ? <Ctl label="Disconnect" disabled={busy} onPress={() => run(disconnectConcept2)} /> : null}
        </View>
        {full ? body("Disconnecting stops new rows going. The rows already in your Logbook stay there.") : null}
      </>
    );
  return (
    <View style={{ marginTop: full ? 0 : 22, borderWidth: full ? 0 : 2, borderColor: C.ink, padding: full ? 0 : 16 }}>
      {head}
      {s?.server === "test" ? <Text style={[mono(9.5, true, C.accent, 0.12), { marginTop: 4 }]}>Concept2 test server · in development</Text> : null}
      {inner}
      {said ? <Text style={[mono(11, false, C.accent, 0.1), { marginTop: 10 }]}>{said}</Text> : null}
    </View>
  );
}
