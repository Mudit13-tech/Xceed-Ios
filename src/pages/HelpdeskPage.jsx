import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';

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
   provider or pull a component library into the route's chunk. */

const CSS = `
.hd { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc;
      --brand:#4f46e5; --brand-dark:#4338ca; --brand-bg:#eef2ff;
      --ok:#059669; --ok-bg:#ecfdf5; --warn:#b45309; --warn-bg:#fffbeb;
      --bad:#dc2626; --bad-bg:#fef2f2; --info:#0369a1; --info-bg:#f0f9ff;
      font-family:'Inter','Segoe UI',system-ui,sans-serif; color:var(--ink);
      background:var(--bg); min-height:100vh; }
.hd *{box-sizing:border-box;}
.hd-wrap{max-width:820px;margin:0 auto;padding:24px 16px 96px;}

/* ── header ── */
.hd-head{display:flex;gap:14px;align-items:center;padding:20px 0 24px;}
.hd-avatar{width:46px;height:46px;border-radius:14px;flex:0 0 auto;
  background:linear-gradient(135deg,var(--brand),#7c3aed);color:#fff;
  display:flex;align-items:center;justify-content:center;font-size:22px;}
.hd-head h1{margin:0;font-size:1.35rem;font-weight:800;letter-spacing:-.02em;}
.hd-head p{margin:2px 0 0;color:var(--muted);font-size:.86rem;}

/* ── chat ── */
.hd-msg{display:flex;gap:10px;margin-bottom:18px;align-items:flex-start;}
.hd-msg.me{flex-direction:row-reverse;}
.hd-dot{width:28px;height:28px;border-radius:9px;flex:0 0 auto;margin-top:2px;
  display:flex;align-items:center;justify-content:center;font-size:14px;
  background:var(--brand-bg);color:var(--brand-dark);}
.hd-msg.me .hd-dot{background:#e2e8f0;color:#475569;}
.hd-bubble{background:#fff;border:1px solid var(--line);border-radius:14px;
  padding:14px 16px;max-width:calc(100% - 44px);box-shadow:0 1px 2px rgba(15,23,42,.04);}
.hd-msg.me .hd-bubble{background:var(--brand);border-color:var(--brand);color:#fff;}
.hd-bubble h2{margin:0 0 10px;font-size:1rem;font-weight:750;letter-spacing:-.01em;}
.hd-bubble p{margin:0 0 10px;line-height:1.62;font-size:.9rem;}
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
.hd-check-detail{color:#334155;}

.hd-steps{margin:0 0 12px;padding-left:20px;font-size:.88rem;line-height:1.65;}
.hd-steps li{margin-bottom:6px;}
.hd-note{background:var(--warn-bg);border-left:3px solid var(--warn);border-radius:0 8px 8px 0;
  padding:10px 13px;margin:0 0 12px;font-size:.85rem;line-height:1.6;color:#78350f;}

.hd-links{display:flex;flex-direction:column;gap:8px;margin:0 0 12px;}
.hd-link{display:block;border:1px solid #c7d2fe;background:var(--brand-bg);
  border-radius:10px;padding:11px 13px;text-decoration:none;transition:all .12s;}
.hd-link:hover{border-color:var(--brand);background:#e0e7ff;}
.hd-link-label{display:block;font-weight:700;font-size:.88rem;color:var(--brand-dark);}
.hd-link-label::after{content:' →';}
.hd-link-desc{display:block;font-size:.8rem;color:#475569;line-height:1.55;margin-top:3px;}

.hd-tablewrap{overflow-x:auto;margin:0 0 12px;border:1px solid var(--line);border-radius:10px;}
.hd-table{border-collapse:collapse;width:100%;font-size:.83rem;min-width:340px;}
.hd-table th{background:#f1f5f9;text-align:left;padding:8px 11px;font-weight:700;
  border-bottom:1px solid var(--line);white-space:nowrap;}
.hd-table td{padding:8px 11px;border-bottom:1px solid var(--line);line-height:1.5;vertical-align:top;}
.hd-table tr:last-child td{border-bottom:none;}

/* ── choices ── */
.hd-group{margin:0 0 16px;}
.hd-group-title{font-size:.68rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--muted);margin:0 0 8px 38px;}
.hd-chips{display:flex;flex-wrap:wrap;gap:8px;margin-left:38px;}
.hd-chip{background:#fff;border:1px solid #cbd5e1;border-radius:999px;
  padding:8px 15px;font-size:.85rem;font-weight:600;color:#334155;cursor:pointer;
  font-family:inherit;transition:all .12s;text-align:left;}
.hd-chip:hover:not(:disabled){border-color:var(--brand);color:var(--brand-dark);
  background:var(--brand-bg);}
.hd-chip:disabled{opacity:.5;cursor:not-allowed;}

/* ── action cards ── */
.hd-action{border:1px solid var(--line);border-radius:12px;background:#fff;
  padding:14px;margin:0 0 10px;}
.hd-action.primary{border-color:#c7d2fe;background:linear-gradient(180deg,#fff,var(--brand-bg));}
.hd-action h3{margin:0 0 8px;font-size:.92rem;font-weight:750;}
.hd-notice{background:var(--info-bg);border:1px solid #bae6fd;border-radius:8px;
  padding:10px 12px;margin:0 0 12px;font-size:.82rem;line-height:1.6;color:#075985;
  display:flex;gap:8px;}
.hd-notice span{flex:0 0 auto;}
.hd-field{margin:0 0 10px;}
.hd-field label{display:block;font-size:.78rem;font-weight:700;margin-bottom:4px;color:#334155;}
.hd-field .hd-help{display:block;font-weight:400;color:var(--muted);margin-top:2px;font-size:.75rem;}
.hd-input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:9px 11px;
  font-size:.88rem;font-family:inherit;color:var(--ink);background:#fff;}
.hd-input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(79,70,229,.13);}
.hd-btn{background:var(--brand);color:#fff;border:none;border-radius:9px;
  padding:10px 18px;font-size:.87rem;font-weight:700;cursor:pointer;font-family:inherit;}
.hd-btn:hover:not(:disabled){background:var(--brand-dark);}
.hd-btn:disabled{opacity:.55;cursor:not-allowed;}
.hd-btn.ghost{background:#fff;color:#334155;border:1px solid #cbd5e1;}
.hd-btn.ghost:hover:not(:disabled){background:#f1f5f9;}
.hd-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}

.hd-error{background:var(--bad-bg);border:1px solid #fecaca;color:#991b1b;
  border-radius:8px;padding:9px 12px;font-size:.83rem;margin:0 0 10px;line-height:1.55;}

/* ── gate ── */
.hd-gate{background:#fff;border:1px solid var(--line);border-radius:16px;
  padding:22px;box-shadow:0 1px 3px rgba(15,23,42,.05);}
.hd-gate h2{margin:0 0 6px;font-size:1.05rem;font-weight:780;}
.hd-gate p{margin:0 0 14px;color:var(--muted);font-size:.86rem;line-height:1.6;}
.hd-otp{letter-spacing:.42em;font-size:1.18rem;font-weight:700;text-align:center;
  font-variant-numeric:tabular-nums;}
.hd-preview{margin-top:22px;}
.hd-preview h3{font-size:.7rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.09em;color:var(--muted);margin:0 0 10px;}
.hd-preview ul{margin:0 0 12px;padding-left:18px;font-size:.83rem;color:#475569;line-height:1.7;}

.hd-typing{display:inline-flex;gap:4px;padding:4px 0;}
.hd-typing i{width:6px;height:6px;border-radius:50%;background:#94a3b8;
  animation:hd-blink 1.3s infinite;}
.hd-typing i:nth-child(2){animation-delay:.18s;}
.hd-typing i:nth-child(3){animation-delay:.36s;}
@keyframes hd-blink{0%,60%,100%{opacity:.25;}30%{opacity:1;}}

.hd-foot{margin-top:26px;padding-top:14px;border-top:1px solid var(--line);
  font-size:.78rem;color:var(--muted);line-height:1.6;display:flex;
  justify-content:space-between;gap:12px;flex-wrap:wrap;}
.hd-foot a{color:var(--brand-dark);}
.hd-foot button{background:none;border:none;color:var(--brand-dark);cursor:pointer;
  font:inherit;text-decoration:underline;padding:0;}

@media (max-width:520px){
  .hd-group-title,.hd-chips{margin-left:0;}
  .hd-bubble{max-width:100%;}
}
`;

