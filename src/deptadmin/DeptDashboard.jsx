import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, ScanFace, Users } from 'lucide-react';
import getEnvironment from '../getenvironment';
import { styles, theme } from '../attendancemodule/config';
import DashboardProgress from '../attendancemodule/DashboardProgress';
import PendingActionsCard from '../attendancemodule/PendingActionsCard';
import LiveStatusPanel from '../attendancemodule/LiveStatusPanel';

const apiUrl = getEnvironment();

const displayPercent = (value) => value == null ? 'No data' : `${value}%`;

function StatCard({ icon: Icon, label, value, detail, color }) {
    return (
        <div style={{ ...styles.card, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                    <div style={{ color: theme.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                        {label}
                    </div>
                    <div style={{ color: theme.text, fontSize: 26, fontWeight: 700 }}>{value}</div>
                    <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 5 }}>{detail}</div>
                </div>
                <Icon size={24} color={color} aria-hidden="true" />
            </div>
        </div>
    );
}

function ReportRows({ reports }) {
    // Defaulted rather than destructured bare: this renders whatever the stats
    // endpoint returned, and a body without `recentReports` used to take the
    // whole page down with it — see the guard in DeptDashboard below.
    if (!Array.isArray(reports) || !reports.length) {
        return <div style={{ color: theme.textMuted, padding: '32px 0', textAlign: 'center' }}>No attendance sessions recorded yet.</div>;
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                    <tr style={{ color: theme.textMuted, textAlign: 'left' }}>
                        {['Date', 'Subject', 'Semester', 'Room', 'Attendance', 'Status'].map((label) => (
                            <th key={label} style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.border}` }}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {reports.map((report) => (
                        <tr key={report._id}>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}` }}>{report.date}</td>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}`, fontWeight: 600 }}>{report.subject || 'Unspecified'}</td>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}` }}>{report.semester || '-'}</td>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}` }}>{report.room || '-'}</td>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}` }}>{displayPercent(report.summary?.attendancePct)}</td>
                            <td style={{ padding: 12, borderBottom: `1px solid ${theme.border}`, textTransform: 'capitalize' }}>{report.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/**
 * The department's attendance day.
 *
 * Serves two audiences from one component, which is the point: the department
 * admin who runs the system, and — via `readOnly` — the head of department who
 * reads what it produced. Every endpoint it calls is already scoped to the
 * caller's own department server-side, so the two differ only in what is worth
 * showing, never in what is fetched.
 */
export default function DeptDashboard({ readOnly = false }) {
    const [state, setState] = useState({ stats: null, loading: true, error: '' });
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    // Only honoured server-side for a full-access (iams-admin) caller — see
    // deptAdminController.getTodayAttendanceStats — so an actual dept admin
    // opening this URL still only ever sees their own department. Lets an
    // institute admin open a specific dept admin's dashboard from
    // /attendance/dept-admins without impersonating the account.
    const overrideDepartment = searchParams.get('department') || '';

    const loadStats = useCallback(async () => {
        setState((current) => ({ ...current, loading: true, error: '' }));
        try {
            const query = overrideDepartment ? `?department=${encodeURIComponent(overrideDepartment)}` : '';
            const response = await fetch(`${apiUrl}/attendancemodule/dept-admin/stats/today${query}`, { credentials: 'include' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to load department statistics.');
            setState({ stats: data, loading: false, error: '' });
        } catch (error) {
            setState({ stats: null, loading: false, error: error.message });
        }
    }, [overrideDepartment]);

    useEffect(() => { loadStats(); }, [loadStats]);

    if (state.loading && !state.stats) {
        return <div style={{ ...styles.card, color: theme.textMuted }}>Loading department statistics...</div>;
    }

    if (state.error) {
        return (
            <div style={{ ...styles.card, color: theme.danger }}>
                {state.error}
            </div>
        );
    }

    const stats = state.stats;

    /* A 200 whose body is not the payload this page is built from.
     *
     * Every field below was read straight off `stats`, so anything unexpected
     * — an empty body, a proxy's own JSON, a half-written response — threw
     * during render. There is an ErrorBoundary above this route, so the whole
     * screen became the words "Something went wrong": no department, no
     * endpoint, nothing to act on, and identical to every other crash in the
     * app. A head of department opening their iLEED card saw exactly that.
     *
     * The two arrays this page cannot do without are what it is checked on,
     * because they are what it iterates. Say so plainly instead, and name the
     * endpoint, so the next person reads one line rather than a stack trace.
     */
    if (!stats || !Array.isArray(stats.byYear)) {
        return (
            <div style={{ ...styles.card, color: theme.danger }}>
                The attendance statistics could not be read — the server answered
                {' '}<code>/attendancemodule/dept-admin/stats/today</code>{' '}
                with something this page does not understand. Please report this to
                an administrator.
            </div>
        );
    }

    const maxYearPct = Math.max(100, ...stats.byYear.map((item) => item.attendancePct || 0));

    return (
        <div style={{ padding: '24px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
                <div>
                    <div style={styles.heading}>{stats.department} Attendance</div>
                    <div style={styles.subheading}>Today, {stats.date}</div>
                </div>
                {overrideDepartment && stats.fullAccess && (
                    <div style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: theme.accentDim || `${theme.accent}18`, color: theme.accent,
                        border: `1px solid ${theme.accent}30`,
                    }}>
                        Viewing as admin — {stats.department}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
                <StatCard icon={Users} label="Today's attendance" value={displayPercent(stats.attendancePct)} detail={`${stats.present} present of ${stats.totalStudents}`} color={theme.accent} />
                <StatCard icon={Clock3} label="Ground truth pending" value={stats.groundTruthPending} detail={`${stats.groundTruthApproved} approved`} color={theme.warning} />
                <StatCard icon={ScanFace} label="Match accuracy" value={displayPercent(stats.matchAccuracy)} detail="Average approved confidence" color={theme.success} />
                <StatCard icon={CheckCircle2} label="Sessions today" value={stats.sessions} detail={`${stats.review} records need review`} color="#0ea5e9" />
            </div>

            {/* The same cards as the standalone live screen, not a reduced
                copy of them: camera state, the preflight checklist that says
                WHY a room has not started, run progress and the counts.
                Scoped server-side to this department's classes — see
                schedulerController.liveStatus. Placed directly under the day's
                totals because it is the only part of this page that changes
                minute to minute. */}
            <LiveStatusPanel
                variant="panel"
                title="Live classrooms"
                department={overrideDepartment}
                onOpenReport={(room, { date, slot }) => navigate(
                    readOnly ? '/ileed-hod/reports' : '/dept-admin/reports',
                    {
                        state: {
                            reportId: room.reportId,
                            prefillDate: date,
                            prefillSlot: slot,
                            prefillRoom: room.room,
                        },
                    },
                )}
            />

            {/* Every item on this card is something to go and DO — approve a
                cluster, resolve a dispute. A head of department can reach none
                of them, so offering the list would be a page of dead ends. */}
            {!readOnly && <PendingActionsCard initialDepartment={overrideDepartment} />}

            {/* Folded by default. The two rings stay visible as the headline;
                the charts behind them are consulted when a ring looks wrong,
                which is not often enough to earn a screenful under the live
                cards on every load. */}
            <DashboardProgress
                title="Acquisition and Roll Assignment Progress"
                compact
                collapsibleCharts
                initialDepartment={overrideDepartment}
            />

            <section style={{ ...styles.card, marginTop: 18 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 16,
                    }}
                >
                    <div style={{ ...styles.heading, fontSize: 17 }}>Year-wise attendance</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>Today, {stats.date}</div>
                </div>
                {stats.byYear.length === 0 ? (
                    <div style={{ color: theme.textMuted, padding: '24px 0', textAlign: 'center' }}>No year-wise attendance has been recorded today.</div>
                ) : stats.byYear.map((item) => (
                    <div key={item.year} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 76px', gap: 14, alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Year {item.year}</span>
                        <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', background: theme.surfaceAlt }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${((item.attendancePct || 0) / maxYearPct) * 100}%`,
                                    background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}CC)`,
                                    borderRadius: 6,
                                    transition: 'width .5s ease',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, textAlign: 'right', color: theme.accent, fontFamily: theme.fontMono }}>
                            {displayPercent(item.attendancePct)}
                        </span>
                    </div>
                ))}
            </section>

            <section style={{ ...styles.card, marginTop: 18 }}>
                <div style={{ ...styles.heading, fontSize: 17, marginBottom: 8 }}>Recent sessions</div>
                <ReportRows reports={stats.recentReports} />
            </section>
        </div>
    );
}
