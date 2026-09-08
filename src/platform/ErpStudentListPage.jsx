// client/src/platform/ErpStudentListPage.jsx
//
// Everyone the attendance cameras have face photos for, and which account may
// open them.
//
// A roll number is on this list because there is a ground_truth folder for it
// on disk — nothing else puts it there. The name, official address and branch
// beside it come from the student account the learning module's ERP roster
// import maintains, joined on the roll number. That pairing is what lets a
// student open their own attendance photos and nobody else's.
//
// There is nothing to sync and nothing to upload. Both used to be here: a
// spreadsheet paste, and a "Sync N students" button that copied the same
// columns across from the account records. Either way the list was a third
// copy of data the platform already held, and only as fresh as the last press
// of the button. The server now recomputes the join on read.
//
// A row with no name or address is a folder whose roll number matches no
// student account — photos on disk that nobody can claim. Those are shown
// rather than hidden, because they are the rows worth acting on.
//
// Institute-level rather than per-department because the list carries every
// student's address; the route enforces the same
// (erpStudentRosterRoutes.js).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import getEnvironment from '../getenvironment';
import { theme as T, cssReset } from '../attendancemodule/config';
import StudentGroundTruthModal from '../attendancemodule/StudentGroundTruthModal';

const ROSTER_BASE = `${getEnvironment()}/attendancemodule/erp-roster`;

const CSS = `
  ${cssReset}
  .er-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 6px rgba(26,31,60,0.05); margin-bottom: 18px; }
  .er-card-header { padding: 14px 18px; border-bottom: 1px solid ${T.border}; background: ${T.surfaceAlt}; font-size: 11px; color: ${T.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .er-card-body { padding: 20px; }
  .er-hint { font-size: 12px; color: ${T.textMuted}; margin-top: 8px; line-height: 1.55; }

  .er-btn { padding: 7px 14px; border-radius: 7px; border: none; font-weight: 600; font-size: 12px; cursor: pointer; font-family: ${T.fontBody}; display: inline-flex; align-items: center; gap: 6px; }
  .er-btn:hover { opacity: .85; }
  .er-btn:disabled { opacity: .45; cursor: not-allowed; }
  .er-btn-primary { background: ${T.accent}; color: #fff; }
  .er-btn-ghost { background: transparent; border: 1px solid ${T.border}; color: ${T.textMuted}; }
  /* "This is the state you are already in", not "press this". Marked with a
     tick and a filled outline so the pair reads as a two-position switch
     rather than as two equally-available actions. */
  .er-btn-current { background: ${T.successDim}; border: 1px solid ${T.success}; color: ${T.success}; cursor: default; }
  .er-btn-current:hover { opacity: 1; }

  .er-input { padding: 8px 12px; border-radius: 7px; border: 1px solid ${T.border}; background: #f8f9fd; color: ${T.text}; font-family: ${T.fontBody}; font-size: 13px; outline: none; }
  .er-input:focus { border-color: ${T.borderFocus}; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }

  .er-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
  .er-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 12px 14px; }
  .er-stat-n { font-size: 21px; font-weight: 800; line-height: 1.1; }
  .er-stat-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: ${T.textMuted}; margin-top: 3px; }

  .er-filters { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 14px; }
  .er-table-scroll { overflow-x: auto; }
  .er-table-scroll .ams-table { min-width: 1080px; }
  .er-mono { font-family: ${T.fontMono}; }
  .er-linkbtn { background: none; border: none; padding: 0; font: inherit; color: ${T.accent}; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
  .er-linkbtn:hover { text-decoration-style: solid; }

  .er-pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .er-pill.ok { background: ${T.successDim}; color: ${T.success}; }
  .er-pill.warn { background: rgba(245,158,11,.12); color: #b45309; }
  .er-pill.none { background: #eef0f8; color: ${T.textMuted}; }
  .er-pill.bad { background: ${T.dangerDim}; color: ${T.danger}; }

  .er-stats.er-stats-5 { grid-template-columns: repeat(5, minmax(0,1fr)); }

  @media (max-width: 1100px) { .er-stats.er-stats-5 { grid-template-columns: repeat(3, minmax(0,1fr)); } }
  @media (max-width: 900px) { .er-stats, .er-stats.er-stats-5 { grid-template-columns: repeat(2, minmax(0,1fr)); } }
`;

