"use client";

import { useEffect, useRef, useState } from "react";

/* A MAIL IN ITS OWN WINDOW (row100k/emails, 2026-09-27). The mail's HTML
 * is the exact string the send hands Resend — inline styles, its own paper
 * — so it goes in a frame, where the page's CSS cannot touch it and it
 * cannot touch the page, the way an inbox shows it. The frame grows to the
 * mail's height so there is one scroll, the page's. No scripts run in it:
 * the sandbox allows same-origin only, which is what lets the height be
 * read, and links open in a new tab. The body carries a sans default the
 * way Gmail and iOS Mail do, so a line the mail leaves unstyled (the waiver
 * link) reads as it will in a real inbox, not in the browser serif. */
export function MailFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const [h, setH] = useState(640);

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"></head><body style="margin:0;font-family:-apple-system,Roboto,Arial,Helvetica,sans-serif">${html}</body></html>`;

  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    const fit = () => {
      const b = f.contentDocument?.body;
      if (b) setH(Math.max(200, Math.ceil(b.scrollHeight)));
    };
    f.addEventListener("load", fit);
    /* The width changes the height (a phone wraps the lines), so refit on
     * resize too. */
    window.addEventListener("resize", fit);
    fit();
    return () => {
      f.removeEventListener("load", fit);
      window.removeEventListener("resize", fit);
    };
  }, [html]);

  return <iframe ref={ref} className="em-frame" title={title} srcDoc={doc} sandbox="allow-same-origin allow-popups" style={{ height: h }} />;
}
