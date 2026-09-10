// client/src/hodadmin/HodDashboard.jsx
//
// The iLEED dashboard a head of department lands on from their role card.
//
// It IS the department dashboard — same component, same endpoints, same
// numbers — because that was the requirement and because a second copy would
// start telling a different story about the same day the first time either was
// edited. The only difference is `readOnly`, which drops the pending-actions
// card: every item on it is something to go and do, and an HOD can do none of
// them.
//
// Scoping is the server's job, not this component's. Every endpoint behind it
// filters on `req.attendanceDepartments`, which resolveAttendanceAccess fills
// from the signed-in account's own Faculty profile — so an HOD sees their
// department for the same reason a department admin does, with no department
// ever named on the client.

import DeptDashboard from '../deptadmin/DeptDashboard';

export default function HodDashboard() {
    return <DeptDashboard readOnly />;
}
