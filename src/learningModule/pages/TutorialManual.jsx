import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';

import shotList from '../manualAssets/tutorials/list.png';
import shotEditor from '../manualAssets/tutorials/editor.png';
import shotPreview from '../manualAssets/tutorials/preview.png';
import shotPlayer from '../manualAssets/tutorials/player.png';
import shotResults from '../manualAssets/tutorials/results.png';
import shotImport from '../manualAssets/tutorials/import.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#0d9488',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .tum-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .tum-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .tum-card { padding: 28px 32px; }
    .tum-topbar { padding: 10px 28px; }
    .tum-title { font-size: 20px; }
    .tum-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .tum-grid-2 { grid-template-columns: 1fr; }
        .tum-page { padding: 16px 12px; }
        .tum-card { padding: 16px 14px; }
        .tum-topbar { padding: 10px 12px; }
        .tum-title { font-size: 16px; }
        .tum-subtitle { font-size: 11px; }
        .tum-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '💡' },
        key:     { bg: '#f0fdfa', border: '#99f6e4', color: '#115e59', icon: '🔑' },
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
    { id: 'overview', label: 'Overview',        icon: '🧮' },
    { id: 'create',   label: 'Create & Author',  icon: '✏️' },
    { id: 'settings', label: 'Settings',         icon: '⚙️' },
    { id: 'import',   label: 'Import a Paper',   icon: '📄' },
    { id: 'student',  label: 'What Students See',icon: '👀' },
    { id: 'results',  label: 'Results & Marks',  icon: '📊' },
    { id: 'gotchas',  label: 'Gotchas',          icon: '⚠️' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                A Tutorial is <strong>numerical practice where every student gets their own numbers</strong>.
                You write one question with algebraic variables and an answer formula; each student is
                handed a fresh, randomly-drawn set of values, and their typed answer is checked by evaluating
                your formula against their own numbers — not by comparing to one shared answer key.
            </Note>

            <Shot src={shotList} alt="Tutorials list for a class"
                caption="The Tutorials tab. Each card is one paper — its status, question count, and (for a published one) how the class is doing." />

            <SectionTitle>Tutorial or Assignment?</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Tutorials and Assignments share the exact same engine — variables, formulas, tolerances,
                the same editor, the same paper-import pipeline. The difference is purely how you use them:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Tutorial</strong> — practice. Multiple attempts are normal, instant feedback is easy to justify turning on, and the class average is a formative signal, not a grade.</li>
                    <li><strong>Assignment</strong> — assessed. Usually one attempt, instant feedback is off by default, and the score is meant to count. See the separate Assignment manual for that side.</li>
                </ul>
                If you want this exact mechanic but for a paper that counts toward marks, use Assignments
                instead of raising a Tutorial's pass mark and calling it graded.
            </div>

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                Create (from scratch, or from an uploaded paper) → author questions with variables and
                formulas → set retry/feedback settings → publish → students each sit their own numbers →
                you read the Method-analysis table and adjust individual scores where needed.
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Starting a New Tutorial</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Click <strong>+ New tutorial</strong>. Unlike most editors, this does not open a blank page —
                it creates the tutorial immediately with a worked example already filled in (a resistor
                power-dissipation question, with variables and a formula already wired up), so you always
                have a working reference to edit rather than a blank sheet to figure out from scratch.
            </div>

            <SectionTitle>Authoring a Question</SectionTitle>
            <Shot src={shotEditor} alt="Tutorial editor showing a question with variables, answers and a sub-question"
                caption="The question editor. Prompt, Variables, Answers, an optional Sub-question part, Constraint, Hint and Worked solution — all for one question." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Prompt</strong> — write the question with <code>{'{{name}}'}</code> placeholders where a variable's value should appear. Use the <em>Insert variable</em> buttons rather than typing braces by hand — a rich-text editor can silently embed formatting inside hand-typed braces and break the substitution.</li>
                    <li><strong>Variables</strong> — each has a <strong>Type</strong> (Integer, Decimal, or From a list), a range or list of values, a <strong>Step</strong> (so values land on a clean grid — 4.5, not 4.5137), and a Unit.</li>
                    <li><strong>Answers</strong> — a formula over the variables above, evaluated per student and compared with what they type. Set a <strong>Tol %</strong> and/or <strong>Tol ±</strong> tolerance — whichever is looser applies; the absolute tolerance matters most when the correct value is near zero.</li>
                    <li><strong>Sub-questions</strong> — optional parts (a), (b), (c)… sharing the same drawn variables, each with its own prompt and its own separately-marked answers. Leave this empty for a single-answer question.</li>
                    <li><strong>Constraint</strong> — an optional boolean expression (e.g. <code>R &gt; 0</code>); values are re-drawn until it's satisfied, so use it to rule out a divide-by-zero or a physically impossible combination.</li>
                    <li><strong>Hint</strong> and <strong>Worked solution</strong> — shown before and after submission respectively, each gated by its own setting (see Settings tab).</li>
                </ul>
            </div>
            <Note type="tip">
                Every formula field is validated live against the actual formula engine as you type — an
                invalid formula shows its error inline immediately, not after you save.
            </Note>

            <SectionTitle>Rolling Sample Papers</SectionTitle>
            <Shot src={shotPreview} alt="Preview panel showing three rolled sample papers with their answers"
                caption="Roll samples — three genuinely different draws of the same question, with the computed answer for each, so you can eyeball that the numbers behave sensibly before anyone sits the paper." />
            <Note type="warning">
                Preview always runs against the <strong>saved</strong> version on the server, never your
                unsaved edits — if you tweak a formula and immediately roll samples without saving first,
                you'll see the old behaviour and may wrongly conclude your fix didn't work.
            </Note>

            <SectionTitle>Reusing Questions</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <strong>📥 Import questions</strong>, at the bottom of the editor, copies whole questions from
                another tutorial — in this class or any other class you teach — into the one you have open.
                Copies are independent from the moment they land: editing them never touches the original,
                and no student work comes with them. This is separate from importing from a scanned paper —
                see the Import a Paper tab.
            </div>
        </div>
    );
}

