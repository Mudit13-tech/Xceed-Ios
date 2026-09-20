// client/src/attendancemodule/LiveStatusPanel.jsx
//
// What every classroom is doing right now — camera state, why a run has or
// has not started, how many checks have landed, and the latest present/absent
// split.
//
// This is the whole of what used to be LiveReportPage, lifted out so the same
// card can appear in three places instead of one. It renders in two shapes:
//
//   variant="page"  — the standalone /attendance/live-report screen: its own
//                     heading, a date picker and the full row of period chips.
//   variant="panel" — a section inside a dashboard: compact header, a date and
//                     period control small enough to sit in it, and the same
//                     room cards underneath.
//
// One component rather than two, deliberately. The cards encode a lot of hard
// -won judgement — that a room mid-capture is never "done" however many checks
// have saved, that a past period with no data is "No Run" and not "Waiting",
// that the preflight list stops at the first failure — and a second copy on
// the dashboards would start telling a different story about the same room the
// first time either was edited.
//
// Scope is the server's, never this component's. /scheduler/live-status
// returns the rooms whose CURRENT class belongs to the caller's department: a
// full-access admin gets the campus, a department admin or head of department
// gets their own. Rooms are shared between departments across the day, so that
// filter is on the class in the room this period and not on the room itself —
// which is why nothing here filters by department. `department` only narrows
// the campus-wide view a full-access admin would otherwise get, and the server
// ignores it for everybody else.

import { useState, useEffect, useCallback, useRef } from 'react';
import { theme, styles, cssReset } from './config';
import EnrollmentWarning from './EnrollmentWarning';
import getEnvironment from '../getenvironment';
import usePolling from './usePolling';

const apiUrl = getEnvironment();
const LIVE_API = `${apiUrl}/attendancemodule/scheduler/live-status`;

const REFRESH_MS = 15000;

// ── helpers ──────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

function isPeriodPast(slot, date, periods) {
  if (!slot || !date) return false;
  const today = todayStr();
  if (date < today) return true;
  if (date > today) return false;
  const period = (periods || []).find(p => p.periodKey === slot);
  if (!period?.endTime) return false;
  const [h, m] = period.endTime.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}

function Dot({ color, blink }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: blink ? `0 0 0 2px ${color}30` : 'none',
      animation: blink ? 'lrPulse 1.4s ease-in-out infinite' : 'none',
    }} />
  );
}

function CamChip({ info }) {
  if (!info) return null;
  const { status, total, online } = info;
  const cfg = {
    online:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: `Camera OK (${online}/${total})` },
    offline:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: `Offline (${online}/${total} online)` },
    no_camera: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'No camera' },
  }[status] || { color: theme.textMuted, bg: theme.border, label: 'Unknown' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
    }}>
      <Dot color={cfg.color} blink={status === 'online'} />
      {cfg.label}
    </div>
  );
}

