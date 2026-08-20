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

import React, { lazy, Suspense } from 'react';
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
const Timetable = lazy(() => import('./timetableadmin/timetable'));
const Timetable2 = lazy(() => import('./timetableadmin/timetable2.jsx'));
const CreateTimetable = lazy(() => import('./timetableadmin/creatett'));
const MasterFaculty = lazy(() => import('./timetableadmin/masterfaculty'));
const AddFaculty = lazy(() => import('./timetableadmin/addfaculty'));
const MasterRoom = lazy(() => import('./timetableadmin/masterroom'));
const MasterSem = lazy(() => import('./timetableadmin/mastersem'));
const AddSem = lazy(() => import('./timetableadmin/addsemester'));
const AddRoom = lazy(() => import('./timetableadmin/addroom'));
const LockedSummary = lazy(() => import('./timetableadmin/lockedsummary'));
const Login = lazy(() => import('./dashboard/login'));
const Messages = lazy(() => import('./timetableadmin/messages'));
const ForgotPassword = lazy(() => import('./dashboard/ForgotPassword'));
const SuperAdminPage = lazy(() => import('./dashboard/superadmin'));
const BugReportsAdmin = lazy(() => import('./dashboard/bugReports'));
const DevTeamApplicationsAdmin = lazy(() => import('./dashboard/devTeamApplications'));
const DeptAdminAssignPage = lazy(() => import('./dashboard/deptAdminAssign'));
const CommonSlot = lazy(() => import('./timetableadmin/commonslot.jsx'));
const Subjects = lazy(() => import('./timetableadmin/addsubjects'));
const ImportTT = lazy(() => import('./timetableadmin/importt.jsx'));

const ViewMRooms = lazy(() => import('./timetableadmin/viewmrooms'));
const MessagesPage = lazy(() => import('./timetableadmin/viewMessages.jsx'));

// import LockedView from './timetableviewer/viewer';
const Note = lazy(() => import('./timetableadmin/addnote'));
import Navbar from './components/home/Navbar';
const PrintSummary = lazy(() => import('./timetableadmin/printSummary'));
const LoadDistribution = lazy(() => import('./timetableadmin/loaddistribution'));
const RegistrationForm = lazy(() => import('./dashboard/register'));
const AllotmentForm = lazy(() => import('./timetableadmin/allotment'));
const MasterDelete = lazy(() => import('./timetableadmin/masterdelete'));
const AdminPage = lazy(() => import('./timetableadmin/admin'));
const ViewAllotmentPage = lazy(() => import('./timetableadmin/viewroomallotment'));
const CommonLoad = lazy(() => import('./timetableadmin/addcommonload'));
const MasterView = lazy(() => import('./timetableadmin/mastersearch'));
const View = lazy(() => import('./timetableadmin/masterview'));
const AllocatedRolesPage = lazy(() => import('./dashboard/allotedroles'));
const FirstYearLoad = lazy(() => import('./timetableadmin/firstyearload'));
const FirstYearFaculty = lazy(() => import('./timetableadmin/addfirstyearfaculty'));
const LunchLoad = lazy(() => import('./timetableadmin/addlunchload'));
const FacultyDeptHourLoad = lazy(() => import('./timetableadmin/viewdeptfacultyload.jsx'));
// import InstituteLoad from './timetableadmin/instituteload';
// import ViewInstituteLoad from './timetableadmin/viewinstituteload';
const EditMasterFaculty = lazy(() => import('./timetableadmin/editmasterfaculty'));
const ImportForm = lazy(() => import('./timetableadmin/importCentralRoom'));
// import MergePDFComponent from './filedownload/mergepdfdocuments';
const TimetableMasterView = lazy(() => import('./timetableadmin/masterview'));
// import MasterDataTable from './timetableadmin/viewmasterclasstable.jsx';
const FacultyLoadCalculation = lazy(() => import('./timetableadmin/facultyloadadmin.jsx'));
const MasterLoadDataTable = lazy(() => import('./timetableadmin/viewinstituteloadmaster.jsx'));
const Departmentloadallocation = lazy(() => import('./timetableadmin/departmentloadallocation.jsx'));
const FacultyHourLoad = lazy(() => import('./timetableadmin/facultyhourload.jsx'));
const FacultyLoadCOE = lazy(() => import('./timetableadmin/facultyloadcoe.jsx'));
const AdminClash = lazy(() => import('./timetableadmin/AdminClashes.jsx'));
const InstituteMergedDownload = lazy(() => import('./timetableadmin/instituteMergedDownload.jsx'));

