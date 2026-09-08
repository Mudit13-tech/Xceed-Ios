// client/src/attendancemodule/ErrorConsole.jsx
// Rendered below the log stream on the Node server console (NodeConsole.jsx).

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import getEnvironment from '../getenvironment';
import { theme as T } from './config';
import { mergeErrorRows } from './errorConsoleRows';

const apiUrl = getEnvironment();
const METRICS_URL = `${apiUrl}/api/v1/attendancemodule/health/metrics`;
const NODE_LOGS_URL = `${apiUrl}/api/v1/attendancemodule/health/node-logs`;

/**
 * Only the things that went wrong, from both places they show up.
 *
 * The panel above says "12 server error(s) in the last minute" and stops there,
 * and the log below says everything at once — which in practice means the two
 * ERROR lines that explain an outage arrive sandwiched between four hundred
 * lines of ffmpeg progress and scroll past before anyone reads them. Neither
 * view answers the question the operator actually arrived with: *what* is
 * failing, right now, and how often.
 *
 * So this merges the two sources that each hold half the answer:
 *
 * - **Failed requests** (4xx/5xx) from the metrics endpoint. These exist even
 *   when nothing was logged — a route that answers 500 quietly prints nothing —
 *   and they carry the method, path, status and how long the failure took.
 * - **ERROR and WARN console output** from the same buffer the log above reads.
 *   These cover the other half: work that failed *outside* a request, or after
 *   one had already answered 200, which no status code will ever show. The
 *   embedding-delete failure in the log is exactly that shape.
 *
 * Newest first, deliberately, unlike the log above. A log is read forwards
 * because you are following a sequence; an error list is read backwards because
 * you want the most recent thing that broke, and having to scroll to the bottom
 * of a growing list to find it is a small tax paid every single time.
 *
 * ## Repeats
 *
 * Identical request failures are merged server-side into one row with a count
 * (see serverMetrics.noteFailure), because a dependency that is down produces the
 * same failure hundreds of times a minute and an unmerged list would show that
 * one failure and nothing else. Log lines are left alone — they are already
 * rate-limited by whatever chose to print them, and their text usually differs.
 */

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: '5xx', label: 'Server 5xx' },
  { key: '4xx', label: 'Client 4xx' },
  { key: 'log', label: 'Log output' },
];

const POLL_MS = 4000;

function formatTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '--:--:--';
  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function badgeColour(row) {
  if (row.kind === '5xx') return '#f87171';
  if (row.kind === '4xx') return '#fbbf24';
  return row.level === 'ERROR' ? '#f87171' : '#fbbf24';
}

