// client/src/deanadmin/DeanLayout.jsx
//
// The shell around the iLEED Dean (Academic) pages.
//
// A sibling of HodLayout for the same reason HodLayout is a sibling of
// DeptAdminLayout rather than a mode of it: the menus are driven by a different
// document (`deanMenus` vs `hodMenus`) with its own values, and the scope below
// is every department rather than one. Sharing a layout with a flag is what
// would let a menu switched on for the dean quietly appear for every head, and
// the two toggle sets exist precisely so that cannot happen.
//
// The server is the boundary, not this file: `attendanceLeadershipReadAccess`
// admits the role, `refuseAttendanceWrites` rejects anything that is not a GET,
// and `requireDeanMenu` re-checks each toggle. Hiding a link here only spares
// somebody a screen full of 403s.

import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import getEnvironment from '../getenvironment';
import { theme } from '../attendancemodule/config';
import LeadershipSidebar from '../attendancemodule/LeadershipSidebar';
import { leadershipMenusFor } from '../attendancemodule/menuCatalogue';

const apiUrl = getEnvironment();

// Built from the shared leadership list, exactly as HodLayout builds its own
// — see attendancemodule/menuCatalogue.js. The same `menuKey` values as
// DeptAdminLayout's ALL_MENUS, so one entry in the config screen drives every
// set. Routes point at the read-only destinations a dean can actually open.
export const DEAN_MENUS = leadershipMenusFor('/ileed-dean', 'dean');

// No "Email Notifications" entry, unlike the HOD's menu. Those preferences are
// a head's alerts for the department they head, and a dean heads none — so the
// screen would have nothing to be about. It is also the one thing in the HOD
// view a head may WRITE, and leaving it off keeps the dean's view read-only
// with no exception to explain.

const EMPTY_CONTEXT = {
    department: '',
    batchDepartment: '',
    departments: [],
    batchDepartments: [],
    fullAccess: false,
    loading: true,
    error: '',
};

export default function DeanLayout() {
    const navigate = useNavigate();
    // null = still loading. Rendering the menu from `{}` would flash an empty
    // sidebar and then fill it, which reads as a broken page.
    const [deanMenus, setDeanMenus] = useState(null);
    const [error, setError] = useState('');
    // The same shape HodLayout and DeptAdminLayout hand down, because the pages
    // below are the same components: they read it with useOutletContext and
    // destructure it unguarded, so an Outlet with no context is not an empty
    // object — it is null, and every page but the dashboard throws on its first
    // render. For a dean it arrives with `fullAccess` true and no department,
    // which is what those pages already understand as institute scope.
    const [context, setContext] = useState(EMPTY_CONTEXT);

    useEffect(() => {
        const controller = new AbortController();
        // Behind attendanceLeadershipReadAccess, same as the menu fetch below.
        // The scope is the server's: resolveAttendanceAccess answers a dean with
        // institute access and no department, and no department is ever named
        // by the client.
        fetch(`${apiUrl}/attendancemodule/dept-admin/context`, {
            credentials: 'include',
            signal: controller.signal,
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || 'Unable to load institute access.');
                setContext({
                    department: data.department || '',
                    batchDepartment: data.batchDepartment || '',
                    departments: data.departments || [],
                    batchDepartments: data.batchDepartments || [],
                    // True for a dean, and the server decides it — this only
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
        fetch(`${apiUrl}/attendancemodule/dept-admin/dean-menus`, { credentials: 'include' })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.message || data.error || 'Attendance access denied');
                if (!cancelled) setDeanMenus(data.deanMenus || {});
            })
            .catch((err) => {
                // A 403 here means the account is not a dean (or lost the role
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
    // got round to enabling. Every other menu obeys its toggle.
    const visibleMenus = useMemo(() => {
        if (!deanMenus) return [];
        return DEAN_MENUS.filter(
            (m) => m.id === 'dashboard' || !m.menuKey || deanMenus[m.menuKey] === true,
        );
    }, [deanMenus]);

    if (error) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg || theme.surfaceAlt }}>
            <LeadershipSidebar
                label="iLEED Dean (Academic)"
                menus={deanMenus === null ? null : visibleMenus}
                basePath="/ileed-dean"
                footer={'Every department, read-only. Changes to attendance, cameras and enrolment are made by each department\u2019s iLEED admin.'}
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