async function patch(path, body) {
  const response = await fetch(`${ROSTER_BASE}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

async function get(path) {
  const response = await fetch(`${ROSTER_BASE}${path}`, { credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export default function ErpStudentListPage() {
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  // What the last request actually asked for. The search box is the only
  // filter that changes with every keystroke, so it is the only one worth
  // waiting on — a branch, a year or a page is one deliberate click, and
  // holding those for a quarter of a second just makes the page feel slow.
  const [searchedQ, setSearchedQ] = useState('');
  const [branch, setBranch] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  // Which row's update window is mid-flight. One at a time is enough: this is a
  // button an admin presses for one student who has asked.
  const [togglingRoll, setTogglingRoll] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  // Feedback for the update-window actions, shown beside them rather than at
  // the top of the page — a row action's result three screens up is a result
  // nobody sees.
  const [windowNotice, setWindowNotice] = useState(null);
  // The roster row whose ground-truth photos are open, or null. Only rows with
  // a batch can be opened — the photos live under it.
  const [gtTarget, setGtTarget] = useState(null);

  const limit = 50;

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(`${ROSTER_BASE}/summary`, { credentials: 'include' });
      if (response.ok) setSummary(await response.json());
    } catch (_) { /* the table below is the page; a missing summary is cosmetic */ }
  }, []);

  const loadStudents = useCallback(async (signal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (searchedQ.trim().length >= 2) params.set('q', searchedQ.trim());
      if (branch) params.set('branch', branch);
      if (batchYear) params.set('batchYear', batchYear);
      const response = await fetch(`${ROSTER_BASE}?${params}`, { credentials: 'include', signal });
      const data = await response.json().catch(() => ({}));
      setStudents(data.students || []);
      setTotal(data.total || 0);
      setOpenCount(data.openCount || 0);
      setUnmatchedCount(data.unmatchedCount || 0);
      setLoading(false);
    } catch (err) {
      // An aborted request is one a later keystroke replaced. Its answer is
      // for a search nobody is running any more, so it must not land in the
      // table — and the request that replaced it owns the spinner now, so the
      // spinner is left alone too.
      if (err.name !== 'AbortError') setLoading(false);
    }
  }, [page, searchedQ, branch, batchYear]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    if (q === searchedQ) return undefined;
    const timer = setTimeout(() => setSearchedQ(q), 250);
    return () => clearTimeout(timer);
  }, [q, searchedQ]);

  useEffect(() => {
    // Superseded requests are cancelled rather than raced. Without this, eight
    // keystrokes left eight requests in flight against one table, and whichever
    // came back last won — so the list could settle on the answer to a query
    // two letters ago.
    const controller = new AbortController();
    loadStudents(controller.signal);
    return () => controller.abort();
  }, [loadStudents]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  // Everything the update-window bar says about "now", derived from the same
  // filtered counts the buttons act on.
  const filtered = searchedQ.trim().length >= 2 || Boolean(branch) || Boolean(batchYear);
  const scopeNoun = filtered ? 'matching students' : 'students';
  const someOpen = openCount > 0;
  const allOpen = total > 0 && openCount === total;

  /**
   * Open or close one student's ground-truth update window.
   *
   * A student may re-pick the photos face recognition matches them against once
   * a week, because every change rebuilds the embeddings of every subject they
   * are enrolled in. This button waives that wait for one student — the case it
   * exists for is "my photos are wrong and I cannot wait until Friday", which
   * the office hears and the student cannot decide for themselves.
   *
   * The window it opens is single use: the student's own save closes it. So
   * "Close" here is for a window opened by mistake, not routine tidying up.
   *
   * The row is patched in place rather than the table reloaded: reloading would
   * cost the whole per-student photo scan listRoster does, to change one pill.
   */
  const toggleUpdateWindow = async (student) => {
    const open = !student.photoUpdatesOpen;
    setTogglingRoll(student.rollNo);
    try {
      const result = await patch(`/${encodeURIComponent(student.rollNo)}/photo-updates`, { open });
      setStudents((rows) => rows.map((row) => (row.rollNo === student.rollNo
        ? {
          ...row,
          photoUpdatesOpen: result.photoUpdatesOpen,
          photoUpdatesOpenedAt: result.photoUpdatesOpenedAt,
          photoUpdatesUsedAt: result.photoUpdatesUsedAt,
        }
        : row)));
      setOpenCount((count) => Math.max(0, count + (result.photoUpdatesOpen ? 1 : -1)));
      setWindowNotice({ text: result.message, ok: true });
      loadSummary();
    } catch (err) {
      setWindowNotice({ text: `Could not change ${student.rollNo}'s update window — ${err.message}`, ok: false });
    } finally {
      setTogglingRoll(null);
    }
  };

  /**
   * The same switch for everybody the table is currently showing.
   *
   * Scoped to the live filter, not to the collection: an admin who has narrowed
   * to one branch means that branch, and this is the one action on this page
   * that can cost a rebuild for every subject in the institute. The button says
   * which of the two it is about to do, and the confirm repeats the number,
   * because "open for all" read off a forgotten filter is the mistake worth
   * spending a click on.
   *
   * The filter travels in the body so the server rebuilds it with the same code
   * the table was listed with; sending a list of roll numbers instead would
   * only ever describe the fifty rows on this page.
   */
  const setAllUpdateWindows = async (open) => {
    const scope = filtered
      ? `the ${total} student${total === 1 ? '' : 's'} matching the current filter`
      : `all ${total} student${total === 1 ? '' : 's'} on the list`;
    const confirmed = window.confirm(open
      ? `Open a ground truth update window for ${scope}?\n\nEach one may then make a single change, `
        + 'and their window closes as soon as they save.'
      : `Close the update window for ${scope}?\n\nAnyone who has not used theirs yet loses it, and `
        + 'goes back to the once-a-week rule.');
    if (!confirmed) return;

    setBulkBusy(true);
    try {
      const result = await patch('/photo-updates', {
        open,
        // The searched text, not what is in the box: these buttons promise to
        // act on the rows the table is showing, and a letter typed a moment ago
        // has not reached the table yet.
        q: searchedQ.trim().length >= 2 ? searchedQ.trim() : '',
        branch,
        batchYear,
      });
      setWindowNotice({ text: result.message, ok: true });
      loadStudents();
      loadSummary();
    } catch (err) {
      setWindowNotice({ text: `Could not change those update windows — ${err.message}`, ok: false });
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px', fontFamily: T.fontBody, color: T.text }}>
      <style>{CSS}</style>

      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>ERP Student List</h1>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 18, maxWidth: 760, lineHeight: 1.6 }}>
        Everyone the cameras have face photos for. A roll number appears here because there is a
        ground truth folder for it on disk; the name and official address beside it come from that
        student&apos;s account. Nothing here changes attendance itself.
      </p>

      <div className="er-card">
        <div className="er-card-header">
          <span>How this list is built</span>
          {summary?.lastRefreshedAt && (
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>
              Identities last changed {new Date(summary.lastRefreshedAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="er-card-body">
          <div className="er-hint" style={{ marginTop: 0 }}>
            The ground truth folders on disk, joined to the student accounts the learning
            module&apos;s ERP roster import maintains — <strong>Name</strong>, <strong>Roll No.</strong>,{' '}
            <strong>Department</strong>, <strong>Official Email</strong>. The join is recomputed
            whenever this page loads, so there is nothing to sync and nothing to upload. Upload the
            ERP export on the learning module&apos;s Students page and it appears here.
          </div>
          {unmatchedCount > 0 && (
            <div className="er-hint">
              <strong>{unmatchedCount}</strong> folder{unmatchedCount === 1 ? '' : 's'} in this view
              {unmatchedCount === 1 ? ' matches' : ' match'} no student account, so nobody can open
              {unmatchedCount === 1 ? ' it' : ' them'} and no update window can be given. They are
              listed with no name or address.
            </div>
          )}
          {summary?.selfCorrected > 0 && (
            <div className="er-hint">
              {summary.selfCorrected} student account{summary.selfCorrected === 1 ? '' : 's'}{' '}
              changed their own roll number and {summary.selfCorrected === 1 ? 'is' : 'are'} not
              read — a self-typed roll number is not the ERP&apos;s answer, and keying on one would
              hand a student whichever classmate&apos;s roll number they typed. Re-running the ERP
              roster import overwrites it and brings them back.
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="er-stats er-stats-5">
          <div className="er-stat">
            <div className="er-stat-n">{summary.total}</div>
            <div className="er-stat-l">With attendance photos</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.selfUpdated}</div>
            <div className="er-stat-l">Have changed their photos</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.updatesOpen ?? 0}</div>
            <div className="er-stat-l">Update windows open</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.unmatched ?? 0}</div>
            <div className="er-stat-l">No student account</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.branches.length}</div>
            <div className="er-stat-l">Branches</div>
          </div>
        </div>
      )}

      <div className="er-card">
        <div className="er-card-header">
          <span>Students</span>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>{total} total</span>
        </div>
        <div className="er-card-body">
          <div className="er-filters">
            <input
              className="er-input"
              placeholder="Search roll number, name or email"
              value={q}
              onChange={(event) => { setQ(event.target.value); setPage(1); }}
              style={{ minWidth: 260 }}
            />
            <select
              className="er-input"
              value={branch}
              onChange={(event) => { setBranch(event.target.value); setPage(1); }}
            >
              <option value="">All branches</option>
              {(summary?.branches || []).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              className="er-input"
              value={batchYear}
              onChange={(event) => { setBatchYear(event.target.value); setPage(1); }}
            >
              <option value="">All years</option>
              {(summary?.batchYears || []).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
              padding: '12px 14px', marginBottom: 14,
              border: `1px solid ${T.border}`, borderRadius: 10, background: T.surfaceAlt,
            }}
          >
            <div style={{ flex: '1 1 420px' }}>
              {/* The state first, in a sentence, because it is the question an
                  admin arrives with — "is it open right now?" — and reading it
                  off which of two buttons is highlighted is a puzzle, not an
                  answer. */}
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                <span className={`er-pill ${allOpen ? 'ok' : someOpen ? 'warn' : 'none'}`} style={{ marginRight: 8 }}>
                  {allOpen ? 'All open' : someOpen ? 'Partly open' : 'All closed'}
                </span>
                {someOpen
                  ? `${openCount} of ${total} ${scopeNoun} ${openCount === 1 ? 'has' : 'have'} an update window open.`
                  : `No update windows are open — ${scopeNoun === 'students' ? 'everyone is' : 'all of them are'} on the once-a-week rule.`}
              </div>
              <div className="er-hint" style={{ marginTop: 6 }}>
                A student may re-pick the face photos the cameras match them against{' '}
                <strong>once a week</strong> — every change rebuilds the embeddings of every subject
                they are enrolled in, so it is not free. An open window waives that wait for{' '}
                <strong>one update</strong> and closes itself the moment that student saves. These
                buttons apply to{' '}
                <strong>
                  {filtered
                    ? `the ${total} student${total === 1 ? '' : 's'} matching the filters above`
                    : `all ${total} student${total === 1 ? '' : 's'} on the list`}
                </strong>, not only the rows on this page.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`er-btn ${allOpen ? 'er-btn-current' : 'er-btn-primary'}`}
                onClick={() => setAllUpdateWindows(true)}
                disabled={bulkBusy || loading || total === 0}
                title={allOpen
                  ? 'Every student in this list already has a window open.'
                  : 'Give each of these students one update, without waiting out the week.'}
              >
                {bulkBusy ? 'Working…' : allOpen ? '✓ Open for all' : 'Open for all'}
              </button>
              <button
                type="button"
                className={`er-btn ${openCount === 0 ? 'er-btn-current' : 'er-btn-ghost'}`}
                onClick={() => setAllUpdateWindows(false)}
                disabled={bulkBusy || loading || total === 0}
                title={openCount === 0
                  ? 'Nobody in this list has a window open.'
                  : 'Take back every unused window in this list.'}
              >
                {openCount === 0 ? '✓ Closed for all' : 'Close for all'}
              </button>
            </div>
          </div>

          {/* Beside the buttons, not only in the banner at the top of the page:
              a row action's result three screens up is a result nobody sees,
              which is indistinguishable from the button doing nothing. */}
          {windowNotice && (
            <div
              className="er-hint"
              style={{
                marginTop: 0, marginBottom: 14, padding: '9px 12px', borderRadius: 8,
                color: windowNotice.ok ? T.success : T.danger,
                background: windowNotice.ok ? T.successDim : T.dangerDim,
                fontWeight: 600,
              }}
            >
              {windowNotice.text}
            </div>
          )}

          <div className="er-table-scroll">
            <table className="ams-table">
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Official email</th>
                  <th>ERP photo</th>
                  <th>Attendance photos</th>
                  <th>Changed by student</th>
                  <th>Ground truth updates</th>
                  <th>Student account</th>
                </tr>
              </thead>
              <tbody>
                {loading && students.length === 0 && (
                  <tr><td colSpan={9} style={{ color: T.textMuted }}>Loading…</td></tr>
                )}
                {!loading && students.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ color: T.textMuted }}>
                      No ground truth folders on disk match this view. Photograph a batch, or clear
                      the filters above.
                    </td>
                  </tr>
                )}
                {students.map((student) => (
                  <tr key={student.rollNo}>
                    <td className="er-mono">
                      <button
                        type="button"
                        className="er-linkbtn"
                        title="View this student's ground truth photos"
                        onClick={() => setGtTarget({ rollNo: student.rollNo, batch: student.batch })}
                      >
                        {student.rollNo}
                      </button>
                    </td>
                    <td>
                      {student.name || <span style={{ color: T.textMuted }}>—</span>}
                    </td>
                    <td>
                      {student.branch || '—'}
                      {student.batchYear && <div className="er-hint">{student.batchYear}</div>}
                      {/* The branch above is the batch folder the photos are
                          filed in. When the account says something else, show
                          both rather than picking one — a transfer and a data
                          error look identical from here, and only the office
                          can tell them apart. */}
                      {student.accountBranch
                        && student.accountBranch !== student.branch && (
                        <div className="er-hint" style={{ color: '#b45309' }}>
                          Account says {student.accountBranch}
                        </div>
                      )}
                    </td>
                    <td className="er-mono">
                      {student.email || <span style={{ color: T.textMuted }}>—</span>}
                    </td>
                    <td>
                      <span className={`er-pill ${student.hasErpPhoto ? 'ok' : 'none'}`}>
                        {student.hasErpPhoto ? 'On file' : 'None'}
                      </span>
                    </td>
                    {/* Being on this list means having a folder on disk, so
                        there is no "not photographed" case left to render —
                        a student with no photos is simply not a row. */}
                    <td>
                      <span className={`er-pill ${student.embeddingCount >= 3 ? 'ok' : 'warn'}`}>
                        {student.embeddingCount} in use
                      </span>
                      <div className="er-hint">
                        {student.backupCount} in reserve · {student.batch}
                      </div>
                    </td>
                    <td>
                      {student.lastPhotoUpdateAt ? (
                        <>
                          <div style={{ fontSize: 12 }}>
                            {new Date(student.lastPhotoUpdateAt).toLocaleDateString()}
                          </div>
                          <div className="er-hint">
                            {student.photoUpdateCount} change{student.photoUpdateCount === 1 ? '' : 's'}
                            {student.lastPhotoChange?.promoted?.length
                              ? ` · swapped in ${student.lastPhotoChange.promoted.length}`
                              : ''}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: T.textMuted, fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td>
                      {/* No account, no window. The control is not rendered
                          rather than rendered disabled: there is no student
                          here to grant an update to, and the server answers a
                          PATCH for this roll number with a 404 saying so. */}
                      {student.unmatched ? (
                        <span className="er-pill none">No account</span>
                      ) : (
                        <>
                      <span className={`er-pill ${student.photoUpdatesOpen ? 'ok' : 'none'}`}>
                        {student.photoUpdatesOpen ? 'Open · one update' : 'Once a week'}
                      </span>
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="er-btn er-btn-ghost"
                          onClick={() => toggleUpdateWindow(student)}
                          disabled={togglingRoll === student.rollNo || bulkBusy}
                          title={student.photoUpdatesOpen
                            ? 'Take the window back before it is used. It closes on its own once the student saves.'
                            : 'Let this student re-pick their ground truth photos once, without waiting out the week.'}
                        >
                          {togglingRoll === student.rollNo
                            ? 'Saving…'
                            : student.photoUpdatesOpen ? 'Close window' : 'Open window'}
                        </button>
                      </div>
                      {student.photoUpdatesOpen && student.photoUpdatesOpenedAt && (
                        <div className="er-hint">
                          Opened {new Date(student.photoUpdatesOpenedAt).toLocaleDateString()} · unused
                        </div>
                      )}
                      {!student.photoUpdatesOpen && student.photoUpdatesUsedAt && (
                        <div className="er-hint">
                          Window used {new Date(student.photoUpdatesUsedAt).toLocaleDateString()}
                        </div>
                      )}
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`er-pill ${student.unmatched ? 'warn' : 'ok'}`}>
                        {student.unmatched ? 'Not matched' : 'Matched'}
                      </span>
                      {student.unmatched ? (
                        <div className="er-hint">
                          No account carries this roll number
                        </div>
                      ) : (
                        student.updatedAt && (
                          <div className="er-hint">{new Date(student.updatedAt).toLocaleDateString()}</div>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {gtTarget && (
            <StudentGroundTruthModal
              batch={gtTarget.batch}
              rollNo={gtTarget.rollNo}
              // No session behind this one, so no attendance facts to show —
              // the modal leaves that strip out when there is no student.
              // A save changes the photo counts this table prints, so reload.
              onSaved={loadStudents}
              onClose={() => setGtTarget(null)}
            />
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="er-btn er-btn-ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span style={{ fontSize: 12, color: T.textMuted }}>Page {page} of {pages}</span>
              <button
                type="button"
                className="er-btn er-btn-ghost"
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={page >= pages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
