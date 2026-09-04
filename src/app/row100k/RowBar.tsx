import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { BarAccount } from "./BarAccount";

/* The one bar every /row100k page wears: the ROWTEMBER stamp, then STATS,
 * FEED, GALLERY on the left (owner call, cycle 15 — short labels, gallery
 * public); the sign-in / rower chip on the right. Server component: it
 * resolves the session itself so pages don't each re-plumb it. `children`
 * lands between the links and the account chip for page-specific tags.
 *
 * Layout: three direct flex children (stamp, .bar-links, .bar-right) so the
 * <=560px media query in theme.ts can reflow them into a deliberate two-row
 * bar — stamp + account up top, nav links on their own ruled row below. */
export async function RowBar({
  active,
  sticky = true,
  children,
}: {
  active?: "home" | "stats" | "feed" | "gallery" | "partners";
  /* The gallery opts out so its full-bleed grid owns the scroll. */
  sticky?: boolean;
  children?: React.ReactNode;
}) {
  let signedIn = false;
  let rowerNumber: number | null = null;
  let admin = false;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      signedIn = true;
      admin = isRow100kAdmin(actor.email, actor.roles);
      const me = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { rowerNumber: true },
      });
      rowerNumber = me?.rowerNumber ?? null;
    }
  } catch {
    /* cosmetic — a failed lookup just renders the signed-out chip */
  }

  const link = (href: string, label: string, key: "stats" | "feed" | "gallery" | "partners") =>
    active === key ? (
      <span className="mono tag">{label}</span>
    ) : (
      <a className="mono back-link" href={href}>
        {label}
      </a>
    );

  return (
    <div className="bar" style={sticky ? undefined : { position: "static" }}>
      <span className="bar-lead">
        {/* Mikian Musser, hosting Rowtember — the landing wordmark, then the stamp. */}
        <a className="bar-brand" href="/">
          Mikian<span className="dot">.</span>Musser
        </a>
        {active === "home" ? (
          <span className="bar-mark" aria-current="page">
            ROWTEMBER
          </span>
        ) : (
          <a className="bar-mark" href="/row100k">
            ROWTEMBER
          </a>
        )}
      </span>
      <span className="bar-links">
        {link("/row100k/stats", "STATS", "stats")}
        {link("/row100k/feed", "FEED", "feed")}
        {link("/row100k/gallery", "GALLERY", "gallery")}
        {link("/row100k/partners", "PARTNERS", "partners")}
      </span>
      <span className="bar-right">
        {children}
        <BarAccount signedIn={signedIn} rowerNumber={rowerNumber} admin={admin} />
      </span>
    </div>
  );
}
