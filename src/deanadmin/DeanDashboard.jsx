// client/src/deanadmin/DeanDashboard.jsx
//
// The iLEED dashboard a Dean (Academic) lands on from their role card.
//
// It IS the department dashboard — same component, same endpoints, same
// numbers — for the same reason the head of department's is: a second copy
// would start telling a different story about the same day the first time
// either was edited. `readOnly` drops the pending-actions card, every item on
// which is something to go and do, and a dean can do none of them.
//
// What makes it institute-wide is not this file. Every endpoint behind it reads
// `req.attendanceFullAccess`, which resolveAttendanceAccess sets for a dean —
// so the same component draws one department for a head and every department
// for a dean, with no department ever named on the client.

import DeptDashboard from '../deptadmin/DeptDashboard';

export default function DeanDashboard() {
    return <DeptDashboard readOnly />;
}
