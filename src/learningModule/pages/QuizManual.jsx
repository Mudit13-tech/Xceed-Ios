import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';

import shotQuizzesList from '../manualAssets/quiz/quizzes-list.png';
import shotCreateModal from '../manualAssets/quiz/create-quiz-modal.png';
import shotEditorQuestions from '../manualAssets/quiz/editor-questions.png';
import shotDeliveryTiming from '../manualAssets/quiz/editor-delivery-timing.png';
import shotMarking from '../manualAssets/quiz/editor-marking.png';
import shotProctoring from '../manualAssets/quiz/editor-proctoring.png';
import shotInstructions from '../manualAssets/quiz/editor-instructions.png';
import shotAccess from '../manualAssets/quiz/editor-access.png';
import shotPublishModal from '../manualAssets/quiz/publish-modal.png';
import shotResultsLiveMonitor from '../manualAssets/quiz/results-live-monitor.png';
import shotResultsQuestionAnalysis from '../manualAssets/quiz/results-question-analysis.png';
import shotResultsAnswerKey from '../manualAssets/quiz/results-answer-key.png';
import shotStudentBrief from '../manualAssets/quiz/student-quiz-brief.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#6366f1',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .qzm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .qzm-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .qzm-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .qzm-card { padding: 28px 32px; }
    .qzm-topbar { padding: 10px 28px; }
    .qzm-title { font-size: 20px; }
    .qzm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .qzm-grid-2, .qzm-grid-3 { grid-template-columns: 1fr; }
        .qzm-page { padding: 16px 12px; }
        .qzm-card { padding: 16px 14px; }
        .qzm-topbar { padding: 10px 12px; }
        .qzm-title { font-size: 16px; }
        .qzm-subtitle { font-size: 11px; }
        .qzm-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Step({ n, title, children }) {
    return (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: T.accent,
                    color: '#fff', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{n}</div>
                <div style={{ width: 2, flex: 1, background: '#e4e8f5', marginTop: 4 }} />
            </div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 6, paddingTop: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>{children}</div>
            </div>
        </div>
    );
}

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

function Screen({ label, children, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <div style={{
                borderRadius: 10, overflow: 'hidden',
                border: '1px solid #e4e8f5', boxShadow: '0 1px 8px rgba(26,31,60,0.10)',
            }}>
                <div style={{
                    background: '#1e1b4b', color: '#c7d2fe', fontSize: 11, fontWeight: 700,
                    padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
                    <span style={{ marginLeft: 6 }}>{label}</span>
                </div>
                <div style={{ background: '#fff', padding: '18px 20px' }}>{children}</div>
            </div>
            {caption && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{caption}</div>
            )}
        </div>
    );
}

function StudentCountdownMock() {
    return (
        <Screen label="Student view — the quiz link before the paper opens"
            caption="The countdown page. A student who opens the link early lands here; it unlocks itself when the start time arrives, with no reload.">
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Unit 3 — Z-Transform Midterm</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, marginBottom: 14 }}>
                20 questions · 40 marks · 60 minutes · Safe Exam Browser required
            </div>
            <div style={{
                background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10,
                padding: '16px 18px', textAlign: 'center', marginBottom: 14,
            }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#4338ca', textTransform: 'uppercase' }}>Starts in</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: '#312e81', fontFamily: "'IBM Plex Mono', monospace", margin: '4px 0' }}>00:12:47</div>
                <div style={{ fontSize: 11, color: '#4c51bf' }}>Opens 10:00 — this page unlocks itself, so stay here.</div>
            </div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8, marginBottom: 14 }}>
                <strong>Before you start</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                    <li>One question at a time — you cannot go back to a previous question.</li>
                    <li>The test runs fullscreen. Leaving fullscreen or switching app ends it.</li>
                    <li>The keyboard is locked; numerical answers use the on-screen keypad.</li>
                    <li>Your time starts when you press Start test.</li>
                </ul>
            </div>
            <div style={{
                background: '#e5e7eb', color: '#9ca3af', borderRadius: 8, padding: '10px 16px',
                fontSize: 13, fontWeight: 700, textAlign: 'center',
            }}>Start test (locked until the countdown ends)</div>
        </Screen>
    );
}

