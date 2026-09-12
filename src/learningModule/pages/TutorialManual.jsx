import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

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
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'warning' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'tip' },
        key:     { bg: '#f0fdfa', border: '#99f6e4', color: '#115e59', icon: 'key' },
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
    { id: 'overview', label: 'Overview',        icon: 'tutorial' },
    { id: 'create',   label: 'Create & Author',  icon: 'edit' },
    { id: 'types',    label: 'Question Types',   icon: 'quiz' },
    { id: 'settings', label: 'Settings',         icon: 'settings' },
    { id: 'import',   label: 'Import a Paper',   icon: 'assignment' },
    { id: 'student',  label: 'What Students See',icon: 'preview' },
    { id: 'results',  label: 'Results & Marks',  icon: 'insights' },
    { id: 'gotchas',  label: 'Gotchas',          icon: 'warning' },
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
                A tutorial can also hold <strong>multiple-choice, multiple-answer and plain numerical</strong> questions
                alongside those — see the Question Types tab.
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
                Create (from scratch, or from an uploaded paper) → pick each question&apos;s type and author it
                (variables and formulas, or options and a key) → set retry/feedback settings → publish → students each sit their own numbers →
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
                    <li><strong>Prompt</strong> — write the question and simply <em>type</em> <code>{'{{R}}'}</code> where a value should appear. The variable is declared for you the moment you type it, so there is no separate step; the <em>Insert variable</em> buttons remain for dropping an existing one at the cursor. A placeholder typed into a hint, a sub-question or the worked solution counts too.</li>
                    <li><strong>Variables</strong> — each has a <strong>Type</strong> (Integer by default, or Decimal, or From a list), a range or list of values, a <strong>Step</strong> (so values land on a clean grid — 4.5, not 4.5137), and a Unit. A row you delete stays deleted, even if the placeholder is still in the text.</li>
                    <li><strong>Answers</strong> — a formula over the variables above, evaluated per student and compared with what they type. Set a <strong>Tol %</strong> and/or <strong>Tol ±</strong> tolerance — whichever is looser applies; the absolute tolerance matters most when the correct value is near zero.</li>
                    <li><strong>Decimals</strong> — how many decimal places the student should give, set per answer and defaulting to 2 dp. It is shown on their paper (&quot;give your answer to 2 decimal places&quot;), the answer key is stated to the same precision, and it appears again in Results so a near-miss reads as rounding rather than a wrong method. Choose <em>Exact</em> to leave the value unrounded.</li>
                    <li><strong>Reads as</strong> — under each formula box, the formula is echoed back as a typeset equation: <code>V/(R_1+R_2)</code> appears as a real fraction, <code>sqrt(2*g*h)</code> under a root sign, <code>omega</code> as ω. It is built from the same parsed formula the server will evaluate, so what you see cannot disagree with what gets marked — and a mistyped formula usually looks wrong long before its value does.</li>
                    <li><strong>Sub-questions</strong> — optional parts sharing the same drawn variables, each with its own prompt and its own separately-marked answers. They are no longer auto-lettered; type your own label if you want one. Leave this empty for a single-answer question.</li>
                    <li><strong>Constraints</strong> — one condition per cell (e.g. <code>R &gt; 0</code>), added with <strong>+ Add constraint</strong>. Every one must hold or the values are drawn again, so use them to rule out a divide-by-zero or a physically impossible combination. Separate cells rather than one joined expression: each is checked and explained on its own, so you are told <em>which</em> condition is broken.</li>
                    <li><strong>Tables</strong> — <strong>⊞ Insert table</strong> opens a builder for the &quot;given values&quot; grid a lab or design question usually opens with. Set a caption, add rows and columns, fill the cells; the variable chips inside the builder drop a <code>{'{{R}}'}</code> into whichever cell you last clicked, so the given values differ per student. Inserting places the table at your cursor, mid-sentence if that is where it belongs. Tables save as soon as you build them and are listed under the prompt, drawn as they will appear, with <strong>Edit table</strong> and <strong>Delete</strong>.</li>
                    <li><strong>Hint</strong> and <strong>Worked solution</strong> — shown before and after submission respectively, each gated by its own setting (see Settings tab).</li>
                </ul>
            </div>
            <Note type="tip">
                Every formula field is validated live against the actual formula engine as you type — an
                invalid formula shows its error inline immediately, not after you save.
            </Note>

            <SectionTitle>One Question at a Time</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Questions sit on their own tabs across the top of the editor, so you work on one at a time
                rather than scrolling a wall of forms. <strong>+ Add question</strong> lives in the tab strip;
                it asks for the question&apos;s type first (see Question Types) and takes you straight to the new
                tab. Each question carries its own <strong>Save</strong>
                button at the bottom, after the worked solution.
            </div>

            <SectionTitle>Checking a Question</SectionTitle>
            <Shot src={shotPreview} alt="Preview panel showing rolled sample papers with their answers"
                caption="Roll samples — genuinely different draws of the same question, with the computed answer for each, so you can eyeball that the numbers behave sensibly before anyone sits the paper." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Roll samples</strong>, under each question, shows the actual numbers two students would be given for <em>that</em> question — sub-questions nested under the stem, each with the answers belonging to it.</li>
                    <li><strong>Work it out for values you choose</strong> answers the other question you usually have: you already know that at <em>R</em> = 7 Ω and <em>I</em> = 2 A the answer is 28 W, and you want to check the question agrees. Type the values, press the button, and you get the answer for exactly those — no rolling until those numbers happen to come up. It runs the same evaluation students are marked against. Values that break a constraint still compute, with a note saying no student would be given them.</li>
                    <li><strong>Preview</strong>, on the tutorial&apos;s card in the list, rolls three complete papers end to end — the whole thing as a student meets it, rather than one question.</li>
                </ul>
            </div>
            <Note type="warning">
                Every preview runs against the <strong>saved</strong> version on the server, never your
                unsaved edits — which is why <em>Roll samples</em> is disabled until you save. If it were not,
                you could tweak a formula, roll, see the old behaviour, and wrongly conclude your fix
                didn&apos;t work.
            </Note>

            <SectionTitle>Reusing Questions</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <strong><LmIcon name="import" size={13} /> Import questions</strong>, in the toolbar at the top of the editor, copies whole questions from
                another tutorial — in this class or any other class you teach — into the one you have open.
                Copies are independent from the moment they land: editing them never touches the original,
                and no student work comes with them. This is separate from importing from a scanned paper —
                see the Import a Paper tab.
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
                Every question in a tutorial has a <strong>type</strong>, and you choose it first. The original
                kind, <TypeChip type="parametric" />, is still the default and works exactly as described under
                Create &amp; Author. Alongside it a tutorial can hold three fixed-answer types, written the way
                a quiz question is written and marked by the quiz&apos;s own marker: <TypeChip type="mcq" />,{' '}
                <TypeChip type="msq" /> and <TypeChip type="numerical" />. One tutorial can mix all four.
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
                shown after submitting on the same setting.
            </div>

            <SectionTitle>Telling Types Apart — the Colour Badges</SectionTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {Object.keys(TYPE_CHIPS).map((type) => <TypeChip key={type} type={type} />)}
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Each type has its own colour, and its badge appears wherever a question is named:
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    <li><strong>Editor</strong> — the full name beside each question&apos;s heading, and a short tag on every tab in the strip (<TypeChip type="parametric" short /> <TypeChip type="mcq" short /> <TypeChip type="msq" short /> <TypeChip type="numerical" short />), so a paper&apos;s mix reads at a glance without opening each question.</li>
                    <li><strong>The student&apos;s paper</strong> — beside &quot;Question n&quot;, which also tells them whether to tick one option or several.</li>
                    <li><strong>Results</strong> — beside each question in a student&apos;s attempt.</li>
                    <li><strong>Live presenter board</strong> — beside each question in the list, with the options lettered A, B, C to match the answer key.</li>
                </ul>
            </div>

            <SectionTitle>Marking and Changing a Key</SectionTitle>
            <Note type="tip">
                MCQ, MSQ and Numerical questions are marked by the same code that marks quizzes, so the same
                answer scores the same in a quiz, a tutorial or an assignment. A multiple-answers question has
                <strong> no partial credit</strong>: one missed or one extra tick scores zero, as in a quiz.
            </Note>
            <Note type="warning">
                A <strong>Check</strong> on a choice question gives a lot away — with four options, three wrong
                checks leave only the answer. If instant feedback is on for a tutorial with MCQs, keep
                <strong> Checks allowed per answer</strong> at 1, or accept that those questions are practice
                rather than measurement. A live session allows unlimited checks, so there a choice question
                eventually turns green for everyone.
            </Note>
            <Note type="info">
                A student&apos;s paper is fixed when they first open it. If you change a key, add a question, or
                turn a question into an MCQ afterwards, their copy still holds the old version. Save, then
                press <strong>Re-evaluate</strong> in the editor: every issued paper takes the saved questions —
                new type and options included — each student keeps their own numbers and answers, and submitted
                papers are re-marked.
            </Note>
        </div>
    );
}

