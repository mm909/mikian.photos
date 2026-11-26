/* A PLEDGE, DRAWN (owner, 2026-11-26: "nice graphics that show you're
 * donating $1 per kilometer, at $500 or whatever they put in for the
 * cap"): the rate big in the blue, the cap under it, and a bar of the
 * kilometers filled against the kilometers the cap buys, with the dollars
 * so far. The giver's page and the owner's list both draw it; the giver's
 * form draws it empty as a preview. Styles: pledgeCss.ts. */

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const usd = (d: number) => `$${d.toLocaleString("en-US", { minimumFractionDigits: d % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const rateWord = (c: number): string => (c >= 100 ? `$${(c / 100).toFixed(c % 100 ? 2 : 0)}` : `${Math.round(c * 100) / 100}¢`);
export const capKmOf = (c: number, cap: number) => (c > 0 ? (cap * 100) / c : 0);

export type CardStatus = "preview" | "pending" | "approved" | "claimed" | "declined";
const STATUS: Record<CardStatus, string> = {
  preview: "Your pledge",
  pending: "Waiting for approval",
  approved: "Filling",
  claimed: "Claimed",
  declined: "Declined",
};

export function PledgeCard({
  centsPerKm,
  capDollars,
  name,
  km = 0,
  dollars = 0,
  status,
}: {
  centsPerKm: number;
  capDollars: number;
  name?: string;
  km?: number;
  dollars?: number;
  status: CardStatus;
}) {
  const capKm = capKmOf(centsPerKm, capDollars);
  const pct = capKm > 0 ? Math.max(0, Math.min(100, (km / capKm) * 100)) : 0;
  return (
    <figure className={`pl-card ${status}`} aria-label={`${rateWord(centsPerKm)} a kilometer, up to ${usd(capDollars)}`}>
      <p className="pl-status">
        <span>{STATUS[status]}</span>
        {name ? <span>{name}</span> : null}
      </p>
      <p className="pl-rate">
        {centsPerKm > 0 ? rateWord(centsPerKm) : "—"}
        <small> per km</small>
      </p>
      <p className="pl-cap">
        up to <b>{capDollars > 0 ? usd(capDollars) : "—"}</b>
        {capKm > 0 ? <span> · the next {num(capKm)} km</span> : null}
      </p>
      <div className="pl-bar" role="img" aria-label={`${num(km)} of ${num(capKm)} km filled`}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <p className="pl-fill">
        <span>
          {num(km)} of {num(capKm)} km
        </span>
        <b>{usd(dollars)} so far</b>
      </p>
    </figure>
  );
}
