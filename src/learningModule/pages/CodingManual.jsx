import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';

import shotList from '../manualAssets/notebooks/list.png';
import shotEditor from '../manualAssets/notebooks/editor.png';
import shotPlayer from '../manualAssets/notebooks/player.png';
import shotSubmissions from '../manualAssets/notebooks/submissions.png';
import shotSubmissionDetail from '../manualAssets/notebooks/submission-detail.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#1d4ed8',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .cdm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cdm-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .cdm-card { padding: 28px 32px; }
    .cdm-topbar { padding: 10px 28px; }
    .cdm-title { font-size: 20px; }
    .cdm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .cdm-grid-2 { grid-template-columns: 1fr; }
        .cdm-page { padding: 16px 12px; }
        .cdm-card { padding: 16px 14px; }
        .cdm-topbar { padding: 10px 12px; }
        .cdm-title { font-size: 16px; }
        .cdm-subtitle { font-size: 11px; }
        .cdm-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '💡' },
        key:     { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: '🔑' },
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
    { id: 'overview', label: 'Overview',         icon: '🐍' },
    { id: 'create',   label: 'Author a Notebook',icon: '✏️' },
    { id: 'runtime',  label: 'What Can Run',     icon: '⚙️' },
    { id: 'student',  label: 'What Students See',icon: '👀' },
    { id: 'grade',    label: 'Grading',          icon: '✅' },
    { id: 'gotchas',  label: 'Gotchas',          icon: '⚠️' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                Coding notebooks are Python or C worksheets — prose and code cells, Jupyter-notebook-like —
                that run <strong>entirely inside the student's own browser</strong>. Nothing to install, no
                server execution, no account anywhere else.
            </Note>

            <Shot src={shotList} alt="Coding notebooks list for a class"
                caption="The Coding notebooks tab. Language, packages, due date and submission counts all show on the card." />

            <SectionTitle>Python or C — Decided at Creation</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Click <strong>New notebook</strong> and pick <strong>Python notebook</strong> or
                <strong> C notebook</strong> — each starts with a small worked example already filled in.
                The language is <strong>locked in once published</strong>: switching it afterward is refused,
                because students already have code written for that kernel.
            </div>

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                Author cells (prose + code, optionally locked or hidden) → publish → students run code
                live in their own tab and submit → you read the code and recorded output by hand and grade
                it — there is no autograder.
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Notebook Settings</SectionTitle>
            <Shot src={shotEditor} alt="Notebook editor showing settings, a locked cell and a hidden setup cell"
                caption="The editor. Packages and the Colab link only appear for Python; a C notebook shows a note on how its cells run instead. The Locked and Hidden setup checkboxes sit above every code cell." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Packages</strong> (Python only) — PyPI packages not already bundled with the in-browser runtime. numpy, pandas, matplotlib, scipy, sympy and scikit-learn ship for free and don't need declaring; anything needing a C extension without a WebAssembly build simply won't install. <strong>Packages only install at kernel start</strong> — adding one to an already-running kernel does nothing until it's restarted.</li>
                    <li><strong>Open in Colab link</strong> (Python only) — for the things the browser kernel genuinely cannot do (TensorFlow, PyTorch, GPU work). Must be a <code>colab.research.google.com</code> address or it's discarded on save. Students run it in their own Google account — that work never comes back into this platform.</li>
                    <li><strong>Submission deadline</strong> — advisory only. Nothing locks at this time; late submissions are simply flagged, and it also puts the exercise on the class calendar.</li>
                    <li><strong>Let students add their own cells</strong> — off makes it a fixed worksheet.</li>
                    <li><strong>Show your version after they submit</strong> — your own cell sources (not outputs) appear under a student's work once they've submitted.</li>
                </ul>
            </div>

            <SectionTitle>Locked vs. Hidden — Different, Orthogonal Concepts</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Locked</strong> — visible and runnable, but the student can't edit the code (its stdin box still is editable — feeding a fixed program different input is often the exercise itself).</li>
                    <li><strong>Hidden setup</strong> — never shown to the student at all. In Python it runs once into the kernel before their cells; in C, its source is prepended, literally, to every one of their cells before compiling — and for that reason a hidden C cell <strong>must not define <code>main()</code></strong>, or publishing is rejected.</li>
                </ul>
            </div>

            <SectionTitle>C Notebooks Run Differently — No Shared State</SectionTitle>
            <Note type="warning">
                A C "notebook" is not a REPL. <strong>Every code cell is a whole, independent program</strong>
                with its own <code>main()</code> — nothing carries over between cells, because C has no
                interpreter state to share. Shared <code>#include</code>s, typedefs or helper functions go
                in the hidden setup cell instead. Cells compile with real clang, so error messages are the
                ones a real compiler would give — including line numbers correctly shifted to account for
                the prepended setup code.
            </Note>

            <SectionTitle>Importing Existing Code</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <strong>Import .ipynb / .py</strong> (Python) or <strong>Import .c</strong> appends cells from
                a file to the end of the notebook — unsaved until you click Save. IPython magics
                (<code>%matplotlib inline</code>, <code>!pip install x</code>) are stripped or converted
                into the Packages box automatically, since the browser kernel has no IPython, and all
                outputs are dropped — an import always arrives unrun. Separately,
                <strong> 📥 Import cells</strong> pulls cells from a notebook in another class you teach,
                the same reuse mechanism used elsewhere in the module.
            </div>
        </div>
    );
}

