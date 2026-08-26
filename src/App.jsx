// client/src/App.jsx
//
// Every screen below is loaded on demand.
//
// These were static imports — some 160 of them — which put the timetable admin,
// the conference and certificate modules, the attendance/ML consoles and the
// learning module into one entry chunk that came to 17.8 MB. A student opening
// a quiz downloaded all of it before the first pixel, and a batch of them
// starting a test together downloaded it *simultaneously*, which is what took
// the server down. `lazy` here means a route costs its own screen and nothing
// else; Vite splits one chunk per import and shares what they have in common.
//
// The identifiers are unchanged, so the routing table below reads exactly as it
// did. Only `Navbar` stays eager — it is on every page, and deferring it buys a
// flash of missing chrome for no saving.

import React, { Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  RouterProvider,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import {
  lazyWithPreload,
  registerRouteTree,
  useLinkPreloading,
} from './routePreload';
const Timetable = lazyWithPreload(() => import('./timetableadmin/timetable'));
const Timetable2 = lazyWithPreload(() => import('./timetableadmin/timetable2.jsx'));
const CreateTimetable = lazyWithPreload(() => import('./timetableadmin/creatett'));
const MasterFaculty = lazyWithPreload(() => import('./timetableadmin/masterfaculty'));
const AddFaculty = lazyWithPreload(() => import('./timetableadmin/addfaculty'));
const MasterRoom = lazyWithPreload(() => import('./timetableadmin/masterroom'));
const MasterSem = lazyWithPreload(() => import('./timetableadmin/mastersem'));
const AddSem = lazyWithPreload(() => import('./timetableadmin/addsemester'));
const AddRoom = lazyWithPreload(() => import('./timetableadmin/addroom'));
const LockedSummary = lazyWithPreload(() => import('./timetableadmin/lockedsummary'));
const Login = lazyWithPreload(() => import('./dashboard/login'));
const Messages = lazyWithPreload(() => import('./timetableadmin/messages'));
const ForgotPassword = lazyWithPreload(() => import('./dashboard/ForgotPassword'));
const SuperAdminPage = lazyWithPreload(() => import('./dashboard/superadmin'));
const BugReportsAdmin = lazyWithPreload(() => import('./dashboard/bugReports'));
const DevTeamApplicationsAdmin = lazyWithPreload(() => import('./dashboard/devTeamApplications'));
const DeptAdminAssignPage = lazyWithPreload(() => import('./dashboard/deptAdminAssign'));
const CommonSlot = lazyWithPreload(() => import('./timetableadmin/commonslot.jsx'));
const Subjects = lazyWithPreload(() => import('./timetableadmin/addsubjects'));
const ImportTT = lazyWithPreload(() => import('./timetableadmin/importt.jsx'));

const ViewMRooms = lazyWithPreload(() => import('./timetableadmin/viewmrooms'));
const MessagesPage = lazyWithPreload(() => import('./timetableadmin/viewMessages.jsx'));

// import LockedView from './timetableviewer/viewer';
const Note = lazyWithPreload(() => import('./timetableadmin/addnote'));
import Navbar from './components/home/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
const PrintSummary = lazyWithPreload(() => import('./timetableadmin/printSummary'));
const LoadDistribution = lazyWithPreload(() => import('./timetableadmin/loaddistribution'));
const RegistrationForm = lazyWithPreload(() => import('./dashboard/register'));
const AllotmentForm = lazyWithPreload(() => import('./timetableadmin/allotment'));
const MasterDelete = lazyWithPreload(() => import('./timetableadmin/masterdelete'));
const AdminPage = lazyWithPreload(() => import('./timetableadmin/admin'));
const ViewAllotmentPage = lazyWithPreload(() => import('./timetableadmin/viewroomallotment'));
const CommonLoad = lazyWithPreload(() => import('./timetableadmin/addcommonload'));
const MasterView = lazyWithPreload(() => import('./timetableadmin/mastersearch'));
const View = lazyWithPreload(() => import('./timetableadmin/masterview'));
const AllocatedRolesPage = lazyWithPreload(() => import('./dashboard/allotedroles'));
const FirstYearLoad = lazyWithPreload(() => import('./timetableadmin/firstyearload'));
const FirstYearFaculty = lazyWithPreload(() => import('./timetableadmin/addfirstyearfaculty'));
const LunchLoad = lazyWithPreload(() => import('./timetableadmin/addlunchload'));
const FacultyDeptHourLoad = lazyWithPreload(() => import('./timetableadmin/viewdeptfacultyload.jsx'));
// import InstituteLoad from './timetableadmin/instituteload';
// import ViewInstituteLoad from './timetableadmin/viewinstituteload';
const EditMasterFaculty = lazyWithPreload(() => import('./timetableadmin/editmasterfaculty'));
const ImportForm = lazyWithPreload(() => import('./timetableadmin/importCentralRoom'));
// import MergePDFComponent from './filedownload/mergepdfdocuments';
const TimetableMasterView = lazyWithPreload(() => import('./timetableadmin/masterview'));
// import MasterDataTable from './timetableadmin/viewmasterclasstable.jsx';
const FacultyLoadCalculation = lazyWithPreload(() => import('./timetableadmin/facultyloadadmin.jsx'));
const MasterLoadDataTable = lazyWithPreload(() => import('./timetableadmin/viewinstituteloadmaster.jsx'));
const Departmentloadallocation = lazyWithPreload(() => import('./timetableadmin/departmentloadallocation.jsx'));
const FacultyHourLoad = lazyWithPreload(() => import('./timetableadmin/facultyhourload.jsx'));
const FacultyLoadCOE = lazyWithPreload(() => import('./timetableadmin/facultyloadcoe.jsx'));
const AdminClash = lazyWithPreload(() => import('./timetableadmin/AdminClashes.jsx'));
const InstituteMergedDownload = lazyWithPreload(() => import('./timetableadmin/instituteMergedDownload.jsx'));

const Home = lazyWithPreload(() => import('./pages/Home'));
const GuidePage = lazyWithPreload(() => import('./pages/GuidePage'));
const PrivacyPolicy = lazyWithPreload(() => import('./pages/PrivacyPolicy'));
const ErrorPage = lazyWithPreload(() => import('./pages/ErrorPage.jsx'));
const NotFound = lazyWithPreload(() => import('./pages/NotFound.jsx'));
// The platform-admin gate on /superadmin and /usermanagement. Lazy like every
// other route element: it renders <NotFound /> on a refusal, and pulling that
// (and lottie with it) into the entry chunk is exactly what the note at the top
// of this file is about.
const RequireAdmin = lazyWithPreload(() => import('./components/RequireAdmin.jsx'));
const LogoAnimation = lazyWithPreload(() => import('./components/login/LogoAnimation.jsx').then((m) => ({ default: m.LogoAnimation })));
const EventRegistration = lazyWithPreload(() => import('./certificatemodule/pages/eventregistration'));
const CMDashboard = lazyWithPreload(() => import('./certificatemodule/pages/cmdashboard'));
const CertificateForm = lazyWithPreload(() => import('./certificatemodule/pages/certificatedesign'));
// import Certificate from './certificatemodule/pages/certificatetemplates/Certificate';
const ServicePage = lazyWithPreload(() => import('./pages/Service'));
const Participant = lazyWithPreload(() => import('./certificatemodule/pages/participantdataupload'));
const UserEvents = lazyWithPreload(() => import('./certificatemodule/pages/UserEvents'));
const UserLogos = lazyWithPreload(() => import('./certificatemodule/pages/UserLogo.jsx'));
const UserSignatures = lazyWithPreload(() => import('./certificatemodule/pages/UserSignatures.jsx'));

const EODashboard = lazyWithPreload(() => import('./conferencemodule/layout/eodashboard'));
const Accomodation = lazyWithPreload(() => import('./conferencemodule/Tabs/Accomodation'));
const HomeConf = lazyWithPreload(() => import('./conferencemodule/Tabs/HomeConf'));
const Sidebar = lazyWithPreload(() => import('./conferencemodule/components/Sidebar'));
const Speaker = lazyWithPreload(() => import('./conferencemodule/Tabs/Speaker'));
const Committees = lazyWithPreload(() => import('./conferencemodule/Tabs/Committees'));
const Sponsors = lazyWithPreload(() => import('./conferencemodule/Tabs/Sponsors'));
const Awards = lazyWithPreload(() => import('./conferencemodule/Tabs/Awards'));
const Announcement = lazyWithPreload(() => import('./conferencemodule/Tabs/Annoumcement'));
const Contacts = lazyWithPreload(() => import('./conferencemodule/Tabs/Contacts'));
const Images = lazyWithPreload(() => import('./conferencemodule/Tabs/Images'));
const EventDates = lazyWithPreload(() => import('./conferencemodule/Tabs/EventDates'));
const Participants = lazyWithPreload(() => import('./conferencemodule/Tabs/Participants'));
const NavbarConf = lazyWithPreload(() => import('./conferencemodule/Tabs/NavbarConf'));
const NavMenu = lazyWithPreload(() => import('./conferencemodule/Tabs/NavMenu'));
const HomeLayout = lazyWithPreload(() => import('./conferencemodule/Tabs/HomeLayout'));
const SpeakerLayout = lazyWithPreload(() => import('./conferencemodule/Tabs/SpeakerLayout'));
const Customisation = lazyWithPreload(() => import('./conferencemodule/Tabs/Customisation'));
const Location = lazyWithPreload(() => import('./conferencemodule/Tabs/Location'));
const CommonTemplate = lazyWithPreload(() => import('./conferencemodule/Tabs/CommonTemplate'));
const ConferencePage = lazyWithPreload(() => import('./conferencemodule/Tabs/ConferencePage'));

const Template01 = lazyWithPreload(() => import('./certificatemodule/pages/certificatetemplates/akleem'));
// import ViewCertificate from './certificatemodule/pages/participantCerti';
const Template03 = lazyWithPreload(() => import('./certificatemodule/pages/certificatetemplates/03_sarthak'));

const SponsorshipRate = lazyWithPreload(() => import('./conferencemodule/Tabs/SponsorshipRates'));
const Event = lazyWithPreload(() => import('./conferencemodule/Tabs/Events'));
const Souvenir = lazyWithPreload(() => import('./conferencemodule/Tabs/Souvenir'));

const NirfRanking = lazyWithPreload(() => import('./nirf/rankings'));

// imports for Quiz Module
const CreateQuiz = lazyWithPreload(() => import('./quizModule/creator/createQuiz/CreateQuiz'));
const AddQuestionHome = lazyWithPreload(() => import('./quizModule/creator/addQuestion/AddQuestionHome'));
const AddInstruction = lazyWithPreload(() => import('./quizModule/creator/addQuestion/AddInstruction'));
const PreviewInstructions = lazyWithPreload(() => import('./quizModule/creator/addQuestion/PreviewInstructions'));
const Settings = lazyWithPreload(() => import('./quizModule/creator/addQuestion/settings'));
const Quizzing = lazyWithPreload(() => import('./quizModule/student/quizzing/Quizzing'));
// import Instructions from './quizModule/student/Instructions';
const QuizFeedback = lazyWithPreload(() => import('./quizModule/student/quizFeedback/QuizFeedback'));
const UserManagement = lazyWithPreload(() => import('./dashboard/userManagement'));
const UserEventRegistration = lazyWithPreload(() => import('./certificatemodule/pages/addEvent'));

const Form = lazyWithPreload(() => import('./platform/Form.jsx'));
const PlatformLayout = lazyWithPreload(() => import('./platform/PlatformLayout.jsx'));
const PlatformDashboard = lazyWithPreload(() => import('./platform/PlatformDashboard.jsx'));
const PlatformConfig = lazyWithPreload(() => import('./platform/PlatformConfig.jsx'));
const PlatformModules = lazyWithPreload(() => import('./platform/PlatformModules.jsx'));
const PlatformData = lazyWithPreload(() => import('./platform/PlatformData.jsx'));

// import fileUpload
const FileUpload = lazyWithPreload(() => import('./fileUpload/fileUploads.jsx'));
const PaymentPortal = lazyWithPreload(() => import('./conferencemodule/pages/PaymentPortal.jsx'));

//import machine learning modules
const LinearRegression = lazyWithPreload(() => import('./mlcoursemodule/linearregression.jsx'));

//import for ml project of face recognition and attendance system
const MLDashboard = lazyWithPreload(() => import('./ml/MLDashboard'));

//import faculty rankings
const FacultyDashboard = lazyWithPreload(() => import('./instituterankings/facultydashboard.jsx'));
const Logs = lazyWithPreload(() => import('./timetableadmin/logs.jsx'));

// ─── Attendance Module Imports ────────────────────────────────────
const EditGroundTruth = lazyWithPreload(() => import('./attendancemodule/editgroundtruth'));
const RollAssign = lazyWithPreload(() => import('./attendancemodule/rollassign'));
// import FlaggedAssign from './attendancemodule/flaggedassign';
const Attendancedoc = lazyWithPreload(() => import('./attendancemodule/Attendancedoc'));
const ModelPerformance = lazyWithPreload(() => import('./attendancemodule/modelperformance'));
const ModelAnalytics = lazyWithPreload(() => import('./attendancemodule/ModelAnalytics'));
const AttendanceReport = lazyWithPreload(() => import('./attendancemodule/AttendanceReport'));
const GroundTruthRTSP = lazyWithPreload(() => import('./attendancemodule/groundtruthgen_rtsp'));
const GroundTruthUpload = lazyWithPreload(() => import('./attendancemodule/groundtruthupload'));
const EmbeddingGeneration = lazyWithPreload(() => import('./attendancemodule/EmbeddingGeneration'));
const ERPSync = lazyWithPreload(() => import('./attendancemodule/ERPSync'));
const Camera = lazyWithPreload(() => import('./attendancemodule/camera'));
const CameraPreview = lazyWithPreload(() => import('./attendancemodule/cameraPreview'));
const FrameVerification = lazyWithPreload(() => import('./attendancemodule/FrameVerification'));
const UnknownFaces = lazyWithPreload(() => import('./attendancemodule/UnknownFaces'));
const SchedulerPage = lazyWithPreload(() => import('./attendancemodule/SchedulerPage'));
const SchedulerLedgerPage = lazyWithPreload(() => import('./attendancemodule/SchedulerLedgerPage'));
const ExtraClassPage = lazyWithPreload(() => import('./attendancemodule/extraAlterClasses').then((m) => ({ default: m.ExtraClassPage })));
const AlterClassPage = lazyWithPreload(() => import('./attendancemodule/extraAlterClasses').then((m) => ({ default: m.AlterClassPage })));
const LiveReportPage = lazyWithPreload(() => import('./attendancemodule/LiveReportPage'));
const RecordStream = lazyWithPreload(() => import('./attendancemodule/RecordStream'));
const ErpOverrides = lazyWithPreload(() => import('./attendancemodule/ErpOverrides'));
const AttendanceDisputes = lazyWithPreload(() => import('./attendancemodule/AttendanceDisputes'));
const ErpOverrideAnalysis = lazyWithPreload(() => import('./attendancemodule/ErpOverrideAnalysis'));
const StudentPhotoUpdate = lazyWithPreload(() => import('./attendancemodule/StudentPhotoUpdate'));
const PhotoSwapBatchSendPage = lazyWithPreload(() => import('./platform/PhotoSwapBatchSendPage'));

const AMSDashboard = lazyWithPreload(() => import('./attendancemodule/AMSDashboard'));
const AMSLayout = lazyWithPreload(() => import('./attendancemodule/AMSLayout'));
const CameraRegistry = lazyWithPreload(() => import('./attendancemodule/camera'));
const InstituteIdentification = lazyWithPreload(() => import('./attendancemodule/InstituteIdentification'));
const EditSessionDates = lazyWithPreload(() => import('./attendancemodule/editSessionDates'));
const GpuMetrics = lazyWithPreload(() => import('./attendancemodule/GpuMetrics'));
const NodeConsole = lazyWithPreload(() => import('./attendancemodule/NodeConsole'));
const ReactConsole = lazyWithPreload(() => import('./attendancemodule/ReactConsole'));
const DeployConsole = lazyWithPreload(() => import('./dashboard/DeployConsole'));
const AMSManual = lazyWithPreload(() => import('./attendancemodule/manual'));
const TTManual = lazyWithPreload(() => import('./timetableadmin/TTManual'));
const CertManual = lazyWithPreload(() => import('./certificatemodule/CertManual'));
const ConfManual = lazyWithPreload(() => import('./conferencemodule/ConfManual'));

// ─── Department Admin Module Imports ────────────────────────────
const DeptAdminLayout = lazyWithPreload(() => import('./deptadmin/DeptAdminLayout'));
const DeptDashboard = lazyWithPreload(() => import('./deptadmin/DeptDashboard'));
const DeptReports = lazyWithPreload(() => import('./deptadmin/DeptReports'));
const DeptBugReports = lazyWithPreload(() => import('./deptadmin/DeptBugReports'));
const DeptDisputes = lazyWithPreload(() => import('./deptadmin/DeptDisputes'));
const DeptAssignRolls = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptAssignRolls })));
const DeptLiveRTSP = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptLiveRTSP })));
const DeptGroundTruthUpload = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptGroundTruthUpload })));
const DeptAttendanceReport = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptAttendanceReport })));
const DeptClassVerification = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptClassVerification })));
const DeptSubjectEmbeddings = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptSubjectEmbeddings })));
const DeptConfidenceMonitor = lazyWithPreload(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptConfidenceMonitor })));
const DeptMenuConfig = lazyWithPreload(() => import('./attendancemodule/DeptMenuConfig'));

