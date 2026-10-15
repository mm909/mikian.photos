"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIVISION_LABEL,
  FORMATS,
  FORMAT_LABEL,
  GENDER_LABEL,
  categoryLabel,
  dayOf,
  divisionsFor,
  gendersFor,
  igHandle,
  partnerSlots,
  readCategory,
  shortDay,
  type Division,
  type Format,
  type Gender,
  type HyroxEvent,
  type Partner,
} from "../../events";
import { CategoryWords, Names, Time } from "./Board";
import { RemoveEntry } from "./RemoveEntry";

/* ONE CARD ON THE OWNER'S LIST (the-list/page.tsx): the category with
 * PRO boxed, EDIT and REMOVE on the top line; then the names the way the
 * board sets them — NAME & PARTNER in the display face, each a link to
 * hyresult, DEBUT boxed beside them, the handles under (owner, 2026-10-15:
 * "for doubles ... it should be equal, really similar to how we have it
 * on the main page") — with THE TIME big on the right: the start time,
 * the PR small under it; the finish in yellow once run, PR beside it when
 * it beat the old one (same day, second pass: "the time should be more
 * important than the PR ... I want to be able to scan this list and say,
 * this person's running at this time"). Nothing else: no count of
 * earlier races, no lookup buttons — the record is read from hyresult on
 * every save, on view when it goes stale, and from UPDATE over the list.
 *
 * EDIT opens the row in place: the name and handle, the race as three
 * selects, the day, the partner or teammates, and the start time (the
 * owner's any time; the published wave overwrites it when the start
 * list is out). Save posts with the row's id; the route lets the admin
 * update any entry, and looks the name up again. */

export type ListEntry = {
  id: string;
  name: string;
  instagram: string;
  format: string;
  division: string;
  gender: string;
  day: string;
  partners: Partner[];
  startTime: string;
  priorRaces: number | null;
  pr: string;
  finishTime: string;
  resultIdp: string;
};

type Draft = {
  name: string;
  instagram: string;
  format: Format;
  division: Division;
  gender: Gender;
  day: string;
  partners: Partner[];
  startTime: string;
};

function toDraft(e: ListEntry): Draft {
  const cat = readCategory(e.format, e.division, e.gender) ?? { format: "singles" as Format, division: "open" as Division, gender: "men" as Gender };
  return { name: e.name, instagram: e.instagram, ...cat, day: e.day, partners: e.partners.map((p) => ({ ...p })), startTime: e.startTime };
}

