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

// The one addition on top of it is a link to the head's own email settings.
// It sits here rather than inside DeptDashboard because that component is
// shared with department admins, who have no such screen — and the dashboard
// is where a head lands, so a setting reachable only from the sidebar would go
// unnoticed by the people it exists for.

import { Link } from 'react-router-dom';
import DeptDashboard from '../deptadmin/DeptDashboard';
import { theme } from '../attendancemodule/config';

export default function HodDashboard() {
    return (
        <>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 20px', fontSize: 12.5, color: theme.textMuted,
                background: theme.surface, borderBottom: `1px solid ${theme.border}`,
            }}>
                <span>Getting iLEED email you do not want, or missing some?</span>
                <Link
                    to="/ileed-hod/notifications"
                    style={{ color: theme.accent, fontWeight: 700, textDecoration: 'none' }}
                >
                    Manage your email notifications →
                </Link>
            </div>
            <DeptDashboard readOnly />
        </>
    );
}
