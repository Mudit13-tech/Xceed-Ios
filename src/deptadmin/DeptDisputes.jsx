// client/src/deptadmin/DeptDisputes.jsx
//
// The department coordinator's dispute queue.
//
// Same table as the admin's institute-wide view (attendancemodule/
// AttendanceDisputes.jsx) with the accept/reject controls switched on — the
// coordinator is the only role that decides these, and the server scopes the
// list to their own department regardless of what this page asks for.

import AttendanceDisputes from '../attendancemodule/AttendanceDisputes';

export default function DeptDisputes() {
    return (
        <AttendanceDisputes
            canDecide
            title="Attendance disputes"
            subtitle={
                'Students in your department challenging how a period was marked. Click a roll number '
                + 'to see the ground-truth and ERP photos the recognition was made against, then accept '
                + 'or reject. Recording a verdict notifies the student — it does not change the '
                + 'attendance record itself, which is corrected through ERP Overrides.'
            }
        />
    );
}