function TabSettings() {
    return (
        <div>
            <SectionTitle>Tutorial Details</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Attempts allowed</strong> — blank means unlimited, and that is the default. A tutorial is practice, and capping practice at one go is a rule you should have to ask for.</li>
                    <li><strong>Pass mark (%)</strong> — optional, and blank by default. Set one and it feeds the pass-rate stat in Results; leave it blank and no pass-or-fail verdict is shown anywhere — practice that says &quot;not passed&quot; at 39% discourages the retry it exists to encourage. It never restricts anything a student can do.</li>
                    <li><strong>Due date</strong> — optional, and advisory even when set. Nothing locks at this time; a late submission is simply flagged so you can see who was on time. Tutorials with no deadline show no date at all.</li>
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
                    <li><strong>Upload.</strong> From the list page, click <strong><LmIcon name="assignment" size={13} /> Import from a paper</strong> and pick one or more PDF/image files. The paper is read automatically, and you land on this review screen.</li>
                    <li><strong>Suggest variables.</strong> Click <strong><LmIcon name="ai" size={13} /> Suggest variables</strong> on a question — the model proposes which numbers in the paper should become variables, with a type, a sensible range, and a note showing exactly what value the paper actually used.</li>
                    <li><strong>Derive answers.</strong> Click <strong><LmIcon name="ai" size={13} /> Derive answers from the paper</strong> — the model writes the formula, then immediately checks it by substituting the paper's own original numbers back in and comparing the result to the paper's printed answer.</li>
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
                    <li>Every question is labelled with its <strong>type</strong>, in that type&apos;s colour — so a student knows before reading on whether to tick one option or several.</li>
                    <li>On a random-variable question, students see their own drawn <strong>Your values</strong> under the prompt, and may type an unevaluated expression as an answer (e.g. <code>2*pi*3</code>) instead of computing a decimal themselves.</li>
                    <li>A <strong>multiple-choice</strong> question shows its options lettered A, B, C… with radio buttons, so a second pick replaces the first; a <strong>multiple-answers</strong> question uses checkboxes. Clicking anywhere on an option picks it. Ticks are kept by <em>Save progress</em> and come back on reload.</li>
                    <li>After submitting — with <em>Show the worked solution after submitting</em> on — the right options are outlined green and marked <strong>correct</strong>, and a wrong pick outlined red, so the student sees both what they chose and what they should have. In a live session this waits until you have moved on to the next question.</li>
                    <li>A standing note reminds them that comparing <em>final answers</em> with a classmate is useless — everyone's numbers differ — but comparing <em>method</em> is exactly the point. It appears only when the paper has random-variable questions: an all-MCQ tutorial does not claim everyone&apos;s numbers differ.</li>
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

            <SectionTitle>Choice and Numerical Questions in Results</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                In each attempt&apos;s breakdown, every question carries its type badge. For a multiple-choice or
                multiple-answers question the <strong>Expected</strong> column shows the right options as letters
                (<code>B, D</code>) and <strong>Given</strong> shows the letters the student ticked; a numerical
                question shows its fixed value. In Method analysis these questions have one row each, with the
                key (<code>Option B</code>, or <code>9.81 (±1%)</code>) where a formula would be — and since
                everyone answered the same question, that row is a plain per-question success rate.
            </div>

            <SectionTitle>Re-evaluating Papers Already Issued</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                A student&apos;s paper is fixed the moment they first open it — the questions, options, keys and
                expected answers are copied onto it — so a later edit in the editor never silently changes what
                someone is sitting or has already been marked against. That protects students, but it also
                strands them behind a mistake. <strong>Re-evaluate</strong> is the deliberate way to push a
                correction through to everyone.
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
                    <li><strong>Submitted papers are re-marked</strong> against the current tolerances. Scores can go up or down, and the gradebook takes each student&apos;s new best score. Papers still in progress are updated but not submitted, so nobody loses what they have typed.</li>
                    <li>A question you have <strong>deleted</strong> from the tutorial stays on existing papers exactly as it was, and is counted in the summary, rather than being removed from work a student has already answered.</li>
                </ul>
            </div>
            <Note type="tip">
                An <strong>Adjust marks (+/−)</strong> you applied earlier is <strong>kept on top of the re-mark</strong>,
                capped between zero and the paper&apos;s total just as when you applied it — re-evaluating
                corrects the key, it does not undo a judgement you made by hand. If you had adjusted a student
                <em> because</em> the key was wrong, remove that adjustment once the key is fixed, or they are
                credited twice.
            </Note>
            <Note type="info">
                It never runs on its own, and it covers the whole tutorial: every issued paper is re-worked
                against every saved question. Check the corrected question with <em>Roll samples</em> or
                <em> Work it out for values you choose</em> before you press it.
            </Note>

            <SectionTitle>Fixing a Score by Hand</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                A wrong formula or answer key is fixed for everyone at once: correct it in the editor, save,
                and press <strong>Re-evaluate</strong> — every issued paper is re-worked against the saved
                questions (each student keeps their own numbers) and submitted ones are re-marked. For one
                student, expand their attempt and use <strong>Adjust marks (+/−)</strong>
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
        'Only "Numerical with random variables" gives each student different numbers. MCQ, MSQ and plain Numerical questions are the same for the whole class, so an answer passed along works for them.',
        'A multiple-answers question has no partial credit: one missed or one extra tick scores zero, exactly as in a quiz.',
        'A paper is fixed when a student first opens it. Questions added, re-keyed or changed to another type afterwards reach existing papers only through Re-evaluate, or on a new attempt.',
        'With instant feedback on, each Check on an MCQ rules an option out — keep Checks allowed per answer low, or leave feedback off, for choice questions that should measure something.',
        'Negative marking and shuffled options or question order, available in quizzes, are not available in tutorials.',
        'Re-evaluate keeps an earlier Adjust marks on top of the re-mark. An adjustment you made to cover a wrong key will count twice once the key is fixed — set it back to 0 after re-evaluating.',
    ];
    return (
        <div>
            <Note type="warning">
                {items.length} things worth knowing before you build your first tutorial.
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
        types:    <TabTypes />,
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
                            color: '#fff',
                        }}><LmIcon name="tutorial" size={16} /></div>
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
                        color: '#fff',
                    }}><LmIcon name="tutorial" size={21} /></div>
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
