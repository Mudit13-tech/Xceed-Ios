import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#0f766e',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .fmm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fmm-page { padding: 24px 28px; max-width: 900px; margin: 0 auto; }
    .fmm-card { padding: 28px 32px; }
    .fmm-topbar { padding: 10px 28px; }
    .fmm-title { font-size: 20px; }
    .fmm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .fmm-grid-2 { grid-template-columns: 1fr; }
        .fmm-page { padding: 16px 12px; }
        .fmm-card { padding: 16px 14px; }
        .fmm-topbar { padding: 10px 12px; }
        .fmm-title { font-size: 16px; }
        .fmm-subtitle { font-size: 11px; }
        .fmm-header { flex-wrap: wrap; }
        .fmm-step-body { padding-left: 0 !important; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'warning' },
        tip: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'tip' },
        key: { bg: '#f0fdfa', border: '#99f6e4', color: '#115e59', icon: 'key' },
        danger: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: 'danger' },
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

function P({ children }) {
    return <p style={{ fontSize: 13, color: T.text, lineHeight: 1.75, marginBottom: 14 }}>{children}</p>;
}

/**
 * A screenshot yet to be captured. Forms has no images under `manualAssets`,
 * and importing a file that is not there fails the build — so the slot is
 * drawn, naming the screen and the path to save it at. Add the file, import it
 * at the top of this page, and swap the slot for an `<img>`.
 */
function ShotSlot({ screen, path, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <div style={{
                borderRadius: 10, padding: '20px 18px',
                border: '1px dashed #99f6e4', background: '#f6fdfc', textAlign: 'center',
            }}>
                <div style={{ marginBottom: 6, color: T.accent }}><LmIcon name="image" size={19} /></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#115e59', lineHeight: 1.5 }}>
                    Screenshot: {screen}
                </div>
                <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 5, lineHeight: 1.6 }}>
                    Save as <code>{path}</code>
                </div>
            </div>
            {caption && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{caption}</div>
            )}
        </div>
    );
}

/** A numbered walkthrough where every step carries its own screenshot. */
function Steps({ items }) {
    return (
        <ol style={{ listStyle: 'none', marginBottom: 18 }}>
            {items.map((item, i) => (
                <li key={item.title} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: T.accent, color: '#fff', fontSize: 12, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{i + 1}</div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>{item.title}</div>
                            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7 }}>{item.body}</div>
                        </div>
                    </div>
                    {item.shot && (
                        <div className="fmm-step-body" style={{ paddingLeft: 36 }}>
                            <ShotSlot screen={item.shot.screen} path={item.shot.path} />
                        </div>
                    )}
                </li>
            ))}
        </ol>
    );
}

function Rows({ items }) {
    return (
        <div style={{ marginBottom: 18 }}>
            {items.map((item) => (
                <div key={item.label} style={{
                    display: 'flex', gap: 10, padding: '10px 0',
                    borderBottom: `1px solid ${T.border}`,
                }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 175 }}>{item.label}</div>
                    <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>{item.desc}</div>
                </div>
            ))}
        </div>
    );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'form' },
    { id: 'build', label: 'Build a Form', icon: 'edit' },
    { id: 'share', label: 'Publish & Share', icon: 'link' },
    { id: 'student', label: 'What Respondents See', icon: 'mobile' },
    { id: 'responses', label: 'Responses', icon: 'insights' },
    { id: 'gotchas', label: 'Gotchas', icon: 'warning' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                Forms are the module&apos;s un-graded surface: surveys, feedback, sign-up sheets, project-group
                declarations, consent. Nothing here is marked, no response is ever scored, and no gradebook row
                is created. If you want a mark, you want a Quiz or an Assignment instead.
            </Note>

            <ShotSlot
                screen="The Forms tab for a class, with published and draft forms"
                path="manualAssets/forms/list.png"
                caption="The Forms tab. Badges show what is published, what is closed, and what is open to anyone with the link."
            />

            <SectionTitle>Eight Question Types</SectionTitle>
            <div className="fmm-grid-2" style={{ marginBottom: 8 }}>
                {[
                    { label: 'Short answer', desc: 'A single line of text.' },
                    { label: 'Paragraph', desc: 'A longer block of text.' },
                    { label: 'Multiple choice', desc: 'Pick one from a list.' },
                    { label: 'Checkboxes', desc: 'Pick any number from a list.' },
                    { label: 'Dropdown', desc: 'Pick one, from a dropdown.' },
                    { label: 'Linear scale', desc: 'Rate between two labels. Summarised with an average.' },
                    { label: 'Date', desc: 'A calendar date.' },
                    { label: 'File upload', desc: 'Attach a file as the answer.' },
                ].map((item) => (
                    <div key={item.label} style={{
                        border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 4,
                    }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, lineHeight: 1.55 }}>{item.desc}</div>
                    </div>
                ))}
            </div>

            <SectionTitle>How a Form Differs From a Quiz</SectionTitle>
            <Rows items={[
                { label: 'No marking', desc: 'There is no answer key, no score and no release step. A response is data, not an attempt.' },
                { label: 'No proctoring', desc: 'No fullscreen lock, no webcam, no Safe Exam Browser. A form is not an exam surface and should not be used as one.' },
                { label: 'Can leave the class', desc: 'A form can be shared as a link that anyone opens, signed in or not. Quizzes never leave the roster.' },
                { label: 'Answers are editable', desc: 'By default a second submission replaces the first rather than piling up a duplicate row.' },
            ]} />
        </div>
    );
}

