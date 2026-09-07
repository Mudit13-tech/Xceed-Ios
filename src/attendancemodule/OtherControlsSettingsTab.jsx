// client/src/attendancemodule/OtherControlsSettingsTab.jsx
//
// "Other Controls" settings tab — miscellaneous admin toggles.
// Two on/off switches (both default OFF) that restrict Ground Truth
// acquisition and Attendance runs to 08:30–17:30 IST, and one (default ON)
// that governs whether students may re-pick their own ground-truth photos.
// Mirrors FrameCleanupSettingsTab.jsx's toggle pattern and styling.

import { useState, useEffect } from 'react';
import { theme as T } from './config';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();
const BASE = `${apiUrl}/attendancemodule/settings/other-controls`;
// Detection-debug retention keeps its own settings document (cleanup-job state
// isn't a time-window policy flag), but its control belongs here beside the
// other admin switches rather than in a tab of its own.
const DD_BASE = `${apiUrl}/attendancemodule/settings/detection-debug-cleanup`;
// Unknown-face crop retention — same shape as detection-debug above (its own
// settings document, surfaced here rather than in a tab of its own).
const UF_BASE = `${apiUrl}/attendancemodule/settings/unknown-face-cleanup`;

function formatDate(d) {
  if (!d) return 'never';
  try {
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return 'never';
  }
}

