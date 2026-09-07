// client/src/attendancemodule/cameraPreview.jsx
// Redesigned: Room selector → auto-starts both camera feeds simultaneously. Light theme.

import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { theme, styles, cssReset } from './config';

const apiUrl = getEnvironment();
const CAMERA_API = `${apiUrl}/attendancemodule/cameras`;

const statusColor = (status) => {
  if (status === 'online') return 'success';
  // "in_use" means the server skipped the probe because another feature holds
  // this camera's RTSP slot — amber, not the red of an actual fault.
  if (status === 'maintenance' || status === 'in_use') return 'warning';
  return 'danger';
};

// The wire value is snake_case for the query string; a badge should not be.
const statusLabel = (status) => (status === 'in_use' ? 'in use' : status || 'offline');

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === 'error';
  const isWarning = toast.type === 'warning';
  const bg = isError
    ? theme.danger
    : isWarning
      ? theme.warning
      : theme.success;
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
        animation: 'fadeIn 0.3s',
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

function StatusBadge({ status }) {
  return (
    <span
      style={{ ...styles.badge(statusColor(status)), display: 'inline-block' }}
    >
      {statusLabel(status)}
    </span>
  );
}

// RTSP connection setup is genuinely flaky under concurrent load (two cameras
// opening large streams at once) — a manual Retry click reliably recovers it,
// so automate that same recovery before ever surfacing the error to the user.
const MAX_AUTO_RETRIES = 2;
const AUTO_RETRY_DELAY_MS = 3000;

// How soon to look again once a hold's countdown has run out. The expiry the
// server reports is an upper bound — a check that finishes early frees the
// camera sooner — so reaching zero means "try now", and if the camera is still
// held the next refusal just restarts the countdown with the new expiry.
const BUSY_RECHECK_MS = 3000;

