import React, { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

// The three shells stay eager: they are on the path to every screen below, so
// deferring them would only add a second round trip in front of each page. Every
// *page* is split — a student sitting a quiz has no reason to download the
// notebook editor's code mirror, the AI studio, or the staff dashboards, and
// before this they downloaded all of it. The Suspense boundary in `App.jsx`
// covers these too.
import LearningLayout from './components/LearningLayout';
import RequireTeacher from './components/RequireTeacher';
import ClassLayout from './pages/ClassLayout';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Stream = lazy(() => import('./pages/Stream'));
const Material = lazy(() => import('./pages/Material'));
const CourseworkDetail = lazy(() => import('./pages/CourseworkDetail'));
const GradeWork = lazy(() => import('./pages/GradeWork'));
const People = lazy(() => import('./pages/People'));
const Grades = lazy(() => import('./pages/Grades'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const PointsGuide = lazy(() => import('./pages/PointsGuide'));
const Discussions = lazy(() => import('./pages/Discussions'));
const Feedback = lazy(() => import('./pages/Feedback'));
const AiStudio = lazy(() => import('./pages/AiStudio'));
const AiPlayground = lazy(() => import('./pages/AiPlayground'));
const Insights = lazy(() => import('./pages/Insights'));
const ClassSettings = lazy(() => import('./pages/ClassSettings'));
const Quizzes = lazy(() => import('./pages/Quizzes'));
const QuizBrief = lazy(() => import('./pages/QuizBrief'));
const QuizAttempt = lazy(() => import('./pages/QuizAttempt'));
const QuizEditor = lazy(() => import('./pages/QuizEditor'));
const QuizResults = lazy(() => import('./pages/QuizResults'));
const Notebooks = lazy(() => import('./pages/Notebooks'));
const NotebookEditor = lazy(() => import('./pages/NotebookEditor'));
const NotebookPlayer = lazy(() => import('./pages/NotebookPlayer'));
const NotebookSubmissions = lazy(() => import('./pages/NotebookSubmissions'));
const Shorts = lazy(() => import('./pages/Shorts'));
const ShortEditor = lazy(() => import('./pages/ShortEditor'));
const ShortPresent = lazy(() => import('./pages/ShortPresent'));
const ShortSessions = lazy(() => import('./pages/ShortSessions'));
const ShortReport = lazy(() => import('./pages/ShortReport'));
const ShortJoin = lazy(() => import('./pages/ShortJoin'));
const ShortPlay = lazy(() => import('./pages/ShortPlay'));
const Tutorials = lazy(() => import('./pages/Tutorials'));
const Assignments = lazy(() => import('./pages/Assignments'));
const Labs = lazy(() => import('./pages/Labs'));
const LabBench = lazy(() => import('./pages/LabBench'));
const LabEditor = lazy(() => import('./pages/LabEditor'));
const LabResults = lazy(() => import('./pages/LabResults'));
const AssignmentImport = lazy(() => import('./pages/AssignmentImport'));
const AssignmentEditor = lazy(() => import('./pages/AssignmentEditor'));
const AssignmentPlayer = lazy(() => import('./pages/AssignmentPlayer'));
const AssignmentResults = lazy(() => import('./pages/AssignmentResults'));
const TutorialImport = lazy(() => import('./pages/TutorialImport'));
const TutorialEditor = lazy(() => import('./pages/TutorialEditor'));
const TutorialPlayer = lazy(() => import('./pages/TutorialPlayer'));
const TutorialResults = lazy(() => import('./pages/TutorialResults'));
const Todo = lazy(() => import('./pages/Todo'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Notifications = lazy(() => import('./pages/Notifications'));
const MyAttendance = lazy(() => import('./pages/MyAttendance'));
const Profile = lazy(() => import('./pages/Profile'));
const BugReports = lazy(() => import('./pages/BugReports'));
const DevTeam = lazy(() => import('./pages/DevTeam'));
const LmAdmin = lazy(() => import('./pages/LmAdmin'));

/**
 * The whole learning module hangs off one route in App.jsx (`/learning/*`),
 * so adding a screen here never touches the app-wide router.
 */
export default function LearningRoutes() {
  return (
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
          </Route>

          <Route path="tutorial/:tutorialId" element={<TutorialPlayer />} />
          <Route path="assignment/:assignmentId" element={<AssignmentPlayer />} />
        </Route>

        <Route path="*" element={<Navigate to="/learning" replace />} />
      </Route>
    </Routes>
  );
}
