"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import {
  DIVISION_LABEL,
  ERR,
  FORMATS,
  FORMAT_LABEL,
  GENDER_LABEL,
  categoryLabel,
  dayOf,
  divisionsFor,
  eventPath,
  gendersFor,
  igHandle,
  listPath,
  partnerSlots,
  readCategory,
  shortDay,
  type Division,
  type Format,
  type Gender,
  type HyroxEvent,
  type Partner,
} from "../events";
import { Sticker, entryFacts } from "./Sticker";

/* THE FORM (owner, 2026-10-13): name, what they are racing — singles,
 * doubles or relay; open, pro or adaptive; men's, women's or mixed —
 * which day, and the partner (doubles) or teammates (relay) by name and
 * Instagram. No birthday, no email field (the account's), no team name.
 * A start time only once the event opens them (events.ts startTimesOpen).
 * Signed in with Google so an entry can be edited later, and so the board
 * is people, not noise.
 *
 * MORE THAN ONE RACE: plenty of people run a singles one day and a doubles
 * the next, so an account can hold several entries. With any on the board
 * the section opens on MY RACES — each with its sticker, edit and remove —
 * and a button to add another. */

export type MyEntry = {
  id: string;
  name: string;
  instagram: string;
  format: Format;
  division: Division;
  gender: Gender;
  day: string;
  partners: Partner[];
  startTime: string;
};

/* THE BAR'S RIGHT SIDE, the Rowtember way: a bordered chip or two. */
export function AccountControl({ ev, signedIn, name, admin }: { ev: HyroxEvent; signedIn: boolean; name: string; admin: boolean }) {
  const back = eventPath(ev);
  return (
    <div className="hx-acct">
      {signedIn ? (
        <>
          <span className="who">{name}</span>
          {admin ? (
            <a className="hx-chip" href={listPath(ev)}>
              The list
            </a>
          ) : null}
          <button type="button" className="hx-chip" onClick={() => void signOut({ callbackUrl: back })}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="hx-chip" onClick={() => void signIn("google", { callbackUrl: back })}>
          Sign in
        </button>
      )}
    </div>
  );
}

type Draft = Omit<MyEntry, "id">;
type View = { kind: "list" } | { kind: "form"; id: string | null } | { kind: "done"; entry: MyEntry; created: boolean } | { kind: "sticker"; entry: MyEntry };

