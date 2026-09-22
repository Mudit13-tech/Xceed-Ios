// client/src/attendancemodule/LeadershipSidebar.jsx
//
// The sidebar for the two iLEED leadership shells — the head of department's
// and the Dean (Academic)'s.
//
// It is the department admin's sidebar, to the pixel: same collapse, same
// sticky full-height column, same active treatment, same hover and the same
// "open in a new tab" affordance. The two leadership shells had a sidebar of
// their own — a fixed 240px block of NavLinks with a coloured left edge — so
// a head moving between the two modules met two different navigations for the
// same job.
//
// Deliberately the CHROME only. The menu list each shell shows stays its own:
// `hodMenus` and `deanMenus` are separate documents with separate defaults,
// and the one thing these shells must never do is drift into sharing a menu
// list — which is exactly what a shared layout with a role flag invites. This
// takes the menus already decided and draws them.
//
// The class names are the department admin's, so both pick up one hover rule
// rather than two that can disagree.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { theme } from './config';

const CSS = `
  .dept-admin-nav-item { transition: background .15s, color .15s; cursor: pointer; }
  .dept-admin-nav-item:hover { background: rgba(99,102,241,0.06) !important; }
  .dept-admin-nav-newtab-btn { opacity: 0; transition: opacity .12s, background .12s, color .12s; }
  .dept-admin-nav-item:hover .dept-admin-nav-newtab-btn { opacity: 1; }
  .dept-admin-nav-newtab-btn:hover { background: rgba(99,102,241,0.12) !important; color: #6366f1 !important; }
`;

/**
 * @param {object} props
 * @param {string} props.label            What the column is, for screen readers.
 * @param {Array|null} props.menus        The entries to draw; null means still loading.
 * @param {string} props.basePath         The shell's own root, e.g. `/ileed-hod`.
 *                                        An entry pointing outside it is opened
 *                                        in a new tab rather than navigated to,
 *                                        because this shell cannot render it.
 * @param {React.ReactNode} [props.footer] Drawn under the menus when expanded.
 */
export default function LeadershipSidebar({ label, menus, basePath, footer }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    useEffect(() => {
        if (isMobile) setCollapsed(true);
    }, [isMobile]);

    const isActive = (item) => (item.exact
        ? location.pathname === item.route || location.pathname === `${item.route}/`
        : location.pathname.startsWith(item.route));

    const open = (item) => {
        if (item.newTab || !item.route.startsWith(basePath)) {
            window.open(item.route, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(item.route);
    };

    const sidebarWidth = collapsed ? 52 : 208;

    return (
        <>
            <style>{CSS}</style>
            <aside
                aria-label={label}
                style={{
                    width: sidebarWidth,
                    flexShrink: 0,
                    background: '#ffffff',
                    borderRight: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width .22s ease',
                    overflow: 'hidden',
                    position: 'sticky',
                    top: 0,
                    height: '100vh',
                    zIndex: 100,
                    boxShadow: '1px 0 8px rgba(26,31,60,0.05)',
                }}
            >
                <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
                    {menus === null ? (
                        <div style={{ padding: 10, fontSize: 12, color: theme.textMuted }}>
                            {collapsed ? '…' : 'Loading…'}
                        </div>
                    ) : menus.map((item) => {
                        const active = isActive(item);
                        const color = item.color;
                        return (
                            <div
                                key={item.id}
                                className="dept-admin-nav-item"
                                onClick={() => open(item)}
                                title={collapsed ? item.label : undefined}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: collapsed ? 'center' : 'flex-start',
                                    padding: collapsed ? '10px 0' : '9px 11px',
                                    borderRadius: 8,
                                    marginBottom: 2,
                                    background: active ? `${color}12` : 'transparent',
                                    border: `1px solid ${active ? `${color}28` : 'transparent'}`,
                                    color: active ? color : theme.textMuted,
                                    position: 'relative',
                                }}
                            >
                                {active && (
                                    <div style={{
                                        position: 'absolute', left: 0, top: '22%', bottom: '22%',
                                        width: 3, borderRadius: '0 3px 3px 0', background: color,
                                    }} />
                                )}
                                {collapsed ? (
                                    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: theme.fontMono }}>
                                        {item.label[0]}
                                    </span>
                                ) : (
                                    <span style={{
                                        fontSize: 12.5, fontWeight: active ? 600 : 400,
                                        whiteSpace: 'nowrap', overflow: 'hidden',
                                        textOverflow: 'ellipsis', flex: 1,
                                    }}>
                                        {item.label}
                                    </span>
                                )}
                                {!collapsed && !item.newTab && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(item.route, '_blank', 'noopener,noreferrer');
                                        }}
                                        title={`Open ${item.label} in new tab`}
                                        className="dept-admin-nav-newtab-btn"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            bottom: 0,
                                            right: 4,
                                            width: 26,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: theme.textMuted,
                                            fontSize: 18,
                                            fontWeight: 600,
                                            lineHeight: 1,
                                            borderRadius: 6,
                                        }}
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {!collapsed && footer && (
                    <div style={{
                        padding: '10px 12px',
                        borderTop: `1px solid ${theme.border}`,
                        color: theme.textMuted,
                        fontSize: 10,
                        lineHeight: 1.4,
                    }}>
                        {footer}
                    </div>
                )}

                <div style={{ padding: '10px 8px', borderTop: `1px solid ${theme.border}` }}>
                    <div
                        className="dept-admin-nav-item"
                        onClick={() => setCollapsed((v) => !v)}
                        style={{
                            display: 'flex', alignItems: 'center',
                            justifyContent: collapsed ? 'center' : 'flex-start',
                            gap: 8, padding: collapsed ? '8px 0' : '8px 11px',
                            borderRadius: 7, color: theme.textMuted, fontSize: 11,
                        }}
                    >
                        <span style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>‹</span>
                        {!collapsed && 'Collapse'}
                    </div>
                </div>
            </aside>
        </>
    );
}
