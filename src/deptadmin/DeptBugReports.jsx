import { useCallback, useEffect, useState } from 'react';

import lmApi from '../learningModule/api/lmApi';
import { theme } from '../attendancemodule/config';

/**
 * "Something is broken" — or "this would be better if" — from the department
 * admin sidebar.
 *
 * The same queue the learning module and the Super Admin dashboard already read:
 * same endpoints, same reports, same points. A dept admin lives in the
 * attendance module all day and is the person most likely to notice a defect
 * there, so making them navigate into the learning module to say so is how a bug
 * goes unreported.
 *
 * Points are paid when a platform admin approves the report — never on
 * submission, which would make this a button worth pressing for its own sake.
 *
 * There is no role check here: the queue endpoint 403s for anyone who is not a
 * platform admin, and this page simply does not render the queue when it does.
 * Guarding in the browser as well would only mean two places to keep in step.
 */

const STATUS_STYLE = {
    open: { color: '#2563eb', bg: 'rgba(37,99,235,0.10)', label: 'waiting to be read' },
    acknowledged: { color: theme.success, bg: theme.successDim, label: 'approved — points added' },
    duplicate: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', label: 'already known' },
    rejected: { color: theme.textMuted, bg: 'rgba(123,132,171,0.12)', label: 'not taken up' },
    fixed: { color: '#14b8a6', bg: 'rgba(20,184,166,0.10)', label: 'done' },
};

const KIND_STYLE = {
    bug: { color: theme.danger, bg: theme.dangerDim, label: '🐛 Bug' },
    suggestion: { color: theme.warning, bg: theme.warningDim, label: '💡 Suggestion' },
};

// The two halves of the form read differently depending on which one is being
// filed. Asking "is this broken, or could it be better?" once is cheaper than an
// admin reading the whole thing to work it out.
const KIND_COPY = {
    bug: {
        title: 'What went wrong, in one line?',
        description: 'What were you doing, what did you expect, and what happened instead?',
    },
    suggestion: {
        title: 'What would you like to see, in one line?',
        description: 'What are you trying to do, and how would this make it easier?',
    },
};

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '');

const CSS = `
  .dbr-input, .dbr-select, .dbr-textarea {
    width: 100%; padding: 8px 11px; border-radius: 8px;
    border: 1px solid ${theme.border}; background: #fff; color: ${theme.text};
    font-size: 12.5px; font-family: inherit; outline: none;
    transition: border-color .15s, box-shadow .15s;
  }
  .dbr-input:focus, .dbr-select:focus, .dbr-textarea:focus {
    border-color: ${theme.borderFocus}; box-shadow: 0 0 0 3px ${theme.accentDim};
  }
  .dbr-textarea { resize: vertical; min-height: 108px; line-height: 1.5; }
  .dbr-btn {
    padding: 8px 16px; border-radius: 7px; border: 1px solid transparent;
    background: ${theme.accent}; color: #fff; font-size: 12.5px; font-weight: 600;
    font-family: inherit; cursor: pointer; transition: opacity .15s, filter .15s;
  }
  .dbr-btn:hover:not(:disabled) { filter: brightness(1.07); }
  .dbr-btn:disabled { opacity: .5; cursor: not-allowed; }
  .dbr-btn--ghost { background: #fff; color: ${theme.textMuted}; border-color: ${theme.border}; }
  .dbr-btn--ghost:hover:not(:disabled) { border-color: #c7caee; color: ${theme.text}; }
  .dbr-btn--sm { padding: 5px 11px; font-size: 12px; }
  .dbr-card {
    background: ${theme.surface}; border: 1px solid ${theme.border};
    border-radius: 10px; padding: 16px;
  }
  .dbr-tab {
    padding: 7px 14px; border-radius: 7px; border: 1px solid transparent;
    background: transparent; color: ${theme.textMuted}; font-size: 12.5px;
    font-weight: 600; font-family: inherit; cursor: pointer;
  }
  .dbr-tab--on { background: ${theme.accentDim}; color: ${theme.accent}; border-color: rgba(99,102,241,0.22); }
`;

