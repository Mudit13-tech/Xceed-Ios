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
// The server is the boundary, not this file: `attendanceHodReadAccess` admits
// the role, `refuseAttendanceWrites` rejects anything that is not a GET, and
// `requireHodMenu` re-checks each toggle. Hiding a link here only spares
// somebody a screen full of 403s.

import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import getEnvironment from '../getenvironment';
import { theme, styles } from '../attendancemodule/config';

const apiUrl = getEnvironment();

// Same shape as DeptAdminLayout's ALL_MENUS, and the same `menuKey` values, so
// one entry in the config screen drives both sets. Routes point at the
// read-only destinations an HOD can actually open.
export const HOD_MENUS = [
    { id: 'dashboard',         menuKey: 'dashboard',         route: '/ileed-hod/dashboard',   label: 'Dashboard',           exact: true, color: '#6366f1' },
    { id: 'attendanceReports', menuKey: 'attendanceReports', route: '/ileed-hod/reports',     label: 'Attendance Reports',               color: '#14b8a6' },
    { id: 'confidenceMonitor', menuKey: 'confidenceMonitor', route: '/ileed-hod/confidence',  label: 'Confidence Monitor',               color: '#ef4444' },
    { id: 'classVerification', menuKey: 'classVerification', route: '/ileed-hod/verification', label: 'Class Verification',              color: '#ec4899' },
    { id: 'helpManual',        menuKey: 'helpManual',        route: '/ams-manual',            label: 'Help & Manual',       newTab: true, color: '#64748b' },
];

export default function HodLayout() {
    const navigate = useNavigate();
    // null = still loading. Rendering the menu from `{}` would flash an empty
    // sidebar and then fill it, which reads as a broken page.
    const [hodMenus, setHodMenus] = useState(null);
    const [error, setError] = useState('');

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
    // got round to enabling. Every OTHER menu obeys its toggle.
    const visibleMenus = useMemo(() => {
        if (!hodMenus) return [];
        return HOD_MENUS.filter((m) => m.id === 'dashboard' || hodMenus[m.menuKey] === true);
    }, [hodMenus]);

    if (error) return null;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg || theme.surfaceAlt }}>
            <nav
                aria-label="iLEED head of department"
                style={{
                    width: 240, flexShrink: 0, background: theme.surface,
                    borderRight: `1px solid ${theme.border}`, padding: '20px 12px',
                }}
            >
                <div style={{ ...styles.heading, fontSize: 15, padding: '0 10px 14px' }}>
                    iLEED — Head of Department
                </div>

                {hodMenus === null ? (
                    <div style={{ padding: 10, fontSize: 12, color: theme.textMuted }}>Loading…</div>
                ) : (
                    visibleMenus.map((menu) => (
                        menu.newTab ? (
                            <a
                                key={menu.id}
                                href={menu.route}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                    display: 'block', padding: '9px 10px', marginBottom: 4,
                                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    color: theme.text, textDecoration: 'none',
                                    borderLeft: `3px solid ${menu.color}`,
                                }}
                            >
                                {menu.label}
                            </a>
                        ) : (
                            <NavLink
                                key={menu.id}
                                to={menu.route}
                                end={menu.exact}
                                style={({ isActive }) => ({
                                    display: 'block', padding: '9px 10px', marginBottom: 4,
                                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    textDecoration: 'none',
                                    borderLeft: `3px solid ${menu.color}`,
                                    color: isActive ? theme.accent : theme.text,
                                    background: isActive ? (theme.accentDim || `${theme.accent}14`) : 'transparent',
                                })}
                            >
                                {menu.label}
                            </NavLink>
                        )
                    ))
                )}

                <div style={{ marginTop: 18, padding: '10px', fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
                    This view is read-only. Changes to attendance, cameras and
                    enrolment are made by your department&apos;s iLEED admin.
                </div>
            </nav>

            <main style={{ flex: 1, minWidth: 0 }}>
                <Outlet />
            </main>
        </div>
    );
}
