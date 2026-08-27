/* The feed's two lenses over the same items array: PHOTOS (cards, images when
 * a row has them) and COMPACT (dense mono table, no images). The server does
 * every computation — formatting, relative times, badges, photo URLs — and
 * picks the view from ?view= (so paging keeps it); this component only
 * renders the given shape. No state, no client bundle. */

export type FeedBadge = {
  key: string;
  label: string;
  place: number;
};

export type FeedItem = {
  id: string;
  /* "2h ago", computed server-side */
  rel: string;
  /* absolute wall-clock time, for the title attribute */
  abs: string;
  rowerNumber: number;
  /* "023" */
  numStr: string;
  name: string;
  /* the day they rowed, "Sep 14" */
  dayStr: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  /* session title, may be "" */
  title: string;
  badges: FeedBadge[];
  /* tier label ("50K") when the rower has one */
  tier: string | null;
  /* resolved photo URLs, rower photo first — presigned GETs for real keys,
   * inline SVG data URIs for demo color squares; empty when the row has no
   * photos or R2 isn't configured */
  photoUrls: string[];
};

/* URL-facing view names: photos is the default (?view=compact is the only
 * param the toggle ever writes). */
export type FeedView = "photos" | "compact";

/* Who — number + name linking to the rower page. Same idiom as the boards
 * (Boards.tsx), replicated locally so the feed doesn't depend on that file. */
function Who({ item }: { item: FeedItem }) {
  return (
    <span className="feed-who">
      <span className="feed-num">{item.numStr} · </span>
      <a href={`/row100k/r/${item.rowerNumber}`}>{item.name}</a>
    </span>
  );
}

function Chips({ item }: { item: FeedItem }) {
  if (item.badges.length === 0 && !item.tier) return null;
  return (
    <span className="feed-chips">
      {item.badges.map((b) => (
        <span
          key={b.key}
          className={`feed-chip p${b.place}`}
          title={`${b.label} — #${b.place} in division`}
        >
          {b.label} · #{b.place}
        </span>
      ))}
      {item.tier ? (
        <span className="feed-chip tier" title={`${item.tier} tier — total meters this September`}>
          {item.tier}
        </span>
      ) : null}
    </span>
  );
}

function PhotoCard({ item }: { item: FeedItem }) {
  return (
    <article className="feed-card">
      <div className="feed-top">
        <Who item={item} />
        <span className="feed-when" title={item.abs}>
          {item.rel}
        </span>
      </div>

      {item.title ? <p className="feed-title">{item.title}</p> : null}

      <div className="feed-nums">
        <span className="feed-m">{item.metersStr}</span>
        <span className="feed-tds">
          {item.durationStr} · {item.splitStr} /500m · {item.dayStr}
        </span>
      </div>

      <Chips item={item} />

      {item.photoUrls.length > 0 ? (
        <div className={`feed-photos${item.photoUrls.length === 1 ? " one" : ""}`}>
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={i === 0 ? `${item.name} after the row` : "Erg screen"}
              loading="lazy"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CompactTable({ items }: { items: FeedItem[] }) {
  return (
    <div className="feed-scroll">
      <table className="feed-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Rower</th>
            <th style={{ textAlign: "right" }}>Meters</th>
            <th style={{ textAlign: "right" }}>Time</th>
            <th style={{ textAlign: "right" }}>Split</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="feed-when-cell" title={item.abs}>
                {item.rel}
                <span className="feed-day">{item.dayStr}</span>
              </td>
              <td>
                <Who item={item} />
                {item.title ? <div className="feed-t-title">{item.title}</div> : null}
                <Chips item={item} />
              </td>
              <td className="num feed-t-m">{item.metersStr}</td>
              <td className="num">{item.durationStr}</td>
              <td className="num">{item.splitStr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeedViews({ items }: { items: FeedItem[] }) {
  const [view, setView] = useState<View>("PHOTOS");

  return (
    <div>
      <div className="tabs" role="group" aria-label="Feed view">
        {(["PHOTOS", "COMPACT"] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={view === v ? "on" : ""}
            aria-pressed={view === v}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "PHOTOS" ? (
        <div>
          {items.map((item) => (
            <PhotoCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <CompactTable items={items} />
      )}
    </div>
  );
}
