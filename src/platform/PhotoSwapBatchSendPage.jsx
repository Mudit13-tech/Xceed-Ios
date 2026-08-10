// client/src/platform/PhotoSwapBatchSendPage.jsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import getEnvironment from '../getenvironment';
import { theme as T, styles, cssReset } from '../attendancemodule/config';
import { useDepartments } from '../attendancemodule/useDepartments';

const apiUrl = getEnvironment();
const SWAP_BASE = `${apiUrl}/attendancemodule/photo-swap`;
const SETTINGS_BASE = `${apiUrl}/attendancemodule/settings/batches`;

const CSS = `
  ${cssReset}
  @keyframes toastIn { from { opacity:0; transform:translateY(-20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }

  .ps-card { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 6px rgba(26,31,60,0.05); }
  .ps-card-header { padding: 14px 18px; border-bottom: 1px solid ${T.border}; background: ${T.surfaceAlt}; font-size: 11px; color: ${T.textMuted}; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ps-card-body { padding: 20px; }

  .ps-btn { padding: 7px 14px; border-radius: 7px; border: none; font-weight: 600; font-size: 12px; cursor: pointer; font-family: ${T.fontBody}; transition: opacity .2s; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .ps-btn:hover { opacity: .85; }
  .ps-btn:disabled { opacity: .45; cursor: not-allowed; }
  .ps-btn-primary { background: ${T.accent}; color: #fff; }
  .ps-btn-ghost { background: transparent; border: 1px solid ${T.border}; color: ${T.textMuted}; }

  .ps-filter-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .ps-batch-display { margin-top: 12px; padding: 10px 14px; background: ${T.bg}; border-radius: 7px; font-size: 13px; color: ${T.textMuted}; border: 1px solid ${T.border}; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }

  .ps-stats { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; margin-bottom: 16px; }
  .ps-stat { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 10px; padding: 12px 14px; }
  .ps-stat-n { font-size: 21px; font-weight: 800; line-height: 1.1; }
  .ps-stat-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: ${T.textMuted}; margin-top: 3px; }

  .ps-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .ps-pill.updated { background: ${T.successDim}; color: ${T.success}; }
  .ps-pill.opened  { background: rgba(245,158,11,.12); color: #b45309; }
  .ps-pill.sent    { background: ${T.accentDim}; color: ${T.accent}; }
  .ps-pill.expired { background: ${T.dangerDim}; color: ${T.danger}; }
  .ps-pill.not_sent { background: #eef0f8; color: ${T.textMuted}; }

  .ps-table-scroll { overflow-x: auto; }
  .ps-table-scroll .ams-table { min-width: 940px; }
  .ps-mono { font-family: ${T.fontMono}; }
  .ps-sub { font-size: 11px; color: ${T.textMuted}; margin-top: 2px; }

  .ps-toast { position: fixed; top: 96px; left: 50%; transform: translateX(-50%); z-index: 9000; padding: 12px 22px; border-radius: 30px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.25); animation: toastIn .25s cubic-bezier(.16,1,.3,1) both; }

  .ps-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 99999999; padding: 20px; }
  .ps-modal-box { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 12px; padding: 24px; max-width: 460px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,.15); }

  .ps-search-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .ps-input { padding: 8px 12px; border-radius: 7px; border: 1px solid ${T.border}; background: #f8f9fd; color: ${T.text}; font-family: ${T.fontBody}; font-size: 13px; outline: none; transition: border-color .2s; width: 100%; }
  .ps-input:focus { border-color: ${T.borderFocus}; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }

  @media (max-width: 900px) {
    .ps-stats { grid-template-columns: repeat(2, minmax(0,1fr)); }
  }
  @media (max-width: 768px) {
    .ps-filter-grid { grid-template-columns: 1fr; }
    .ps-toast { max-width: calc(100vw - 32px); }
  }
`;

const STATUS_LABEL = {
  not_sent: 'Not sent',
  sent: 'Sent',
  opened: 'Opened',
  updated: 'Updated',
  expired: 'Expired',
};

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
};

