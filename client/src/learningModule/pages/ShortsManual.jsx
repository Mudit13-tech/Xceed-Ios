import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';

import shotList from '../manualAssets/shorts/list.png';
import shotEditor from '../manualAssets/shorts/editor.png';
import shotPresent from '../manualAssets/shorts/present.png';
import shotSessions from '../manualAssets/shorts/sessions.png';
import shotReport from '../manualAssets/shorts/report.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#7c3aed',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .shm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .shm-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .shm-card { padding: 28px 32px; }
    .shm-topbar { padding: 10px 28px; }
    .shm-title { font-size: 20px; }
    .shm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .shm-grid-2 { grid-template-columns: 1fr; }
        .shm-page { padding: 16px 12px; }
        .shm-card { padding: 16px 14px; }
        .shm-topbar { padding: 10px 12px; }
        .shm-title { font-size: 16px; }
        .shm-subtitle { font-size: 11px; }
        .shm-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '💡' },
        key:     { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8', icon: '🔑' },
        danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '⛔' },
    };
    const s = cfg[type] || cfg.info;
    return (
        <div style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
            <div style={{ fontSize: 13, color: s.color, lineHeight: 1.65 }}>{children}</div>
        </div>
    );
}

function SectionTitle({ children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: T.textMuted,
            borderBottom: `1px solid ${T.border}`,
            paddingBottom: 6, marginBottom: 16, marginTop: 28,
        }}>{children}</div>
    );
}

function Shot({ src, alt, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <img src={src} alt={alt} style={{
                width: '100%', display: 'block', borderRadius: 10,
                border: '1px solid #e4e8f5', boxShadow: '0 1px 8px rgba(26,31,60,0.10)',
            }} />
            {caption && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{caption}</div>
            )}
        </div>
    );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Overview',        icon: '⚡' },
    { id: 'create',   label: 'Build a Deck',     icon: '✏️' },
    { id: 'present',  label: 'Presenting Live',  icon: '📽️' },
    { id: 'student',  label: 'What Students See',icon: '📱' },
    { id: 'reports',  label: 'Sessions & Reports',icon: '📊' },
    { id: 'gotchas',  label: 'Gotchas',          icon: '⚠️' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                Shorts are instant, live questions the whole room answers on their phones — a Mentimeter-style
                warm-up, temperature check, or recap, run from the front of the class. Two differences from
                Mentimeter worth knowing: there is no cap on how many students may join a session, and the live
                view is built to keep up with a full hall answering at once rather than slowing as the room
                fills. Deliberately separate from Quizzes: a Short has no window, no attempt cap and (usually)
                no gradebook row.
            </Note>

            <Shot src={shotList} alt="Shorts list for a class, with a live session banner"
                caption="The Shorts tab. A live deck shows its join code right on the card, with quick actions to jump back into presenting." />

            <SectionTitle>Eight Slide Types</SectionTitle>
            <div className="shm-grid-2" style={{ marginBottom: 8 }}>
                {[
                    { label: 'Multiple choice', desc: 'One answer from a list. Bar chart.' },
                    { label: 'Multiple answer', desc: 'Any number of answers. Bars can exceed 100%.' },
                    { label: 'True / false', desc: 'Options are fixed.' },
                    { label: 'Word cloud', desc: 'A word or three, sized by how often it comes up.' },
                    { label: 'Scale', desc: 'Rate between two labels. Histogram, mean and median.' },
                    { label: 'Open text', desc: 'A sentence or two, shown as cards.' },
                    { label: 'Ranking', desc: 'Drag into order. Aggregated by Borda count.' },
                    { label: 'Numeric estimate', desc: 'A number. Spread, mean and median.' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: '#f8f9ff', border: '1px solid #e4e8f5',
                        borderRadius: 10, padding: '10px 14px',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: T.text }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.desc}</div>
                    </div>
                ))}
            </div>
            <Note type="info">
                Only Multiple choice, Multiple answer, True/false and Ranking can carry a correct-answer
                key at all — Word cloud, Scale and Open text are always pure opinion polls; Numeric estimate
                can optionally carry a correct number with a tolerance.
            </Note>

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                Build a deck of slides → Present it live from the front of the room → students join with a
                6-digit code and answer on their phones → you control the pace slide by slide → end the
                session → review the report afterward.
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Building the Deck</SectionTitle>
            <Shot src={shotEditor} alt="Short editor showing four different slide types and the deck settings"
                caption="The deck editor. Deck-wide settings at the top; each slide is its own card below, with the fields specific to its type." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Click <strong>+ New short</strong> to start with one seeded multiple-choice slide, or add
                slides of any type from the row of buttons at the bottom of the editor (<strong>+ Multiple
                choice</strong>, <strong>+ Word cloud</strong>, and so on). Every slide gets a
                <strong> Countdown (seconds)</strong> — 0 means you close it by hand instead of on a timer —
                and, if it carries an answer key, <strong>Marks</strong> and an
                <strong> Explanation shown on reveal</strong>.
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Choice slides</strong> (multiple choice / multiple answer / true-false / ranking) — tick the correct option(s), or leave everything unticked to run it as a plain poll. For ranking, use <strong>Use the order shown as the answer</strong> to set the key from however you've currently arranged the items — and note a ranking key must place <em>every</em> item or none; there's no partial key.</li>
                    <li><strong>Scale</strong> — set the From/To bounds and the low/high labels (e.g. "Not at all" → "Completely").</li>
                    <li><strong>Numeric estimate</strong> — leave <strong>Correct number</strong> blank for a pure estimate poll, or fill it in with a <strong>Tolerance ±%</strong> and/or <strong>± absolute</strong> (the more generous of the two applies).</li>
                    <li><strong>Word cloud / Open text</strong> — set how many words count, or a character limit.</li>
                </ul>
            </div>

            <SectionTitle>Deck-wide Settings</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Require sign-in to join</strong> (on by default) — off lets anyone with the code type a name and join, no account needed; guests are always left out of the gradebook regardless of the Graded setting.</li>
                    <li><strong>Hide names in results</strong> — hides names from what's projected/shown only; answers stay fully attributed to accounts on the server, so you can still see who hasn't answered and still grade individuals.</li>
                    <li><strong>Mirror results to phones</strong> — otherwise results stay on the projector only.</li>
                    <li><strong>Allow changing an answer</strong>, <strong>Allow joining mid-deck</strong>, <strong>Reveal the answer when I close a slide</strong> — self-explanatory pacing controls.</li>
                    <li><strong>Email the class when I start it</strong> (on by default) — the join code goes out by mail as well as in-app; turn it off for a rehearsal or when the room is already in front of you. <strong>This mail cannot be recalled once sent.</strong></li>
                    <li><strong>Send scores to the gradebook</strong> — creates a classwork entry when the session ends, only if the deck has at least one gradable slide. Guests are always excluded from this, even on a graded deck.</li>
                </ul>
            </div>
            <Note type="tip">
                <strong>📥 Import slides</strong> copies slides from another Short — this class or any other
                you teach — as independent copies with no shared history, exactly like question import
                elsewhere in the module.
            </Note>
        </div>
    );
}

