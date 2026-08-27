/* The feed's cards — one look, photos when a row has them (the two-view
 * toggle and the record-badge chips are gone, owner call, cycle 4). The
 * server does every computation — formatting, times, photo URLs — and this
 * component only renders the given shape. No state, no client bundle. */

export type FeedItem = {
  id: string;
  /* "Sep 14 · 2h ago" — the day rowed plus how long ago it landed,
   * condensed into the card's one timestamp slot */
  when: string;
  /* absolute wall-clock time, for the title attribute */
  abs: string;
  rowerNumber: number;
  /* "023" */
  numStr: string;
  name: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  /* session title, may be "" */
  title: string;
  /* resolved photo URLs, rower photo first — presigned GETs for real keys,
   * inline SVG data URIs for demo color squares; empty when the row has no
   * photos or R2 isn't configured */
  photoUrls: string[];
};

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

function PhotoCard({ item }: { item: FeedItem }) {
  return (
    <article className="feed-card">
      <div className="feed-top">
        <Who item={item} />
        <span className="feed-when" title={item.abs}>
          {item.when}
        </span>
      </div>

      {item.title ? <p className="feed-title">{item.title}</p> : null}

      {/* The hierarchy: meters loudest, then the time, then the pace. */}
      <div className="feed-nums">
        <span className="feed-m">{item.metersStr}</span>
        <span className="feed-time">{item.durationStr}</span>
        <span className="feed-split">{item.splitStr} /500m</span>
      </div>

      {item.photoUrls.length > 0 ? (
        <div className={`feed-photos${item.photoUrls.length === 1 ? " one" : ""}`}>
          {item.photoUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              // Index key: two demo squares in one row can share a color, so
              // the URL alone isn't unique.
              key={i}
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

export function FeedViews({ items }: { items: FeedItem[] }) {
  return (
    <div>
      {items.map((item) => (
        <PhotoCard key={item.id} item={item} />
      ))}
    </div>
  );
}
