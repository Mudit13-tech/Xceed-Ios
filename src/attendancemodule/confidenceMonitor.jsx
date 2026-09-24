// client/src/attendancemodule/confidenceMonitor.jsx
// Per-student confidence monitoring — flags students with low avg confidence
// so their ground truth can be improved.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import getEnvironment from '../getenvironment';
import StudentGroundTruthModal from './StudentGroundTruthModal';
import { theme, styles, cssReset, DEGREES } from './config';
import { usePeriods } from './usePeriods';
import SubtabNewTabButton from './SubtabNewTabButton';
import { readSubtabFromSearch } from './subtabNavigation';

const apiUrl = getEnvironment();
const REPORTS_API = `${apiUrl}/attendancemodule/reports`;
const GT_API = `${apiUrl}/attendancemodule/ground-truth`;
const BATCHES_API = `${apiUrl}/attendancemodule/settings/batches`;
// Where a report opens from here.
//
// The reports page is mounted twice — /attendance/reports for an institute
// admin, /dept-admin/reports for a coordinator — and it opens a specific
// report from ?tab=detail&reportId=… (see its location.search effect). Picking
// the base from the path the user is already on keeps a coordinator inside
// their own layout instead of bouncing them off the /attendance gate.
function reportDetailPath(reportId, pathname) {
  const base = String(pathname || '').startsWith('/dept-admin')
    ? '/dept-admin/reports'
    : '/attendance/reports';
  return `${base}?tab=detail&reportId=${encodeURIComponent(reportId)}`;
}

const LOW_CONF_THRESHOLD = 0.6;
const HIGH_CONF_THRESHOLD = 0.8;

// Helpers

function confidenceColor(val) {
  if (val >= 0.6) return theme.success;
  if (val >= 0.4) return theme.warning;
  if (val > 0) return theme.danger;
  return theme.textMuted;
}

function confidenceBg(val) {
  if (val >= 0.6) return theme.successDim;
  if (val >= 0.4) return theme.warningDim;
  if (val > 0) return theme.dangerDim;
  return 'transparent';
}

// Low / Normal / High / Undefined band, also used as the filter key.
function confBand(avgConf) {
  if (avgConf <= 0) return 'undefined';
  if (avgConf < LOW_CONF_THRESHOLD) return 'low';
  if (avgConf < HIGH_CONF_THRESHOLD) return 'normal';
  return 'high';
}

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const bg = isError ? theme.danger : theme.success;
  return (
    <div
      style={{
        position: 'fixed',
        top: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        padding: '12px 20px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        background: bg,
        color: '#ffffff',
        border: 'none',
        maxWidth: 420,
        boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      }}
    >
      {toast.msg}
    </div>
  );
}

// Review Audit tab
//
// Ground-truth triage. Two cuts from /reports/review-audit, both dept-wise:
//   1. students the model NEVER marked present in a finished class run, yet
//      pushed to review at least once — their enrolled faces are the prime
//      suspects;
//   2. students pushed to review >= minReviews times inside one subject, which
//      localises the failure to a subject/room/period rather than the student.
// Every listed review carries the subject and the period it happened in, so a
// coordinator can go straight to that frame and fix the ground truth.

// How many weakly-recognised students each semester shows before asking. Ten
// is about what a coordinator will act on in one sitting, and the ranking puts
// the worst first — the rest are there to page into, not to scroll past.
const WEAK_STUDENT_PAGE = 10;

