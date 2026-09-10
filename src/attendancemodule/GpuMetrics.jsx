import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { theme } from './config';
import ServiceConsole from './ServiceConsole';
import GpuInventory from './GpuInventory';
import getEnvironment from '../getenvironment';

const HISTORY_LIMIT = 5000;
const HISTORY_MAX_POINTS = 2000;
const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 3000;
// Only the Node proxy — direct-to-Python fallback URLs used to live here,
// but that let anyone bypass Node's admin-only gate on this endpoint (GPU
// metrics are restricted to admin/iams-admin — see mlRoutes.js) by just
// hitting the Python service's port directly.
// Absolute, via getEnvironment() — not a bare '/api/...' path. On the web the
// two are equivalent because the app and the API share an origin, but inside
// the Capacitor shell the page is served from the local asset origin
// (xceed.learning.app), so a relative path never leaves the device: it returns
// the SPA's index.html and every card sits at "--" forever.
const apiUrl = getEnvironment();
const METRICS_URL = `${apiUrl}/api/v1/ml/gpu-metrics`;
const METRICS_HISTORY_URL = `${apiUrl}/api/v1/ml/gpu-metrics/history`;
const LOGS_URL = `${apiUrl}/api/v1/ml/logs`;
const RANGE_OPTIONS = [
  { id: 'live', label: 'Live' },
  { id: 'custom', label: 'Custom' },
];
const T = theme;

function asNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatValue(value, suffix = '') {
  const num = asNumber(value);
  return num === null ? '--' : `${num.toFixed(1)}${suffix}`;
}

function formatWhole(value, suffix = '') {
  const num = asNumber(value);
  return num === null ? '--' : `${Math.round(num)}${suffix}`;
}

function formatClock(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatAxisDate(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: '2-digit',
  });
}

function normalizeSample(sample) {
  const timestamp = new Date(sample?.timestamp).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const utilPercent = asNumber(sample.utilPercent);
  return {
    timestamp,
    utilPercent,
    utilPeakPercent: asNumber(sample.utilPeakPercent),
    utilSource: sample.utilSource || '',
    memPercent: asNumber(sample.memPercent),
    memUsedMiB: asNumber(sample.memUsedMiB),
    memTotalMiB: asNumber(sample.memTotalMiB),
    // memUsedMiB is the whole card, every process on it included. These name
    // our own share and everyone else's — see the "This service" card below.
    procMemUsedMiB: asNumber(sample.procMemUsedMiB),
    otherProcMemUsedMiB: asNumber(sample.otherProcMemUsedMiB),
    otherProcCount: asNumber(sample.otherProcCount),
    tempC: asNumber(sample.tempC),
    powerW: asNumber(sample.powerW),
    gpuIndex: asNumber(sample.gpuIndex),
    gpuName: sample.gpuName || '',
    gpuUuid: sample.gpuUuid || '',
    // Present only when the service is pinned to a MIG slice. Everything above
    // is then the slice's PARENT BOARD, because nvidia-smi publishes memory,
    // temperature and power per board and not per slice — so the header has to
    // name the slice or the page reads as if we owned the whole card.
    migInstanceUuid: sample.migInstanceUuid || '',
    migProfile: sample.migProfile || '',
    // Older samples predate the flag — infer so they do not all read "N/A".
    utilAvailable: sample.utilAvailable !== undefined && sample.utilAvailable !== null
      ? sample.utilAvailable !== false
      : utilPercent !== null,
    utilUnavailableReason: sample.utilUnavailableReason || '',
    available: sample.available !== false,
    error: sample.error || '',
  };
}