// Learning module — self-contained under src/learningModule; every screen
// hangs off the single /learning/* route below.
const LearningRoutes = lazyWithPreload(() => import('./learningModule/LearningRoutes.jsx'));

//confifence monitor
import { setupOtaUpdater } from './utils/otaUpdater';
import { initializePushNotifications } from './utils/pushNotifications';
import { useEffect } from 'react';

const ConfidenceMonitor = lazyWithPreload(() => import('./attendancemodule/confidenceMonitor'));
const MLDataFolder = lazyWithPreload(() => import('./attendancemodule/MLDataFolder.jsx').then((m) => ({ default: m.MLDataFolder })));
const MLFineTuning = lazyWithPreload(() => import('./attendancemodule/MLFineTuning'));

const HardwareBackButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const locationRef = React.useRef(location.pathname);
  const navigateRef = React.useRef(navigate);

  // Keep refs updated without triggering the listener effect
  React.useEffect(() => {
    locationRef.current = location.pathname;
    navigateRef.current = navigate;
  }, [location.pathname, navigate]);

  React.useEffect(() => {
    let backButtonListener = null;
    let appUrlListener = null;

    const registerListener = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', (event) => {
        // Paths where pressing back should exit the app instead of navigating back
        const exitPaths = ['/', '/login', '/home', '/learning', '/learning/'];
        if (exitPaths.includes(locationRef.current)) {
          CapacitorApp.exitApp();
        } else if (event.canGoBack || window.history.length > 1) {
          navigateRef.current(-1);
        } else {
          CapacitorApp.exitApp();
        }
      });

      appUrlListener = await CapacitorApp.addListener('appUrlOpen', (event) => {
        try {
          const url = new URL(event.url);
          if (url.hostname === 'xceed.nitj.ac.in' || url.hostname === 'xceed.learning.app') {
            const path = url.pathname + url.search + url.hash;
            if (path && path !== '/') {
              navigateRef.current(path);
            }
          }
        } catch (e) {
          console.error('Invalid deep link URL:', e);
        }
      });
    };

    registerListener();

    // Initialize Push Notifications using the stable navigate ref wrapper
    initializePushNotifications((...args) => navigateRef.current(...args));

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
      if (appUrlListener) {
        appUrlListener.remove();
      }
    };
  }, []); // Empty dependency array ensures this runs exactly once!

  return null;
};