export default function ErrorConsole({ limit = 200, pollMs = POLL_MS }) {
  const [recentErrors, setRecentErrors] = useState([]);
  const [logs, setLogs] = useState([]);
  const [unreachable, setUnreachable] = useState('');
  const [filter, setFilter] = useState('all');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Settled rather than all: one endpoint being refused must not blank the
      // half of the picture the other one still has.
      const [metrics, nodeLogs] = await Promise.allSettled([
        axios.get(METRICS_URL, { timeout: 5000, withCredentials: true }),
        axios.get(NODE_LOGS_URL, { timeout: 5000, params: { limit } }),
      ]);
      if (cancelled) return;

      if (metrics.status === 'fulfilled') {
        setRecentErrors(metrics.value.data?.recentErrors || []);
      }
      if (nodeLogs.status === 'fulfilled') {
        setLogs(nodeLogs.value.data?.logs || []);
      }

      if (metrics.status === 'rejected' && nodeLogs.status === 'rejected') {
        setUnreachable(metrics.reason?.message || 'Cannot reach the server');
      } else {
        setUnreachable('');
      }
    }

    load();
    if (paused) return () => { cancelled = true; };
    const interval = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [limit, pollMs, paused]);

  const rows = useMemo(() => mergeErrorRows(recentErrors, logs), [recentErrors, logs]);
  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.kind === filter)),
    [rows, filter],
  );

  const totalFailures = rows.reduce((sum, r) => sum + (r.kind === 'log' ? 0 : r.count), 0);

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Error Console</h2>
          <p style={styles.subtitle}>
            Failed requests and error output since the server restarted — newest first
          </p>
        </div>
        <div style={styles.headerRight}>
          <span
            style={{
              ...styles.status,
              color: rows.length ? T.danger : T.success,
              borderColor: rows.length ? '#fecaca' : '#bbf7d0',
              background: rows.length ? '#fef2f2' : '#ecfdf5',
            }}
          >
            {rows.length ? `${totalFailures} failed request(s)` : 'Nothing failing'}
          </span>
          <button type="button" onClick={() => setPaused((p) => !p)} style={styles.pause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div style={styles.filters}>
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? rows.length : rows.filter((r) => r.kind === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                ...styles.filter,
                background: active ? T.accent : T.surface,
                color: active ? T.accentText : T.textMuted,
                borderColor: active ? T.accent : T.border,
              }}
            >
              {f.label} <span style={{ opacity: 0.75 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.body}>
        {unreachable ? (
          <div style={styles.empty}>{unreachable}</div>
        ) : visible.length ? (
          visible.map((row) => (
            <div key={row.id} style={styles.row}>
              <div style={styles.rowHead}>
                <span style={styles.time}>{formatTime(row.at)}</span>
                <span style={{ ...styles.badge, color: badgeColour(row) }}>{row.badge}</span>
                <span style={styles.source}>{row.source}</span>
                <span style={styles.meta}>
                  {row.count > 1 && <span style={styles.count}>×{row.count}</span>}
                  {row.ms !== null && <span>{row.ms} ms</span>}
                </span>
              </div>
              {row.detail ? (
                <div style={styles.detail}>{row.detail}</div>
              ) : (
                <div style={{ ...styles.detail, color: '#64748b' }}>
                  No message — the route answered {row.badge} without raising an error.
                </div>
              )}
            </div>
          ))
        ) : (
          <div style={styles.empty}>
            {rows.length ? 'Nothing matches this filter' : 'No errors since the server started'}
          </div>
        )}
      </div>

      <p style={styles.footnote}>
        Request failures are kept in memory and reset with the process — the last 60, with
        identical repeats merged into one row and counted. Log output is the ERROR and WARN
        lines from the same buffer as the console above, so anything printed before the last
        500 lines has already scrolled out of both.
      </p>
    </section>
  );
}

const styles = {
  panel: {
    marginTop: 16,
    background: '#ffffff',
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: 14,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    margin: 0,
    color: T.text,
    fontSize: 15,
    fontWeight: 800,
  },
  subtitle: {
    margin: '3px 0 0',
    color: T.textMuted,
    fontSize: 12,
  },
  status: {
    border: '1px solid',
    borderRadius: 7,
    padding: '5px 9px',
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  pause: {
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 700,
    color: T.text,
    cursor: 'pointer',
  },
  filters: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filter: {
    border: '1px solid',
    borderRadius: 999,
    padding: '4px 11px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
  body: {
    maxHeight: 300,
    overflow: 'auto',
    borderRadius: 7,
    background: '#0f172a',
    color: '#dbeafe',
    padding: 12,
    fontFamily: T.fontMono,
    fontSize: 12,
    lineHeight: 1.55,
  },
  empty: {
    minHeight: 90,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
  },
  row: {
    padding: '5px 0',
    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
  },
  rowHead: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  time: {
    color: '#93c5fd',
    whiteSpace: 'nowrap',
  },
  badge: {
    fontWeight: 800,
    whiteSpace: 'nowrap',
    minWidth: 42,
  },
  source: {
    color: '#e2e8f0',
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  meta: {
    display: 'flex',
    gap: 8,
    color: '#94a3b8',
    whiteSpace: 'nowrap',
  },
  count: {
    color: '#fbbf24',
    fontWeight: 700,
  },
  detail: {
    // Indented to the width of the timestamp, so the eye can run down the
    // messages without the timestamps breaking the column.
    marginLeft: 86,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  footnote: {
    margin: '10px 0 0',
    fontSize: 11,
    color: T.textMuted,
    lineHeight: 1.6,
  },
};
