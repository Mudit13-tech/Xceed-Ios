import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { theme } from './config';
import getEnvironment from '../getenvironment';

// Every card on the ML host, not just the one this service holds.
//
// The panel above charts our own GPU, which is the right thing to chart and
// the wrong thing to plan with: on this shared 8xH100 box the job that killed
// a run was somebody else's, landing on the card PBS had given us. Answering
// "which card is actually free right now" meant SSH-ing in and reading
// nvidia-smi by hand. This is that output, plus the ranking the PBS submit
// script uses, plus a button that moves the service onto the winner.
//
// Figures here are instantaneous point samples — one nvidia-smi read per
// refresh — unlike the rolling window behind the chart above. That is fine for
// "is this card occupied", which is what it is for, and is why the panel says
// so at the bottom rather than implying these are averages.
// Absolute, via getEnvironment() — not a bare '/api/...' path. On the web the
// two are equivalent because the app and the API share an origin, but inside
// the Capacitor shell the page is served from the local asset origin
// (xceed.learning.app), so a relative path never leaves the device: it returns
// the SPA's index.html and the panel shows no cards at all.
const apiUrl = getEnvironment();
const INVENTORY_URL = `${apiUrl}/api/v1/ml/gpu-metrics/inventory`;
const SELECT_URL = `${apiUrl}/api/v1/ml/gpu-metrics/select`;
const HEALTH_URL = `${apiUrl}/api/v1/ml/health`;
// Slower than the 3s metric poll: each refresh shells out to nvidia-smi
// several times on a box that other tenants are also driving.
const AUTO_REFRESH_MS = 15000;
// How long to wait for the service to come back after a switch. A cold start
// reloads buffalo_l, AdaFace, RetinaFace and the FAISS index.
const RESTART_DEADLINE_MS = 4 * 60 * 1000;
const T = theme;

const STATUS_META = {
  free: { label: 'Free', color: '#047857', background: '#ecfdf5', border: '#a7f3d0' },
  shared: { label: 'Shared', color: '#92400e', background: '#fffbeb', border: '#fde68a' },
  full: { label: 'No headroom', color: '#b91c1c', background: '#fef2f2', border: '#fecaca' },
  partitioned: { label: 'MIG', color: '#4338ca', background: '#eef2ff', border: '#c7d2fe' },
  unknown: { label: 'Unknown', color: T.textMuted, background: T.surfaceAlt, border: T.border },
};

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// MiB for small figures, GiB once a card-sized number would be unreadable.
function formatMem(value) {
  const num = asNumber(value);
  if (num === null) return '--';
  if (num < 1024) return `${Math.round(num)} MiB`;
  return `${(num / 1024).toFixed(1)} GiB`;
}

function formatPercent(value) {
  const num = asNumber(value);
  return num === null ? 'N/A' : `${num.toFixed(0)}%`;
}

function gpuLabel(gpu) {
  if (!gpu) return '--';
  // A recommendation can now be a MIG slice, which the service names itself
  // ("MIG 3g.40gb on GPU 3") — a slice has no index of its own to build from.
  if (gpu.label) return gpu.label;
  const name = gpu.name ? ` ${gpu.name}` : '';
  return `GPU ${gpu.index}${name}`;
}

function describeProcesses(gpu) {
  if (gpu.otherProcCount === null || gpu.otherProcCount === undefined) {
    return 'unknown';
  }
  const total = (gpu.processes || []).length;
  if (!total) return 'none';
  const mine = (gpu.processes || []).some((p) => p.isOurs) ? ' (incl. ours)' : '';
  return `${total}${mine}`;
}