function StudentQuestionMock() {
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '−'];
    return (
        <Screen label="Student view — one question at a time, keyboard locked"
            caption="The question page. Only one question is on screen; there is no Back. A numerical answer is typed on the on-screen keypad, because the physical keyboard is dead.">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.accent }}>Question 3 of 20</div>
                <div style={{
                    fontSize: 13, fontWeight: 800, color: '#b45309', background: '#fffbeb',
                    border: '1px solid #fde68a', borderRadius: 999, padding: '3px 12px',
                    fontFamily: "'IBM Plex Mono', monospace",
                }}>42:11 left</div>
            </div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7, marginBottom: 12 }}>
                The ROC of a causal LTI system includes |z| = 1. Give the settling value of its step
                response, correct to two decimals.
            </div>
            <div className="qzm-grid-2" style={{ marginBottom: 12 }}>
                <div style={{ border: '1px solid #e4e8f5', borderRadius: 8, padding: '10px 12px', fontSize: 13, background: '#f8f9ff' }}>
                    Answer: <strong style={{ fontFamily: "'IBM Plex Mono', monospace" }}>1.25</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {keys.map(k => (
                        <div key={k} style={{
                            border: '1px solid #e4e8f5', borderRadius: 6, padding: '8px 0',
                            textAlign: 'center', fontSize: 13, fontWeight: 700, color: T.text, background: '#fff',
                        }}>{k}</div>
                    ))}
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: T.textMuted }}>⬅ Back is not available on this paper.</div>
                <div style={{ background: T.accent, color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700 }}>
                    Save &amp; next →
                </div>
            </div>
        </Screen>
    );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Overview',          icon: '🗂️' },
    { id: 'create',   label: 'Create & Author',   icon: '✏️' },
    { id: 'publish',  label: 'Publish',           icon: '🚀' },
    { id: 'settings', label: 'Settings',          icon: '⚙️' },
    { id: 'monitor',  label: 'Monitor & Fix',     icon: '🛰️' },
    { id: 'letin',    label: 'Let a Student In',  icon: '🚪' },
    { id: 'lockout',  label: 'Locked Out of SEB', icon: '🔒' },
    { id: 'grade',    label: 'Grade & Release',   icon: '✅' },
    { id: 'analytics',label: 'Analytics',         icon: '📊' },
    { id: 'gotchas',  label: 'Gotchas',           icon: '⚠️' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview({ setTab }) {
    return (
        <div>
            <Note type="key">
                The Quizzes &amp; exams tab inside a class turns any set of questions into a timed,
                proctored test — from a two-minute recap quiz to a fullscreen, Safe-Exam-Browser-locked
                midterm. Everything below happens on one screen per class:
                <strong> Class → Quizzes &amp; exams</strong>.
            </Note>

            <Shot src={shotQuizzesList} alt="Quizzes & exams list for a class"
                caption="The Quizzes & exams tab. Each card is one paper — its type, publish state, and the actions available for that state." />

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: '#f8f9ff', borderRadius: 12,
                border: '1px solid #e4e8f5', overflow: 'hidden', marginBottom: 24, flexWrap: 'wrap',
            }}>
                {[
                    { id: 'create',   icon: '✏️', label: 'Create & author', sub: 'Pick a format · write questions' },
                    { id: 'publish',  icon: '🚀', label: 'Publish',         sub: 'Share the link · schedule the window' },
                    { id: 'settings', icon: '⚙️', label: 'Configure',       sub: 'Usually: leave the defaults' },
                    { id: 'monitor',  icon: '🛰️', label: 'Monitor',         sub: 'Attendance · let students back in' },
                    { id: 'grade',    icon: '✅', label: 'Grade & release', sub: 'Answer key · publish results' },
                ].map((s, i, arr) => (
                    <div key={s.id} style={{
                        flex: '1 1 140px', padding: '16px 14px', textAlign: 'center',
                        borderRight: i < arr.length - 1 ? '1px solid #e4e8f5' : 'none',
                        cursor: 'pointer',
                    }} onClick={() => setTab(s.id)}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: T.accent }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            <SectionTitle>The Short Version — Leave the Defaults</SectionTitle>
            <Note type="tip">
                For an ordinary classroom exam, <strong>change nothing</strong>. The exam type a new paper
                starts with — <em>Exam — one question at a time, one timer</em>, with backtracking off —
                and every default in Settings are already the right answer for almost every sitting.
                Write the questions, publish, and hand out the link.
            </Note>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                What those defaults give you, and why they are worth keeping:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>One question at a time, and no way back.</strong> A student sees a single
                        question, answers it, and moves on — the previous question is gone for good. This
                        alone closes most of the classroom cheating routes: there is no whole paper to
                        photograph, to pass around, or to work through out of order with a neighbour.</li>
                    <li><strong>Questions are drawn at random for each student, and the options are
                        shuffled for each student.</strong> Two students sitting side by side are rarely on
                        the same question, and even when they are, option (b) is not the same option (b).</li>
                    <li><strong>The keyboard is locked</strong> for the whole sitting — every answer is
                        clicked, and a numerical answer is typed on an on-screen keypad.</li>
                    <li><strong>Fullscreen lockdown</strong> is always on, whatever else you change.</li>
                </ul>
            </div>
            <Note type="warning">
                It is agreed that this is harder for students: no skipping ahead, no coming back to a
                question later, no second look. <strong>Set the paper accordingly</strong> — fewer
                questions, each answerable on its own without reference to another, and a time limit that
                assumes a student meets each question cold and answers it once.
            </Note>

            <SectionTitle>Quiz or Exam?</SectionTitle>
            <div className="qzm-grid-3" style={{ marginBottom: 20 }}>
                {[
                    { icon: '📝', title: 'Quiz — one page, one timer', desc: 'All questions on one page, answered in any order, answers shown on submit. One countdown for the whole paper. Best for a low-stakes recap.' },
                    { icon: '🎓', title: 'Exam — one question at a time', desc: 'Questions are handed out one at a time under a single countdown for the whole paper. Each student sees their score as they submit; worked answers stay held back until released.' },
                    { icon: '⏱️', title: 'Exam — a timer per question', desc: 'Every question carries its own allowance and moves on by itself when it runs out. No overall clock — placement-test behaviour.' },
                ].map(c => (
                    <div key={c.title} style={{
                        background: '#fff', border: '1px solid #e4e8f5',
                        borderRadius: 10, padding: '14px 16px',
                    }}>
                        <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{c.desc}</div>
                    </div>
                ))}
            </div>
            <Note type="info">
                Only one clock ever runs, and the choice stays editable afterwards from the quiz's
                <strong> Settings → Delivery &amp; timing</strong> tab — nothing here is locked in at creation.
            </Note>

            <SectionTitle>What Each Card Tells You</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Look at the <strong>Unit 3 — Z-Transform Midterm</strong> card in the screenshot above:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>EXAM · PUBLISHED · COMPLETED</strong> badges — its format, whether students can see it, and whether the window has finished.</li>
                    <li>Question count, total marks, and time limit.</li>
                    <li>A running line of how many attempts are <strong>writing</strong>, how many were <strong>terminated</strong> by proctoring, and how many have <strong>submitted</strong>.</li>
                </ul>
            </div>

            <SectionTitle>The Icons on a Card</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                The wordless controls sit together in the card&apos;s top corner, in the order they are
                reached for. Hover any of them for the same description:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {[
                    { icon: '⚙️', name: 'Settings', desc: 'Delivery & timing, marking, proctoring, instructions and access — the gear opens the same five tabs described on the Settings tab.' },
                    { icon: '🕒', name: 'Schedule — the timer button', desc: 'Only on a published paper. Reopens the Schedule dialog so you can move the start time, the entry cut-off, the closing time or the results time after the paper is already live. This is the button to reach for whenever a timing needs to change.' },
                    { icon: '⬇️', name: 'Download the paper', desc: 'A menu with two documents: Questions only, and Questions with answers. The second carries the answer key — mind who is behind you when you open it.' },
                    { icon: '🗑️', name: 'Delete quiz', desc: 'Removes the paper and everything attached to it.' },
                ].map(r => (
                    <div key={r.name} style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '10px 14px',
                    }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>
                            <strong>{r.name}</strong> — {r.desc}
                        </div>
                    </div>
                ))}
            </div>

            <SectionTitle>The Buttons on a Card</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                The labelled buttons change with the paper&apos;s state:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Publish</strong> — on a draft. Opens the Schedule dialog and mints the student link.</li>
                    <li><strong>Edit</strong> — the question editor.</li>
                    <li><strong>🧾 Attendance</strong> — on a published paper. The hall register, taken down the class roster. This is also where a paper is <strong>terminated</strong> — see Monitor &amp; Fix.</li>
                    <li><strong>Live control</strong> — while the paper is running. Who is writing, who has been shut out, and <strong>Let in</strong> — see the Let a Student In tab.</li>
                    <li><strong>🔑 Access code</strong> — only on a paper that requires Safe Exam Browser. One code, shown once, for a student whose machine genuinely cannot run SEB — see the Locked Out of SEB tab for what it does <em>not</em> cover.</li>
                    <li><strong>Results</strong> — scores, analysis and the answer key, live from the first submission.</li>
                </ul>
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Starting a New Paper</SectionTitle>
            <Step n={1} title="Open Create quiz">
                From the Quizzes &amp; exams tab, click <strong>+ Create quiz</strong>. If you already
                recorded the class, <strong>✨ Generate from a recording</strong> sends you to the AI
                Studio instead, which can draft questions from that recording for you to review here afterwards.
            </Step>
            <Shot src={shotCreateModal} alt="Create a quiz modal, showing title, description and delivery mode"
                caption="Create a quiz. The delivery mode chosen here decides the whole paper's shape — see Quiz or Exam? on the Overview tab." />
            <Step n={2} title="Title and description">
                The title is what students see on the card and on their own paper. The description is
                shown to students before they start — use it for scope, not instructions (those live in
                Settings → Instructions, shown right before the questions).
            </Step>
            <Step n={3} title="Pick how it runs — or just leave it alone">
                The dialog opens on <strong>Exam — one question at a time, one timer</strong>, with
                <strong> going back to earlier questions switched off</strong>. That is the recommended
                setup for a real exam and there is usually no reason to change it: one question on screen,
                answered once, and gone. Set the whole-paper time limit here (blank or 0 for untimed).
            </Step>
            <Step n={4} title="Safe Exam Browser, if this is a locked-down test">
                <strong>Require Safe Exam Browser to sit this paper</strong> is ticked by default for a
                new quiz. Leave it on for anything you want proctored; turn it off for an open-book or
                classroom quiz. This can be changed later from Settings → Proctoring.
            </Step>
            <Step n={5} title="Create">
                Saving takes you straight into the question editor with an empty paper — nothing is
                visible to students yet. A quiz only becomes visible once you publish it (see the Publish tab).
            </Step>

            <SectionTitle>Writing Questions</SectionTitle>
            <Shot src={shotEditorQuestions} alt="Question editor showing three authored questions"
                caption="The Questions tab of the editor. Each question is its own card with type, difficulty, marks and a rich-text body." />
            <Step n={1} title="Add a question">
                Click <strong>+ Add question</strong> at the bottom of the list, or <strong>Duplicate</strong>
                on an existing card to reuse its structure.
            </Step>
            <Note type="key">
                On a question card, the only field you actually have to choose is the
                <strong> type</strong>. Difficulty, marks, negative marking, per-question time, section,
                topic and the explanation are all <strong>optional</strong> — leave them as they come
                unless this particular question needs something specific. A paper of plain typed questions
                with their correct options ticked is a complete, publishable paper.
            </Note>
            <Step n={2} title="Choose a type — the one required field">
                Four question types are available: <strong>Single correct</strong>, <strong>Multiple
                correct</strong>, <strong>True / False</strong>, and <strong>Numerical / integer</strong>.
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Multiple correct is all-or-nothing.</strong> The student must select
                        <em> every</em> correct option, and no incorrect one, to be given the marks.
                        There is <strong>no partial marking</strong> — three right out of four scores the
                        same as none. Tell your class this in the instructions; it changes how they answer.</li>
                    <li><strong>Numerical</strong> takes a correct value plus a <strong>tolerance</strong>
                        as a percentage, an absolute amount, or both — anything inside the tolerance counts
                        as correct. Because the keyboard is locked during the sitting, students type the
                        number on an <strong>on-screen keypad</strong>, clicking the digits (see the screen
                        below). Keep answers short — a long decimal is a lot of clicking.</li>
                </ul>
            </Step>
            <Step n={3} title="Set difficulty, marks and negative marking">
                Each question has its own <strong>Marks</strong> and an optional <strong>Negative</strong>
                override (leave it as <em>default</em> to inherit the paper-wide negative marking set in
                Settings → Marking). Difficulty (Easy / Medium / Hard) feeds the Question analysis report
                after the quiz runs, so tag it honestly.
            </Step>
            <Step n={4} title="Per-question timing — only in one mode">
                The <strong>Time (seconds)</strong> field is only editable when the paper uses <em>a timer
                on each question</em>. In the other two modes it is greyed out with a note that one clock
                already covers the whole paper — there is deliberately no way to mix a per-question clock
                with a paper-wide one.
            </Step>
            <Step n={5} title="Section and topic">
                <strong>Section</strong> groups questions for the Sections tab in Settings and for the
                per-section breakdown in results. <strong>Topic</strong> is a free-text tag that shows up
                next to the question in Question analysis — useful for spotting which topic the class
                struggled with, not just which question number.
            </Step>
            <Step n={6} title="Options, explanation and duplicate detection">
                Tick the correct option(s) — a checkbox for Multiple correct, a radio for the others. The
                free-text box under the options is the <strong>explanation</strong> shown to students after
                they submit, if you allow it (Settings → Marking). The editor also flags options that look
                like duplicates of each other so you notice a copy-paste slip before publishing.
            </Step>
            <SectionTitle>What the Question Looks Like to a Student</SectionTitle>
            <StudentQuestionMock />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>One question fills the screen. <strong>There is no Back</strong> — pressing
                        Save &amp; next is final for that question.</li>
                    <li>Which questions a student gets, and in what order their options appear, is
                        <strong> decided per student</strong> — questions are picked at random from the bank
                        and the options are shuffled independently for everybody.</li>
                    <li>The paper clock in the corner is the only clock; it started when they pressed
                        Start test, not when you published.</li>
                    <li>With the keyboard locked, a numerical answer is entered on the keypad shown here.
                        Everything else is clicked.</li>
                </ul>
            </div>

            <Note type="tip">
                Use <strong>Import questions</strong> (next to Add question) to pull questions in bulk
                instead of typing each one by hand — useful when reusing a bank from a previous paper or
                a document prepared offline.
            </Note>

            <SectionTitle>Sections</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16, fontSize: 13, color: '#374151', lineHeight: 1.7,
            }}>
                The <strong>Sections</strong> tab (next to Questions, inside the editor) lets you name
                groups of questions — e.g. <em>Section A — Concepts</em>, <em>Section B — Problems</em> —
                which then appear as their own tab in the results (marks and success rate per section) and
                as a heading on the student's paper.
            </div>
        </div>
    );
}