export default function OtherControlsSettingsTab() {
  const [gtEnabled, setGtEnabled] = useState(false);
  const [runEnabled, setRunEnabled] = useState(false);
  // Default ON, matching the server: students may re-pick their own photos
  // once a week unless this is switched off.
  const [studentUpdates, setStudentUpdates] = useState(true);
  const [windowStart, setWindowStart] = useState('08:30');
  const [windowEnd, setWindowEnd] = useState('17:30');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Detection-debug crop retention
  const [ddEnabled, setDdEnabled] = useState(true);
  const [ddRetention, setDdRetention] = useState(3);
  const [ddRetentionInput, setDdRetentionInput] = useState('3');
  const [ddLastRunAt, setDdLastRunAt] = useState(null);
  const [ddLastRunStats, setDdLastRunStats] = useState(null);
  const [ddRunning, setDdRunning] = useState(false);

  // Unknown-face cluster retention
  const [ufEnabled, setUfEnabled] = useState(true);
  const [ufRetention, setUfRetention] = useState(3);
  const [ufRetentionInput, setUfRetentionInput] = useState('3');
  const [ufPreserveReviewed, setUfPreserveReviewed] = useState(true);
  const [ufLastRunAt, setUfLastRunAt] = useState(null);
  const [ufLastRunStats, setUfLastRunStats] = useState(null);
  const [ufRunning, setUfRunning] = useState(false);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const applySettings = (s) => {
    setGtEnabled(!!s?.groundTruthTimeWindowEnabled);
    setRunEnabled(!!s?.attendanceRunTimeWindowEnabled);
    // `!== false` rather than `!!`: an older settings document written before
    // this field existed has no value at all, and that means on.
    setStudentUpdates(s?.studentPhotoUpdatesEnabled !== false);
    setWindowStart(s?.windowStart || '08:30');
    setWindowEnd(s?.windowEnd || '17:30');
  };

  const applyDdSettings = (s) => {
    setDdEnabled(!!s?.enabled);
    const days = s?.retentionDays ?? 3;
    setDdRetention(days);
    setDdRetentionInput(String(days));
    setDdLastRunAt(s?.lastRunAt || null);
    setDdLastRunStats(s?.lastRunStats || null);
  };

  useEffect(() => {
    fetch(`${BASE}/`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        applySettings(d.settings);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Separate document, separate request — a failure here must not stop the
  // time-window toggles above from rendering.
  useEffect(() => {
    fetch(`${DD_BASE}/`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => applyDdSettings(d.settings))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${UF_BASE}/`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => applyUfSettings(d.settings))
      .catch(() => {});
  }, []);

  const applyUfSettings = (s) => {
    setUfEnabled(!!s?.enabled);
    const days = s?.retentionDays ?? 3;
    setUfRetention(days);
    setUfRetentionInput(String(days));
    // `!== false` rather than `!!`: absent means on, matching the schema default.
    setUfPreserveReviewed(s?.preserveReviewed !== false);
    setUfLastRunAt(s?.lastRunAt || null);
    setUfLastRunStats(s?.lastRunStats || null);
  };

  const saveDd = async (patch, revert) => {
    try {
      const res = await fetch(`${DD_BASE}/`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      applyDdSettings(data.settings);
    } catch (err) {
      if (revert) revert();
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleDdRunNow = async () => {
    setDdRunning(true);
    try {
      const res = await fetch(`${DD_BASE}/run-now`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run cleanup');
      applyDdSettings(data.settings);
      showMsg(
        `Cleanup complete — scanned ${data.stats.scanned} run(s), removed `
        + `${data.stats.deleted} (${data.stats.filesDeleted} crop(s)).`
      );
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setDdRunning(false);
    }
  };

  const saveUf = async (patch, revert) => {
    try {
      const res = await fetch(`${UF_BASE}/`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      applyUfSettings(data.settings);
    } catch (err) {
      if (revert) revert();
      showMsg('Error: ' + err.message, 'error');
    }
  };

  const handleUfRunNow = async () => {
    setUfRunning(true);
    try {
      const res = await fetch(`${UF_BASE}/run-now`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to run cleanup');
      applyUfSettings(data.settings);
      showMsg(
        `Cleanup complete — scanned ${data.stats.scanned} cluster(s), removed `
        + `${data.stats.deleted} (${data.stats.filesDeleted} crop(s)), kept `
        + `${data.stats.preserved} reviewed.`
      );
    } catch (err) {
      showMsg('Error: ' + err.message, 'error');
    } finally {
      setUfRunning(false);
    }
  };

  // key = field name on the settings doc; setLocal = optimistic state setter.
  const saveToggle = async (key, newValue, setLocal, prevValue) => {
    setLocal(newValue);
    try {
      const res = await fetch(`${BASE}/`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      applySettings(data.settings);
    } catch (err) {
      setLocal(prevValue); // revert on failure
      showMsg('Error: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: T.textMuted }}>
        Loading other controls…
      </div>
    );
  }

  const windowText = `${windowStart}–${windowEnd} IST`;

  const ToggleCard = ({ enabled, title, description, onToggle }) => (
    <div className="oc-card">
      <div
        className="oc-card-body"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.text,
              marginBottom: 2,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, maxWidth: 520 }}>
            {description}
          </div>
        </div>
        <div
          onClick={onToggle}
          title={enabled ? 'Click to disable' : 'Click to enable'}
          style={{
            width: 46,
            height: 26,
            borderRadius: 26,
            cursor: 'pointer',
            background: enabled ? T.accent : '#d1d5db',
            transition: 'background .2s',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              height: 20,
              width: 20,
              left: enabled ? 23 : 3,
              top: 3,
              background: '#fff',
              borderRadius: '50%',
              transition: 'left .2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <style>{`
        .oc-card {
          background: ${T.surface || '#fff'};
          border: 1px solid ${T.border};
          border-radius: 10px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .oc-card-body { padding: 16px 18px; }
      `}</style>

      {message.text && (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: 14,
            borderRadius: 8,
            fontSize: 13,
            background: message.type === 'error' ? T.dangerDim : T.successDim,
            color: message.type === 'error' ? T.danger : T.success,
          }}
        >
          {message.text}
        </div>
      )}

      <ToggleCard
        enabled={gtEnabled}
        title={`Restrict Ground Truth acquisition to ${windowText}`}
        description={
          gtEnabled
            ? `Ground Truth (RTSP) acquisition can only be started between ${windowText}. Attempts outside this window are blocked.`
            : 'Ground Truth acquisition can be started at any time (no restriction). Turn on to enforce the window.'
        }
        onToggle={() =>
          saveToggle('groundTruthTimeWindowEnabled', !gtEnabled, setGtEnabled, gtEnabled)
        }
      />

      <ToggleCard
        enabled={runEnabled}
        title={`Restrict Attendance runs to ${windowText}`}
        description={
          runEnabled
            ? `Attendance runs (automatic scheduler and manual triggers) only fire between ${windowText}. Attempts outside this window are blocked.`
            : 'Attendance runs can fire at any time (no restriction). Turn on to enforce the window.'
        }
        onToggle={() =>
          saveToggle('attendanceRunTimeWindowEnabled', !runEnabled, setRunEnabled, runEnabled)
        }
      />

      <ToggleCard
        enabled={studentUpdates}
        title={`Students may update their own ground truth photos ${studentUpdates ? '— once a week' : '— off'}`}
        description={
          studentUpdates
            ? 'A student can re-pick the photos the cameras match them against once every 7 days, from their own dashboard in the learning module. Every save rebuilds the embeddings of every subject they are enrolled in, which is what the weekly wait is for.'
            : 'Students see their photos but cannot change them, and the save is refused. A window opened for one student from the ERP Student List still works — that is an admin deciding one student needs an update now, and it is unaffected by this switch.'
        }
        onToggle={() =>
          saveToggle('studentPhotoUpdatesEnabled', !studentUpdates, setStudentUpdates, studentUpdates)
        }
      />

      <ToggleCard
        enabled={ddEnabled}
        title={`Automatic detection-debug crop cleanup ${ddEnabled ? 'enabled' : 'disabled'}`}
        description={
          ddEnabled
            ? `Runs nightly at 02:25. Whole run folders under ml-data/detection_debug/ older than ${ddRetention} day(s) are removed. Browse them under Attendance → Rejected Samples → Detection Debug.`
            : 'The job is paused — debug crop dumps will accumulate on disk until this is re-enabled or a manual run is triggered below. These dumps are large; leave collection off when not investigating.'
        }
        onToggle={() => {
          const prev = ddEnabled;
          setDdEnabled(!prev);
          saveDd({ enabled: !prev }, () => setDdEnabled(prev));
        }}
      />

      <div className="oc-card">
        <div className="oc-card-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Keep debug runs for
              </span>
              <input
                type="number"
                min={1}
                max={90}
                value={ddRetentionInput}
                onChange={(e) => setDdRetentionInput(e.target.value)}
                onBlur={() => {
                  const n = Number.parseInt(ddRetentionInput, 10);
                  if (!Number.isInteger(n) || n < 1 || n > 90) {
                    setDdRetentionInput(String(ddRetention));
                    showMsg('Retention must be a whole number of days, 1–90', 'error');
                    return;
                  }
                  if (n !== ddRetention) saveDd({ retentionDays: n });
                }}
                style={{
                  width: 70,
                  padding: '5px 8px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.surface || '#fff',
                  color: T.text,
                }}
              />
              <span style={{ fontSize: 12, color: T.textMuted }}>day(s), 1–90</span>
            </div>
            <button
              onClick={handleDdRunNow}
              disabled={ddRunning}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: ddRunning ? 'not-allowed' : 'pointer',
                background: T.accent,
                color: '#fff',
                opacity: ddRunning ? 0.6 : 1,
              }}
              title="Deletes expired debug run folders immediately, regardless of the toggle above."
            >
              {ddRunning ? 'Running…' : 'Run now'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
            Last run: {formatDate(ddLastRunAt)}
          </div>

          {ddLastRunStats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10,
                fontSize: 12,
                color: T.textMuted,
              }}
            >
              <div>
                Runs scanned
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ddLastRunStats.scanned ?? 0}
                </div>
              </div>
              <div>
                Runs removed
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ddLastRunStats.deleted ?? 0}
                </div>
              </div>
              <div>
                Crops deleted
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ddLastRunStats.filesDeleted ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToggleCard
        enabled={ufEnabled}
        title={`Automatic unknown-face cleanup ${ufEnabled ? 'enabled' : 'disabled'}`}
        description={
          ufEnabled
            ? `Runs nightly at 02:35. Cluster folders under ml-data/unknown_faces/ older than ${ufRetention} day(s) are removed. Browse them under Attendance → Unknown Faces.`
            : 'The job is paused — crops of unidentified faces will be kept indefinitely until this is re-enabled or a manual run is triggered below. These are photographs of people the system could not identify; keeping them longer than the review needs is what this switch is for.'
        }
        onToggle={() => {
          const prev = ufEnabled;
          setUfEnabled(!prev);
          saveUf({ enabled: !prev }, () => setUfEnabled(prev));
        }}
      />

      <ToggleCard
        enabled={ufPreserveReviewed}
        title={`Keep clusters marked Reviewed ${ufPreserveReviewed ? '— exempt from cleanup' : '— deleted like any other'}`}
        description={
          ufPreserveReviewed
            ? 'A cluster an admin marked Reviewed is one somebody deliberately held on to — usually as evidence for a disputed attendance record — so it survives the retention window. New and Archived clusters expire normally.'
            : 'Every cluster expires on age alone, including the ones marked Reviewed. Download anything you need to keep before the next run.'
        }
        onToggle={() => {
          const prev = ufPreserveReviewed;
          setUfPreserveReviewed(!prev);
          saveUf({ preserveReviewed: !prev }, () => setUfPreserveReviewed(prev));
        }}
      />

      <div className="oc-card">
        <div className="oc-card-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                Keep unknown faces for
              </span>
              <input
                type="number"
                min={1}
                max={90}
                value={ufRetentionInput}
                onChange={(e) => setUfRetentionInput(e.target.value)}
                onBlur={() => {
                  const n = Number.parseInt(ufRetentionInput, 10);
                  if (!Number.isInteger(n) || n < 1 || n > 90) {
                    setUfRetentionInput(String(ufRetention));
                    showMsg('Retention must be a whole number of days, 1–90', 'error');
                    return;
                  }
                  if (n !== ufRetention) saveUf({ retentionDays: n });
                }}
                style={{
                  width: 70,
                  padding: '5px 8px',
                  fontSize: 13,
                  borderRadius: 6,
                  border: `1px solid ${T.border}`,
                  background: T.surface || '#fff',
                  color: T.text,
                }}
              />
              <span style={{ fontSize: 12, color: T.textMuted }}>day(s), 1–90</span>
            </div>
            <button
              onClick={handleUfRunNow}
              disabled={ufRunning}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: 'none',
                cursor: ufRunning ? 'not-allowed' : 'pointer',
                background: T.accent,
                color: '#fff',
                opacity: ufRunning ? 0.6 : 1,
              }}
              title="Deletes expired unknown-face clusters immediately, regardless of the toggle above."
            >
              {ufRunning ? 'Running…' : 'Run now'}
            </button>
          </div>

          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
            Last run: {formatDate(ufLastRunAt)}
          </div>

          {ufLastRunStats && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10,
                fontSize: 12,
                color: T.textMuted,
              }}
            >
              <div>
                Clusters scanned
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ufLastRunStats.scanned ?? 0}
                </div>
              </div>
              <div>
                Clusters removed
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ufLastRunStats.deleted ?? 0}
                </div>
              </div>
              <div>
                Crops deleted
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ufLastRunStats.filesDeleted ?? 0}
                </div>
              </div>
              <div>
                Reviewed kept
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                  {ufLastRunStats.preserved ?? 0}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