function TabSettings() {
    return (
        <div>
            <SectionTitle>Tutorial Details</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Attempts allowed</strong> — how many times a student may sit the paper. More than one is normal for a tutorial.</li>
                    <li><strong>Pass mark (%)</strong> — feeds the pass-rate stat in Results; doesn't restrict anything a student can do.</li>
                    <li><strong>Due date</strong> — advisory only. Nothing locks at this time; a late submission is simply flagged so you can see who was on time.</li>
                    <li><strong>Fresh numbers on each retry</strong> — when on, a second or third attempt draws a genuinely new set of numbers rather than repeating the first attempt's paper. (The very first attempt is always randomly drawn regardless of this setting.)</li>
                    <li><strong>Show the worked solution after submitting</strong> and <strong>Show hints</strong> — self-explanatory, each controlling one of the per-question fields from the editor.</li>
                </ul>
            </div>

            <SectionTitle>Instant Feedback — an Intentional Trade-off</SectionTitle>
            <Note type="warning">
                <strong>Tick each answer as the student types it</strong> shows a ✓ beside an answer the
                moment it's right, before submitting. It is <strong>off by default on purpose</strong>: a
                numeric answer with live right/wrong feedback can be brute-forced by typing values until it
                goes green. Turn it on for a tutorial that is genuinely just practice; leave it off for
                anything where the score should reflect actual understanding. When it's on, you also set
                <strong> Checks allowed per answer</strong> — once spent, the ticks stop but the student can
                still submit, and every check attempt is recorded either way, so you can always see who
                worked through it and who searched for the answer.
            </Note>
        </div>
    );
}

