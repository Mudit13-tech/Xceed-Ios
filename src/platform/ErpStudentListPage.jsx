// client/src/platform/ErpStudentListPage.jsx
//
// The institute admin's sync of the ERP student list.
//
// The list is one roster with one job: pair every roll number with the
// official email address the institute holds for it. That pairing is what
// lets a student open their own attendance photos from the learning module
// and nobody else's — the resolution deliberately never trusts the roll
// number a student types into their own profile, which they can edit.
//
// The pairing is pulled straight from the Student collection (name, rollNo,
// dept, mailID) rather than an uploaded file — that collection is already the
// institute's authoritative student list, so re-typing it into a spreadsheet
// every time it changes would just be a second, driftable copy of the same
// data. /erp-roster/from-students/* on the server does the fetch and the same
// classification pass a file upload would.
//
// Institute-level rather than per-department because the source data carries
// every student's address; the route enforces the same
// (erpStudentRosterRoutes.js).

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import getEnvironment from '../getenvironment';
import { theme as T, cssReset } from '../attendancemodule/config';

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

  .er-input { padding: 8px 12px; border-radius: 7px; border: 1px solid ${T.border}; background: #f8f9fd; color: ${T.text}; font-family: ${T.fontBody}; font-size: 13px; outline: none; }
  .er-input:focus { border-color: ${T.borderFocus}; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }

  .er-stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
  .er-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 12px 14px; }
  .er-stat-n { font-size: 21px; font-weight: 800; line-height: 1.1; }
  .er-stat-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: ${T.textMuted}; margin-top: 3px; }

  .er-filters { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 14px; }
  .er-table-scroll { overflow-x: auto; }
  .er-table-scroll .ams-table { min-width: 900px; }
  .er-mono { font-family: ${T.fontMono}; }

  .er-pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .er-pill.ok { background: ${T.successDim}; color: ${T.success}; }
  .er-pill.warn { background: rgba(245,158,11,.12); color: #b45309; }
  .er-pill.none { background: #eef0f8; color: ${T.textMuted}; }
  .er-pill.bad { background: ${T.dangerDim}; color: ${T.danger}; }

  @media (max-width: 900px) { .er-stats { grid-template-columns: repeat(2, minmax(0,1fr)); } }
`;

const OUTCOME = {
  new:       { label: 'New', cls: 'ok' },
  update:    { label: 'Updates existing', cls: 'warn' },
  invalid:   { label: 'Invalid', cls: 'bad' },
  duplicate: { label: 'Duplicate', cls: 'bad' },
};

async function post(path, body) {
  const response = await fetch(`${ROSTER_BASE}${path}`, {
    method: 'POST',
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

function SyncCard({ onImported, lastUploadAt, lastUploadFrom }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const loadPreview = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Preview writes nothing: it is the import's own classification pass, so
      // what the table promises is what the sync will do.
      setPreview(await get('/from-students/preview'));
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const runSync = async () => {
    setBusy(true); setError(null);
    try {
      const result = await post('/from-students/import', {});
      onImported(result);
      await loadPreview();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const summary = preview?.summary || {};
  const writable = (summary.new || 0) + (summary.update || 0);

  return (
    <div className="er-card">
      <div className="er-card-header">
        <span>Sync ERP student list from the database</span>
        <button type="button" className="er-btn er-btn-ghost" onClick={loadPreview} disabled={loading || busy}>
          {loading ? 'Checking…' : 'Re-check'}
        </button>
      </div>
      <div className="er-card-body">
        <div className="er-hint">
          Pulled straight from the institute&apos;s student database — <strong>Name</strong>,{' '}
          <strong>Roll No.</strong>, <strong>Department</strong>, <strong>Official Email</strong>. Re-running
          the sync updates the students it names and leaves everyone else alone.
        </div>
        <div className="er-hint">
          Last write to the list: {lastUploadAt ? new Date(lastUploadAt).toLocaleString() : 'never'}
          {lastUploadFrom && (
            <> — from <strong>{lastUploadFrom === 'Student database sync' ? 'the database sync' : `file "${lastUploadFrom}"`}</strong></>
          )}
          . Any row still showing a file name in its Source column below hasn&apos;t matched a roll
          number in the student database yet.
        </div>

        {error && (
          <div className="er-hint" style={{ color: T.danger, fontWeight: 600 }}>{error}</div>
        )}

        {loading && !preview && (
          <div className="er-hint">Checking the student database…</div>
        )}

        {preview && (
          <>
            <div className="er-stats" style={{ marginTop: 16 }}>
              {['new', 'update', 'invalid', 'duplicate'].map((key) => (
                <div className="er-stat" key={key}>
                  <div className="er-stat-n">{summary[key] || 0}</div>
                  <div className="er-stat-l">{OUTCOME[key].label}</div>
                </div>
              ))}
            </div>

            {writable === 0 ? (
              <div className="er-hint" style={{ marginTop: 10 }}>Nothing to sync — already up to date.</div>
            ) : (
              <>
                <div className="er-table-scroll" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  <table className="ams-table">
                    <thead>
                      <tr>
                        <th>Roll No.</th><th>Name</th><th>Branch</th><th>Official email</th><th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.filter((row) => row.outcome === 'new' || row.outcome === 'update')
                        .slice(0, 200).map((row, index) => (
                        <tr key={`${row.rollNo}-${index}`}>
                          <td className="er-mono">{row.rollNo || '—'}</td>
                          <td>{row.name || '—'}</td>
                          <td>{row.branch || '—'}</td>
                          <td className="er-mono">{row.email || '—'}</td>
                          <td>
                            <span className={`er-pill ${OUTCOME[row.outcome]?.cls || 'none'}`}>
                              {OUTCOME[row.outcome]?.label || row.outcome}
                            </span>
                            {row.emailChangedFrom && (
                              <div className="er-hint">Address changes from {row.emailChangedFrom}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {writable > 200 && (
                  <div className="er-hint">Showing the first 200 of {writable} rows.</div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="er-btn er-btn-primary"
                onClick={runSync}
                disabled={busy || loading || writable === 0}
              >
                {busy ? 'Syncing…' : `Sync ${writable} student${writable === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ErpStudentListPage() {
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const limit = 50;

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(`${ROSTER_BASE}/summary`, { credentials: 'include' });
      if (response.ok) setSummary(await response.json());
    } catch (_) { /* the table below is the page; a missing summary is cosmetic */ }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim().length >= 2) params.set('q', q.trim());
      if (branch) params.set('branch', branch);
      if (batchYear) params.set('batchYear', batchYear);
      const response = await fetch(`${ROSTER_BASE}?${params}`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      setStudents(data.students || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [page, q, branch, batchYear]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    // Debounced so typing in the search box is not one request per keystroke.
    const timer = setTimeout(loadStudents, 250);
    return () => clearTimeout(timer);
  }, [loadStudents]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

  return (
    <div style={{ padding: '20px 24px', fontFamily: T.fontBody, color: T.text }}>
      <style>{CSS}</style>

      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>ERP Student List</h1>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 18, maxWidth: 760, lineHeight: 1.6 }}>
        The roll-number-to-official-address pairing, fetched from the student database. It is what
        lets a student open their own attendance photos from the learning module — and only their
        own. Syncing it changes nothing about attendance itself.
      </p>

      {notice && (
        <div className="er-card" style={{ borderColor: T.success }}>
          <div className="er-card-body" style={{ fontSize: 13 }}>{notice}</div>
        </div>
      )}

      <SyncCard
        lastUploadAt={summary?.lastUploadAt}
        lastUploadFrom={summary?.lastUploadFrom}
        onImported={(result) => {
          setNotice(result.message);
          loadSummary();
          loadStudents();
        }}
      />

      {summary && (
        <div className="er-stats">
          <div className="er-stat">
            <div className="er-stat-n">{summary.total}</div>
            <div className="er-stat-l">On the list</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.selfUpdated}</div>
            <div className="er-stat-l">Have changed their photos</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.branches.length}</div>
            <div className="er-stat-l">Branches</div>
          </div>
          <div className="er-stat">
            <div className="er-stat-n">{summary.batchYears.length}</div>
            <div className="er-stat-l">Admission years</div>
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
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {loading && students.length === 0 && (
                  <tr><td colSpan={8} style={{ color: T.textMuted }}>Loading…</td></tr>
                )}
                {!loading && students.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ color: T.textMuted }}>
                      Nothing here yet. Sync from the student database above.
                    </td>
                  </tr>
                )}
                {students.map((student) => (
                  <tr key={student.rollNo}>
                    <td className="er-mono">{student.rollNo}</td>
                    <td>{student.name || '—'}</td>
                    <td>
                      {student.branch || '—'}
                      {student.batchYear && <div className="er-hint">{student.batchYear}</div>}
                    </td>
                    <td className="er-mono">{student.email}</td>
                    <td>
                      <span className={`er-pill ${student.hasErpPhoto ? 'ok' : 'none'}`}>
                        {student.hasErpPhoto ? 'On file' : 'None'}
                      </span>
                    </td>
                    <td>
                      {student.batch ? (
                        <>
                          <span className={`er-pill ${student.embeddingCount >= 3 ? 'ok' : 'warn'}`}>
                            {student.embeddingCount} in use
                          </span>
                          <div className="er-hint">
                            {student.backupCount} in reserve · {student.batch}
                          </div>
                        </>
                      ) : (
                        <span className="er-pill none">Not photographed</span>
                      )}
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
                      <span className={`er-pill ${student.uploadedFrom === 'Student database sync' ? 'ok' : 'warn'}`}>
                        {student.uploadedFrom === 'Student database sync' ? 'DB sync' : (student.uploadedFrom || 'Unknown')}
                      </span>
                      {student.updatedAt && (
                        <div className="er-hint">{new Date(student.updatedAt).toLocaleDateString()}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