function TabSettings() {
    return (
        <div>
            <Note type="key">
                Every paper's settings are split into five tabs — <strong>Delivery &amp; timing</strong>,
                <strong> Marking</strong>, <strong>Proctoring</strong>, <strong>Instructions</strong> and
                <strong> Access</strong> — reached from the gear icon on a quiz's card, or the tabs at the
                top of the editor once you are inside a paper.
            </Note>

            <Note type="tip">
                <strong>For a normal exam, leave every one of these at its default.</strong> The defaults
                are already the strict setup: one question at a time with no way back, questions drawn per
                student, options shuffled per student, keyboard locked, fullscreen enforced. Read this tab
                to know what each switch does — then change one only when this particular paper needs it.
                Most trouble on exam day comes from a setting somebody turned on, not from one they left alone.
            </Note>

            <SectionTitle>Delivery &amp; Timing</SectionTitle>
            <Shot src={shotDeliveryTiming} alt="Delivery and timing settings tab" />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>How this paper runs</strong> — the same three-way delivery choice as at creation, still editable here.</li>
                    <li><strong>Opens at</strong> — when the Start button unlocks; blank lets students start as soon as you publish.</li>
                    <li><strong>Entry closes at</strong> — nobody may begin after this. Anyone already sitting keeps their full remaining time.</li>
                    <li><strong>Test closes at</strong> — after this, nobody can open the paper and any sitting still running is submitted automatically. This is also the due date shown on the class stream.</li>
                    <li><strong>Results announced at</strong> — blank shows each student their result as they submit; a time here holds every result back until then, for everyone at once.</li>
                </ul>
            </div>
            <Note type="info">
                Entry closing is not the same as the test closing — you can cut off <em>new</em> starts
                early while letting students already writing finish on their own clock.
            </Note>

            <SectionTitle>Marking &amp; Randomisation</SectionTitle>
            <Shot src={shotMarking} alt="Marking and randomisation settings tab" />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Negative marking (default)</strong> — marks deducted for a wrong answer, unless a question overrides it. Never applied to a question left unanswered.</li>
                    <li><strong>Pass mark (%)</strong> — feeds the pass-rate stat in results; has no effect on what a student can do.</li>
                    <li><strong>Questions per student</strong> — 0 means everyone gets every question; a number above 0 draws that many at random per student from the full bank, so each student's achievable total can differ.</li>
                    <li><strong>Shuffle question order / options per student</strong> — randomises order independently for each student, so no two students are looking at the same screen at the same moment and option (b) on one laptop is not option (b) on the next (True/False is left alone). Leave both on.</li>
                    <li><strong>Multiple-correct questions are marked all-or-nothing</strong> — a student must tick every correct option and no incorrect one. There is no partial-marking setting to turn on; this is not configurable.</li>
                    <li><strong>Show correct answers and explanations after submitting</strong> — off by default; turn on for a formative quiz where seeing the answer key immediately helps learning.</li>
                    <li><strong>Show the score immediately</strong> — subject to the release time set in Delivery &amp; timing; this only controls whether a number is shown at all.</li>
                </ul>
            </div>

            <SectionTitle>Proctoring</SectionTitle>
            <Shot src={shotProctoring} alt="Proctoring settings tab, including the Safe Exam Browser panel" />
            <Note type="warning">
                Deterrents, not guarantees — a determined student can defeat any single one of these.
                What makes them useful is that every event is recorded on the attempt for you to review afterwards.
            </Note>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Fullscreen lockdown is always on</strong> and cannot be turned off — leaving fullscreen, or switching tab, window or application, submits the attempt immediately and records the reason.</li>
                    <li><strong>Proctored — load the next question ahead</strong> (on by default, and worth keeping on) pre-fetches the next question so Next feels instant; where backtracking is allowed the questions are sent encrypted and only decrypted as the student reaches them. Turning it <em>off</em> is the <strong>high-security</strong> mode — nothing whatsoever is in the browser ahead of time. See the bandwidth warning below before you use it.</li>
                    <li><strong>Discourage mobile devices</strong> turns away browsers that identify as phones — a nudge, trivially bypassed, not a real control.</li>
                    <li><strong>Block the keyboard, warn twice, then submit</strong> — the keyboard is <strong>completely locked</strong> for the whole sitting; there is no legitimate use of it once this is on, since every answer is clicked (a numerical answer gets an on-screen keypad). This closes the gap a hotkey-summoned desktop assistant opens. Every key press is swallowed and recorded on the attempt: the <strong>first</strong> press gets an on-screen warning, the <strong>second</strong> press gets a second warning, and the <strong>third</strong> press submits the paper automatically. It does <strong>not</strong> catch an assistant summoned by voice — see the Gotchas tab.</li>
                    <li><strong>Disable copy, cut and paste</strong> / <strong>Disable right-click</strong> — self-explanatory browser-level restrictions.</li>
                    <li><strong>Offer an on-screen scientific calculator</strong> — turn this off for a paper where the arithmetic itself is the point.</li>
                </ul>
            </div>

            <Note type="danger">
                <strong>High security costs bandwidth.</strong> With &ldquo;load the next question ahead&rdquo;
                turned off, each question is fetched from the server only <em>after</em> the student submits
                the previous answer — so every Next in the hall is a fresh round-trip, and a whole batch
                starting together hits the network at the same moments. On our NITJ wifi this has caused
                real problems: long pauses on Next, and students dropped mid-paper.
                <strong> Leave this setting at its default (on)</strong> unless you have a specific reason and
                a connection you trust. In general, <strong>the safest choice for network reliability is to
                keep every default in Settings.</strong>
            </Note>
            <Note type="info">
                <strong>Internet connectivity is the single most common problem on exam day</strong> —
                ahead of SEB, ahead of proctoring, ahead of anything in this manual. A dropped connection
                ends a sitting, and the student then appears under <strong>Shut out</strong> in Live control,
                where <strong>Let in</strong> hands the paper straight back with every answer intact. Expect a
                few of these in any large sitting and treat them as routine — see the Let a Student In tab.
            </Note>

            <SectionTitle>Safe Exam Browser (SEB)</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Tick <strong>Require Safe Exam Browser</strong> for the strongest lockdown: the paper can
                only be opened inside SEB, a kiosk browser students install beforehand that shuts out
                every other application for the duration.
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Exam settings file (optional)</strong> — leave it blank to use the institution's shared configuration. Upload your own <code>.seb</code> file (built with SEB's free Configuration Tool) plus its Config Key only if this paper needs a lockdown of its own; both must come from the same saved file.</li>
                    <li><strong>Siri / dictation warning</strong> — clear <code>allowSiri</code> and <code>allowDictation</code> in the Configuration Tool's macOS settings before saving a custom file. A spoken trigger produces no keystroke, no focus change and no fullscreen exit, so nothing in the module can detect it — SEB refusing to run alongside a voice assistant is the only thing that stops it, and only if the file says so.</li>
                    <li><strong>Access code, for a student without SEB</strong> — one shared code you generate and hand out yourself lets a specific student into the test from an ordinary browser, for the real, known reasons SEB sometimes cannot run (e.g. an unsupported OS). Every use is still recorded on the attempt it unlocks. Generating a new code immediately retires the old one.</li>
                </ul>
            </div>
            <Note type="warning">
                Three things must all be in place before an SEB-locked paper will work: every student needs
                Safe Exam Browser <strong>installed on their own device beforehand</strong> — it cannot be
                installed in the exam hall at the last minute — if you have uploaded a custom exam
                settings file, it must actually <strong>whitelist the XCEED site/app</strong> (the exam URL)
                as a permitted destination, and the student's laptop must have <strong>no desktop-sharing
                or remote-access app installed</strong> (TeamViewer, AnyDesk, Chrome Remote Desktop, and
                similar). SEB refuses to launch at all while one of these is present, even if it is not
                currently running — students should uninstall it, not just close it, before the exam. A
                config file that does not allow XCEED, or a leftover remote-access app, both look identical
                to a broken link from the student's side.
            </Note>
            <Note type="tip">
                Run a short, ungraded <strong>mock quiz with Safe Exam Browser required</strong> a day or two
                before any high-stakes exam. It surfaces install problems, blocked downloads, remote-access
                apps students forgot were installed, and misconfigured settings files while there is still
                time to fix them, instead of during the real sitting.
            </Note>

            <SectionTitle>What Gets Blocked, All Together</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Between the module's own proctoring toggles and Safe Exam Browser's kiosk mode, a locked-down
                sitting blocks:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Leaving the paper</strong> — fullscreen exit, switching tab, switching window, or switching application all end the attempt immediately (always on, not optional).</li>
                    <li><strong>The keyboard</strong> — fully locked when the setting is on; every keypress is intercepted, warned twice, then submits the paper (see above).</li>
                    <li><strong>Copy, cut, paste, and right-click</strong> — when their toggles are on.</li>
                    <li><strong>Every other application on the machine</strong> — SEB is a kiosk browser; nothing else can run alongside it. This is also why a leftover remote-access app (TeamViewer, AnyDesk, etc.) stops SEB from opening at all — see the warning above.</li>
                    <li><strong>Task switching, screenshots, and screen recording</strong> — blocked by SEB itself while it is running.</li>
                    <li><strong>Siri / dictation</strong> — only if your custom exam settings file explicitly disables them; the shared institutional configuration may not.</li>
                    <li><strong>Voice assistants triggered by a spoken word</strong> — <em>not</em> blocked by anything in this module or by SEB's keyboard/fullscreen rules, because a spoken trigger produces none of the events either watches for.</li>
                </ul>
            </div>
            <Note type="danger">
                No software lockdown is complete. A student can still attempt to cheat using a
                <strong> virtual machine or a second physical device</strong> that SEB cannot see or block —
                these are known limitations, not oversights. Automated proctoring is a first line of defence,
                not the only one: for a high-stakes exam it is advisable to also have <strong>human
                invigilators (e.g. PhD students or TAs) physically walk the room and watch student
                screens</strong>, the same as you would for a paper exam.
            </Note>
            <Note type="info">
                The module also runs background anomaly detection on attempt activity and surfaces it as the
                <strong> "N attempt(s) recorded a proctoring event"</strong> banner on the Results page.
                Treat a flag as exactly that — a prompt to go and look at that student's laptop or attempt
                log yourself — <strong>not</strong> as proof that the student cheated. Confirm what actually
                happened before taking any action against a flagged student.
            </Note>

            <SectionTitle>Instructions</SectionTitle>
            <Shot src={shotInstructions} alt="Instructions settings tab" />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Shown on the pre-test screen, before any question is handed out. The delivery, timing and
                proctoring rules you set elsewhere are described to the student automatically — use this
                box only for anything specific to this particular test (permitted materials, rough-work
                rules, and so on), one instruction per line.
            </div>

            <SectionTitle>Access</SectionTitle>
            <Shot src={shotAccess} alt="Access settings tab, showing collaborators and the danger zone" />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Collaborators</strong> — give another staff member edit access to this one quiz without making them a teacher of the whole class. A collaborator who already has an account shows in green; one entered by email who has never signed in shows amber, <em>(no account yet)</em>, until they do.</li>
                    <li><strong>Danger zone — Delete all responses</strong> clears every attempt so the same cohort can sit the test again from a clean slate. This also resets their gradebook entries for this quiz — there is no undo.</li>
                </ul>
            </div>
        </div>
    );
}

