// client/src/hodadmin/HodLayout.jsx
//
// The shell around the iLEED head-of-department pages.
//
// Deliberately a sibling of DeptAdminLayout rather than a mode of it. The two
// menus are driven by different documents (`hodMenus` vs `deptMenus`) with
// different defaults, and every HOD page is a read of what the department
// produced rather than an operation on it — so the one thing they must never
// do is drift into sharing a menu list, which is exactly what a shared layout
// with a flag invites.
//
// The server is the boundary, not this file: `attendanceLeadershipReadAccess` admits
// the role, `refuseAttendanceWrites` rejects anything that is not a GET, and
// `requireHodMenu` re-checks each toggle. Hiding a link here only spares
// somebody a screen full of 403s.

import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import getEnvironment from '../getenvironment';
import { theme } from '../attendancemodule/config';
import LeadershipSidebar from '../attendancemodule/LeadershipSidebar';
import { leadershipMenusFor } from '../attendancemodule/menuCatalogue';

const apiUrl = getEnvironment();

// Built from the shared leadership list rather than written out here, so the
// head's view and the Dean (Academic)'s cannot come to disagree about which
// screens exist — see attendancemodule/menuCatalogue.js. The same `menuKey`
// values as DeptAdminLayout's ALL_MENUS, so one entry in the config screen
// drives every set. Routes point at the read-only destinations an HOD can
// actually open.
//
// The head's slice of that list is smaller than the Dean's: Confidence Monitor
// and Class Verification judge the recognition system rather than report a
// department's attendance, and a head can act on nothing either shows. Which
// those are is now stated in the catalogue (NOT_FOR_HEADS) rather than here,
// because the settings screen has to know it too — while it did not, an admin
// switching Class Verification on for the heads was told it "has a screen" and
// then watched nothing appear.
const SHARED_MENUS = leadershipMenusFor('/ileed-hod', 'hod');

export const HOD_MENUS = [
    ...SHARED_MENUS.filter((menu) => menu.id !== 'helpManual'),
    // Always shown, like the dashboard, and for the same reason: it is not a
    // view of the department's data that an admin decides a head may see, it
    // is the head's own mailbox. Gating it behind a toggle would let an admin
    // take away somebody's ability to unsubscribe themselves. The head's alone
    // — a dean heads no department, so there is nothing for it to be about,
    // which is why it is spliced in here rather than kept in the shared list.
    { id: 'notifications', menuKey: null, route: '/ileed-hod/notifications', label: 'Email Notifications', color: '#f59e0b' },
    ...SHARED_MENUS.filter((menu) => menu.id === 'helpManual'),
];

const EMPTY_CONTEXT = {
    department: '',
    batchDepartment: '',
    departments: [],
    batchDepartments: [],
    fullAccess: false,
    loading: true,
    error: '',
};

export default function HodLayout() {
    const navigate = useNavigate();
    // null = still loading. Rendering the menu from `{}` would flash an empty
    // sidebar and then fill it, which reads as a broken page.
    const [hodMenus, setHodMenus] = useState(null);
    const [error, setError] = useState('');
    // The same shape DeptAdminLayout hands down, because the pages below are
    // the same components: DeptAttendanceReport and friends read it with
    // useOutletContext and destructure it unguarded, so an Outlet with no
    // context is not an empty object — it is null, and every HOD page but the
    // dashboard threw on its first render.
    const [context, setContext] = useState(EMPTY_CONTEXT);

    useEffect(() => {
        const controller = new AbortController();
        // Behind attendanceLeadershipReadAccess, same as the menu fetch below, and it
        // resolves the department from the signed-in account's own Faculty
        // profile — no department is ever named by the client.
        fetch(`${apiUrl}/attendancemodule/dept-admin/context`, {
            credentials: 'include',
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || 'Unable to load department access.');
                setContext({
                    department: data.department || '',
                    batchDepartment: data.batchDepartment || '',
                    departments: data.departments || [],
                    batchDepartments: data.batchDepartments || [],
                    // Never true for a head — the server decides, and this only
                    // mirrors what it said.
                    fullAccess: Boolean(data.fullAccess),
                    loading: false,
                    error: '',
                });
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setContext({ ...EMPTY_CONTEXT, loading: false, error: err.message });
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(`${apiUrl}/attendancemodule/dept-admin/hod-menus`, { credentials: 'include' })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || data.error || 'Attendance access denied');
                if (!cancelled) setHodMenus(data.hodMenus || {});
            })
            .catch((err) => {
                // A 403 here means the account is not an HOD (or lost the role
                // mid-session). Send them to the picker rather than leaving a
                // shell with no menu and no explanation. The reason travels with
                // them so the roles page can say it — see AMSLayout.
                if (cancelled) return;
                setError(err.message);
                navigate('/userroles', {
                    replace: true,
                    state: { deniedModule: 'iLEED', deniedReason: err.message },
                });
            });
        return () => { cancelled = true; };
    }, [navigate]);

    // The dashboard is always reachable: it is where the role card lands, and a
    // card that opens an empty shell is worse than one menu the admin has not
    // got round to enabling. Entries with no `menuKey` are the head's own
    // settings rather than department data, so they are not an admin's to
    // withhold. Every OTHER menu obeys its toggle.
    const visibleMenus = useMemo(() => {
        if (!hodMenus) return [];
        return HOD_MENUS.filter(
            (m) => m.id === 'dashboard' || !m.menuKey || hodMenus[m.menuKey] === true,
        );
    }, [hodMenus]);

    if (error) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg || theme.surfaceAlt }}>
            <LeadershipSidebar
                label="iLEED head of department"
                menus={hodMenus === null ? null : visibleMenus}
                basePath="/ileed-hod"
                footer={'This view is read-only. Changes to attendance, cameras and enrolment are made by your department\u2019s iLEED admin.'}
            />

            <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                {context.error ? (
                    <div style={{ padding: 32, color: theme.danger }}>{context.error}</div>
                ) : (
                    <Outlet context={context} />
                )}
            </main>
        </div>
    );
}
