import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { mediaUrl } from '../utils/nativeCapabilities';

/**
 * The help desk: a menu-driven assistant for registration, class-joining and
 * learning-module questions.
 *
 * ## Why a menu and not a text box
 *
 * Every answer here is computed from the visitor's real account state, and the
 * server decides which explanation applies (see modules/helpdeskModule). A free
 * text box would invite questions this page cannot answer and would hide the one
 * thing that makes it useful — that the list of things it *can* answer is short,
 * visible, and each item resolves to a real check rather than to prose. So the
 * conversation is a chat in shape only: the visitor picks, the server looks it
 * up, and the reply carries the next questions worth asking.
 *
 * ## The gate
 *
 * Nothing is looked up until an address is verified with a one-time password,
 * because the answers describe an account and one of the actions creates one.
 * The pass that comes back is held in memory only — never localStorage: it is
 * proof of a mailbox handed out to whoever can read one email, it lasts
 * forty-five minutes, and a page refresh costing a fresh code is a far better
 * trade than a pass left behind on a shared lab machine.
 *
 * A visitor who is already signed in skips all of that: the server hands out a
 * pass against the platform session, scoped to the address on that account (see
 * `sessionFromLogin` on the server). A password is strictly more proof than a
 * mailed code, so asking for the code as well would be a delay that buys
 * nothing. The page is still built around the anonymous path, because the
 * people it exists for are the ones who cannot sign in.
 *
 * ## Rendering
 *
 * The server sends answers as typed blocks rather than as HTML, so this file
 * chooses every pixel and nothing arriving over the wire is ever interpreted as
 * markup. A new topic on the server needs no change here; a new *block type*
 * would.
 */

const apiUrl = getEnvironment();
const API = `${apiUrl}/api/v1/helpdesk`;

/* ── styling ──────────────────────────────────────────────────────────────
   Plain CSS in one string, the same approach as GuidePage: this is a public
   page reachable while signed out, and it should not depend on a theme
   provider or pull a component library into the route's chunk. Chakra's
   existing toggle sets data-theme on the document, which selects our dark
   palette without adding a second theme state to this page.

   ## Colour carries the module

   Every answer here belongs to one module, and the modules are what a visitor
   is actually navigating. So each has an accent — set once, as `--accent` and
   `--accent-bg` on a wrapper — and everything inside inherits it: the card, the
   heading of the answer it produced, the chips of its questions. It is not
   decoration; it is how a reader tells "this is about certificates" from "this
   is about the timetable" while scrolling past.

   ## Sizes

   Nothing here is in fixed pixels where a phone would care. The page is read on
   a handset by somebody standing in a corridor at least as often as on a
   laptop, which is why the type scales with the viewport, the cards collapse to
   one column, every button reaches full width when a row would otherwise wrap
   to two, and inputs are 16px on small screens — anything less and iOS zooms
   the page on focus, which strands the form off screen. */