function TabPublish() {
    return (
        <div>
            <Note type="key">
                A quiz is invisible to students until you publish it. Publishing opens the <strong>Schedule</strong>
                dialog — the one place all the timing decisions come together into a single timeline — and
                hands you the <strong>link</strong> to give your class.
            </Note>

            <Shot src={shotPublishModal} alt="Schedule for a quiz — the publish modal with its numbered steps"
                caption="The Schedule dialog, opened from Publish. Note: the first field, Published at, is only asked while a paper is still unpublished, which is why it is absent from this screenshot of an already-live paper." />

            <Step n={1} title="Published at — when the link starts working">
                This is the moment the quiz appears in the class and <strong>the link starts answering</strong>
                — in other words, the time at which students actually get the link. Nothing starts yet:
                a student who opens it now sees the instructions and a <strong>countdown to the start
                time</strong>, not the paper. Leave it as-is to publish immediately, which is what most
                teachers want; set a future time to have the link go live by itself later.
                <br />
                <em>The field is only asked once, while the paper is unpublished</em> — once published,
                the link exists and the question no longer applies, which is why it does not appear on the
                screenshot above.
            </Step>
            <Step n={2} title="Students can start">
                When the Start button unlocks. Until then the link shows only the instructions and the
                countdown below. Leave it blank to let students start the moment they open the link.
            </Step>
            <Step n={3} title="Last time to start (late-comers turned away)">
                Toggle this on to set a hard cut-off for <em>new</em> starts. Nobody may begin after this
                time; students already sitting the paper keep their full time and finish normally.
            </Step>
            <Step n={4} title="Test closes (paper ends for everyone)">
                After this, nobody can open the paper and any sitting still in progress is submitted as-is.
                This is also the due date shown on the class stream. Leave it blank for a paper with no closing time.
            </Step>
            <Step n={5} title="Results announced — the one choice that matters most">
                Pick <strong>As each student submits</strong> (their score appears on their own paper the
                moment they finish) or <strong>At a set time, for the whole class together</strong> (nobody
                sees a mark, however early they finish, until the time you set arrives). This choice governs
                the entire class&apos;s experience and is effectively irreversible once students start submitting
                under it — decide before you publish, not after.
            </Step>
            <Step n={6} title="Save &amp; publish, then copy the link">
                Saving validates the whole timeline — a paper that opens before its link exists, a start time
                after the entry cut-off, an entry cut-off after the test closes, or a result time before the
                test closes will all block the save with an explanation, so you cannot publish a paper nobody
                can complete. The dialog then shows <strong>Share this link</strong>: that is the address to
                give your class. It is the same link for everyone; each student&apos;s own attempt is created
                when they open it.
            </Step>

            <SectionTitle>What the Student Sees on That Link</SectionTitle>
            <StudentCountdownMock />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>From <strong>Published at</strong> onwards, the link opens this page for anybody in the class.</li>
                    <li>Until the start time, it shows a <strong>live countdown — &ldquo;Starts in&rdquo;</strong> — and the
                        Start button stays locked. The page unlocks itself when the countdown reaches zero;
                        students do not need to reload, and should be told to simply leave it open.</li>
                    <li>A student&apos;s own clock starts when they press <strong>Start test</strong>, not when the
                        window opens — so arriving a few minutes late costs them nothing but the entry cut-off.</li>
                </ul>
            </div>

            <SectionTitle>Changing a Timing Afterwards</SectionTitle>
            <Note type="tip">
                Every field above stays editable after publishing. On the quiz card, click the
                <strong> 🕒 timer icon (Schedule)</strong> — it reopens this same dialog on a live paper so you
                can push a deadline back, open a scheduled release early, or extend the closing time
                mid-sitting. That icon is the answer whenever a timing needs to move; you do not need to
                unpublish or re-share the link, which never changes. The one exception is the
                results-announcement <em>mode</em>, which should be treated as final once students are writing.
            </Note>

            <Note type="warning">
                Publishing is blocked if the paper has no questions yet, or if any question is missing its
                own timer while the paper uses <em>a timer on each question</em> mode.
            </Note>
        </div>
    );
}

