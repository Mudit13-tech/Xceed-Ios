import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

// Captured at 900 CSS px so each one displays at about 1:1 in this column —
// see the note on <Shot>. The older 1280px captures under shorts/, quiz/ and
// the rest are left where they are for the manuals that already use them.
import shotSignIn from '../manualAssets/setup/sign-in.png';
import shotDashboard from '../manualAssets/setup/dashboard.png';
import shotShorts from '../manualAssets/module/tab-shorts.png';
import shotQuizzes from '../manualAssets/module/tab-quizzes.png';
import shotTutorials from '../manualAssets/module/tab-tutorials.png';
import shotAssignments from '../manualAssets/module/tab-assignments.png';
import shotForms from '../manualAssets/forms/list.png';
import shotCoding from '../manualAssets/module/tab-coding.png';
import shotStream from '../manualAssets/module/stream.png';
import shotMaterial from '../manualAssets/module/material.png';
import shotGrades from '../manualAssets/module/grades.png';
import shotStudio from '../manualAssets/module/ai-studio.png';
import shotForum from '../manualAssets/module/forum.png';
import shotFeedback from '../manualAssets/module/feedback.png';
import shotLeaderboard from '../manualAssets/module/leaderboard.png';
import shotInsights from '../manualAssets/module/insights.png';
import shotTodo from '../manualAssets/module/todo.png';
import shotCalendar from '../manualAssets/module/calendar.png';
import shotTimetable from '../manualAssets/module/timetable.png';
import shotNotifications from '../manualAssets/module/notifications.png';
import shotBugs from '../manualAssets/module/bugs.png';

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
    .gsm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .gsm-page { padding: 24px 28px; max-width: 940px; margin: 0 auto; }
    .gsm-card { padding: 28px 32px; }
    .gsm-topbar { padding: 10px 28px; }
    .gsm-title { font-size: 20px; }
    .gsm-subtitle { font-size: 13px; }
    .gsm-part-head { display: flex; align-items: flex-start; gap: 12px; }
    @media (max-width: 720px) {
        .gsm-grid-2 { grid-template-columns: 1fr; }
        .gsm-page { padding: 16px 12px; }
        .gsm-card { padding: 16px 14px; }
        .gsm-topbar { padding: 10px 12px; }
        .gsm-title { font-size: 16px; }
        .gsm-subtitle { font-size: 11px; }
        .gsm-header { flex-wrap: wrap; }
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
            paddingBottom: 6, marginBottom: 16, marginTop: 32,
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
 * labels twice the size of the prose beside them, and scaling a wide capture
 * down made them half. Shown at native width, the type in the picture reads at
 * about the size of the type around it, which is the whole point.
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
 * instead, naming the screen to capture and the path to save it at.
 */
function ShotSlot({ screen, path, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <div style={{
                borderRadius: 10, padding: '20px 18px',
                border: '1px dashed #c7d2fe', background: '#f8faff', textAlign: 'center',
            }}>
                <div style={{ marginBottom: 6, color: '#3730a3' }}><LmIcon name="image" size={19} /></div>
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
 * One numbered part of the manual set.
 *
 * The heading is the link, and it opens in its own tab: these are read side by
 * side while setting a class up, not in sequence, and losing the index to
 * follow one of its own entries is the wrong trade.
 */
function Part({ number, icon, title, href, where, children }) {
    return (
        <div style={{
            border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 20px',
            marginBottom: 16, background: '#fff',
        }}>
            <div className="gsm-part-head">
                <div style={{
                    width: 38, height: 38, borderRadius: 9, flexShrink: 0,
                    background: '#eef2ff', border: '1px solid #c7d2fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    color: T.accent,
                }}><LmIcon name={icon} size={19} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: T.accent,
                    }}>Part {number}</div>
                    <a href={href} target="_blank" rel="noreferrer" style={{
                        fontSize: 16, fontWeight: 800, color: T.text, textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                    }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = T.accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = T.text; }}
                    >
                        {title}
                        <span aria-hidden="true" style={{ fontSize: 12, color: T.accent }}>↗</span>
                    </a>
                    {where && (
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 3 }}>
                            On the class navbar: <strong style={{ color: T.text }}>{where}</strong>
                        </div>
                    )}
                </div>
            </div>
            <div style={{ marginTop: 12 }}>{children}</div>
            <a href={href} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 700, color: '#fff', background: T.accent,
                textDecoration: 'none', padding: '9px 16px', borderRadius: 8,
            }}>
                <LmIcon name="manual" size={14} />
                Open Part {number} in a new tab <span aria-hidden="true">↗</span>
            </a>
        </div>
    );
}