export function EntryForm({
  ev,
  signedIn,
  closed,
  defaults,
  mine,
}: {
  ev: HyroxEvent;
  signedIn: boolean;
  closed: boolean;
  /* From the Google account: a name to start from. */
  defaults: { name: string };
  mine: MyEntry[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(mine.length > 0 ? { kind: "list" } : { kind: "form", id: null });

  const blank = (): Draft => ({
    name: mine[0]?.name ?? defaults.name,
    instagram: mine[0]?.instagram ?? "",
    format: "singles",
    division: "open",
    gender: "men",
    day: ev.days[0]?.date ?? "",
    partners: [],
    startTime: "",
  });
  const [f, setF] = useState<Draft>(blank);
  const [status, setStatus] = useState<"idle" | "sending" | "removing">("idle");
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((p) => ({ ...p, [k]: v }));
  const setPartner = (i: number, patch: Partial<Partner>) =>
    setF((p) => {
      const next = p.partners.slice();
      while (next.length <= i) next.push({ name: "", instagram: "" });
      next[i] = { ...next[i], ...patch };
      return { ...p, partners: next };
    });

  const startNew = () => {
    setF(blank());
    setError(null);
    setView({ kind: "form", id: null });
  };
  const startEdit = (e: MyEntry) => {
    const { id, ...rest } = e;
    setF(rest);
    setError(null);
    setView({ kind: "form", id });
  };

  /* Changing the format re-fits the division and gender to what it sells. */
  const pickFormat = (format: Format) =>
    setF((p) => ({
      ...p,
      format,
      division: divisionsFor(format).includes(p.division) ? p.division : "open",
      gender: gendersFor(format).includes(p.gender) ? p.gender : "men",
      partners: p.partners.slice(0, partnerSlots(format)),
    }));

  type Duplicate = { names: string[]; entry: string; category: string; day: string };

  const submit = async (id: string | null, confirmed = false) => {
    if (status !== "idle") return;
    setError(null);
    if (!f.name.trim()) return setError(ERR.name);
    if (!readCategory(f.format, f.division, f.gender)) return setError(ERR.category);
    if (!dayOf(ev, f.day)) return setError(ERR.day);
    setStatus("sending");
    try {
      const res = await fetch(`/api/hyrox/${ev.slug}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...f,
          instagram: igHandle(f.instagram),
          partners: f.partners.map((p) => ({ name: p.name, instagram: igHandle(p.instagram) })),
          confirmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: boolean; entry?: MyEntry; error?: string; duplicate?: Duplicate[] };
      if (res.ok && data.ok && data.entry) {
        setView({ kind: "done", entry: data.entry, created: data.created === true });
        setStatus("idle");
        router.refresh();
        return;
      }
      /* THE SAME NAME TWICE (owner, 2026-10-14): a partner may already
       * have put this race on the board. Say who, and let them decide. */
      if (res.status === 409 && data.duplicate && data.duplicate.length > 0) {
        setStatus("idle");
        const lines = data.duplicate.map((d) => `${d.names.join(" and ")} — already on the board as ${d.entry} (${d.category}, ${d.day})`);
        const ok = window.confirm(`${lines.join("\n")}\n\nIf your partner already added this race, you do not need to. Add your entry anyway?`);
        if (ok) await submit(id, true);
        return;
      }
      setError(data.error ?? "Something went wrong — try again.");
    } catch {
      setError("Something went wrong — try again.");
    }
    setStatus("idle");
  };

  const remove = async (e: MyEntry) => {
    if (status !== "idle") return;
    if (!window.confirm(`Take ${categoryLabel(e)} on ${e.day} off the board?`)) return;
    setStatus("removing");
    try {
      const res = await fetch(`/api/hyrox/${ev.slug}/entry`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
      if (mine.length <= 1) setView({ kind: "form", id: null });
    } catch {
      setError("Couldn't remove that — try again.");
    }
    setStatus("idle");
  };

  if (!signedIn) {
    return (
      <button type="button" className="hx-cta" onClick={() => void signIn("google", { callbackUrl: `${eventPath(ev)}#in` })}>
        Sign in with Google to put your name on the board →
      </button>
    );
  }

  if (view.kind === "done" || view.kind === "sticker") {
    const e = view.entry;
    const d = dayOf(ev, e.day);
    return (
      <div className="hx-done">
        {view.kind === "done" ? (
          <>
            <h3 className="disp">
              You are <span className="y">on the board</span>.
            </h3>
            <p>
              {view.created ? "See you there." : "Your entry is updated."} <b>{categoryLabel(e)}</b> on <b>{d ? shortDay(d) : e.day}</b>
              {e.partners.length > 0 ? (
                <>
                  {" "}
                  with <b>{e.partners.map((p) => p.name).join(", ")}</b>
                </>
              ) : null}
              . Here is your sticker.
            </p>
          </>
        ) : (
          <h3 className="disp">
            {categoryLabel(e)} <span className="y">{d ? shortDay(d) : e.day}</span>
          </h3>
        )}
        <Sticker facts={entryFacts(ev, e)} />
        <button type="button" className="hx-cta quiet" onClick={() => setView({ kind: "list" })}>
          My races
        </button>
      </div>
    );
  }

  if (view.kind === "list") {
    return (
      <>
        <div className="hx-mine">
          {mine.map((e) => {
            const d = dayOf(ev, e.day);
            return (
              <div className="hx-mine-row" key={e.id}>
                <div className="what">
                  {categoryLabel(e)} · {d ? shortDay(d) : e.day}
                  <small>
                    {[e.name, ...e.partners.map((p) => p.name)].join(" & ")}
                    {e.startTime ? ` · start ${e.startTime}` : ""}
                  </small>
                </div>
                <div className="acts">
                  <button type="button" onClick={() => setView({ kind: "sticker", entry: e })}>
                    Sticker
                  </button>
                  {closed ? null : (
                    <>
                      <button type="button" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <button type="button" className="x" onClick={() => void remove(e)} disabled={status !== "idle"}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {error ? <p className="hx-err">{error}</p> : null}
        {closed ? (
          <p className="hx-hint">Sign-ups are closed — the race has been run.</p>
        ) : (
          <button type="button" className="hx-cta quiet" onClick={startNew}>
            Add another race →
          </button>
        )}
      </>
    );
  }

  if (closed) {
    return <p className="hx-hint">Sign-ups are closed — the race has been run.</p>;
  }

  const slots = partnerSlots(f.format);
  const editing = view.id !== null;

  return (
    <form
      className="hx-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(view.id);
      }}
    >
      {editing ? <p className="hx-hint">Change anything below and save.</p> : null}

      <div className="two">
        <div>
          <label className="fl" htmlFor="hx-name">
            Your name <i>*</i>
          </label>
          <input id="hx-name" type="text" value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={120} />
        </div>
        <div>
          <label className="fl" htmlFor="hx-ig">
            Your Instagram
          </label>
          <input id="hx-ig" type="text" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@yourhandle" autoComplete="off" autoCapitalize="none" maxLength={80} />
        </div>
      </div>

      <label className="fl">
        Race <i>*</i>
      </label>
      <div className="hx-seg" role="group" aria-label="Format">
        {FORMATS.map((fm) => (
          <button key={fm} type="button" aria-pressed={f.format === fm} onClick={() => pickFormat(fm)}>
            {FORMAT_LABEL[fm]}
          </button>
        ))}
      </div>

      {divisionsFor(f.format).length > 1 ? (
        <>
          <label className="fl">
            Division <i>*</i>
          </label>
          <div className="hx-seg" role="group" aria-label="Division">
            {divisionsFor(f.format).map((dv) => (
              <button key={dv} type="button" aria-pressed={f.division === dv} onClick={() => set("division", dv)}>
                {DIVISION_LABEL[dv]}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <label className="fl">
        Category <i>*</i>
      </label>
      <div className="hx-seg" role="group" aria-label="Category">
        {gendersFor(f.format).map((g) => (
          <button key={g} type="button" aria-pressed={f.gender === g} onClick={() => set("gender", g)}>
            {GENDER_LABEL[g]}
          </button>
        ))}
      </div>
      <p className="hx-hint">That makes it {categoryLabel(f)}.</p>

      <label className="fl">
        Day <i>*</i>
      </label>
      <div className="hx-seg days" role="group" aria-label="Day">
        {ev.days.map((d) => (
          <button key={d.date} type="button" aria-pressed={f.day === d.date} onClick={() => set("day", d.date)}>
            {d.dow}
            <small>{d.label.replace(/^[A-Za-z]+, /, "")}</small>
          </button>
        ))}
      </div>

      {Array.from({ length: slots }, (_, i) => (
        <div className="two" key={i}>
          <div>
            <label className="fl" htmlFor={`hx-p${i}`}>
              {slots === 1 ? "Partner" : `Teammate ${i + 1}`}
            </label>
            <input
              id={`hx-p${i}`}
              type="text"
              value={f.partners[i]?.name ?? ""}
              onChange={(e) => setPartner(i, { name: e.target.value })}
              placeholder="Their name, if you know it"
              autoComplete="off"
              maxLength={80}
            />
          </div>
          <div>
            <label className="fl" htmlFor={`hx-pig${i}`}>
              Their Instagram
            </label>
            <input
              id={`hx-pig${i}`}
              type="text"
              value={f.partners[i]?.instagram ?? ""}
              onChange={(e) => setPartner(i, { instagram: e.target.value })}
              placeholder="@theirhandle"
              autoComplete="off"
              autoCapitalize="none"
              maxLength={80}
            />
          </div>
        </div>
      ))}

      {ev.startTimesOpen ? (
        <>
          <label className="fl" htmlFor="hx-start">
            Start time
          </label>
          <input id="hx-start" type="text" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} placeholder="9:40 AM" autoComplete="off" maxLength={16} />
        </>
      ) : null}

      {error ? <p className="hx-err">{error}</p> : null}
      <button type="submit" className="hx-cta" disabled={status !== "idle"}>
        {status === "sending" ? "Saving…" : editing ? "Save my entry →" : "Put your name on the board →"}
      </button>
      {mine.length > 0 ? (
        <button type="button" className="hx-cta quiet" onClick={() => setView({ kind: "list" })}>
          Back to my races
        </button>
      ) : null}
    </form>
  );
}
