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
import shotLiveExamControl from '../manualAssets/quiz/live-exam-control.png';
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

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Overview',          icon: '🗂️' },
    { id: 'create',   label: 'Create & Author',    icon: '✏️' },
    { id: 'settings', label: 'Settings',           icon: '⚙️' },
    { id: 'publish',  label: 'Publish',            icon: '🚀' },
    { id: 'monitor',  label: 'Monitor & Fix',      icon: '🛰️' },
    { id: 'grade',    label: 'Grade & Release',    icon: '✅' },
    { id: 'analytics',label: 'Analytics',          icon: '📊' },
    { id: 'gotchas',  label: 'Gotchas',            icon: '⚠️' },
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
                    { id: 'settings', icon: '⚙️', label: 'Configure',       sub: 'Timing · marking · proctoring' },
                    { id: 'publish',  icon: '🚀', label: 'Publish',         sub: 'Schedule the window · results plan' },
                    { id: 'monitor',  icon: '🛰️', label: 'Monitor',         sub: 'Watch the sitting · fix problems' },
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
                    <li>Action buttons that change with state — a live paper shows <strong>Live control</strong> and <strong>Attendance</strong>; a draft shows <strong>Publish</strong> instead.</li>
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
            <Step n={3} title="Pick how it runs">
                Choose one of the three delivery modes. For the <strong>one question at a time</strong>
                modes you also set the whole-paper time limit (or leave it blank/0 for untimed) and
                whether students may go back and change earlier answers.
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
            <Step n={2} title="Choose a type">
                Four question types are available: <strong>Single correct</strong>, <strong>Multiple
                correct</strong>, <strong>True / False</strong>, and <strong>Numerical / integer</strong>.
                For numerical answers you can set a correct value plus a <strong>tolerance</strong> as a
                percentage, an absolute amount, or both — anything inside the tolerance counts as correct.
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
                    <li><strong>Shuffle question order / options per student</strong> — randomises order independently for each student (True/False is left alone).</li>
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
                    <li><strong>Proctored — load the next question ahead</strong> pre-fetches the next question so Next feels instant; where backtracking is allowed the questions are sent encrypted and only decrypted as the student reaches them.</li>
                    <li><strong>Discourage mobile devices</strong> turns away browsers that identify as phones — a nudge, trivially bypassed, not a real control.</li>
                    <li><strong>Block the keyboard, warn twice, then submit</strong> — the keyboard is <strong>completely locked</strong> for the whole sitting; there is no legitimate use of it once this is on, since every answer is clicked (a numerical answer gets an on-screen keypad). This closes the gap a hotkey-summoned desktop assistant opens. Every key press is swallowed and recorded on the attempt: the <strong>first</strong> press gets an on-screen warning, the <strong>second</strong> press gets a second warning, and the <strong>third</strong> press submits the paper automatically. It does <strong>not</strong> catch an assistant summoned by voice — see the Gotchas tab.</li>
                    <li><strong>Disable copy, cut and paste</strong> / <strong>Disable right-click</strong> — self-explanatory browser-level restrictions.</li>
                    <li><strong>Offer an on-screen scientific calculator</strong> — turn this off for a paper where the arithmetic itself is the point.</li>
                </ul>
            </div>

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
                dialog — the one place all the timing decisions from Settings come together into a single
                timeline before anything goes live.
            </Note>

            <Shot src={shotPublishModal} alt="Schedule for a quiz — the publish modal with four numbered steps"
                caption="The Schedule dialog, opened from Save & publish. Each numbered step maps onto a field you may already have set in Settings → Delivery & timing." />

            <Step n={1} title="Students can start">
                When the Start button unlocks. Before this, the link shows only the instructions and a
                countdown. Leave it blank to let students start the moment you publish.
            </Step>
            <Step n={2} title="Last time to start (late-comers turned away)">
                Toggle this on to set a hard cut-off for <em>new</em> starts. Nobody may begin after this
                time; students already sitting the paper keep their full time and finish normally.
            </Step>
            <Step n={3} title="Test closes (paper ends for everyone)">
                After this, nobody can open the paper and any sitting still in progress is submitted as-is.
                This is also the due date shown on the class stream. Leave it blank for a paper with no closing time.
            </Step>
            <Step n={4} title="Results announced — the one choice that matters most">
                Pick <strong>As each student submits</strong> (their score appears on their own paper the
                moment they finish) or <strong>At a set time, for the whole class together</strong> (nobody
                sees a mark, however early they finish, until the time you set arrives). This choice governs
                the entire class's experience and is effectively irreversible once students start submitting
                under it — decide before you publish, not after.
            </Step>
            <Step n={5} title="Save changes / Save &amp; publish">
                Saving validates the whole timeline — a start time after the entry cut-off, an entry cut-off
                after the test closes, or a scheduled result time before the test closes will all block the
                save with an explanation, so you cannot accidentally publish a paper nobody can complete.
            </Step>

            <Note type="warning">
                Publishing is also blocked if the paper has no questions yet, or if any question is missing
                its own timer while the paper uses <em>a timer on each question</em> mode.
            </Note>
            <Note type="tip">
                Every field here stays editable after publishing — reopen the same dialog from
                <strong> Edit → Save &amp; publish</strong> on an already-live paper to push a deadline back
                or open a scheduled release early. The one exception is the results-announcement <em>mode</em>
                itself, which should be treated as final once students are sitting the test.
            </Note>
        </div>
    );
}

