// client/src/attendancemodule/OtherControlsSettingsTab.jsx
//
// "Other Controls" settings tab — miscellaneous admin toggles.
// Currently two on/off switches (both default OFF) that restrict
// Ground Truth acquisition and Attendance runs to 08:30–17:30 IST.
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

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const applySettings = (s) => {
    setGtEnabled(!!s?.groundTruthTimeWindowEnabled);
    setRunEnabled(!!s?.attendanceRunTimeWindowEnabled);
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
    </div>
  );
}