function StatusBadge({ label, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 99,
      background: `${color}18`, color, textTransform: 'uppercase',
      letterSpacing: '.07em', flexShrink: 0, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

// ── Preflight checklist ──────────────────────────────────────────────────────
// The five conditions the scheduler evaluates before it calls the ML service,
// in the order it evaluates them. The list stops at the first failure — that
// line is the reason attendance is not starting, and its detail names the
// field to fix. Everything after it was never reached, so it is not shown.
function PreflightList({ checks }) {
  if (!checks || checks.length === 0) return null;
  const firstFailIdx = checks.findIndex(c => !c.ok);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      background: theme.bg, borderRadius: 8, padding: '9px 10px',
    }}>
      {checks.map((c, i) => {
        const isBlocker = i === firstFailIdx;
        const color = c.ok ? '#10b981' : isBlocker ? '#ef4444' : theme.textMuted;
        return (
          <div key={c.key} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
            <span style={{
              fontSize: 11, lineHeight: '15px', color, fontWeight: 800,
              flexShrink: 0, width: 11, textAlign: 'center',
            }}>{c.ok ? '✓' : '✕'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 11, lineHeight: '15px', color: c.ok ? theme.text : color,
                fontWeight: isBlocker ? 700 : 600,
              }}>{c.label}</div>
              {c.detail && (
                <div style={{
                  fontSize: 10, lineHeight: '14px', color: isBlocker ? color : theme.textMuted,
                  wordBreak: 'break-word',
                }}>{c.detail}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Period window ────────────────────────────────────────────────────────────
// Start and end come from the server in campus (IST) minutes, so this agrees
// with the scheduler even when the browser is in another timezone.
function PeriodTiming({ timing }) {
  if (!timing) return null;
  const { state, startTime, endTime, minsToStart, minsToEnd, wouldFireNow, tooLateToStart, runDurationMin } = timing;

  const cfg = {
    upcoming: { color: '#f59e0b', text: `Starts in ${minsToStart} min` },
    live:     { color: '#6366f1', text: `Ends in ${minsToEnd} min` },
    over:     { color: theme.textMuted, text: 'Period over' },
  }[state];

  if (!cfg) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      background: theme.bg, borderRadius: 8, padding: '8px 12px',
      border: `1px solid ${cfg.color}25`,
    }}>
      <Dot color={cfg.color} blink={state === 'live'} />
      <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, fontFamily: "'IBM Plex Mono',monospace" }}>
        {startTime} – {endTime} IST
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.text}</span>
      {state !== 'over' && (
        <span style={{ fontSize: 10, color: theme.textMuted, marginLeft: 'auto' }}>
          {wouldFireNow
            ? 'Scheduler would fire a run now'
            : tooLateToStart
              ? `Under ${runDurationMin} min left — too late to start a run`
              : 'Waiting for the period to begin'}
        </span>
      )}
    </div>
  );
}

// ── Global gates ─────────────────────────────────────────────────────────────
// When one of these fails, every room is waiting for the same reason, so it is
// shown once above the grid rather than repeated on each card.
function GateBar({ gates }) {
  const failing = (gates || []).filter(g => !g.ok);
  if (failing.length === 0) return null;
  return (
    <div style={{
      background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        No room can run — {failing.length} blocking condition{failing.length > 1 ? 's' : ''}
      </div>
      {failing.map(g => (
        <div key={g.key} style={{ fontSize: 12, color: theme.text }}>
          <strong style={{ fontWeight: 700 }}>{g.label}:</strong>{' '}
          <span style={{ color: theme.textMuted }}>{g.detail}</span>
        </div>
      ))}
    </div>
  );
}

function RunProgress({ completed, target, configured }) {
  const pct = target > 0 ? Math.min(100, (completed / target) * 100) : 0;
  const isDone = completed >= target && target > 0;
  const color = isDone ? '#10b981' : '#6366f1';
  // `target` is what the period can actually hold, which is the honest
  // denominator; `configured` is what the setting asks for. When a period is
  // too short to deliver the setting, say so here rather than showing a
  // shrunken target with no explanation.
  const shortfall = configured > 0 && target > 0 && configured > target;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>
        <span>Runs completed</span>
        <span style={{ fontWeight: 700, color: isDone ? '#10b981' : theme.text }}>{completed} / {target}</span>
      </div>
      <div style={{ height: 5, background: theme.border, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color, borderRadius: 3,
          transition: 'width .4s ease',
          animation: !isDone && completed > 0 ? 'lrBar 2s ease-in-out infinite' : 'none',
        }} />
      </div>
      {shortfall && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>
          {configured} runs configured — only {target} fit in this period at the
          current run duration
        </div>
      )}
    </div>
  );
}