function TabMonitor() {
    return (
        <div>
            <Note type="key">
                Two controls run a sitting, and they do different jobs.
                <strong> 🧾 Attendance</strong> is the register — the whole class roster, including the
                students who never appeared — and it is also where a paper is stopped.
                <strong> Live control</strong> is built from attempts — who is writing right now, and who has
                been shut out and needs letting back in.
            </Note>

            <SectionTitle>Attendance — the Hall Register</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
                Click <strong>🧾 Attendance</strong> on a published quiz&apos;s card. It lists every enrolled
                student, in roll-number order, whether or not they have started — which is exactly who an
                absence needs to be recorded against. Walk the hall with this open.
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Each row carries, left to right:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li>The student&apos;s <strong>roll number</strong> badge and name.</li>
                    <li>A register badge — <span style={{ color: T.success, fontWeight: 700 }}>Present</span>,
                        <span style={{ color: T.danger, fontWeight: 700 }}> Absent</span>, or
                        <span style={{ color: T.textMuted, fontWeight: 700 }}> Not marked</span> (grey, the state
                        every row starts in).</li>
                    <li>A blue <strong>writing</strong> badge if they have a sitting in progress right now.</li>
                    <li>Their email, and the sitting&apos;s state — <em>Sitting: in progress</em>,
                        <em> Sitting: submitted</em>, or <em>Has not started</em> — plus who marked them and when,
                        once somebody has.</li>
                </ul>
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                And three actions:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong style={{ color: T.success }}>Present</strong> — marks the register. Nothing happens to their paper.</li>
                    <li><strong style={{ color: T.danger }}>Absent</strong> — for a student who never appeared, one tap.
                        For a student who <em>is</em> writing it asks a second time
                        (<em>&ldquo;Absent — end their test&rdquo;</em>), because marking them absent also
                        <strong> ends their sitting</strong>. Nothing is destroyed: the paper lands in Live
                        control&apos;s <em>Shut out</em> list with its answers, and Let in hands it back.</li>
                    <li><strong style={{ color: T.warning }}>Terminate</strong> — only offered on a row that is
                        actually writing. Ends that student&apos;s paper on the spot, with a second tap to confirm.
                        This is the control for catching somebody in the act. It leaves the register mark alone —
                        a student stopped for cheating was present, and the register should still say so.</li>
                </ul>
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                At the top: a <strong>search box</strong> (name, email or roll number) and
                <strong> Mark all writing present (N)</strong>, which marks everybody currently mid-paper in one
                click — take the register with that, then walk the room for the exceptions.
            </div>
            <Note type="tip">
                Attendance and Live control cross-check each other: a student shown as <em>writing</em> on
                screen should also be a body in the room. Marking the register is what actually confirms it.
            </Note>

            <SectionTitle>Live Exam Control</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Click <strong>Live control</strong> on a published quiz&apos;s card while it is running. The panel
                refreshes itself every few seconds — no need to reload the page. It has three lists:
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Writing now</strong> — everyone mid-paper, with their progress and time left.
                        This list is <strong>read-only</strong>: to stop somebody&apos;s paper, use
                        <strong> Attendance</strong>, which lists the whole hall and carries Terminate on the row.</li>
                    <li><strong>Shut out</strong> — sittings that ended themselves: a dropped connection, the
                        window closing, a proctoring rule tripping, or a termination you just issued.
                        <strong> Let in</strong> hands the paper straight back — see the next tab.</li>
                    <li><strong>Submitted or closed</strong> — finished papers, for reference.</li>
                    <li><strong>Safe Exam Browser status</strong> — how many of the students currently writing are
                        actually inside SEB, counted live.</li>
                </ul>
            </div>
            <Note type="info">
                The same actions are available per student from the full <strong>Results</strong> page&apos;s Live
                monitor tab. Live control is the faster route during an actual sitting, since it refreshes itself.
            </Note>

            <SectionTitle>The Three Repair Actions</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Available on any attempt, from Live control or the Results page — each opens a confirmation
                spelling out exactly what happens before anything is touched:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>▶️ Let in / Reopen — continue.</strong> The student keeps every answer already given and resumes where they left off. Use this when the test ended for a reason that was not their doing — a dropped connection, a dead battery, the window closing mid-paper. <em>This is the one you will use most.</em></li>
                    <li><strong>🔄 Restart as a new test.</strong> Everything they answered is deleted and they sit the test again from question 1, on a freshly shuffled paper. Their old score goes with it. Use this for a genuine do-over, not a continuation.</li>
                    <li><strong>🗑 Delete this response.</strong> Removes the sitting and its score, and frees the attempt slot so the student can start again themselves — but only while the quiz window is still open. Once it has closed, use Restart instead.</li>
                </ul>
            </div>
        </div>
    );
}

