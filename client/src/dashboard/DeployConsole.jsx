// client/src/dashboard/DeployConsole.jsx
// Merge a GitHub PR, pull, rebuild the React bundle and restart the Node
// server — on a button press. At /superadmin/deploy: this deploys the whole
// site, not one module, so it sits with the other platform-wide admin pages
// rather than under /attendance. (The styles come from the attendance
// module's config because that is where the ops-page look is defined.)
//
// Nothing here is automatic: no webhook, no deploy-on-push. The server only
// moves when someone presses the button on this page. The Python ML service
// on the H100 is never touched.
//
// The one thing that shapes this component: the server restarts itself
// partway through, so /status stops answering for a while. A failed poll is
// the expected middle of a successful deploy, not an error — the UI only
// gives up after RESTART_GRACE_MS of silence.

import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { styles, theme, cssReset } from '../attendancemodule/config';

const apiUrl = getEnvironment();
const DEPLOY_URL = `${apiUrl}/api/v1/deploy`;

const POLL_MS = 2000;
const IDLE_POLL_MS = 15000;
const RESTART_GRACE_MS = 3 * 60 * 1000;

export default function DeployConsole() {
    const [status, setStatus] = useState(null);
    const [pulls, setPulls] = useState([]);
    const [selectedPr, setSelectedPr] = useState('');
    const [skipClientBuild, setSkipClientBuild] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [unreachableSince, setUnreachableSince] = useState(null);

    const phase = status?.phase;
    const active = phase === 'running' || phase === 'restarting';

    const logRef = useRef(null);
    // Read by the polling effect without making it a dependency, so the
    // interval is not torn down and rebuilt on every status update.
    const activeRef = useRef(active);
    activeRef.current = active;

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${DEPLOY_URL}/status`);
            if (!res.ok) throw new Error(`status ${res.status}`);
            setStatus(await res.json());
            setUnreachableSince(null);
        } catch {
            // Expected while pm2 cycles the process. Only surfaced as a
            // failure once the grace window is gone.
            setUnreachableSince((prev) => prev ?? Date.now());
        }
    }, []);

    const fetchPulls = useCallback(async () => {
        try {
            const res = await fetch(`${DEPLOY_URL}/pulls`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || `status ${res.status}`);
            setPulls(data);
        } catch (err) {
            setError(`Could not load pull requests: ${err.message}`);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        fetchPulls();
    }, [fetchStatus, fetchPulls]);

    // Fast while a deploy runs, slow otherwise — so the page still notices a
    // deploy somebody else started, without polling hard all day.
    useEffect(() => {
        const id = setInterval(fetchStatus, active ? POLL_MS : IDLE_POLL_MS);
        return () => clearInterval(id);
    }, [fetchStatus, active]);

    // Follow the log while it grows.
    useEffect(() => {
        if (active && logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [status?.log, active]);

    const startDeploy = async () => {
        const what = selectedPr ? `merge PR #${selectedPr}, pull` : `pull ${status?.branch || 'main'}`;
        if (!window.confirm(
            `This will ${what}, reinstall, ${skipClientBuild ? 'skip the React build' : 'rebuild React'}, `
            + 'and restart the Node server.\n\nThe site will be briefly unavailable. Continue?'
        )) return;

        setBusy(true);
        setError('');
        try {
            const res = await fetch(`${DEPLOY_URL}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prNumber: selectedPr ? Number(selectedPr) : null,
                    skipClientBuild,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail ? `${data.message}\n${data.detail}` : data.message);
            setSelectedPr('');
            fetchStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const lostTooLong = unreachableSince && Date.now() - unreachableSince > RESTART_GRACE_MS;
    const canDeploy = status?.enabled && !active && !busy;

    return (
        <div style={styles.page}>
            <style>{cssReset}</style>

            <h1 style={styles.heading}>Pull &amp; Deploy</h1>
            <p style={styles.subheading}>
                Merge a pull request, pull {status?.branch || 'main'}, rebuild the React bundle and
                restart the Node server{status?.repo ? ` · ${status.repo}` : ''}
                {' · '}the ML service on the H100 is not touched
            </p>

            {status && !status.enabled && (
                <div style={{ ...styles.badge('warning'), marginBottom: '16px' }}>
                    Deploys are disabled on this server. Set DEPLOY_ENABLED=true in the server .env
                    and restart to enable them.
                </div>
            )}

            {error && (
                <div style={{ ...styles.badge('danger'), marginBottom: '16px', whiteSpace: 'pre-wrap' }}>
                    {error}
                </div>
            )}

            <div style={{ ...styles.card, marginBottom: '20px' }}>
                <div style={styles.sectionTitle}>Currently running</div>
                <div style={{ fontFamily: theme.fontMono, fontSize: '13px', lineHeight: 1.9 }}>
                    <div>{status?.currentCommit?.slice(0, 10) || '—'} · {status?.commitSubject || ''}</div>
                    <div style={{ color: theme.textMuted }}>
                        up since {formatTime(status?.processStartedAt)} · pid {status?.pid ?? '—'}
                    </div>
                </div>
            </div>

            <div style={{ ...styles.card, marginBottom: '20px' }}>
                <div style={styles.sectionTitle}>New deploy</div>

                <label style={styles.label} htmlFor="pr">Pull request to merge (optional)</label>
                <select
                    id="pr"
                    style={styles.select}
                    value={selectedPr}
                    disabled={!canDeploy}
                    onChange={(e) => setSelectedPr(e.target.value)}
                >
                    <option value="">— none: just pull {status?.branch || 'main'} as it is —</option>
                    {pulls.map((pr) => (
                        <option key={pr.number} value={pr.number} disabled={pr.fromFork}>
                            #{pr.number} · {pr.title} · @{pr.author}
                            {pr.draft ? ' (draft)' : ''}
                            {pr.fromFork ? ' — fork, merge on GitHub' : ''}
                        </option>
                    ))}
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0', fontSize: '13px' }}>
                    <input
                        type="checkbox"
                        checked={skipClientBuild}
                        disabled={!canDeploy}
                        onChange={(e) => setSkipClientBuild(e.target.checked)}
                    />
                    Skip the React rebuild — backend-only change, much faster
                </label>

                <button
                    style={{
                        ...styles.btnPrimary,
                        opacity: canDeploy ? 1 : 0.5,
                        cursor: canDeploy ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canDeploy}
                    onClick={startDeploy}
                >
                    {active ? 'Deploy in progress…' : busy ? 'Starting…' : 'Pull & Deploy'}
                </button>
                <button style={{ ...styles.btnGhost, marginLeft: '10px' }} onClick={fetchPulls} disabled={busy}>
                    Refresh PRs
                </button>
            </div>

            {phase && phase !== 'idle' && (
                <div style={styles.card}>
                    <div style={styles.sectionTitle}>
                        {PHASE_LABEL[phase] || phase}
                        {status.startedAt ? ` · started ${formatTime(status.startedAt)}` : ''}
                        {status.triggeredBy ? ` · by ${status.triggeredBy}` : ''}
                    </div>

                    {status.prNumber && (
                        <div style={{ ...styles.badge('info'), marginBottom: '12px' }}>
                            Merged PR #{status.prNumber}
                            {status.prTitle ? ` — ${status.prTitle}` : ''}
                        </div>
                    )}

                    {status.drain && status.drain !== 'no runs in flight' && (
                        <div style={{ ...styles.badge('warning'), marginBottom: '12px' }}>
                            Attendance scheduler: {status.drain}
                        </div>
                    )}

                    {phase === 'restarting' && (
                        <div style={{ ...styles.badge(lostTooLong ? 'danger' : 'warning'), marginBottom: '12px' }}>
                            {lostTooLong
                                ? 'The server has not come back after 3 minutes. It may be failing to '
                                  + 'start on the new code — check `pm2 logs` on the box.'
                                : 'The server is restarting. This page reconnects on its own; requests '
                                  + 'failing right now are expected.'}
                        </div>
                    )}

                    {phase === 'failed' && (
                        <div style={{ ...styles.badge('danger'), marginBottom: '12px' }}>
                            Failed at: {status.detail || 'unknown step'} — the server was never restarted
                            and is still running the previous code.
                        </div>
                    )}

                    {phase === 'success' && (
                        <div style={{ ...styles.badge('success'), marginBottom: '12px' }}>
                            Deployed and restarted on {status.detail?.slice(0, 10) || 'the new commit'}.
                        </div>
                    )}

                    <pre
                        ref={logRef}
                        style={{
                            margin: 0,
                            padding: '12px 14px',
                            background: theme.surfaceAlt,
                            borderRadius: '8px',
                            fontFamily: theme.fontMono,
                            fontSize: '12px',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: '420px',
                            overflow: 'auto',
                        }}
                    >
                        {status.log || 'Waiting for output…'}
                    </pre>
                </div>
            )}
        </div>
    );
}

const PHASE_LABEL = {
    running: 'Deploying…',
    restarting: 'Restarting…',
    success: 'Last deploy — succeeded',
    failed: 'Last deploy — failed',
};

function formatTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
}
