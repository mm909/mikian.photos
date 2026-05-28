"use client";

/**
 * Page navigator for catalog grids (Library, Photographer dashboard).
 *
 * - First / Prev / Next / Last buttons
 * - "Page N of M" label
 * - Compact numbered jumps for nearby pages (-2, -1, current, +1, +2)
 * - Shows the slice of total items the current page covers
 */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onGo,
  disabled = false,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onGo: (n: number) => void;
  disabled?: boolean;
}) {
  const first = page === 1;
  const last = page === pageCount;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Window of nearby pages — at most 5 (current ±2).
  const windowSize = 2;
  const lo = Math.max(1, page - windowSize);
  const hi = Math.min(pageCount, page + windowSize);
  const nearby: number[] = [];
  for (let i = lo; i <= hi; i++) nearby.push(i);

  return (
    <nav
      style={{
        marginTop: 22,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
      }}
      aria-label="pagination"
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </div>

      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <PagerBtn label="« First" onClick={() => onGo(1)} disabled={disabled || first} />
        <PagerBtn label="‹ Prev" onClick={() => onGo(page - 1)} disabled={disabled || first} />

        {lo > 1 && (
          <>
            <PagerBtn label="1" onClick={() => onGo(1)} disabled={disabled} />
            {lo > 2 && <Ellipsis />}
          </>
        )}

        {nearby.map((n) => (
          <PagerBtn
            key={n}
            label={String(n)}
            onClick={() => onGo(n)}
            disabled={disabled}
            active={n === page}
          />
        ))}

        {hi < pageCount && (
          <>
            {hi < pageCount - 1 && <Ellipsis />}
            <PagerBtn label={String(pageCount)} onClick={() => onGo(pageCount)} disabled={disabled} />
          </>
        )}

        <PagerBtn label="Next ›" onClick={() => onGo(page + 1)} disabled={disabled || last} />
        <PagerBtn label="Last »" onClick={() => onGo(pageCount)} disabled={disabled || last} />
      </div>
    </nav>
  );
}

function PagerBtn({
  label,
  onClick,
  disabled,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      style={{
        padding: "6px 10px",
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--paper)" : disabled ? "var(--line)" : "var(--ink)",
        border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
        borderRadius: 4,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: ".08em",
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 32,
      }}
    >
      {label}
    </button>
  );
}

function Ellipsis() {
  return (
    <span
      style={{
        padding: "0 4px",
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      …
    </span>
  );
}
