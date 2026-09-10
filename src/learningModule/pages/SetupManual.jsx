import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

import shotSignIn from '../manualAssets/setup/sign-in.png';
import shotForgotLink from '../manualAssets/setup/forgot-link.png';
import shotForgotEmail from '../manualAssets/setup/forgot-email.png';
import shotDashboard from '../manualAssets/setup/dashboard.png';
import shotCreateClass from '../manualAssets/setup/create-class.png';
import shotJoinClass from '../manualAssets/setup/join-class.png';
import shotClassHeader from '../manualAssets/setup/class-header.png';
import shotPeople from '../manualAssets/setup/people-tab.png';
import shotSettings from '../manualAssets/setup/class-settings.png';
import shotInviteEmail from '../manualAssets/setup/invite-email.png';
import shotInviteResults from '../manualAssets/setup/invite-results.png';
import shotApprove from '../manualAssets/setup/approve-request.png';
import shotJoinSent from '../manualAssets/setup/join-request-sent.png';
import shotInviteMail from '../manualAssets/setup/invite-email-received.png';
import shotWelcomeMail from '../manualAssets/setup/welcome-email.png';
import shotOtpMail from '../manualAssets/setup/otp-email.png';
import shotForgotReset from '../manualAssets/setup/forgot-reset.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#4f46e5',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
    .sum-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .sum-page { padding: 24px 28px; max-width: 940px; margin: 0 auto; }
    .sum-card { padding: 28px 32px; }
    .sum-topbar { padding: 10px 28px; }
    .sum-title { font-size: 20px; }
    .sum-subtitle { font-size: 13px; }
    @media (max-width: 720px) {
        .sum-grid-2 { grid-template-columns: 1fr; }
        .sum-page { padding: 16px 12px; }
        .sum-card { padding: 16px 14px; }
        .sum-topbar { padding: 10px 12px; }
        .sum-title { font-size: 16px; }
        .sum-subtitle { font-size: 11px; }
        .sum-header { flex-wrap: wrap; }
        .sum-step-body { padding-left: 0 !important; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Note({ type = 'info', children }) {
    const cfg = {
        info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'warning' },
        tip: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'tip' },
        key: { bg: '#eef2ff', border: '#c7d2fe', color: '#3730a3', icon: 'key' },
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

function Heading({ id, children }) {
    return (
        <div id={id} style={{ scrollMarginTop: 70, marginTop: 40, marginBottom: 14 }}>
            <div style={{
                fontSize: 18, fontWeight: 800, color: T.text,
                borderBottom: `1px solid ${T.border}`, paddingBottom: 8,
            }}>{children}</div>
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
 * A screenshot, shown at the width it was captured at rather than stretched to
 * the column.
 *
 * `width` is the capture's own CSS width — 900 for a full screen, a few hundred
 * for a cropped panel. Blowing a 420px dialog up to a 880px column made its
 * labels twice the size of the prose beside them. Shown at native width, the
 * type in the picture reads at about the size of the type around it.
 */
function Shot({ src, alt, caption, width = 880 }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <img src={src} alt={alt} style={{
                width, maxWidth: '100%', display: 'block', margin: '0 auto',
                borderRadius: 10,
                border: '1px solid #e4e8f5', boxShadow: '0 1px 8px rgba(26,31,60,0.10)',
            }} />
            {caption && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{caption}</div>
            )}
        </div>
    );
}

/**
 * A screenshot that has not been captured yet.
 *
 * Importing a file that is not there fails the build, so the slot is drawn
 * instead, naming the screen to capture and the path to save it at. Once the
 * file exists, import it at the top of this page and give the step an `image`
 * instead of a `shot` — nothing else about the section has to change.
 */
function ShotSlot({ screen, path, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <div style={{
                borderRadius: 10, padding: '20px 18px',
                border: '1px dashed #c7d2fe', background: '#f8faff', textAlign: 'center',
            }}>
                <div style={{ marginBottom: 6, color: T.accent }}><LmIcon name="image" size={19} /></div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#3730a3', lineHeight: 1.5 }}>
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

/**
 * A numbered walkthrough where every step carries its own screenshot — a step a
 * teacher cannot see is a step they will get wrong, so the picture sits with the
 * instruction rather than one summary image per section.
 *
 * A step gives either `image` (captured, imported at the top of this file) or
 * `shot` (still to be captured, drawn as a labelled slot).
 */
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
                    {(item.image || item.shot) && (
                        <div className="sum-step-body" style={{ paddingLeft: 36 }}>
                            {item.image
                                ? <Shot src={item.image.src} alt={item.image.alt} width={item.image.width} />
                                : <ShotSlot screen={item.shot.screen} path={item.shot.path} />}
                        </div>
                    )}
                </li>
            ))}
        </ol>
    );
}