function TabLetIn() {
    return (
        <div>
            <Note type="key">
                <strong>Let in</strong> is how you give a student their paper back. Anybody whose sitting
                ended — dropped wifi, a flat battery, a proctoring rule, a termination you issued, or SEB
                falling over — appears under <strong>Shut out</strong> in Live control, and one click returns
                the paper with every answer they had already given, at the question they were on.
            </Note>

            <SectionTitle>Step by Step</SectionTitle>
            <Step n={1} title="Open Live control on the quiz card">
                Only a published, currently-running paper has the button. The panel refreshes itself.
            </Step>
            <Step n={2} title="Find them under Shut out">
                Each row shows the student, a badge for how the sitting ended (<em>terminated</em> or
                <em> expired</em>), the reason recorded on it, and how long ago it happened. Use the search box
                for a name, email or roll number if the list is long.
            </Step>
            <Step n={3} title="Check the Minutes box">
                It is pre-filled with a sensible number: <strong>the time that was still on their clock when
                the paper was taken away, plus the time they have spent waiting since.</strong> Hover the
                Let in button to see that working. Type over it to give more or less — this is also how you
                simply <strong>extend a student&apos;s time</strong>, whatever the reason.
            </Step>
            <Step n={4} title="Only tick “Let them back in without Safe Exam Browser” if SEB is the problem">
                The checkbox appears on SEB-required papers and applies to <em>every</em> student you let in
                from the panel while it is ticked. Leave it off unless SEB itself is what threw them out —
                otherwise the reopened sitting is shut down again on its very next request.
            </Step>
            <Step n={5} title="Click Let in">
                They get the paper back immediately, with their answers intact, running on the minutes you
                just gave. Tell them to refresh their screen if they are staring at the shut-out message.
            </Step>

            <SectionTitle>The Rule to Tell Your Class</SectionTitle>
            <Note type="tip">
                <strong>Nobody loses time by being let in, so nobody needs to panic.</strong> A student&apos;s clock
                starts when <em>they</em> press Start test — not when the window opens — and if their sitting is
                interrupted, Let in hands back the time that was left plus the time they lost waiting for you.
                Say this out loud before the paper starts: a student who believes the clock is running while
                they are locked out panics, and a panicking student in an exam hall costs more time than the
                fault did.
            </Note>
            <Note type="warning">
                Be generous with Let in, especially on SEB papers — antivirus or endpoint-security software can
                block SEB by mistake and throw a student out through no fault of their own, and the panel cannot
                tell that apart from a genuine attempt to leave the paper. Let a student back in the first few
                times without friction. If the <em>same</em> student is repeatedly shut out on the same paper,
                that pattern is worth investigating before letting them in again.
            </Note>
            <Note type="info">
                A reopened sitting runs on the minutes you granted at that moment and on nothing else — it is
                not silently extended afterwards. If they are interrupted twice, let them in twice.
            </Note>
        </div>
    );
}