const CSS = `
.hd { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc;
      --surface:#fff; --surface-alt:#f1f5f9; --avatar-bg:#e2e8f0;
      --detail:#334155; --secondary:#475569; --control-line:#cbd5e1;
      --brand:#4f46e5; --brand-dark:#4338ca; --brand-bg:#eef2ff;
      --accent:var(--brand); --accent-dark:var(--brand-dark); --accent-bg:var(--brand-bg);
      --ok:#059669; --ok-bg:#ecfdf5; --warn:#b45309; --warn-bg:#fffbeb;
      --bad:#dc2626; --bad-bg:#fef2f2; --info:#0369a1; --info-bg:#f0f9ff;
      --warn-text:#78350f; --info-text:#075985; --info-line:#bae6fd;
      --bad-text:#991b1b; --bad-line:#fecaca; --focus-ring:rgba(79,70,229,.13);
      font-family:'Inter','Segoe UI',system-ui,sans-serif; color:var(--ink);
      background:var(--bg); min-height:100vh; }
[data-theme='dark'] .hd {
  --ink:#f1f5f9; --muted:#94a3b8; --line:#334155; --bg:#0f172a;
  --surface:#1e293b; --surface-alt:#334155; --avatar-bg:#334155;
  --detail:#e2e8f0; --secondary:#cbd5e1; --control-line:#64748b;
  --brand-dark:#a5b4fc; --brand-bg:#252a52;
  --ok-bg:#12372e; --warn-bg:#3b2a16; --bad-bg:#3d2027; --info-bg:#153349;
  --warn-text:#fde68a; --info-text:#bae6fd; --info-line:#0369a1;
  --bad-text:#fecaca; --bad-line:#b91c1c; --focus-ring:rgba(165,180,252,.3);
}
/* Resolve module colours on their own wrapper, so nested replies and choices
   keep their category's palette when the document theme changes. */
.hd-module { --accent:var(--module-accent); --accent-dark:var(--module-heading);
             --accent-bg:var(--module-bg); }
[data-theme='dark'] .hd-module { --accent-dark:var(--module-heading-dark);
                               --accent-bg:var(--module-bg-dark); }
.hd *{box-sizing:border-box;}
.hd-wrap{max-width:860px;margin:0 auto;padding:clamp(12px,3vw,24px) clamp(12px,4vw,20px) 96px;}

/* ── header ── */
.hd-head{display:flex;gap:14px;align-items:center;padding:16px 0 22px;}
.hd-avatar{width:clamp(38px,10vw,46px);height:clamp(38px,10vw,46px);border-radius:14px;
  flex:0 0 auto;background:linear-gradient(135deg,var(--brand),#7c3aed);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:clamp(18px,5vw,22px);}
.hd-head h1{margin:0;font-size:clamp(1.1rem,4.4vw,1.35rem);font-weight:800;letter-spacing:-.02em;}
.hd-head p{margin:3px 0 0;color:var(--muted);font-size:clamp(.79rem,2.9vw,.86rem);line-height:1.5;}
.hd-back{background:none;border:none;padding:0;margin:0 0 4px;font:inherit;
  font-size:.8rem;font-weight:600;color:var(--brand-dark);cursor:pointer;}
.hd-back:hover{text-decoration:underline;}

/* ── chat ── */
/* The newest reply is scrolled to the top of the viewport (see the effect in
   HelpdeskPage), and the scroll margin is what keeps its heading clear when it
   gets there. Generous, because the platform's own navigation bar is sticky and
   sits over the top ~60px of the page: a smaller margin puts the heading behind
   it, which looks exactly like scrolling to the wrong place. */
.hd-turn,.hd-msg,.hd-head{scroll-margin-top:76px;}
.hd-msg{display:flex;gap:10px;margin-bottom:18px;align-items:flex-start;}
.hd-msg.me{flex-direction:row-reverse;}
.hd-dot{width:28px;height:28px;border-radius:9px;flex:0 0 auto;margin-top:2px;
  display:flex;align-items:center;justify-content:center;font-size:14px;
  background:var(--accent-bg);color:var(--accent-dark);}
.hd-msg.me .hd-dot{background:var(--avatar-bg);color:var(--secondary);}
/* min-width:0 is what lets a wide table inside a bubble scroll in its own box
   instead of pushing the whole page sideways on a phone. */
.hd-bubble{background:var(--surface);border:1px solid var(--line);border-radius:14px;
  padding:clamp(11px,3.4vw,14px) clamp(12px,3.8vw,16px);min-width:0;
  max-width:calc(100% - 44px);box-shadow:0 1px 2px rgba(15,23,42,.04);
  overflow-wrap:anywhere;}
.hd-msg.me .hd-bubble{background:var(--brand);border-color:var(--brand);color:#fff;}
/* The answer wears its module's colour, so a reply is placed at a glance. */
.hd-bubble h2{margin:0 0 10px;font-size:clamp(.95rem,3.6vw,1.02rem);font-weight:750;
  letter-spacing:-.01em;color:var(--accent-dark);
  border-left:3px solid var(--accent);padding-left:9px;}
.hd-bubble p{margin:0 0 10px;line-height:1.62;font-size:clamp(.85rem,3.3vw,.9rem);}
.hd-bubble p:last-child{margin-bottom:0;}

/* ── blocks ── */
.hd-checks{list-style:none;margin:0 0 12px;padding:0;border:1px solid var(--line);
  border-radius:10px;overflow:hidden;}
.hd-checks li{display:flex;gap:10px;padding:9px 12px;font-size:.85rem;line-height:1.5;
  border-bottom:1px solid var(--line);align-items:flex-start;}
.hd-checks li:last-child{border-bottom:none;}
.hd-badge{flex:0 0 auto;width:17px;height:17px;border-radius:50%;margin-top:2px;
  display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;}
.s-ok .hd-badge{background:var(--ok);} .s-ok{background:var(--ok-bg);}
.s-warn .hd-badge{background:var(--warn);} .s-warn{background:var(--warn-bg);}
.s-bad .hd-badge{background:var(--bad);} .s-bad{background:var(--bad-bg);}
.s-info .hd-badge{background:var(--info);} .s-info{background:var(--info-bg);}
.hd-check-label{font-weight:650;margin-right:4px;}
.hd-check-detail{color:var(--detail);}

.hd-steps{margin:0 0 12px;padding-left:20px;font-size:.88rem;line-height:1.65;}
.hd-steps li{margin-bottom:6px;}
.hd-steps li::marker{color:var(--accent);font-weight:700;}
.hd-note{background:var(--warn-bg);border-left:3px solid var(--warn);border-radius:0 8px 8px 0;
  padding:10px 13px;margin:0 0 12px;font-size:.85rem;line-height:1.6;color:var(--warn-text);}

.hd-links{display:flex;flex-direction:column;gap:8px;margin:0 0 12px;}
.hd-link{display:block;border:1px solid var(--line);background:var(--accent-bg);
  border-radius:10px;padding:11px 13px;text-decoration:none;transition:all .12s;}
.hd-link:hover{border-color:var(--accent);}
.hd-link-label{display:block;font-weight:700;font-size:.88rem;color:var(--accent-dark);}
.hd-link-label::after{content:' →';}
.hd-link-desc{display:block;font-size:.8rem;color:var(--secondary);line-height:1.55;margin-top:3px;}

/* Explainer recordings attached to an answer. One column: these are screen
   captures of a full-width UI, and side by side on a laptop each would be too
   small to read the thing it is demonstrating. The accent is inherited from the
   module wrapper, like everything else here, so a quiz video reads as belonging
   to the quiz answer it sits under. */
.hd-videos{display:flex;flex-direction:column;gap:14px;margin:4px 0 12px;}
.hd-video{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;
  background:var(--surface-alt);}
.hd-video-player{display:block;width:100%;aspect-ratio:16/9;background:#000;}
.hd-video-cap{display:block;padding:9px 12px 11px;border-top:1px solid var(--line);
  background:var(--surface);}
.hd-video-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-weight:700;font-size:.86rem;color:var(--accent-dark);}
.hd-video-for{display:inline-block;font-weight:600;font-size:.68rem;letter-spacing:.04em;
  text-transform:uppercase;color:var(--accent-dark);background:var(--accent-bg);
  border:1px solid var(--accent);border-radius:999px;padding:1px 7px;}
.hd-video-sum{display:block;font-size:.8rem;color:var(--secondary);line-height:1.55;
  margin-top:4px;}

.hd-tablewrap{overflow-x:auto;margin:0 0 12px;border:1px solid var(--line);border-radius:10px;
  -webkit-overflow-scrolling:touch;}
.hd-table{border-collapse:collapse;width:100%;font-size:.83rem;min-width:340px;}
.hd-table th{background:var(--surface-alt);text-align:left;padding:8px 11px;font-weight:700;
  border-bottom:1px solid var(--line);white-space:nowrap;}
.hd-table td{padding:8px 11px;border-bottom:1px solid var(--line);line-height:1.5;vertical-align:top;}
.hd-table tr:last-child td{border-bottom:none;}

/* ── the manual shelf ── */
/* One line of links, wrapped, above the conversation. Deliberately quiet: it is
   a shelf to reach for, not the page's subject, so it reads as a row of labels
   rather than as a row of buttons competing with the questions. */
.hd-manuals{margin:0 0 18px;padding:12px 14px;border:1px solid var(--line);
  border-left:4px solid var(--brand);border-radius:12px;background:var(--surface);}
.hd-manuals p{margin:0 0 8px;font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--muted);}
.hd-manuals-list{display:flex;flex-wrap:wrap;gap:6px 14px;}
.hd-manuals a{font-size:.83rem;font-weight:600;color:var(--brand-dark);text-decoration:none;}
.hd-manuals a:hover{text-decoration:underline;}

/* ── the counters ── */
.hd-stats{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:22px;padding-top:14px;
  border-top:1px solid var(--line);}
.hd-stat b{display:block;font-size:1.15rem;font-weight:800;color:var(--ink);
  font-variant-numeric:tabular-nums;line-height:1.2;}
.hd-stat span{font-size:.74rem;color:var(--muted);}

/* ── choices ── */
.hd-group{margin:0 0 18px;}
.hd-group-title{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--accent-dark);margin:0 0 8px;
  display:flex;align-items:center;gap:7px;}
.hd-group-title::before{content:'';width:14px;height:3px;border-radius:2px;background:var(--accent);}
.hd-chips{display:flex;flex-wrap:wrap;gap:8px;}
.hd-chip{background:var(--surface);border:1px solid var(--control-line);border-radius:999px;
  padding:9px 15px;font-size:.85rem;font-weight:600;color:var(--detail);cursor:pointer;
  font-family:inherit;transition:all .12s;text-align:left;max-width:100%;}
.hd-chip:hover:not(:disabled){border-color:var(--accent);color:var(--accent-dark);
  background:var(--accent-bg);}
.hd-chip:disabled{opacity:.5;cursor:not-allowed;}
/* The "n more…" chip is the same shape as a question but is not one, so it
   reads as an action rather than as the last item in the list. */
.hd-chip-more{font-style:italic;color:var(--muted);border-style:dashed;}

.hd-search{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px;}
.hd-search-label{font-size:.78rem;font-weight:700;color:var(--muted);
  text-transform:uppercase;letter-spacing:.04em;}
.hd-search-input{flex:1 1 220px;min-width:0;font:inherit;font-size:.9rem;
  padding:8px 12px;border-radius:999px;border:1px solid var(--control-line);
  background:var(--surface);color:var(--ink);}
.hd-search-input:focus{outline:none;border-color:var(--accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);}
.hd-empty{font-size:.88rem;color:var(--secondary);line-height:1.6;margin:0;}

/* Quiet by design: a question people are reading past, not a demand. */
.hd-rate{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0 0;
  padding:8px 12px;border-radius:10px;background:var(--surface-alt);}
.hd-rate-q{font-size:.82rem;color:var(--secondary);}
.hd-rate-btn{font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;
  padding:3px 14px;border-radius:999px;border:1px solid var(--control-line);
  background:var(--surface);color:var(--secondary);transition:all .12s;}
.hd-rate-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent-dark);}
.hd-rate-btn:disabled{opacity:.5;cursor:not-allowed;}

/* The administrator's report. Plain and dense on purpose: it is read once a
   week by somebody deciding what to rewrite, not browsed. */
.hd-insights{border:1px solid var(--line);border-radius:12px;background:var(--surface);
  padding:16px;margin:0 0 16px;}
.hd-insights-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
  margin:0 0 12px;}
.hd-insights-head h3{margin:0;font-size:1rem;}
.hd-insights-tiles{display:grid;gap:10px;margin:0 0 14px;
  grid-template-columns:repeat(auto-fit,minmax(150px,1fr));}
.hd-tile{background:var(--surface-alt);border-radius:10px;padding:10px 12px;}
.hd-tile-n{display:block;font-size:1.4rem;font-weight:800;font-variant-numeric:tabular-nums;}
.hd-tile-l{display:block;font-size:.74rem;color:var(--muted);line-height:1.4;margin-top:2px;}
.hd-insights-scroll{overflow-x:auto;}
.hd-insights-table{width:100%;border-collapse:collapse;font-size:.8rem;min-width:520px;}
.hd-insights-table th{text-align:left;padding:6px 8px;color:var(--muted);font-size:.72rem;
  text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line);}
.hd-insights-table td{padding:6px 8px;border-bottom:1px solid var(--line);
  font-variant-numeric:tabular-nums;vertical-align:top;}
.hd-insights-table td:first-child{font-variant-numeric:normal;}
/* An answer people read and then abandoned. The queue, marked. */
.hd-insights-table tr.is-flagged td{background:color-mix(in srgb, #ef4444 8%, transparent);}
.hd-insights-q{display:block;color:var(--ink);}
.hd-insights-m{display:block;font-size:.7rem;color:var(--muted);margin-top:1px;}
.hd-insights-notice{display:inline-block;margin-top:3px;padding:0 6px;border-radius:999px;
  background:var(--brand-bg,var(--surface-alt));color:var(--accent-dark);font-size:.65rem;
  font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
.hd-insights-foot{margin:12px 0 0;font-size:.74rem;color:var(--muted);line-height:1.5;}
/* The ask count, for administrators. Deliberately quiet: it is a note on the
   chip for somebody reading the page as a report, not a figure competing with
   the question itself. */
.hd-chip-count{display:inline-block;margin-left:7px;padding:1px 7px;border-radius:999px;
  background:var(--surface-alt);color:var(--muted);font-size:.72em;font-weight:700;
  font-variant-numeric:tabular-nums;}

/* ── action cards ── */
.hd-action{border:1px solid var(--line);border-radius:12px;background:var(--surface);
  padding:14px;margin:0 0 10px;}
.hd-action.primary{border-color:var(--accent);background:linear-gradient(180deg,var(--surface),var(--accent-bg));}
.hd-action h3{margin:0 0 8px;font-size:.92rem;font-weight:750;color:var(--accent-dark);}
.hd-notice{background:var(--info-bg);border:1px solid var(--info-line);border-radius:8px;
  padding:10px 12px;margin:0 0 12px;font-size:.82rem;line-height:1.6;color:var(--info-text);
  display:flex;gap:8px;}
/* Only the mark is fixed-width. The rule used to select every span in the
   notice, which caught the text as well and made it refuse to wrap — a
   two-line notice then ran off the right of a phone screen and took the whole
   document's width with it, so the entire page scrolled sideways. */
.hd-notice span:first-child{flex:0 0 auto;}
.hd-notice span+span{flex:1 1 auto;min-width:0;}
.hd-rooms{position:relative;margin:0 0 14px;}
.hd-rooms-mine{margin:8px 0 0;display:flex;flex-direction:column;gap:6px;}
.hd-rooms-mine-h{font-size:.74rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;}
.hd-rooms-list{list-style:none;margin:6px 0 0;padding:0;border:1px solid var(--line);border-radius:10px;
  background:var(--surface);overflow:hidden;}
.hd-rooms-list li{border-bottom:1px solid var(--line);}
.hd-rooms-list li:last-child{border-bottom:none;}
.hd-room{display:flex;align-items:center;gap:10px;padding:9px 12px;color:inherit;text-decoration:none;}
a.hd-room:hover,.hd-room.is-active{background:var(--accent-bg);}
.hd-room-pin{flex:none;font-size:1rem;}
.hd-room-main{flex:1 1 auto;min-width:0;}
.hd-room-name{display:block;font-weight:700;font-size:.9rem;}
.hd-room-where{display:block;font-size:.78rem;color:var(--muted);overflow-wrap:anywhere;}
.hd-room-go{flex:none;font-size:.78rem;font-weight:700;color:var(--accent-dark);}
.hd-room.no-map .hd-room-go{color:var(--muted);font-weight:400;}
.hd-rooms-empty{font-size:.82rem;color:var(--muted);margin:6px 0 0;}
.hd-field{margin:0 0 10px;}
.hd-field label{display:block;font-size:.78rem;font-weight:700;margin-bottom:4px;color:var(--detail);}
.hd-field .hd-help{display:block;font-weight:400;color:var(--muted);margin-top:2px;font-size:.75rem;}
.hd-input{width:100%;border:1px solid var(--control-line);border-radius:8px;padding:10px 11px;
  font-size:.88rem;font-family:inherit;color:var(--ink);background:var(--surface);}
textarea.hd-input{min-height:120px;resize:vertical;line-height:1.6;}
.hd-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--focus-ring);}
.hd-btn{background:var(--accent);color:#fff;border:none;border-radius:9px;
  padding:11px 18px;font-size:.87rem;font-weight:700;cursor:pointer;font-family:inherit;}
.hd-btn:hover:not(:disabled){filter:brightness(.93);}
.hd-btn:disabled{opacity:.55;cursor:not-allowed;}
.hd-btn.ghost{background:var(--surface);color:var(--detail);border:1px solid var(--control-line);}
.hd-btn.ghost:hover:not(:disabled){background:var(--surface-alt);filter:none;}
.hd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}

.hd-error{background:var(--bad-bg);border:1px solid var(--bad-line);color:var(--bad-text);
  border-radius:8px;padding:9px 12px;font-size:.83rem;margin:0 0 10px;line-height:1.55;}

/* A question, so it is amber rather than the red of .hd-error — nothing has
   gone wrong and the address may well be the one they meant. Both colours come
   from the tokens above, so this reads correctly in dark mode too. */
.hd-confirm{background:var(--warn-bg);border:1px solid var(--warn);color:var(--warn-text);
  border-radius:8px;padding:11px 13px;margin:0 0 10px;}
.hd-confirm p{margin:0 0 11px;color:inherit;font-size:.84rem;line-height:1.55;}

/* ── gate ── */
.hd-gate{background:var(--surface);border:1px solid var(--line);border-radius:16px;
  padding:clamp(16px,4.5vw,22px);box-shadow:0 1px 3px rgba(15,23,42,.05);}
.hd-gate h2{margin:0 0 6px;font-size:clamp(1rem,3.8vw,1.05rem);font-weight:780;}
.hd-gate p{margin:0 0 14px;color:var(--muted);font-size:clamp(.82rem,3.1vw,.86rem);line-height:1.6;}
.hd-otp{letter-spacing:clamp(.18em,4vw,.42em);font-size:clamp(1.05rem,5vw,1.18rem);
  font-weight:700;text-align:center;font-variant-numeric:tabular-nums;}
.hd-preview{margin-top:22px;}
.hd-preview h3{font-size:.7rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--muted);margin:0 0 10px;}
.hd-preview-list{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));}
.hd-preview-item{border:1px solid var(--line);border-left:4px solid var(--accent);
  border-radius:10px;padding:9px 11px;font-size:.82rem;font-weight:650;color:var(--accent-dark);}

.hd-typing{display:inline-flex;gap:4px;padding:4px 0;}
.hd-typing i{width:6px;height:6px;border-radius:50%;background:#94a3b8;
  animation:hd-blink 1.3s infinite;}
.hd-typing i:nth-child(2){animation-delay:.18s;}
.hd-typing i:nth-child(3){animation-delay:.36s;}
@keyframes hd-blink{0%,60%,100%{opacity:.25;}30%{opacity:1;}}

.hd-foot{margin-top:26px;padding-top:14px;border-top:1px solid var(--line);
  font-size:.78rem;color:var(--muted);line-height:1.6;display:flex;
  justify-content:space-between;gap:12px;flex-wrap:wrap;overflow-wrap:anywhere;}
.hd-foot a{color:var(--brand-dark);}
.hd-foot button{background:none;border:none;color:var(--brand-dark);cursor:pointer;
  font:inherit;text-decoration:underline;padding:0;}

/* ── the "still looking?" prompt ── */
.hd-nudge-back{position:fixed;inset:0;z-index:50;background:rgba(15,23,42,.45);
  display:flex;align-items:center;justify-content:center;padding:16px;}
.hd-nudge{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;
  max-width:420px;width:100%;padding:18px 18px 16px;box-shadow:0 18px 40px rgba(15,23,42,.25);}
.hd-nudge h2{margin:0 0 6px;font-size:1.02rem;}
.hd-nudge p{margin:0 0 14px;font-size:.88rem;line-height:1.55;color:var(--secondary);}
.hd-nudge .hd-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}

@media (max-width:640px){
  .hd-bubble{max-width:100%;}
  /* 16px or iOS zooms the page the moment a field takes focus, which leaves
     the form half off screen and the visitor pinching to get back. */
  .hd-input{font-size:16px;}
  /* A row of buttons that would wrap to two lines reads better as two
     full-width buttons than as one and a half. */
  .hd-row .hd-btn{flex:1 1 auto;}
  .hd-msg{gap:8px;}
}
@media (prefers-reduced-motion:reduce){
  .hd-typing i{animation:none;opacity:.55;}
}
`;