const jumpTo = (id) => (event) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const SECTIONS = [
    { id: 'accounts', icon: 'user', label: 'Accounts, roles and where to sign in' },
    { id: 'create-class', icon: 'classes', label: 'Creating a class' },
    { id: 'class-code', icon: 'key', label: 'The class code, and how to use it' },
    { id: 'invite', icon: 'invite', label: 'Adding students by individual email ID' },
    { id: 'join-settings', icon: 'settings', label: 'Join settings and approving requests' },
    { id: 'student-join', icon: 'exam', label: 'What a student does to join' },
    { id: 'password', icon: 'locked', label: 'Setting or resetting a password' },
];

// ── page ──────────────────────────────────────────────────────────────────────

export default function SetupManual({ standalone = false }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (!standalone) return;
        fetch(`${getEnvironment()}/user/getuser/`, { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d) setIsAuthenticated(true); })
            .catch(() => {});
    }, [standalone]);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#1e1b4b', borderBottom: '1px solid #312e81',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="sum-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#4f46e5,#818cf8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                        }}><LmIcon name="classes" size={16} /></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#c7d2fe' }}>
                            Part 1 · Setting Up the Classroom
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#a5b4fc',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #312e81', borderRadius: 7,
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#312e81'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}

            <div className="sum-page" style={{ fontFamily: T.fontBody }}>
                <div className="sum-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#4f46e5,#818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                    }}><LmIcon name="classes" size={21} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="sum-title" style={{ fontWeight: 800, color: T.text }}>
                            Setting Up the Classroom
                        </div>
                        <div className="sum-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Part 1 of the XCEED Learning manuals · from an empty dashboard to a class full of students
                        </div>
                    </div>
                </div>

                <div className="sum-card" style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                    overflowX: 'auto',
                }}>
                    <Note type="key">
                        A class is the container for everything else in XCEED Learning — the stream, the material,
                        and every short, quiz, tutorial, assignment, form and coding notebook you go on to build.
                        Nothing else in the module works until one exists, so this is where every teacher starts.
                    </Note>

                    <SectionTitle>On this page</SectionTitle>
                    <div className="sum-grid-2" style={{ marginBottom: 10 }}>
                        {SECTIONS.map((item) => (
                            <a
                                key={item.id}
                                href={`#${item.id}`}
                                onClick={jumpTo(item.id)}
                                style={{
                                    display: 'flex', gap: 8, alignItems: 'baseline',
                                    fontSize: 13, color: T.text, textDecoration: 'none',
                                    padding: '6px 0', lineHeight: 1.5,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = T.text; }}
                            >
                                <span style={{ flexShrink: 0, color: T.accent }}><LmIcon name={item.icon} size={15} /></span>
                                <span>{item.label}</span>
                            </a>
                        ))}
                    </div>

                    <Heading id="accounts">Accounts, roles and where to sign in</Heading>
                    <P>
                        The platform lives at <code>https://xceed.nitj.ac.in</code>, and everyone signs in at
                        {' '}<a href="https://xceed.nitj.ac.in/login" target="_blank" rel="noreferrer"
                            style={{ color: T.accent, fontWeight: 600 }}>xceed.nitj.ac.in/login</a>. There is one
                        account per person and one sign-in for the whole platform — the learning module has no
                        separate login of its own.
                    </P>
                    <P>
                        Every account carries one or more platform roles. Only a <strong>FACULTY</strong> account
                        can create a class; a <strong>STUDENT</strong> account can join one. An account holding
                        neither — an attendance-only or events login, say — cannot join a class even with a valid
                        code, and is told to ask an administrator for the right role.
                    </P>
                    <P>
                        Inside a class the platform role stops mattering. What counts there is the class role on
                        the roster: <code>teacher</code> (the owner), <code>co-teacher</code>, or <code>student</code>.
                        A faculty member can legitimately sit in a colleague&apos;s class as a student, so being
                        staff on the platform does not make you staff in every room.
                    </P>
                    <Note type="key">
                        <strong>Do not have a faculty account yet?</strong> Fill in the Google form circulated to
                        departments, or write to <a href="mailto:xceed@nitj.ac.in" style={{ color: T.accent, fontWeight: 600 }}>xceed@nitj.ac.in</a> and
                        ask for one. Students do not need to ask — an account is created for them the moment a
                        teacher adds them to a class.
                    </Note>
                    <Note type="info">
                        You do not have to create accounts before you start. Adding someone by email creates
                        their account for them if it does not exist — see
                        <a href="#invite" onClick={jumpTo('invite')} style={{ color: T.accent, fontWeight: 600 }}> Adding students</a>.
                    </Note>

                    <Heading id="create-class">Creating a class</Heading>
                    <P>
                        Create one class per subject per section you teach. Everything you build afterwards hangs
                        off it.
                    </P>
                    <Steps items={[
                        {
                            title: 'Open the Learning dashboard',
                            body: 'Sign in, then go to /learning. Every class you teach or are enrolled in is listed here, under Active, Completed and Archived tabs.',
                            image: { src: shotDashboard, alt: 'The Learning dashboard' },
                        },
                        {
                            title: 'Choose “Create class”, and fill the dialog in',
                            body: 'Branch and Semester first — they narrow the Subject list, which is already limited to the current academic session, so a class cannot be filed under a session it was never taught in. Picking the subject fills in the class name for you; edit it if you want something friendlier. Then pick a theme colour: it is cosmetic, but it is how you will find the right card at a glance on a crowded dashboard.',
                            image: { src: shotCreateClass, alt: 'The Create-a-class dialog', width: 512 },
                        },
                        {
                            title: 'Create',
                            body: 'You land in the new class, and its join code is minted for you. Everything else — room, description, who may post — is in Class settings afterwards.',
                            image: { src: shotClassHeader, alt: 'A class, just created, on its Stream tab' },
                        },
                    ]} />
                    <Note type="info">
                        Creating the class does not bring a roster in with it. Fill the roster in yourself
                        afterwards — by giving out the class code, or by inviting students individually by
                        email, below.
                    </Note>

                    <Heading id="class-code">The class code, and how to use it</Heading>
                    <P>
                        Every class gets a seven-character join code when it is created — for
                        example <code>k7m2pqr</code>. Students type it once and they are in. The alphabet
                        deliberately leaves out the glyphs that get misread off a projector (zero and O, one and I
                        and l), because sixty people are about to type it at the same time.
                    </P>
                    <Steps items={[
                        {
                            title: 'Find the code in the class header',
                            body: 'It is shown on the class banner, with a button that copies it to your clipboard. It also appears in Class settings.',
                            image: { src: shotClassHeader, alt: 'The class header, with the join code beside People, Insights and Leaderboard' },
                        },
                        {
                            title: 'Read it out, or project it',
                            body: 'Case does not matter — students may type it in any case. What does matter is a trailing space when it is pasted out of a chat message, which is the most common reason a valid code is refused.',
                        },
                        {
                            title: 'Regenerate it if it leaks',
                            body: 'Class settings has a regenerate button. The old code stops working immediately; everyone already enrolled stays enrolled.',
                            image: { src: shotSettings, alt: 'Class settings, with the regenerate-code control' },
                        },
                    ]} />
                    <Note type="warning">
                        A code is a door, not a lock. Anyone holding it who has a student account can walk in
                        while it is enabled. For a class that must not gain members by accident, turn on
                        <em> require approval</em>, or switch code joining off once the roster is complete.
                    </Note>

                    <Heading id="invite">Adding students by individual email ID</Heading>
                    <P>
                        The code is the self-service route. When it does not cover everybody, put the rest of the
                        roster in yourself, from the <strong>People</strong> tab of the class, by pasting in their
                        addresses — <strong>individual student IDs only</strong>, one per person. A batch or group
                        ID cannot be used: it is a perfectly ordinary address as far as this screen can tell, and
                        everyone behind it ends up sharing the single account it belongs to.
                    </P>
                    <P>
                        Which route you need depends on who is in the class:
                    </P>
                    <div style={{ marginBottom: 18 }}>
                        {[
                            {
                                label: 'B.Tech students',
                                desc: 'Their accounts already exist. Share the class code and let them join themselves — there is nothing to invite.',
                            },
                            {
                                label: 'M.Tech, PhD and others',
                                desc: 'Invite them from the People tab, by their individual student IDs, one address per student.',
                            },
                            {
                                label: 'Anybody you cannot invite by ID',
                                desc: 'Somebody whose individual student ID you do not have, or who has no account and is not reachable at one: ask them to create their student account at xceed.nitj.ac.in/help, then share the class code for them to join with.',
                            },
                        ].map((item) => (
                            <div key={item.label} style={{
                                display: 'flex', gap: 10, padding: '10px 0',
                                borderBottom: `1px solid ${T.border}`,
                            }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 190 }}>{item.label}</div>
                                <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                    <Shot
                        src={shotPeople}
                        alt="The People tab, showing teachers and the student roster"
                        caption="The People tab. Invite people sits above the roster."
                    />
                    <Steps items={[
                        {
                            title: 'On the People tab, press “+ Invite” beside Students',
                            body: 'The dialog opens with Role set to Student. Individual email addresses are the only way a teacher puts somebody on the roster — the dialog repeats the three cases above, with this class\u2019s code to hand.',
                            image: { src: shotInviteEmail, alt: 'The Invite-people dialog, asking for individual email addresses', width: 512 },
                        },
                        {
                            title: 'Paste the addresses',
                            body: 'Separated by commas, spaces or new lines — up to 500 at a time.',
                        },
                        {
                            title: 'Send invites, and read the result rows',
                            body: 'Each address comes back with what happened to it: enrolled, invited, an account created, or already a member.',
                            image: { src: shotInviteResults, alt: 'The invite dialog’s result rows', width: 512 },
                        },
                    ]} />
                    <P>
                        What happens to an address depends on whether it already has an account:
                    </P>
                    <div className="sum-grid-2" style={{ marginBottom: 16 }}>
                        {[
                            { label: 'Account exists', desc: 'Enrolled straight away as an active member and notified in the app. They see the class the next time they open the dashboard.' },
                            { label: 'No account yet', desc: 'An account is created with a password nobody knows, and a welcome email goes out inviting them to choose their own. They are enrolled automatically.' },
                        ].map((item) => (
                            <div key={item.label} style={{
                                border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px',
                            }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                    <Note type="tip">
                        &ldquo;+ Invite&rdquo; beside <strong>Teachers</strong> opens the same dialog with Role set
                        to co-teacher — everything you can do in the class, except transfer ownership.
                    </Note>
                    <Note type="info">
                        Invitation mail goes out in the background after the roster rows are written, so the modal
                        returns immediately and then reports each address as its mail lands. An address that
                        shows &ldquo;enrolled but the email could not be sent&rdquo; is still a member — they just
                        have not been told, so mention it in class.
                    </Note>

                    <Heading id="join-settings">Join settings and approving requests</Heading>
                    <P>
                        <strong>Class settings</strong> holds the three controls that decide who gets in and what
                        they can do once they are there.
                    </P>
                    <Shot src={shotSettings} alt="Class settings, showing the membership switches" />
                    <div style={{ marginBottom: 18 }}>
                        {[
                            { label: 'Allow joining by code', desc: 'On by default. Turn it off once the roster is complete and the code stops working for new joiners.' },
                            { label: 'Require approval', desc: 'Off by default. With it on, a student who uses the code lands as a join request rather than a member: you are notified, and approve or decline from the People tab.' },
                            { label: 'Who can post', desc: 'Whether the stream is teachers-only, open for students to comment, or open for students to post. The default lets students comment but not start threads.' },
                        ].map((item) => (
                            <div key={item.label} style={{
                                display: 'flex', gap: 10, padding: '10px 0',
                                borderBottom: `1px solid ${T.border}`,
                            }}>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, minWidth: 170 }}>{item.label}</div>
                                <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65 }}>{item.desc}</div>
                            </div>
                        ))}
                    </div>
                    <Shot
                        src={shotApprove}
                        alt="The People tab with a pending join request, and its Approve and Decline buttons"
                        caption="Roster badges: Requested is waiting on you, Invited means the email went out but they have not signed in yet, and an unbadged row is an active member. Classmates’ addresses are blurred in this manual, not in the product."
                    />
                    <P>
                        Removing someone keeps their past submissions and grades resolvable — the row is marked
                        removed rather than deleted, so an old mark never turns into an anonymous number.
                    </P>

                    <Heading id="student-join">What a student does to join</Heading>
                    <P>
                        Two paths, depending on how you added them. Read the right one out in class — most
                        first-day confusion is a student following the wrong one.
                    </P>

                    <SectionTitle>You added them by email</SectionTitle>
                    <Steps items={[
                        {
                            title: 'Open the invitation email',
                            body: 'It names the class and carries a link. If they already had an account, the class is simply waiting on their dashboard and there is nothing to accept.',
                            image: { src: shotInviteMail, alt: 'The invitation email', width: 560 },
                        },
                        {
                            title: 'Set a password if the account is new',
                            body: 'The welcome email links to the set-your-password page. The next section walks through it.',
                            image: { src: shotWelcomeMail, alt: 'The welcome email, carrying the set-password link', width: 560 },
                        },
                        {
                            title: 'Sign in at xceed.nitj.ac.in/login and open /learning',
                            body: 'The class is already on the dashboard. No code needed.',
                        },
                    ]} />

                    <SectionTitle>They are joining with a code</SectionTitle>
                    <Steps items={[
                        {
                            title: 'Sign in at xceed.nitj.ac.in/login',
                            body: 'A code cannot be redeemed by a signed-out visitor, and the account must hold the student or faculty role.',
                            image: { src: shotSignIn, alt: 'The XCEED sign-in page at xceed.nitj.ac.in/login', width: 422 },
                        },
                        {
                            title: 'Open the Learning dashboard and choose “Join class”',
                            body: 'The button sits next to Create class.',
                        },
                        {
                            title: 'Type the seven-character code',
                            body: 'Case does not matter. The class name and teacher are shown back before they commit, so a mistyped code is caught before they land in the wrong room.',
                            image: { src: shotJoinClass, alt: 'The Join-a-class dialog, asking for the class code', width: 448 },
                        },
                        {
                            title: 'Join, or wait for approval',
                            body: 'If the class does not require approval they are in immediately. If it does, they see “Request sent” and appear on your People tab as Requested.',
                            image: { src: shotJoinSent, alt: 'The student’s screen after asking to join' },
                        },
                    ]} />
                    <Note type="warning">
                        <strong>&ldquo;No class matches that code.&rdquo;</strong> Almost always a typo, a code
                        that was regenerated, or one pasted with a trailing space.
                        <strong> &ldquo;Classes can only be joined by student and teaching-staff accounts&rdquo;</strong> means
                        the account is real but holds neither role — that one needs an administrator, not a new code.
                    </Note>

                    <Heading id="password">Setting or resetting a password</Heading>
                    <P>
                        An account created by an invitation has a password nobody knows — not even you. That is
                        deliberate: no plaintext password is ever emailed, and an unclaimed account cannot be
                        signed into. The student sets their own through the platform&apos;s ordinary
                        forgot-password flow, which is also what anyone uses after forgetting theirs.
                    </P>
                    <Steps items={[
                        {
                            title: 'Go to the forgot-password page',
                            body: 'Either follow the link in the welcome email, or open xceed.nitj.ac.in/forgot-password directly. It is also linked from the sign-in form.',
                            image: { src: shotForgotLink, alt: 'The sign-in form, with the Forgot Password link beneath the password field', width: 422 },
                        },
                        {
                            title: 'Enter the registered email address',
                            body: 'It must be the address the account was created with — the one their teacher invited.',
                            image: { src: shotForgotEmail, alt: 'The forgot-password page, asking for a registered email address', width: 403 },
                        },
                        {
                            title: 'Read the OTP out of the email',
                            body: 'A one-time code arrives by email. It is short-lived, so request it when they are ready to use it rather than the night before.',
                            image: { src: shotOtpMail, alt: 'The OTP email', width: 560 },
                        },
                        {
                            title: 'Choose a new password',
                            body: 'The OTP and the new password go in on the same page. They are signed in from there.',
                            image: { src: shotForgotReset, alt: 'The forgot-password page, at its OTP and new-password step' },
                        },
                    ]} />
                    <Note type="tip">
                        Two things worth saying out loud on day one: the OTP email can land in spam, and repeated
                        failed attempts will start asking for a captcha. If a student is stuck in a loop of wrong
                        passwords, send them here rather than letting them keep guessing — a locked-out student
                        on the morning of a quiz is a far worse problem.
                    </Note>

                    <Note type="key">
                        With a class created and a roster in it, the rest of the module is open to you. Each
                        activity type has its own manual — go back to the index for the full set.
                    </Note>
                </div>

                <div style={{ marginTop: 18, textAlign: 'center' }}>
                    <a href="/learning/manual" target="_blank" rel="noreferrer" style={{
                        fontSize: 12.5, color: T.accent, fontWeight: 600, textDecoration: 'none',
                    }}>
                        ← Back to the XCEED Learning manual index
                    </a>
                </div>
            </div>
        </>
    );
}
