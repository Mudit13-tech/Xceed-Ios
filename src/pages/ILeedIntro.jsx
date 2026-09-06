// Public introduction to iLEED, the attendance module. Reached from the "Newly
// launched" badge at the top of the home hero. Readable without an account —
// department incharges and faculty tend to be sent here before they have one.
// The step-by-step operating manual lives at /ams-manual.

import { useEffect } from 'react';
import Footer from '../components/footer';
import ILeed, { ILEED_FULL_FORM } from '../attendancemodule/BrandName';
import {
  IntroHero,
  IntroSection,
  IntroCTA,
  FeatureGrid,
  StepFlow,
  StatRow,
} from '../components/intro/IntroPrimitives';

const ACCENT = 'emerald';

const FEATURES = [
  {
    icon: '📹',
    title: 'Ground truth capture',
    desc: 'Faces are collected from the same RTSP cameras that will later mark attendance — same angles, same lighting — which is what makes recognition hold up in a real classroom.',
  },
  {
    icon: '🏷️',
    title: 'Roll assignment',
    desc: 'The system groups captured faces into one cluster per person. A department incharge maps each cluster to a roll number once, and it stays mapped.',
  },
  {
    icon: '🧠',
    title: 'Subject embeddings',
    desc: 'Each subject is matched against only the students registered for it, rather than the whole institute — faster recognition and far fewer mistaken identities.',
  },
  {
    icon: '✅',
    title: 'Live attendance',
    desc: 'During a session the stream is scanned, faces are matched against the subject batch, and the register fills in as the class happens.',
  },
  {
    icon: '📈',
    title: 'Reports & verification',
    desc: 'Session and subject reports, with the captured frames kept alongside them so any entry can be checked against what the camera actually saw.',
  },
  {
    icon: '⚖️',
    title: 'Disputes & overrides',
    desc: 'A student can contest a session, and staff can override an ERP record with a reason attached. Every correction leaves a trail.',
  },
  {
    icon: '🎯',
    title: 'Confidence monitor',
    desc: 'Watch how confidently the model is recognising each batch, so a camera that has drifted or a student whose photos need refreshing shows up early.',
  },
  {
    icon: '🗂️',
    title: 'Camera registry',
    desc: 'Register rooms and their RTSP streams once, preview them live, and record a stream when something needs to be looked at again later.',
  },
  {
    icon: '📅',
    title: 'Extra & altered classes',
    desc: 'Sessions that do not sit on the timetable — extra classes, swapped slots, changed rooms — are handled instead of being left to a paper sheet.',
  },
];

const STEPS = [
  {
    title: 'Register the cameras',
    desc: 'Each classroom camera is added to the registry with its RTSP stream and the room it covers. Existing CCTV is used as it stands — no new hardware in the room.',
  },
  {
    title: 'Capture ground truth',
    desc: 'The system cycles through the cameras and collects face images of the students actually sitting in those rooms, under the conditions attendance will run in.',
  },
  {
    title: 'Assign rolls',
    desc: 'The incharge sees a cluster of captured images per person, alongside the ERP photo for visual identification, and confirms the roll number.',
  },
  {
    title: 'Build subject embeddings',
    desc: 'Registered students are mapped per subject, producing a compact set of embeddings for each batch the model will be asked to recognise.',
  },
  {
    title: 'Run attendance',
    desc: 'From then on the session marks itself. Reports, frames and confidence figures are there for whoever needs to verify a record.',
  },
];

const STATS = [
  { value: 'CCTV', label: 'Uses cameras already installed' },
  { value: 'Live', label: 'Marked as the class runs' },
  { value: 'Frames', label: 'Kept for verification' },
  { value: 'Per-subject', label: 'Recognition scope' },
];

export default function ILeedIntro() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="tw-font-jakarta tw-dark tw-bg-gray-900 tw-min-h-screen tw-text-white">
      <IntroHero
        accent={ACCENT}
        wordmark={
          <ILeed style={{ color: '#fff', fontSize: '3rem', lineHeight: 1 }} />
        }
        title="Attendance that marks itself"
        tagline={ILEED_FULL_FORM}
        description="iLEED turns the CCTV already installed in your classrooms into an attendance register. Faces are learned from those same cameras, matched only against the students registered for the subject, and every entry keeps the frame it came from so it can be checked."
        primaryCta={{ to: '/attendance', label: 'Open the module' }}
        secondaryCta={{ to: '/ams-manual', label: 'Read the manual' }}
      />

      <IntroSection
        accent={ACCENT}
        kicker="Why it exists"
        title="The register is the part nobody has time for"
        description="Calling names costs the first ten minutes of a class, proxies are hard to catch, and the sheet still has to be typed into ERP afterwards. iLEED removes all three steps by reading the room from the camera that is already pointed at it — and, because ground truth is captured from those same cameras rather than from ID photographs, it recognises students in the conditions that actually occur."
      >
        <StatRow accent={ACCENT} stats={STATS} />
      </IntroSection>

      <IntroSection accent={ACCENT} kicker="What is inside" title="From camera to register">
        <FeatureGrid accent={ACCENT} features={FEATURES} />
      </IntroSection>

      <IntroSection
        accent={ACCENT}
        kicker="How a department starts"
        title="Five steps, done once per batch"
        description="Setup is front-loaded: once cameras are registered and a batch has its ground truth and embeddings, day-to-day attendance needs no one to operate it."
      >
        <StepFlow accent={ACCENT} steps={STEPS} />
      </IntroSection>

      <IntroSection
        accent={ACCENT}
        kicker="Handled carefully"
        title="Records you can defend"
        description="Face data is captured and used only for attendance within the institute, scoped to the subject batch being recognised. ERP photographs are used for visual identification during roll assignment only — never as the basis for recognition. Session frames are retained so a disputed entry can be reviewed, students can contest a session themselves, and every ERP override carries a reason and an author."
      >
        <div className="tw-rounded-xl tw-border tw-border-gray-700 tw-bg-gray-800/60 tw-p-6 tw-text-sm tw-leading-relaxed tw-text-gray-400">
          Attendance disputes, ERP overrides and the confidence monitor are all part
          of the module rather than bolted on afterwards — the assumption is that a
          system will occasionally be wrong, and that the people affected need a way
          to say so.
        </div>
      </IntroSection>

      <IntroCTA
        accent={ACCENT}
        title="Bring iLEED to your department"
        description="Department incharges at NIT Jalandhar can sign in with their institute account. If you are not sure whether your department has been enabled yet, the help desk will point you at the right person."
        primaryCta={{ to: '/attendance', label: 'Go to iLEED' }}
        secondaryCta={{ to: '/help', label: 'Need help?' }}
      />

      <Footer />
    </main>
  );
}