function AttendanceCounts({ record }) {
  if (!record) return null;
  const pct = record.attendancePct ?? 0;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6,
      background: theme.bg, borderRadius: 8, padding: '10px 8px', marginTop: 10,
    }}>
      {[
        { label: 'Present', value: record.present, color: '#10b981' },
        { label: 'Absent',  value: record.absent,  color: '#ef4444' },
        { label: 'Review',  value: record.review,  color: '#f59e0b' },
        { label: 'Attend%', value: `${pct}%`, color: pct >= 75 ? '#10b981' : '#ef4444' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1.1 }}>
            {value ?? '—'}
          </div>
          <div style={{ fontSize: 9, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomCard({ r, onClickReport, pastPeriod }) {
  const isSkipped   = r.status === 'skipped';
  const isPending   = r.status === 'pending';
  const isFinalized = r.status === 'finalized';
  // `inProgress` comes from the scheduler's in-flight registry, not from the
  // report — the report row does not exist until the first check saves, so for
  // the whole of that first capture there is nothing in the database to read.
  // With globalNumRuns at 1 that is the entire run, which is why the card used
  // to go straight from "Waiting" to "Completed" without ever showing that a
  // run was happening.
  const isInProgress = !!r.inProgress;
  const isDone      = !isFinalized && !isInProgress && r.runsCompleted >= r.targetRuns && r.targetRuns > 0;
  // "Running" only makes sense for an ongoing period; past periods with partial runs = "Partial"
  const isRunning   = !pastPeriod && !isSkipped && !isPending && !isDone && !isFinalized && r.runsCompleted > 0;
  const isPartial   = pastPeriod  && !isSkipped && !isPending && !isDone && !isFinalized && r.runsCompleted > 0;
  const hasClass    = !!r.ctx;
  const camStatus   = r.cameraInfo?.status;
  const noCam       = camStatus === 'no_camera';
  const camOffline  = camStatus === 'offline';
  const noRun       = isPending && pastPeriod;  // past period with no data = no run happened

  const accentColor =
    isFinalized              ? '#10b981' :
    isInProgress             ? '#6366f1' :
    isDone                   ? '#10b981' :
    isRunning                ? '#6366f1' :
    isPartial                ? theme.border :
    noRun                    ? theme.border :
    isPending && hasClass && !noCam && !camOffline ? '#f59e0b' :
    noCam || camOffline      ? '#f97316' :
    theme.border;

  const badgeLabel  =
    isFinalized ? 'Finalized' :
    isInProgress? 'In Progress' :
    isDone      ? 'Completed' :
    isRunning   ? 'Running'   :
    isPartial   ? 'Partial'   :
    noRun       ? 'No Run'    :
    isPending && hasClass ? 'Waiting' :
    isSkipped   ? 'Skipped'   : 'Pending';

  const badgeColor  =
    isFinalized ? '#10b981' :
    isInProgress? '#6366f1' :
    isDone      ? '#10b981' :
    isRunning   ? '#6366f1' :
    isPartial   ? theme.textMuted :
    noRun       ? theme.textMuted :
    isPending && hasClass ? '#f59e0b' :
    theme.textMuted;

  // `visibleVia === 'faculty'` means this room is on the reader's dashboard
  // only because one of their own lecturers is taking it — the CLASS belongs
  // to another department, so its report is filed against that department's
  // batch and the reader's reports page, which is scoped to their own, cannot
  // open it. Showing the card is right; offering a click that lands on an
  // empty page is not.
  const otherDeptClass = r.visibleVia === 'faculty';
  const clickable = !isSkipped && hasClass && !otherDeptClass
    && typeof onClickReport === 'function';

  return (
    <div
      onClick={() => clickable && onClickReport(r)}
      style={{
        background: theme.surface,
        border: `1px solid ${accentColor}25`,
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 12, padding: '16px 18px',
        cursor: clickable ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: 10,
        opacity: isSkipped ? 0.7 : 1,
        transition: 'box-shadow .15s',
      }}
    >
      {/* Row 1: room + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: theme.text, letterSpacing: '-0.01em' }}>{r.room}</div>
          {hasClass && (
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>
              {r.ctx.dept}{r.ctx.sem ? ` · Sem ${r.ctx.sem}` : ''}
            </div>
          )}
        </div>
        <StatusBadge label={badgeLabel} color={badgeColor} />
      </div>

      {/* Camera chip */}
      <CamChip info={r.cameraInfo} />

      {/* Skip reason */}
      {isSkipped && (
        <>
          <div style={{
            fontSize: 12, color: theme.danger, fontWeight: 600,
            background: 'rgba(239,68,68,0.07)', padding: '6px 10px', borderRadius: 6,
          }}>
            {r.reason || 'Skipped'}
          </div>
          {/* "No Class Scheduled" alone doesn't say whether it's a free
              period or a lookup that missed — the checklist does. */}
          <PreflightList checks={r.preflight} />
        </>
      )}

      {/* Class info + run data */}
      {!isSkipped && hasClass && (
        <>
          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.ctx.subject || '—'}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>{r.ctx.batch}</div>
            {r.ctx.faculty && (
              <div style={{ fontSize: 11, color: theme.textMuted }}>Faculty: {r.ctx.faculty}</div>
            )}
            {otherDeptClass && (
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 3, fontStyle: 'italic' }}>
                Your faculty, {r.ctx.dept || 'another department'}&apos;s class — the
                report is filed under that department.
              </div>
            )}
          </div>

          {(noCam || camOffline) && !pastPeriod && (
            <div style={{
              fontSize: 11, color: '#f97316', fontWeight: 600,
              background: 'rgba(249,115,22,0.08)', padding: '5px 10px', borderRadius: 6,
            }}>
              {noCam ? 'No camera registered — run may fail' : 'Camera offline — run may fail'}
            </div>
          )}

          {/* Ran, but against a fallback gallery — the result is real but
              needs a human before it is trusted. */}
          <EnrollmentWarning enrollment={r.enrollment} />

          {/* in-progress is tested before pending: during the first capture no
              report row exists yet, so status is still 'pending' and testing it
              first would show "Waiting" for the very run we are trying to
              indicate. */}
          {isInProgress ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#6366f1', fontWeight: 700 }}>
                <Dot color="#6366f1" blink />
                {r.runsCompleted > 0
                  ? `Run in progress — ${r.runsCompleted} of ${r.targetRuns} check${r.targetRuns === 1 ? '' : 's'} saved`
                  : 'Run in progress — capturing the first check…'}
              </div>
              <RunProgress completed={r.runsCompleted} target={r.targetRuns} configured={r.configuredRuns} />
            </div>
          ) : isPending ? (
            <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>
              {noRun ? 'No attendance recorded for this period.' : 'Waiting for attendance run to start…'}
            </div>
          ) : (
            <RunProgress completed={r.runsCompleted} target={r.targetRuns} configured={r.configuredRuns} />
          )}

          {/* Why it has or hasn't started — always available, expanded by
              default while pending since that is when it is being asked. */}
          {r.preflight?.length > 0 && (
            <details open={isPending}>
              <summary style={{
                fontSize: 10, color: theme.textMuted, cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700,
                marginBottom: 6, userSelect: 'none',
              }}>
                Preflight checks
              </summary>
              <PreflightList checks={r.preflight} />
            </details>
          )}

          <AttendanceCounts record={r.lastRecord} />
        </>
      )}

      {!isSkipped && !hasClass && (
        <div style={{ fontSize: 12, color: theme.textMuted, fontStyle: 'italic' }}>
          No class scheduled for this period
        </div>
      )}
    </div>
  );
}