function TabImport() {
    return (
        <div>
            <Note type="key">
                Building a tutorial from a photographed or scanned paper is a four-stage, teacher-reviewed
                pipeline: read the paper, choose the variables, derive the answers, merge. Nothing here
                publishes anything automatically — the merge produces an unpublished tutorial you still open,
                review, and release like any other.
            </Note>

            <Shot src={shotImport} alt="Reviewing an imported tutorial draft, with verified and mismatched answer badges"
                caption="Reviewing an import. Question 1's answer reproduced the paper's own printed value (verified, green); Question 2's did not (mismatch, red) — exactly the kind of thing this screen exists to catch." />

            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Upload.</strong> From the list page, click <strong>📄 Import from a paper</strong> and pick one or more PDF/image files. The paper is read automatically, and you land on this review screen.</li>
                    <li><strong>Suggest variables.</strong> Click <strong>✨ Suggest variables</strong> on a question — the model proposes which numbers in the paper should become variables, with a type, a sensible range, and a note showing exactly what value the paper actually used.</li>
                    <li><strong>Derive answers.</strong> Click <strong>✨ Derive answers from the paper</strong> — the model writes the formula, then immediately checks it by substituting the paper's own original numbers back in and comparing the result to the paper's printed answer.</li>
                    <li><strong>Read the verification badge on every answer</strong> before trusting it: <strong style={{ color: '#166534' }}>✓ matches the paper</strong> (green), <strong style={{ color: '#991b1b' }}>✗ does not match</strong> (red), <strong>? not checkable</strong> (orange), or <strong>✗ will not parse</strong> (red). This badge is advisory, not a gate — nothing stops you from merging a question whose answer is still unverified, so treat a non-green badge as a hold, not a suggestion.</li>
                    <li><strong>Roll samples</strong> on this screen shows the answer key alongside each draw (unlike the editor's own preview) — the last sanity check before this goes anywhere near students.</li>
                    <li><strong>Merge</strong> the questions you've selected into a new, unpublished tutorial, ready for the normal editor.</li>
                </ol>
            </div>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <Shot src={shotPlayer} alt="Student view of a tutorial in progress, with their own drawn values"
                caption="A student's paper. Their values (R = 45, I = 1.5) are theirs alone — a classmate sees the same question with different numbers." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Students see their own drawn <strong>Your values</strong> under the prompt, and may type an unevaluated expression as an answer (e.g. <code>2*pi*3</code>) instead of computing a decimal themselves.</li>
                    <li>A standing note reminds them that comparing <em>final answers</em> with a classmate is useless — everyone's numbers differ — but comparing <em>method</em> is exactly the point.</li>
                    <li>Submitting is immediate and marks right away; there's no separate "release grades" step gating what a student can see once they submit.</li>
                    <li>If attempts remain, a <strong>Start attempt {'{n+1}'}</strong> button appears after submitting.</li>
                </ul>
            </div>
        </div>
    );
}

function TabResults() {
    return (
        <div>
            <Shot src={shotResults} alt="Tutorial results page showing method analysis and per-student attempts"
                caption="Results. Method analysis (below) is the tutorial-specific view — there's no single correct answer to tally across the class, so success is measured per answer slot instead." />

            <SectionTitle>Method Analysis, Not a Question Histogram</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Because every student answered different numbers, there's no single "correct option" to
                count votes for. The <strong>Method analysis</strong> table instead shows the success rate
                per answer slot — a low percentage means the <em>method</em>, not the arithmetic, needs
                revisiting in the next class.
            </div>

            <SectionTitle>Fixing a Score by Hand</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                There is no bulk regrade tool here (unlike quizzes, which can re-mark an entire cohort after
                an answer-key fix). Instead, expand any attempt and use <strong>Adjust marks (+/−)</strong>
                with an optional <strong>Feedback</strong> note — the adjustment is additive/subtractive on
                top of the auto-computed score, and your feedback text shows up on the student's own paper
                as "Teacher feedback." Use this when the Method-analysis table reveals a question that was
                unfairly marked for some students (e.g. a variable range that allowed a divide-by-zero).
            </div>
            <Note type="info">
                A warning banner appears automatically if any attempt hit an unmarkable question — usually
                a variable range that allows a divide-by-zero. Widen the question's constraint for future
                sittings, and use the adjustment above for students already affected.
            </Note>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'There is no timer and no deadline enforcement beyond an advisory due date — nothing locks a tutorial at any point; a late submission is only ever flagged, never blocked.',
        'None of the quiz module\'s proctoring exists here — no fullscreen lockdown, no Safe Exam Browser, no keyboard lockdown. Tutorials are not built for a monitored sitting.',
        'Multiple attempts are a first-class, teacher-configured feature, not an edge case — set "Attempts allowed" and decide whether a retry gets fresh numbers.',
        'Instant feedback never reveals the expected value, even when on — only whether the current answer is right, and how many checks remain.',
        'A partially-filled sub-question is fine — each part is marked independently on submit.',
        'Deleting a tutorial deletes every student\'s attempt at it, with no way to keep the tutorial and wipe only the responses (unlike quizzes, which separate the two).',
        'There is no CSV/bulk export on the Results page — only what you can read on-screen and the per-attempt manual adjustment.',
        'Import verification badges are advisory, not a gate: nothing stops you from merging (and later publishing) a question whose derived answer never matched the paper.',
        'Preview — in both the editor and the import screen — always rolls against the saved server copy, never unsaved edits in front of you.',
        'Assignments use the exact same engine under a different name for a different purpose — see the separate Assignment manual if you want this mechanic to count toward a grade.',
    ];
    return (
        <div>
            <Note type="warning">
                Ten things worth knowing before you build your first tutorial.
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

export default function TutorialManual({ standalone = false }) {
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
        settings: <TabSettings />,
        import:   <TabImport />,
        student:  <TabStudent />,
        results:  <TabResults />,
        gotchas:  <TabGotchas />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#134e4a', borderBottom: '1px solid #115e59',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="tum-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#0d9488,#14b8a6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                        }}>🧮</div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#ccfbf1' }}>
                            Tutorials — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#5eead4',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #115e59', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#115e59'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="tum-page" style={{ fontFamily: T.fontBody }}>
                <div className="tum-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#0d9488,#14b8a6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>🧮</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tum-title" style={{ fontWeight: 800, color: T.text }}>Tutorials — Teacher Manual</div>
                        <div className="tum-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Numerical practice, one draw of numbers per student · XCEED Learning
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

                <div className="tum-card" style={{
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