export default function GpuInventory() {
  const [inventory, setInventory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [switching, setSwitching] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await axios.get(INVENTORY_URL, { timeout: 20000 });
      if (!mountedRef.current) return;
      setInventory(response.data);
      setError(response.data?.available ? '' : (response.data?.error || 'GPU inventory unavailable'));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.response?.data?.error || err.message || 'GPU inventory unavailable');
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    // Paused while a switch is in flight: the service is mid-re-exec and every
    // poll would just be a connection error scrolling over the real status.
    if (!autoRefresh || switching) return undefined;
    const timer = setInterval(() => { void load(); }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, load, switching]);

  const gpus = useMemo(() => inventory?.gpus || [], [inventory]);
  const recommended = inventory?.recommended || null;
  const ownUuid = inventory?.ownGpuUuid || null;
  // When the service is pinned to a MIG slice, ownUuid above is the slice's
  // PARENT board (so the board row can be badged) and this is the slice.
  const ownMigUuid = inventory?.ownMigUuid || null;

  // The exports a PBS job needs to pin the same card on its next submission.
  // Both matter: CUDA_VISIBLE_DEVICES is what ONNX Runtime honours at model
  // load, GPU_METRICS_DEVICE is what the telemetry above reads, and a job that
  // sets only the first charts whichever card the driver enumerates first.
  const exportLines = useMemo(() => {
    if (!recommended?.uuid) return '';
    return `export CUDA_VISIBLE_DEVICES=${recommended.uuid}\n`
      + `export GPU_METRICS_DEVICE=${recommended.uuid}`;
  }, [recommended]);

  async function copyExports() {
    if (!exportLines) return;
    try {
      await navigator.clipboard.writeText(exportLines);
      setCopied('Copied — paste into the PBS job before starting ml_service.py.');
    } catch (_) {
      // Clipboard access is denied outside a secure context; the lines are on
      // screen anyway, so say that rather than failing silently.
      setCopied('Clipboard blocked — select the lines below and copy manually.');
    }
    setTimeout(() => mountedRef.current && setCopied(''), 6000);
  }

  // Moves the RUNNING service. The Python side re-execs itself, so this is an
  // outage for as long as the models take to reload — hence the confirm, and
  // hence polling /health afterwards instead of pretending it was instant.
  async function switchTo(device, label, options = {}) {
    const confirmed = window.confirm(
      `Move the ML service to ${label}?\n\n`
      + 'The service re-execs itself to pick up the new device: any attendance '
      + 'or acquisition run in progress is dropped, open cameras are released, '
      + 'and the service is unavailable while models reload (typically 30–90s).'
    );
    if (!confirmed) return;

    setSwitching(device);
    setNotice(`Switching to ${label}…`);
    try {
      const response = await axios.post(SELECT_URL, {
        device,
        restart: true,
        force: options.force === true,
      }, { timeout: 25000 });

      if (response.data?.status === 'unchanged') {
        setNotice(response.data.detail || 'Already on that GPU.');
        setSwitching('');
        return;
      }

      setNotice(`Re-execing on ${label} — waiting for the service to come back…`);
      // Let the process actually go down before polling, or the first probe
      // answers from the process that is about to die.
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const deadline = Date.now() + RESTART_DEADLINE_MS;
      while (Date.now() < deadline) {
        try {
          const health = await axios.get(HEALTH_URL, { timeout: 4000 });
          if (health.data?.status === 'ok') {
            if (!mountedRef.current) return;
            setNotice(
              `ML service is back on ${label}`
              + `${health.data.model_loaded ? ' with models loaded' : ' (models still loading)'}.`
            );
            setSwitching('');
            await load();
            return;
          }
        } catch (_) { /* still down — keep polling */ }
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
      if (!mountedRef.current) return;
      setNotice('Service did not come back within 4 minutes — check the ML machine and the PBS job.');
      setSwitching('');
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err.response?.data?.error || err.message || 'GPU switch failed';
      // 409 with a headroom complaint is the "every card is crowded" refusal —
      // offer the override rather than leaving the admin with a dead end.
      if (err.response?.status === 409 && /minimum/.test(message)) {
        setNotice(`${message}`);
      } else {
        setNotice(`Switch failed: ${message}`);
      }
      setSwitching('');
    }
  }

  const recommendedStatus = recommended?.sufficient === false ? 'full' : (recommended?.status || 'unknown');
  const recommendedMeta = STATUS_META[recommendedStatus] || STATUS_META.unknown;

  return (
    <section style={styles.panel}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>All GPUs on this node</h2>
          <p style={styles.subtitle}>
            {inventory?.hostname ? `${inventory.hostname} — ` : ''}
            {gpus.length ? `${gpus.length} device${gpus.length === 1 ? '' : 's'}` : 'nvidia-smi'}
            {inventory?.driverVersion ? ` — driver ${inventory.driverVersion}` : ''}
            {inventory?.selectionSource ? ` — pinned via ${inventory.selectionSource}` : ''}
          </p>
        </div>
        <div style={styles.headerActions}>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            Auto ({Math.round(AUTO_REFRESH_MS / 1000)}s)
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing || !!switching}
            style={styles.button}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <p style={styles.errorBox}>{error}</p>}
      {notice && <p style={styles.noticeBox}>{notice}</p>}

      {/* The ranking, stated as a claim with its reason attached. A bare
          "best GPU" badge would be untrustworthy — an admin about to take an
          outage needs to see WHY this card won. */}
      {recommended && (
        <div style={{ ...styles.recommendation, borderColor: recommendedMeta.border, background: recommendedMeta.background }}>
          <div style={styles.recommendationBody}>
            <div style={styles.recommendationHead}>
              <span style={{ ...styles.recommendationTitle, color: recommendedMeta.color }}>
                {recommended.sufficient === false ? 'No card has real headroom' : 'Best available now'}
                {': '}
                {gpuLabel(recommended)}
              </span>
              {recommended.isCurrent && <span style={styles.currentChip}>already in use by this service</span>}
            </div>
            {/* A slice and a card do not describe the same way: a slice has a
                dedicated size rather than a free reading, publishes no
                board-level utilization at all, and its co-tenants sit on the
                parent board rather than in its own memory. */}
            <p style={styles.recommendationDetail}>
              {recommended.exclusive
                ? `${formatMem(recommended.totalMiB)} dedicated to this slice`
                : `${formatMem(recommended.freeMiB)} free of ${formatMem(recommended.totalMiB)}`}
              {!recommended.exclusive && `${' · '}utilization ${formatPercent(recommended.utilPercent)}`}
              {' · '}
              {recommended.otherProcCount
                ? `${recommended.otherProcCount} other process(es) ${recommended.exclusive ? 'on the parent board' : 'resident'}`
                : 'no other process resident'}
            </p>
            <p style={styles.recommendationReason}>{recommended.reason}</p>
          </div>
          <div style={styles.recommendationActions}>
            {!recommended.isCurrent && (
              <button
                type="button"
                onClick={() => void switchTo('auto', gpuLabel(recommended), { force: recommended.sufficient === false })}
                disabled={!!switching}
                style={{
                  ...styles.button,
                  ...styles.primaryButton,
                  ...(inventory?.switchAdvised ? {} : styles.mutedPrimary),
                }}
                title={
                  inventory?.switchAdvised
                    ? 'Re-exec the ML service pinned to this card'
                    : 'The current card is healthy — switching costs an outage for little gain'
                }
              >
                {switching ? 'Switching…' : 'Move service here'}
              </button>
            )}
            <button type="button" onClick={() => void copyExports()} style={styles.button}>
              Copy export lines
            </button>
          </div>
        </div>
      )}

      {exportLines && (
        <div style={styles.exportBlock}>
          <code style={styles.exportCode}>{exportLines}</code>
          {copied && <span style={styles.copiedNote}>{copied}</span>}
        </div>
      )}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Device</th>
              <th style={styles.th}>Status</th>
              <th style={styles.thNum}>Util</th>
              <th style={styles.th}>VRAM</th>
              <th style={styles.thNum}>Free</th>
              <th style={styles.thNum}>Temp</th>
              <th style={styles.thNum}>Power</th>
              <th style={styles.thNum}>Procs</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {gpus.map((gpu) => {
              const meta = STATUS_META[gpu.status] || STATUS_META.unknown;
              const isOurs = gpu.uuid && gpu.uuid === ownUuid;
              // A recommended MIG slice belongs to one of these boards, so the
              // board it sits on is what gets highlighted — matching only on
              // gpu.uuid left the whole table unmarked whenever the best
              // device was a slice.
              const isBest = !!recommended && (
                gpu.uuid === recommended.uuid
                || (recommended.kind === 'mig'
                    && (gpu.migDevices || []).some((i) => i.uuid === recommended.uuid))
              );
              const usedFraction = asNumber(gpu.memPercent) === null ? 0 : Math.min(100, gpu.memPercent);
              const rowOpen = expanded === gpu.uuid;

              return (
                <Fragment key={gpu.uuid || gpu.index}>
                  <tr
                    style={{
                      ...styles.tr,
                      background: isOurs ? 'rgba(99,102,241,0.06)' : (isBest ? 'rgba(16,185,129,0.05)' : 'transparent'),
                    }}
                  >
                    <td style={styles.td}>
                      <div style={styles.deviceCell}>
                        <span style={styles.deviceName}>{gpuLabel(gpu)}</span>
                        {isOurs && <span style={styles.oursChip}>this service</span>}
                        {gpu.computeMode && gpu.computeMode !== 'Default' && (
                          <span style={styles.modeChip} title="nvidia-smi compute mode">{gpu.computeMode}</span>
                        )}
                      </div>
                      <div style={styles.uuid} title={gpu.uuid || ''}>{gpu.uuid || '--'}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.statusPill, color: meta.color, background: meta.background, borderColor: meta.border }}>
                        {meta.label}
                      </span>
                    </td>
                    {/* A partitioned board publishes no board-level
                        utilization — "N/A" is the truth there, not a gap. */}
                    <td style={styles.tdNum}>{formatPercent(gpu.utilPercent)}</td>
                    <td style={styles.td}>
                      <div style={styles.barTrack}>
                        <div
                          style={{
                            ...styles.barFill,
                            width: `${usedFraction}%`,
                            background: usedFraction > 85 ? T.danger : usedFraction > 50 ? T.warning : T.success,
                          }}
                        />
                      </div>
                      <div style={styles.barLabel}>
                        {formatMem(gpu.memUsedMiB)} / {formatMem(gpu.memTotalMiB)}
                      </div>
                    </td>
                    <td style={styles.tdNum}>{formatMem(gpu.memFreeMiB)}</td>
                    <td style={styles.tdNum}>{asNumber(gpu.tempC) === null ? '--' : `${Math.round(gpu.tempC)} °C`}</td>
                    <td style={styles.tdNum}>
                      {asNumber(gpu.powerW) === null ? '--' : `${Math.round(gpu.powerW)} W`}
                      {asNumber(gpu.powerLimitW) !== null && (
                        <span style={styles.powerLimit}> / {Math.round(gpu.powerLimitW)}</span>
                      )}
                    </td>
                    <td style={styles.tdNum}>
                      <button
                        type="button"
                        onClick={() => setExpanded(rowOpen ? null : gpu.uuid)}
                        style={styles.linkButton}
                        title="Show the processes holding memory on this card"
                      >
                        {describeProcesses(gpu)}
                      </button>
                    </td>
                    <td style={styles.td}>
                      {!gpu.migEnabled && !isOurs && (
                        <button
                          type="button"
                          onClick={() => void switchTo(gpu.uuid, gpuLabel(gpu), { force: true })}
                          disabled={!!switching}
                          style={styles.smallButton}
                          title="Re-exec the ML service pinned to this card"
                        >
                          Use this
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Who is on the card. This is the whole diagnostic for the
                      crash that started this panel: our own PID is labelled,
                      so a co-tenant is unmistakable. */}
                  {rowOpen && (
                    <tr>
                      <td colSpan={9} style={styles.expandedCell}>
                        {(gpu.processes || []).length ? (
                          <ul style={styles.processList}>
                            {gpu.processes.map((proc) => (
                              <li key={`${gpu.uuid}-${proc.pid}`} style={styles.processItem}>
                                <span style={styles.processPid}>PID {proc.pid}</span>
                                <span style={styles.processMem}>{formatMem(proc.usedMiB)}</span>
                                <span style={styles.processName}>{proc.name || 'unknown process'}</span>
                                {proc.isOurs && <span style={styles.oursChip}>ours</span>}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span style={styles.processEmpty}>
                            {inventory?.processListAvailable === false
                              ? 'nvidia-smi would not list processes on this host — co-tenancy is unknown, not absent.'
                              : 'No process is holding memory on this card.'}
                          </span>
                        )}
                        {(gpu.migDevices || []).length > 0 && (
                          <div style={styles.migBlock}>
                            <div style={styles.migTitle}>
                              MIG instances (the schedulable units on this board) — each slice&apos;s
                              memory is partitioned in hardware, so once allotted no other tenant
                              can allocate out of it
                            </div>
                            {gpu.migDevices.map((instance) => {
                              // ownMigUuid, not ownUuid: a slice UUID never equals a board
                              // UUID, so the board carries "this service" and the slice has
                              // to be marked separately or every sibling looks equally ours.
                              const sliceIsOurs = instance.uuid && instance.uuid === ownMigUuid;
                              return (
                                <div key={instance.uuid} style={styles.migRow}>
                                  <span style={styles.migProfile}>{instance.profile}</span>
                                  <span style={styles.uuid}>{instance.uuid}</span>
                                  {sliceIsOurs && <span style={styles.oursChip}>ours</span>}
                                  {!sliceIsOurs && (
                                    <button
                                      type="button"
                                      onClick={() => void switchTo(instance.uuid, `MIG ${instance.profile} on GPU ${gpu.index}`, { force: true })}
                                      disabled={!!switching}
                                      style={styles.smallButton}
                                    >
                                      Use this slice
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {!gpus.length && (
              <tr>
                <td colSpan={9} style={styles.emptyCell}>
                  {loading ? 'Reading nvidia-smi on the ML host…' : (error || 'No GPUs reported on this node')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p style={styles.footnote}>
        Point samples straight from nvidia-smi at each refresh — not the rolling
        average charted above, which covers only this service&apos;s own card.
        {inventory?.minFreeMiB !== undefined && inventory?.minFreeMiB !== null && (
          <> A card counts as usable at {formatMem(inventory.minFreeMiB)} free and idle
          below {inventory.idleUtilPercent}% utilization; a switch is only advised
          when it gains at least {formatMem(inventory.switchMarginMiB)}.</>
        )}
        {inventory?.processListAvailable === false
          && ' nvidia-smi refused the process query on this host, so per-process figures are unknown rather than zero.'}
      </p>
    </section>
  );
}

const styles = {
  panel: {
    marginTop: 18,
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 16,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: T.text,
  },
  subtitle: {
    margin: '4px 0 0',
    color: T.textMuted,
    fontSize: 12,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: T.textMuted,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  button: {
    height: 32,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    background: T.surface,
    color: T.text,
    fontFamily: T.fontBody,
    fontSize: 12,
    fontWeight: 700,
    padding: '0 12px',
    cursor: 'pointer',
  },
  primaryButton: {
    background: T.accent,
    borderColor: T.accent,
    color: T.accentText,
  },
  // The recommendation is real but not urgent when the current card is fine —
  // the button stays available and stops shouting.
  mutedPrimary: {
    background: T.surface,
    borderColor: T.border,
    color: T.text,
  },
  smallButton: {
    height: 26,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    background: T.surface,
    color: T.text,
    fontFamily: T.fontBody,
    fontSize: 11,
    fontWeight: 700,
    padding: '0 8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  linkButton: {
    border: 0,
    background: 'transparent',
    color: T.accent,
    fontFamily: T.fontBody,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    padding: 0,
  },
  errorBox: {
    margin: '0 0 12px',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: 13,
  },
  noticeBox: {
    margin: '0 0 12px',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: T.surfaceAlt,
    color: T.text,
    fontSize: 13,
    fontWeight: 600,
  },
  recommendation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    border: '1px solid',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 12,
  },
  recommendationBody: {
    flex: '1 1 320px',
  },
  recommendationHead: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: 800,
  },
  recommendationDetail: {
    margin: '6px 0 0',
    color: T.text,
    fontSize: 12,
    fontWeight: 600,
  },
  recommendationReason: {
    margin: '4px 0 0',
    color: T.textMuted,
    fontSize: 12,
  },
  recommendationActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  currentChip: {
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    background: T.surface,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
  },
  exportBlock: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    background: T.surfaceAlt,
    padding: '10px 12px',
    marginBottom: 12,
  },
  exportCode: {
    fontFamily: T.fontMono,
    fontSize: 11.5,
    color: T.text,
    whiteSpace: 'pre',
    overflowX: 'auto',
  },
  copiedNote: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: 600,
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: `1px solid ${T.border}`,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    whiteSpace: 'nowrap',
  },
  thNum: {
    textAlign: 'right',
    padding: '8px 10px',
    borderBottom: `1px solid ${T.border}`,
    color: T.textMuted,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: `1px solid ${T.border}`,
  },
  td: {
    padding: '10px',
    verticalAlign: 'middle',
    color: T.text,
  },
  tdNum: {
    padding: '10px',
    textAlign: 'right',
    verticalAlign: 'middle',
    color: T.text,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  deviceCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deviceName: {
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  uuid: {
    marginTop: 2,
    color: T.textMuted,
    fontFamily: T.fontMono,
    fontSize: 10,
    maxWidth: 240,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  oursChip: {
    border: `1px solid ${T.accent}`,
    borderRadius: 999,
    background: T.accentDim,
    color: T.accent,
    fontSize: 10,
    fontWeight: 800,
    padding: '1px 7px',
    whiteSpace: 'nowrap',
  },
  modeChip: {
    border: `1px solid ${T.border}`,
    borderRadius: 999,
    background: T.surfaceAlt,
    color: T.textMuted,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 7px',
    whiteSpace: 'nowrap',
  },
  statusPill: {
    display: 'inline-block',
    border: '1px solid',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    padding: '2px 9px',
    whiteSpace: 'nowrap',
  },
  barTrack: {
    width: 130,
    height: 6,
    borderRadius: 999,
    background: T.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  barLabel: {
    marginTop: 4,
    color: T.textMuted,
    fontSize: 11,
    whiteSpace: 'nowrap',
  },
  powerLimit: {
    color: T.textMuted,
  },
  expandedCell: {
    padding: '10px 12px 14px',
    background: T.surfaceAlt,
    borderBottom: `1px solid ${T.border}`,
  },
  processList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  processItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
  },
  processPid: {
    fontFamily: T.fontMono,
    fontSize: 11,
    color: T.text,
    minWidth: 84,
  },
  processMem: {
    fontWeight: 700,
    minWidth: 78,
    textAlign: 'right',
  },
  processName: {
    color: T.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  processEmpty: {
    color: T.textMuted,
    fontSize: 12,
  },
  migBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${T.border}`,
  },
  migTitle: {
    color: T.textMuted,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  migRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  migProfile: {
    fontWeight: 700,
    fontSize: 12,
    minWidth: 70,
  },
  emptyCell: {
    padding: '22px 10px',
    textAlign: 'center',
    color: T.textMuted,
    fontSize: 13,
  },
  footnote: {
    margin: '12px 0 0',
    color: T.textMuted,
    fontSize: 11,
    lineHeight: 1.55,
  },
};
