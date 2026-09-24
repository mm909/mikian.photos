"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import Link from "next/link";

/* A WORD THAT IS A MENU (owner, 2026-09-24: the native select looked like
 * an old selection box, and only its arrow took the tap; "allow me to
 * click anywhere on the text", "remove the down arrow", "more text, less
 * UI button-y"). The label is plain text with a dotted rule under it, in
 * whatever type it sits in. A press anywhere on it drops a short list in
 * the house panel — paper, a 2px ink rule, mono caps — and each line is a
 * real link, so the page it goes to is the page it goes to, and the tap
 * line (NavProgress.tsx) runs while it loads.
 *
 * The month word (PeriodSelect.tsx) is one of these; the stat word on the
 * stats page is another. Anything that lists a month can be one. */
/* `soft` (the stats page's day word, 2026-09-24): the line keeps a real
 * href — a middle click or a long press still opens the page it names —
 * but a plain tap is handed to `onPick` instead of navigating, so a menu
 * of the month's days can swap a board in place while its first and last
 * lines (the months either side) stay ordinary links. */
export type TextMenuOption = { key: string; label: string; href: string; soft?: boolean };

export function TextMenu({
  options,
  value,
  ariaLabel,
  align = "left",
  onPick,
  className,
}: {
  options: TextMenuOption[];
  value: string;
  ariaLabel: string;
  align?: "left" | "right";
  /* Called with a soft line's key on a plain tap (see TextMenuOption). */
  onPick?: (key: string) => void;
  /* An extra class on the wrapper, for a page that sizes its own list. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLUListElement | null>(null);
  const id = useId();
  const current = options.find((o) => o.key === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      setOpen(false);
      btn.current?.focus();
    };
    const onDown = (ev: Event) => {
      const node = ev.target as Node | null;
      if (node && wrap.current && wrap.current.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    /* The current line takes focus so the arrows start from it. */
    const on = list.current?.querySelector<HTMLAnchorElement>("a.on") ?? list.current?.querySelector<HTMLAnchorElement>("a");
    on?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const onListKey = (ev: ReactKeyEvent<HTMLUListElement>) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    ev.preventDefault();
    const links = [...(list.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = ev.key === "ArrowDown" ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1);
    links[next]?.focus();
  };

  return (
    <span className={className ? `tm ${className}` : "tm"} ref={wrap}>
      <button type="button" ref={btn} className="tm-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={ariaLabel} onClick={() => setOpen((v) => !v)}>
        {current?.label ?? value}
      </button>
      {open ? (
        <ul className={align === "right" ? "tm-list right" : "tm-list"} id={id} role="listbox" ref={list} onKeyDown={onListKey}>
          {options.map((o) => (
            <li key={o.key} role="option" aria-selected={o.key === value}>
              <Link
                href={o.href}
                className={o.key === value ? "on" : ""}
                onClick={(ev) => {
                  setOpen(false);
                  /* A plain tap on a soft line is a pick, not a page load;
                   * a modified click keeps the browser's own meaning. */
                  if (o.soft && onPick && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey) {
                    ev.preventDefault();
                    onPick(o.key);
                    btn.current?.focus();
                  }
                }}
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}