function Pill({ style, children }) {
    return (
        <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            background: style.bg, color: style.color,
        }}>
            {children}
        </span>
    );
}

function Toast({ toast }) {
    if (!toast) return null;
    return (
        <div style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 500,
            padding: '9px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: toast.ok ? theme.successDim : theme.dangerDim,
            color: toast.ok ? theme.success : theme.danger,
            border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: '0 4px 16px rgba(26,31,60,0.10)',
        }}>
            {toast.msg}
        </div>
    );
}

function ReportForm({ classes, pointsPerReport, onSent, notify }) {
    const [kind, setKind] = useState('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [classId, setClassId] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!title.trim()) return;
        setSaving(true);
        try {
            await lmApi.reportBug({
                kind,
                title: title.trim(),
                description: description.trim(),
                classId: classId || null,
                // The single most useful line in any bug report, and the one
                // people always forget to include.
                pageUrl: window.location.href,
            });
            notify('Sent — thank you', true);
            setTitle('');
            setDescription('');
            setClassId('');
            onSent();
        } catch (err) {
            notify(err.message, false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <select
                className="dbr-select"
                style={{ maxWidth: 420 }}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
            >
                <option value="bug">🐛 Something is broken (bug)</option>
                <option value="suggestion">💡 Something could be better (suggestion)</option>
            </select>
            <input
                className="dbr-input"
                placeholder={KIND_COPY[kind].title}
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
                className="dbr-textarea"
                placeholder={KIND_COPY[kind].description}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
            />
            {/* Only worth asking when the account actually has classes — most
                dept-admin reports are about the attendance module, not a class. */}
            {classes.length > 0 && (
                <select
                    className="dbr-select"
                    style={{ maxWidth: 420 }}
                    value={classId}
                    onChange={(event) => setClassId(event.target.value)}
                >
                    <option value="">Was it in a particular class? (optional)</option>
                    {classes.map((klass) => (
                        <option key={klass._id} value={klass._id}>{klass.name}</option>
                    ))}
                </select>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="dbr-btn" onClick={submit} disabled={saving || !title.trim()}>
                    {saving ? 'Sending…' : 'Send'}
                </button>
                <span style={{ fontSize: 11.5, color: theme.textMuted }}>
                    Goes straight to the platform administrators. {pointsPerReport} points once it is
                    approved.
                </span>
            </div>
        </div>
    );
}

/** One report in the admin queue. Only rendered when the API let us read it. */
function QueueCard({ report, onDecide, onSendNote }) {
    const [note, setNote] = useState(report.adminNote || '');
    const [busy, setBusy] = useState(false);
    const [sending, setSending] = useState(false);

    const decide = async (status) => {
        setBusy(true);
        try {
            await onDecide(report, status, note);
        } finally {
            setBusy(false);
        }
    };

    // Re-sending text the reporter has already been shown notifies nobody: the
    // server only raises a notification when the stored note actually changes.
    const noteIsNew = note.trim() !== '' && note.trim() !== (report.adminNote || '').trim();

    // A reply with no verdict attached — "what were you doing when it happened?"
    // on a ticket that has to stay open until they answer. The four buttons below
    // all decide the report, so without this there is no way to ask a question
    // without also closing or approving it.
    const sendNote = async () => {
        if (!noteIsNew) return;
        setSending(true);
        try {
            await onSendNote(report, note.trim());
        } finally {
            setSending(false);
        }
    };

    const kind = KIND_STYLE[report.kind] || KIND_STYLE.bug;
    const status = STATUS_STYLE[report.status] || STATUS_STYLE.open;

    return (
        <div className="dbr-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Pill style={kind}>{kind.label}</Pill>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{report.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {report.awardedAt && (
                        <Pill style={{ color: theme.accent, bg: theme.accentDim }}>points paid</Pill>
                    )}
                    <Pill style={status}>{report.status}</Pill>
                </div>
            </div>

            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>
                {report.reporterName || 'Unknown'}
                {report.reporterEmail ? ` · ${report.reporterEmail}` : ''}
                {report.reporterRole ? ` · ${report.reporterRole}` : ''} · {formatWhen(report.created_at)}
                {report.className ? ` · ${report.className}` : ' · platform-wide'}
            </div>

            {report.description && (
                <div style={{
                    background: theme.surfaceAlt, border: `1px solid ${theme.border}`,
                    borderRadius: 8, padding: 11, marginBottom: 10,
                    fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>
                    {report.description}
                </div>
            )}

            {report.pageUrl && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10, wordBreak: 'break-all' }}>
                    Reported from{' '}
                    <a href={report.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.accent }}>
                        {report.pageUrl}
                    </a>
                </div>
            )}

            {report.reviewedByName && (
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>
                    Last reviewed by {report.reviewedByName} on {formatWhen(report.reviewedAt)}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                    className="dbr-input"
                    placeholder="Note back to the reporter (optional)"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') sendNote(); }}
                />
                <button
                    className="dbr-btn dbr-btn--ghost dbr-btn--sm"
                    style={{ flexShrink: 0 }}
                    disabled={!noteIsNew || sending}
                    onClick={sendNote}
                >
                    {sending ? 'Sending…' : 'Send note'}
                </button>
            </div>

            {/* Only "Approve" pays, and only the first time: the server records the
                award on the report and the ledger refuses a second row for it, so
                approve → done → approve cannot pay twice. */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                    className="dbr-btn dbr-btn--sm"
                    style={{ background: theme.success }}
                    disabled={busy}
                    onClick={() => decide('acknowledged')}
                >
                    Approve
                </button>
                <button className="dbr-btn dbr-btn--ghost dbr-btn--sm" disabled={busy} onClick={() => decide('fixed')}>
                    {report.kind === 'suggestion' ? 'Mark done' : 'Mark fixed'}
                </button>
                <button className="dbr-btn dbr-btn--ghost dbr-btn--sm" disabled={busy} onClick={() => decide('duplicate')}>
                    Already known
                </button>
                <button
                    className="dbr-btn dbr-btn--ghost dbr-btn--sm"
                    style={{ color: theme.danger }}
                    disabled={busy}
                    onClick={() => decide('rejected')}
                >
                    Reject
                </button>
            </div>
        </div>
    );
}

export default function DeptBugReports() {
    const [mine, setMine] = useState(null);
    const [queue, setQueue] = useState(null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState('report');
    const [toast, setToast] = useState(null);

    const notify = useCallback((msg, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3200);
    }, []);

    const load = useCallback(async () => {
        setError(null);
        try {
            const [own, myClasses, admin] = await Promise.all([
                lmApi.myBugReports(),
                lmApi.listClasses().catch(() => []),
                // 403 for everyone who is not a platform admin, which is how this
                // page decides whether to show the queue at all.
                lmApi.allBugReports().catch(() => null),
            ]);
            setMine(own);
            setClasses(myClasses || []);
            setQueue(admin);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const decide = async (report, nextStatus, adminNote) => {
        try {
            await lmApi.reviewBug(report._id, { status: nextStatus, adminNote });
            notify(nextStatus === 'acknowledged' ? 'Approved' : `Marked ${nextStatus}`, true);
            await load();
        } catch (err) {
            notify(err.message, false);
        }
    };

    /**
     * Sends the note on its own, deliberately without a `status`.
     *
     * The server reads an absent status as "leave it as it is", so a question on
     * an open report keeps it open and in the queue rather than quietly filing it
     * as reviewed.
     */
    const sendNote = async (report, adminNote) => {
        try {
            await lmApi.reviewBug(report._id, { adminNote });
            notify('Note sent to the reporter', true);
            await load();
        } catch (err) {
            notify(err.message, false);
        }
    };

    if (loading) {
        return <div style={{ padding: 32, color: theme.textMuted, fontSize: 12.5 }}>Loading…</div>;
    }

    if (error) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{
                    background: theme.dangerDim, color: theme.danger, fontSize: 12.5,
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px',
                    marginBottom: 12,
                }}>
                    {error.status === 401
                        ? 'Your session has expired. Sign in again to report a bug.'
                        : error.message || 'Could not load your reports.'}
                </div>
                <button className="dbr-btn dbr-btn--ghost" onClick={load}>Try again</button>
            </div>
        );
    }

    const history = mine.reports;

    return (
        <>
            <style>{CSS}</style>
            <div style={{
                padding: 'clamp(12px,2vw,20px)', maxWidth: 900,
                fontFamily: theme.fontBody, color: theme.text,
            }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>
                    Raise a Bug / Suggestion
                </h2>
                <p style={{ fontSize: 12.5, color: theme.textMuted, margin: '0 0 16px' }}>
                    Found something broken, or thought of something better? Tell us and we will look.
                </p>

                {/* Only platform admins see the second tab — everyone else just files. */}
                {queue && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                        <button
                            className={`dbr-tab ${tab === 'report' ? 'dbr-tab--on' : ''}`}
                            onClick={() => setTab('report')}
                        >
                            Bug / Suggestion
                        </button>
                        <button
                            className={`dbr-tab ${tab === 'queue' ? 'dbr-tab--on' : ''}`}
                            onClick={() => setTab('queue')}
                        >
                            Queue{queue.counts?.open ? ` (${queue.counts.open})` : ''}
                        </button>
                    </div>
                )}

                {tab === 'queue' && queue ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {Object.entries(queue.counts || {}).map(([status, count]) => (
                                <Pill key={status} style={STATUS_STYLE[status] || STATUS_STYLE.rejected}>
                                    {count} {status}
                                </Pill>
                            ))}
                        </div>
                        {queue.reports.length === 0 ? (
                            <div className="dbr-card" style={{ textAlign: 'center', padding: 32, color: theme.textMuted, fontSize: 12.5 }}>
                                <div style={{ fontSize: 26, marginBottom: 6 }}>🎉</div>
                                Nothing in the queue.
                            </div>
                        ) : (
                            queue.reports.map((report) => (
                                // Keyed on the review stamp as well as the id so the
                                // note box inside re-initialises from the server after
                                // a decision, rather than holding the text typed
                                // against the old verdict.
                                <QueueCard
                                    key={`${report._id}-${report.reviewedAt || ''}`}
                                    report={report}
                                    onDecide={decide}
                                    onSendNote={sendNote}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="dbr-card">
                            <ReportForm
                                classes={classes}
                                pointsPerReport={mine.pointsPerReport}
                                onSent={load}
                                notify={notify}
                            />
                        </div>

                        <div>
                            <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>
                                Your submissions
                            </h3>
                            {history.length === 0 ? (
                                <div className="dbr-card" style={{ textAlign: 'center', padding: 28, color: theme.textMuted, fontSize: 12.5 }}>
                                    <div style={{ fontSize: 24, marginBottom: 6 }}>🐛</div>
                                    Nothing sent yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {history.map((report) => {
                                        const kind = KIND_STYLE[report.kind] || KIND_STYLE.bug;
                                        const status = STATUS_STYLE[report.status] || STATUS_STYLE.open;
                                        return (
                                            <div key={report._id} className="dbr-card" style={{ padding: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                        <Pill style={kind}>{kind.label}</Pill>
                                                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{report.title}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        {report.awarded && (
                                                            <Pill style={{ color: theme.accent, bg: theme.accentDim }}>
                                                                +{mine.pointsPerReport}
                                                            </Pill>
                                                        )}
                                                        <Pill style={status}>{status.label}</Pill>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                                                    {formatWhen(report.created_at)}
                                                    {report.className ? ` · ${report.className}` : ''}
                                                </div>
                                                {report.adminNote && (
                                                    <div style={{
                                                        marginTop: 8, padding: '7px 11px', borderRadius: 7,
                                                        background: theme.accentDim, color: theme.text, fontSize: 11.5,
                                                    }}>
                                                        {report.adminNote}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <Toast toast={toast} />
        </>
    );
}