/**
 * The manuals, for the people they are written for.
 *
 * Every one of these is a staff document: how to run a class, an event, a
 * timetable, an attendance session. Shown at the top for a member of staff,
 * because on this page they are frequently the whole answer — somebody asking
 * how to issue certificates wants the certificate manual more than they want a
 * lookup. Withheld from a student, for whom they are three screens of noise
 * above the question they came to ask.
 *
 * Paths, not descriptions: each is a real route on this platform, all of them
 * public (they are onboarding documents for people who may not have an account
 * yet), so a link here needs no permission of its own.
 */
const MANUALS = [
  { href: '/learning/manual', label: 'Learning module — getting started' },
  { href: '/learning/setupmanual', label: 'Setting up a class' },
  { href: '/learning/assignmentmanual', label: 'Assignments' },
  { href: '/learning/quizmanual', label: 'Quizzes and tests' },
  { href: '/learning/codingmanual', label: 'Coding questions' },
  { href: '/learning/tutorialmanual', label: 'Tutorials' },
  { href: '/learning/shortsmanual', label: 'Shorts' },
  { href: '/learning/formsmanual', label: 'Forms' },
  { href: '/tt-manual', label: 'Timetable' },
  { href: '/ams-manual', label: 'Attendance (iLEED)' },
  { href: '/certificate-manual', label: 'Certificates' },
  { href: '/conference-manual', label: 'Conferences' },
];

/* ── the modules ──────────────────────────────────────────────────────────
   The categories come from the server, which owns what the page can answer.
   What belongs here is only how each one *looks*: one colour, which the card,
   its chips and the answers they produce all inherit. The map is keyed by the
   category's name for exactly one reason — a module added on the server has to
   appear on this page whether or not anybody remembers to come back here — so
   an unknown name falls back to the house indigo rather than disappearing. */

const MODULE_STYLE = {
  'Account and registration': {
    accent: '#4f46e5', heading: '#4338ca', bg: '#eef2ff', darkHeading: '#a5b4fc', darkBg: '#252a52',
  },
  'Learning module': {
    accent: '#059669', heading: '#047857', bg: '#ecfdf5', darkHeading: '#6ee7b7', darkBg: '#12372e',
  },
  Timetable: {
    accent: '#d97706', heading: '#b45309', bg: '#fffbeb', darkHeading: '#fcd34d', darkBg: '#3b2a16',
  },
  Attendance: {
    accent: '#0284c7', heading: '#0369a1', bg: '#f0f9ff', darkHeading: '#7dd3fc', darkBg: '#153349',
  },
  Certificates: {
    accent: '#7c3aed', heading: '#6d28d9', bg: '#f5f3ff', darkHeading: '#c4b5fd', darkBg: '#30234e',
  },
  Conferences: {
    accent: '#e11d48', heading: '#be123c', bg: '#fff1f2', darkHeading: '#fda4af', darkBg: '#3d2027',
  },
  'XCEED team': {
    accent: '#0d9488', heading: '#0f766e', bg: '#f0fdfa', darkHeading: '#5eead4', darkBg: '#133834',
  },
};

const DEFAULT_STYLE = MODULE_STYLE['Account and registration'];

const styleFor = (category) => MODULE_STYLE[category] || DEFAULT_STYLE;

/** Both palettes live on the module wrapper; CSS selects the heading and tint
 *  for the document's theme. The solid accent stays suitable for white buttons. */
const accentVars = (category) => {
  const style = styleFor(category);
  return {
    '--module-accent': style.accent,
    '--module-heading': style.heading,
    '--module-bg': style.bg,
    '--module-heading-dark': style.darkHeading,
    '--module-bg-dark': style.darkBg,
  };
};

/**
 * Every question, grouped by module — and once one has been asked, the rest of
 * that module.
 *
 * Both halves are deliberate. Cards alone, with the questions hidden until a
 * card was opened, meant a visitor had to guess which module their problem
 * belonged to before they could see a single question, and guessing wrong cost
 * two clicks to find out. The questions are short and there are not that many
 * of them: showing them all, under the module they belong to, lets somebody
 * recognise their own problem rather than classify it.
 *
 * After an answer, the list narrows to the module just asked about — because
 * the second question is nearly always next door to the first, and forty
 * questions under an answer buries it. One button widens it back out again.
 */
