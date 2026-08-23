import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { lazyWithPreload, registerRouteTree } from '../routePreload';

// The three shells stay eager: they are on the path to every screen below, so
// deferring them would only add a second round trip in front of each page. Every
// *page* is split — a student sitting a quiz has no reason to download the
// notebook editor's code mirror, the AI studio, or the staff dashboards, and
// before this they downloaded all of it. The Suspense boundary in `App.jsx`
// covers these too.
import LearningLayout from './components/LearningLayout';
import RequireTeacher from './components/RequireTeacher';
import ClassLayout from './pages/ClassLayout';
const SebExit = lazyWithPreload(() => import('./pages/SebExit'));
const Dashboard = lazyWithPreload(() => import('./pages/Dashboard'));
const Stream = lazyWithPreload(() => import('./pages/Stream'));
const Material = lazyWithPreload(() => import('./pages/Material'));
const CourseworkDetail = lazyWithPreload(() => import('./pages/CourseworkDetail'));
const GradeWork = lazyWithPreload(() => import('./pages/GradeWork'));
const People = lazyWithPreload(() => import('./pages/People'));
const Grades = lazyWithPreload(() => import('./pages/Grades'));
const Leaderboard = lazyWithPreload(() => import('./pages/Leaderboard'));
const PointsGuide = lazyWithPreload(() => import('./pages/PointsGuide'));
const Discussions = lazyWithPreload(() => import('./pages/Discussions'));
const Feedback = lazyWithPreload(() => import('./pages/Feedback'));
const AiStudio = lazyWithPreload(() => import('./pages/AiStudio'));
const AiPlayground = lazyWithPreload(() => import('./pages/AiPlayground'));
const Insights = lazyWithPreload(() => import('./pages/Insights'));
const ClassSettings = lazyWithPreload(() => import('./pages/ClassSettings'));
const Quizzes = lazyWithPreload(() => import('./pages/Quizzes'));
const QuizBrief = lazyWithPreload(() => import('./pages/QuizBrief'));
const QuizAttempt = lazyWithPreload(() => import('./pages/QuizAttempt'));
const QuizEditor = lazyWithPreload(() => import('./pages/QuizEditor'));
const QuizResults = lazyWithPreload(() => import('./pages/QuizResults'));
const Notebooks = lazyWithPreload(() => import('./pages/Notebooks'));
const NotebookEditor = lazyWithPreload(() => import('./pages/NotebookEditor'));
const NotebookPlayer = lazyWithPreload(() => import('./pages/NotebookPlayer'));
const NotebookSubmissions = lazyWithPreload(() => import('./pages/NotebookSubmissions'));
const Shorts = lazyWithPreload(() => import('./pages/Shorts'));
const ShortEditor = lazyWithPreload(() => import('./pages/ShortEditor'));
const ShortPresent = lazyWithPreload(() => import('./pages/ShortPresent'));
const ShortSessions = lazyWithPreload(() => import('./pages/ShortSessions'));
const ShortReport = lazyWithPreload(() => import('./pages/ShortReport'));
const ShortJoin = lazyWithPreload(() => import('./pages/ShortJoin'));
const ShortPlay = lazyWithPreload(() => import('./pages/ShortPlay'));
const Tutorials = lazyWithPreload(() => import('./pages/Tutorials'));
const Assignments = lazyWithPreload(() => import('./pages/Assignments'));
const Labs = lazyWithPreload(() => import('./pages/Labs'));
const LabBench = lazyWithPreload(() => import('./pages/LabBench'));
const LabEditor = lazyWithPreload(() => import('./pages/LabEditor'));
const LabResults = lazyWithPreload(() => import('./pages/LabResults'));
const AssignmentImport = lazyWithPreload(() => import('./pages/AssignmentImport'));
const AssignmentEditor = lazyWithPreload(() => import('./pages/AssignmentEditor'));
const AssignmentPlayer = lazyWithPreload(() => import('./pages/AssignmentPlayer'));
const AssignmentResults = lazyWithPreload(() => import('./pages/AssignmentResults'));
const TutorialImport = lazyWithPreload(() => import('./pages/TutorialImport'));
const TutorialEditor = lazyWithPreload(() => import('./pages/TutorialEditor'));
const TutorialPlayer = lazyWithPreload(() => import('./pages/TutorialPlayer'));
const TutorialResults = lazyWithPreload(() => import('./pages/TutorialResults'));
const Forms = lazyWithPreload(() => import('./pages/Forms'));
const FormEditor = lazyWithPreload(() => import('./pages/FormEditor'));
const FormFill = lazyWithPreload(() => import('./pages/FormFill'));
const FormResponses = lazyWithPreload(() => import('./pages/FormResponses'));
const FormLinkJoin = lazyWithPreload(() => import('./pages/FormLinkJoin'));
const Todo = lazyWithPreload(() => import('./pages/Todo'));
const Calendar = lazyWithPreload(() => import('./pages/Calendar'));
const Timetable = lazyWithPreload(() => import('./pages/Timetable'));
const Notifications = lazyWithPreload(() => import('./pages/Notifications'));
const MyAttendance = lazyWithPreload(() => import('./pages/MyAttendance'));
const Profile = lazyWithPreload(() => import('./pages/Profile'));
const BugReports = lazyWithPreload(() => import('./pages/BugReports'));
const DevTeam = lazyWithPreload(() => import('./pages/DevTeam'));
const LmAdmin = lazyWithPreload(() => import('./pages/LmAdmin'));
const LmAdminFaculty = lazyWithPreload(() => import('./pages/LmAdminFaculty'));