function describeGpu(sample) {
  if (!sample) return '';
  const index = asNumber(sample.gpuIndex);
  if (index === null && !sample.gpuName) return '';
  const label = index === null ? sample.gpuName : `GPU ${index}`;
  const board = sample.gpuName && index !== null ? `${label} — ${sample.gpuName}` : label;
  // On a slice, say so and say which: the figures on this page are the parent
  // board's, so "GPU 3 — NVIDIA H100 PCIe" on its own would claim a card that
  // is only partly ours.
  if (sample.migProfile) {
    return `${board} · MIG ${sample.migProfile} (this service holds one slice; card-wide figures below)`;
  }
  return board;
}

export default function GpuMetrics() {
  const [samples, setSamples] = useState([]);
  const [collector, setCollector] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('live');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const chartScrollerRef = useRef(null);
  const previousChartCountRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let interval = null;

    function appendSample(sample) {
      setSamples((previous) => {
        const existingIndex = previous.findIndex((item) => item.timestamp === sample.timestamp);
        if (existingIndex >= 0) {
          const next = [...previous];
          next[existingIndex] = sample;
          return next;
        }
        return [...previous, sample]
          .sort((left, right) => left.timestamp - right.timestamp)
          .slice(-HISTORY_LIMIT);
      });
    }

    async function loadHistory() {
      const response = await axios.get(METRICS_HISTORY_URL, {
        timeout: 10000,
        params: {
          from: new Date(Date.now() - HISTORY_WINDOW_MS).toISOString(),
          maxPoints: HISTORY_MAX_POINTS,
        },
      });
      if (!Array.isArray(response.data?.samples)) {
        throw new Error('GPU metrics history endpoint returned an invalid response');
      }

      const history = response.data.samples
        .map(normalizeSample)
        .filter(Boolean);
      if (!cancelled) {
        setSamples(history.slice(-HISTORY_LIMIT));
        // Collector state travels with the history payload. Without it an
        // empty graph is ambiguous: the backend sampler may be down, or its
        // database writes may be failing, and the live cards look healthy
        // either way because they come from memory rather than Mongo.
        setCollector(response.data);
      }
    }

    async function fetchLatestMetric() {
      try {
        const response = await axios.get(METRICS_URL, { timeout: 5000 });
        const sample = normalizeSample(response.data);
        if (!sample) {
          throw new Error('GPU metrics endpoint did not return JSON metrics');
        }
        if (cancelled) return;

        appendSample(sample);
        setError(sample.available ? '' : (sample.error || 'GPU metrics unavailable'));
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error
            || err.message
            || 'GPU metrics unavailable'
          );
        }
      }
    }

    async function startReadingBackendHistory() {
      try {
        await loadHistory();
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error
            || err.message
            || 'GPU metrics history unavailable'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      await fetchLatestMetric();
      if (!cancelled) interval = setInterval(fetchLatestMetric, POLL_MS);
    }

    void startReadingBackendHistory();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  const latest = samples[samples.length - 1];
  const gpuLabel = useMemo(() => describeGpu(latest), [latest]);
  const chartSamples = useMemo(() => {
    if (range === 'live') return samples;

    const startMs = customStart ? new Date(customStart).getTime() : Number.NEGATIVE_INFINITY;
    const endMs = customEnd ? new Date(customEnd).getTime() : Number.POSITIVE_INFINITY;
    return samples.filter((sample) => sample.timestamp >= startMs && sample.timestamp <= endMs);
  }, [customEnd, customStart, range, samples]);
  const chartWidth = Math.max(980, chartSamples.length * 34);

  // Auto-scale the Y axis to what is actually plotted. A bursty workload
  // averages into the low single digits, which is invisible against a fixed
  // 0-100 axis. The floor stays pinned at zero deliberately — these are
  // percentages, and a floating baseline would exaggerate small movements.
  // Single pass rather than Math.max(...values): history runs to 5000 points.
  const yAxisMax = useMemo(() => {
    let max = 0;
    for (const sample of chartSamples) {
      if (sample.utilPercent !== null && sample.utilPercent > max) max = sample.utilPercent;
      if (sample.utilPeakPercent !== null && sample.utilPeakPercent > max) max = sample.utilPeakPercent;
      if (sample.memPercent !== null && sample.memPercent > max) max = sample.memPercent;
    }
    if (max <= 0) return 5;

    const target = max * 1.15;
    const step = target <= 5 ? 1 : target <= 20 ? 5 : target <= 50 ? 10 : 20;
    return Math.min(100, Math.ceil(target / step) * step);
  }, [chartSamples]);

  const vramText = useMemo(() => {
    if (!latest?.memUsedMiB || !latest?.memTotalMiB) return '--';
    return `${Math.round(latest.memUsedMiB)} / ${Math.round(latest.memTotalMiB)} MiB`;
  }, [latest]);

  // Every figure from --query-gpu is device-wide, so on a shared card the
  // utilization line and the memory total describe this service PLUS whoever
  // else is resident. Say so explicitly rather than letting the page imply
  // that all of it is ours.
  const coTenancy = useMemo(() => {
    const others = asNumber(latest?.otherProcMemUsedMiB);
    const count = asNumber(latest?.otherProcCount);
    if (others === null || count === null || count < 1) return null;
    return {
      count,
      text: `${count} other process${count === 1 ? '' : 'es'} on this GPU `
        + `holding ${Math.round(others)} MiB — the card-wide figures below `
        + `include them.`,
    };
  }, [latest]);

  // Three distinct states, and "we did not measure it" must never render as
  // "nothing else is here" — an ML service predating the per-process split
  // sends null, and claiming sole occupancy on the strength of a missing
  // field is exactly the kind of false reassurance this panel is meant to end.
  const procDetail = useMemo(() => {
    if (asNumber(latest?.procMemUsedMiB) === null) return 'per-process split unavailable';
    if (coTenancy) return `card total ${formatWhole(latest?.memUsedMiB, ' MiB')}`;
    return 'sole process on this GPU';
  }, [latest, coTenancy]);

  useEffect(() => {
    if (range !== 'live' || !chartScrollerRef.current) return;

    const scroller = chartScrollerRef.current;
    const previousCount = previousChartCountRef.current;
    previousChartCountRef.current = chartSamples.length;

    const distanceFromEnd = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft;
    const shouldFollowLive = previousCount === 0 || distanceFromEnd < 120;
    if (!shouldFollowLive) return;

    requestAnimationFrame(() => {
      scroller.scrollTo({
        left: scroller.scrollWidth,
        behavior: 'smooth',
      });
    });
  }, [chartSamples.length, latest?.timestamp, range]);

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>GPU Metrics</h1>
          {/* The scheduler can hand this job a different card on each
              submission, so name the GPU actually being charted. */}
          {gpuLabel && <p style={styles.subtitle}>{gpuLabel}</p>}
        </div>
        <span
          style={{
            ...styles.status,
            color: error ? T.danger : T.success,
            background: error ? '#fef2f2' : '#ecfdf5',
            borderColor: error ? '#fecaca' : '#bbf7d0',
          }}
        >
          {loading ? 'Loading' : error ? 'Unavailable' : 'Live'}
        </span>
      </header>

      <section style={styles.statsGrid}>
        {/* A partitioned board publishes no board-level utilization. Say so
            explicitly — a bare "--" reads as a broken feed. Otherwise show the
            windowed mean with its peak, since this workload is bursty enough
            that the mean alone reads as "idle". */}
        <MetricCard
          label="GPU utilization"
          value={latest && !latest.utilAvailable ? 'N/A' : formatValue(latest?.utilPercent, '%')}
          detail={
            latest && !latest.utilAvailable
              ? 'Not reported for this GPU'
              : (asNumber(latest?.utilPeakPercent) !== null
                ? `peak ${formatValue(latest.utilPeakPercent, '%')}`
                : undefined)
          }
          title={latest?.utilUnavailableReason || undefined}
          accent="#0891b2"
        />
        {/* This service's OWN VRAM, from nvidia-smi's per-process list. The
            card-wide figures beside it cover every tenant, so this is the only
            number on the page that is unambiguously ours. */}
        <MetricCard
          label="This service"
          value={formatWhole(latest?.procMemUsedMiB, ' MiB')}
          detail={procDetail}
          title="VRAM held by this ML service alone"
          accent="#0d9488"
        />
        <MetricCard label="VRAM (card)" value={formatValue(latest?.memPercent, '%')} detail={vramText} accent="#7c3aed" />
        <MetricCard label="Temperature" value={formatValue(latest?.tempC, ' deg C')} accent="#ea580c" />
        <MetricCard label="Power draw" value={formatValue(latest?.powerW, ' W')} accent="#16a34a" />
        <MetricCard label="Memory used (card)" value={formatWhole(latest?.memUsedMiB, ' MiB')} accent="#2563eb" />
        <MetricCard label="Memory total" value={formatWhole(latest?.memTotalMiB, ' MiB')} accent="#475569" />
      </section>

      {coTenancy && <p style={styles.coTenancy}>{coTenancy.text}</p>}

      <section style={styles.controls}>
        <div style={styles.rangeButtons}>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              style={{
                ...styles.rangeButton,
                ...(range === option.id ? styles.rangeButtonActive : {}),
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {collector && <CollectorStatus collector={collector} />}
        {range === 'custom' && (
          <div style={styles.customControls}>
            <label style={styles.inputLabel}>
              From
              <input
                type="datetime-local"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                style={styles.input}
              />
            </label>
            <label style={styles.inputLabel}>
              To
              <input
                type="datetime-local"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                style={styles.input}
              />
            </label>
          </div>
        )}
      </section>

      <section style={styles.chartPanel}>
        {chartSamples.length ? (
          <>
            <div ref={chartScrollerRef} style={styles.chartScroller}>
              <div style={{ width: chartWidth, height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSamples} margin={{ top: 10, right: 20, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="timestamp"
                      height={44}
                      minTickGap={34}
                      tick={<DateTimeTick />}
                    />
                    <YAxis
                      domain={[0, yAxisMax]}
                      unit="%"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: T.textMuted }}
                    />
                    <Tooltip labelFormatter={(_, payload) => formatDateTime(payload?.[0]?.payload?.timestamp)} />
                    {/* Peak sits behind the mean: without it a bursty workload
                        looks idle, since ~2.6s of saturation averaged over the
                        sampling window is a single-digit mean. */}
                    <Line
                      type="monotone"
                      dataKey="utilPeakPercent"
                      name="GPU utilization (peak)"
                      stroke="#67e8f9"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="utilPercent"
                      name="GPU utilization"
                      stroke="#0891b2"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="memPercent"
                      name="VRAM"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={styles.fixedLegend}>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendLine, background: '#0891b2' }} />
                GPU utilization
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendLine, background: '#67e8f9' }} />
                Peak
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendLine, background: '#7c3aed' }} />
                VRAM
              </span>
            </div>
          </>
        ) : (
          <div style={styles.empty}>{error || 'No GPU samples in this time window'}</div>
        )}
      </section>

      <ServiceConsole
        title="ML Service Console"
        subtitle="Latest output from the Python service"
        logsUrl={LOGS_URL}
        defaultLoggerLabel="ml_service"
      />

      {/* The panel above is this service's own card. Everything below is
          the rest of the box — which cards are free, who else is on them,
          and the move onto a safer one. Kept last because it is the
          planning view, consulted when something has gone wrong. */}
      <GpuInventory />
    </main>
  );
}