function TabMonitor() {
    return (
        <div>
            <SectionTitle>Live Exam Control</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Click <strong>Live control</strong> on a published quiz's card while it is running. This
                panel refreshes automatically every 15 seconds — no need to reload the page.
            </div>
            <Shot src={shotLiveExamControl} alt="Live exam control modal, showing writing-now and shut-out lists"
                caption="Live exam control. Writing now / Submitted or closed / Shut out — every currently-affected student, sorted by what they need from you right now." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Writing now</strong> — everyone mid-paper, with their live progress and time left. <strong>Terminate</strong> ends their paper immediately if you need to intervene (e.g. suspected misconduct reported in the room).</li>
                    <li><strong>Shut out</strong> — sittings that ended themselves: the window closing, a proctoring rule tripping, a dropped connection. <strong>Let back in</strong> hands the paper straight back with every answer intact, resuming at the question they were on. Set extra minutes if the incident cost them time.</li>
                    <li><strong>Let them back in without Safe Exam Browser</strong> — applies to every student you let in from this panel. Leave it off unless SEB itself is what threw them out; otherwise the reopened sitting is shut down again on its very next request.</li>
                    <li><strong>Safe Exam Browser status</strong> — how many of the students currently writing are actually inside SEB, counted live.</li>
                </ul>
            </div>
            <Note type="tip">
                The same "Let back in" action is also available per-student from the full
                <strong> Results</strong> page's Live monitor tab (see the Analytics tab below) — use
                whichever screen you already have open. <strong>Live control</strong> is the fastest route
                during an actual sitting since it is already open on your screen and refreshes itself.
            </Note>
            <Note type="warning">
                Be generous with <strong>Let back in</strong> for Safe-Exam-Browser papers — antivirus or
                endpoint-security software on a student's machine can flag or block SEB by mistake and
                throw them out through no fault of their own, and there is no way to tell that apart from a
                genuine attempt to leave the paper just by looking at the panel. Let a student back in the
                first few times without much friction. If the <em>same</em> student is repeatedly shut out
                on the same paper, that pattern itself is worth investigating before letting them back in
                again — it may be a genuine, recurring device problem, or it may not be.
            </Note>
            <Note type="info">
                If Safe Exam Browser simply will not run for a student despite reasonable troubleshooting,
                the fallback is the <strong>access code</strong> from Settings → Proctoring — it lets that
                one student sit the paper in an ordinary browser, with every action still recorded on their
                attempt. Treat it as a last resort for a specific, known problem, not a routine option.
            </Note>

            <SectionTitle>Attendance, Separately from the Paper</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                The <strong>Attendance</strong> button on a live quiz's card opens a roster-based
                Present/Absent view for the sitting, independent of who has actually submitted a paper —
                useful for a physical headcount in an invigilated hall. A bulk <strong>Mark all writing
                present</strong> action covers everyone currently mid-paper in one click. Use this
                alongside Live control as a cross-check: a student shown as writing on-screen should also
                be physically present in the room, and marking attendance is what actually confirms that.
            </div>

            <SectionTitle>Fixing a Problem Mid-Sitting</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Three actions are available on any attempt, from either Live exam control or the Results
                page — each opens a confirmation that spells out exactly what happens before anything is touched:
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>▶️ Reopen — continue.</strong> The student keeps every answer already given and resumes at the question after where they left off. Use this when the test ended for a reason that was not their doing — a dropped connection, a dead battery, the window closing mid-paper.</li>
                    <li><strong>🔄 Restart as a new test.</strong> Everything they answered is deleted and they sit the test again from question 1, on a freshly shuffled paper. Their old score goes with it. Use this for a genuine do-over, not a continuation.</li>
                    <li><strong>🗑 Delete this response.</strong> Removes the sitting and its score, and frees the attempt slot so the student can start again themselves — but only while the quiz window is still open. Once it has closed, use Restart instead to let them back in.</li>
                </ul>
            </div>
            <Note type="warning">
                A reopened sitting runs on whatever extra time you grant at that moment, on the teacher's
                own clock at the time of reopening — it is not automatically extended by however long the
                student was shut out for.
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
                Twenty things that catch teachers out the first time they run a proctored paper. Worth a
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
        settings:  <TabSettings />,
        publish:   <TabPublish />,
        monitor:   <TabMonitor />,
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