// Single camera feed panel
function FeedPanel({ camera, quality, scale, refreshKey, onError }) {
  const [feedKey, setFeedKey] = useState(0);
  const [starting, setStarting] = useState(true);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [streamUrl, setStreamUrl] = useState(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  // Set only while an attendance run (or another holder) owns this camera:
  // {heldBy, holderKind, secondsLeft}. Distinct from `failed` on purpose — this
  // panel is waiting its turn, not broken, and it reconnects on its own.
  const [busy, setBusy] = useState(null);
  // Each panel tracks its own preview job so the two feeds never share a slot.
  const jobIdRef = useRef(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef(null);

  const buildStreamUrl = useCallback(
    () =>
      `${CAMERA_API}/preview/stream?jobId=${encodeURIComponent(
        jobIdRef.current || '',
      )}&quality=${quality}&scale=${scale}&t=${Date.now()}`,
    [quality, scale],
  );

  const startFeed = useCallback(() => {
    if (!camera?._id) return;

    // Always attempt the connection — the offline status comes from a periodic
    // probe that can be stale or wrong; the preview start below is the real test.
    setStarting(true);
    setFailed(false);
    setFailReason('');
    setStreamUrl(null);
    setBusy(null);

    fetch(`${CAMERA_API}/${camera._id}/preview/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        // A camera held by an attendance check is not an error condition — the
        // scheduler outranks this preview by design. Tag it so the catch below
        // can wait it out instead of burning a retry and showing a warning.
        if (res.status === 409 && data?.busy) {
          const err = new Error(data.error || 'Camera in use');
          err.busy = data;
          throw err;
        }
        if (!res.ok) {
          throw new Error(data?.error || `Preview start failed (${res.status})`);
        }
        return data;
      })
      .then((data) => {
        retryCountRef.current = 0;
        setRetryAttempt(0);
        jobIdRef.current = data?.jobId || null;
        setStreamUrl(buildStreamUrl());
        setFeedKey((k) => k + 1);
        setStarting(false);
      })
      .catch((err) => {
        if (err.busy) {
          // Waiting for a scheduled check is not a failed attempt, so the
          // retry quota is restored rather than spent — the camera may be held
          // for several checks, and burning the quota here would leave nothing
          // for a genuine connection problem once it finally frees.
          retryCountRef.current = 0;
          setRetryAttempt(0);
          setStarting(false);
          setBusy({
            heldBy: err.busy.heldBy || 'another job',
            holderKind: err.busy.holderKind || '',
            secondsLeft: Math.max(0, Number(err.busy.retryAfterSec) || 0),
          });
          return;
        }
        if (retryCountRef.current < MAX_AUTO_RETRIES) {
          retryCountRef.current += 1;
          setRetryAttempt(retryCountRef.current);
          retryTimerRef.current = setTimeout(startFeed, AUTO_RETRY_DELAY_MS);
          return;
        }
        setStarting(false);
        setFailed(true);
        setFailReason(err.message);
        onError?.(
          `Could not start feed for ${camera.cameraId}: ${err.message}`,
        );
      });
  }, [camera?._id, buildStreamUrl]);

  useEffect(() => {
    startFeed();
    return () => {
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        retryCountRef.current = 0;
        setRetryAttempt(0);
        const jobId = jobIdRef.current;
        fetch(`${CAMERA_API}/preview/stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jobId ? { jobId } : {}),
        }).catch(() => {});
    };
}, [camera?._id, refreshKey]);

  // Countdown while another holder owns the camera, then reconnect by itself.
  // One timer per tick rather than a single interval, so the unmount cleanup
  // can never leave a reconnect scheduled against a panel that is gone.
  useEffect(() => {
    if (!busy) return undefined;
    if (busy.secondsLeft <= 0) {
      const t = setTimeout(startFeed, BUSY_RECHECK_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setBusy((b) => (b ? { ...b, secondsLeft: b.secondsLeft - 1 } : b)),
      1000,
    );
    return () => clearTimeout(t);
  }, [busy, startFeed]);

  useEffect(() => {
    if (streamUrl) {
      setStreamUrl(buildStreamUrl());
      setFeedKey((k) => k + 1);
    }
  }, [quality, scale]);

  const positionLabel = camera?.position?.toLowerCase().includes('left')
    ? 'Front Left'
    : 'Front Right';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: theme.surface,
        border: `1px solid ${streamUrl && !failed ? theme.accent : theme.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(26,31,60,0.07)',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Feed header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.border}`,
          background: theme.surfaceAlt,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: theme.accentDim,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
            }}
          >
            📷
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: theme.text }}>
              {camera?.cameraId}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>
              {positionLabel} · {camera?.ipAddress}:{camera?.port}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {busy ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: theme.warning }}>
              {busy.holderKind === 'scheduler' ? 'Attendance running' : 'In use'}
            </span>
          ) : starting ? (
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              {retryAttempt > 0
                ? `Retrying (${retryAttempt}/${MAX_AUTO_RETRIES})...`
                : 'Connecting...'}
            </span>
          ) : null}
          <StatusBadge status={camera?.status} />
        </div>
      </div>

      {/* Video frame */}
      <div
        style={{
          position: 'relative',
          background: starting || failed || busy ? theme.surfaceAlt : '#0a0c14',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {busy ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🎥</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: theme.text,
                marginBottom: 6,
              }}
            >
              {busy.secondsLeft > 0
                ? `Loading in ${busy.secondsLeft}s...`
                : 'Loading...'}
            </div>
            <div
              style={{
                color: theme.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
                maxWidth: 260,
                margin: '0 auto',
              }}
            >
              {busy.holderKind === 'scheduler'
                ? 'This camera is recording attendance right now. The feed starts on its own as soon as the check releases it.'
                : `In use by ${busy.heldBy}. The feed starts on its own once it is free.`}
            </div>
          </div>
        ) : starting ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
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
            <div
              style={{ color: theme.textMuted, fontSize: 13, fontWeight: 600 }}
            >
              Starting feed...
            </div>
          </div>
        ) : failed ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚠️</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: theme.danger,
                marginBottom: 6,
              }}
            >
              Failed to start feed
            </div>
            <div
              style={{
                color: theme.textMuted,
                fontSize: 12,
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              {failReason || 'Timed out waiting for first frame from RTSP stream.'}
            </div>
            <button
              type="button"
              onClick={() => {
                // Manual retry gets its own fresh quota of automatic retries,
                // not whatever was left over from the last exhausted attempt.
                retryCountRef.current = 0;
                setRetryAttempt(0);
                startFeed();
              }}
              style={{ ...styles.btnGhost, fontSize: 12, padding: '8px 20px' }}
            >
              Retry
            </button>
          </div>
        ) : streamUrl ? (
          <img
            key={feedKey}
            src={streamUrl}
            alt={`${camera?.cameraId} live feed`}
            style={{ width: '100%', display: 'block', objectFit: 'contain' }}
            onError={() => {
              if (retryCountRef.current < MAX_AUTO_RETRIES) {
                retryCountRef.current += 1;
                setRetryAttempt(retryCountRef.current);
                setStarting(true);
                setStreamUrl(null);
                retryTimerRef.current = setTimeout(startFeed, AUTO_RETRY_DELAY_MS);
                return;
              }
              setFailed(true);
              onError?.(`Stream error on ${camera?.cameraId}. Check RTSP URL.`);
            }}
          />
        ) : null}
      </div>

      {/* Stream URL footer */}
      <div
        style={{
          padding: '8px 14px',
          borderTop: `1px solid ${theme.border}`,
          background: theme.surfaceAlt,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: theme.textMuted,
            fontFamily: theme.fontMono,
            wordBreak: 'break-all',
          }}
        >
          {camera?.protocol?.toLowerCase()} · {camera?.ipAddress}:{camera?.port}
        </span>
        <span
          style={{
            fontSize: 10,
            color: theme.textMuted,
            fontFamily: theme.fontMono,
            wordBreak: 'break-all',
            textAlign: 'right',
          }}
        >
          {camera?.streamUrl}
        </span>
      </div>
    </div>
  );
}

