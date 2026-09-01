// client/src/attendancemodule/AttendanceDisputes.jsx
//
// Attendance disputes — one table, two audiences.
//
//   canDecide       the department coordinator's queue: accept or reject, with
//                   the ground-truth photos one click away so the call is made
//                   against the evidence rather than against the roll number.
//   read-only       the admin's institute-wide view: every dispute, every
//                   outcome, every department.
//
// Both render the same columns because both are looking at the same question —
// "is this marking believable?" — and a coordinator who escalates to an admin
// should be pointing at a row that admin can already see.
//
// Accepting does NOT change attendance. The verdict is recorded and the student
// told; the correction itself goes through the ERP override path, which stays
// the single writer of attendance status.

import { useCallback, useEffect, useMemo, useState } from 'react';
import getEnvironment from '../getenvironment';
import { theme, styles } from './config';
import StudentGroundTruthModal from './StudentGroundTruthModal';

const apiUrl = getEnvironment();
const DISPUTES_API = `${apiUrl}/attendancemodule/disputes`;

const STATUS_STYLE = {
    pending: { color: '#2563eb', bg: 'rgba(37,99,235,0.10)', label: 'Pending' },
    accepted: { color: theme.success, bg: theme.successDim, label: 'Accepted' },
    rejected: { color: theme.textMuted, bg: 'rgba(123,132,171,0.14)', label: 'Rejected' },
};

const MARK_STYLE = {
    P: { color: theme.success, bg: theme.successDim, label: 'Present' },
    A: { color: theme.danger, bg: theme.dangerDim, label: 'Absent' },
    R: { color: theme.warning, bg: theme.warningDim, label: 'Review' },
};

// Confidence is the number the coordinator weighs the student's word against, so
// it is banded rather than left as four decimal places: "0.31" means nothing at a
// glance, "low" means the model was never sure in the first place.
const confidenceBand = (value) => {
    if (!value) return { color: theme.textMuted, label: '—' };
    const pct = value * 100;
    if (pct >= 60) return { color: theme.success, label: `${pct.toFixed(1)}%` };
    if (pct >= 40) return { color: theme.warning, label: `${pct.toFixed(1)}%` };
    return { color: theme.danger, label: `${pct.toFixed(1)}%` };
};

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '—');

const CSS = `
  .ad-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .ad-table th {
    text-align: left; padding: 9px 10px; white-space: nowrap;
    background: ${theme.surfaceAlt}; color: ${theme.textMuted};
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; border-bottom: 1px solid ${theme.border};
    position: sticky; top: 0; z-index: 2;
  }
  .ad-table td {
    padding: 9px 10px; border-bottom: 1px solid ${theme.border};
    color: ${theme.text}; vertical-align: top;
  }
  .ad-table tbody tr:hover { background: rgba(99,102,241,0.035); }
  .ad-roll {
    font-family: ${theme.fontMono}; font-weight: 700; font-size: 12.5px;
    background: none; border: none; padding: 0; cursor: pointer;
    color: ${theme.accent}; text-decoration: underline; text-underline-offset: 3px;
  }
  .ad-pill {
    display: inline-block; padding: 2px 9px; border-radius: 999px;
    font-size: 11px; font-weight: 700; white-space: nowrap;
  }
  .ad-btn {
    padding: 5px 11px; border-radius: 7px; font-size: 11.5px; font-weight: 600;
    cursor: pointer; font-family: inherit; border: 1px solid ${theme.border};
    background: #fff; color: ${theme.textMuted}; transition: all .15s;
  }
  .ad-btn:disabled { opacity: .5; cursor: not-allowed; }
  .ad-btn--accept:not(:disabled):hover { border-color: ${theme.success}; color: ${theme.success}; background: ${theme.successDim}; }
  .ad-btn--reject:not(:disabled):hover { border-color: ${theme.danger}; color: ${theme.danger}; background: ${theme.dangerDim}; }
  .ad-input {
    width: 100%; padding: 7px 10px; border-radius: 7px; font-size: 12px;
    border: 1px solid ${theme.border}; background: #fff; color: ${theme.text};
    font-family: inherit; outline: none;
  }
  .ad-input:focus { border-color: ${theme.borderFocus}; }
  .ad-filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 14px; }
  .ad-stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .ad-stat {
    flex: 1; min-width: 120px; padding: 12px 16px; border-radius: 10px;
    background: #fff; border: 1px solid ${theme.border};
  }
  .ad-scroll { overflow-x: auto; max-height: 70vh; overflow-y: auto; border: 1px solid ${theme.border}; border-radius: 10px; background: #fff; }
`;

function Pill({ style: pill }) {
    if (!pill) return <span style={{ color: theme.textMuted }}>—</span>;
    return (
        <span className="ad-pill" style={{ color: pill.color, background: pill.bg }}>
            {pill.label}
        </span>
    );
}

/**
 * @param {object}  props
 * @param {boolean} [props.canDecide]  Show the accept/reject controls.
 * @param {string}  [props.title]
 * @param {string}  [props.subtitle]
 */