function TabBuild() {
    return (
        <div>
            <P>
                The builder is deliberately close to Google Forms — a title, a description, and a list of
                questions you reorder, duplicate and delete. It validates as you go, so you find a problem before
                you share the form rather than after.
            </P>

            <Steps items={[
                {
                    title: 'Open the class → Forms → New form',
                    body: 'A blank draft is created and you land straight in the editor. A draft is invisible to students until you publish it.',
                    shot: { screen: 'Forms tab with the New-form button', path: 'manualAssets/forms/new-form.png' },
                },
                {
                    title: 'Give it a title and a description',
                    body: 'The description is what a respondent reads before the first question — say what the form is for and when it closes.',
                    shot: { screen: 'Form editor, title and description fields', path: 'manualAssets/forms/editor-title.png' },
                },
                {
                    title: 'Add a question and choose its type',
                    body: 'The type selector sits at the top of each question card. Changing the type resets its options — pick the type first, then write the options.',
                    shot: { screen: 'Form editor, question card with the type dropdown open', path: 'manualAssets/forms/editor-type.png' },
                },
                {
                    title: 'Fill in the options, or the scale',
                    body: 'Choice questions need at least two non-empty options. A linear scale needs a maximum greater than its minimum, and reads much better with both end labels filled in.',
                    shot: { screen: 'Form editor showing a choice question and a linear-scale question', path: 'manualAssets/forms/editor-options.png' },
                },
                {
                    title: 'Mark the questions that are required',
                    body: 'A required question blocks submission until it is answered. Use it sparingly on a voluntary survey — a required question is a reason to abandon the form.',
                    shot: { screen: 'Form editor, the Required checkbox on a question', path: 'manualAssets/forms/editor-required.png' },
                },
                {
                    title: 'Reorder, duplicate, delete',
                    body: 'The arrows move a question; the copy icon duplicates one with its options intact, which is the fast way to build a repetitive rating sheet.',
                    shot: { screen: 'Question card toolbar with the move, duplicate and delete controls', path: 'manualAssets/forms/editor-toolbar.png' },
                },
                {
                    title: 'Save',
                    body: 'The same validation runs again on the server, so nothing invalid is stored even if the page is out of date.',
                    shot: { screen: 'Form editor with the Save button and a validation warning', path: 'manualAssets/forms/editor-save.png' },
                },
            ]} />

            <Note type="tip">
                Build the whole form before publishing. Editing after responses have arrived is allowed, but a
                question added late is unanswered by everyone who has already submitted, and the CSV will show
                that column as empty for them.
            </Note>
        </div>
    );
}