/**
 * What fills the page while a route's chunk is in flight.
 *
 * Inline styles and no component library on purpose: this is the one thing that
 * has to render before anything else has loaded, on the slow connection that
 * made splitting worth doing in the first place.
 */
function RouteFallback() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#666' }} role="status" aria-live="polite">
      Loading…
    </div>
  );
}

/**
 * The route table, built once at module load rather than per render, so that
 * `registerRouteTree` can read it: the preloader needs the same patterns the
 * router matches, and taking them from anywhere else is a second list to keep
 * in step.
 */
const APP_ROUTES = (
        <Routes>
          {/* Landing Page */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/home" element={<Home />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/nirf" element={<NirfRanking />} />

          <Route path="/services/:serviceId" element={<ServicePage />} />
          {/* ********* */}

          <Route path="/facultyrankings" element={<FacultyDashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/register" element={<RegistrationForm />} />
          <Route path="/userroles" element={<AllocatedRolesPage />} />
          {/* Platform admins only. Anyone else gets the ordinary 404 and is
              sent home — see components/RequireAdmin.jsx for why a refusal is
              spelled "no such page" rather than "not allowed". The server is
              still the boundary: every endpoint below is checkRole(['admin']). */}
          {/* The guard sits on the path rather than on a pathless wrapper: an
              empty pattern matches every URL in `registerRouteTree`, which
              would preload this chunk on any hovered link. */}
          <Route path="/superadmin" element={<RequireAdmin />}>
            <Route index element={<SuperAdminPage />} />
            <Route path="bugs" element={<BugReportsAdmin />} />
            <Route path="dev-team" element={<DevTeamApplicationsAdmin />} />
            {/* Whole-server deploy — not attendance-specific, so it lives here
                rather than under /attendance with the module's own ops pages. */}
            <Route path="deploy" element={<DeployConsole />} />
          </Route>
          <Route path="/usermanagement" element={<RequireAdmin />}>
            <Route index element={<UserManagement />} />
          </Route>
          <Route path="/fileupload" element={<FileUpload />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/cameras" element={<Camera />} />
          <Route path="/camera/preview" element={<CameraPreview />} />

          {/* <Route path="/timetable" element={<Timetable />} /> */}

          <Route path="/tt">
            <Route path="commonslot" element={<CommonSlot />} />
            <Route path="dashboard" element={<CreateTimetable />} />
            <Route path="viewmessages" element={<MessagesPage />} />
            <Route path="masterview" element={<MasterView />} />
            <Route path="masterfaculty" element={<MasterFaculty />} />
            <Route path="masterroom" element={<MasterRoom />} />
            <Route path="mastersem" element={<MasterSem />} />
            <Route path="masterdelete" element={<MasterDelete />} />
            <Route path="viewmrooms" element={<ViewMRooms />} />
            {/* <Route path="masterdata" element={<MasterDataTable />} /> */}
            <Route path="messages" element={<Messages />} />
            <Route path="logs" element={<Logs />} />
          </Route>

          {/* Original Routes */}
          <Route path="/tt/:generatedLink">
            <Route index element={<Timetable />}></Route>
            <Route path="addfaculty" element={<AddFaculty />} />
            <Route path="importttdata" element={<ImportTT />} />
            <Route path="addroom" element={<AddRoom />} />
            <Route path="addcommonload" element={<CommonLoad />} />
            <Route path="addlunchload" element={<LunchLoad />} />
            <Route path="addsubjects" element={<Subjects />} />
            <Route path="addsem" element={<AddSem />} />
            <Route path="addnote" element={<Note />} />
            <Route path="firstyearload" element={<FirstYearLoad />} />
            <Route path="firstyearfaculty" element={<FirstYearFaculty />} />
            <Route path="lockedsummary" element={<LockedSummary />} />
            <Route path="generatepdf" element={<PrintSummary />} />
            <Route path="loaddistribution" element={<LoadDistribution />} />
            <Route path="roomallotment" element={<ViewAllotmentPage />} />
            <Route path="editmasterfaculty" element={<EditMasterFaculty />} />
            <Route path="facultyload" element={<FacultyDeptHourLoad />} />
          </Route>

          {/* Backup Routes - v1 */}
          <Route path="/tt/v1/:generatedLink">
            <Route index element={<Timetable2 />}></Route>
            <Route path="addfaculty" element={<AddFaculty />} />
            <Route path="importttdata" element={<ImportTT />} />
            <Route path="addroom" element={<AddRoom />} />
            <Route path="addcommonload" element={<CommonLoad />} />
            <Route path="addlunchload" element={<LunchLoad />} />
            <Route path="addsubjects" element={<Subjects />} />
            <Route path="addsem" element={<AddSem />} />
            <Route path="addnote" element={<Note />} />
            <Route path="firstyearload" element={<FirstYearLoad />} />
            <Route path="firstyearfaculty" element={<FirstYearFaculty />} />
            <Route path="lockedsummary" element={<LockedSummary />} />
            <Route path="generatepdf" element={<PrintSummary />} />
            <Route path="loaddistribution" element={<LoadDistribution />} />
            <Route path="roomallotment" element={<ViewAllotmentPage />} />
            <Route path="editmasterfaculty" element={<EditMasterFaculty />} />
          </Route>
          {/* Same link */}
          <Route path="classrooms" element={<ViewMRooms />} />
          {/* Same link */}

          {/* <Route path="/tt/viewtimetable" element={<LockedView/>} /> */}
          <Route path="/tt/allotment" element={<AllotmentForm />} />
          <Route path="/tt/allotment/import" element={<ImportForm />} />

          <Route path="/tt/admin" element={<AdminPage />} />
          <Route path="/tt/admin/adminview" element={<TimetableMasterView />} />
          <Route
            path="/tt/admin/facultyload"
            element={<FacultyLoadCalculation />}
          />
          <Route path="tt/coe/facultyload" element={<FacultyLoadCOE />} />

          {/* Same link */}
          <Route path="/timetable">
            <Route index element={<MasterView />} />
            <Route
              path="faculty/:facultyname"
              element={<MasterView autofill />}
            />
          </Route>
          {/* Same link */}

          <Route path="/tt/admin/view" element={<View />} />
          {/* <Route path="/tt/admin/instituteload" element={<InstituteLoad />} /> */}
          {/* <Route path="/tt/viewinstituteload" element={<ViewInstituteLoad />} /> */}
          <Route path="/tt/masterdata" element={<MasterLoadDataTable />} />

          <Route path="/tt/admin/clashes" element={<AdminClash />} />
          <Route
            path="/tt/admin/mergeddownload"
            element={<InstituteMergedDownload />}
          />
          {/* <Route
            path="/tt/:generatedLink/generatepdf/mergepdf"
            element={<MergePDFComponent />}
          /> */}
          <Route
            path="/tt/:generatedLink/generatepdf/loadallocation"
            element={<Departmentloadallocation />}
          />
          <Route
            path="/tt/:generatedLink/generatepdf/hourlyload"
            element={<FacultyHourLoad />}
          />

          <Route path="/cm/addevent" element={<EventRegistration />} />
          <Route path="/cm/dashboard" element={<CMDashboard />} />
          <Route path="/cm/:eventid" element={<CertificateForm />} />
          <Route path="/cm/:eventid/addparticipant" element={<Participant />} />
          <Route path="/cm/c/:eventid/:participantid" element={<Template01 />} />
          <Route
            path="/cm/c/:eventid/:participantid/sarthak"
            element={<Template03 />}
          />
          <Route path="/cm/useraddevent" element={<UserEventRegistration />} />
          <Route path="/cm/userevents/:userId" element={<UserEvents />} />
          <Route path="/cm/userimages/logos/:userId" element={<UserLogos />} />
          <Route
            path="/cm/userimages/signatures/:userId"
            element={<UserSignatures />}
          />
          <Route path="/payment-portal" element={<PaymentPortal />} />

          {/* Conference Module Admin-Panel */}
          <Route path="/cf/dashboard" element={<EODashboard />} />
          <Route path="/cf/addconf" element={<ConferencePage />} />
          <Route path="/cf/:confid" element={<Sidebar />}>
            <Route index element={<HomeConf />} />
            <Route path="home" element={<HomeConf />} />
            <Route path="speakers" element={<Speaker />} />
            <Route path="speakerlayout" element={<SpeakerLayout />} />
            <Route path="committee" element={<Committees />} />
            <Route path="sponsors" element={<Sponsors />} />
            <Route path="awards" element={<Awards />} />
            <Route path="announcement" element={<Announcement />} />
            <Route path="contact" element={<Contacts />} />
            <Route path="images" element={<Images />} />
            <Route path="eventdates" element={<EventDates />} />
            <Route path="locations" element={<Location />} />
            <Route path="participants" element={<Participants />} />
            <Route path="navbar" element={<NavbarConf />} />
            <Route path="navmenu" element={<NavMenu />} />
            <Route path="homelayout" element={<HomeLayout />} />
            <Route path="customisation" element={<Customisation />} />
            {/* <Route path="template" element={<CommonTemplate/>} /> */}
            <Route path="sponsorship-rates" element={<SponsorshipRate />} />
            <Route path="accommodation" element={<Accomodation />} />
            <Route path="events" element={<Event />} />
            <Route path="souvenir" element={<Souvenir />} />
            <Route path="commontemplate" element={<CommonTemplate />} />
          </Route>

          {/* Quiz Module Routes */}
          <Route path="/quiz/createquiz" element={<CreateQuiz />}></Route>
          <Route
            path="/quiz/:code"
            element={
              <>
                {' '}
                <AddQuestionHome />{' '}
              </>
            }
          />
          <Route
            path="/quiz/:code/addinstruction"
            element={
              <>
                <AddInstruction />
              </>
            }
          />
          <Route
            path="/quiz/:code/addinstruction/preview"
            element={
              <>
                <PreviewInstructions />
              </>
            }
          />
          <Route
            path="/quiz/:code/settings"
            element={
              <>
                <Settings />
              </>
            }
          />
          {/* <Route path="/quiz/:code/result" element={<><ResultSummary /></>} /> */}
          {/*<Route path="/addQuestionHome" element={<><AddQuestionHome /></>} /> */}

          {/* quiz-student-routes */}
          {/* <Route path="/quiz/:code/test" element={<Instructions />} /> */}
          <Route path="/quiz/:code/live" element={<Quizzing />} />
          <Route path="/quiz/:code/feedback" element={<QuizFeedback />} />

          <Route
            path="test-message"
            element={
              <ErrorPage
                message="Custom error message..."
                destinationName={false}
                animation={<LogoAnimation style={{ opacity: '20%' }} />} // any type of component can be sent here
              />
            }
          ></Route>
          {/* Its own module now — it carried `lottie-react` and the animation JSON,
              which the entry chunk was paying for on every page load. */}
          <Route path="*" element={<NotFound />}></Route>

          {/* Platform Routes with Sidebar */}
          <Route path="/platform" element={<PlatformLayout />}>
            <Route index element={<PlatformDashboard />} />
            <Route path="config" element={<PlatformConfig />} />
            <Route path="modules" element={<PlatformModules />} />
            <Route path="data" element={<PlatformData />} />
          </Route>

          <Route path="/ml/t1" element={<LinearRegression />} />
          <Route path="/ml" element={<MLDashboard />} />

          {/* ─── AMS Manual — public, no auth required ─────────────── */}
          <Route path="/ams-manual" element={<AMSManual standalone />} />

          {/* ─── TT Manual — public, no auth required ──────────────── */}
          <Route path="/tt-manual" element={<TTManual standalone />} />

          {/* ─── Certificate Manual — public, no auth required ─────── */}
          <Route path="/certificate-manual" element={<CertManual standalone />} />

          {/* ─── Conference Manual — public, no auth required ──────── */}
          <Route path="/conference-manual" element={<ConfManual standalone />} />

          {/* ─── Student Photo Update — public, token-authed via ?token= ── */}
          <Route path="/photo-update" element={<StudentPhotoUpdate />} />

          {/* ─── Attendance Module Routes ──────────────────────────── */}
          <Route
            path="/iams-admin/*"
            element={<Navigate to="/attendance" replace />}
          />
          <Route path="/attendance" element={<AMSLayout />}>
            <Route index element={<AMSDashboard />} />

            {/* 2. Session setup sub-route handler registered context array */}
            <Route path="edit-session-dates" element={<EditSessionDates />} />

            <Route path="groundtruth/assign" element={<RollAssign />} />
            {/* <Route path="groundtruth/flagged"  element={<FlaggedAssign />} /> */}
            <Route path="groundtruth/edit" element={<EditGroundTruth />} />
            <Route path="groundtruth/unknown" element={<UnknownFaces />} />
            <Route path="groundtruth/rtsp" element={<GroundTruthRTSP />} />
            {/* <Route path="groundtruth/photos" element={<PhotoEdit />} /> */}
            <Route path="groundtruth/upload" element={<GroundTruthUpload />} />
            <Route path="institute-identification" element={<InstituteIdentification />} />
            <Route path="record-stream" element={<RecordStream />} />
            <Route path="embeddings" element={<EmbeddingGeneration />} />
            <Route path="photo-swap-batch-send" element={<PhotoSwapBatchSendPage />} />
            <Route path="erp-sync" element={<ERPSync />} />
            <Route path="report" element={<Attendancedoc />} />
            <Route path="model" element={<ModelPerformance />} />
            <Route path="model-analytics" element={<ModelAnalytics />} />
            <Route path="reports" element={<AttendanceReport />} />
            <Route path="frame-verification" element={<FrameVerification />} />
            <Route path="dept-admins" element={<DeptAdminAssignPage />} />
            <Route path="erp-overrides" element={<ErpOverrides />} />
            <Route path="erp-overrides/:reportId" element={<ErpOverrideAnalysis />} />
            <Route path="disputes" element={<AttendanceDisputes />} />
            <Route path="confidence" element={<ConfidenceMonitor />} />
            <Route path="ml-fine-tuning" element={<MLFineTuning />} />
            <Route path="acquisition-control" element={<SchedulerPage />} />
            <Route path="extra-class" element={<ExtraClassPage />} />
            <Route path="altering-class" element={<AlterClassPage />} />
            <Route path="gpu" element={<GpuMetrics />} />
            <Route path="server-console" element={<NodeConsole />} />
            <Route path="client-console" element={<ReactConsole />} />
            <Route path="dept-menu-config" element={<DeptMenuConfig />} />
            <Route path="scheduler" element={<SchedulerPage />} />
            <Route path="scheduler-ledger" element={<SchedulerLedgerPage />} />
            <Route path="live-report" element={<LiveReportPage />} />
            <Route path="view-mldata" element={<MLDataFolder />} />
          </Route>

          {/* ─── Department Admin Routes ────────────────────────────── */}
          <Route path="/dept-admin" element={<DeptAdminLayout />}>
            <Route index element={<DeptDashboard />} />
            <Route path="dashboard" element={<DeptDashboard />} />
            <Route path="live-rtsp" element={<DeptLiveRTSP />} />
            <Route path="assign-rolls" element={<DeptAssignRolls />} />
            <Route path="erp-upload" element={<DeptGroundTruthUpload />} />
            <Route path="reports" element={<DeptAttendanceReport />} />
            <Route path="class-verification" element={<DeptClassVerification />} />
            <Route path="embeddings" element={<DeptSubjectEmbeddings />} />
            <Route path="confidence" element={<DeptConfidenceMonitor />} />
            <Route path="extra-class" element={<ExtraClassPage />} />
            <Route path="altering-class" element={<AlterClassPage />} />
            <Route path="stats/progress" element={<Navigate to="/dept-admin/dashboard" replace />} />
            <Route path="dept-reports-view" element={<DeptReports />} />
            <Route path="bug-report" element={<DeptBugReports />} />
            <Route path="disputes" element={<DeptDisputes />} />
            <Route path="*" element={
              <div style={{ padding: 48, textAlign: 'center' }}>
                <h2 style={{ marginBottom: 12 }}>Access Restricted</h2>
                <p style={{ color: '#666', marginBottom: 24 }}>
                  This section is not configured for your role.
                  Please contact the administrator to request access.              
                  </p>
                <a href="mailto:xceeddev2@nitj.ac.in" style={{ color: '#6366f1', fontWeight: 600 }}>
                  Contact Admin
                </a>
              </div>
            } />
          </Route>

          {/* ─── Learning Module ────────────────────────────────────── */}
          <Route path="/learning/*" element={<LearningRoutes />} />

          {/* Camera Registry — top-level but still inside AMSLayout */}
          <Route path="/cameras" element={<AMSLayout />}>
            <Route index element={<CameraRegistry />} />
            <Route path="preview" element={<CameraPreview />} />
          </Route>
      </Routes>
);

// Reading the tree is what teaches hovered links which chunk to fetch. A route
// added above is registered by having been added.
registerRouteTree(APP_ROUTES);

function App() {
  useEffect(() => {
    setupOtaUpdater();
  }, []);

  // Starts a page's chunk when a link to it is hovered or focused, so the
  // fallback below has usually nothing left to wait for by the time it clicks.
  useLinkPreloading();

  return (
    <Router>
      <HardwareBackButton />
      {/* <div className="app"> */}

      {/* <h1>XCEED-Timetable Module</h1>  */}
      {!window.location.pathname.startsWith('/photo-update') && <Navbar />}

      {/* One boundary around the whole table rather than per route: a lazy
          element with no Suspense above it throws, and a single boundary here
          cannot be forgotten when a route is added. The fallback is deliberately
          plain — it shows for the length of one chunk fetch, and anything
          heavier would need its own bytes to render. */}
      {/* ErrorBoundary sits outside Suspense (Suspense only catches a pending
          lazy import, not a render crash) and outside the routes but inside
          Navbar, so a page that crashes still leaves the navbar clickable —
          the whole reason "reload" used to be the only way out. */}
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
        {APP_ROUTES}
        </Suspense>
      </ErrorBoundary>
      {/* <Footer/> */}
      {/* </div> */}
    </Router>
  );
}

export default App;