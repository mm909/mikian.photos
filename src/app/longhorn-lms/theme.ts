import { Playfair_Display, Space_Mono } from "next/font/google";

/* THE LONGHORN LMS LOOK (owner, 2026-10-12: "match their style" — the
 * Capstone Endurance page: near-black ground, a cream high-contrast serif
 * headline with the first word in burnt orange, an italic serif tagline,
 * mono body, one orange bar for the call to action). Their skull is theirs
 * and is not drawn here; the page links to them instead. Scoped under
 * .lh. Prefix the classes .lh-.
 *
 * Rendered as the text child of a style tag: no double quotes, no
 * apostrophes, no angle brackets and no ampersands in this string. */

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--lh-serif",
});
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--lh-mono",
});

export const css = `
.lh,.lh *{margin:0;padding:0;box-sizing:border-box}
.lh{
  --ground:#151311; --panel:#1c1917; --cream:#F2EADB; --cream-dim:rgba(242,234,219,.68); --mute:rgba(242,234,219,.42); --rule:rgba(242,234,219,.18); --orange:#CF5A1C; --orange-hover:#E36A28;
  background:var(--ground);color:var(--cream);
  font-family:var(--lh-mono),monospace;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased;
  min-height:100vh;min-height:100dvh;width:100%;color-scheme:dark;
}
@media (prefers-reduced-motion: reduce){ .lh *{transition:none!important;animation:none!important} }
.lh a{color:inherit}
.lh button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:0;-webkit-tap-highlight-color:transparent}
.lh :focus-visible{outline:2px solid var(--orange);outline-offset:3px}
.lh .wrap{max-width:640px;margin:0 auto;padding:0 24px}

/* THE BAR: the house mark on the left, the account control on the right. */
.lh .lh-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid var(--rule)}
.lh .lh-wm{font-family:var(--lh-serif),serif;font-weight:700;font-size:20px;letter-spacing:.28em;text-transform:uppercase;line-height:1}
.lh .lh-wm small{display:block;font-family:var(--lh-mono),monospace;font-size:9px;letter-spacing:.34em;color:var(--mute);margin-top:6px;font-weight:400}
.lh .lh-acct{display:flex;align-items:center;gap:14px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--cream-dim);white-space:nowrap}
.lh .lh-acct a,.lh .lh-acct button{text-decoration:none;border-bottom:1px solid var(--orange);padding-bottom:2px;color:var(--cream)}
.lh .lh-acct a:hover,.lh .lh-acct button:hover{color:var(--orange)}
.lh .lh-acct .who{border:0;color:var(--mute);overflow:hidden;text-overflow:ellipsis;max-width:38vw}

/* THE HERO. */
.lh .lh-crumb{font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--mute);padding-top:48px}
.lh h1{font-family:var(--lh-serif),serif;font-weight:900;font-size:clamp(46px,12.5vw,88px);line-height:.98;letter-spacing:.01em;text-transform:uppercase;margin-top:26px}
.lh h1 .o{color:var(--orange)}
.lh .lh-tag{font-family:var(--lh-serif),serif;font-style:italic;font-weight:700;font-size:clamp(22px,5.6vw,30px);color:var(--orange);margin-top:26px;line-height:1.25}
.lh .lh-lede{margin-top:22px;font-size:15px;line-height:1.85;color:var(--cream-dim);max-width:34em}
.lh .lh-lede b{color:var(--cream);font-weight:700}

/* THE FACTS: a ruled grid, mono. */
.lh .lh-facts{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin-top:40px}
.lh .lh-fact{padding:16px 0}
.lh .lh-fact + .lh-fact{border-left:1px solid var(--rule);padding-left:18px}
.lh .lh-fact:nth-child(n+3){border-top:1px solid var(--rule)}
.lh .lh-fact:nth-child(3){border-left:0;padding-left:0}
.lh .lh-fact .k{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute)}
.lh .lh-fact .v{font-family:var(--lh-serif),serif;font-weight:700;font-size:22px;line-height:1.2;margin-top:6px;color:var(--cream)}
.lh .lh-fact .v small{display:block;font-family:var(--lh-mono),monospace;font-size:11px;font-weight:400;color:var(--cream-dim);margin-top:4px;letter-spacing:.04em}

/* THE ORANGE BAR: one call to action in their voice. */
.lh .lh-cta{display:block;width:100%;margin-top:34px;background:var(--orange);color:var(--cream);text-align:center;font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;padding:20px 16px;text-decoration:none;transition:background 160ms ease}
.lh .lh-cta:hover{background:var(--orange-hover)}
.lh .lh-cta:disabled{background:#4a3a31;color:var(--mute);cursor:default}
.lh .lh-cta.quiet{background:transparent;border:1px solid var(--rule);color:var(--cream-dim);margin-top:12px}
.lh .lh-cta.quiet:hover{border-color:var(--cream);color:var(--cream)}

/* THE SECTION HEAD. */
.lh section{padding-top:56px}
.lh .lh-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1px solid var(--cream);padding-bottom:12px}
.lh .lh-head h2{font-family:var(--lh-serif),serif;font-weight:900;font-size:clamp(28px,7vw,40px);line-height:1;text-transform:uppercase;letter-spacing:.01em}
.lh .lh-head span{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);white-space:nowrap}

/* THE FORM. */
.lh .lh-form label.fl{display:block;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--mute);margin:26px 0 6px}
.lh .lh-form label.fl i{font-style:normal;color:var(--orange)}
.lh .lh-form input[type=text],.lh .lh-form input[type=email],.lh .lh-form input[type=tel],.lh .lh-form input[type=number]{width:100%;background:transparent;border:none;border-bottom:1px solid var(--rule);color:var(--cream);font-family:var(--lh-mono),monospace;font-size:17px;padding:10px 2px;border-radius:0;appearance:none}
.lh .lh-form input:focus{outline:none;border-bottom-color:var(--orange)}
.lh .lh-form input::placeholder{color:var(--mute)}
.lh .lh-form .two{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.lh .lh-hint{font-size:11px;color:var(--mute);margin-top:8px;line-height:1.6}
.lh .lh-err{margin-top:16px;font-size:12px;letter-spacing:.06em;color:var(--orange)}

/* THE PHOTO: a square frame the width of a thumb, the picture inside it
 * once picked, the words on top of the frame while empty. */
.lh .lh-photo{display:flex;align-items:center;gap:18px;margin-top:4px}
.lh .lh-photo-frame{position:relative;flex:none;width:112px;height:112px;border:1px solid var(--rule);background:var(--panel);overflow:hidden;cursor:pointer}
.lh .lh-photo-frame img{display:block;width:100%;height:100%;object-fit:cover}
.lh .lh-photo-frame .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);text-align:center;padding:10px}
.lh .lh-photo-words{font-size:12px;line-height:1.7;color:var(--cream-dim)}
.lh .lh-photo-words button{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--cream);border-bottom:1px solid var(--orange);padding-bottom:2px;margin-top:6px}
.lh .lh-photo-words button:hover{color:var(--orange)}

/* THE CONFIRMATION. */
.lh .lh-done{margin-top:34px;border-top:1px solid var(--cream);padding-top:26px}
.lh .lh-done h3{font-family:var(--lh-serif),serif;font-weight:900;font-size:clamp(30px,8vw,44px);line-height:1;text-transform:uppercase}
.lh .lh-done h3 .o{color:var(--orange)}
.lh .lh-done p{margin-top:16px;color:var(--cream-dim);line-height:1.8}
.lh .lh-done p b{color:var(--cream)}

/* THE LIST (the owner). */
.lh .lh-table{width:100%;border-collapse:collapse;margin-top:22px;font-size:12px}
.lh .lh-table th{text-align:left;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--mute);font-weight:400;padding:0 10px 10px 0;border-bottom:1px solid var(--cream)}
.lh .lh-table td{padding:12px 10px 12px 0;border-bottom:1px solid var(--rule);vertical-align:middle}
.lh .lh-table td.n{color:var(--mute);width:28px}
.lh .lh-table td.pic img{display:block;width:44px;height:44px;object-fit:cover;border:1px solid var(--rule)}
.lh .lh-table td.who{font-weight:700;color:var(--cream)}
.lh .lh-table td a{text-decoration:none;border-bottom:1px solid var(--orange)}
.lh .lh-table td.when{white-space:nowrap;color:var(--mute);font-size:11px}
.lh .lh-list-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.lh .lh-empty{margin-top:24px;color:var(--mute)}

/* THE FOOT. */
.lh footer{margin-top:72px;border-top:1px solid var(--rule);padding:34px 0 56px}
.lh footer p{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);line-height:2}
.lh footer a{color:var(--cream);text-decoration:none;border-bottom:1px solid var(--orange)}
.lh footer a:hover{color:var(--orange)}

@media(max-width:420px){
  .lh .lh-form .two{grid-template-columns:1fr}
  .lh .lh-acct .who{display:none}
}
`;