export function ListCard({ ev, entry, n }: { ev: HyroxEvent; entry: ListEntry; n: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Draft>(() => toDraft(entry));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cat = readCategory(entry.format, entry.division, entry.gender);
  const d = dayOf(ev, entry.day);
  const label = `${entry.name} (${cat ? categoryLabel(cat) : entry.format}, ${d ? shortDay(d) : entry.day})`;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((p) => ({ ...p, [k]: v }));
  const setPartner = (i: number, patch: Partial<Partner>) =>
    setF((p) => {
      const next = p.partners.slice();
      while (next.length <= i) next.push({ name: "", instagram: "" });
      next[i] = { ...next[i], ...patch };
      return { ...p, partners: next };
    });
  /* Changing the format re-fits the division and gender to what it sells. */
  const pickFormat = (format: Format) =>
    setF((p) => ({
      ...p,
      format,
      division: divisionsFor(format).includes(p.division) ? p.division : "open",
      gender: gendersFor(format).includes(p.gender) ? p.gender : "men",
      partners: p.partners.slice(0, partnerSlots(format)),
    }));

  const toggle = () => {
    setF(toDraft(entry));
    setErr(null);
    setEditing((e) => !e);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/hyrox/${ev.slug}/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          ...f,
          instagram: igHandle(f.instagram),
          partners: f.partners.map((p) => ({ name: p.name, instagram: igHandle(p.instagram) })),
          confirmed: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Couldn't save that — try again.");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Couldn't save that — try again.");
    }
    setBusy(false);
  };

  const id = (k: string) => `hx-${entry.id}-${k}`;
  const editSlots = partnerSlots(f.format);

  return (
    <div className="hx-card">
      <div className="hx-card-top">
        <span className="n">{n}</span>
        <span className="cat">
          <CategoryWords cat={cat} />
        </span>
        <span className="hx-card-acts">
          <button type="button" onClick={toggle}>
            {editing ? "Cancel" : "Edit"}
          </button>
          {editing ? null : <RemoveEntry slug={ev.slug} id={entry.id} label={label} />}
        </span>
      </div>

      {editing ? (
        <form
          className="hx-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="two">
            <div>
              <label className="fl" htmlFor={id("name")}>
                Name
              </label>
              <input id={id("name")} type="text" value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
            </div>
            <div>
              <label className="fl" htmlFor={id("ig")}>
                Instagram
              </label>
              <input id={id("ig")} type="text" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@handle" autoCapitalize="none" maxLength={80} />
            </div>
          </div>

          <div className="three">
            <div>
              <label className="fl" htmlFor={id("format")}>
                Race
              </label>
              <select id={id("format")} value={f.format} onChange={(e) => pickFormat(e.target.value as Format)}>
                {FORMATS.map((fm) => (
                  <option key={fm} value={fm}>
                    {FORMAT_LABEL[fm]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fl" htmlFor={id("division")}>
                Division
              </label>
              <select id={id("division")} value={f.division} onChange={(e) => set("division", e.target.value as Division)} disabled={divisionsFor(f.format).length < 2}>
                {divisionsFor(f.format).map((dv) => (
                  <option key={dv} value={dv}>
                    {DIVISION_LABEL[dv]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fl" htmlFor={id("gender")}>
                Category
              </label>
              <select id={id("gender")} value={f.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
                {gendersFor(f.format).map((g) => (
                  <option key={g} value={g}>
                    {GENDER_LABEL[g]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="hx-hint">That makes it {categoryLabel(f)}.</p>

          <div className="two">
            <div>
              <label className="fl" htmlFor={id("day")}>
                Day
              </label>
              <select id={id("day")} value={f.day} onChange={(e) => set("day", e.target.value)}>
                {ev.days.map((dd) => (
                  <option key={dd.date} value={dd.date}>
                    {dd.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="fl" htmlFor={id("start")}>
                Start time
              </label>
              <input id={id("start")} type="text" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} placeholder="9:40 AM" maxLength={16} />
            </div>
          </div>

          {Array.from({ length: editSlots }, (_, i) => (
            <div className="two" key={i}>
              <div>
                <label className="fl" htmlFor={id(`p${i}`)}>
                  {editSlots === 1 ? "Partner" : `Teammate ${i + 1}`}
                </label>
                <input id={id(`p${i}`)} type="text" value={f.partners[i]?.name ?? ""} onChange={(e) => setPartner(i, { name: e.target.value })} placeholder="Their name" maxLength={80} />
              </div>
              <div>
                <label className="fl" htmlFor={id(`pig${i}`)}>
                  Their Instagram
                </label>
                <input
                  id={id(`pig${i}`)}
                  type="text"
                  value={f.partners[i]?.instagram ?? ""}
                  onChange={(e) => setPartner(i, { instagram: e.target.value })}
                  placeholder="@theirhandle"
                  autoCapitalize="none"
                  maxLength={80}
                />
              </div>
            </div>
          ))}
          <p className="hx-hint">The debut, the PR and the finish come from hyresult by the name as spelled here; saving reads it again. The published wave overwrites the start time once the start list is out.</p>

          {err ? <p className="hx-err">{err}</p> : null}
          <div className="hx-edit-btns">
            <button type="submit" className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={toggle} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="hx-card-main">
          <div className="hx-card-name disp">
            <Names r={entry} />
          </div>
          <Time r={entry} />
        </div>
      )}
    </div>
  );
}
