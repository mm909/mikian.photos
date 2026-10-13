import { categoryLabel, categoryRank, partnerSlots, readCategory, shortDay, type HyroxEvent, type Partner } from "../events";

/* THE BOARD (owner, 2026-10-13: "a public sign-up board ... I want to be
 * able to go on a page and see that my friends are running these doubles
 * on this day, or this person's running a singles on this day"). Every
 * entry on the event, by day, then by category, then by name. Names, the
 * handles given, and the start time once there is one. Never the email. A
 * server component: the page hands it the rows. */

export type BoardRow = {
  id: string;
  name: string;
  instagram: string;
  format: string;
  division: string;
  gender: string;
  day: string;
  partners: Partner[];
  startTime: string;
};

function Handle({ h }: { h: string }) {
  return (
    <a href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer">
      @{h}
    </a>
  );
}

function Names({ r }: { r: BoardRow }) {
  const cat = readCategory(r.format, r.division, r.gender);
  const slots = cat ? partnerSlots(cat.format) : 0;
  const names = [r.name, ...r.partners.map((p) => p.name)];
  const missing = Math.max(0, slots - r.partners.length);
  const handles = [r.instagram, ...r.partners.map((p) => p.instagram)].filter(Boolean);
  return (
    <div className="names">
      {names.map((n, i) => (
        <span key={i}>
          {i > 0 ? <span className="amp">&amp;</span> : null}
          {n}
        </span>
      ))}
      {missing > 0 ? (
        <span className="tbd">
          <span className="amp">&amp;</span>
          {missing === 1 ? "TBD" : `${missing} TBD`}
        </span>
      ) : null}
      {handles.length > 0 ? (
        <small>
          {handles.map((h, i) => (
            <span key={h + i}>
              {i > 0 ? " · " : null}
              <Handle h={h} />
            </span>
          ))}
        </small>
      ) : null}
    </div>
  );
}

export function Board({ ev, rows }: { ev: HyroxEvent; rows: BoardRow[] }) {
  if (rows.length === 0) return <p className="hx-empty">Nobody on the board yet. Be the first.</p>;

  return (
    <>
      {ev.days.map((d) => {
        const today = rows.filter((r) => r.day === d.date);
        if (today.length === 0) return null;
        /* Group by category in rulebook order; sort by name within. */
        const groups = new Map<string, { rank: number; rows: BoardRow[] }>();
        for (const r of today) {
          const cat = readCategory(r.format, r.division, r.gender);
          const label = cat ? categoryLabel(cat) : "Other";
          const rank = cat ? categoryRank(cat) : 999;
          const g = groups.get(label) ?? { rank, rows: [] };
          g.rows.push(r);
          groups.set(label, g);
        }
        const ordered = [...groups.entries()].sort((a, b) => a[1].rank - b[1].rank);
        return (
          <div className="hx-day" key={d.date}>
            <div className="hx-day-head">
              <h3 className="disp">{shortDay(d)}</h3>
              <span>
                {today.length} {today.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            {ordered.map(([label, g]) => (
              <div className="hx-cat" key={label}>
                <h4>{label}</h4>
                {g.rows
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((r) => (
                    <div className="hx-row" key={r.id}>
                      <Names r={r} />
                      {r.startTime ? <div className="start">{r.startTime}</div> : null}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