export default function AttendanceDisputes({
    canDecide = false,
    title = 'Attendance disputes',
    subtitle,
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState(canDecide ? 'pending' : '');
    const [dateFilter, setDateFilter] = useState('');
    const [search, setSearch] = useState('');
    // Per-row draft remarks, so typing in one row never disturbs another.
    const [remarks, setRemarks] = useState({});
    const [deciding, setDeciding] = useState(null);
    const [toast, setToast] = useState(null);
    const [gtTarget, setGtTarget] = useState(null);

    const showToast = (msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (dateFilter) params.set('date', dateFilter);
            const res = await fetch(`${DISPUTES_API}?${params.toString()}`, { credentials: 'include' });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || 'Failed to load disputes');
            setData(body);
        } catch (err) {
            setError(err.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, dateFilter]);

    useEffect(() => { load(); }, [load]);

    const decide = async (dispute, decision) => {
        setDeciding(`${dispute._id}:${decision}`);
        try {
            const res = await fetch(`${DISPUTES_API}/${dispute._id}/decision`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ decision, remark: remarks[dispute._id] || '' }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || 'Failed to record the decision');
            showToast(`Dispute ${decision} — ${dispute.rollNo} has been notified.`);
            setRemarks((prev) => {
                const next = { ...prev };
                delete next[dispute._id];
                return next;
            });
            load();
        } catch (err) {
            showToast(err.message, false);
        } finally {
            setDeciding(null);
        }
    };

    // Roll number / student name / subject, matched client-side: the list is
    // already capped server-side, and a coordinator hunting one student should
    // not wait on a round trip per keystroke.
    const rows = useMemo(() => {
        const all = data?.disputes || [];
        const query = search.trim().toLowerCase();
        if (!query) return all;
        return all.filter((d) => [d.rollNo, d.studentName, d.subject, d.faculty]
            .filter(Boolean)
            .some((field) => String(field).toLowerCase().includes(query)));
    }, [data, search]);

    const counts = data?.counts || { pending: 0, accepted: 0, rejected: 0, total: 0 };

    return (
        <div style={{ ...styles.page, minHeight: 'auto' }}>
            <style>{CSS}</style>

            <div style={{ marginBottom: 16 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</h1>
                <p style={{ fontSize: 12.5, color: theme.textMuted, margin: '4px 0 0', maxWidth: 720, lineHeight: 1.6 }}>
                    {subtitle || (canDecide
                        ? 'Students challenging how a period was marked. Click a roll number to see the ground-truth and ERP photos the match was made against. Recording a verdict notifies the student; it does not change the attendance record — correct that through ERP Overrides.'
                        : 'Every dispute raised across the institute and how each was decided. Read-only — verdicts are recorded by the department coordinator.')}
                    {data && !data.fullAccess ? ` · ${data.department}` : ''}
                </p>
            </div>

            <div className="ad-stats">
                {[
                    ['Pending', counts.pending, '#2563eb'],
                    ['Accepted', counts.accepted, theme.success],
                    ['Rejected', counts.rejected, theme.textMuted],
                    ['Total', counts.total, theme.accent],
                ].map(([label, value, color]) => (
                    <div key={label} className="ad-stat">
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {label}
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
                    </div>
                ))}
            </div>

            <div className="ad-filters">
                <select
                    className="ad-input"
                    style={{ width: 160 }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                </select>
                <input
                    type="date"
                    className="ad-input"
                    style={{ width: 170 }}
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    title="Class date"
                />
                <input
                    type="search"
                    className="ad-input"
                    style={{ width: 230 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Roll no, name, subject, faculty…"
                />
                <button type="button" className="ad-btn" onClick={load} disabled={loading}>
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
                {(dateFilter || search || statusFilter) && (
                    <button
                        type="button"
                        className="ad-btn"
                        onClick={() => { setStatusFilter(''); setDateFilter(''); setSearch(''); }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {toast && (
                <div style={{
                    marginBottom: 12, padding: '9px 14px', borderRadius: 8, fontSize: 12.5,
                    background: toast.ok ? theme.successDim : theme.dangerDim,
                    color: toast.ok ? theme.success : theme.danger,
                    border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    {toast.msg}
                </div>
            )}

            {error ? (
                <div style={{ padding: '14px 16px', borderRadius: 8, background: theme.dangerDim, color: theme.danger, fontSize: 12.5 }}>
                    {error}
                </div>
            ) : loading && !data ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
                    Loading disputes…
                </div>
            ) : rows.length === 0 ? (
                <div style={{ ...styles.card, textAlign: 'center', color: theme.textMuted, fontSize: 13, padding: '40px 24px' }}>
                    {data?.disputes?.length
                        ? 'No dispute matches this search.'
                        : 'No disputes here. Students raise them from their My Attendance page after a marking notification.'}
                </div>
            ) : (
                <div className="ad-scroll">
                    <table className="ad-table">
                        <thead>
                            <tr>
                                <th>Roll no</th>
                                <th>Sem</th>
                                <th>Subject</th>
                                <th>Faculty</th>
                                <th>Date</th>
                                <th>Period</th>
                                <th>Time</th>
                                <th>Marked</th>
                                <th>Avg confidence</th>
                                <th>Ground truth</th>
                                <th>Student&apos;s case</th>
                                <th>Outcome</th>
                                {canDecide && <th style={{ minWidth: 210 }}>Decision</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((dispute) => {
                                const band = confidenceBand(dispute.avgConfidence);
                                const busy = deciding && deciding.startsWith(dispute._id);
                                const settled = dispute.status !== 'pending';
                                return (
                                    <tr key={dispute._id}>
                                        <td>
                                            <button
                                                type="button"
                                                className="ad-roll"
                                                onClick={() => setGtTarget(dispute)}
                                                title="Ground truth and ERP photos"
                                            >
                                                {dispute.rollNo}
                                            </button>
                                            {dispute.studentName && (
                                                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                                                    {dispute.studentName}
                                                </div>
                                            )}
                                        </td>
                                        <td>{dispute.semester || '—'}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{dispute.subject || '—'}</div>
                                            {dispute.subjectCode && (
                                                <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: theme.fontMono }}>
                                                    {dispute.subjectCode}
                                                </div>
                                            )}
                                        </td>
                                        <td>{dispute.faculty || '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{dispute.date || '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>{dispute.periodName || '—'}</td>
                                        <td style={{ whiteSpace: 'nowrap', fontFamily: theme.fontMono, fontSize: 11.5 }}>
                                            {dispute.periodTime || '—'}
                                        </td>
                                        <td><Pill style={MARK_STYLE[dispute.markedStatus]} /></td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <span style={{ color: band.color, fontWeight: 700, fontFamily: theme.fontMono }}>
                                                {band.label}
                                            </span>
                                            {dispute.confidenceZone && (
                                                <div style={{ fontSize: 10.5, color: theme.textMuted }}>
                                                    {dispute.confidenceZone} zone
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="ad-btn"
                                                onClick={() => setGtTarget(dispute)}
                                            >
                                                View photos
                                            </button>
                                        </td>
                                        <td style={{ maxWidth: 240 }}>
                                            <div style={{ fontWeight: 600 }}>{dispute.reason}</div>
                                            {dispute.remark && (
                                                <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 3, lineHeight: 1.5 }}>
                                                    “{dispute.remark}”
                                                </div>
                                            )}
                                            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3 }}>
                                                Raised {formatWhen(dispute.createdAt)}
                                            </div>
                                        </td>
                                        <td style={{ maxWidth: 220 }}>
                                            <Pill style={STATUS_STYLE[dispute.status]} />
                                            {settled && (
                                                <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4, lineHeight: 1.5 }}>
                                                    {dispute.decidedByName || 'Coordinator'} · {formatWhen(dispute.decidedAt)}
                                                    {dispute.coordinatorRemark && (
                                                        <div style={{ marginTop: 2 }}>“{dispute.coordinatorRemark}”</div>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        {canDecide && (
                                            <td>
                                                {settled ? (
                                                    <span style={{ fontSize: 11, color: theme.textMuted }}>Decided</span>
                                                ) : (
                                                    <>
                                                        <input
                                                            className="ad-input"
                                                            placeholder="Reason for the verdict (optional)"
                                                            value={remarks[dispute._id] || ''}
                                                            onChange={(e) => setRemarks((prev) => ({ ...prev, [dispute._id]: e.target.value }))}
                                                            maxLength={1000}
                                                            style={{ marginBottom: 6 }}
                                                        />
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button
                                                                type="button"
                                                                className="ad-btn ad-btn--accept"
                                                                disabled={busy}
                                                                onClick={() => decide(dispute, 'accepted')}
                                                            >
                                                                {deciding === `${dispute._id}:accepted` ? '…' : 'Accept'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ad-btn ad-btn--reject"
                                                                disabled={busy}
                                                                onClick={() => decide(dispute, 'rejected')}
                                                            >
                                                                {deciding === `${dispute._id}:rejected` ? '…' : 'Reject'}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {gtTarget && (
                <StudentGroundTruthModal
                    batch={gtTarget.batch}
                    rollNo={gtTarget.rollNo}
                    // The modal's facts strip reads a finalReport-shaped entry.
                    // The dispute snapshot carries the same fields under its own
                    // names, so it is reshaped here rather than re-fetching the
                    // report — the snapshot is what the student was actually
                    // told, which is the thing being disputed.
                    student={{
                        status: gtTarget.markedStatus === 'P' ? 'present' : 'absent',
                        finalStatus: gtTarget.markedStatus,
                        avgConfidence: gtTarget.avgConfidence,
                        confidenceZone: gtTarget.confidenceZone,
                        firstSeenSec: null,
                    }}
                    onClose={() => setGtTarget(null)}
                />
            )}
        </div>
    );
}
