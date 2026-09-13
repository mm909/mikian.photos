"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* THE BLACK AROUND THE WALL, AND THE ONE CONTROL ON IT.
 *
 * The frame itself is server-rendered and sized entirely in CSS — see the
 * atan2 block in rrCss.ts. This wrapper adds NOTHING to the sizing, which is
 * the point: with this bundle blocked, still loading, or scripting off, the
 * television already shows a wall filling the screen at the right size. All
 * this component can do is take the browser chrome off it.
 *
 * WHY IT HAS TO BE A CLIENT COMPONENT: requestFullscreen only fires inside a
 * real user gesture. There is no markup, no header and no URL that does it.
 *
 * THE BUTTON IS NOT RENDERED UNTIL WE KNOW IT WORKS. An iPhone has no
 * Element.requestFullscreen at all and an embedded frame can have it
 * disabled, and a dead control on a wall is worse than no control. So the
 * server sends the frame and nothing else, and the button appears after the
 * capability check — it is absolutely positioned, so nothing moves when it
 * does.
 *
 * THE FADE. A button parked in the corner of a television all evening is the
 * same complaint the owner raised, in a smaller font. It goes quiet after a
 * few seconds still and any pointer move, key or tap brings it back; the
 * dwell is longer before the screen is filled, because that is when somebody
 * is still looking for it. Once filled the cursor goes too (rrCss).
 *
 * NO POINTER AT ALL — a television browser driven by a remote: the button is
 * the only focusable thing on the page, so the first press of a D-pad lands
 * on it and focus overrides the fade. F toggles from any keyboard, and the
 * browser's own F11 still works underneath all of this. */
export function CastShell({
  pinned = false,
  children,
}: {
  /* The capture frame has no control on it at all — see CastFrame. */
  pinned?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [can, setCan] = useState(false);
  const [casting, setCasting] = useState(false);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (pinned) return;
    const el = ref.current;
    if (!el || typeof el.requestFullscreen !== "function") return;
    if (document.fullscreenEnabled === false) return;
    setCan(true);
  }, [pinned]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    /* Both sides reject rather than throw — a browser that refuses is not a
     * reason to put an error on the wall. */
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!can) return;
    /* Escape leaves fullscreen without touching the button, and so does the
     * browser's own control, so the label follows the DOCUMENT rather than
     * the last thing pressed. */
    const onChange = () => setCasting(document.fullscreenElement === ref.current);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      /* NOT WHILE SOMEBODY IS TYPING. A bare window listener that swallows
       * one letter of the alphabet is fine on a wall with no inputs on it
       * and a trap the moment anything editable shares the page — the
       * letter never arrives and preventDefault hides why. This board has
       * no field today; the guard is here because the next thing anybody
       * adds to it will, and the failure would look like a broken keyboard
       * rather than a shortcut. contentEditable covers a rich text host,
       * which is not an input element and would otherwise slip through. */
      const t = event.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
      event.preventDefault();
      toggle();
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [can, toggle]);

  useEffect(() => {
    if (!can) return;
    let timer = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), casting ? 2400 : 4200);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [can, casting]);

  const cls = ["rr-fit", pinned ? "pinned" : "", casting ? "casting" : "", idle ? "idle" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} ref={ref}>
      {children}
      {can ? (
        <button
          type="button"
          className="rr-full"
          /* IT LETS GO OF FOCUS ON THE WAY IN. Focus beats the fade by design
           * — it is how a remote with no pointer reaches this at all — but a
           * remote that reached it and pressed it would then leave it lit in
           * the corner of a filled screen forever, which is the one thing it
           * must not do. Tab lands on it again to come back out, and so does
           * Escape, and so does F. */
          onClick={(event) => {
            event.currentTarget.blur();
            toggle();
          }}
        >
          {casting ? "Exit full screen" : "Full screen"}
        </button>
      ) : null}
    </div>
  );
}
