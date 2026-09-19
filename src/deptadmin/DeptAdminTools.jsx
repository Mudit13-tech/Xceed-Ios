import { useOutletContext } from 'react-router-dom';
import GroundTruthRTSP from '../attendancemodule/groundtruthgen_rtsp';
import RollAssign from '../attendancemodule/rollassign';
import GroundTruthUpload from '../attendancemodule/groundtruthupload';
import AttendanceReport from '../attendancemodule/AttendanceReport';
import FrameVerification from '../attendancemodule/FrameVerification';
import EmbeddingGeneration from '../attendancemodule/EmbeddingGeneration';
import ConfidenceMonitor from '../attendancemodule/confidenceMonitor';

const gtRollDepartments = ({ batchDepartments, batchDepartment }) => {
    const assigned = (batchDepartments || []).filter(Boolean);
    return assigned.length ? assigned : [batchDepartment].filter(Boolean);
};

export function DeptLiveRTSP() {
    const context = useOutletContext();
    const { fullAccess, loading } = context;
    if (loading) return null;
    if (fullAccess) return <GroundTruthRTSP />;
    const departments = gtRollDepartments(context);
    if (!departments.length) return null;
    const fixedDepartment = departments.length === 1 ? departments[0] : '';
    return (
        <GroundTruthRTSP
            fixedDepartment={fixedDepartment}
            departmentRestricted
        />
    );
}

export function DeptAssignRolls() {
    const context = useOutletContext();
    const { fullAccess, loading } = context;
    if (loading) return null;
    if (fullAccess) return <RollAssign />;
    const departments = gtRollDepartments(context);
    if (!departments.length) return null;
    const fixedDepartment = departments.length === 1 ? departments[0] : '';
    return <RollAssign fixedDepartment={fixedDepartment} />;
}

export function DeptGroundTruthUpload() {
    const { department, batchDepartment, fullAccess, loading } = useOutletContext();
    if (loading) return null;
    if (fullAccess) return <GroundTruthUpload />;
    const deptToUse = batchDepartment || department;
    if (!deptToUse) return null;
    return <GroundTruthUpload fixedDepartment={deptToUse} />;
}

export function DeptAttendanceReport() {
    const { department, batchDepartment, fullAccess, loading } = useOutletContext();
    if (loading) return null;
    if (fullAccess) return <AttendanceReport />;
    const deptToUse = batchDepartment || department;
    if (!deptToUse) return null;
    return <AttendanceReport fixedDepartment={deptToUse} />;
}

// Unscoped for every role, same as the iams-admin view: the page lists the
// rooms that have a camera registered, with no department filter applied.
export function DeptClassVerification() {
    const { loading } = useOutletContext();
    if (loading) return null;
    return <FrameVerification />;
}

export function DeptSubjectEmbeddings() {
    const { department, batchDepartment, fullAccess, loading } = useOutletContext();
    if (loading) return null;
    // An institute admin gets the page whole, ERP tab included.
    if (fullAccess) return <EmbeddingGeneration />;
    // Dept admins can switch department freely on this page (the server still
    // enforces which departments they may actually touch) — their own
    // department is just the starting value.
    //
    // A department coordinator does not get the ERP tab, though. Pulling a
    // roster from the ERP is an institute-level action, and the endpoints
    // behind it already refuse a coordinator by default
    // (requireDeptMenu('erpSync')) — so the tab was an offer the server would
    // decline. They keep Manual Generation and View.
    return (
        <EmbeddingGeneration
            defaultDepartment={batchDepartment || department}
            showErpTab={false}
        />
    );
}

export function DeptConfidenceMonitor() {
    const { department, batchDepartment, fullAccess, loading } = useOutletContext();
    if (loading) return null;
    if (fullAccess) return <ConfidenceMonitor />;
    const deptToUse = department || batchDepartment;
    if (!deptToUse) return null;
    return <ConfidenceMonitor fixedDepartment={deptToUse} />;
}
