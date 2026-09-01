// client/src/attendancemodule/ServerMetricsPanel.jsx
// Rendered above the log stream on the Node server console.

import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { theme } from './config';

const apiUrl = getEnvironment();
const METRICS_URL = `${apiUrl}/api/v1/attendancemodule/health/metrics`;

/**
 * Bandwidth and load, next to the log that produced it.
 *
 * The console already answers "what did the server say". This answers "and was it
 * struggling while it said it", which the log cannot: a process whose event loop
 * is blocked for two seconds at a time prints nothing unusual, and looks to every
 * user exactly like the network being slow.
 *
 * ## Why the numbers are grouped the way they are
 *
 * The verdict line comes first, in words, because at 2 a.m. nobody remembers what
 * a healthy event-loop lag is. Then the four numbers that most often explain a
 * complaint — throughput, bandwidth, response time, errors — then the two that
 * explain *why* — event loop and CPU/memory. Slow requests come last because they
 * are what you read once the summary has told you there is something to look for.
 *
 * ## Polling, not streaming
 *
 * Deliberately a poll every two seconds rather than a subscription. The health SSE
 * stream carries these too, for the status pill, but this page is opened
 * *because* something looks wrong — and an SSE connection that has already gone
 * sideways is the worst possible transport for the diagnostic that would tell you
 * so. A plain fetch either returns or visibly fails.
 */

/** Bytes as a human reads them. */
const bytes = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '—';
  if (value < 1024) return `${value} B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let scaled = value / 1024;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)} ${units[unit]}`;
};

const duration = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
};

const ms = (n) => (n === null || n === undefined ? '—' : `${n} ms`);

const VERDICT = {
  healthy: { label: 'Healthy', colour: theme.success, dim: theme.successDim },
  busy: { label: 'Busy', colour: theme.warning, dim: theme.warningDim },
  struggling: { label: 'Struggling', colour: theme.danger, dim: theme.dangerDim },
};