function StatusCell({ link }) {
  const status = link?.status || 'not_sent';
  const summary = link?.changeSummary;
  return (
    <div>
      <span className={`ps-pill ${status}`}>{STATUS_LABEL[status] || status}</span>
      {status === 'updated' && summary && (
        <div className="ps-sub">
          {summary.embeddingCount ?? 0} active
          {summary.promoted?.length ? ` · +${summary.promoted.length} in` : ''}
          {summary.demoted?.length ? ` · −${summary.demoted.length} out` : ''}
          {summary.deleted?.length ? ` · ${summary.deleted.length} deleted` : ''}
        </div>
      )}
      {status === 'opened' && (
        <div className="ps-sub">
          opened {link.openCount > 1 ? `${link.openCount}× ` : ''}— no changes yet
        </div>
      )}
      {link?.comments && (
        <div className="ps-sub" title={link.comments} style={{ fontStyle: 'italic' }}>
          “{link.comments.length > 40 ? `${link.comments.slice(0, 40)}…` : link.comments}”
        </div>
      )}
    </div>
  );
}

// Degree / Department / Batch Year — the same three-field selector the ERP
// Image Upload page uses, so a batch is identified identically on both pages
// (and resolves to the same ground-truth folder).
function BatchSelector({
  degree, setDegree, degrees,
  department, setDepartment, departments, deptLoading, deptError,
  batchYear, setBatchYear, batches, batchesLoading,
  batchName, studentCount, resolvedBatch,
}) {
  return (
    <div className="ps-card" style={{ marginBottom: 20 }}>
      <div className="ps-card-header">Batch Selection</div>
      <div className="ps-card-body">
        <div className="ps-filter-grid">
          <div>
            <label style={styles.label}>Degree</label>
            <select value={degree} onChange={(e) => setDegree(e.target.value)} style={styles.select}>
              <option value="">Select…</option>
              {degrees.map((d) => <option key={d.degreeName} value={d.degreeName}>{d.degreeName}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={styles.select}
              disabled={deptLoading}
            >
              <option value="">{deptLoading ? 'Loading…' : deptError ? 'Error' : 'Select…'}</option>
              {departments.map((d) => {
                const normalised = d.replace(/_/g, ' ');
                const selectedDegree = degrees.find((x) => x.degreeName === degree);
                const branch = selectedDegree?.branches?.find((b) => b.dept === normalised);
                return <option key={d} value={d}>{branch?.branchName || normalised}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={styles.label}>Batch Year</label>
            <select
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
              style={styles.select}
              disabled={batchesLoading}
            >
              <option value="">{batchesLoading ? 'Loading…' : batches.length === 0 ? 'No batches' : 'Select…'}</option>
              {batches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {batchName && (
          <div className="ps-batch-display">
            <span>
              Target: <strong className="ps-mono" style={{ color: T.accent }}>{resolvedBatch || batchName}</strong>
            </span>
            {studentCount != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: T.accentDim, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: T.accent }}>
                👤 {studentCount} student{studentCount !== 1 ? 's' : ''} with photos
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhotoSwapBatchSendPage() {
  const { departments, deptLoading, deptError } = useDepartments();

  const [activeTab, setActiveTab] = useState('batch');

  // ── Batch selection ────────────────────────────────────────────────
  const [degree, setDegree] = useState('');
  const [degrees, setDegrees] = useState([]);
  const [department, setDepartment] = useState('');
  const [batchYear, setBatchYear] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const batchName = (degree && department && batchYear) ? `${degree}_${department}_${batchYear}` : '';

  // ── Roster ─────────────────────────────────────────────────────────
  const [roster, setRoster] = useState([]);
  const [resolvedBatch, setResolvedBatch] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [sendingRoll, setSendingRoll] = useState(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [confirm, setConfirm] = useState(null); // { rollNos, label }

  // ── Institute-wide search ──────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Reference data ─────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${SETTINGS_BASE}/degrees`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setDegrees(Array.isArray(d.degrees) ? d.degrees : []))
      .catch(() => setDegrees([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBatchesLoading(true);
    fetch(SETTINGS_BASE, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const years = [...new Set((data.batches || []).map((b) => b.batchYear))]
          .filter(Boolean).sort().reverse();
        setBatches(years);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBatchesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Roster load ────────────────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    if (!batchName) { setRoster([]); setResolvedBatch(null); return; }
    setRosterLoading(true);
    setRosterError(null);
    try {
      const res = await fetch(`${SWAP_BASE}/batch-students?batch=${encodeURIComponent(batchName)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to load roster (HTTP ${res.status})`);
      setRoster(data.students || []);
      setResolvedBatch(data.resolvedBatch || null);
    } catch (err) {
      setRoster([]);
      setResolvedBatch(null);
      setRosterError(err.message);
    } finally {
      setRosterLoading(false);
    }
  }, [batchName]);

  useEffect(() => {
    setSelected(new Set());
    loadRoster();
  }, [loadRoster]);

  // ── Sending ────────────────────────────────────────────────────────
  const sendOne = async (student, batchForSend, onDone) => {
    setSendingRoll(student.rollNo);
    try {
      const res = await fetch(`${SWAP_BASE}/send-link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNo: student.rollNo,
          batch: batchForSend,
          email: student.email,
          name: student.name,
          dept: student.dept,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (HTTP ${res.status})`);
      showToast(`Link sent to ${student.email || student.rollNo}`);
      if (onDone) await onDone();
    } catch (err) {
      showToast(err.message || 'Send failed', 'error');
    } finally {
      setSendingRoll(null);
    }
  };

  const sendBulk = async (rollNos) => {
    setConfirm(null);
    setBulkSending(true);
    try {
      const res = await fetch(`${SWAP_BASE}/send-batch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: batchName, rollNos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (HTTP ${res.status})`);
      const results = data.results || [];
      const sent = results.filter((r) => r.status === 'sent').length;
      showToast(
        `Sent ${sent}/${results.length} emails`,
        sent === results.length ? 'success' : 'warning',
      );
      setSelected(new Set());
      await loadRoster();
    } catch (err) {
      showToast(err.message || 'Batch send failed', 'error');
    } finally {
      setBulkSending(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────
  const runSearch = async (e) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      showToast('Enter at least 2 characters', 'error');
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`${SWAP_BASE}/search-students?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Search failed (HTTP ${res.status})`);
      setResults(data.students || []);
    } catch (err) {
      setResults([]);
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const refreshSearch = async () => {
    if (results) await runSearch();
  };

  // ── Derived ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const base = { total: roster.length, not_sent: 0, sent: 0, opened: 0, updated: 0, expired: 0 };
    for (const s of roster) base[s.link?.status || 'not_sent'] += 1;
    return base;
  }, [roster]);

  const sendableRolls = useMemo(
    () => roster.filter((s) => s.email).map((s) => s.rollNo),
    [roster],
  );
  const missingEmail = roster.length - sendableRolls.length;

  const toggle = (rollNo) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(rollNo)) next.delete(rollNo); else next.add(rollNo);
    return next;
  });

  const allSelected = sendableRolls.length > 0 && sendableRolls.every((r) => selected.has(r));

  return (
    <div style={{ ...styles.page, padding: 'clamp(16px,3vw,32px)' }}>
      <style>{CSS}</style>

      {toast && (
        <div
          className="ps-toast"
          style={{ background: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#10b981' }}
        >
          <span style={{ fontSize: 15 }}>{toast.type === 'success' ? '✓' : '⚠'}</span>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={styles.heading}>Photo Swap — Send Update Links</div>
        <div style={styles.subheading}>
          Email a one-time, 24-hour photo update link and track whether each student
          opened it and saved changes.
        </div>
      </div>

      <div className="ams-tabs">
        {[
          { id: 'batch', label: 'Batch Send' },
          { id: 'search', label: 'Find a Student' },
        ].map((t) => (
          <button
            key={t.id}
            className={`ams-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ BATCH TAB ══════════════════════════════════════════════════ */}
      {activeTab === 'batch' && (
        <>
          <BatchSelector
            {...{
              degree, setDegree, degrees,
              department, setDepartment, departments, deptLoading, deptError,
              batchYear, setBatchYear, batches, batchesLoading,
              batchName, resolvedBatch,
              studentCount: batchName && !rosterLoading ? roster.length : null,
            }}
          />

          {!batchName ? (
            <div className="ps-card" style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              Select a degree, department and batch year to load the roster.
            </div>
          ) : rosterLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontSize: 13 }}>
              Loading roster…
            </div>
          ) : rosterError ? (
            <div style={{ padding: '10px 14px', borderRadius: 6, background: T.dangerDim, border: `1px solid ${T.danger}`, fontSize: 13, color: T.danger }}>
              {rosterError}
            </div>
          ) : roster.length === 0 ? (
            <div className="ps-card" style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              No ground-truth photo folders found for <strong className="ps-mono">{batchName}</strong>.
              Students need enrolled photos before a swap link means anything.
            </div>
          ) : (
            <>
              <div className="ps-stats">
                <div className="ps-stat"><div className="ps-stat-n" style={{ color: T.text }}>{stats.total}</div><div className="ps-stat-l">Students</div></div>
                <div className="ps-stat"><div className="ps-stat-n" style={{ color: T.textMuted }}>{stats.not_sent}</div><div className="ps-stat-l">Not sent</div></div>
                <div className="ps-stat"><div className="ps-stat-n" style={{ color: T.accent }}>{stats.sent}</div><div className="ps-stat-l">Awaiting open</div></div>
                <div className="ps-stat"><div className="ps-stat-n" style={{ color: '#b45309' }}>{stats.opened}</div><div className="ps-stat-l">Opened, no change</div></div>
                <div className="ps-stat"><div className="ps-stat-n" style={{ color: T.success }}>{stats.updated}</div><div className="ps-stat-l">Updated</div></div>
              </div>

              <div className="ps-card">
                <div className="ps-card-header">
                  <span>
                    Roster — <span style={{ color: T.accent }}>{resolvedBatch || batchName}</span>
                    {missingEmail > 0 && (
                      <span style={{ color: T.danger, marginLeft: 10, textTransform: 'none', letterSpacing: 0 }}>
                        {missingEmail} without an email on file
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="ps-btn ps-btn-ghost" onClick={loadRoster} disabled={rosterLoading}>
                      ↺ Refresh
                    </button>
                    <button
                      className="ps-btn ps-btn-primary"
                      disabled={bulkSending || selected.size === 0}
                      onClick={() => setConfirm({
                        rollNos: [...selected],
                        label: `${selected.size} selected student${selected.size !== 1 ? 's' : ''}`,
                      })}
                    >
                      Send to selected ({selected.size})
                    </button>
                    <button
                      className="ps-btn ps-btn-primary"
                      disabled={bulkSending || sendableRolls.length === 0}
                      onClick={() => setConfirm({
                        rollNos: sendableRolls,
                        label: `all ${sendableRolls.length} student${sendableRolls.length !== 1 ? 's' : ''}`,
                      })}
                    >
                      {bulkSending ? 'Sending…' : `Send to all (${sendableRolls.length})`}
                    </button>
                  </div>
                </div>

                <div className="ps-table-scroll">
                  <table className="ams-table">
                    <thead>
                      <tr>
                        <th style={{ width: 34 }}>
                          <input
                            type="checkbox"
                            aria-label="Select all students with an email"
                            checked={allSelected}
                            onChange={() => setSelected(allSelected ? new Set() : new Set(sendableRolls))}
                          />
                        </th>
                        <th>Roll No</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th style={{ textAlign: 'center' }}>Photos</th>
                        <th>Status</th>
                        <th>Last sent</th>
                        <th>Opened</th>
                        <th>Updated</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((s) => (
                        <tr key={s.folder}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${s.rollNo}`}
                              disabled={!s.email}
                              checked={selected.has(s.rollNo)}
                              onChange={() => toggle(s.rollNo)}
                            />
                          </td>
                          <td className="ps-mono" style={{ fontWeight: 700, color: T.text }}>{s.rollNo}</td>
                          <td style={{ color: T.text }}>{s.name || <span style={{ color: T.textMuted }}>not in roster</span>}</td>
                          <td style={{ color: s.email ? T.textMuted : T.danger }}>{s.email || 'No email on file'}</td>
                          <td style={{ textAlign: 'center', color: T.textMuted }}>{s.photoCount}</td>
                          <td><StatusCell link={s.link} /></td>
                          <td style={{ color: T.textMuted, fontSize: 12 }}>{fmtDate(s.link?.sentAt)}</td>
                          <td style={{ color: T.textMuted, fontSize: 12 }}>{fmtDate(s.link?.openedAt)}</td>
                          <td style={{ color: T.textMuted, fontSize: 12 }}>{fmtDate(s.link?.usedAt)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="ps-btn ps-btn-primary"
                              disabled={!s.email || sendingRoll === s.rollNo || bulkSending}
                              onClick={() => sendOne(s, batchName, loadRoster)}
                            >
                              {sendingRoll === s.rollNo
                                ? '…'
                                : s.link?.status === 'not_sent' ? 'Send' : 'Resend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ SEARCH TAB ═════════════════════════════════════════════════ */}
      {activeTab === 'search' && (
        <>
          <div className="ps-card" style={{ marginBottom: 20 }}>
            <div className="ps-card-header">Institute-wide Student Lookup</div>
            <div className="ps-card-body">
              <form className="ps-search-row" onSubmit={runSearch}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <label style={styles.label}>Roll No, name or email</label>
                  <input
                    className="ps-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. 21BCE001"
                  />
                </div>
                <button className="ps-btn ps-btn-primary" type="submit" disabled={searching} style={{ padding: '9px 18px', fontSize: 13 }}>
                  {searching ? 'Searching…' : '🔍 Search'}
                </button>
              </form>
              <div style={{ marginTop: 10, fontSize: 12, color: T.textMuted }}>
                Searches every department. The batch column is the ground-truth folder the
                student&rsquo;s photos actually live in — a student with no folder has nothing to swap.
              </div>
            </div>
          </div>

          {searchError && (
            <div style={{ padding: '10px 14px', borderRadius: 6, marginBottom: 16, background: T.dangerDim, border: `1px solid ${T.danger}`, fontSize: 13, color: T.danger }}>
              {searchError}
            </div>
          )}

          {results && results.length === 0 && !searchError && (
            <div className="ps-card" style={{ padding: '40px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
              No students matched “{query}”.
            </div>
          )}

          {results && results.length > 0 && (
            <div className="ps-card">
              <div className="ps-card-header">
                <span>{results.length} match{results.length !== 1 ? 'es' : ''}</span>
                <button className="ps-btn ps-btn-ghost" onClick={refreshSearch} disabled={searching}>↺ Refresh</button>
              </div>
              <div className="ps-table-scroll">
                <table className="ams-table">
                  <thead>
                    <tr>
                      <th>Roll No</th>
                      <th>Name</th>
                      <th>Dept</th>
                      <th>Email</th>
                      <th>Batch (ground truth)</th>
                      <th style={{ textAlign: 'center' }}>Photos</th>
                      <th>Status</th>
                      <th>Last sent</th>
                      <th>Updated</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((s) => (
                      <tr key={s.rollNo}>
                        <td className="ps-mono" style={{ fontWeight: 700, color: T.text }}>{s.rollNo}</td>
                        <td style={{ color: T.text }}>{s.name || '—'}</td>
                        <td style={{ color: T.textMuted }}>{s.dept || '—'}</td>
                        <td style={{ color: s.email ? T.textMuted : T.danger }}>{s.email || 'No email on file'}</td>
                        <td className="ps-mono" style={{ fontSize: 11, color: s.batch ? T.accent : T.danger }}>
                          {s.batch || 'No photo folder'}
                        </td>
                        <td style={{ textAlign: 'center', color: T.textMuted }}>{s.photoCount}</td>
                        <td><StatusCell link={s.link} /></td>
                        <td style={{ color: T.textMuted, fontSize: 12 }}>{fmtDate(s.link?.sentAt)}</td>
                        <td style={{ color: T.textMuted, fontSize: 12 }}>{fmtDate(s.link?.usedAt)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="ps-btn ps-btn-primary"
                            disabled={!s.email || !s.batch || sendingRoll === s.rollNo}
                            title={!s.batch ? 'No ground-truth photos for this student' : !s.email ? 'No email on file' : ''}
                            onClick={() => sendOne(s, s.batch, refreshSearch)}
                          >
                            {sendingRoll === s.rollNo
                              ? '…'
                              : s.link?.status === 'not_sent' ? 'Send' : 'Resend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Confirm bulk send ─────────────────────────────────────────── */}
      {confirm && (
        <div className="ps-modal-overlay">
          <div className="ps-modal-box">
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              Confirm send
            </div>
            <div style={{ fontSize: 13.5, color: T.textMuted, lineHeight: 1.55, marginBottom: 22 }}>
              You&rsquo;re about to email <strong style={{ color: T.text }}>{confirm.label}</strong> in{' '}
              <strong className="ps-mono" style={{ color: T.text }}>{resolvedBatch || batchName}</strong>.
              Each gets a one-time link valid for <strong style={{ color: T.text }}>24 hours</strong>;
              any link already outstanding for those students stops working.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ps-btn ps-btn-ghost" style={{ padding: '10px 16px', fontSize: 13 }} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ps-btn ps-btn-primary" style={{ padding: '10px 16px', fontSize: 13 }} onClick={() => sendBulk(confirm.rollNos)}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
