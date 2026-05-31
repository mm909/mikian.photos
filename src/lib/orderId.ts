/**
 * Human-readable order numbers.
 *
 * The Order table carries two IDs:
 *   - `id` — internal cuid, used in JWT claims and relations. Never shown.
 *   - `orderNumber` — sequential int from a Postgres autoincrement.
 *     Displayed as `MK-123` ("MK" prefix, no zero-padding).
 *
 * Everything the buyer ever sees — receipts, URLs, support emails — uses the
 * `MK-` form. We show the bare number (no leading zeros); `parseOrderNumber`
 * still accepts the old zero-padded form so legacy receipt links keep working.
 */

export const ORDER_PREFIX = "MK-";

export function formatOrderNumber(n: number | bigint): string {
  return `${ORDER_PREFIX}${n.toString()}`;
}

/**
 * Parse a user-supplied order string back to its sequential int. Accepts:
 *   - "MK-000123"  → 123
 *   - "mk-000123"  → 123 (case-insensitive)
 *   - "000123"     → 123 (bare number, padded or not)
 *   - "123"        → 123
 *
 * Returns null for non-numeric / wrong-prefix input so callers can 404.
 */
export function parseOrderNumber(input: string): number | null {
  if (!input) return null;
  const trimmed = input.trim();
  const stripped = trimmed.toLowerCase().startsWith(ORDER_PREFIX.toLowerCase())
    ? trimmed.slice(ORDER_PREFIX.length)
    : trimmed;
  if (!/^\d+$/.test(stripped)) return null;
  const n = Number(stripped);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
