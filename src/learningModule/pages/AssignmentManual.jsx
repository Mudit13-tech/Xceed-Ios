import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

import shotList from '../manualAssets/assignments/list.png';
import shotEditor from '../manualAssets/assignments/editor.png';
import shotPreview from '../manualAssets/assignments/preview.png';
import shotPlayer from '../manualAssets/assignments/player.png';
import shotResults from '../manualAssets/assignments/results.png';
import shotImport from '../manualAssets/assignments/import.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#c2410c',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .agm-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .agm-card { padding: 28px 32px; }
    .agm-topbar { padding: 10px 28px; }
    .agm-title { font-size: 20px; }
    .agm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .agm-page { padding: 16px 12px; }
        .agm-card { padding: 16px 14px; }
        .agm-topbar { padding: 10px 12px; }
        .agm-title { font-size: 16px; }
        .agm-subtitle { font-size: 11px; }
        .agm-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'warning' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'tip' },
        key:     { bg: '#fff7ed', border: '#fed7aa', color: '#9a3412', icon: 'key' },
        danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: 'danger' },
    };
    const s = cfg[type] || cfg.info;
    return (
        <div style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
            <span style={{ flexShrink: 0, marginTop: 2, color: s.color }}><LmIcon name={s.icon} size={15} /></span>
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

// The same four colours the editor, the student's paper and the results use
// (Chakra's subtle badge: colour.100 ground, colour.800 text), so the manual
// shows a teacher exactly what they will see.
const TYPE_CHIPS = {
    parametric: { label: 'Numerical with random variables', short: 'RANDOM', bg: '#E9D8FD', color: '#44337A' },
    mcq:        { label: 'Multiple choice',                 short: 'MCQ',    bg: '#BEE3F8', color: '#2A4365' },
    msq:        { label: 'Multiple answers',                short: 'MSQ',    bg: '#FED7E2', color: '#702459' },
    numerical:  { label: 'Numerical',                       short: 'NUM',    bg: '#FEEBC8', color: '#7B341E' },
};

function TypeChip({ type, short = false }) {
    const chip = TYPE_CHIPS[type];
    return (
        <span style={{
            display: 'inline-block', background: chip.bg, color: chip.color,
            fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 7px',
            whiteSpace: 'nowrap', verticalAlign: 'middle',
        }}>{short ? chip.short : chip.label}</span>
    );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Overview',         icon: 'geometry' },
    { id: 'create',   label: 'Create & Author',   icon: 'edit' },
    { id: 'types',    label: 'Question Types',    icon: 'quiz' },
    { id: 'settings', label: 'Settings',          icon: 'settings' },
    { id: 'import',   label: 'Import a Paper',    icon: 'assignment' },
    { id: 'student',  label: 'What Students See', icon: 'preview' },
    { id: 'grade',    label: 'Grading & Results', icon: 'success' },
    { id: 'gotchas',  label: 'Gotchas',           icon: 'warning' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                An Assignment is <strong>assessed numerical work</strong>: every student gets their own
                randomly-drawn variables in the same question, and their answer is marked automatically by
                evaluating your formula against their own numbers — not by comparing to one shared answer
                key. It is the graded counterpart of Tutorials, built on the exact same engine. An
                assignment can also hold <strong>multiple-choice, multiple-answer and plain numerical</strong>
                questions alongside those — see the Question Types tab.
            </Note>

            <Shot src={shotList} alt="Assignments list for a class"
                caption="The Assignments tab. Note the subtitle — this module is not file/text coursework; it's formula-graded numeric problems." />

            <SectionTitle>Not the Same as "Coursework"</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                If you're looking for open-ended, file-or-text submissions with a rubric and manual grading,
                that's the separate <strong>Coursework</strong> area of the class, not this one. Assignments
                here means auto-graded questions with an answer the system can mark itself — formula questions
                where every student sees different numbers, plus multiple-choice, multiple-answer and plain
                numerical ones.
            </div>

            <SectionTitle>How This Differs from a Tutorial</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Typically <strong>one attempt</strong>, not several — this is meant to count.</li>
                    <li><strong>Instant feedback defaults off</strong>, and turning it on is a deliberate trade-off you make per assignment (see Settings).</li>
                    <li>There is no separate "results release" gate — a submission is marked and visible the moment it lands.</li>
                </ul>
                Everything else — variables, formulas, tolerances, the editor, the paper-import pipeline —
                is identical to Tutorials. If a step below feels familiar, that's why.
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Starting a New Assignment</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Click <strong>+ New assignment</strong>. As with Tutorials, this doesn't open a blank form —
                it creates the assignment immediately with a fully worked example (variables, a formula,
                tolerances, all filled in) so you're editing something real from the first click.
            </div>

            <SectionTitle>Authoring a Question</SectionTitle>
            <Shot src={shotEditor} alt="Assignment editor showing a question with variables, answers and a sub-question"
                caption="The question editor — identical shape to Tutorials: Prompt, Variables, Answers, an optional sub-question, Constraint, Hint, Worked solution." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Prompt</strong> — write the question and just <em>type</em> <code>{'{{R}}'}</code> where a value belongs; the variable is declared for you as you type it. The toolbar buttons remain for dropping an existing variable at the cursor. Placeholders typed into a hint, a sub-question or the worked solution count too.</li>
                    <li><strong>Variables</strong> — Integer (the default), Decimal, or From a list, each with a range/step and a unit. A row you delete stays deleted, even with its placeholder still in the text.</li>
                    <li><strong>Answers</strong> — a formula, evaluated per student; set <strong>Tol %</strong> and/or <strong>Tol ±</strong> (whichever is looser wins).</li>
                    <li><strong>Decimals</strong> — how many decimal places the student must give, per answer, defaulting to 2 dp. It appears on their paper, the answer key is stated to that precision, and Results repeats it so a near-miss reads as rounding rather than a wrong method. <em>Exact</em> leaves the value unrounded.</li>
                    <li><strong>Reads as</strong> — each formula is echoed back below its box as a typeset equation, built from the same parsed formula the server evaluates. A mistyped formula usually looks wrong long before its value does.</li>
                    <li><strong>Sub-questions</strong> — optional parts sharing the same drawn variables, each independently marked. Not auto-lettered; give them your own labels if you want them.</li>
                    <li><strong>Constraints</strong> — one condition per cell, added with <strong>+ Add constraint</strong>; values are re-drawn until every one holds. Separate cells rather than one joined expression, so a broken condition is reported on its own.</li>
                    <li><strong>Tables</strong> — <strong>⊞ Insert table</strong> builds the &quot;given values&quot; grid a design question usually opens with, and drops it at your cursor. Cells take <code>{'{{R}}'}</code> via the variable chips in the builder, so the given values differ per student. Tables save as you build them and are listed under the prompt with <strong>Edit table</strong> and <strong>Delete</strong>.</li>
                </ul>
            </div>

            <SectionTitle>One Question at a Time</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Questions sit on their own tabs across the top of the editor. <strong>+ Add question</strong>
                is in the tab strip; it asks for the question&apos;s type first (see Question Types) and takes
                you straight to the new tab, and each question has its own
                <strong> Save</strong> button at the bottom, after the worked solution.
            </div>

            <SectionTitle>Checking a Question</SectionTitle>
            <Shot src={shotPreview} alt="Preview panel showing rolled sample assignment papers"
                caption="Roll samples before publishing — different draws with their computed answers, so you catch a bad formula before a class sees it." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Roll samples</strong>, under each question, shows the numbers two students would get for <em>that</em> question, sub-questions nested under the stem with their own answers.</li>
                    <li><strong>Work it out for values you choose</strong> — when you already know the answer for a particular set of values, type them in and check the question agrees, instead of rolling until they come up. It runs the same evaluation students are marked against.</li>
                    <li><strong>Preview</strong>, on the assignment&apos;s card in the list, rolls three complete papers end to end.</li>
                </ul>
            </div>
            <Note type="warning">
                Every preview rolls against the <strong>saved</strong> assignment, never unsaved edits — which
                is why <em>Roll samples</em> is disabled until you save. Otherwise a fix you just made would
                not show up in the sample and you would think it had failed.
            </Note>

            <SectionTitle>Reusing Questions</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <strong><LmIcon name="import" size={13} /> Import questions</strong>, in the toolbar at the top of the editor, copies whole
                questions from another assignment — this class or any other you teach — as independent
                copies with no shared history.
            </div>
        </div>
    );
}

function TabTypes() {
    const cell = { padding: '8px 10px', borderBottom: `1px solid ${T.border}`, verticalAlign: 'top' };
    const rows = [
        ['parametric', 'Types a number — or an expression like 2*pi*3 — worked from their own drawn values', 'Your formula, evaluated on their values, within Tol % / Tol ±', 'No — every student has different numbers'],
        ['mcq', 'Picks one option (radio buttons)', 'Right only if the option picked is the one you ticked', 'Yes'],
        ['msq', 'Ticks every option that applies (checkboxes)', 'Right only if the ticked set matches yours exactly — no part marks', 'Yes'],
        ['numerical', 'Types one number (an expression is fine)', 'Within the looser of Tolerance % and Tolerance ±; exact if both are 0', 'Yes'],
    ];
    return (
        <div>
            <Note type="key">
                Every question in an assignment has a <strong>type</strong>, and you choose it first. The
                original kind, <TypeChip type="parametric" />, is still the default and works exactly as
                described under Create &amp; Author. Alongside it an assignment can hold three fixed-answer
                types, written the way a quiz question is written and marked by the quiz&apos;s own marker:{' '}
                <TypeChip type="mcq" />, <TypeChip type="msq" /> and <TypeChip type="numerical" />. One
                assignment can mix all four. It is the same feature as in Tutorials.
            </Note>

            <SectionTitle>The Four Types at a Glance</SectionTitle>
            <div style={{ overflowX: 'auto', marginBottom: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                            {['Type', 'The student…', 'Marked right when…', 'Different per student?'].map((h) => (
                                <th key={h} style={{ ...cell, fontWeight: 700 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(([type, does, marked, differs]) => (
                            <tr key={type}>
                                <td style={cell}><TypeChip type={type} /></td>
                                <td style={cell}>{does}</td>
                                <td style={cell}>{marked}</td>
                                <td style={cell}>{differs}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <SectionTitle>Choosing the Type</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>+ Add question</strong>, in the tab strip, opens a menu of the four types, each with a one-line description. Pick one and the new question opens on its own tab, already laid out for that type.</li>
                    <li>To change an existing question, use the <strong>type dropdown</strong> in the question&apos;s header, beside Difficulty. Changing type resets the answer section just as the quiz editor does: MCQ and MSQ start with four blank options and nothing ticked, Numerical with a blank correct value. Switching back to random variables gives you a starter variable and answer if the question has none.</li>
                    <li>Variables and formulas stay in the editor until you save, so switching away and straight back loses nothing — but <strong>saving</strong> a question as MCQ, MSQ or Numerical discards them for good.</li>
                </ul>
            </div>

            <SectionTitle>Writing a Multiple-choice or Multiple-answers Question</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Question</strong> — the same rich-text box as any prompt: formatting, sub/superscripts and images all work.</li>
                    <li><strong>Options</strong> — each is its own small rich-text box. <strong>+ Add option</strong> adds one; the bin icon removes one (never below two). Removing an option moves the ticks below it up with their options, so the key stays right.</li>
                    <li><strong>Tick the correct answer</strong> in the box to the left of each option — exactly one for multiple choice, every correct one for multiple answers.</li>
                    <li>An option that repeats another (ignoring formatting and case) is <strong>outlined red</strong> as you type: a student could otherwise be right and wrong at once.</li>
                    <li><strong>Marks</strong> — what the whole question is worth.</li>
                </ul>
            </div>
            <Note type="info">
                Save refuses a choice question with fewer than two options, a blank option, a repeated option,
                nothing ticked, or two ticks on a multiple-choice question — each reported with its question
                number, the same rules the quiz editor enforces.
            </Note>

            <SectionTitle>Writing a Numerical Question</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Correct value</strong> — the key, and it must be a number.</li>
                    <li><strong>Tolerance %</strong> and <strong>Tolerance ±</strong> — whichever allows more applies. Both default to 0, which means an exact match, as in a quiz; the absolute allowance is the one that matters when the answer is near zero.</li>
                    <li><strong>Marks</strong> — what the question is worth.</li>
                    <li>Students may type an expression (<code>9.8*1.5</code>); it is worked out first, and the resulting number is judged exactly as a quiz judges it.</li>
                </ul>
            </div>

            <SectionTitle>What the Fixed-answer Types Leave Out</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Nothing is drawn per student, so MCQ, MSQ and Numerical questions have no Variables, answer
                formulas, Sub-questions, Constraints, Tables or Roll samples — the editor hides them. A{' '}
                <code>{'{{R}}'}</code> placeholder or a table in the question, an option, the hint or the
                explanation is refused on save, since it would reach students as literal braces. The
                <strong> Hint</strong> stays, and the Worked solution is relabelled <strong>Explanation</strong>,
                released after the deadline on the same setting.
            </div>

            <SectionTitle>Telling Types Apart — the Colour Badges</SectionTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {Object.keys(TYPE_CHIPS).map((type) => <TypeChip key={type} type={type} />)}
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Each type has its own colour, and its badge appears wherever a question is named:
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Editor</strong> — the full name beside each question&apos;s heading, and a short tag on every tab in the strip (<TypeChip type="parametric" short /> <TypeChip type="mcq" short /> <TypeChip type="msq" short /> <TypeChip type="numerical" short />), so an assignment&apos;s mix reads at a glance without opening each question.</li>
                    <li><strong>The student&apos;s paper</strong> — beside &quot;Question n&quot;, which also tells them whether to tick one option or several.</li>
                    <li><strong>Results</strong> — beside each question in a student&apos;s attempt.</li>
                </ul>
            </div>

            <SectionTitle>Marking and Changing a Key</SectionTitle>
            <Note type="tip">
                MCQ, MSQ and Numerical questions are marked by the same code that marks quizzes, so the same
                answer scores the same in a quiz, a tutorial or an assignment. A multiple-answers question has
                <strong> no partial credit</strong>: one missed or one extra tick scores zero, as in a quiz.
            </Note>
            <Note type="danger">
                Instant feedback matters even more on a choice question than on a typed number: with four
                options, three wrong <strong>Check</strong>s leave only the answer. On an assignment that
                counts, leave instant feedback off — or, if you must turn it on, set <strong>Checks allowed
                per answer</strong> to 1.
            </Note>
            <Note type="info">
                A student&apos;s paper is fixed when they first open it, and an assignment has only one attempt.
                If you change a key, add a question, or turn a question into an MCQ afterwards, their copy
                still holds the old version until you save and press <strong>Re-evaluate</strong> in the
                editor: every issued paper takes the saved questions — new type and options included — each
                student keeps their own numbers and answers, submitted work is re-marked, and the gradebook
                follows.
            </Note>
        </div>
    );
}

function TabSettings() {
    return (
        <div>
            <SectionTitle>Assignment Details</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Pass mark (%)</strong> — optional, and blank by default. Set one and it feeds the pass-rate stat in Results; leave it blank and no pass-or-fail verdict is shown, and the pass rate reads as a dash rather than a meaningless 0%.</li>
                    <li><strong>Due date</strong> — optional, and advisory even when set. Nothing locks submission at this time; a late submission is simply flagged. An assignment with no deadline shows no date at all.</li>
                    <li><strong>Show the worked solution after the deadline</strong> and <strong>Show hints</strong> — same meaning as in Tutorials, but off by default here: this is assessed work.</li>
                    <li>Every student gets <strong>one attempt</strong>. Unlike a tutorial, that is not configurable — an assignment measures rather than teaches.</li>
                </ul>
            </div>
            <Note type="warning">
                Two different due-date fields exist and don&apos;t automatically sync: the one inside the
                editor&apos;s Settings is the persisted value, saved by the normal Save button. On the list
                page, an unpublished assignment shows a <strong>+ Deadline</strong> button that opens a date
                picker on that row — what you put there is only sent when you click Publish from the list,
                and it will silently override whatever you set in the editor. Set the due date in one place,
                not both. A row with no deadline now shows no date at all, rather than an empty picker.
            </Note>

            <SectionTitle>Instant Feedback</SectionTitle>
            <Note type="danger">
                <strong>Tick each answer as the student types it</strong> is <strong>off by default</strong>
                for exactly the reason it matters more here than in a tutorial: a numeric free-response
                answer with live correctness feedback can be brute-forced by trial and error, and this is
                supposed to be a real assessment. If you do turn it on, set a sensible
                <strong> Checks allowed per answer</strong> — the expected value itself is never revealed
                through this channel, only right/wrong and remaining tries, and every attempt is still
                recorded so you can see who worked through it honestly.
            </Note>
        </div>
    );
}

function TabImport() {
    return (
        <div>
            <Note type="key">
                Identical pipeline to Tutorials: read the paper, choose variables, derive answers, merge —
                and the merge always produces an <strong>unpublished</strong> assignment you still have to
                open, check, and release yourself.
            </Note>

            <Shot src={shotImport} alt="Reviewing an imported assignment draft, with verified and mismatched answer badges"
                caption="One verified answer (green — reproduced the paper's own printed value) and one mismatch (red) in the same import. Treat the mismatch as a hold, not a suggestion." />

            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Upload</strong> one or more PDF/image files via <strong><LmIcon name="assignment" size={13} /> Import from a paper</strong>.</li>
                    <li><strong><LmIcon name="ai" size={13} /> Suggest variables</strong> — the model proposes which numbers to turn into variables, showing what the paper originally used.</li>
                    <li><strong><LmIcon name="ai" size={13} /> Derive answers from the paper</strong> — writes the formula and checks it by substituting the paper's own numbers back in.</li>
                    <li>Read every verification badge: <strong style={{ color: '#166534' }}>✓ matches the paper</strong>, or one of the not-yet-trustworthy states (mismatch / not checkable / will not parse). <strong>Nothing blocks merging an unverified answer</strong> — this is a check for you to act on, not a safeguard the system enforces.</li>
                    <li><strong>Roll samples</strong> here shows the answer key alongside the draws — deliberately, since this screen is teacher-only.</li>
                    <li><strong>Merge</strong> your selected questions into a new, unpublished assignment.</li>
                </ol>
            </div>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <Shot src={shotPlayer} alt="Student view of an assignment in progress, with their own drawn values"
                caption="A student's paper — one attempt allowed, their own numbers, an explicit warning before submitting." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Every question is labelled with its <strong>type</strong>, in that type&apos;s colour — so a student knows before reading on whether to tick one option or several.</li>
                    <li>On a random-variable question, students see their own drawn values and may type an unevaluated expression (e.g. <code>2*pi*3</code>) instead of a decimal.</li>
                    <li>A <strong>multiple-choice</strong> question shows its options lettered A, B, C… with radio buttons, so a second pick replaces the first; a <strong>multiple-answers</strong> question uses checkboxes. Clicking anywhere on an option picks it. Ticks are kept by <em>Save progress</em> and come back on reload.</li>
                    <li>The right options are shown only <strong>after the deadline</strong>, and only with <em>Show the worked solution after the deadline</em> on — then they are outlined green and marked <strong>correct</strong>, with a wrong pick outlined red. Submitting alone reveals nothing, so the first student to finish cannot pass the key on.</li>
                    <li><strong>Submitting asks for confirmation and warns marking is immediate</strong> — "Submit this assignment? Your answers will be marked immediately." Once accepted, it's final for that attempt.</li>
                    <li>A standing note reminds them their figures are unique — comparing final answers with a classmate tells them nothing, comparing method does. It appears only when the assignment has random-variable questions.</li>
                </ul>
            </div>
        </div>
    );
}

function TabGrade() {
    return (
        <div>
            <Shot src={shotResults} alt="Assignment results page showing method analysis and per-student attempts"
                caption="Results. Because there's no single correct answer across the class, Method analysis reports success per answer slot rather than per option." />

            <SectionTitle>What "Grading" Means Here</SectionTitle>
            <Note type="warning">
                There is <strong>no rubric and no per-criterion scoring</strong> — marking is entirely
                automatic, by formula. The only thing you do by hand is a blunt
                <strong> Adjust marks (+/−)</strong> on a specific attempt, with an optional
                <strong> Feedback</strong> note that appears on the student's own paper as "Teacher
                feedback." A wrong formula or answer key is fixed for the whole cohort instead: correct it
                in the editor, save, and press <strong>Re-evaluate</strong> — every issued paper is re-worked
                against the saved questions, each student keeping their own numbers, and submitted work is
                re-marked with the gradebook following.
            </Note>

            <SectionTitle>Re-evaluating Papers Already Issued</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                A student&apos;s paper is fixed the moment they first open it — the questions, options, keys and
                expected answers are copied onto it — so a later edit in the editor never silently changes what
                someone is sitting or has been marked against. With one attempt per student and marks that
                count, that also means a mistake in a formula or a key would stand for the whole cohort.
                <strong> Re-evaluate</strong> is the deliberate way to push a correction through.
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <strong>Using it</strong>
                <ol style={{ margin: '4px 0 10px 0', paddingLeft: 18 }}>
                    <li>Fix the question in the editor — a formula typo, the wrong option ticked, a tolerance that was too tight, a question switched to MCQ.</li>
                    <li>Press <strong><LmIcon name="reuse" size={13} /> Re-evaluate</strong> in the toolbar at the top of the editor, between Import questions and Save. It asks you to confirm, then <strong>saves your edits first</strong> — re-working the papers against unsaved changes would re-mark them against the very mistake you were fixing.</li>
                    <li>A summary appears when it finishes: how many papers were re-worked, how many re-marked, how many scores changed, and any warnings.</li>
                </ol>
                <strong>What it changes</strong>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Kept:</strong> each student&apos;s drawn numbers and everything they typed or ticked — nobody&apos;s question changes under them.</li>
                    <li><strong>Recomputed from the saved questions:</strong> the expected answers, the prompt, sub-questions, hint and worked solution — and, for a question whose type you changed, the type and its options.</li>
                    <li><strong>Submitted work is re-marked</strong> against the current tolerances, and the <strong>gradebook moves with it</strong> — these marks count, so scores can go up or down. Papers still in progress are updated but not submitted, so nobody loses what they have typed.</li>
                    <li>A question you have <strong>deleted</strong> from the assignment stays on existing papers exactly as it was, and is counted in the summary, rather than being removed from work a student has already answered.</li>
                </ul>
            </div>
            <Note type="tip">
                An <strong>Adjust marks (+/−)</strong> you applied earlier is <strong>kept on top of the re-mark</strong>,
                capped between zero and the paper&apos;s total just as when you applied it, and the gradebook
                follows — re-evaluating corrects the key, it does not undo a judgement you made by hand. If you
                had adjusted a student <em>because</em> the key was wrong, remove that adjustment once the key
                is fixed, or they are credited twice.
            </Note>
            <Note type="info">
                It never runs on its own, and it covers the whole assignment: every issued paper is re-worked
                against every saved question. Check the corrected question with <em>Roll samples</em> or
                <em> Work it out for values you choose</em> before you press it.
            </Note>

            <SectionTitle>Reading the Method-analysis Table</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                A low success rate on one answer slot, across many different numbers, points at the method
                the class used — not at arithmetic mistakes on any one paper. Use it the same way you'd use
                a per-question breakdown on a quiz, just aimed at technique rather than a specific value.
            </div>

            <SectionTitle>Choice and Numerical Questions in Results</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                In each attempt&apos;s breakdown, every question carries its type badge. For a multiple-choice or
                multiple-answers question the <strong>Expected</strong> column shows the right options as letters
                (<code>B, D</code>) and <strong>Given</strong> shows the letters the student ticked; a numerical
                question shows its fixed value. In Method analysis these questions have one row each, with the
                key (<code>Option B</code>, or <code>9.81 (±1%)</code>) where a formula would be — and since
                everyone answered the same question, that row is a plain per-question success rate.
            </div>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'Deleting an assignment is irreversible and takes every student\'s attempt with it — there is no separate "delete responses only" option.',
        'The due date can be set in two places (the editor\'s Settings, or the list page\'s inline picker at publish time) and they don\'t automatically agree — the list page\'s value wins whenever you publish from there.',
        'Submitting is explicitly a one-way door for the student, and marking happens instantly — there\'s no teacher "release grades" step gating what they see afterward.',
        'Grading by hand is limited to one additive/subtractive adjustment plus a feedback note per attempt — no rubric, no per-criterion scoring. A wrong key is fixed for everyone with Re-evaluate in the editor, which re-marks and moves the gradebook.',
        'Preview — both in the editor and in the import screen — always rolls against the saved server copy, never unsaved changes in front of you.',
        'A constraint that excludes too much (or is contradictory) doesn\'t error up front — it only ever shows up as an "unanswerable question" warning after a draw, in Preview or in Results.',
        'The rich-text prompt editor can silently corrupt a hand-typed {{variable}} placeholder with embedded formatting — always use the Insert variable buttons.',
        'Import verification badges are advisory only; nothing stops a still-unverified or mismatched answer from being merged and later published to the class.',
        'This is not the same feature as "Coursework" — if you want file/text submissions with a rubric, look there instead.',
        'Only "Numerical with random variables" gives each student different numbers. MCQ, MSQ and plain Numerical questions are the same for the whole class, so an answer passed along works for them — weigh that on work that counts.',
        'A multiple-answers question has no partial credit: one missed or one extra tick scores zero, exactly as in a quiz.',
        'A paper is fixed when a student first opens it, and there is only one attempt — questions added, re-keyed or changed to another type afterwards reach existing papers only through Re-evaluate.',
        'Negative marking and shuffled options or question order, available in quizzes, are not available in assignments.',
        'Re-evaluate keeps an earlier Adjust marks on top of the re-mark, in the score and the gradebook. An adjustment you made to cover a wrong key will count twice once the key is fixed — set it back to 0 after re-evaluating.',
    ];
    return (
        <div>
            <Note type="warning">
                {items.length} things worth knowing before an assignment goes out for marks.
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

export default function AssignmentManual({ standalone = false }) {
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
        types:    <TabTypes />,
        settings: <TabSettings />,
        import:   <TabImport />,
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
                    background: '#7c2d12', borderBottom: '1px solid #9a3412',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="agm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#c2410c,#ea580c)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                        }}><LmIcon name="geometry" size={16} /></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#fed7aa' }}>
                            Assignments — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#fdba74',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #9a3412', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#9a3412'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="agm-page" style={{ fontFamily: T.fontBody }}>
                <div className="agm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#c2410c,#ea580c)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                    }}><LmIcon name="geometry" size={21} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="agm-title" style={{ fontWeight: 800, color: T.text }}>Assignments — Teacher Manual</div>
                        <div className="agm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Assessed numerical work, formula-graded per student · XCEED Learning
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

                <div className="agm-card" style={{
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