function TabLockout() {
    return (
        <div>
            <Note type="danger">
                <strong>A student thrown out of Safe Exam Browser has to sign in again, inside SEB.</strong>
                The access code will <em>not</em> get them back in: it is a one-time unlock, spent when they
                first entered the paper. Trying to reuse it is the most common wasted five minutes in an exam
                hall — send them straight through the steps below instead.
            </Note>

            <SectionTitle>Steps to Follow — Student Shut Out of SEB</SectionTitle>
            <Step n={1} title="Tell them their time is safe">
                Their clock stopped when the sitting ended, and you will hand back the time they lost. Say this
                first — it stops the panic that turns a two-minute fix into a ten-minute one.
            </Step>
            <Step n={2} title="Reopen Safe Exam Browser">
                SEB has to be launched again on their machine. It opens on the learning home page; their test
                is listed there. Nothing about the exam link changes.
            </Step>
            <Step n={3} title="They sign in again — with their username and password">
                A fresh SEB session has no session of theirs in it, so they must log in again <strong>inside
                SEB</strong>. <strong>The access code is not a login and cannot be used here</strong> — one code,
                one unlock, already spent.
            </Step>
            <Step n={4} title="You let them back in from Live control">
                Until you do, their paper is under <strong>Shut out</strong> and their screen will not offer it.
                Follow the Let a Student In tab: set the minutes, and only tick &ldquo;without Safe Exam
                Browser&rdquo; if SEB itself is what failed.
            </Step>
            <Step n={5} title="They resume where they left off">
                Every answer already given is still there, and the paper picks up at the question they were on.
            </Step>

            <SectionTitle>If Their Username Gets Locked Out</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                A student under pressure who has forgotten their password will type the wrong one several times
                in a row. After a handful of failed attempts in quick succession, sign-in for that account is
                <strong> temporarily refused</strong> — a rate limit, not a permanent lock. It clears itself
                after a couple of minutes with no action from anybody.
            </div>
            <Note type="tip">
                What to tell them, in this order:
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Do not panic, and stop typing.</strong> More attempts only keep the window open.</li>
                    <li><strong>Wait about two minutes</strong>, then try once, carefully. If the password is
                        genuinely forgotten, use the password-reset link rather than guessing again.</li>
                    <li><strong>Your exam time is not running out.</strong> The clock starts when they press
                        Start test, and any time lost while they were shut out is handed back with
                        <strong> Let in</strong> — you can extend any student&apos;s time from that panel.</li>
                </ul>
            </Note>
            <Note type="info">
                None of this needs an administrator. Nobody has to be unlocked by hand, and no attempt has been
                lost — the only thing that has happened is that the sign-in page is asking them to wait.
            </Note>
        </div>
    );
}

function TabGrade() {
    return (
        <div>
            <Note type="key">
                Results are held back from students until you release them — you can always see scores as
                they come in; students cannot, until the release condition you set in Publish is met.
            </Note>

            <SectionTitle>The Answer Key</SectionTitle>
            <Shot src={shotResultsAnswerKey} alt="Answer key editor modal, showing marks and correct answers for each question"
                caption="Edit answer key, opened from the Results page. Question wording and options are edited in the quiz editor, not here — only what counts as correct, and how much it is worth." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Tick the right answer, or change what a question is worth, directly from the Results page — no need to go back into the editor.</li>
                    <li><strong>Saving re-marks every paper already submitted</strong> and updates the gradebook immediately — this is how you correct a mistake discovered after students have already sat the test.</li>
                    <li>For numerical questions you can adjust the correct value and its <code>± percent</code> / <code>± absolute</code> tolerance the same way.</li>
                </ul>
            </div>

            <Step n={1} title="Re-evaluate all — a separate action from saving the key">
                <strong>Re-evaluate all</strong> re-marks every submitted paper against the <em>current</em>
                answer key without you having to open and re-save it — use this if you suspect a discrepancy
                even though the key itself hasn't changed, or after any other correction that should ripple
                through existing scores.
            </Step>
            <Step n={2} title="Publish results now">
                Enabled only once the quiz is actually <strong>conducted</strong> — you cannot release
                results for a paper that has not yet run its course. Publishing notifies every student who
                sat the paper and marks the subject on their class card until they have read it.
            </Step>
            <Step n={3} title="Export CSV">
                Downloads every attempt's score and status as a spreadsheet — useful for uploading to an
                external gradebook or for an offline audit trail.
            </Step>

            <Note type="warning">
                Editing the answer key does not touch the question text or its options — those are only
                editable back in the quiz editor's Questions tab, and doing so after students have sat the
                paper changes what they were actually asked, not just how it is marked.
            </Note>
        </div>
    );
}

