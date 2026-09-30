"use client";

import { useEffect, useState } from "react";

/* THE IN-APP LINE (review, 2026-09-30): the stranger this landing is for
 * arrives from an Instagram bio or story, inside Instagram's own browser,
 * and Google refuses OAuth from an embedded browser (403
 * disallowed_useragent) — so OPT IN, which ends on Google, dies exactly
 * where the audience is. Until the sign-in page says so itself
 * (sign-in/SignInControl.tsx is shared and not this landing's to edit),
 * this landing says it once, under OPT IN, and only inside the app: one
 * mono line, the way out named the way the app names it. Renders nothing
 * on the server and nothing in a real browser. */
export function L4InApp() {
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    if (!/Instagram|FBAN|FBAV/i.test(ua)) return;
    // The in-app browser's own menu: three dots across on an iPhone, three
    // down on Android.
    setMenu(/iPhone|iPad|iPod/i.test(ua) ? "···" : "⋮");
  }, []);
  if (!menu) return null;
  return (
    <p className="l4-inapp mono">
      Google will not sign you in inside Instagram · tap {menu} top right · Open in browser
    </p>
  );
}