function TabShare() {
    return (
        <div>
            <SectionTitle>Settings That Decide Who Answers</SectionTitle>
            <Rows items={[
                { label: 'Access: class', desc: 'The default. Only signed-in, active members of this class may respond. Their name, email and roll number are recorded with the response.' },
                { label: 'Access: anyone with the link', desc: 'Anyone holding the share link may respond, signed in or not. A signed-out respondent is asked for a name and is recorded as a guest.' },
                { label: 'One response per person', desc: 'On by default. A second submission overwrites the first instead of adding a duplicate row. Turn it off for a sign-up sheet that the same person legitimately fills in twice.' },
                { label: 'Collect email', desc: 'Records the respondent’s email address alongside the answers.' },
                { label: 'Show summary to respondents', desc: 'Off by default. With it on, a respondent sees the aggregate results after they submit — good for a poll, wrong for anything sensitive.' },
                { label: 'Closing time', desc: 'Optional. Leave it empty and the form never closes on its own.' },
                { label: 'Allow late responses', desc: 'What happens once the closing time passes. Off stops new and updated responses outright; on keeps accepting them and simply marks them late. Meaningless with no closing time set.' },
            ]} />

            <Steps items={[
                {
                    title: 'Set the access mode and the closing time',
                    body: 'Both live in the settings panel of the editor. Decide these before you publish — changing the access mode after the link is out changes who can answer a link already in circulation.',
                    shot: { screen: 'Form editor settings panel', path: 'manualAssets/forms/settings.png' },
                },
                {
                    title: 'Publish',
                    body: 'Publishing is what makes the form visible to students. It also mints the share code, once — the link is kept stable across every later edit, so a link you have already handed out never goes stale under you.',
                    shot: { screen: 'Form editor header with the Publish button', path: 'manualAssets/forms/publish.png' },
                },
                {
                    title: 'Copy the share link',
                    body: 'The link appears next to the publish control once the form is published. It opens the form directly, with no class navigation in the way.',
                    shot: { screen: 'The share link with its copy button', path: 'manualAssets/forms/share-link.png' },
                },
                {
                    title: 'Announce it',
                    body: 'For a class form, posting the link to the class stream is usually enough — it also shows up on the Forms tab on its own. For an anyone-with-the-link form, send the link wherever the audience is.',
                    shot: { screen: 'A class stream post carrying the form link', path: 'manualAssets/forms/announce.png' },
                },
            ]} />

            <Note type="warning">
                Unpublishing hides the form and stops the link working, but does not delete the responses already
                collected. A form set to <em>anyone with the link</em> is exactly as private as the link is —
                treat the link as the credential, because that is what it is.
            </Note>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <P>
                Two entry points, and they behave slightly differently. Knowing which one your audience is using
                saves most of the &ldquo;it says I have to sign in&rdquo; questions.
            </P>

            <SectionTitle>A class member, from the Forms tab</SectionTitle>
            <Steps items={[
                {
                    title: 'Open the class → Forms',
                    body: 'Published forms are listed with their closing time. A form they have already answered is badged Responded.',
                    shot: { screen: 'Student view of the Forms tab', path: 'manualAssets/forms/student-list.png' },
                },
                {
                    title: 'Fill it in',
                    body: 'Required questions are marked. Their identity is already known, so nothing has to be typed to prove who they are.',
                    shot: { screen: 'Student filling in a form', path: 'manualAssets/forms/student-fill.png' },
                },
                {
                    title: 'Submit — and edit if they need to',
                    body: 'With one-response-per-person on, reopening the form shows their previous answers and a resubmission replaces them.',
                    shot: { screen: 'The confirmation after submitting', path: 'manualAssets/forms/student-submitted.png' },
                },
            ]} />

            <SectionTitle>Anyone, from a share link</SectionTitle>
            <Steps items={[
                {
                    title: 'Open the link',
                    body: 'A signed-in class member goes straight to the questions. Someone signed out is asked for their name first, and answers as a guest.',
                    shot: { screen: 'The guest name prompt on a shared form link', path: 'manualAssets/forms/guest-name.png' },
                },
                {
                    title: 'Fill in and submit',
                    body: 'Identical from here on. Guest responses are labelled “(guest)” in the response list and in the CSV export, so they are never mistaken for a roster member’s.',
                    shot: { screen: 'A guest submitting a shared form', path: 'manualAssets/forms/guest-fill.png' },
                },
            ]} />

            <Note type="info">
                If the form is class-only, a signed-out visitor is asked to sign in, and a signed-in
                non-member is told they are not in the class. Neither is a bug — it is the access mode doing its
                job. Switch the form to <em>anyone with the link</em> if you meant to let outsiders in.
            </Note>
        </div>
    );
}