function TabRuntime() {
    return (
        <div>
            <Note type="key">
                Both runtimes execute inside a Web Worker in the student's own tab — never on the server.
                The model's own schema comment says why: running arbitrary student code server-side is a
                remote-code-execution surface, and this platform has no container sandboxing to put behind
                it. No network access and no file I/O are available to student code, in either language.
            </Note>

            <SectionTitle>Python — Pyodide</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Real CPython compiled to WebAssembly. The first start downloads a few megabytes; students
                are warned before they click Start. <code>numpy</code>, <code>pandas</code>,
                <code> matplotlib</code>, <code>scipy</code>, <code>sympy</code> and
                <code> scikit-learn</code> have prebuilt browser versions and don't need declaring in
                Packages. <strong>TensorFlow, Keras, PyTorch, JAX, XGBoost, LightGBM, CatBoost and
                Transformers have no browser build at all</strong> — the notebook saves fine, but nothing
                can run those cells in-browser; point students at the Colab link for that work instead.
                <code>input()</code> reads from the cell's pre-typed Input box rather than a real-time
                prompt.
            </div>

            <SectionTitle>C — Real clang, via WebAssembly</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Real clang plus a linker and sysroot, roughly 50MB on first start (cached after that).
                Warnings are on; <code>-Werror</code> is deliberately off, so a first-year exercise doesn't
                fail over an unused variable. <code>scanf</code>/<code>fgets</code> read from the same
                pre-typed Input box as Python's <code>input()</code> — a program that asks for more input
                than was supplied gets EOF, exactly like a real pipe.
            </div>

            <Note type="warning">
                <strong>Stop and Restart always throw away all kernel state</strong> in both languages —
                there is no true cooperative interrupt (it would need cross-origin-isolation headers this
                app doesn't send), so an infinite loop can only be killed by terminating the whole worker.
                Every variable from the previous run is gone, and hidden setup has to replay from scratch.
            </Note>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <Shot src={shotPlayer} alt="Student notebook view with a locked cell's output and a code cell with an error"
                caption="A student's notebook. The first cell is locked (they can run it, not edit it) and already shows its output; the second is theirs to write, currently erroring — exactly what you'd see mid-attempt." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Kernel start is lazy — nothing downloads until the student clicks <strong>Start</strong>, so opening a notebook just to read it costs nothing.</li>
                    <li><strong>Run all</strong> runs every code cell top to bottom in one go — order is the whole contract, since cells share one namespace (Python) or a copy-pasted prelude (C).</li>
                    <li>Autosave runs a couple of seconds after any edit; a badge shows saved / saving / unsaved / or, if the same notebook is open in two tabs, a conflict warning telling the student to reload rather than overwrite the newer copy.</li>
                    <li><strong>Submit warns it's final</strong>: "You will not be able to edit it afterwards." After submitting, cells can still be run to explore, but nothing more is saved.</li>
                    <li>If you enabled it, your own (source-only, no outputs) version of the notebook appears below theirs once they've submitted.</li>
                </ul>
            </div>
        </div>
    );
}

function TabGrade() {
    return (
        <div>
            <Shot src={shotSubmissions} alt="Notebook submissions list showing status, cells run and grade columns" />
            <Note type="danger">
                <strong>Marked by hand, on purpose — there is no autograder anywhere in this feature.</strong>
                Cell output is recorded from the student's own browser, so it shows what they saw, not
                anything the server independently verified — it is not tamper-proof, and the model's own
                schema comment is explicit that a stored output must never be the basis for a mark on its
                own. Grade the code; treat the output as a hint, not evidence.
            </Note>

            <SectionTitle>The Submissions Table</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Status (opened / in progress / submitted, with a late badge where relevant), cells run out
                of the total, and a <strong>Worked through</strong> summary — "every cell ran" in green, or a
                count of errored cells in yellow. Click <strong>Read</strong> to expand a submission inline.
            </div>

            <Shot src={shotSubmissionDetail} alt="Expanded submission showing code, recorded output, and a grade/feedback form"
                caption="Reading a submission. Every cell's code and recorded output, followed by a plain Grade / Out of / Feedback form — no rubric, no pre-filled score." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Grade</strong> and <strong>Out of</strong> are plain numbers you type — nothing is suggested or pre-filled from matching output.</li>
                    <li><strong>Feedback</strong> is free text, shown back to the student on their own notebook.</li>
                    <li><strong>Return grade</strong> saves it and mirrors into the class gradebook as returned.</li>
                    <li><strong>Reopen</strong> hands a submitted notebook back to the student for another go — useful when a submission needs a re-attempt rather than just a comment.</li>
                    <li><strong>PDF</strong>, per student, is the only export available — there is no CSV/bulk export for notebook results.</li>
                </ul>
            </div>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'There is no autograder and no test-case mechanism anywhere in this feature — recorded output is an unverifiable claim from the student\'s own browser, never proof.',
        'Language is locked in once a notebook is published — switching Python and C requires unpublishing first, and existing student code stays written for the old kernel regardless.',
        'Stop and Restart always wipe all kernel state in both languages — there is no true interrupt, so an infinite loop can only be killed by throwing away every variable.',
        'A Python package only installs when the kernel starts — adding one to Packages does nothing to an already-running kernel until it\'s restarted.',
        'TensorFlow, Keras, PyTorch, JAX, XGBoost, LightGBM, CatBoost and Transformers save fine but cannot run in-browser at all — the only way to give students that work is the Colab link, and it runs in their own Google account, not on this platform.',
        'A C notebook has no shared state between cells at all — every code cell must be a whole program with its own main(), and a hidden setup cell must not define one, or publishing is rejected.',
        'stdin (input() in Python, scanf/fgets in C) is read from a pre-typed Input box, once, in full — not a live, interactive prompt. Asking for more than was supplied returns EOF.',
        'Deadlines are advisory only — nothing locks submission at the due date; late work is simply flagged.',
        'Deleting a notebook deletes every student\'s attempt with it, with no separate "keep the notebook, wipe responses" option.',
        'The only export is a per-student PDF — there is no CSV or bulk export for notebook results.',
    ];
    return (
        <div>
            <Note type="warning">
                Ten things worth knowing before you set a coding notebook for real marks.
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

export default function CodingManual({ standalone = false }) {
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
        runtime:  <TabRuntime />,
        student:  <TabStudent />,
        grade:    <TabGrade />,
        gotchas:  <TabGotchas />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#1e3a8a', borderBottom: '1px solid #1e40af',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="cdm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                        }}>🐍</div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#dbeafe' }}>
                            Coding Notebooks — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#93c5fd',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #1e40af', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="cdm-page" style={{ fontFamily: T.fontBody }}>
                <div className="cdm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>🐍</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cdm-title" style={{ fontWeight: 800, color: T.text }}>Coding Notebooks — Teacher Manual</div>
                        <div className="cdm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Python and C, running entirely in the browser · XCEED Learning
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

                <div className="cdm-card" style={{
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