/** A feature with no manual of its own yet — described here, in one card. */
function Feature({ icon, name, where, image, children }) {
    return (
        <div style={{
            border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px', marginBottom: 12,
        }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ flexShrink: 0, color: T.accent }}><LmIcon name={icon} size={16} /></span>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{name}</div>
                    {where && <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{where}</div>}
                </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.7, marginTop: 8 }}>{children}</div>
            {image && <Shot src={image} alt={`The ${name} screen`} />}
        </div>
    );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function GettingStartedManual({ standalone = false }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Only the standalone page shows a "back to dashboard" link, and only to
        // someone actually signed in — a reader who followed this link out of an
        // email has nothing to go back to.
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
                }} className="gsm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#4f46e5,#818cf8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                        }}><LmIcon name="brand" size={16} /></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#c7d2fe' }}>
                            XCEED Learning — Manuals
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

            <div className="gsm-page" style={{ fontFamily: T.fontBody }}>
                <div className="gsm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#4f46e5,#818cf8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                    }}><LmIcon name="brand" size={21} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="gsm-title" style={{ fontWeight: 800, color: T.text }}>
                            XCEED Learning — Introduction and Manuals
                        </div>
                        <div className="gsm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Start here · each part opens in its own tab
                        </div>
                    </div>
                </div>

                <div className="gsm-card" style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                    overflowX: 'auto',
                }}>
                    <SectionTitle>What XCEED Learning is</SectionTitle>
                    <P>
                        XCEED Learning is the teaching and learning module of the XCEED platform, built in-house
                        at NIT Jalandhar by our own team, alongside the attendance, timetable, certificate and
                        conference modules it shares a sign-in with. It is a classroom you run online: you create
                        a class, put your students on its roster, and everything you set them afterwards lives in
                        one place — live questions in the room, marked and proctored quizzes, guided tutorials,
                        assignments handed in and graded, surveys and sign-up forms, and coding notebooks that run
                        in the browser. Around all of that sit the things that make a term work: a stream and
                        material library, a gradebook, a class forum, anonymous feedback, points and badges, a
                        calendar and timetable, and a cross-class to-do list. Because it is one platform rather
                        than a bought-in tool, it already knows your subjects, your semesters and your students,
                        and because we build it ourselves, anything you report as broken or missing goes to the
                        people who can actually change it.
                    </P>
                    <P>
                        There is one account and one sign-in for the whole platform, at
                        {' '}<a href="https://xceed.nitj.ac.in/login" target="_blank" rel="noreferrer"
                            style={{ color: T.accent, fontWeight: 600 }}>xceed.nitj.ac.in/login</a>. The learning
                        module has no separate login of its own, and the module itself lives
                        at <code>xceed.nitj.ac.in/learning</code>.
                    </P>
                    <Shot
                        src={shotSignIn}
                        alt="The XCEED sign-in form"
                        width={422}
                        caption="One sign-in for every module. Forgot Password sets a new one by OTP — Part 1 walks through it."
                    />

                    <Note type="key">
                        <strong>Getting a faculty account.</strong> Fill in the Google form circulated to
                        departments, or write to{' '}
                        <a href="mailto:xceed@nitj.ac.in" style={{ color: T.accent, fontWeight: 600 }}>xceed@nitj.ac.in</a>{' '}
                        and ask for one. Students never have to ask — an account is created for them the moment a
                        teacher adds them to a class.
                    </Note>

                    <Note type="tip">
                        <strong>There is an Android app.</strong> XCEED is on the Google Play Store, so students
                        and staff can carry the same classes, notifications and deadlines on a phone. The web app
                        stays the place to build and run things — authoring a quiz or invigilating one belongs on
                        a laptop — but for reading the stream, answering a Short and keeping up with what is due,
                        the app is the easier half.
                    </Note>

                    <Note type="key">
                        The parts below follow the order of the tabs along the top of a class, so what you read
                        here is laid out the way the module is. Every part opens in its own tab, and none of them
                        asks the reader to sign in — the links can be forwarded to staff who have no account yet.
                    </Note>

                    <SectionTitle>The manual, part by part</SectionTitle>

                    <Part
                        number={1}
                        icon="classes"
                        title="Setting up the classroom"
                        href="/learning/setupmanual"
                        where="before any of them — this is the class itself"
                    >
                        <P>
                            Creating a class, the seven-character join code, putting a roster together by roll
                            number or email, the settings that decide who may join and who must be approved, what
                            a student actually does to get in, and how an invited account sets its first password.
                            Nothing else in the module works until a class exists, so start here.
                        </P>
                        <Shot src={shotDashboard} alt="The Learning dashboard, listing the classes you teach" />
                    </Part>

                    <Part number={2} icon="short" title="Shorts" href="/learning/shortsmanual" where="Shorts">
                        <P>
                            Much like Mentimeter — instant live questions the whole room answers on their phones
                            while you present from the front — but with no cap on how many students can join, and
                            built to stay quick with a full lecture hall answering at once. A warm-up, a
                            temperature check, a recap at the end of the hour: publish a session, read out the
                            join code, and results build on the projector as answers arrive.
                            Eight slide types, including word cloud, scale and ranking. Deliberately unlike a
                            quiz: no window, no attempt cap, usually no gradebook row, and guests can join with
                            nothing but the code.
                        </P>
                        <Shot src={shotShorts} alt="The Shorts tab for a class" />
                    </Part>

                    <Part number={3} icon="quiz" title="Quizzes" href="/learning/quizmanual" where="Quizzes">
                        <P>
                            The assessment engine: a timed, marked paper with a real gradebook row behind it.
                            Question banks, sectioning, shuffling, negative marking, per-question timers and
                            partial credit. It is also where invigilation lives — access and room codes,
                            fullscreen and keyboard lockdown, webcam proctoring, Safe Exam Browser, and a live
                            monitor showing who is sitting, who has drifted and who has dropped off. Read this one
                            before your first graded paper, not during it.
                        </P>
                        <Shot src={shotQuizzes} alt="The Quizzes tab for a class" />
                    </Part>

                    <Part number={4} icon="tutorial" title="Tutorials" href="/learning/tutorialmanual" where="Tutorials">
                        <P>
                            Guided practice at the student&apos;s own pace: explanation, question, feedback, next
                            step. Nothing is invigilated and the emphasis is on getting there rather than on the
                            mark. Author from scratch or import a question set, preview exactly what a student
                            sees, and present it live to the room. The results show where the class collectively
                            stalled — usually more useful than any individual score.
                        </P>
                        <P>
                            Tutorials are parameterised exactly as assignments are: the same problem is set to
                            everyone, and each student is dealt their own numbers. Two students can work side by
                            side on the same question and neither can simply read the other&apos;s answer off the
                            page — which is what makes practising together useful rather than a shortcut.
                        </P>
                        <Shot src={shotTutorials} alt="The Tutorials tab for a class" />
                    </Part>

                    <Part number={5} icon="assignment" title="Assignments" href="/learning/assignmentmanual" where="Assignments">
                        <P>
                            Work set with a due date and handed back in — files, typed answers, or a structured
                            set of questions. Late submissions are flagged rather than silently accepted, so what
                            to do about them stays your decision. Grading happens on one screen per submission
                            with a comment thread attached, and the mark flows into the gradebook.
                        </P>
                        <P>
                            The part that matters most: <strong>every student gets their own version of the
                            paper</strong>. You author one problem with named variables in the prompt, and each
                            student is dealt their own values — the question is identical, the arithmetic is not,
                            so an answer copied from a neighbour is simply the wrong answer. Marking follows from
                            that: you write the formula rather than the answer, and it is evaluated against the
                            numbers that student was actually given, within a tolerance you set. The draw is
                            deterministic, so a student who reloads or comes back tomorrow sees the same numbers,
                            and a question can carry a constraint so nobody is handed a division by zero.
                        </P>
                        <Shot src={shotAssignments} alt="The Assignments tab for a class" />
                    </Part>

                    <Part number={6} icon="form" title="Forms" href="/learning/formsmanual" where="Forms">
                        <P>
                            Everything that is not an assessment: feedback, sign-up sheets, project-group
                            declarations, consent, a quick survey. Eight question types, an optional closing time,
                            and a choice between keeping it inside the class or sharing a link anyone can open,
                            signed in or not. Responses come back as a summary, one by one, or as a CSV. Nothing
                            here is marked.
                        </P>
                        <Shot src={shotForms} alt="The Forms tab for a class" />
                    </Part>

                    <Part number={7} icon="coding" title="Coding" href="/learning/codingmanual" where="Coding">
                        <P>
                            Notebooks of text and code cells that students actually run — Python and C execute
                            inside the browser, with no server to provision and nothing to install. Hidden test
                            cases are the part worth knowing about: attach inputs and expected outputs, verify
                            them against your own reference solution before publishing, and every submission is
                            checked automatically, so you grade with a pass/fail summary and a diff in front of
                            you.
                        </P>
                        <Shot src={shotCoding} alt="The Coding tab for a class" />
                    </Part>

                    {/* ── the rest of the class navbar ───────────────────── */}

                    <SectionTitle>Also inside a class</SectionTitle>
                    <P>
                        These share the same navbar and need no manual of their own — a paragraph each is enough
                        to know when to reach for them.
                    </P>

                    <Feature icon="stream" name="Stream" where="Class navbar · Stream" image={shotStream}>
                        The class noticeboard, and the first tab anyone lands on. You post announcements with
                        attachments; whether students may reply or start their own posts is a class setting.
                        Everything you publish elsewhere also lands here, so the stream is the honest record of
                        what the class has been asked to do.
                    </Feature>

                    <Feature icon="material" name="Material" where="Class navbar · Material" image={shotMaterial}>
                        Notes, slides, links and recordings — the things to read or watch before the work, which
                        is why it sits beside Shorts rather than with the things you hand in. Material can be
                        filed under topics, so a term&apos;s worth stays navigable in week eleven.
                    </Feature>

                    <Feature icon="grades" name="Grades" where="Class navbar · Grades" image={shotGrades}>
                        The gradebook. Every marked quiz, assignment, tutorial and notebook lands here as a
                        column, per student, and whether students can see their own is a class setting.
                    </Feature>

                    <Feature icon="ai" name="AI Studio" where="Class navbar · AI Studio" image={shotStudio}>
                        Turns a recorded lecture into notes, a tutorial and a quiz, which you then review and
                        publish to the class. It can pull a recording the attendance module already captured, or
                        take a transcript you paste in. Everything it produces is a draft for you to check — it
                        publishes nothing on its own.
                    </Feature>

                    <Feature icon="discussion" name="Forum" where="Class navbar · Forum" image={shotForum}>
                        Where the class talks and staff join in, kept separate from the stream so a student
                        question is not competing with the homework for the same space. Each student may start one
                        new topic a week, and the button says so before anything is typed.
                    </Feature>

                    <Feature icon="feedback" name="Anonymous Feedback" where="Class navbar · Anonymous Feedback" image={shotFeedback}>
                        The one tab that runs the other way — from the class to you — which is why it sits last
                        and in its own colour. Students write about teaching, pace, content, assessment or
                        communication, and you read it with no names attached. Be clear with your class about what
                        the promise is: the <em>teacher</em> never sees who wrote a note, but the author is
                        recorded and a platform administrator can see it. That is deliberate — a channel nobody
                        can be held to fills up with abuse, and an allegation that matters has to be traceable to
                        be actionable.
                    </Feature>

                    <Feature icon="people" name="People, Insights and Leaderboard" where="Class header, beside the class code" image={shotInsights}>
                        <strong>People</strong> is the roster — invite, approve, promote to co-teacher, remove.
                        <strong> Insights</strong> is what you open the class to check: who is behind and what
                        needs chasing. <strong>Leaderboard</strong> shows points and badges for the class, weekly
                        first and all-time second, because a term-long total is unwinnable for anyone who joined
                        late.
                    </Feature>

                    <Feature icon="medal" name="Points and badges" where="Class header · Leaderboard → How points work" image={shotLeaderboard}>
                        Students earn points for real work: an assignment is worth about 30, a submission 25 on
                        time and 10 late, sitting a quiz 20 plus up to 20 more by score, a tutorial or notebook
                        20, answering a whole Short session 5, starting a forum topic 15, writing anonymous
                        feedback 15, and a comment 2 up to ten a day. Badges are granted on top for streaks and
                        one-offs. The rules are served from the platform rather than written into a page, so the
                        in-app guide is always the current one.
                    </Feature>

                    {/* ── across every class ─────────────────────────────── */}

                    <SectionTitle>Across all your classes</SectionTitle>

                    <Feature icon="classes" name="Dashboard" where="/learning" image={shotDashboard}>
                        Every class you teach or are enrolled in, under Active, Completed and Archived, with
                        counts for pending work, submissions waiting to be reviewed and what is due this week. An
                        exam that is open for you right now is banner-ed at the top, above everything else.
                    </Feature>

                    <Feature icon="todo" name="To-do" where="Left sidebar · To-do" image={shotTodo}>
                        The cross-class pile. For a student, what is upcoming and what is already missing; for a
                        teacher, what has been handed in and is waiting to be marked. It is the one screen that
                        answers &ldquo;what do I owe, across everything?&rdquo;
                    </Feature>

                    <Feature icon="calendar" name="Calendar" where="Left sidebar · Calendar" image={shotCalendar}>
                        Due dates from every class on one month view, with institute holidays drawn in from the
                        attendance module — so a deadline you set on a holiday is visibly a deadline on a holiday
                        before you publish it.
                    </Feature>

                    <Feature icon="timetable" name="Timetable" where="Left sidebar · Timetable" image={shotTimetable}>
                        The teaching timetable, in the same design as the platform&apos;s own timetable module. For
                        a student it detects their department and semester from where they are actually enrolled,
                        so it opens on the right grid rather than asking them to pick one.
                    </Feature>

                    <Feature icon="notifications" name="Notifications" where="Bell, top right" image={shotNotifications}>
                        Announcements, new coursework, grades released, comments and deadlines. Each student
                        controls which of those reach them, per class, and you can mute a class you are only
                        watching.
                    </Feature>

                    {/* ── bugs ───────────────────────────────────────────── */}

                    <SectionTitle>Bugs and suggestions — please report them</SectionTitle>
                    <Note type="key">
                        This is the most useful thing you can do for the platform besides teaching on it. XCEED is
                        built and maintained in-house, so a report from you does not go into a vendor&apos;s
                        support queue — it reaches the people who write the code, and it is how nearly everything
                        in this module got fixed or added.
                    </Note>
                    <P>
                        The <strong>Bugs &amp; suggestions</strong> screen is open to staff and students alike,
                        because the people who find problems are the people using the thing. It takes two kinds of
                        report: <em>something is broken</em>, and <em>this would be better if</em>. The second is
                        worth as much as the first — a feature that works exactly as designed and still wastes
                        your Monday morning is a real defect, and we would rather hear it from you than not.
                    </P>
                    <P>
                        A report is read by a platform administrator and comes back with a state you can see:
                        <strong> waiting to be read</strong>, <strong>approved</strong>, <strong>already
                        known</strong>, <strong>not taken up</strong>, or <strong>done</strong>. Students earn 25
                        points for a report an administrator confirms is real — paid on confirmation, never on
                        submission, so the queue does not fill with reports written for the points.
                    </P>
                    <P>
                        What makes a report actionable: say what you did, what you expected, and what happened
                        instead; name the class and the item; and if there was an error on screen, quote it. A
                        screenshot is worth more than a paragraph. &ldquo;Quiz page broken&rdquo; costs a
                        round-trip to answer; &ldquo;opening results for the Unit 3 quiz shows a blank table for
                        students who were terminated&rdquo; can be fixed the same day.
                    </P>
                    <Shot src={shotBugs} alt="The Bug / Suggestion screen" />

                    <SectionTitle>A suggested first week</SectionTitle>
                    <ol style={{ fontSize: 13, color: T.text, lineHeight: 1.9, paddingLeft: 20, marginBottom: 16 }}>
                        <li>Create the class and put the roster in, so everything you build afterwards already has
                            an audience.</li>
                        <li>Leave code joining on for the first week to catch late registrations, then switch it
                            off once the roster settles.</li>
                        <li>Post one announcement and add some material — that proves notifications are reaching
                            students before a deadline depends on it.</li>
                        <li>Run a Short in the first live session. Five minutes, and it proves the room can get in
                            on their phones.</li>
                        <li>Set one assignment or tutorial before any graded quiz: a low-stakes hand-in surfaces
                            the students who never claimed their account while that is still a small problem.</li>
                        <li>Only then run a graded quiz, with the proctoring settings rehearsed on a practice
                            paper first.</li>
                    </ol>

                    <Note type="tip">
                        Keep this page bookmarked. Every part above opens in its own tab, so you can leave the
                        index open while you work through one.
                    </Note>
                </div>
            </div>
        </>
    );
}