function TabAnalytics() {
    return (
        <div>
            <SectionTitle>The Results Page</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Click <strong>Results</strong> on any quiz's card. The header stat tiles — Submitted, In
                progress, Not started, Average, Pass rate, Avg time, On SEB — update live while the paper is running.
            </div>
            <Shot src={shotResultsLiveMonitor} alt="Results page, Live monitor tab"
                caption="Results → Live monitor. The same writing/submitted/not-started breakdown as Live exam control, alongside the full class stat tiles." />

            <SectionTitle>The Tabs</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Live monitor</strong> — everyone currently affected: writing now, submitted or closed, and not started. The same reopen/restart/delete actions from the Monitor tab are available per student here too.</li>
                    <li><strong>Student analysis</strong> — one row per student who has attempted the paper, with their score, time taken, and any flags. Click through to see their full paper, question by question.</li>
                    <li><strong>Question analysis</strong> — success rate and skip rate per question, called out below.</li>
                    <li><strong>Sections</strong> — the same breakdown rolled up by section, if the paper uses them.</li>
                    <li><strong>Distribution</strong> — a score-band histogram across the class.</li>
                </ul>
            </div>

            <Shot src={shotResultsQuestionAnalysis} alt="Results page, Question analysis tab"
                caption="Question analysis. Success rate is measured only over students who actually attempted the question, so a high skip rate shows up separately rather than masquerading as difficulty." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Most difficult question</strong> and <strong>Most skipped question</strong> are called out automatically at the top, so you can see at a glance which topic needs revisiting in the next class.</li>
                    <li>The per-question table shows type, difficulty, correct count, success rate, skip rate and average time spent — cross-reference against the Topic tag you set while authoring.</li>
                </ul>
            </div>

            <SectionTitle>What a Student Sees</SectionTitle>
            <Shot src={shotStudentBrief} alt="The student-facing quiz brief page, previewed as a teacher"
                caption="The quiz brief screen, exactly as a student sees it before starting — countdowns, delivery rules and your Instructions text, all generated automatically." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Opening a quiz link as a teacher shows this same screen with a blue <strong>You are seeing
                this as staff</strong> banner — a safe way to sanity-check timing and instructions before
                the class sits it, without your own attempt being scored into the results.
            </div>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'For a normal exam, leave the exam type and every setting at its default. The defaults are already the strict setup — one question at a time, no going back, questions drawn per student, options shuffled per student, keyboard locked, fullscreen enforced. Most exam-day trouble comes from a setting somebody turned on.',
        'One question at a time with no way back is harder for students than a paper they can flip through. Set the questions accordingly: fewer of them, each answerable on its own, with a time limit that assumes one look and one answer.',
        'On a question, only the type is mandatory. Marks, difficulty, negative marking, per-question time, section, topic and the explanation are all optional — fill them in only when that question needs them.',
        'Multiple-correct questions are all-or-nothing: every correct option ticked and no incorrect one, or no marks. There is no partial marking and no setting to enable it — tell your class before they sit the paper.',
        'With the keyboard locked, a numerical answer is clicked out on an on-screen keypad. Keep numerical answers short — a long decimal is a lot of clicking under time pressure.',
        'Turning off "load the next question ahead" (the high-security option) fetches every question from the server only after the previous answer is submitted. That is a round-trip on every Next, for a whole batch at once — it has caused real trouble on the NITJ wifi. Leave it on.',
        'Internet connectivity is the most common exam-day problem of all. A dropped connection ends the sitting; the student then appears under Shut out in Live control and Let in gives the paper straight back, answers intact.',
        'The access code is a one-time unlock, spent when the student first enters the paper. A student thrown out of Safe Exam Browser cannot reuse it — they must relaunch SEB and sign in again, and then be let back in from Live control.',
        'Repeated wrong passwords temporarily refuse sign-in for that account. It is a rate limit, not a permanent lock, and clears itself in about two minutes — tell the student to stop typing and wait, not to panic. Their exam clock is not running.',
        'A student\'s clock starts when they press Start test, not when the window opens, and Let in hands back the time lost while they were shut out. Say this to the hall before the paper starts.',
        'Terminate is on the Attendance register, not in Live control — the Writing now list is read-only. Marking a writing student Absent also ends their paper (with a confirmation).',
        'The publish time is when the link starts answering — that is the moment students get the link. Until the start time it shows them a countdown, and the page unlocks itself, so nobody needs to reload.',
        'To change any timing after publishing — start, entry cut-off, closing time, results — use the timer (Schedule) icon on the quiz card. The link itself never changes.',
        'Fullscreen lockdown cannot be turned off for any paper — it is not one of the optional proctoring toggles.',
        'Keyboard lockdown does not catch an assistant summoned by voice. Speaking a wake word produces no keystroke, no focus change and no fullscreen exit, so nothing in the module can observe it — only Safe Exam Browser, configured with Siri/dictation disabled in its settings file, closes this gap.',
        '"Discourage mobile devices" is a nudge, not a control — it is trivially bypassed by a phone browser that does not identify itself as one.',
        'A custom SEB configuration file and its Config Key must come from the same saved file — mixing an old key with a newer file (or vice versa) will not work.',
        'There is one shared SEB bypass access code per quiz, not one per student. Generating a new code immediately retires the old one for everyone who had it.',
        'Publishing is blocked if the paper has no questions, or if any question is missing its own timer while the paper uses a timer-per-question delivery mode.',
        'The results-announcement choice (immediate vs. a set time for everyone) is effectively irreversible once students start submitting under it — get this right before you publish.',
        '"Publish results now" stays disabled until the quiz is actually conducted — you cannot release results for a paper that has not finished running.',
        'Delete removes an attempt and frees the slot only while the quiz window is still open. Once the window has closed, use Restart instead to let a student back in.',
        'Reopening a sitting resumes it on a fresh, teacher-set clock at the moment you reopen it — the extra time is whatever you grant then, not an automatic extension for time lost.',
        'Saving a change to the answer key automatically re-marks every paper already submitted and updates the gradebook — there is no separate "apply" step.',
        'Negative marking is never applied to a question a student left unanswered, regardless of the negative-marking value set for it.',
        '"Entry closes at" only stops new starts; "Test closes at" ends the paper for everyone, including students already writing. They are two different cut-offs, not the same setting twice.',
        'When "Questions per student" draws a random subset per student, each student\'s achievable total marks can differ from their classmates\' — expect this in the class average.',
        'Deleting all responses (Access → Danger zone) resets the gradebook for this quiz too — there is no undo.',
        'Safe Exam Browser must be installed on each student\'s device before the exam, and a custom exam settings file must whitelist the XCEED site — install problems and blocked configs are best caught by running a short, ungraded mock quiz beforehand, not on exam day.',
        'Antivirus or endpoint-security software can block or flag SEB and throw a student out through no fault of their own — be generous with "Let back in" for the first few incidents; treat only a repeating pattern on the same student as something to investigate further.',
        'SEB will not open at all on a laptop with a desktop-sharing or remote-access app installed (TeamViewer, AnyDesk, Chrome Remote Desktop, etc.) — merely closing the app is not enough, it must be uninstalled. Tell students this before exam day, not when they are already stuck at the door.',
        'No lockdown catches everything — a virtual machine or a second physical device can still be used to cheat, and nothing in this module or SEB can see either one. Treat automated proctoring as a first line of defence, not the only one; use human invigilators for anything high-stakes.',
        'The "N attempt(s) recorded a proctoring event" banner on the Results page is a flag to go check, not a verdict — background anomaly detection can surface false positives. Confirm what actually happened before acting on it.',
    ];
    return (
        <div>
            <Note type="warning">
                Everything that catches teachers out the first time they run a proctored paper. Worth a
                skim before your first exam-mode quiz, and worth bookmarking this tab for afterwards.
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

export default function QuizManual({ standalone = false }) {
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
        overview:  <TabOverview setTab={setTab} />,
        create:    <TabCreate />,
        publish:   <TabPublish />,
        settings:  <TabSettings />,
        monitor:   <TabMonitor />,
        letin:     <TabLetIn />,
        lockout:   <TabLockout />,
        grade:     <TabGrade />,
        analytics: <TabAnalytics />,
        gotchas:   <TabGotchas />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#1e1b4b', borderBottom: '1px solid #312e81',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="qzm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                        }}>📝</div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e7ff' }}>
                            Quiz &amp; Exam Module — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#a5b4fc',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #4338ca', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#312e81'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="qzm-page" style={{ fontFamily: T.fontBody }}>
                {/* Header */}
                <div className="qzm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>📝</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="qzm-title" style={{ fontWeight: 800, color: T.text }}>Quiz &amp; Exam Module — Teacher Manual</div>
                        <div className="qzm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            From creating a quiz to publishing results · XCEED Learning
                        </div>
                    </div>
                </div>

                {/* Step navigator */}
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

                {/* Content */}
                <div className="qzm-card" style={{
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