/* How many questions a module shows before it offers the rest.
   The Learning module carries fifteen and Conferences carries one; a wall of
   chips is the cost of that imbalance, paid by every module. The menu is
   already ordered most-asked-first, so the cut is not arbitrary — what is
   hidden is what nobody asks. */
const CHIPS_BEFORE_MORE = 8;

/* After this many questions in one session, somebody is probably hunting
   rather than reading: first the search bar is suggested, then the XCEED team.
   Each prompt is shown once per session and "Continue" always carries on. */
const NUDGE_SEARCH_AFTER = 5;
const NUDGE_TEAM_AFTER = 10;

const NUDGES = {
  search: {
    title: 'Looking for something specific?',
    text: 'You have opened quite a few questions. Typing a word or two into the search bar — "roll number", "timetable", "code" — finds the right one faster.',
    go: 'Use the search bar',
  },
  team: {
    title: 'Still not finding it?',
    text: 'If none of these answers has what you need, the XCEED team can take a look. Your message reaches them with your account details and the questions you have already opened attached.',
    go: 'Email the XCEED team',
  },
};

/** The prompt itself: a small dialog with its action and "Continue". Escape
 *  and a click on the backdrop both mean "Continue". */
function Nudge({ kind, onGo, onClose }) {
  const goRef = useRef(null);
  useEffect(() => {
    goRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = NUDGES[kind];
  return (
    <div className="hd-nudge-back" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="hd-nudge" role="dialog" aria-modal="true" aria-labelledby="hd-nudge-title">
        <h2 id="hd-nudge-title">{copy.title}</h2>
        <p>{copy.text}</p>
        <div className="hd-row">
          <button className="hd-btn ghost" type="button" onClick={onClose}>
            Continue
          </button>
          <button className="hd-btn" type="button" ref={goRef} onClick={onGo}>
            {copy.go}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Matches a question the way somebody skimming would: all the words, any order. */
const matches = (question, query) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = question.toLowerCase();
  return words.every((word) => haystack.includes(word));
};

function QuestionMenu({ menu, open, onOpen, onAsk, busy, asked, counts, query }) {
  const chip = (topic) => (
    <button
      className="hd-chip"
      key={topic.id}
      type="button"
      disabled={busy}
      onClick={() => onAsk(topic)}
      /* The count as a description rather than part of the name: the button is
         still "Am I registered?", and the number is what it is worth knowing
         about it. */
      title={counts ? `Asked ${counts[topic.id] || 0} time(s)` : undefined}
    >
      {topic.question}
      {/* Administrators only — `counts` is null for everybody else. The number
          is what the menu is already ordered by, so the chips read in the order
          the numbers explain. */}
      {counts ? (
        <span className="hd-chip-count" aria-hidden="true">
          {counts[topic.id] || 0}
        </span>
      ) : null}
    </button>
  );

  const group = open ? menu.find((entry) => entry.category === open) : null;
  /* The question just answered is not offered again: it is on screen directly
     above, and a chip that re-asks it reads as a broken one. */
  const rest = group ? group.topics.filter((topic) => topic.id !== asked) : [];

  /* ── searching ────────────────────────────────────────────────────────────
     A search crosses the modules. Somebody typing "roll number" does not know
     whether that lives under Attendance or the Learning module — that is the
     whole reason they are typing rather than browsing — so the module cards
     are set aside while a query is live and the matches are listed flat. */
  if (query) {
    const hits = menu
      .flatMap((entry) => entry.topics.map((topic) => ({ ...topic, category: entry.category })))
      .filter((topic) => matches(topic.question, query));

    if (!hits.length) {
      return (
        <div className="hd-group">
          <p className="hd-group-title">Nothing matches “{query}”</p>
          <p className="hd-empty">
            Try a word from the problem rather than the page — “code”, “roll number”, “timetable”.
            Or clear the box and pick a module; if none of them fit, the last card on the page
            sends your question to a person.
          </p>
        </div>
      );
    }

    return (
      <div className="hd-group">
        <p className="hd-group-title">
          {hits.length} question{hits.length === 1 ? '' : 's'} matching “{query}”
        </p>
        <div className="hd-chips">{hits.map(chip)}</div>
      </div>
    );
  }

  /* A module with nothing left in it — Conferences has one question — falls
     back to everything rather than to an empty heading. */
  if (!group || !rest.length) {
    return (
      <div>
        {menu.map((entry) => (
          <QuestionGroup
            key={entry.category}
            entry={entry}
            chip={chip}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="hd-group hd-module" style={accentVars(open)}>
      <p className="hd-group-title">More about {open.toLowerCase()}</p>
      <div className="hd-chips">{rest.map(chip)}</div>
      <div className="hd-row" style={{ marginTop: 12 }}>
        <button className="hd-btn ghost" type="button" onClick={() => onOpen('')}>
          Show every question
        </button>
      </div>
    </div>
  );
}

/**
 * One module's questions, capped.
 *
 * Every question of every module at once is forty-one chips, and the modules
 * are lopsided — fifteen under the Learning module, one under Conferences — so
 * the wall is really one module's doing and all of them pay for it. The menu
 * arrives ordered most-asked-first, so showing the first few and offering the
 * rest hides what nobody asks rather than an arbitrary tail.
 */
function QuestionGroup({ entry, chip, onOpen }) {
  const [all, setAll] = useState(false);
  const hidden = entry.topics.length - CHIPS_BEFORE_MORE;
  const shown = all ? entry.topics : entry.topics.slice(0, CHIPS_BEFORE_MORE);

  return (
    <div className="hd-group hd-module" style={accentVars(entry.category)}>
      <p className="hd-group-title">{entry.category}</p>
      <div className="hd-chips">
        {shown.map(chip)}
        {hidden > 0 && !all ? (
          <button className="hd-chip hd-chip-more" type="button" onClick={() => setAll(true)}>
            {hidden} more…
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ── block renderers ────────────────────────────────────────────────────── */

const STATE_MARK = { ok: '✓', warn: '!', bad: '✕', info: 'i' };

/* ── classroom search ───────────────────────────────────────────────────── */

/** Only http(s) map links become anchors. The server already drops anything
 *  else (see timetableOptionsController.safeMapLink); checked again here
 *  because this is the line that puts it in an href. */
const safeMapUrl = (value) => (/^https?:\/\//i.test(String(value || '').trim()) ? String(value).trim() : '');

/** Case, spaces and dashes folded, so "lt1", "LT 1" and "LT-1" all find LT-1. */
const roomFold = (value) => String(value || '').toLowerCase().replace(/[\s\-_.]/g, '');

const ROOM_SUGGESTIONS = 8;

function RoomRow({ room, label, active, id, option = false }) {
  const mapUrl = safeMapUrl(room.mapUrl);
  const where = [room.building, room.floor && `Floor ${room.floor}`].filter(Boolean).join(' · ');
  const body = (
    <>
      <span className="hd-room-pin" aria-hidden="true">
        📍
      </span>
      <span className="hd-room-main">
        <span className="hd-room-name">{room.room}</span>
        {label || where ? <span className="hd-room-where">{[label, where].filter(Boolean).join(' — ')}</span> : null}
      </span>
      <span className="hd-room-go">{mapUrl ? 'Open map ↗' : 'No location recorded'}</span>
    </>
  );
  const className = `hd-room${active ? ' is-active' : ''}${mapUrl ? '' : ' no-map'}`;
  return (
    <li {...(option ? { role: 'option', id, 'aria-selected': Boolean(active) } : {})}>
      {mapUrl ? (
        /* Straight to Google Maps, in a new tab so the answer is still here
           when the reader comes back. */
        <a className={className} href={mapUrl} target="_blank" rel="noopener noreferrer">
          {body}
        </a>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

/**
 * Type a room, get suggestions, open the map.
 *
 * The whole room list (a few hundred rows) is fetched once when the answer is
 * shown and filtered here on every keystroke, so suggestions keep up with
 * typing on a slow connection and the server sees one request, not one per key.
 * Before anything is typed, the rooms of the reader's own classes are offered.
 */
function RoomSearch({ block, call }) {
  const [rooms, setRooms] = useState(null);
  const [failed, setFailed] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const listId = useRef(`hd-rooms-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    let live = true;
    call(`${API}/rooms`)
      .then((data) => live && setRooms(Array.isArray(data.rooms) ? data.rooms : []))
      .catch((error) => live && setFailed(error.message || 'The room list could not be loaded.'));
    return () => {
      live = false;
    };
  }, [call]);

  const folded = roomFold(query);
  const matches =
    rooms && folded
      ? rooms
          .filter((room) => roomFold(room.room).includes(folded) || roomFold(room.building).includes(folded))
          // Names that start with what was typed first: "LT1" before "CLT12".
          .sort((a, b) => Number(!roomFold(a.room).startsWith(folded)) - Number(!roomFold(b.room).startsWith(folded)))
          .slice(0, ROOM_SUGGESTIONS)
      : [];

  const mine = (block.mine || []).map((row) => {
    const known = (rooms || []).find((room) => roomFold(room.room) === roomFold(row.room));
    return { room: known || { room: row.room }, label: row.label };
  });

  const onKeyDown = (event) => {
    if (!matches.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % matches.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index <= 0 ? matches.length - 1 : index - 1));
    } else if (event.key === 'Enter') {
      const pick = matches[active >= 0 ? active : 0];
      const mapUrl = pick && safeMapUrl(pick.mapUrl);
      if (mapUrl) {
        event.preventDefault();
        window.open(mapUrl, '_blank', 'noopener,noreferrer');
      }
    } else if (event.key === 'Escape') {
      setQuery('');
      setActive(-1);
    }
  };

  return (
    <div className="hd-rooms">
      <input
        className="hd-input"
        type="search"
        role="combobox"
        aria-label="Search for a classroom"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && matches[active] ? `${listId}-${active}` : undefined}
        placeholder="Type a room, e.g. LT1, 205 or a block name"
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />

      {failed ? <p className="hd-rooms-empty">{failed}</p> : null}
      {!failed && folded && !rooms ? <p className="hd-rooms-empty">Loading rooms…</p> : null}
      {rooms && folded && !matches.length ? (
        <p className="hd-rooms-empty">No room matches “{query}”. Try just the number, or the block name.</p>
      ) : null}

      {matches.length ? (
        <ul className="hd-rooms-list" role="listbox" id={listId}>
          {matches.map((room, index) => (
            <RoomRow key={room.room} room={room} option active={index === active} id={`${listId}-${index}`} />
          ))}
        </ul>
      ) : null}

      {!folded && mine.length ? (
        <div className="hd-rooms-mine">
          <span className="hd-rooms-mine-h">Your classes</span>
          <ul className="hd-rooms-list">
            {mine.map((row) => (
              <RoomRow key={row.room.room} room={row.room} label={row.label} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Block({ block, call }) {
  if (block.type === 'text') return <p>{block.text}</p>;

  if (block.type === 'roomSearch') return <RoomSearch block={block} call={call} />;

  if (block.type === 'note') {
    return <div className="hd-note">{block.text}</div>;
  }

  if (block.type === 'steps') {
    return (
      <ol className="hd-steps">
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }

  if (block.type === 'checks') {
    return (
      <ul className="hd-checks">
        {block.items.map((item, i) => (
          <li key={i} className={`s-${item.state || 'info'}`}>
            <span className="hd-badge" aria-hidden="true">
              {STATE_MARK[item.state] || 'i'}
            </span>
            <span>
              <span className="hd-check-label">{item.label}:</span>
              <span className="hd-check-detail">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === 'links') {
    /* Ordinary same-tab navigation. These only ever point inside this app — the
       server drops any href that is not site-relative (see blocks.js) — so
       there is no target/rel dance to do, and staying in the tab means the back
       button returns the reader to their answer. */
    return (
      <div className="hd-links">
        {block.items.map((item) => (
          <a className="hd-link" href={item.href} key={item.href}>
            <span className="hd-link-label">{item.label}</span>
            {item.description ? <span className="hd-link-desc">{item.description}</span> : null}
          </a>
        ))}
      </div>
    );
  }

  if (block.type === 'videos') {
    /* preload="none" on every one of these, deliberately.
    
       An answer can carry two recordings and they are 8-17 MB apiece. Letting
       the browser fetch even metadata for each on render would put tens of
       megabytes on the wire for a reader who came for the checks above and
       will never press play — on a phone, on a corridor connection, which is
       where this page gets read. The poster frame costs a click; the bandwidth
       does not.
    
       `src` is site-relative and the server enforces it (see blocks.js), so
       on the web these load from the same origin as the page. mediaUrl
       returns it unchanged there; the app anchors it to the API host, as it
       does on ExplainersPage. */
    return (
      <div className="hd-videos">
        {block.items.map((item) => (
          <figure className="hd-video" key={item.src}>
            <video className="hd-video-player" controls preload="none" playsInline>
              <source src={mediaUrl(item.src)} type="video/mp4" />
              Your browser cannot play this video.{' '}
              <a href={mediaUrl(item.src)}>Download it instead.</a>
            </video>
            <figcaption className="hd-video-cap">
              <span className="hd-video-title">
                {item.title}
                {item.audience ? (
                  <span className="hd-video-for">{item.audience}</span>
                ) : null}
              </span>
              {item.summary ? (
                <span className="hd-video-sum">{item.summary}</span>
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      /* Its own horizontal scroller. A three-column table of class names on a
         phone is the one thing on this page wide enough to push the whole
         layout sideways if left to itself. */
      <div className="hd-tablewrap">
        <table className="hd-table">
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

/**
 * One action, with whatever fields it declared.
 *
 * The form is built from the server's field list rather than written out per
 * action, so adding an action server-side needs no change here. `notice` is
 * rendered above the fields deliberately: an advisory about which mailbox is
 * about to be committed to is worth nothing underneath the button.
 */
function ActionCard({ action, busy, onRun }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries((action.fields || []).map((field) => [field.name, ''])),
  );
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const missing = (action.fields || []).find((field) => field.required && !values[field.name]?.trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setError('');
    onRun(action, values);
  };

  return (
    <form className={`hd-action ${action.kind === 'primary' ? 'primary' : ''}`} onSubmit={submit}>
      <h3>{action.label}</h3>
      {action.notice ? (
        <div className="hd-notice">
          <span aria-hidden="true">✉</span>
          <span>{action.notice}</span>
        </div>
      ) : null}
      {(action.fields || []).map((field) => (
        <div className="hd-field" key={field.name}>
          <label htmlFor={`${action.id}-${field.name}`}>
            {field.label}
            {field.help ? <span className="hd-help">{field.help}</span> : null}
          </label>
          {field.type === 'select' ? (
            <select
              id={`${action.id}-${field.name}`}
              className="hd-input"
              value={values[field.name]}
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
            >
              <option value="">Select…</option>
              {(field.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              id={`${action.id}-${field.name}`}
              className="hd-input"
              rows={6}
              placeholder={field.placeholder || ''}
              value={values[field.name]}
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
            />
          ) : (
            <input
              id={`${action.id}-${field.name}`}
              className="hd-input"
              /* `password` for the two fields that set one, so a new password
                 is not read over a shoulder in a computer lab — which is where
                 a good half of this page's traffic is. Anything else is a
                 single-line text box; `autoComplete` is off throughout, because
                 every field here is a one-time value and a browser offering to
                 remember a six-digit code helps nobody. */
              type={field.type === 'password' ? 'password' : 'text'}
              autoComplete={field.type === 'password' ? 'new-password' : 'off'}
              placeholder={field.placeholder || ''}
              value={values[field.name]}
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
            />
          )}
        </div>
      ))}
      {error ? <div className="hd-error">{error}</div> : null}
      <button className="hd-btn" type="submit" disabled={busy}>
        {busy ? 'Working…' : action.label}
      </button>
    </form>
  );
}

/** The questions asked so far, as one line, to travel with a message to a
 *  person. Capped: this is context for a human reader, not a transcript. */
const askedSoFar = (thread) =>
  thread
    .filter((message) => message.side === 'me')
    .map((message) => message.text)
    .join(' · ')
    .slice(0, 600);

/**
 * What the help desk knows about itself, for an administrator.
 *
 * The counts on the chips answer "which questions does this page carry". They
 * do not answer the question worth asking, which is whether it is carrying
 * them well — and by count alone a popular answer and a useless one look
 * identical. Three things separate them, and they are put side by side here
 * because each is misleading on its own:
 *
 *  - **Asked** in total, and in the last N days. Forty over two years and
 *    forty since Tuesday are the same total and different facts.
 *  - **Gave up** — read this answer, then wrote to a human anyway. An answer
 *    that fails does it here, and nowhere else the page can see.
 *  - **Rated** — what the readers said when asked outright.
 *
 * Sorted by gave-up first, because that is the queue: the answer most often
 * read and then abandoned is the one to rewrite next, whatever its total.
 */
function Insights({ data, menu, onClose }) {
  const titles = Object.fromEntries(
    menu.flatMap((group) => group.topics.map((topic) => [topic.id, topic.question])),
  );
  const moduleOf = Object.fromEntries(
    menu.flatMap((group) => group.topics.map((topic) => [topic.id, group.category])),
  );

  const rows = Object.keys(titles)
    .map((id) => ({
      id,
      question: titles[id],
      module: moduleOf[id],
      asked: data.counts?.[id] || 0,
      recent: data.recent?.[id] || 0,
      missed: data.misses?.[id] || 0,
      helpful: data.feedback?.[id]?.helpful || 0,
      notHelpful: data.feedback?.[id]?.notHelpful || 0,
      notice: data.notices?.[id] || null,
    }))
    /* Everything, not just what has been asked: a question nobody has ever
       asked is itself a finding — either nobody has that problem, or nobody
       can find the question. */
    .sort((a, b) => b.missed - a.missed || b.notHelpful - a.notHelpful || b.asked - a.asked);

  const funnel = data.funnel || {};

  return (
    <div className="hd-insights">
      <div className="hd-insights-head">
        <h3>How this page is doing</h3>
        <button className="hd-btn ghost" type="button" onClick={onClose}>
          Hide
        </button>
      </div>

      <div className="hd-insights-tiles">
        <div className="hd-tile">
          <span className="hd-tile-n">{data.total ?? 0}</span>
          <span className="hd-tile-l">answers served, all time</span>
        </div>
        <div className="hd-tile">
          <span className="hd-tile-n">{funnel.requested ?? 0}</span>
          <span className="hd-tile-l">codes asked for, last {data.windowDays} days</span>
        </div>
        <div className="hd-tile">
          <span className="hd-tile-n">
            {/* Null, not nought, when nobody reached the gate — "nobody
                finished" and "nobody arrived" are different facts and a bare
                0% says the first while meaning the second. */}
            {funnel.completion === null || funnel.completion === undefined
              ? '—'
              : `${funnel.completion}%`}
          </span>
          <span className="hd-tile-l">
            got through the code step ({funnel.verified ?? 0} of {funnel.requested ?? 0})
          </span>
        </div>
      </div>

      <div className="hd-insights-scroll">
        <table className="hd-insights-table">
          <thead>
            <tr>
              <th>Question</th>
              <th>Asked</th>
              <th>Last {data.windowDays}d</th>
              <th>Gave up</th>
              <th>Helped</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.missed ? 'is-flagged' : undefined}>
                <td>
                  <span className="hd-insights-q">{row.question}</span>
                  <span className="hd-insights-m">{row.module}</span>
                  {row.notice ? <span className="hd-insights-notice">notice</span> : null}
                </td>
                <td>{row.asked}</td>
                <td>{row.recent}</td>
                {/* The number that orders this table: read, then wrote to a
                    person anyway. */}
                <td>{row.missed || ''}</td>
                <td>
                  {row.helpful || row.notHelpful ? (
                    <span title={`${row.helpful} yes, ${row.notHelpful} no`}>
                      {row.helpful}/{row.helpful + row.notHelpful}
                    </span>
                  ) : (
                    ''
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hd-insights-foot">
        None of these numbers record who asked — one row per question for the whole
        installation. “Gave up” counts the answers somebody read immediately before writing
        to the XCEED team.
      </p>
    </div>
  );
}

/* ── the page ───────────────────────────────────────────────────────────── */

export default function HelpdeskPage() {
  const [menu, setMenu] = useState([]);
  /* null until the counts endpoint answers, and null for ever for everybody it
     refuses — which is how the page knows not to draw them. */
  const [askCounts, setAskCounts] = useState(null);
  /* The whole insights payload behind those counts: the recent window, the
     answers people gave up on, the ratings, and the front-door funnel. Held
     separately from `askCounts` because the chips want one number and the
     report wants all of them. */
  const [insights, setInsights] = useState(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  /* `checking` is the very first stage: a visitor who is already signed in gets
     a pass without an email round trip (see the probe below), and rendering the
     address form for the moment that takes would ask a signed-in user for the
     address the server already knows. */
  const [stage, setStage] = useState('checking'); // checking → email → code → chat
  const [email, setEmail] = useState('');
  /* In memory only, never localStorage — see the note at the top of the file. */
  const [pass, setPass] = useState('');
  const [otp, setOtp] = useState('');
  const [gateNote, setGateNote] = useState('');
  /* The "are you sure?" the server sends back the first time a personal address
     is entered, and null the rest of the time. Held as the question itself
     rather than as a boolean so the address it names is the one the server
     normalised, not the one still sitting in the input. */
  const [nonInstituteAsk, setNonInstituteAsk] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  /* Whether the pass came from a platform session rather than an emailed code.
     Only the wording differs — "signed in as" reads oddly for someone who typed
     a code, and "verified" reads oddly for someone who never saw one. */
  const [fromLogin, setFromLogin] = useState(false);
  /* Which module's questions are showing, and which module the conversation is
     currently in — the second is what colours the replies, and it outlives the
     first because a reader may close the card list while reading the answer. */
  const [openModule, setOpenModule] = useState('');
  const [category, setCategory] = useState('');
  /* The question just answered, so the list of what to ask next does not offer
     it back. */
  const [lastAsked, setLastAsked] = useState('');
  /* The "still looking?" prompt: which one is open, how many questions have
     been asked this session, and which prompts have already been shown. Refs
     for the last two, since they are read inside askTopic and never drawn. */
  const [nudge, setNudge] = useState('');
  const askedCountRef = useRef(0);
  const nudgedRef = useRef({ search: false, team: false });
  const searchRef = useRef(null);
  /* A question named in the URL — /help?topic=no-account.
     Read once, at mount, and held until the gate opens: a link in a support
     reply or a manual arrives before anybody has verified an address, and
     the point of the link is that it survives that. Cleared as it is asked,
     so a back-navigation does not ask it again. */
  const [pendingTopic, setPendingTopic] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('topic') || '';
    } catch {
      return '';
    }
  });

  /* What is typed into the search box above the questions. Held here rather
     than in QuestionMenu so that asking a question can clear it — the answer
     is the thing being looked for, and leaving the query live would bury it
     under its own search results. */
  const [query, setQuery] = useState('');
  /* Whether this account is a member of staff, which decides one thing: whether
     the manuals are offered at the top. Answered by the server on the way in,
     so the page never guesses from an address. */
  const [isStaff, setIsStaff] = useState(false);
  /* People, sessions and answers — three integers about the page itself, shown
     at the foot of it. */
  const [stats, setStats] = useState(null);
  /* The newest turn in the thread, so it can be brought to the top of the
     screen. Attached where the message is rendered rather than looked up by
     index afterwards: the node is in place by the time the effect below runs,
     which is the render that added the message. */
  const latestRef = useRef(null);
  /* The page header, which is where the gate screens start. */
  const headRef = useRef(null);

  /* Re-read after each exchange rather than only on arrival: the question just
     asked is one of the answers being counted, and a number that visibly moves
     is the difference between a statistic and a live one. Open, like the menu,
     and cheap. */
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/stats`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        /* Normalised on arrival rather than trusted: a reply that is missing a
           field — an older server, a proxy that swallowed it — must leave the
           footer off, not take the page down on `undefined.toLocaleString()`. */
        if (cancelled || !data) return;
        const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
        const people = count(data.people);
        const sessions = count(data.sessions);
        const answered = count(data.answered);
        if (people === null || sessions === null || answered === null) return;
        setStats({ people, sessions, answered });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [thread.length, stage]);

  useEffect(() => {
    fetch(`${API}/menu`)
      .then((response) => response.json())
      .then((data) => setMenu(data.menu || []))
      .catch(() => setMenu([]));
  }, []);

  /* How often each question has been asked, for administrators.
     The request itself is the check: the route is behind checkRole(['admin']),
     so a refusal means "not an administrator" and there is nothing to ask
     anybody. A visitor with no session gets a 401 here and a page identical to
     the one they have always had. */
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/topic-counts`, { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        /* The shape, not just the status. A 200 carrying something else — a
           proxy's error page, a stub — is not an administrator's counts, and
           treating it as one would draw a nought beside every question for a
           visitor who is not one. */
        if (!cancelled && data && data.counts && typeof data.counts === 'object') {
          setAskCounts(data.counts);
          setInsights(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The signed-in shortcut.
   *
   * A visitor who is already signed in has proved rather more than a mailbox,
   * so mailing them a code to prove it again is a delay and an extra step for
   * no gain. The server issues a pass straight off the platform session (see
   * `sessionFromLogin`), scoped to the address on that account and nothing
   * else. Anonymous visitors — the page's main audience — get a 401 here and
   * the ordinary gate, which is the path this page was built around.
   */
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/session`, { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) throw new Error('not signed in');
        return response.json();
      })
      .then((data) => {
        if (cancelled || !data?.pass) throw new Error('not signed in');
        setPass(data.pass);
        setEmail(data.email || '');
        setIsStaff(Boolean(data.isStaff));
        setFromLogin(true);
        setStage('chat');
        setThread([
          {
            side: 'bot',
            title: `You are signed in as ${data.email}`,
            blocks: [
              {
                type: 'text',
                text: 'No code needed — everything I tell you from here is about that address and only that address. Pick the question that fits best.',
              },
            ],
            actions: [],
            followUps: [],
          },
        ]);
      })
      .catch(() => {
        if (!cancelled) setStage('email');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Where the page sits after each reply.
   *
   * The newest answer is brought to the *top* of the screen, not the bottom.
   * Answers here run long — a checklist, a table, an action card — so scrolling
   * to the end of the thread landed the reader on the last line of something
   * they had not read a word of, with its heading somewhere above the viewport.
   * A reply starts at its beginning. The chip list underneath is where a reader
   * goes next, and it is a scroll away by design rather than by accident.
   */
  useEffect(() => {
    /* The gate is one short card, so its own top is the top of the page. */
    const target = stage === 'chat' ? latestRef.current : headRef.current;
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [thread, stage]);

  /** Every authenticated call. The pass rides its own header; `main.jsx` adds
   *  `X-App-Name`, which is what satisfies the server's CSRF check. */
  const call = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(pass ? { 'X-Helpdesk-Pass': pass } : {}),
          ...(options.headers || {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const failure = new Error(data.message || 'Something went wrong. Please try again.');
        failure.status = response.status;
        /* Carried onto the error because it is the one non-2xx reply that is a
           question rather than a fault — see `requestCode`. */
        failure.confirmNonInstitute = Boolean(data.confirmNonInstitute);
        throw failure;
      }
      return data;
    },
    [pass],
  );

  /**
   * Asks for the code.
   *
   * `confirmed` is the second pass at a personal address: the server answers
   * the first one with a question instead of a code (see `requestCode` in
   * helpdeskController.js), and this sends it back with the answer. Asked once
   * per address — `nonInstituteAsk` is cleared on the way through, so somebody
   * who has said yes is not asked again when the code needs resending.
   */
  const requestCode = async (event, confirmed = false) => {
    event?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      const data = await call(`${API}/code`, {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          ...(confirmed ? { confirmNonInstitute: true } : {}),
        }),
      });
      setNonInstituteAsk(null);
      setGateNote(data.message);
      setStage('code');
    } catch (failure) {
      /* Not an error — a question. `call` throws on any non-2xx, so the 409
         that carries the confirmation arrives here; showing it in the red box
         under the button would read as a refusal, which is the one thing it is
         not. */
      if (failure.confirmNonInstitute) setNonInstituteAsk(failure.message);
      else setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await call(`${API}/verify`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      setPass(data.pass);
      setIsStaff(Boolean(data.isStaff));
      setFromLogin(false);
      setStage('chat');
      setThread([
        {
          side: 'bot',
          title: `Thanks — ${data.email} is verified`,
          blocks: [
            {
              type: 'text',
              text: 'Everything I tell you from here is about that address and only that address. Pick the question that fits best.',
            },
          ],
          actions: [],
          followUps: [],
        },
      ]);
    } catch (failure) {
      setError(failure.message);
      // A cancelled or expired code is not worth retyping — send them back to
      // ask for a fresh one rather than leaving them guessing at a dead code.
      if (failure.message.toLowerCase().includes('expired') || failure.message.includes('cancelled')) {
        setOtp('');
      }
    } finally {
      setBusy(false);
    }
  };

  /* Ask the question the URL named, once the gate is open and the menu has
     arrived — the menu is what turns an id into a question with a module, and
     asking before it lands would file the answer under no module at all.

     An id nobody recognises is dropped in silence rather than answered with an
     error: a stale link in an old mail should land somebody on the help desk,
     which is useful, not on a complaint about a link they did not write. */
  useEffect(() => {
    if (!pendingTopic || stage !== 'chat' || !menu.length) return;
    const topic = menuTopic(pendingTopic);
    setPendingTopic('');
    if (topic) askTopic(topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTopic, stage, menu]);

  /* The pass has run out. Say so where the answer would have been and put the
     visitor back at the door, rather than showing a bare 401. */
  const handleExpiry = () => {
    setPass('');
    setOtp('');
    setFromLogin(false);
    setIsStaff(false);
    setOpenModule('');
    setLastAsked('');
    setStage('email');
    setGateNote('');
    setNonInstituteAsk(null);
    setError('Your help-desk session has expired. Verify your address again to carry on.');
  };

  /**
   * Records whether the answer helped.
   *
   * Marked rated on the message itself rather than in a set of ids, because
   * the same question asked twice in one session is two messages and the
   * second one deserves its own ask. Nothing is undone if the request fails:
   * the visitor did their part, and a rating that did not record is the
   * page's problem, not something to report back as a failure.
   */
  const rateAnswer = async (message, helpful) => {
    setThread((previous) =>
      previous.map((entry) => (entry === message ? { ...entry, rated: true } : entry)),
    );
    try {
      await call(`${API}/action/rate-answer`, {
        method: 'POST',
        body: JSON.stringify({ topicId: message.id, helpful }),
      });
    } catch {
      /* Deliberately silent. The thanks is already on screen and the number is
         not worth an error message to somebody who was trying to be helpful. */
    }
  };

  const askTopic = async (topic) => {
    setBusy(true);
    /* The module a question belongs to, looked up rather than passed in: a
       follow-up chip under an answer carries only an id, and it may well point
       into a different module from the one being read. */
    const asked = categoryOf(topic.id) || category;
    setCategory(asked);
    /* Narrow the list to the module just asked about. The next question is
       nearly always next door to this one, and every question on the page piled
       under an answer buries the answer. */
    setOpenModule(asked);
    setLastAsked(topic.id);
    setQuery('');
    /* Opening the XCEED team question is the thing the second prompt would
       suggest, so it is not counted and that prompt is not shown afterwards. */
    if (topic.id === 'ask-a-human') nudgedRef.current.team = true;
    else askedCountRef.current += 1;
    setThread((previous) => [...previous, { side: 'me', text: topic.question, category: asked }]);
    try {
      const data = await call(`${API}/topic/${topic.id}`);
      setThread((previous) => [...previous, { side: 'bot', category: asked, ...data.answer }]);
      maybeNudge();
    } catch (failure) {
      if (failure.status === 401) return handleExpiry();
      setThread((previous) => [
        ...previous,
        {
          side: 'bot',
          category: asked,
          title: 'That did not work',
          blocks: [{ type: 'text', text: failure.message }],
          actions: [],
          followUps: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action, values) => {
    setBusy(true);
    setThread((previous) => [...previous, { side: 'me', text: action.label, category }]);
    try {
      const data = await call(`${API}/action/${action.id}`, {
        method: 'POST',
        /* The questions already asked ride along with a message to a human, and
           with nothing else. Somebody who writes "it still does not work" after
           four answers is describing the fifth thing, and without the four the
           reply is a request for them. */
        body: JSON.stringify(
          action.id === 'ask-question'
            ? {
                ...values,
                context: askedSoFar(thread),
                /* The answer on screen when they gave up. Counted server-side
                   against that question — an answer read and then followed by
                   "my question is not answered here" failed at the one job it
                   had, and that pair is the only place the page can see it. */
                lastTopic: lastAsked,
              }
            : values,
        ),
      });
      setThread((previous) => [...previous, { side: 'bot', category, ...data.answer }]);
    } catch (failure) {
      if (failure.status === 401) return handleExpiry();
      setThread((previous) => [
        ...previous,
        {
          side: 'bot',
          category,
          title: 'That did not work',
          blocks: [{ type: 'text', text: failure.message }],
          actions: [],
          followUps: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  /** Opens the next prompt the question count calls for, if any. After the
   *  answer rather than before it, so the reader still gets what they asked. */
  const maybeNudge = () => {
    const count = askedCountRef.current;
    const seen = nudgedRef.current;
    if (count > NUDGE_TEAM_AFTER && !seen.team && menuTopic('ask-a-human')) {
      seen.team = true;
      // Suggesting the search bar after this would be going backwards.
      seen.search = true;
      setNudge('team');
    } else if (count > NUDGE_SEARCH_AFTER && !seen.search && questionCount > CHIPS_BEFORE_MORE) {
      seen.search = true;
      setNudge('search');
    }
  };

  const closeNudge = useCallback(() => setNudge(''), []);

  const followNudge = () => {
    const kind = nudge;
    setNudge('');
    if (kind === 'search') {
      searchRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      searchRef.current?.focus();
    } else if (kind === 'team' && menuTopic('ask-a-human')) {
      askTopic(menuTopic('ask-a-human'));
    }
  };

  const startOver = () => {
    setNudge('');
    askedCountRef.current = 0;
    nudgedRef.current = { search: false, team: false };
    setPass('');
    setOtp('');
    setEmail('');
    setFromLogin(false);
    setIsStaff(false);
    setOpenModule('');
    setLastAsked('');
    setCategory('');
    setThread([]);
    setGateNote('');
    setNonInstituteAsk(null);
    setError('');
    setStage('email');
  };

  /* How many questions the page is offering, which is what decides whether a
     search box earns its place — not how many modules they are filed under. */
  const questionCount = menu.reduce((total, group) => total + group.topics.length, 0);

  /** One topic from the menu by id, for a link that asks it directly. */
  const menuTopic = (topicId) =>
    menu.flatMap((group) => group.topics).find((topic) => topic.id === topicId) || null;

  /** Which module a topic id belongs to, from the menu the server sent. */
  const categoryOf = (topicId) =>
    menu.find((group) => group.topics.some((topic) => topic.id === topicId))?.category || '';

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign('/');
  };

  const last = thread[thread.length - 1];

  return (
    <div className="hd">
      <style>{CSS}</style>
      <div className="hd-wrap">
        <header className="hd-head" ref={headRef}>
          <div className="hd-avatar" aria-hidden="true">
            ☎
          </div>
          <div>
            {/* This page is linked from inside the learning module's rail as
                well as from the login and reset screens, and it is a full-page
                takeover with no rail of its own. History back rather than a
                fixed destination: "back" from the learning module means the
                learning module, and from the reset form it means the reset
                form. `/` only when the page was opened cold, with nothing to
                go back to. */}
            <button className="hd-back" type="button" onClick={goBack}>
              ← Back
            </button>
            <h1>XCEED help desk</h1>
            <p>
              Registration, joining classes, and the learning module — answered against your
              own account, not from a manual.
            </p>
          </div>
        </header>

        {/* The staff shelf. Above the conversation because for a member of
            staff it is often the whole answer — "how do I issue certificates"
            is a manual, not a lookup — and hidden from everyone else, for whom
            it is three screens between them and their question. */}
        {isStaff && stage === 'chat' ? (
          <nav className="hd-manuals" aria-label="Manuals">
            <p>Manuals</p>
            <div className="hd-manuals-list">
              {MANUALS.map((manual) => (
                <a href={manual.href} key={manual.href}>
                  {manual.label}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {stage === 'checking' ? (
          /* One request long, and only ever this: a signed-in visitor is sent
             straight through, so the address form must not flash up in front
             of somebody who will never be asked for an address. */
          <div className="hd-gate" role="status" aria-live="polite">
            <h2>One moment</h2>
            <p style={{ marginBottom: 0 }}>Checking whether you are already signed in…</p>
          </div>
        ) : stage !== 'chat' ? (
          <div className="hd-gate">
            {stage === 'email' ? (
              <form onSubmit={requestCode}>
                <h2>First, your email address</h2>
                <p>
                  Because the answers describe your account — and because this page can create a
                  student account for you — it has to know the mailbox is yours. Enter your address
                  and a six-digit code will be sent to it. Nothing is looked up before you enter
                  that code.
                </p>
                <div className="hd-field">
                  <label htmlFor="hd-email">Email address</label>
                  <input
                    id="hd-email"
                    className="hd-input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@nitj.ac.in"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      /* The question was about the address as it was. Changing
                         a character makes it a different address, and a "yes"
                         standing over from the old one would let a typo the
                         person is in the middle of fixing through unasked. */
                      setNonInstituteAsk(null);
                    }}
                    required
                  />
                </div>
                {error ? <div className="hd-error">{error}</div> : null}
                {/* The confirmation, in place of the button rather than beside
                    it: leaving "Send me a code" live next to a question asking
                    whether they meant this address makes the question skippable
                    by the reflex of pressing the same button again, which is
                    exactly the reflex that got the wrong address typed. */}
                {nonInstituteAsk ? (
                  <div className="hd-confirm" role="alert">
                    <p>{nonInstituteAsk}</p>
                    <div className="hd-row">
                      <button
                        className="hd-btn"
                        type="button"
                        disabled={busy}
                        onClick={(event) => requestCode(event, true)}
                      >
                        {busy ? 'Sending…' : 'Yes, send the code anyway'}
                      </button>
                      <button
                        className="hd-btn ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => setNonInstituteAsk(null)}
                      >
                        Let me change it
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="hd-btn" type="submit" disabled={busy || !email.trim()}>
                    {busy ? 'Sending…' : 'Send me a code'}
                  </button>
                )}

                {/* What is behind the gate, as the modules themselves rather
                    than as forty question titles. Enough to recognise your own
                    problem in the list — which is the only decision being asked
                    for at this point — without turning the sign-in screen into
                    a document. */}
                {menu.length ? (
                  <div className="hd-preview">
                    <h3>What this page can answer</h3>
                    <div className="hd-preview-list">
                      {menu.map((group) => (
                        <div
                          className="hd-preview-item hd-module"
                          key={group.category}
                          style={accentVars(group.category)}
                        >
                          {group.category}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <h2>Verify your identity</h2>
                <p>{gateNote}</p>
                <div className="hd-field">
                  <label htmlFor="hd-otp">Six-digit code</label>
                  <input
                    id="hd-otp"
                    className="hd-input hd-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="······"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                {error ? <div className="hd-error">{error}</div> : null}
                <div className="hd-row">
                  <button className="hd-btn" type="submit" disabled={busy || otp.length !== 6}>
                    {busy ? 'Checking…' : 'Continue'}
                  </button>
                  <button className="hd-btn ghost" type="button" onClick={startOver} disabled={busy}>
                    Use a different address
                  </button>
                </div>
                <div className="hd-note" style={{ marginTop: 14, marginBottom: 0 }}>
                  Not arrived? Check your spam or quarantine folder first — institute filters catch
                  this mail more often than not. The code lasts ten minutes.
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
            {thread.map((message, index) =>
              message.side === 'me' ? (
                <div
                  className="hd-msg me hd-module"
                  key={index}
                  style={accentVars(message.category)}
                  ref={message === last ? latestRef : null}
                >
                  <div className="hd-dot" aria-hidden="true">
                    ●
                  </div>
                  <div className="hd-bubble">
                    <p>{message.text}</p>
                  </div>
                </div>
              ) : (
                <div
                  className="hd-turn hd-module"
                  key={index}
                  style={accentVars(message.category)}
                  ref={message === last ? latestRef : null}
                >
                  <div className="hd-msg">
                    <div className="hd-dot" aria-hidden="true">
                      ☎
                    </div>
                    <div className="hd-bubble">
                      {message.title ? <h2>{message.title}</h2> : null}
                      {(message.blocks || []).map((block, i) => (
                        <Block block={block} call={call} key={i} />
                      ))}
                      {(message.actions || []).map((action) => (
                        <ActionCard key={action.id} action={action} busy={busy} onRun={runAction} />
                      ))}
                    </div>
                  </div>

                  {/* Was it any use? Asked of the newest answer only, and only
                      of a real one — an error bubble has no topic id, and
                      "was this helpful" under "that did not work" is a poor
                      joke. Once answered it says thank you rather than
                      disappearing, so the press is visibly received. */}
                  {message === last && message.id && !message.rated ? (
                    <div className="hd-rate">
                      <span className="hd-rate-q">Did this answer help?</span>
                      <button
                        className="hd-rate-btn"
                        type="button"
                        disabled={busy}
                        onClick={() => rateAnswer(message, true)}
                      >
                        Yes
                      </button>
                      <button
                        className="hd-rate-btn"
                        type="button"
                        disabled={busy}
                        onClick={() => rateAnswer(message, false)}
                      >
                        No
                      </button>
                    </div>
                  ) : null}
                  {message === last && message.rated ? (
                    <div className="hd-rate">
                      <span className="hd-rate-q">Thank you — noted.</span>
                    </div>
                  ) : null}

                  {/* Follow-ups belong to the newest reply only. Leaving them
                      live on older messages invites a click that answers a
                      question two screens back. */}
                  {message === last && (message.followUps || []).length ? (
                    <div className="hd-group">
                      <p className="hd-group-title">Next</p>
                      <div className="hd-chips">
                        {message.followUps.map((followUp) => (
                          <button
                            className="hd-chip"
                            key={followUp.id}
                            type="button"
                            disabled={busy}
                            onClick={() => askTopic(followUp)}
                          >
                            {followUp.question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ),
            )}

            {busy ? (
              <div className="hd-msg">
                <div className="hd-dot" aria-hidden="true">
                  ☎
                </div>
                <div className="hd-bubble">
                  <span className="hd-typing" aria-label="Checking">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            ) : null}

            {/* Administrators only — `insights` is null for everybody the
                counts route refuses. Folded away by default: this is a report
                about the page, and an administrator who opened /help to answer
                somebody's question came for the answers. */}
            {insights ? (
              insightsOpen ? (
                <Insights data={insights} menu={menu} onClose={() => setInsightsOpen(false)} />
              ) : (
                <div className="hd-row" style={{ marginBottom: 14 }}>
                  <button
                    className="hd-btn ghost"
                    type="button"
                    onClick={() => setInsightsOpen(true)}
                  >
                    How this page is doing
                  </button>
                </div>
              )
            ) : null}

            {/* A search over the question titles, not a box that takes a
                question. The distinction is the page's whole design — every
                answer here is written and checked, and a free-text box invites
                the ones it cannot answer — so this filters the menu and
                nothing else. At forty-one questions across six modules it is
                the difference between finding yours and reading all of them. */}
            {questionCount > CHIPS_BEFORE_MORE ? (
              <div className="hd-search">
                <label className="hd-search-label" htmlFor="hd-search">
                  Search the questions
                </label>
                <input
                  id="hd-search"
                  ref={searchRef}
                  type="search"
                  className="hd-search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
                {query ? (
                  <button className="hd-btn ghost" type="button" onClick={() => setQuery('')}>
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}

            <QuestionMenu
              menu={menu}
              query={query.trim()}
              counts={askCounts}
              open={openModule}
              onOpen={setOpenModule}
              onAsk={askTopic}
              busy={busy}
              asked={lastAsked}
            />

            <div className="hd-foot">
              <span>
                {fromLogin ? (
                  <>
                    Signed in as <strong>{email.trim().toLowerCase()}</strong>, so no code was
                    needed. Every answer here is about that address.
                  </>
                ) : (
                  <>
                    Signed in to the help desk as <strong>{email.trim().toLowerCase()}</strong>.
                    This session lasts 45 minutes and is not a sign-in to XCEED.
                  </>
                )}
              </span>
              <button type="button" onClick={startOver}>
                {fromLogin ? 'Ask about a different address' : 'Start again with a different address'}
              </button>
            </div>

            {/* The recordings appear inline on the answers that have one, but
                somebody who would rather watch than read should not have to
                guess which question hides the video they want. */}
            <div className="hd-foot">
              <span>
                Would rather watch than read? <a href="/explainers">All the explainer videos</a>{' '}
                are in one place, grouped by what they show.
              </span>
            </div>

            {/* No support address anywhere on this page — not even down here.

                An address printed on a page collects the questions the page
                answers in seconds along with the ones it cannot, and each of
                those is a person reading a mailbox to run a lookup that had
                already been run. The XCEED team card sends the same message to
                the same people, with the module already chosen and the account
                state attached, and nothing to copy out by hand. */}
            <div className="hd-foot">
              <span>
                Nothing above fits?{' '}
                {askTopic && menuTopic('ask-a-human') ? (
                  /* A link to the question rather than its name in bold. Naming
                     it and leaving the reader to find it again in the list is
                     the sort of small friction that ends in a support email
                     instead. */
                  <button type="button" onClick={() => askTopic(menuTopic('ask-a-human'))} disabled={busy}>
                    Send your question to the XCEED team
                  </button>
                ) : (
                  <strong>Open XCEED team and send us your question</strong>
                )}{' '}
                — it reaches them with your account details already attached. XCEED is run by a
                student team alongside their own coursework, so a reply takes as long as somebody
                being free; please look through the questions above first, since those answer in
                seconds. Roles and staff accounts are changed by your department administrator;
                this page cannot do either.
              </span>
            </div>

            {nudge ? <Nudge kind={nudge} onGo={followNudge} onClose={closeNudge} /> : null}
          </>
        )}

        {/* What the page has done, at the foot of it. Three integers and
            nothing about anybody: people are counted as one row per address
            hashed one way, so a returning visitor is recognised without the
            address ever being stored. Shown at every stage, including the gate
            — somebody deciding whether this page is worth their time is
            entitled to know whether it has been worth anybody else's. */}
        {stats ? (
          <div className="hd-stats">
            <div className="hd-stat">
              <b>{stats.people.toLocaleString()}</b>
              <span>people verified here</span>
            </div>
            <div className="hd-stat">
              <b>{stats.sessions.toLocaleString()}</b>
              <span>help-desk sessions opened</span>
            </div>
            <div className="hd-stat">
              <b>{stats.answered.toLocaleString()}</b>
              <span>questions answered</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