function TabResponses() {
    return (
        <div>
            <P>
                Everything a form has collected lives on its Responses screen, in three views.
            </P>

            <Rows items={[
                { label: 'Summary', desc: 'Per question: option counts for choice questions, a distribution and an average for a linear scale, the list of answers for text and date questions, and a count of files attached for an upload question.' },
                { label: 'Individual responses', desc: 'One respondent at a time, with their name, email, roll number and submission time. A response can be deleted from here — a test submission of your own, usually.' },
                { label: 'CSV export', desc: 'One row per response; columns are Name, Email, Roll No, Submitted At, then one column per question in form order. Checkbox answers are joined with a pipe, and a file-upload answer exports the file names.' },
            ]} />

            <Steps items={[
                {
                    title: 'Open the form → Responses',
                    body: 'The response count is on the form card, so you can see uptake without opening anything.',
                    shot: { screen: 'Responses screen, summary view', path: 'manualAssets/forms/responses-summary.png' },
                },
                {
                    title: 'Read the summary while it is still open',
                    body: 'The summary is the point of a feedback form — reading it before the closing time is what lets you nudge the people who have not answered.',
                    shot: { screen: 'Summary view showing a choice question and a linear scale', path: 'manualAssets/forms/responses-charts.png' },
                },
                {
                    title: 'Browse individual responses when something needs following up',
                    body: 'A single odd answer usually needs the person behind it, which the summary deliberately does not show you.',
                    shot: { screen: 'Individual response view', path: 'manualAssets/forms/responses-individual.png' },
                },
                {
                    title: 'Export to CSV for anything else',
                    body: 'Attendance lists, group allocations and anything that has to go into a spreadsheet or another system.',
                    shot: { screen: 'The export-to-CSV control', path: 'manualAssets/forms/responses-export.png' },
                },
            ]} />
        </div>
    );
}

function TabGotchas() {
    return (
        <div>
            <Note type="danger">
                <strong>A form is not an exam.</strong> No proctoring, no timer, no marking. If the answers
                decide a grade, build it as a Quiz or an Assignment.
            </Note>

            <ul style={{ fontSize: 13, color: T.text, lineHeight: 1.9, paddingLeft: 20, marginBottom: 16 }}>
                <li><strong>A draft is invisible.</strong> Students see nothing until you press Publish — the
                    single most common &ldquo;where is my form?&rdquo;</li>
                <li><strong>The share link is minted on first publish and never changes.</strong> That is
                    deliberate, so a reshare does not break a link already handed out. It also means the only way
                    to revoke a leaked link is to unpublish the form.</li>
                <li><strong>Closing time without &ldquo;allow late responses&rdquo; is a hard stop.</strong> Once
                    it passes, new and updated responses are both refused. Extend the closing time to reopen it.</li>
                <li><strong>Changing the type of a question clears its options.</strong> Choose the type first.</li>
                <li><strong>Editing after responses arrive leaves gaps.</strong> Anyone who already submitted has
                    no answer to a question added later, and their CSV cell is empty.</li>
                <li><strong>&ldquo;One response per person&rdquo; is keyed on identity.</strong> For guests that
                    means the browser they answered from — a guest who returns on another device is a new person
                    as far as the form is concerned.</li>
                <li><strong>Responses are not anonymous.</strong> Name, email and roll number are recorded for
                    class members. For genuinely anonymous feedback, use the class&apos;s Anonymous Feedback tab
                    instead.</li>
            </ul>

            <Note type="tip">
                Answer your own form once from a private window before you send it out. It is the fastest way to
                catch a required question you did not mean to require, an access mode set to the wrong thing, and
                a closing time set in the past.
            </Note>
        </div>
    );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function FormsManual({ standalone = false }) {
    const [tab, setTab] = useState('overview');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (!standalone) return;
        fetch(`${getEnvironment()}/user/getuser/`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setIsAuthenticated(true); })
            .catch(() => {});
    }, [standalone]);

    const TAB_CONTENT = {
        overview: <TabOverview />,
        build: <TabBuild />,
        share: <TabShare />,
        student: <TabStudent />,
        responses: <TabResponses />,
        gotchas: <TabGotchas />,
    };

    const activeIdx = TABS.findIndex((t) => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#042f2e', borderBottom: '1px solid #115e59',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="fmm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#0f766e,#2dd4bf)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                        }}><LmIcon name="form" size={16} /></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#99f6e4' }}>
                            Forms — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#5eead4',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #115e59', borderRadius: 7,
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#115e59'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="fmm-page" style={{ fontFamily: T.fontBody }}>
                <div className="fmm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#0f766e,#2dd4bf)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                    }}><LmIcon name="form" size={21} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="fmm-title" style={{ fontWeight: 800, color: T.text }}>Forms — Teacher Manual</div>
                        <div className="fmm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Surveys, feedback and sign-ups — nothing here is marked · XCEED Learning
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

                <div className="fmm-card" style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                    overflowX: 'auto',
                }}>
                    {TAB_CONTENT[tab]}
                </div>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                    <a href="/learning/manual" target="_blank" rel="noreferrer" style={{
                        fontSize: 12.5, color: T.accent, fontWeight: 600, textDecoration: 'none',
                    }}>
                        ← Back to Getting Started with the Learning Module
                    </a>
                </div>
            </div>
        </>
    );
}