function TabPresent() {
    return (
        <div>
            <SectionTitle>The Projector Screen</SectionTitle>
            <Shot src={shotPresent} alt="Live presenting screen with a QR code, join code, countdown and live bar chart"
                caption="Presenting live. Built to be read from the back of the room — the QR code and 6-digit join code are always visible, and the current slide's live results update as answers land." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Click <strong>Present</strong> on a deck's card. If a session is already live, the same button reads <strong>Back to presenting</strong> and rejoins it — resuming never re-sends the launch email.</li>
                    <li>Bottom control bar: previous/next slide, then a state-dependent action — <strong>Open for answers</strong> → <strong>Close answering</strong> → <strong>Reveal the answer</strong> (only if the slide has an answer key) → <strong>Reopen</strong>.</li>
                    <li>Keyboard shortcuts for a presenter remote: <strong>← →</strong> to move between slides, <strong>space</strong> to open / close / reveal.</li>
                    <li>Moving to a new slide always resets it to "not open yet" — you can't pre-arm the next slide's timer while still finishing the current discussion.</li>
                    <li><strong>End session</strong> is reachable from here, from the list page's menu, and is the only way to trigger gradebook mirroring. It's irreversible: <em>"The join code stops working."</em></li>
                </ul>
            </div>
            <Note type="info">
                A connection badge shows <strong>streaming</strong> when live updates are working, or
                <strong> polling</strong> if they've fallen back to a periodic refresh — your controls still
                work either way, just at a slightly coarser refresh rate.
            </Note>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <SectionTitle>Joining</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Students go to the join page, type the 6-digit code (or scan the projected QR code), and —
                if the deck allows guests — type a display name. If sign-in is required, they're sent to log
                in and back automatically.
            </div>

            <SectionTitle>Answering</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>A hold screen shows the deck title and waits until you open the next slide — nothing about the question is visible before then, even to someone inspecting network traffic.</li>
                    <li>Each slide type gets its own input: tappable buttons for choice slides, an up/down reorder list for ranking (not drag-and-drop — deliberately, since a touch mis-drop mid-timer is worse than two taps), a number grid for scale, and plain text fields for word cloud / open / numeric.</li>
                    <li>A countdown badge turns red in the last 5 seconds. The server's clock is authoritative — a stale local countdown never lets a late answer through.</li>
                    <li>If results are mirrored to phones or the slide has been revealed, students see the same live results the projector shows.</li>
                </ul>
            </div>
        </div>
    );
}

