// client/src/attendancemodule/errorConsoleRows.js
// The list ErrorConsole.jsx draws, kept apart from the drawing of it so it can
// be tested as the ordering rule it is — and so the component file exports only
// a component (see subtabNavigation.js for the same split).

/**
 * Failed requests and error output as one list, newest first.
 *
 * The two sources each hold half the answer. A request failure exists even when
 * nothing was logged — a route that answers 500 quietly prints nothing — and
 * carries the method, path, status and duration. An ERROR line covers the other
 * half: work that failed *outside* a request, or after one had already answered
 * 200, which no status code will ever show.
 *
 * Newest first, deliberately, unlike the log this sits beneath. A log is read
 * forwards because you are following a sequence; an error list is read backwards
 * because you want the most recent thing that broke, and scrolling to the bottom
 * of a growing list to find it is a small tax paid every single time.
 *
 * @param {Array} recentErrors from the metrics endpoint, already merged and counted
 * @param {Array} logs the raw console buffer, of which only ERROR/WARN is kept
 */
export function mergeErrorRows(recentErrors, logs) {
  const rows = [];

  (recentErrors || []).forEach((e, i) => {
    const status = Number(e.status) || 0;
    rows.push({
      id: `req-${e.at}-${e.method}-${e.path}-${i}`,
      kind: status >= 500 ? '5xx' : '4xx',
      at: e.at,
      badge: String(status || '???'),
      source: `${e.method} ${e.path}`,
      // The quoted error where one reached the error handler; null is rendered
      // as a sentence saying so, rather than as a blank line that reads like
      // missing data.
      detail: e.message || null,
      count: e.count || 1,
      ms: Number.isFinite(e.ms) ? e.ms : null,
    });
  });

  (logs || []).forEach((log, i) => {
    const level = String(log.level || '').toUpperCase();
    if (level !== 'ERROR' && level !== 'WARN') return;
    rows.push({
      id: `log-${log.timestamp}-${i}`,
      kind: 'log',
      level,
      at: log.timestamp,
      badge: level,
      source: log.logger || 'node',
      detail: log.message,
      count: 1,
      ms: null,
    });
  });

  return rows.sort((a, b) => {
    const diff = Date.parse(b.at || 0) - Date.parse(a.at || 0);
    if (diff) return diff;
    // Ties broken by putting request failures above log lines, so a failed
    // request and the line it printed land together in that order.
    return (a.kind === 'log' ? 1 : 0) - (b.kind === 'log' ? 1 : 0);
  });
}

export default mergeErrorRows;