/**
 * The whole learning module hangs off one route in App.jsx (`/learning/*`),
 * so adding a screen here never touches the app-wide router.
 *
 * Built once at module load rather than per render so the preloader can read
 * the same patterns the router matches — see `registerRouteTree` below.
 */
const LEARNING_ROUTES = (
    <Routes>
      {/* Joining and answering a Short sit outside class/:classId — someone who
          scanned the QR at the front of the room has a code, not a class — and
          outside LearningLayout, whose bootstrap fetches the signed-in user and
          would bounce a guest to the login page. A deck with `requireLogin` off
          admits people with no account at all, so these two screens have to
          stand on their own. */}
      <Route path="short/join" element={<ShortJoin />} />
      <Route path="short/join/:code" element={<ShortJoin />} />
      <Route path="short/live/:sessionId" element={<ShortPlay />} />

      {/* A form shared as "anyone with the link" — outside class/:classId and
          LearningLayout for the same reason as the Short routes above: whoever
          opens this link may hold no account at all. See FormLinkJoin. */}
      <Route path="form/link/:shareCode" element={<FormLinkJoin />} />

      {/* Where Safe Exam Browser is sent to quit — the `quitURL` in the settings
          file. Outside LearningLayout on purpose: the layout fetches the signed-in
          user and would bounce to a login page, and a student being shown "you may
          close this" has nothing left to sign in for. */}
      <Route path="seb-exit" element={<SebExit />} />

      {/* `seb-check` is deliberately NOT a route here. It is served as plain HTML
          by the server, above the app's catch-all — see
          learningModule/services/sebCheckPage.js. It lived here first and did not
          survive a kiosk: reaching it needed the app to boot, match a route, load
          a lazy chunk and not trip the layout's redirect, and when any of that
          went wrong the page rendered blank and bounced to the sign-in screen
          with no way to find out why. A check has to answer when other things do
          not. */}

      <Route element={<LearningLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="todo" element={<Todo />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="notifications" element={<Notifications />} />
        {/* Attendance markings and disputes. Served by the attendance module's
            API, but reached from here because this is where students sign in. */}
        <Route path="attendance" element={<MyAttendance />} />
        <Route path="profile" element={<Profile />} />
        <Route path="bugs" element={<BugReports />} />
        <Route path="dev-team" element={<DevTeam />} />
        <Route path="lm-admin" element={<LmAdmin />} />
        {/* Not behind a client-side admin guard: every route here relies on the
            server for authorisation, and this one 403s into the same
            ErrorState as the dashboard it sits under. */}
        <Route path="lm-admin/faculty" element={<LmAdminFaculty />} />

        <Route path="class/:classId" element={<ClassLayout />}>
          <Route index element={<Stream />} />
          <Route path="material" element={<Material />} />
          {/* Classwork was split across Material, Quizzes, Shorts and Tutorials;
              old links land on the tab that inherited its reading material. */}
          <Route path="classwork" element={<Navigate to="../material" replace />} />
          <Route path="work/:courseworkId" element={<CourseworkDetail />} />
          <Route path="people" element={<People />} />
          <Route path="grades" element={<Grades />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="points" element={<PointsGuide />} />
          <Route path="discussions" element={<Discussions />} />
          <Route path="discussions/:discussionId" element={<Discussions />} />
          {/* Not behind RequireTeacher: the same screen serves the student who
              writes and the staff who read, and the server decides which. */}
          <Route path="feedback" element={<Feedback />} />
          <Route path="studio" element={<AiStudio />} />
          <Route path="playground" element={<AiPlayground />} />
          <Route path="quizzes" element={<Quizzes />} />
          <Route path="quiz/:quizId" element={<QuizBrief />} />
          <Route path="quiz/:quizId/attempt/:attemptId" element={<QuizAttempt />} />
          <Route path="notebooks" element={<Notebooks />} />
          <Route path="notebook/:notebookId" element={<NotebookPlayer />} />
          <Route path="shorts" element={<Shorts />} />
          <Route path="tutorials" element={<Tutorials />} />
          {/* Assignments: the assessed sibling of tutorials, on its own routes. */}
          <Route path="assignments" element={<Assignments />} />
          {/* Forms: a Google-Forms-like builder, entirely separate from quizzes
              and tutorials. The fill page is not behind RequireTeacher — the
              same class member who authors it elsewhere can also just be
              filling in somebody else's. */}
          <Route path="forms" element={<Forms />} />
          <Route path="form/:formId" element={<FormFill />} />
          {/* The virtual lab. The bench is not behind RequireTeacher because it
              is the same screen for both: a teacher opens it to check the
              experiment runs, a student opens it to do it, and the server
              decides what gets recorded. */}
          <Route path="labs" element={<Labs />} />
          <Route path="lab/:labId" element={<LabBench />} />

          {/* Staff screens. The server guards the data; this keeps a student
              who typed the URL from meeting a bare 403 where a page should be. */}
          <Route element={<RequireTeacher />}>
            <Route path="work/:courseworkId/grade" element={<GradeWork />} />
            <Route path="insights" element={<Insights />} />
            <Route path="settings" element={<ClassSettings />} />
            <Route path="quiz/:quizId/edit" element={<QuizEditor />} />
            {/* The same editor in its settings half — delivery, marking,
                proctoring, instructions and access, off the questions page's
                gear rather than crowding its tab bar. */}
            <Route path="quiz/:quizId/settings" element={<QuizEditor mode="settings" />} />
            <Route path="quiz/:quizId/results" element={<QuizResults />} />
            <Route path="notebook/:notebookId/edit" element={<NotebookEditor />} />
            <Route path="notebook/:notebookId/submissions" element={<NotebookSubmissions />} />
            <Route path="short/:shortId/edit" element={<ShortEditor />} />
            <Route path="short/:shortId/present/:sessionId" element={<ShortPresent />} />
            <Route path="short/:shortId/sessions" element={<ShortSessions />} />
            <Route path="short/:shortId/report/:sessionId" element={<ShortReport />} />
            <Route path="tutorial/:tutorialId/edit" element={<TutorialEditor />} />
            {/* Reviewing a tutorial read off an uploaded question paper. Teacher
                only, and produces nothing a student can see until it is merged
                and then published. */}
            <Route path="tutorial-import/:draftId" element={<TutorialImport />} />
            <Route path="tutorial/:tutorialId/results" element={<TutorialResults />} />
            <Route path="lab/:labId/edit" element={<LabEditor />} />
            <Route path="lab/:labId/results" element={<LabResults />} />
            <Route path="assignment/:assignmentId/edit" element={<AssignmentEditor />} />
            <Route path="assignment/:assignmentId/results" element={<AssignmentResults />} />
            {/* Reviewing an assignment read off an uploaded paper. */}
            <Route path="assignment-import/:draftId" element={<AssignmentImport />} />
            <Route path="form/:formId/edit" element={<FormEditor />} />
            <Route path="form/:formId/responses" element={<FormResponses />} />
          </Route>

          <Route path="tutorial/:tutorialId" element={<TutorialPlayer />} />
          <Route path="assignment/:assignmentId" element={<AssignmentPlayer />} />
        </Route>

        <Route path="*" element={<Navigate to="/learning" replace />} />
      </Route>
    </Routes>
);

// Registered when this chunk loads, which is the first time anyone navigates
// into the module — by which point the links these patterns serve are the ones
// on screen. The base is where App.jsx mounts us.
registerRouteTree(LEARNING_ROUTES, '/learning');

export default function LearningRoutes() {
  return LEARNING_ROUTES;
}