const Home = lazy(() => import('./pages/Home'));
const GuidePage = lazy(() => import('./pages/GuidePage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const ErrorPage = lazy(() => import('./pages/ErrorPage.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const LogoAnimation = lazy(() => import('./components/login/LogoAnimation.jsx').then((m) => ({ default: m.LogoAnimation })));
const EventRegistration = lazy(() => import('./certificatemodule/pages/eventregistration'));
const CMDashboard = lazy(() => import('./certificatemodule/pages/cmdashboard'));
const CertificateForm = lazy(() => import('./certificatemodule/pages/certificatedesign'));
// import Certificate from './certificatemodule/pages/certificatetemplates/Certificate';
const ServicePage = lazy(() => import('./pages/Service'));
const Participant = lazy(() => import('./certificatemodule/pages/participantdataupload'));
const UserEvents = lazy(() => import('./certificatemodule/pages/UserEvents'));
const UserLogos = lazy(() => import('./certificatemodule/pages/UserLogo.jsx'));
const UserSignatures = lazy(() => import('./certificatemodule/pages/UserSignatures.jsx'));

const EODashboard = lazy(() => import('./conferencemodule/layout/eodashboard'));
const Accomodation = lazy(() => import('./conferencemodule/Tabs/Accomodation'));
const HomeConf = lazy(() => import('./conferencemodule/Tabs/HomeConf'));
const Sidebar = lazy(() => import('./conferencemodule/components/Sidebar'));
const Speaker = lazy(() => import('./conferencemodule/Tabs/Speaker'));
const Committees = lazy(() => import('./conferencemodule/Tabs/Committees'));
const Sponsors = lazy(() => import('./conferencemodule/Tabs/Sponsors'));
const Awards = lazy(() => import('./conferencemodule/Tabs/Awards'));
const Announcement = lazy(() => import('./conferencemodule/Tabs/Annoumcement'));
const Contacts = lazy(() => import('./conferencemodule/Tabs/Contacts'));
const Images = lazy(() => import('./conferencemodule/Tabs/Images'));
const EventDates = lazy(() => import('./conferencemodule/Tabs/EventDates'));
const Participants = lazy(() => import('./conferencemodule/Tabs/Participants'));
const NavbarConf = lazy(() => import('./conferencemodule/Tabs/NavbarConf'));
const NavMenu = lazy(() => import('./conferencemodule/Tabs/NavMenu'));
const HomeLayout = lazy(() => import('./conferencemodule/Tabs/HomeLayout'));
const SpeakerLayout = lazy(() => import('./conferencemodule/Tabs/SpeakerLayout'));
const Customisation = lazy(() => import('./conferencemodule/Tabs/Customisation'));
const Location = lazy(() => import('./conferencemodule/Tabs/Location'));
const CommonTemplate = lazy(() => import('./conferencemodule/Tabs/CommonTemplate'));
const ConferencePage = lazy(() => import('./conferencemodule/Tabs/ConferencePage'));

const Template01 = lazy(() => import('./certificatemodule/pages/certificatetemplates/akleem'));
// import ViewCertificate from './certificatemodule/pages/participantCerti';
const Template03 = lazy(() => import('./certificatemodule/pages/certificatetemplates/03_sarthak'));

const SponsorshipRate = lazy(() => import('./conferencemodule/Tabs/SponsorshipRates'));
const Event = lazy(() => import('./conferencemodule/Tabs/Events'));
const Souvenir = lazy(() => import('./conferencemodule/Tabs/Souvenir'));

const NirfRanking = lazy(() => import('./nirf/rankings'));

// imports for Quiz Module
const CreateQuiz = lazy(() => import('./quizModule/creator/createQuiz/CreateQuiz'));
const AddQuestionHome = lazy(() => import('./quizModule/creator/addQuestion/AddQuestionHome'));
const AddInstruction = lazy(() => import('./quizModule/creator/addQuestion/AddInstruction'));
const PreviewInstructions = lazy(() => import('./quizModule/creator/addQuestion/PreviewInstructions'));
const Settings = lazy(() => import('./quizModule/creator/addQuestion/settings'));
const Quizzing = lazy(() => import('./quizModule/student/quizzing/Quizzing'));
// import Instructions from './quizModule/student/Instructions';
const QuizFeedback = lazy(() => import('./quizModule/student/quizFeedback/QuizFeedback'));
const UserManagement = lazy(() => import('./dashboard/userManagement'));
const UserEventRegistration = lazy(() => import('./certificatemodule/pages/addEvent'));

const Form = lazy(() => import('./platform/Form.jsx'));
const PlatformLayout = lazy(() => import('./platform/PlatformLayout.jsx'));
const PlatformDashboard = lazy(() => import('./platform/PlatformDashboard.jsx'));
const PlatformConfig = lazy(() => import('./platform/PlatformConfig.jsx'));
const PlatformModules = lazy(() => import('./platform/PlatformModules.jsx'));
const PlatformData = lazy(() => import('./platform/PlatformData.jsx'));

// import fileUpload
const FileUpload = lazy(() => import('./fileUpload/fileUploads.jsx'));
const PaymentPortal = lazy(() => import('./conferencemodule/pages/PaymentPortal.jsx'));

//import machine learning modules
const LinearRegression = lazy(() => import('./mlcoursemodule/linearregression.jsx'));

//import for ml project of face recognition and attendance system
const MLDashboard = lazy(() => import('./ml/MLDashboard'));

//import faculty rankings
const FacultyDashboard = lazy(() => import('./instituterankings/facultydashboard.jsx'));
const Logs = lazy(() => import('./timetableadmin/logs.jsx'));

// ─── Attendance Module Imports ────────────────────────────────────
const EditGroundTruth = lazy(() => import('./attendancemodule/editgroundtruth'));
const RollAssign = lazy(() => import('./attendancemodule/rollassign'));
// import FlaggedAssign from './attendancemodule/flaggedassign';
const Attendancedoc = lazy(() => import('./attendancemodule/Attendancedoc'));
const ModelPerformance = lazy(() => import('./attendancemodule/modelperformance'));
const ModelAnalytics = lazy(() => import('./attendancemodule/ModelAnalytics'));
const AttendanceReport = lazy(() => import('./attendancemodule/AttendanceReport'));
const GroundTruthRTSP = lazy(() => import('./attendancemodule/groundtruthgen_rtsp'));
const GroundTruthUpload = lazy(() => import('./attendancemodule/groundtruthupload'));
const EmbeddingGeneration = lazy(() => import('./attendancemodule/EmbeddingGeneration'));
const ERPSync = lazy(() => import('./attendancemodule/ERPSync'));
const Camera = lazy(() => import('./attendancemodule/camera'));
const CameraPreview = lazy(() => import('./attendancemodule/cameraPreview'));
const FrameVerification = lazy(() => import('./attendancemodule/FrameVerification'));
const UnknownFaces = lazy(() => import('./attendancemodule/UnknownFaces'));
const SchedulerPage = lazy(() => import('./attendancemodule/SchedulerPage'));
const SchedulerLedgerPage = lazy(() => import('./attendancemodule/SchedulerLedgerPage'));
const ExtraClassPage = lazy(() => import('./attendancemodule/extraAlterClasses').then((m) => ({ default: m.ExtraClassPage })));
const AlterClassPage = lazy(() => import('./attendancemodule/extraAlterClasses').then((m) => ({ default: m.AlterClassPage })));
const LiveReportPage = lazy(() => import('./attendancemodule/LiveReportPage'));
const RecordStream = lazy(() => import('./attendancemodule/RecordStream'));
const ErpOverrides = lazy(() => import('./attendancemodule/ErpOverrides'));
const AttendanceDisputes = lazy(() => import('./attendancemodule/AttendanceDisputes'));
const ErpOverrideAnalysis = lazy(() => import('./attendancemodule/ErpOverrideAnalysis'));
const StudentPhotoUpdate = lazy(() => import('./attendancemodule/StudentPhotoUpdate'));
const PhotoSwapBatchSendPage = lazy(() => import('./platform/PhotoSwapBatchSendPage'));

const AMSDashboard = lazy(() => import('./attendancemodule/AMSDashboard'));
const AMSLayout = lazy(() => import('./attendancemodule/AMSLayout'));
const CameraRegistry = lazy(() => import('./attendancemodule/camera'));
const InstituteIdentification = lazy(() => import('./attendancemodule/InstituteIdentification'));
const EditSessionDates = lazy(() => import('./attendancemodule/editSessionDates'));
const GpuMetrics = lazy(() => import('./attendancemodule/GpuMetrics'));
const NodeConsole = lazy(() => import('./attendancemodule/NodeConsole'));
const ReactConsole = lazy(() => import('./attendancemodule/ReactConsole'));
const DeployConsole = lazy(() => import('./dashboard/DeployConsole'));
const AMSManual = lazy(() => import('./attendancemodule/manual'));
const TTManual = lazy(() => import('./timetableadmin/TTManual'));
const CertManual = lazy(() => import('./certificatemodule/CertManual'));
const ConfManual = lazy(() => import('./conferencemodule/ConfManual'));

// ─── Department Admin Module Imports ────────────────────────────
const DeptAdminLayout = lazy(() => import('./deptadmin/DeptAdminLayout'));
const DeptDashboard = lazy(() => import('./deptadmin/DeptDashboard'));
const DeptReports = lazy(() => import('./deptadmin/DeptReports'));
const DeptBugReports = lazy(() => import('./deptadmin/DeptBugReports'));
const DeptDisputes = lazy(() => import('./deptadmin/DeptDisputes'));
const DeptAssignRolls = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptAssignRolls })));
const DeptLiveRTSP = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptLiveRTSP })));
const DeptGroundTruthUpload = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptGroundTruthUpload })));
const DeptAttendanceReport = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptAttendanceReport })));
const DeptClassVerification = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptClassVerification })));
const DeptSubjectEmbeddings = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptSubjectEmbeddings })));
const DeptConfidenceMonitor = lazy(() => import('./deptadmin/DeptAdminTools').then((m) => ({ default: m.DeptConfidenceMonitor })));
const DeptMenuConfig = lazy(() => import('./attendancemodule/DeptMenuConfig'));

