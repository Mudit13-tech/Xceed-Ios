// client/src/dashboard/MlDeployCard.jsx
// The GPU box's half of /superadmin/deploy: ship this server's copy of
// python-ml-service/ to the H100 and restart the service there.
//
// A separate card, and a separate button, on purpose. "Pull & Deploy" above
// runs for a frontend typo; this cycles a service holding model weights and
// open RTSP sessions, and the two should never ride along together. What this
// replaces is not the deploy button — it is the scp somebody had to do from
// their laptop, which is also why the H100 could drift away from the repo
// without anyone being able to tell.
//
// Which is the other thing this card exists to show: "in sync" compares the
// commit the GPU box was deployed from against the one this server has checked
// out. Before /deploy existed there was no answer to that question at all.

import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { styles, theme } from '../attendancemodule/config';

const apiUrl = getEnvironment();
const ML_URL = `${apiUrl}/api/v1/deploy/ml`;

const POLL_MS = 3000;
const IDLE_POLL_MS = 20000;
// A cold start loads InsightFace, the FAISS index and whichever optional ONNX
// models are present, so a slow return is normal. Past this it is not slow,
// it is dead.
const RESTART_GRACE_MS = 5 * 60 * 1000;

export default function MlDeployCard() {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [installRequirements, setInstallRequirements] = useState(false);
    // Set the moment a restart is asked for and cleared when a process with a
    // different start time answers. The service cannot report its own re-exec
    // — it stops existing partway through — so "restarting" has to be tracked
    // from this side, exactly as the Node deploy tracks it across pm2.
    const [restartingSince, setRestartingSince] = useState(null);
    // started_at, NOT pid. The restart is an os.execv, which replaces the
    // process image but keeps the same PID — that is the whole reason it is
    // safe on a PBS box, since the job dies with the pid. So the pid is
    // identical either side of a restart and watching it would leave this card
    // saying "Restarting…" forever. _PROCESS_STARTED_AT is re-evaluated when
    // the module is imported again, so it is the field that actually moves.
    const preRestartStartedAt = useRef(null);

    const restarting = restartingSince !== null;
    const [now, setNow] = useState(Date.now());
    const restartTakingTooLong = restarting && now - restartingSince > RESTART_GRACE_MS;

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${ML_URL}/status`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || `status ${res.status}`);
            setStatus(data);
            // A service reporting a start time later than the one it had when
            // the push went out is the restart having completed.
            if (data.health?.started_at
                && preRestartStartedAt.current
                && data.health.started_at !== preRestartStartedAt.current) {
                setRestartingSince(null);
                preRestartStartedAt.current = null;
            }
        } catch (err) {
            setError(`Could not read the ML service status: ${err.message}`);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    useEffect(() => {
        const id = setInterval(() => {
            setNow(Date.now());
            fetchStatus();
        }, restarting ? POLL_MS : IDLE_POLL_MS);
        return () => clearInterval(id);
    }, [fetchStatus, restarting]);

    const send = async (force) => {
        setBusy(true);
        setError('');
        preRestartStartedAt.current = status?.health?.started_at || null;
        try {
            const res = await fetch(`${ML_URL}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ installRequirements, force }),
            });
            const data = await res.json();

            // The one refusal worth a second chance rather than an error: an
            // attendance check is running and the admin may still mean it.
            if (res.status === 409 && data.camerasOpen) {
                if (window.confirm(
                    `${data.message}\n\nRestarting now drops those runs and releases the cameras `
                    + 'mid-period.\n\nRestart anyway?'
                )) {
                    setBusy(false);
                    return send(true);
                }
                setBusy(false);
                return;
            }

            if (!res.ok) throw new Error(data.detail ? `${data.message}\n\n${data.detail}` : data.message);
            setRestartingSince(Date.now());
        } catch (err) {
            setError(err.message);
            preRestartStartedAt.current = null;
        } finally {
            setBusy(false);
        }
    };

    const start = () => {
        if (!window.confirm(
            'This copies this server\'s python-ml-service/ to the GPU box and restarts the ML '
            + 'service there.\n\n'
            + (installRequirements ? 'Requirements will be reinstalled first, which can take minutes.\n\n' : '')
            + 'Face recognition and live attendance are unavailable while it reloads its models. Continue?'
        )) return;
        send(false);
    };

    const health = status?.health;
    const deploy = status?.deploy;
    const canDeploy = status?.enabled && !busy && !restarting && !status?.unreachable;

    return (
        <div style={{ ...styles.card, marginBottom: '20px' }}>
            <div style={styles.sectionTitle}>ML service · GPU box</div>

            <div style={{ fontFamily: theme.fontMono, fontSize: '13px', lineHeight: 1.9, marginBottom: '14px' }}>
                <div style={{ color: theme.textMuted }}>{status?.mlUrl || '—'}</div>
                {status?.unreachable ? (
                    <div style={{ color: theme.textMuted }}>not answering — {status.unreachable}</div>
                ) : (
                    <>
                        <div>
                            deployed {status?.deployedSha?.slice(0, 10) || 'by hand — unknown commit'}
                            {' · '}this server {status?.repoCommit?.slice(0, 10) || '—'}
                        </div>
                        <div style={{ color: theme.textMuted }}>
                            pid {health?.pid ?? '—'}
                            {' · '}up {formatUptime(health?.uptime_sec)}
                            {' · '}{health?.cameras_open ?? 0} camera(s) open
                            {' · '}{health?.students_enrolled ?? 0} enrolled
                        </div>
                        {/* Captures the service is holding because their reader
                            thread never came back. Each one keeps a viewer slot
                            on its camera, so rooms start failing to connect —
                            and the only fix from out here is a restart. Shown
                            only when non-zero, because on a healthy
                            service it never is. */}
                        {health?.cameras_parked > 0 && (
                            <div style={{ color: theme.warning }}>
                                {health.cameras_parked} camera(s) held by a stuck
                                reader — restart the service when a check window
                                allows
                            </div>
                        )}
                    </>
                )}
            </div>

            {status && !status.unreachable && status.inSync === true && (
                <div style={{ ...styles.badge('success'), marginBottom: '12px' }}>
                    The GPU box is running the same commit as this server.
                </div>
            )}

            {status && !status.unreachable && status.inSync === false && (
                <div style={{ ...styles.badge('warning'), marginBottom: '12px' }}>
                    The GPU box is on a different commit from this server — push to bring it up to date.
                </div>
            )}

            {status && !status.unreachable && status.inSync === null && (
                <div style={{ ...styles.badge('info'), marginBottom: '12px' }}>
                    The GPU box has never been deployed through this button, so what it is running
                    cannot be checked against the repo. Pushing once fixes that.
                </div>
            )}

            {deploy?.phase === 'unsupported' && (
                <div style={{ ...styles.badge('warning'), marginBottom: '12px' }}>{deploy.detail}</div>
            )}

            {deploy?.phase === 'failed' && !restarting && (
                <div style={{ ...styles.badge('danger'), marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                    Last push failed: {deploy.detail}
                    {'\n'}Nothing was restarted — the service is still running the source it had.
                </div>
            )}

            {deploy?.phase === 'success' && !restarting && (
                <div style={{ ...styles.badge('success'), marginBottom: '12px' }}>
                    Last push deployed {deploy.deployedSha?.slice(0, 10) || 'the new source'}
                    {deploy.filesWritten ? ` · ${deploy.filesWritten} files` : ''}.
                </div>
            )}

            {restarting && !restartTakingTooLong && (
                <div style={{ ...styles.badge('warning'), marginBottom: '12px' }}>
                    Restarting and reloading models. This takes a minute or two, and attendance
                    checks will fail until it is back.
                </div>
            )}

            {/* The failure this design cannot rule out: the pushed source is
                syntactically fine but cannot import, so the process dies on the
                way up — and it is a PBS job, so the job dies with it and no
                button can bring it back. Say that plainly rather than spinning,
                because the next step is SSH and a qsub. */}
            {restarting && restartTakingTooLong && (
                <div style={{ ...styles.badge('danger'), marginBottom: '12px' }}>
                    The ML service has not come back after {Math.round(RESTART_GRACE_MS / 60000)} minutes.
                    If the new source cannot import, the process died on startup and its PBS job
                    died with it — that needs SSH and a fresh <code>qsub</code>. The source it
                    replaced is on the box in <code>python-ml-service/.ml-deploy-backup/</code>.
                </div>
            )}

            {status && !status.enabled && (
                <div style={{ ...styles.badge('warning'), marginBottom: '12px' }}>
                    Deploys are disabled on this server (DEPLOY_ENABLED). The GPU box also needs
                    ML_DEPLOY_ENABLED=true in its own environment.
                </div>
            )}

            {error && (
                <div style={{ ...styles.badge('danger'), marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                    {error}
                </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 16px', fontSize: '13px' }}>
                <input
                    type="checkbox"
                    checked={installRequirements}
                    disabled={!canDeploy}
                    onChange={(e) => setInstallRequirements(e.target.checked)}
                />
                Reinstall requirements first — only when requirements.txt changed, and slow
            </label>

            <button
                style={{
                    ...styles.btnPrimary,
                    opacity: canDeploy ? 1 : 0.5,
                    cursor: canDeploy ? 'pointer' : 'not-allowed',
                }}
                disabled={!canDeploy}
                onClick={start}
            >
                {restarting ? 'Restarting…' : busy ? 'Sending…' : 'Push & Restart ML'}
            </button>
            <button style={{ ...styles.btnGhost, marginLeft: '10px' }} onClick={fetchStatus} disabled={busy}>
                Refresh
            </button>
        </div>
    );
}

function formatUptime(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    if (seconds < 90) return `${Math.round(seconds)}s`;
    if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}