// Distinguishes "the GPU is idle" from "nothing is being recorded" — the graph
// looks the same in both cases, but only one of them is a fault.
function CollectorStatus({ collector }) {
  const stored = asNumber(collector.persistedCount);
  const failures = asNumber(collector.persistFailureCount);

  let tone = T.textMuted;
  let text;
  if (collector.running === false) {
    tone = T.danger;
    text = 'Background collection is NOT running — the graph only covers this page visit.';
  } else if (collector.lastPersistError) {
    tone = T.danger;
    text = `Background collection is running but database writes are failing (${failures || 0} failed): ${collector.lastPersistError}`;
  } else {
    const since = collector.startedAt ? ` since ${formatClock(collector.startedAt)}` : '';
    text = `Background collection active${since} — ${stored ?? 0} samples stored, polling every ${Math.round((collector.pollMs || 0) / 1000)}s.`;
  }

  return <span style={{ ...styles.collectorNote, color: tone }}>{text}</span>;
}

function MetricCard({ label, value, detail, accent, title }) {
  return (
    <div style={{ ...styles.card, borderTopColor: accent }} title={title}>
      <div style={{ ...styles.value, color: accent }}>{value}</div>
      <div style={styles.label}>{label}</div>
      {detail && <div style={styles.detail}>{detail}</div>}
    </div>
  );
}

function DateTimeTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill={T.textMuted} fontSize={10} fontFamily={T.fontBody}>
        <tspan x="0" dy="10">{formatAxisDate(payload.value)}</tspan>
        <tspan x="0" dy="13">{formatClock(payload.value)}</tspan>
      </text>
    </g>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    padding: '26px',
    color: T.text,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: 0,
  },
  subtitle: {
    margin: '6px 0 0',
    color: T.textMuted,
    fontSize: 13,
  },
  // Shown only when another tenant holds memory on the same card, so it reads
  // as an advisory rather than permanent chrome.
  coTenancy: {
    margin: '12px 0 0',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    fontSize: 13,
  },
  status: {
    border: '1px solid',
    borderRadius: 7,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: '#ffffff',
    border: `1px solid ${T.border}`,
    borderTop: '3px solid',
    borderRadius: 8,
    padding: '16px 14px',
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
  },
  value: {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.1,
  },
  label: {
    marginTop: 8,
    color: T.textMuted,
    fontSize: 12,
    fontWeight: 600,
  },
  detail: {
    marginTop: 4,
    color: T.textMuted,
    fontSize: 11,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  rangeButtons: {
    display: 'inline-flex',
    gap: 2,
    padding: 4,
    background: '#eef0f8',
    borderRadius: 8,
  },
  rangeButton: {
    minWidth: 58,
    height: 32,
    border: 0,
    borderRadius: 6,
    background: 'transparent',
    color: T.textMuted,
    fontFamily: T.fontBody,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  rangeButtonActive: {
    background: '#ffffff',
    color: T.accent,
    boxShadow: '0 1px 4px rgba(26,31,60,0.12)',
  },
  collectorNote: {
    fontSize: 12,
    fontWeight: 600,
    flex: '1 1 240px',
  },
  customControls: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  inputLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: T.textMuted,
    fontSize: 12,
    fontWeight: 700,
  },
  input: {
    height: 32,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    padding: '0 8px',
    color: T.text,
    fontFamily: T.fontBody,
    fontSize: 12,
  },
  secondaryButton: {
    height: 34,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    background: '#ffffff',
    color: T.text,
    fontFamily: T.fontBody,
    fontSize: 12,
    fontWeight: 700,
    padding: '0 12px',
    cursor: 'pointer',
  },
  chartPanel: {
    height: 360,
    background: '#ffffff',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 14,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
  },
  chartScroller: {
    width: '100%',
    height: 'calc(100% - 34px)',
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollBehavior: 'smooth',
  },
  fixedLegend: {
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    color: T.text,
    fontSize: 13,
    fontWeight: 600,
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
  },
  legendLine: {
    width: 18,
    height: 3,
    borderRadius: 999,
    display: 'inline-block',
  },
  empty: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: T.textMuted,
    fontSize: 14,
  },
};