export const liveStatusCss = `
  @keyframes lrPulse  { 0%,100%{ opacity:1; } 50%{ opacity:.3; } }
  @keyframes lrBar    { 0%,100%{ opacity:1; } 50%{ opacity:.6; } }
  @keyframes lrFadeUp { from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
  @keyframes lrSpin   { to{ transform:rotate(360deg); } }
`;

// ════════════════════════════════════════════════════════════════════════════
/**
 * @param {'page'|'panel'} variant  page = the standalone screen, panel = a
 *        section inside a dashboard.
 * @param {string} department  narrows a full-access admin's campus-wide view;
 *        ignored by the server for everyone else.
 * @param {(room, ctx) => void} onOpenReport  where a card goes when clicked;
 *        `ctx` carries the panel's own `{ date, slot }`, which a report page
 *        needs to prefill its filters and the room object does not hold. Omit
 *        the callback and the cards are not clickable, which is the right
 *        answer for an audience with no reports page to send them to.
 */
export default function LiveStatusPanel({
  variant = 'page',
  title = 'Live Attendance Status',
  department = '',
  onOpenReport,
}) {
  const isPanel = variant === 'panel';

  const [data,      setData]     = useState(null);
  const [loading,   setLoading]  = useState(true);   // true only on first load / date-slot change
  const [fetching,  setFetching] = useState(false);  // true during any fetch (incl. background poll)
  const [error,     setError]    = useState(null);
  const [lastUpd,   setLastUpd]  = useState(null);
  const [selSlot,   setSelSlot]  = useState(null);  // null = auto-detect
  const [selDate,   setSelDate]  = useState(todayStr());

  const fetchStatus = useCallback(async (slot, date) => {
    setFetching(true);
    try {
      const params = new URLSearchParams({ _t: Date.now() });
      if (slot) params.set('slot', slot);
      if (date) params.set('date', date);
      if (department) params.set('department', department);
      // The endpoint is behind the attendance gate, so the session cookie has
      // to travel with it — the API is not always the page's own origin, and
      // fetch's default of same-origin would drop the cookie when it is not.
      const res = await fetch(`${LIVE_API}?${params}`, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Fetch failed');
      const json = await res.json();
      setData(json);
      setLastUpd(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      // The last good snapshot stays on screen — one failed poll should not
      // blank a live view.
      setError(e.message);
    }
    setLoading(false);
    setFetching(false);
  }, [department]);

  // setLoading stays tied to the slot/date change specifically: the spinner
  // belongs to "you asked for a different period", not to every background
  // refresh of the one already on screen.
  //
  // And the fetch is driven from here rather than left to the next poll tick,
  // because usePolling holds its callback in a ref — changing the period does
  // not restart its timer, so picking a period could sit on "Loading…" for the
  // rest of a 15-second interval before anything was even requested.
  const firstRender = useRef(true);
  useEffect(() => {
    setLoading(true);
    // Mount is the polling hook's own leading call; fetching here as well
    // would make every load of the page two identical requests.
    if (firstRender.current) { firstRender.current = false; return; }
    fetchStatus(selSlot, selDate);
  }, [selSlot, selDate, fetchStatus]);
  usePolling(
    useCallback(() => fetchStatus(selSlot, selDate), [fetchStatus, selSlot, selDate]),
    REFRESH_MS,
  );

  const periods    = (data?.periods || []).filter(p => p.enabled !== false);
  const rooms      = data?.rooms || [];
  const slot       = data?.slot;
  const scoped     = data?.scopedToDepartments;
  const pastPeriod = isPeriodPast(selSlot || slot, selDate, periods);

  // Same rule the cards use: a room mid-capture is never "done", however many
  // checks have already landed.
  const isLiveRoom = r => !!r.inProgress;

  const partialFilter = r =>
    !['skipped','pending','finalized'].includes(r.status) && !isLiveRoom(r) &&
    r.runsCompleted > 0 && r.runsCompleted < r.targetRuns;

  const stats = {
    done:    rooms.filter(r => r.status === 'finalized' || (!isLiveRoom(r) && r.runsCompleted >= r.targetRuns && r.targetRuns > 0)).length,
    running: !pastPeriod ? rooms.filter(r => isLiveRoom(r) || partialFilter(r)).length : 0,
    partial: pastPeriod  ? rooms.filter(partialFilter).length : 0,
    noRun:   pastPeriod  ? rooms.filter(r => r.status === 'pending' && !!r.ctx).length : 0,
    waiting: !pastPeriod ? rooms.filter(r => r.status === 'pending' && !!r.ctx).length : 0,
    skipped: rooms.filter(r => r.status === 'skipped').length,
  };

  const refreshNote = (
    <span style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
      {fetching && <span style={{ display: 'inline-block', width: 10, height: 10, border: `2px solid ${theme.accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'lrSpin .7s linear infinite', flexShrink: 0 }} />}
      {fetching ? 'Refreshing…' : lastUpd ? `Updated ${lastUpd}` : '—'}
    </span>
  );

  const dateInput = (
    <input
      type="date"
      value={selDate}
      onChange={e => { setSelDate(e.target.value); setSelSlot(null); }}
      style={{ ...styles.input, width: 'auto', fontSize: 12, padding: '6px 10px' }}
    />
  );

  const periodLabel = p => (p.startTime
    ? `${p.periodKey.replace('period','P').replace('lunch','Lunch')} ${p.startTime}`
    : p.periodKey.replace('period','P').replace('lunch','Lunch'));

  const banners = (
    <>
      {data && !data.isWorkingDay && (
        <div style={{
          marginBottom: 14, padding: '12px 18px', borderRadius: 10,
          background: 'rgba(239,68,68,0.07)', border: `1px solid ${theme.danger}35`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>⛔</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: theme.danger }}>Non-Working Day</div>
            {data.workingDayReason && (
              <div style={{ fontSize: 12, color: theme.danger, opacity: 0.8 }}>
                {data.workingDayReason}
                {data.workingDaySource === 'allotment' ? ' (allotment schedule)' : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {data && !data.acquisitionActive && (
        <div style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 10,
          background: 'rgba(239,68,68,0.07)', border: `1px solid #ef444435`,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ef4444',
        }}>
          <span style={{ fontWeight: 800 }}>⚠</span>
          Global Acquisition is OFF — no new ML runs will execute.
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: 14, padding: '10px 16px', borderRadius: 10,
          background: theme.dangerDim, color: theme.danger, fontSize: 13,
        }}>
          {error}{data ? ' — showing the last update.' : ''}
        </div>
      )}
    </>
  );

  const summaryChips = rooms.length > 0 && (
    <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      {[
        { label: 'Done',    value: stats.done,    color: '#10b981' },
        ...(pastPeriod
          ? [
              { label: 'Partial', value: stats.partial, color: theme.textMuted },
              { label: 'No Run',  value: stats.noRun,   color: theme.textMuted },
            ]
          : [
              { label: 'Running', value: stats.running, color: '#6366f1' },
              { label: 'Waiting', value: stats.waiting, color: '#f59e0b' },
            ]),
        { label: 'Skipped', value: stats.skipped, color: theme.textMuted },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          padding: '5px 12px', borderRadius: 8, background: theme.surface,
          border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'IBM Plex Mono',monospace" }}>{value}</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>{label}</span>
        </div>
      ))}
      <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 4 }}>
        {slot ? `${slot} · ${selDate}` : selDate}
      </span>
    </div>
  );

  // An empty list means two very different things, and saying "no rooms" for
  // both would read as a fault when it is simply somebody else's period.
  const emptyStates = (
    <>
      {!loading && data && !slot && rooms.length === 0 && (
        <div style={{
          textAlign: 'center', padding: isPanel ? '28px 20px' : '50px 20px', color: theme.textMuted, fontSize: isPanel ? 13 : 14,
          background: theme.surface, borderRadius: 12, border: `1.5px dashed ${theme.border}`,
        }}>
          No active lecture period at this time.
          <div style={{ fontSize: 12, marginTop: 8 }}>Select a specific period above to view its status.</div>
        </div>
      )}

      {!loading && data && slot && rooms.length === 0 && (
        <div style={{
          textAlign: 'center', padding: isPanel ? '28px 20px' : '50px 20px', color: theme.textMuted, fontSize: 13,
          background: theme.surface, borderRadius: 12, border: `1.5px dashed ${theme.border}`,
        }}>
          {scoped && scoped.length
            ? `No ${scoped.join(', ')} classes are scheduled this period.`
            : 'No classrooms are running this period.'}
        </div>
      )}

      {loading && rooms.length === 0 && (
        <div style={{ textAlign: 'center', padding: isPanel ? 28 : 50, color: theme.textMuted, fontSize: 14 }}>
          Loading…
        </div>
      )}
    </>
  );

  const roomGrid = (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${isPanel ? 260 : 280}px, 1fr))`,
      gap: isPanel ? 12 : 16,
    }}>
      {rooms.map((r, i) => (
        <div key={r.room || i} style={{ animation: `lrFadeUp .3s ease ${i * 25}ms both` }}>
          <RoomCard
            r={r}
            pastPeriod={pastPeriod}
            // The date and period are the panel's, not the room's — a report
            // page cannot prefill its filters from the card alone.
            onClickReport={onOpenReport && (room => onOpenReport(room, { date: selDate, slot }))}
          />
        </div>
      ))}
    </div>
  );

  // ── Panel: a section on a dashboard ───────────────────────────────────────
  if (isPanel) {
    return (
      <section style={{ ...styles.card, marginTop: 18 }}>
        <style dangerouslySetInnerHTML={{ __html: liveStatusCss }} />

        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10, marginBottom: 14,
        }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ ...styles.heading, fontSize: 17 }}>{title}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              Camera status, run progress and attendance counts, refreshed every 15 seconds.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* A dropdown rather than the page's chip row: the dashboard has
                no room for eight buttons, and the period is usually left on
                auto anyway. */}
            {periods.length > 0 && (
              <select
                value={selSlot || ''}
                onChange={e => setSelSlot(e.target.value || null)}
                style={{ ...styles.select, width: 'auto', fontSize: 12, padding: '6px 10px' }}
              >
                <option value="">Auto{slot ? ` — ${slot}` : ''}</option>
                {periods.map(p => (
                  <option key={p.periodKey} value={p.periodKey}>{periodLabel(p)}</option>
                ))}
              </select>
            )}
            {dateInput}
            {refreshNote}
            <button
              type="button"
              onClick={() => fetchStatus(selSlot, selDate)}
              title="Refresh now"
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                background: theme.accentDim, color: theme.accent,
                border: `1px solid ${theme.accent}30`, fontWeight: 700,
              }}
            >
              ↻
            </button>
          </div>
        </div>

        {banners}
        {data?.timing && <div style={{ marginBottom: 14 }}><PeriodTiming timing={data.timing} /></div>}
        <GateBar gates={data?.gates} />
        {summaryChips}
        {emptyStates}
        {rooms.length > 0 && roomGrid}
      </section>
    );
  }

  // ── Page: the standalone /attendance/live-report screen ───────────────────
  return (
    <div style={{ ...styles.page, position: 'relative' }}>
      <style dangerouslySetInnerHTML={{ __html: `${cssReset}${liveStatusCss}` }} />

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={styles.heading}>{title}</div>
            <div style={styles.subheading}>
              Real-time view of all classrooms — camera status, run progress, and attendance counts.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {dateInput}
            {refreshNote}
          </div>
        </div>
      </div>

      {banners}

      {/* ── Period selector ── */}
      {periods.length > 0 && (
        <div style={{
          marginBottom: 20, padding: '12px 16px', background: theme.surface,
          border: `1px solid ${theme.border}`, borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0 }}>
            Period
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelSlot(null)}
              style={{
                padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: `1.5px solid ${!selSlot ? '#6366f1' : theme.border}`,
                background: !selSlot ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: !selSlot ? '#6366f1' : theme.textMuted, transition: 'all .15s',
              }}
            >
              Auto {!selSlot && slot && <span style={{ marginLeft: 4, fontSize: 8, color: '#10b981' }}>●</span>}
            </button>
            {periods.map(p => {
              const isActive  = selSlot === p.periodKey || (!selSlot && slot === p.periodKey);
              const isCurrent = !selSlot && slot === p.periodKey;
              return (
                <button
                  key={p.periodKey}
                  onClick={() => setSelSlot(selSlot === p.periodKey ? null : p.periodKey)}
                  style={{
                    padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', border: `1.5px solid ${isActive ? '#6366f1' : theme.border}`,
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: isActive ? '#6366f1' : theme.textMuted,
                    transition: 'all .15s', whiteSpace: 'nowrap',
                  }}
                >
                  {periodLabel(p)}
                  {isCurrent && <span style={{ marginLeft: 4, fontSize: 8, color: '#10b981' }}>●</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── When this period starts and ends, on the campus clock ── */}
      {data?.timing && (
        <div style={{ marginBottom: 14 }}>
          <PeriodTiming timing={data.timing} />
        </div>
      )}

      {/* ── Conditions that block every room at once ── */}
      <GateBar gates={data?.gates} />

      {summaryChips}
      {emptyStates}
      {roomGrid}
    </div>
  );
}