export default function CameraPreview() {
  const [cameras, setCameras] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [roomCameras, setRoomCameras] = useState({ left: null, right: null });
  const [loading, setLoading] = useState(false);
  const [previewQuality, setPreviewQuality] = useState('90');
  const [previewScale, setPreviewScale] = useState('1');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = async () => {
    // Re-fetch camera docs from the DB first — refreshKey alone only restarts
    // the existing feed panels with whatever camera data is already in memory,
    // so an edited streamUrl (e.g. switching to a sub-stream) never took effect
    // until a full page reload.
    await fetchCameras();
    setRefreshKey(prev => prev + 1);
};

  const showToast = useCallback((msg, type = 'success') => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CAMERA_API}?liveStatus=true`);
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setCameras(list);

      const uniqueRooms = [
        ...new Set(list.map((c) => c.roomId).filter(Boolean)),
      ].sort();
      setRooms(uniqueRooms);

      if (uniqueRooms.length > 0) {
        setSelectedRoom((prev) => prev || uniqueRooms[0]);
      }
    } catch (err) {
      showToast(`Could not load cameras: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    if (!selectedRoom) {
      setRoomCameras({ left: null, right: null });
      return;
    }
    const roomList = cameras.filter((c) => c.roomId === selectedRoom);
    const left =
      roomList.find((c) => c.position?.toLowerCase().includes('left')) ||
      roomList[0] ||
      null;
    const right =
      roomList.find((c) => c.position?.toLowerCase().includes('right')) ||
      roomList[1] ||
      null;
    setRoomCameras({ left, right });
  }, [selectedRoom, cameras]);

  const cameraCount = [roomCameras.left, roomCameras.right].filter(
    Boolean,
  ).length;

  return (
    <div style={styles.page}>
      <style>{`
                ${cssReset}
                .preview-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 18px;
                }
                .controls-bar {
                    display: flex;
                    gap: 14px;
                    align-items: flex-end;
                    flex-wrap: wrap;
                    padding: 18px 24px;
                    background: ${theme.surface};
                    border: 1px solid ${theme.border};
                    border-radius: 12px;
                    margin-bottom: 18px;
                    box-shadow: 0 1px 6px rgba(26,31,60,0.05);
                }
                .control-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    min-width: 180px;
                }
                .dual-feed-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 18px;
                }
                .empty-slot {
                    border: 2px dashed ${theme.border};
                    border-radius: 14px;
                    min-height: 300px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: ${theme.textMuted};
                    background: ${theme.surfaceAlt};
                    gap: 8px;
                }
                .room-info-bar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 16px;
                    background: ${theme.surface};
                    border: 1px solid ${theme.border};
                    border-radius: 10px;
                    margin-bottom: 14px;
                    font-size: 13px;
                    color: ${theme.textMuted};
                    box-shadow: 0 1px 4px rgba(26,31,60,0.04);
                }
                @media (max-width: 860px) {
                    .dual-feed-grid { grid-template-columns: 1fr !important; }
                    .controls-bar   { flex-direction: column; align-items: stretch; }
                    .control-group  { min-width: unset !important; width: 100%; }
                }
                @media (max-width: 600px) {
                    .room-info-bar  { flex-wrap: wrap; gap: 8px; }
                }
            `}</style>

      <Toast toast={toast} />

      {/* Compact header */}
      <div className="preview-header">
        <div>
          <div style={styles.heading}>Camera Live Preview</div>
          <div style={{ ...styles.subheading, marginBottom: 0 }}>Select a room to view both camera feeds side by side</div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-bar">
        <div className="control-group" style={{ minWidth: 220 }}>
          <label style={styles.label}>Select Room</label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{ ...styles.select, fontWeight: 700, fontSize: 15 }}
            disabled={loading}
          >
            {rooms.length === 0 && <option value="">No rooms found</option>}
            {rooms.map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label style={styles.label}>Preview Quality</label>
          <select
            value={previewQuality}
            onChange={(e) => setPreviewQuality(e.target.value)}
            style={styles.select}
          >
            <option value="30">30 — low bandwidth</option>
            <option value="60">60 — balanced</option>
            <option value="75">75 — sharp</option>
            <option value="90">90 — very sharp</option>
            <option value="95">95 — maximum</option>
          </select>
        </div>

        <div className="control-group">
          <label style={styles.label}>Preview Scale</label>
          <select
            value={previewScale}
            onChange={(e) => setPreviewScale(e.target.value)}
            style={styles.select}
          >
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          style={{ ...styles.btnGhost, alignSelf: 'flex-end' }}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Room info bar */}
      {selectedRoom && (
        <div className="room-info-bar">
          <span>Room</span>
          <strong style={{ color: theme.text, fontSize: 14 }}>
            {selectedRoom}
          </strong>
          <span>·</span>
          <span>
            {cameraCount} camera{cameraCount !== 1 ? 's' : ''} found
          </span>
          {roomCameras.left && (
            <>
              <span>·</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>
                {roomCameras.left.cameraId}
              </span>
              <StatusBadge status={roomCameras.left.status} />
            </>
          )}
          {roomCameras.right && (
            <>
              <span>·</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>
                {roomCameras.right.cameraId}
              </span>
              <StatusBadge status={roomCameras.right.status} />
            </>
          )}
        </div>
      )}

      {/* Dual feed */}
      {!selectedRoom ? (
        <div
          style={{
            textAlign: 'center',
            padding: 64,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 14,
            color: theme.textMuted,
            fontSize: 14,
          }}
        >
          Select a room above to start viewing feeds.
        </div>
      ) : (
        <div className="dual-feed-grid">
          {roomCameras.left ? (
            <FeedPanel
              camera={roomCameras.left}
              quality={previewQuality}
              scale={previewScale}
              refreshKey={refreshKey}
              onError={(msg) => showToast(msg, 'warning')}
            />
          ) : (
            <div className="empty-slot">
              <span style={{ fontSize: 28 }}>📷</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                Second camera not registered
              </div>
              <div style={{ fontSize: 12 }}>
                Add a second camera for <strong>{selectedRoom}</strong> on the
                camera data-entry page.
              </div>
            </div>
          )}

          {roomCameras.right ? (
            <FeedPanel
              camera={roomCameras.right}
              quality={previewQuality}
              scale={previewScale}
              refreshKey={refreshKey}
              onError={(msg) => showToast(msg, 'warning')}
            />
          ) : (
            <div className="empty-slot">
              <span style={{ fontSize: 28 }}>📷</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
                Second camera not registered
              </div>
              <div style={{ fontSize: 12 }}>
                Add a second camera for <strong>{selectedRoom}</strong> on the
                camera data-entry page.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