function Tile({ label, value, sub, tone }) {
  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${tone ? tone : theme.border}`,
        borderRadius: '10px',
        padding: '12px 14px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '10.5px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '19px',
          fontWeight: 600,
          fontFamily: theme.fontMono,
          color: tone || theme.text,
          marginTop: '3px',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

/**
 * Traffic over the last two minutes.
 *
 * Drawn as bars from the per-second history rather than as a smoothed line: the
 * shape worth seeing is a spike, and smoothing is precisely what hides one. Scaled
 * to the window's own maximum with the peak labelled, because an axis fixed to a
 * guess makes normal traffic invisible on a quiet server and flat-tops it on a
 * busy one.
 */
function Sparkline({ history, field, colour, label, format }) {
  const values = (history || []).map((h) => h[field] || 0);
  const peak = Math.max(...values, 1);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '10.5px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        <span style={{ fontSize: '10.5px', color: theme.textMuted, fontFamily: theme.fontMono }}>
          peak {format(peak)}/s
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px',
          height: '44px',
          background: theme.surfaceAlt,
          borderRadius: '6px',
          padding: '3px',
          overflow: 'hidden',
        }}
      >
        {values.map((v, i) => (
          <div
            key={i}
            title={`${format(v)}/s`}
            style={{
              flex: '1 1 0',
              minWidth: 0,
              // A floor of 1px so an idle second is still a visible tick — a gap
              // in the chart reads as missing data rather than as no traffic.
              height: `${Math.max(1, Math.round((v / peak) * 38))}px`,
              background: v > 0 ? colour : theme.border,
              borderRadius: '1px',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ServerMetricsPanel() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(METRICS_URL, { credentials: 'include' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      setMetrics(await response.json());
      setError(null);
    } catch (err) {
      // Shown rather than swallowed: failing to reach the metrics endpoint is
      // itself a finding on a page whose whole purpose is "is the server all
      // right", and a stale chart with no warning would be read as "fine".
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    if (paused) return undefined;
    timer.current = setInterval(load, 2000);
    return () => clearInterval(timer.current);
  }, [load, paused]);

  if (error && !metrics) {
    return (
      <div
        style={{
          background: theme.dangerDim,
          border: `1px solid ${theme.danger}`,
          borderRadius: '12px',
          padding: '16px 18px',
          marginBottom: '18px',
          color: theme.text,
        }}
      >
        <strong>Cannot read server metrics.</strong>{' '}
        <span style={{ fontFamily: theme.fontMono, fontSize: '13px' }}>{error}</span>
        <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '6px' }}>
          If the log below is also empty the process may be down or unreachable. If the log is
          updating, the request is being refused rather than the server being unwell — this endpoint
          needs attendance-module access.
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ color: theme.textMuted, fontSize: '13px', marginBottom: '18px' }}>
        Reading server metrics…
      </div>
    );
  }

  const v = VERDICT[metrics.verdict.state] || VERDICT.busy;
  const minute = metrics.lastMinute;
  const loop = metrics.eventLoop;

  return (
    <div style={{ marginBottom: '22px' }}>
      {/* The verdict, in words. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: v.dim,
          border: `1px solid ${v.colour}`,
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            background: v.colour,
            color: '#fff',
            borderRadius: '999px',
            padding: '3px 12px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {v.label}
        </span>
        <span style={{ fontSize: '13px', color: theme.text, flex: 1, minWidth: '200px' }}>
          {metrics.verdict.reasons.length
            ? metrics.verdict.reasons.join(' · ')
            : 'Responding normally. Nothing in the numbers below suggests the server is the bottleneck.'}
        </span>
        <span style={{ fontSize: '11.5px', color: theme.textMuted, fontFamily: theme.fontMono }}>
          up {duration(metrics.uptimeSec)}
        </span>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '7px',
            padding: '5px 10px',
            fontSize: '12px',
            color: theme.text,
            cursor: 'pointer',
          }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: theme.danger, marginBottom: '10px' }}>
          Last refresh failed ({error}) — the figures below are from{' '}
          {new Date(metrics.timestamp).toLocaleTimeString()}.
        </div>
      )}

      {/* What most often explains a complaint. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <Tile
          label="Requests"
          value={`${minute.requestsPerSec}/s`}
          sub={`${minute.requests} in the last minute`}
        />
        <Tile
          label="Bandwidth out"
          value={`${bytes(minute.bytesOutPerSec)}/s`}
          sub={`${bytes(minute.bytesOut)} this minute`}
        />
        <Tile
          label="Bandwidth in"
          value={`${bytes(minute.bytesInPerSec)}/s`}
          sub={`${bytes(minute.bytesIn)} this minute`}
        />
        <Tile
          label="Response time"
          value={ms(metrics.latency.p95)}
          sub={`p50 ${ms(metrics.latency.p50)} · p99 ${ms(metrics.latency.p99)}`}
          tone={metrics.latency.p95 > 3000 ? theme.danger : undefined}
        />
        <Tile
          label="Errors"
          value={`${minute.errorRate}%`}
          sub={`${minute.errors5xx} server · ${minute.errors4xx} client`}
          tone={minute.errors5xx > 0 ? theme.danger : undefined}
        />
        <Tile
          label="In flight"
          value={metrics.inFlight}
          sub={`peak ${metrics.peakInFlight} since restart`}
          tone={metrics.inFlight > 50 ? theme.warning : undefined}
        />
      </div>

      {/* Why. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <Tile
          label="Event loop lag"
          value={loop.available ? ms(loop.p99) : 'n/a'}
          sub={loop.available ? `mean ${ms(loop.mean)} · max ${ms(loop.max)}` : 'not measurable here'}
          tone={loop.available && loop.p99 > 250 ? theme.danger : loop.available && loop.p99 > 70 ? theme.warning : undefined}
        />
        <Tile
          label="CPU"
          value={`${metrics.cpuPercent}%`}
          sub={`of one core · ${metrics.host.cpus} available`}
          tone={metrics.cpuPercent > 90 ? theme.danger : undefined}
        />
        <Tile
          label="Heap"
          value={`${metrics.memory.heapUsedPercent}%`}
          sub={`${bytes(metrics.memory.heapUsed)} of ${bytes(metrics.memory.heapTotal)}`}
          tone={metrics.memory.heapUsedPercent > 90 ? theme.danger : undefined}
        />
        <Tile
          label="Process memory"
          value={bytes(metrics.memory.rss)}
          sub={`host ${bytes(metrics.host.totalMem - metrics.host.freeMem)} of ${bytes(metrics.host.totalMem)}`}
        />
        <Tile
          label="Load average"
          value={metrics.host.loadavg[0]}
          sub={`5m ${metrics.host.loadavg[1]} · 15m ${metrics.host.loadavg[2]}`}
        />
        <Tile
          label="Total served"
          value={metrics.totals.requests.toLocaleString()}
          sub={`${bytes(metrics.totals.bytesOut)} out · ${bytes(metrics.totals.bytesIn)} in`}
        />
      </div>

      {/* Two minutes of shape. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px',
          marginBottom: '14px',
        }}
      >
        <Sparkline
          history={metrics.history}
          field="requests"
          colour={theme.accent}
          label="Requests per second (2 min)"
          format={(n) => n}
        />
        <Sparkline
          history={metrics.history}
          field="bytesOut"
          colour={theme.success}
          label="Bytes out per second (2 min)"
          format={bytes}
        />
      </div>

      {/* What to actually go and look at. */}
      {metrics.slowest.length > 0 && (
        <div
          style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '14px 16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: theme.text }}>
            Slowest requests since restart{' '}
            <span style={{ fontWeight: 400, color: theme.textMuted }}>(over 1 s)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: theme.fontMono }}>
              <tbody>
                {metrics.slowest.map((row, i) => (
                  <tr key={`${row.at}-${i}`} style={{ borderTop: i ? `1px solid ${theme.border}` : 'none' }}>
                    <td style={{ padding: '5px 8px 5px 0', color: theme.textMuted, whiteSpace: 'nowrap' }}>
                      {row.method}
                    </td>
                    <td style={{ padding: '5px 8px 5px 0', overflowWrap: 'anywhere' }}>{row.path}</td>
                    <td style={{ padding: '5px 8px 5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {row.status}
                    </td>
                    <td style={{ padding: '5px 8px 5px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {bytes(row.bytes)}
                    </td>
                    <td
                      style={{
                        padding: '5px 0',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        color: row.ms > 5000 ? theme.danger : theme.warning,
                        fontWeight: 600,
                      }}
                    >
                      {row.ms} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '10px', lineHeight: 1.6 }}>
        Counters are in-process and reset when the server restarts, so “total served” is since{' '}
        {duration(metrics.measuringSinceSec)} ago rather than all time. Bandwidth is measured at this
        process, so it excludes anything a reverse proxy or CDN served without reaching Node — and it
        <em> includes</em> this console’s own polling, which is a few kB a second.
      </div>
    </div>
  );
}