// Learning module — self-contained under src/learningModule; every screen
// hangs off the single /learning/* route below.
const LearningRoutes = lazy(() => import('./learningModule/LearningRoutes.jsx'));

//confifence monitor
import { setupOtaUpdater } from './utils/otaUpdater';
import { initializePushNotifications } from './utils/pushNotifications';
import { useEffect } from 'react';

const ConfidenceMonitor = lazy(() => import('./attendancemodule/confidenceMonitor'));
const MLDataFolder = lazy(() => import('./attendancemodule/MLDataFolder.jsx').then((m) => ({ default: m.MLDataFolder })));
const MLFineTuning = lazy(() => import('./attendancemodule/MLFineTuning'));

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

function App() {
  useEffect(() => {
    setupOtaUpdater();
  }, []);

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
      <Suspense fallback={<RouteFallback />}>
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
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="/superadmin/bugs" element={<BugReportsAdmin />} />
        <Route path="/superadmin/dev-team" element={<DevTeamApplicationsAdmin />} />
        {/* Whole-server deploy — not attendance-specific, so it lives here
            rather than under /attendance with the module's own ops pages. */}
        <Route path="/superadmin/deploy" element={<DeployConsole />} />
        <Route path="/usermanagement" element={<UserManagement />} />
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
      </Suspense>
      {/* <Footer/> */}
      {/* </div> */}
    </Router>
  );
}

export default App;