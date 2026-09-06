// Public introduction to the XCEED Learning module. Reached from the "Newly
// launched" badge at the top of the home hero; deliberately readable without an
// account, since its audience is faculty and students who have not been given
// one yet. The in-depth teacher documentation lives at /learning/manual.

import { useEffect } from 'react';
import Footer from '../components/footer';
import {
  IntroHero,
  IntroSection,
  IntroCTA,
  FeatureGrid,
  StepFlow,
  StatRow,
} from '../components/intro/IntroPrimitives';

const ACCENT = 'cyan';

const FEATURES = [
  {
    icon: '🏫',
    title: 'Classes & material',
    desc: 'Every subject gets a class: notes, slides, links and recordings organised by topic, with announcements and threaded discussions alongside them.',
  },
  {
    icon: '📝',
    title: 'Assignments & grading',
    desc: 'Set work with due dates, collect submissions, grade them in a single side-by-side view, and let the gradebook total everything for you.',
  },
  {
    icon: '🧪',
    title: 'Quizzes & exams',
    desc: 'Question banks, randomised papers, auto-evaluation and per-question analytics — including locked-down attempts through Safe Exam Browser.',
  },
  {
    icon: '⚡',
    title: 'Shorts — live in class',
    desc: 'Present a deck and have the room answer from their phones in real time. Responses land instantly, and a session report shows who understood what.',
  },
  {
    icon: '💻',
    title: 'Coding labs & notebooks',
    desc: 'Students write and run code in the browser against your test cases. Notebook-style tutorials mix explanation, code and checkpoints on one page.',
  },
  {
    icon: '📋',
    title: 'Forms',
    desc: 'Feedback, consent, registrations and surveys — build a form, share a link, and read the responses without leaving the platform.',
  },
  {
    icon: '📊',
    title: 'Insights',
    desc: 'Per-class and per-student views of participation, submission rates and scores, plus HOD dashboards that roll the picture up to the department.',
  },
  {
    icon: '🏆',
    title: 'Points & leaderboard',
    desc: 'An optional points scheme that rewards steady participation, with a transparent guide so students can see exactly how a score was earned.',
  },
  {
    icon: '🗓️',
    title: 'One student home',
    desc: 'Timetable, calendar, to-do list, attendance and notifications together, so a student opens one page and knows what the day asks of them.',
  },
];

const STEPS = [
  {
    title: 'Create your class',
    desc: 'Pick the subject and semester and the class is ready. Students join with a code, or are enrolled in bulk from the department roster.',
  },
  {
    title: 'Add your material',
    desc: 'Upload notes and slides, or import content you already have. Material is grouped by topic so a student can follow the course end to end.',
  },
  {
    title: 'Set work that fits',
    desc: 'An assignment, a quiz, a coding lab, a live Short or a tutorial notebook — whichever suits the session. Each carries its own deadline and rules.',
  },
  {
    title: 'Grade once, see everything',
    desc: 'Auto-graded work scores itself; the rest is graded in one screen. Results flow straight into the gradebook and the insights views.',
  },
];

const STATS = [
  { value: '7+', label: 'Kinds of coursework' },
  { value: '0', label: 'Installs for students' },
  { value: 'Live', label: 'In-class Shorts' },
  { value: 'Free', label: 'For NITJ departments' },
];

export default function XceedLearningIntro() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="tw-font-jakarta tw-dark tw-bg-gray-900 tw-min-h-screen tw-text-white">
      <IntroHero
        accent={ACCENT}
        title="XCEED Learning"
        tagline="One place to teach a subject — and one place to study it"
        description="A learning platform built at NIT Jalandhar for the way courses actually run here: material, assignments, quizzes, coding labs, live in-class Shorts and feedback forms in a single classroom, with grades and insights that keep themselves up to date."
        primaryCta={{ to: '/learning', label: 'Open the module' }}
        secondaryCta={{ to: '/learning/manual', label: 'Read the teacher manual' }}
      />

      <IntroSection
        accent={ACCENT}
        kicker="Why it exists"
        title="Teaching tools that stop fighting each other"
        description="Course material in one drive folder, a quiz in another tool, attendance in a spreadsheet and marks in a third place — that scatter is the problem XCEED Learning was built to remove. Everything a subject needs sits inside the class it belongs to, and the records assemble themselves as you teach."
      >
        <StatRow accent={ACCENT} stats={STATS} />
      </IntroSection>

      <IntroSection
        accent={ACCENT}
        kicker="What is inside"
        title="Everything a class needs"
      >
        <FeatureGrid accent={ACCENT} features={FEATURES} />
      </IntroSection>

      <IntroSection
        accent={ACCENT}
        kicker="Getting started"
        title="From an empty class to a running course"
        description="Most faculty are teaching from it within an afternoon. Nothing to install — it runs in the browser, on a laptop or a phone."
      >
        <StepFlow accent={ACCENT} steps={STEPS} />
      </IntroSection>

      <IntroCTA
        accent={ACCENT}
        title="Bring your subject onto XCEED Learning"
        description="Faculty and students at NIT Jalandhar can sign in with their institute account. If you are not sure whether you have access yet, the help desk will sort it out."
        primaryCta={{ to: '/learning', label: 'Go to XCEED Learning' }}
        secondaryCta={{ to: '/help', label: 'Need help?' }}
      />

      <Footer />
    </main>
  );
}