/* ── block renderers ────────────────────────────────────────────────────── */

const STATE_MARK = { ok: '✓', warn: '!', bad: '✕', info: 'i' };

function Block({ block }) {
  if (block.type === 'text') return <p>{block.text}</p>;

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
          ) : (
            <input
              id={`${action.id}-${field.name}`}
              className="hd-input"
              type="text"
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

/* ── the page ───────────────────────────────────────────────────────────── */

export default function HelpdeskPage() {
  const [menu, setMenu] = useState([]);
  const [stage, setStage] = useState('email'); // email → code → chat
  const [email, setEmail] = useState('');
  /* In memory only, never localStorage — see the note at the top of the file. */
  const [pass, setPass] = useState('');
  const [otp, setOtp] = useState('');
  const [gateNote, setGateNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/menu`)
      .then((response) => response.json())
      .then((data) => setMenu(data.menu || []))
      .catch(() => setMenu([]));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
        throw failure;
      }
      return data;
    },
    [pass],
  );

  const requestCode = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await call(`${API}/code`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setGateNote(data.message);
      setStage('code');
    } catch (failure) {
      setError(failure.message);
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

  /* The pass has run out. Say so where the answer would have been and put the
     visitor back at the door, rather than showing a bare 401. */
  const handleExpiry = () => {
    setPass('');
    setOtp('');
    setStage('email');
    setGateNote('');
    setError('Your help-desk session has expired. Verify your address again to carry on.');
  };

  const askTopic = async (topic) => {
    setBusy(true);
    setThread((previous) => [...previous, { side: 'me', text: topic.question }]);
    try {
      const data = await call(`${API}/topic/${topic.id}`);
      setThread((previous) => [...previous, { side: 'bot', ...data.answer }]);
    } catch (failure) {
      if (failure.status === 401) return handleExpiry();
      setThread((previous) => [
        ...previous,
        { side: 'bot', title: 'That did not work', blocks: [{ type: 'text', text: failure.message }], actions: [], followUps: [] },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action, values) => {
    setBusy(true);
    setThread((previous) => [...previous, { side: 'me', text: action.label }]);
    try {
      const data = await call(`${API}/action/${action.id}`, {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setThread((previous) => [...previous, { side: 'bot', ...data.answer }]);
    } catch (failure) {
      if (failure.status === 401) return handleExpiry();
      setThread((previous) => [
        ...previous,
        {
          side: 'bot',
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

  const startOver = () => {
    setPass('');
    setOtp('');
    setEmail('');
    setThread([]);
    setGateNote('');
    setError('');
    setStage('email');
  };

  const allTopics = menu.flatMap((group) => group.topics);
  const last = thread[thread.length - 1];

  return (
    <div className="hd">
      <style>{CSS}</style>
      <div className="hd-wrap">
        <header className="hd-head">
          <div className="hd-avatar" aria-hidden="true">
            ☎
          </div>
          <div>
            <h1>XCEED help desk</h1>
            <p>
              Registration, joining classes, and the learning module — answered against your
              own account, not from a manual.
            </p>
          </div>
        </header>

        {stage !== 'chat' ? (
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
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                {error ? <div className="hd-error">{error}</div> : null}
                <button className="hd-btn" type="submit" disabled={busy || !email.trim()}>
                  {busy ? 'Sending…' : 'Send me a code'}
                </button>

                {allTopics.length ? (
                  <div className="hd-preview">
                    <h3>What this page can answer</h3>
                    {menu.map((group) => (
                      <div key={group.category}>
                        <ul>
                          {group.topics.map((topic) => (
                            <li key={topic.id}>{topic.question}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </form>
            ) : (
              <form onSubmit={verifyCode}>
                <h2>Enter the code</h2>
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
                <div className="hd-msg me" key={index}>
                  <div className="hd-dot" aria-hidden="true">
                    ●
                  </div>
                  <div className="hd-bubble">
                    <p>{message.text}</p>
                  </div>
                </div>
              ) : (
                <div key={index}>
                  <div className="hd-msg">
                    <div className="hd-dot" aria-hidden="true">
                      ☎
                    </div>
                    <div className="hd-bubble">
                      {message.title ? <h2>{message.title}</h2> : null}
                      {(message.blocks || []).map((block, i) => (
                        <Block block={block} key={i} />
                      ))}
                      {(message.actions || []).map((action) => (
                        <ActionCard key={action.id} action={action} busy={busy} onRun={runAction} />
                      ))}
                    </div>
                  </div>

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

            {menu.map((group) => (
              <div className="hd-group" key={group.category}>
                <p className="hd-group-title">{group.category}</p>
                <div className="hd-chips">
                  {group.topics.map((topic) => (
                    <button
                      className="hd-chip"
                      key={topic.id}
                      type="button"
                      disabled={busy}
                      onClick={() => askTopic(topic)}
                    >
                      {topic.question}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="hd-foot">
              <span>
                Signed in to the help desk as <strong>{email.trim().toLowerCase()}</strong>. This
                session lasts 45 minutes and is not a sign-in to XCEED.
              </span>
              <button type="button" onClick={startOver}>
                Start again with a different address
              </button>
            </div>
          </>
        )}

        <div ref={endRef} />

        {stage !== 'chat' ? (
          <div className="hd-foot">
            <span>
              Still stuck after trying this page? Ask your department administrator — this page
              cannot change roles or create staff accounts.
            </span>
            <a href="/guide">Read the full guide</a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