export function ReviewAuditPanel({ fixedDepartment = '', showToast }) {
  const { slotLabel } = usePeriods();
  const [days, setDays] = useState('60');
  const [minReviews, setMinReviews] = useState('3');
  const [dept, setDept] = useState(fixedDepartment);
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  // Ground truth for one student, opened from their roll number. Holds the
  // batch too — StudentGroundTruthModal needs both, and the audit rows are the
  // only place that pairing is to hand.
  const [gtTarget, setGtTarget] = useState(null);
  // How many weakly-recognised students each semester group is showing. Absent
  // means the default page. Kept per (department, semester) rather than as one
  // number, so opening up one semester does not expand every other one.
  const [shownBySem, setShownBySem] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  // Department picker is for full-access admins only; a dept admin is locked
  // to their own department (and the server enforces that regardless).
  useEffect(() => {
    if (fixedDepartment) return;
    fetch(`${GT_API}/departments`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setDepartments(
          (d.departments || [])
            .map((item) => (typeof item === 'string' ? item : item.dept))
            .filter(Boolean),
        );
      })
      .catch(() => {});
  }, [fixedDepartment]);

  // Keyed on department AND semester: two departments can both have a
  // "Semester 5", and paging one must not page the other.
  const semKey = (department, semester) => `${department}||${semester}`;

  const shownFor = (department, group) =>
    shownBySem[semKey(department, group.semester)] ?? WEAK_STUDENT_PAGE;

  const showMore = (department, semester) =>
    setShownBySem((prev) => {
      const key = semKey(department, semester);
      return { ...prev, [key]: (prev[key] ?? WEAK_STUDENT_PAGE) + WEAK_STUDENT_PAGE };
    });

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ days, minReviews });
      if (dept) qs.set('department', dept);
      const res = await fetch(`${REPORTS_API}/review-audit?${qs}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || 'Failed to fetch');
      setData(json);
      setExpanded(new Set());
      // A new window or department is a different list; carrying the old
      // expansion over would show ten rows of one semester and forty of
      // another for no reason the reader can see.
      setShownBySem({});
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }, [days, minReviews, dept, showToast]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const matchesSearch = (rollNo) =>
    !search || rollNo.toLowerCase().includes(search.toLowerCase());

  // Every cut that carries roll numbers gets the search applied, and a
  // department survives if ANY cut still has something in it.
  //
  // This used to filter and test only alwaysReview and repeatReview. Those two
  // are the strictest cuts on the page — never present in any run; flagged
  // three times inside one subject — so a department whose only signal was a
  // flagged class, a weak period or a weakly recognised student was dropped
  // here and every section below rendered its empty state. That is the same
  // shape of bug as the server-side one in getReviewAudit, in the layer after
  // it, and fixing only the server left the page just as blank.
  const deptBlocks = (data?.departments || [])
    .map((d) => ({
      ...d,
      alwaysReview: (d.alwaysReview || []).filter((s) => matchesSearch(s.rollNo)),
      repeatReview: (d.repeatReview || []).filter((s) => matchesSearch(s.rollNo)),
      classes: (d.classes || [])
        .map((cls) => ({
          ...cls,
          students: (cls.students || []).filter((s) => matchesSearch(s.rollNo)),
        }))
        .filter((cls) => cls.students.length),
      weakStudents: (d.weakStudents || [])
        .map((group) => ({
          ...group,
          students: (group.students || []).filter((s) => matchesSearch(s.rollNo)),
        }))
        .filter((group) => group.students.length),
      // Periods hold no roll numbers, so a roll-number search cannot say
      // anything about them; showing every period while the student tables are
      // filtered down to one row reads as a bug. Unfiltered, they stay.
      periods: search ? [] : (d.periods || []),
    }))
    .filter((d) =>
      d.alwaysReview.length || d.repeatReview.length
      || d.classes.length || d.weakStudents.length || d.periods.length);

  // "12-05 · Period 3 — 10:20–11:10 · DSP · LT103"
  const sessionRows = (sessions) => (
    <table className="cm-table cm-session-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Subject</th>
          <th>Period</th>
          <th>Room</th>
          <th>Faculty</th>
          <th>Conf</th>
          <th>ERP</th>
          <th>Report</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s, i) => (
          <tr key={`${s.date}-${s.timeSlot}-${s.subject}-${i}`}>
            <td style={{ fontFamily: theme.fontMono }}>{s.date}</td>
            <td style={{ fontWeight: 600 }}>{s.subject || '—'}</td>
            <td>{slotLabel(s.timeSlot) || s.timeSlot || '—'}</td>
            <td>{s.room || '—'}</td>
            <td>{s.faculty || '—'}</td>
            <td style={{ textAlign: 'center' }}>
              {s.confidence > 0 ? (
                <span
                  className="cm-conf-cell"
                  style={{
                    background: confidenceBg(s.confidence),
                    color: confidenceColor(s.confidence),
                  }}
                >
                  {(s.confidence * 100).toFixed(0)}%
                </span>
              ) : (
                <span style={{ color: theme.textMuted }}>—</span>
              )}
            </td>
            <td>
              {s.reportId ? (
                <button
                  type="button"
                  className="cm-link"
                  title="Open this attendance report"
                  onClick={() => navigate(reportDetailPath(s.reportId, location.pathname))}
                >
                  Open
                </button>
              ) : (
                // Reviews recorded before reportId was carried on a session.
                <span style={{ color: theme.border }}>·</span>
              )}
            </td>
            <td>
              {s.erpOverriddenStatus ? (
                <span className="normal-badge">→ {s.erpOverriddenStatus}</span>
              ) : (
                <span style={{ color: theme.border }}>·</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <section style={{ ...styles.card, marginBottom: 18 }}>
        <div className="cm-controls-row">
          <div style={{ minWidth: 200, flex: '2 1 200px' }}>
            <label style={styles.label}>Department</label>
            {fixedDepartment ? (
              <div
                style={{
                  ...styles.select,
                  display: 'flex',
                  alignItems: 'center',
                  background: theme.surfaceAlt,
                  color: theme.textMuted,
                  cursor: 'not-allowed',
                }}
              >
                {fixedDepartment.replace(/_/g, ' ')}
              </div>
            ) : (
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                style={styles.select}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ minWidth: 130, flex: '1 1 130px' }}>
            <label style={styles.label}>Time Range</label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={styles.select}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          <div style={{ minWidth: 150, flex: '1 1 150px' }}>
            <label style={styles.label}>Repeat threshold</label>
            <select
              value={minReviews}
              onChange={(e) => setMinReviews(e.target.value)}
              style={styles.select}
            >
              <option value="2">2+ reviews in a subject</option>
              <option value="3">3+ reviews in a subject</option>
              <option value="5">5+ reviews in a subject</option>
            </select>
          </div>

          <div style={{ minWidth: 160, flex: '1 1 160px' }}>
            <label style={styles.label}>Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Roll number..."
              maxLength={12}
              style={styles.input}
            />
          </div>

          <button
            className="cm-fetch-btn"
            onClick={fetchAudit}
            disabled={loading}
            style={{
              ...styles.btnPrimary,
              opacity: loading ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {data && (
          <div style={{ marginTop: 12, fontSize: 11, color: theme.textMuted }}>
            Completed class runs since{' '}
            <strong style={{ color: theme.text, fontFamily: theme.fontMono }}>
              {data.from}
            </strong>{' '}
            · {data.stats.studentsScanned} students scanned ·{' '}
            <strong style={{ color: theme.danger }}>
              {data.stats.alwaysReviewStudents}
            </strong>{' '}
            never marked present ·{' '}
            <strong style={{ color: theme.warning }}>
              {data.stats.repeatReviewRows}
            </strong>{' '}
            repeat-review student/subject pairs ·{' '}
            <strong style={{ color: theme.warning }}>
              {data.stats.weakPeriods ?? 0}
            </strong>{' '}
            of {data.stats.periodsScanned ?? 0} periods more yellow than green ·{' '}
            <strong style={{ color: theme.warning }}>
              {data.stats.weakStudents ?? 0}
            </strong>{' '}
            students mostly yellow in the last {data.stats.zoneDays ?? 7} days
          </div>
        )}
      </section>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 48, color: theme.textMuted }}>
          Loading review audit...
        </div>
      )}

      {data && deptBlocks.length === 0 && (
        <section style={styles.card}>
          <div style={{ color: theme.textMuted, fontSize: 13 }}>
            No review-only or repeat-review students in this window. Nothing to
            fix — or no completed class runs yet.
          </div>
        </section>
      )}

      {gtTarget && (
        <StudentGroundTruthModal
          batch={gtTarget.batch}
          rollNo={gtTarget.rollNo}
          onClose={() => setGtTarget(null)}
          onSaved={() => {
            // Re-run the audit: fixing the enrolled faces is the point of
            // opening it, and the counts here are what said it was needed.
            setGtTarget(null);
            fetchAudit();
          }}
        />
      )}

      {deptBlocks.map((d) => (
        <section
          key={d.department}
          style={{ ...styles.card, marginBottom: 18 }}
        >
          <div className="sem-header">
            <span className="sem-badge">{d.department.replace(/_/g, ' ')}</span>
            <span style={{ fontSize: 11, color: theme.danger, fontWeight: 700 }}>
              Review-only: {d.alwaysReview.length}
            </span>
            <span style={{ fontSize: 11, color: theme.warning, fontWeight: 700 }}>
              Repeat ({data.minReviews}+): {d.repeatReview.length}
            </span>
          </div>

          {/* 0aa. Which STUDENT is weak, folded across every period.
                 One row per roll number — the same student showing up under
                 six period headings is six chances to miss that it is one
                 person. Ranked by how many DIFFERENT periods they come out
                 yellow in, because that is what separates the two causes: a
                 student yellow repeatedly in one slot is probably sitting at
                 the back of that room, while the same student yellow across
                 unrelated hours is an enrolment photo problem, and only the
                 second is worth re-enrolling over. */}
          <div style={{ marginBottom: 24 }}>
            <div className="cm-subhead">
              Students recognised weakly — more yellow than green over the last{' '}
              {data.zoneDays ?? 7} days, most affected periods first
            </div>
            {(d.weakStudents || []).length === 0 ? (
              <div className="cm-empty">
                Every recognised student came out green more often than yellow.
              </div>
            ) : (
              (d.weakStudents || []).map((group) => (
                <div key={group.semester} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.text,
                      margin: '10px 0 6px',
                    }}
                  >
                    Semester {group.semester}
                    <span style={{ fontWeight: 400, color: theme.textMuted, marginLeft: 8 }}>
                      {group.students.length > WEAK_STUDENT_PAGE
                        ? `showing ${Math.min(shownFor(d.department, group), group.weakStudents)} of ${group.weakStudents} students`
                        : `${group.weakStudents} student${group.weakStudents === 1 ? '' : 's'}`}
                      {' · '}
                      <span style={{ color: theme.warning }}>{group.yellow} yellow</span>
                      {' / '}
                      <span style={{ color: theme.success }}>{group.green} green</span>
                    </span>
                  </div>
                  <table className="cm-table">
                    <thead>
                      <tr>
                        <th>Roll no</th>
                        <th>Periods affected</th>
                        <th>Runs seen</th>
                        <th>Green</th>
                        <th>Yellow</th>
                        <th>Where</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.students.slice(0, shownFor(d.department, group)).map((st) => (
                        <tr key={st.rollNo}>
                          <td style={{ fontFamily: theme.fontMono, fontWeight: 600 }}>
                            {/* Straight to the enrolled faces. A student yellow
                                across unrelated periods is almost always bad
                                ground truth, so the fix is one click from the
                                number that says so — same link as the cuts
                                below. */}
                            {st.batch ? (
                              <button
                                type="button"
                                className="cm-link"
                                title={`Open ground truth photos for ${st.rollNo}`}
                                onClick={() => setGtTarget({ batch: st.batch, rollNo: st.rollNo })}
                              >
                                {st.rollNo}
                              </button>
                            ) : (
                              // No batch recorded — the modal loads by
                              // (batch, rollNo) and would open empty.
                              <span title="No batch recorded for this student">{st.rollNo}</span>
                            )}
                          </td>
                          <td>
                            <span className="low-badge">
                              {st.weakPeriods} of {st.periodsSeen}
                            </span>
                          </td>
                          <td>{st.seen}</td>
                          <td style={{ color: theme.success, fontWeight: 600 }}>
                            {st.greenPct}% <span style={{ color: theme.textMuted, fontWeight: 400 }}>({st.green})</span>
                          </td>
                          <td style={{ color: theme.warning, fontWeight: 600 }}>
                            {st.yellowPct}% <span style={{ color: theme.textMuted, fontWeight: 400 }}>({st.yellow})</span>
                          </td>
                          <td style={{ fontSize: 11, color: theme.textMuted }}>
                            {/* The periods themselves, worst first — the detail
                                that says whether this is one room or all of
                                them, without giving the student a row per
                                period. */}
                            {st.periods.map((prd) => (
                              <div key={prd.timeSlot}>
                                <span style={{
                                  fontFamily: theme.fontMono,
                                  color: prd.weak ? theme.warning : theme.textMuted,
                                }}>
                                  {prd.timeSlot}
                                </span>
                                {' '}
                                {prd.yellow}Y/{prd.green}G
                                {prd.rooms.length ? ` · ${prd.rooms.join(', ')}` : ''}
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {group.students.length > shownFor(d.department, group) && (
                    <button
                      type="button"
                      className="cm-link"
                      style={{ marginTop: 6, fontSize: 12 }}
                      onClick={() => showMore(d.department, group.semester)}
                    >
                      Show{' '}
                      {Math.min(
                        WEAK_STUDENT_PAGE,
                        group.students.length - shownFor(d.department, group),
                      )}{' '}
                      more — {group.students.length - shownFor(d.department, group)} still
                      hidden in semester {group.semester}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 0a. Which HOUR is weak, by confidence zone rather than by the
                 merge's verdict.
                 Everything below reads finalStatus, and the merge promotes a
                 medium-confidence sighting to Present — so a room full of
                 yellow zone chips produces zero on every other number here.
                 This reads the zones directly and asks a different question:
                 in this period, is the model more often unsure than sure?
                 Per period, not per subject, because a weak hour is usually
                 physical — where the camera points, sun through a west window
                 at 3pm, lights off for a projector — and that belongs to a
                 time and a room rather than to a syllabus. */}
          <div style={{ marginBottom: 24 }}>
            <div className="cm-subhead">
              Recognition confidence by period — weakest hour first
            </div>
            {(d.periods || []).length === 0 ? (
              <div className="cm-empty">
                No recognised students in this window, so there is no confidence
                split to report.
              </div>
            ) : (
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Rooms</th>
                    <th>Recognised</th>
                    <th>Green (high)</th>
                    <th>Yellow (medium)</th>
                    <th>Low</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.periods || []).map((p) => (
                    <tr
                      key={p.timeSlot}
                      style={p.weak ? { background: 'rgba(245,158,11,0.07)' } : undefined}
                    >
                      <td style={{ fontFamily: theme.fontMono }}>{p.timeSlot}</td>
                      <td style={{ fontSize: 11, color: theme.textMuted }}>
                        {/* Named rather than counted: a period that is weak in
                            one room only is a camera, not an hour. */}
                        {p.rooms.map((r) => r.room).join(', ')}
                      </td>
                      <td>{p.seen}</td>
                      <td style={{ color: theme.success, fontWeight: 600 }}>
                        {p.highPct}% <span style={{ color: theme.textMuted, fontWeight: 400 }}>({p.high})</span>
                      </td>
                      <td style={{ color: theme.warning, fontWeight: 600 }}>
                        {p.mediumPct}% <span style={{ color: theme.textMuted, fontWeight: 400 }}>({p.medium})</span>
                      </td>
                      <td style={{ color: theme.textMuted }}>
                        {p.lowPct}% ({p.low})
                      </td>
                      <td>
                        {p.weak ? (
                          <span className="low-badge">
                            yellow leads by {p.margin} pts
                          </span>
                        ) : (
                          <span style={{ color: theme.textMuted, fontSize: 11 }}>ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 0. Who is yellow in each class, most-flagged first.
                 This is the view a coordinator holding one subject wants: the
                 two cuts below diagnose students, this one diagnoses a class.
                 No threshold — the ranking is the triage, so the student
                 flagged twice in an otherwise clean class still shows up. */}
          <div style={{ marginBottom: 24 }}>
            <div className="cm-subhead">
              Flagged for review, by class — most-flagged student first
            </div>
            {(d.classes || []).length === 0 ? (
              <div className="cm-empty">Nobody was marked for review in this window.</div>
            ) : (
              (d.classes || []).map((cls) => {
                const visible = cls.students.filter((st) => matchesSearch(st.rollNo));
                if (!visible.length) return null;
                return (
                  <div key={`${d.department}-${cls.subject}`} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'baseline', gap: 10,
                        flexWrap: 'wrap', marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>
                        {cls.subjectName || cls.subject}
                      </span>
                      {cls.subjectCode && (
                        <span style={{ fontSize: 11, color: theme.textMuted, fontFamily: theme.fontMono }}>
                          {cls.subjectCode}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: theme.warning, fontWeight: 700 }}>
                        {cls.reviewTotal} review{cls.reviewTotal === 1 ? '' : 's'}
                        {' '}across {visible.length} student{visible.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table className="cm-table">
                        <thead>
                          <tr>
                            <th />
                            <th>Roll No</th>
                            <th>Sem</th>
                            <th>Runs</th>
                            <th>Yellow</th>
                            <th>Present</th>
                            <th>Absent</th>
                            <th>Latest review</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((st) => {
                            const key = `c-${d.department}-${cls.subject}-${st.rollNo}`;
                            const open = expanded.has(key);
                            // Sessions arrive newest-first from the server.
                            const latest = st.sessions && st.sessions[0];
                            return [
                              <tr key={key}>
                                <td>
                                  <button
                                    className="cm-expand-btn"
                                    onClick={() => toggle(key)}
                                    aria-label={open ? 'Collapse' : 'Expand'}
                                  >
                                    {open ? '▾' : '▸'}
                                  </button>
                                </td>
                                <td style={{ fontWeight: 700, fontFamily: theme.fontMono }}>
                                  {/* The roll number IS the link to their
                                      enrolled faces — bad ground truth is the
                                      usual reason a student keeps going
                                      yellow, so it is one click from the
                                      count that says so. */}
                                  {st.batch ? (
                                    <button
                                      type="button"
                                      className="cm-link"
                                      title={`Open ground truth photos for ${st.rollNo}`}
                                      onClick={() => setGtTarget({ batch: st.batch, rollNo: st.rollNo })}
                                    >
                                      {st.rollNo}
                                    </button>
                                  ) : (
                                    // No batch recorded — the modal loads by
                                    // (batch, rollNo) and would open empty.
                                    <span title="No batch recorded for this student">{st.rollNo}</span>
                                  )}
                                </td>
                                <td>{st.semester || '—'}</td>
                                <td style={{ textAlign: 'center' }}>{st.runs}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="low-badge">{st.review}</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>{st.present}</td>
                                <td style={{ textAlign: 'center' }}>{st.absent}</td>
                                <td style={{ fontSize: 11 }}>
                                  {latest ? (
                                    latest.reportId ? (
                                      <button
                                        type="button"
                                        className="cm-link"
                                        title="Open the most recent report where this student was marked for review"
                                        onClick={() => navigate(reportDetailPath(latest.reportId, location.pathname))}
                                      >
                                        {latest.date} · {slotLabel(latest.timeSlot) || latest.timeSlot}
                                      </button>
                                    ) : (
                                      <span style={{ color: theme.textMuted }}>
                                        {latest.date} · {slotLabel(latest.timeSlot) || latest.timeSlot}
                                      </span>
                                    )
                                  ) : (
                                    <span style={{ color: theme.textMuted }}>—</span>
                                  )}
                                </td>
                              </tr>,
                              open && (
                                <tr key={`${key}-d`}>
                                  <td colSpan={8} style={{ background: theme.surfaceAlt }}>
                                    {sessionRows(st.sessions)}
                                  </td>
                                </tr>
                              ),
                            ];
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 1. Never present in any completed run */}
          <div style={{ marginBottom: 24 }}>
            <div className="cm-subhead">
              Marked for review only — not present in a single completed class
              run
            </div>
            {d.alwaysReview.length === 0 ? (
              <div className="cm-empty">None.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Roll No</th>
                      <th>Batch</th>
                      <th>Sem</th>
                      <th>Runs</th>
                      <th>Reviews</th>
                      <th>Absents</th>
                      <th>Subjects</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.alwaysReview.map((s) => {
                      const key = `a-${d.department}-${s.rollNo}`;
                      const open = expanded.has(key);
                      return [
                        <tr key={key}>
                          <td>
                            <button
                              className="cm-expand-btn"
                              onClick={() => toggle(key)}
                              aria-label={open ? 'Collapse' : 'Expand'}
                            >
                              {open ? '▾' : '▸'}
                            </button>
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              fontFamily: theme.fontMono,
                            }}
                          >
                            {s.rollNo}
                          </td>
                          <td style={{ fontSize: 11, color: theme.textMuted }}>
                            {s.batch}
                          </td>
                          <td>{s.semester || '—'}</td>
                          <td style={{ textAlign: 'center' }}>{s.runs}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="low-badge">{s.review}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{s.absent}</td>
                          <td style={{ fontSize: 11 }}>
                            {s.subjects.join(', ') || '—'}
                          </td>
                        </tr>,
                        open && (
                          <tr key={`${key}-d`}>
                            <td colSpan={8} style={{ background: theme.surfaceAlt }}>
                              {sessionRows(s.sessions)}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Repeat reviews inside one subject */}
          <div>
            <div className="cm-subhead">
              Marked for review {data.minReviews}+ times in the same subject
            </div>
            {d.repeatReview.length === 0 ? (
              <div className="cm-empty">None.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Roll No</th>
                      <th>Sem</th>
                      <th>Subject</th>
                      <th>Code</th>
                      <th>Runs</th>
                      <th>Reviews</th>
                      <th>Present</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.repeatReview.map((s) => {
                      const key = `r-${d.department}-${s.rollNo}-${s.subject}`;
                      const open = expanded.has(key);
                      return [
                        <tr key={key}>
                          <td>
                            <button
                              className="cm-expand-btn"
                              onClick={() => toggle(key)}
                              aria-label={open ? 'Collapse' : 'Expand'}
                            >
                              {open ? '▾' : '▸'}
                            </button>
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              fontFamily: theme.fontMono,
                            }}
                          >
                            {s.rollNo}
                          </td>
                          <td>{s.semester || '—'}</td>
                          <td style={{ fontWeight: 600 }}>
                            {s.subjectName || s.subject}
                          </td>
                          <td
                            style={{
                              fontSize: 11,
                              fontFamily: theme.fontMono,
                              color: theme.textMuted,
                            }}
                          >
                            {s.subjectCode || '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>{s.runs}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="low-badge">{s.review}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{s.present}</td>
                        </tr>,
                        open && (
                          <tr key={`${key}-d`}>
                            <td colSpan={8} style={{ background: theme.surfaceAlt }}>
                              {sessionRows(s.sessions)}
                            </td>
                          </tr>
                        ),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}
    </>
  );
}

// Main Component

export default function ConfidenceMonitor({ fixedDepartment = '' }) {
  const [degree, setDegree] = useState('BTECH');
  const [degrees, setDegrees] = useState([]);
  const [years, setYears] = useState([]);
  const [yearsLoading, setYearsLoading] = useState(false);
  const [dept, setDept] = useState(fixedDepartment);
  const [year, setYear] = useState('');
  const [departments, setDepts] = useState([]);
  const [days, setDays] = useState('60');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [depsLoading, setDepsLoading] = useState(false);
  const [filter, setFilter] = useState('low'); // 'low' | 'normal' | 'high' | 'undefined' | 'all'
  const [search, setSearch] = useState('');
  // Review audit leads — it is the actionable list; the per-day confidence
  // grid behind it is the deep dive.
  const [tab, setTab] = useState(() => readSubtabFromSearch(
    ['review', 'trend'],
    'review',
  )); // 'review' | 'trend'
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'error') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const fetchDegrees = async () => {
      const url = `${apiUrl}/attendancemodule/settings/batches/degrees`
      const res = await fetch(url, {credentials: "include"})
      const data = await res.json();
      setDegrees(data.degrees);
      console.log(data.degrees)
  }

  useEffect(() => {
      fetchDegrees();
  }, [])

  // Fetch batch years from the Batch model (DB) on mount
  useEffect(() => {
    setYearsLoading(true);
    fetch(BATCHES_API)
      .then((r) => r.json())
      .then((d) => {
        const batchYears = (d.batches || [])
          .map((b) => b.batchYear)
          .filter(Boolean)
          .sort((a, b) => b.localeCompare(a));
        setYears(batchYears);
      })
      .catch(() => showToast('Could not load batch years'))
      .finally(() => setYearsLoading(false));
  }, []);

  // Fetch departments when degree changes
  useEffect(() => {
    if (!degree) {
      setDepts([]);
      setDept(fixedDepartment || '');
      return;
    }
    setDepsLoading(true);
    fetch(`${GT_API}/departments`)
      .then((r) => r.json())
      .then((d) => {
        const depts = (d.departments || [])
          .map((item) => (typeof item === 'string' ? item : item.dept))
          .filter(Boolean);
        setDepts(depts);
        setDept(fixedDepartment || '');
      })
      .catch(() => showToast('Could not load departments'))
      .finally(() => setDepsLoading(false));
  }, [degree, fixedDepartment]);

  const batch =
    degree && dept && year
      ? `${degree}_${dept.trim().replace(/\s+/g, '_').toUpperCase()}_${year}`
      : '';

  const fetchTrend = useCallback(async () => {
    if (!batch) {
      showToast('Select degree, department and year first');
      return;
    }
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(
        `${REPORTS_API}/confidence-trend?batch=${encodeURIComponent(batch)}&days=${days}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch');
      setData(json);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }, [batch, days, showToast]);

  // Derived data
  const students = data?.students || [];

  // Flag students whose average non-zero confidence is below threshold
  const enriched = students.map((s) => {
    const nonZero = s.confidences.filter((c) => c.confidence > 0);
    const avgConf =
      nonZero.length > 0
        ? nonZero.reduce((sum, c) => sum + c.confidence, 0) / nonZero.length
        : 0;
    const isLowConf = avgConf > 0 && avgConf < LOW_CONF_THRESHOLD;
    const semester = s.semester ?? 'N/A';
    return { ...s, avgConf, isLowConf, semester };
  });

  const allDates = [
    ...new Set(students.flatMap((s) => s.confidences.map((c) => c.date))),
  ].sort();

  const sorted = [...enriched].sort((a, b) => {
    if (a.avgConf !== b.avgConf) return a.avgConf - b.avgConf;
    return a.rollNo.localeCompare(b.rollNo);
  });

  const filtered = sorted.filter((s) => {
    if (filter !== 'all' && confBand(s.avgConf) !== filter) return false;
    if (search && !s.rollNo.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // Group filtered students by semester (preserving global avgConf ordering).
  const semesterOrder = [...new Set(enriched.map((s) => s.semester))].sort(
    (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }),
  );

  const semesterGroups = semesterOrder.map((sem) => {
    const semAll = enriched.filter((s) => s.semester === sem);
    const semFiltered = filtered.filter((s) => s.semester === sem);
    const bandCounts = semAll.reduce((acc, s) => {
      const b = confBand(s.avgConf);
      acc[b] = (acc[b] || 0) + 1;
      return acc;
    }, {});
    return { sem, semFiltered, bandCounts, total: semAll.length };
  });

  const BAND_DEFS = [
    { key: 'low', label: 'Low', color: theme.danger },
    { key: 'normal', label: 'Normal', color: theme.warning },
    { key: 'high', label: 'High', color: theme.success },
    { key: 'undefined', label: 'Undefined', color: theme.textMuted },
    { key: 'all', label: 'All', color: theme.accent },
  ];

  return (
    <div style={styles.page}>
      <style>{`
                ${cssReset}
                .cm-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .cm-table th {
                    background: ${theme.surfaceAlt};
                    color: ${theme.textMuted};
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    padding: 10px 12px;
                    border-bottom: 1px solid ${theme.border};
                    text-align: left;
                    white-space: nowrap;
                }
                .cm-table td {
                    padding: 9px 12px;
                    border-bottom: 1px solid ${theme.border};
                    vertical-align: middle;
                }
                .cm-table tr:last-child td { border-bottom: none; }
                .cm-table tr:hover td { background: ${theme.surfaceAlt}; }
                .cm-conf-cell {
                    text-align: center;
                    border-radius: 5px;
                    padding: 3px 6px;
                    font-weight: 600;
                    font-size: 11px;
                    min-width: 44px;
                    display: inline-block;
                }
                .low-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    background: ${theme.dangerDim};
                    color: ${theme.danger};
                    border: 1px solid rgba(239,68,68,0.25);
                }
                .normal-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 700;
                    background: ${theme.successDim};
                    color: ${theme.success};
                    border: 1px solid rgba(16,185,129,0.25);
                }
                .cm-controls-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 14px;
                    align-items: flex-end;
                }
                .cm-controls-row .cm-fetch-btn {
                    flex-shrink: 0;
                    align-self: flex-end;
                }
                .sem-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-bottom: 10px;
                }
                .sem-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 14px;
                    border-radius: 8px;
                    background: ${theme.accentDim};
                    border: 1px solid rgba(99,102,241,0.2);
                    font-size: 13px;
                    font-weight: 700;
                    color: ${theme.accent};
                    margin-right: 4px;
                }
                .sem-split-btn {
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    border: 1px solid transparent;
                    background: transparent;
                    padding: 4px 10px;
                    border-radius: 6px;
                    transition: all 0.15s;
                }
                .sem-split-btn:hover {
                    background: ${theme.surfaceAlt};
                }
                .sem-split-btn.active {
                    background: ${theme.surfaceAlt};
                    border-color: currentColor;
                }
                .sem-search-wrap {
                    margin-left: auto;
                    flex: 1 1 200px;
                    max-width: 240px;
                }
                @media (max-width: 640px) {
                    .sem-search-wrap {
                        margin-left: 0;
                        flex: 1 1 100%;
                        max-width: none;
                    }
                }
                .cm-tabs {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                    margin-bottom: 18px;
                    border-bottom: 1px solid ${theme.border};
                }
                .cm-tab-option {
                    display: inline-flex;
                    align-items: stretch;
                    flex-shrink: 0;
                }
                .cm-tab {
                    padding: 10px 4px 10px 18px;
                    font-size: 13px;
                    font-weight: 700;
                    color: ${theme.textMuted};
                    background: transparent;
                    border: none;
                    border-bottom: 2px solid transparent;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .cm-tab:hover { color: ${theme.text}; }
                .cm-tab.active {
                    color: ${theme.accent};
                    border-bottom-color: ${theme.accent};
                }
                .cm-subhead {
                    font-size: 12px;
                    font-weight: 700;
                    color: ${theme.text};
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 8px;
                }
                .cm-empty {
                    padding: 10px 0;
                    font-size: 12px;
                    color: ${theme.textMuted};
                }
                .cm-link {
                    background: none;
                    border: none;
                    padding: 0;
                    font: inherit;
                    color: ${theme.accent};
                    font-weight: 700;
                    cursor: pointer;
                    text-decoration: underline;
                    text-underline-offset: 2px;
                }
                .cm-link:hover { color: ${theme.text}; }
                .cm-expand-btn {
                    border: none;
                    background: transparent;
                    color: ${theme.accent};
                    font-size: 12px;
                    cursor: pointer;
                    padding: 2px 4px;
                }
                .cm-session-table {
                    background: ${theme.surface};
                    border: 1px solid ${theme.border};
                    border-radius: 8px;
                    margin: 4px 0;
                }
                .cm-session-table th { background: ${theme.surface}; }
            `}</style>

      <Toast toast={toast} />

      {/* Single line title */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: theme.text,
          marginBottom: 18,
        }}
      >
        Student Confidence Monitor
      </div>

      <div className="cm-tabs">
        {[
          { value: 'review', label: 'Review Audit' },
          { value: 'trend', label: 'Confidence Trend' },
        ].map(({ value, label }) => (
          <span className="cm-tab-option" key={value}>
            <button
              type="button"
              className={`cm-tab ${tab === value ? 'active' : ''}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
            <SubtabNewTabButton
              value={value}
              label={label}
              active={tab === value}
              compact
            />
          </span>
        ))}
      </div>

      {tab === 'review' && (
        <ReviewAuditPanel
          fixedDepartment={fixedDepartment}
          showToast={showToast}
        />
      )}

      {tab === 'trend' && (
        <>
      {/* Controls */}
      <section style={{ ...styles.card, marginBottom: 18 }}>
        <div className="cm-controls-row">
          {/* Degree */}
          <div style={{ minWidth: 130, flex: '1 1 130px' }}>
            <label style={styles.label}>Degree</label>
            <select
              value={degree}
              onChange={(e) => {
                setDegree(e.target.value);
                setData(null);
              }}
              style={styles.select}
            >
              {degrees.map((d) => (
                <option key={d.degreeName} value={d.degreeName}>
                  {d.degreeName}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div style={{ minWidth: 200, flex: '2 1 200px' }}>
            <label style={styles.label}>Department</label>
            {fixedDepartment ? (
              <div style={{ ...styles.select, display: 'flex', alignItems: 'center', background: theme.surfaceAlt, color: theme.textMuted, cursor: 'not-allowed' }}>
                {fixedDepartment.replace(/_/g, ' ')}
              </div>
            ) : (
              <select
                value={dept}
                onChange={(e) => {
                  setDept(e.target.value);
                  setData(null);
                }}
                style={styles.select}
                disabled={!degree || depsLoading}
              >
                <option value="">
                  {depsLoading ? 'Loading...' : 'Select...'}
                </option>
                {departments.map((d) => {
                  const normalisedDepartment = d.replace(/_/g, " ")
                  const selectedDegree = degrees.find(d => d.degreeName === degree);
                  const branch = selectedDegree?.branches?.find( b => b.dept === normalisedDepartment );
                  return (
                        <option key={d} value={d}>
                            {branch?.branchName || normalisedDepartment}
                        </option>
                    );
              })}
              </select>
            )}
          </div>

          {/* Year */}
          <div style={{ minWidth: 110, flex: '1 1 110px' }}>
            <label style={styles.label}>Year</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setData(null);
              }}
              style={styles.select}
              disabled={!dept || yearsLoading}
            >
              <option value="">
                {yearsLoading ? 'Loading...' : 'Select...'}
              </option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Time range */}
          <div style={{ minWidth: 130, flex: '1 1 130px' }}>
            <label style={styles.label}>Time Range</label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              style={styles.select}
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>

          <button
            className="cm-fetch-btn"
            onClick={fetchTrend}
            disabled={loading || !batch}
            style={{
              ...styles.btnPrimary,
              opacity: loading || !batch ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Loading...' : 'Fetch Data'}
          </button>
        </div>

        {/* Batch preview */}
        {batch && (
          <div style={{ marginTop: 10, fontSize: 11, color: theme.textMuted }}>
            Batch:{' '}
            <strong style={{ color: theme.text, fontFamily: theme.fontMono }}>
              {batch}
            </strong>
          </div>
        )}
      </section>

      {/* Tables, grouped by semester */}
      {data && (
        <section style={styles.card}>
          {semesterGroups.map(
            ({ sem, semFiltered, bandCounts, total }, idx) => (
              <div
                key={sem}
                style={{
                  marginBottom: idx < semesterGroups.length - 1 ? 28 : 0,
                }}
              >
                <div className="sem-header">
                  <span className="sem-badge">Semester {sem}</span>
                  {BAND_DEFS.map((b) => (
                    <button
                      key={b.key}
                      className={`sem-split-btn ${filter === b.key ? 'active' : ''}`}
                      style={{ color: b.color }}
                      onClick={() => setFilter(b.key)}
                    >
                      {b.label}:{' '}
                      {b.key === 'all' ? total : bandCounts[b.key] || 0}
                    </button>
                  ))}
                  {idx === 0 && (
                    <div className="sem-search-wrap">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search roll number..."
                        maxLength={8}
                        style={{ ...styles.input, width: '100%' }}
                      />
                    </div>
                  )}
                </div>
                {semFiltered.length === 0 ? (
                  <div
                    style={{
                      padding: '16px 0',
                      color: theme.textMuted,
                      fontSize: 13,
                    }}
                  >
                    No students match this search.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="cm-table">
                      <thead>
                        <tr>
                          <th>Roll No</th>
                          <th>Avg Conf</th>
                          <th>Flag</th>
                          {allDates.map((d) => (
                            <th key={d}>{d.slice(5)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {semFiltered.map((student) => {
                          const confMap = {};
                          student.confidences.forEach((c) => {
                            confMap[c.date] = c.confidence;
                          });

                          return (
                            <tr key={student.rollNo}>
                              <td>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: theme.text,
                                    fontFamily: theme.fontMono,
                                    fontSize: 12,
                                  }}
                                >
                                  {student.rollNo}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {student.avgConf > 0 ? (
                                  <span
                                    className="cm-conf-cell"
                                    style={{
                                      background: confidenceBg(student.avgConf),
                                      color: confidenceColor(student.avgConf),
                                    }}
                                  >
                                    {(student.avgConf * 100).toFixed(0)}%
                                  </span>
                                ) : (
                                  <span style={{ color: theme.textMuted }}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                {student.isLowConf ? (
                                  <span className="low-badge">
                                    ⚠ Needs GT Fix
                                  </span>
                                ) : (
                                  <span className="normal-badge">✓ OK</span>
                                )}
                              </td>
                              {allDates.map((d) => {
                                const val = confMap[d];
                                return (
                                  <td key={d} style={{ textAlign: 'center' }}>
                                    {val !== undefined ? (
                                      val > 0 ? (
                                        <span
                                          className="cm-conf-cell"
                                          style={{
                                            background: confidenceBg(val),
                                            color: confidenceColor(val),
                                          }}
                                        >
                                          {(val * 100).toFixed(0)}%
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            color: theme.textMuted,
                                            fontSize: 11,
                                          }}
                                        >
                                          0
                                        </span>
                                      )
                                    ) : (
                                      <span style={{ color: theme.border }}>
                                        ·
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ),
          )}
        </section>
      )}

      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            color: theme.textMuted,
            fontSize: 14,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `3px solid ${theme.border}`,
              borderTopColor: theme.accent,
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          Loading confidence data...
        </div>
      )}
        </>
      )}
    </div>
  );
}