function TabReports() {
    return (
        <div>
            <SectionTitle>Sessions</SectionTitle>
            <Shot src={shotSessions} alt="Sessions list for a Short, showing a live session and a past one"
                caption="Every run of a deck is kept separate — the same warm-up presented in two sections is two different rooms, and averaging them would hide that one cohort understood it and the other didn't." />

            <SectionTitle>The Report</SectionTitle>
            <Shot src={shotReport} alt="Short session report, with worth-revisiting, never-answered and leaderboard cards"
                caption="A session's report. Worth going over again (under 60% correct) and Joined but never answered are both automatic call-outs — the 60% line is a working threshold to give you a shortlist, not a verdict." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Leaderboard</strong> (or <strong>Participation</strong>, if nothing in the deck was gradable) — ties are broken by how much was attempted, then by speed, specifically so someone who answered nothing can't outrank a slower classmate who actually tried.</li>
                    <li><strong>Slide by slide</strong> — expand any slide to see its full results, exactly as they appeared live.</li>
                    <li><strong>Download CSV</strong> exports every response, with guests marked inline as "(guest)".</li>
                </ul>
            </div>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'The launch email cannot be recalled once a fresh session starts — that\'s why the app asks every time, but never again when you merely rejoin an already-live session.',
        'Deleting a deck deletes every session\'s answers with it, and if it was ever graded, deletes the mirrored gradebook entries too — there\'s no "unlink but keep the deck" option.',
        'A deck with "Require sign-in to join" turned off is genuinely open to anyone with the code — no class-membership check at all. The presenter screen flags this with an "anyone with the code can join" badge for exactly that reason.',
        'Guests never receive gradebook credit, even on a graded deck, though their answers count in the live results and leaderboard for the room.',
        'A ranking slide\'s answer key must place every item or none, and correctness is exact-sequence only — a near-miss (one adjacent swap) scores the same zero as a completely wrong order. The live Borda-count bars are a different, softer metric than what actually earns marks.',
        'Numeric-estimate tolerance is "whichever is larger wins" between the percent and absolute values — they are not additive.',
        'A slide\'s timer starts only when you press "Open for answers" — arriving at a slide never starts its clock automatically.',
        'Presenting a deck validates whatever was last saved, not the currently-open editor\'s unsaved state — a deck someone left mid-edit can still present in its last good form.',
        'Word-cloud answers are deduplicated per person — typing the same word three times only counts once, so one student can\'t stuff the cloud by repetition.',
    ];
    return (
        <div>
            <Note type="warning">
                Nine things worth knowing before you run a Short with a room full of phones.
            </Note>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((text, i) => (
                    <div key={i} style={{
                        background: '#fff', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b',
                        borderRadius: 8, padding: '10px 14px',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#92400e', flexShrink: 0 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ShortsManual({ standalone = false }) {
    const [tab, setTab] = useState('overview');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (!standalone) return;
        fetch(`${getEnvironment()}/user/getuser/`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setIsAuthenticated(true); })
            .catch(() => {});
    }, [standalone]);

    const TAB_CONTENT = {
        overview: <TabOverview />,
        create:   <TabCreate />,
        present:  <TabPresent />,
        student:  <TabStudent />,
        reports:  <TabReports />,
        gotchas:  <TabGotchas />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#2e1065', borderBottom: '1px solid #4c1d95',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="shm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                        }}>⚡</div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e9d5ff' }}>
                            Shorts — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#d8b4fe',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #4c1d95', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#4c1d95'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="shm-page" style={{ fontFamily: T.fontBody }}>
                <div className="shm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>⚡</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="shm-title" style={{ fontWeight: 800, color: T.text }}>Shorts — Teacher Manual</div>
                        <div className="shm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Instant live questions the room answers on their phones · XCEED Learning
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
                    {TABS.map((t, i) => {
                        const active = tab === t.id;
                        const done = activeIdx > i;
                        const bgColor = active ? T.accent : done ? '#10b981' : '#f1f5f9';
                        const numColor = active || done ? '#fff' : '#94a3b8';
                        const labelColor = active ? T.accent : done ? '#10b981' : T.textMuted;
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', flex: i < TABS.length - 1 ? 1 : 'none', minWidth: 0 }}>
                                <div
                                    onClick={() => setTab(t.id)}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: 72, flexShrink: 0 }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: bgColor,
                                        border: active ? `2px solid ${T.accent}` : done ? '2px solid #10b981' : '2px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 800, color: numColor,
                                        transition: 'all .2s', flexShrink: 0,
                                        boxShadow: active ? `0 0 0 4px ${T.accent}18` : 'none',
                                    }}>
                                        {done ? '✓' : i === 0 ? '★' : i}
                                    </div>
                                    <div style={{
                                        marginTop: 6, fontSize: 10, fontWeight: active ? 700 : 500,
                                        color: labelColor, textAlign: 'center', lineHeight: 1.3,
                                        maxWidth: 68, wordBreak: 'break-word',
                                    }}>
                                        {t.label}
                                    </div>
                                </div>
                                {i < TABS.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2, marginTop: 17, minWidth: 12,
                                        background: done ? '#10b981' : '#e2e8f0',
                                        transition: 'background .2s',
                                    }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="shm-card" style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                    overflowX: 'auto',
                }}>
                    {TAB_CONTENT[tab]}
                </div>
            </div>
        </>
    );
}
