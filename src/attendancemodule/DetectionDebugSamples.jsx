// client/src/attendancemodule/DetectionDebugSamples.jsx
//
// Browser for ml-data/detection_debug/ — the per-run crop dumps the ML service
// uploads while detector_config.debug_crops is on (ML Fine Tuning → Face
// Detector). Rendered as a sub-tab of the Rejected Samples page.
//
// The counts are the diagnosis, so they lead: raw is every detection before any
// filter, accepted is what reached matching, and the gap between them is broken
// down by reject reason. An empty raw for a student who was plainly in frame
// means the detector never saw them; a large rejected bucket names the exact
// threshold that discarded them.

import { useState, useEffect, useCallback } from 'react';
import { theme, styles, cssReset } from './config';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();
const BASE = `${apiUrl}/api/v1/ml`;

const BUCKETS = [
    { key: 'raw',      label: 'Raw',      hint: 'Every detection, before any filter ran.' },
    { key: 'rejected', label: 'Rejected', hint: 'Discarded by a filter — the reason and failing value are in the filename.' },
    { key: 'accepted', label: 'Accepted', hint: 'Passed every filter and reached matching.' },
];

// REJECT_<REASON> → which knob to move. Kept next to the UI that shows the
// counts so the number and its remedy are never separated.
const REASON_HELP = {
    SMALL: 'Face smaller than the zoom pass’s min_face_px — raise detect resolution or lower min_face_px.',
    BLUR:  'Laplacian variance below the pass’s min_sharpness — lower min_sharpness, or the stream is genuinely soft.',
    SPOOF: 'Liveness classifier called it a spoof — lower onnx_threshold, or turn liveness off to confirm.',
    OTHER: 'Unrecognised reject reason.',
};

function formatDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return '—';
    }
}

export default function DetectionDebugSamples() {
    const [runs, setRuns]       = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const [openRun, setOpenRun]       = useState(null);   // { run, bucket }
    const [samples, setSamples]       = useState([]);
    const [sampleTotal, setSampleTotal] = useState(0);
    const [loadingSamples, setLoadingSamples] = useState(false);

    const [lightbox, setLightbox] = useState(null);

    const loadRuns = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${BASE}/detection-debug-runs`, { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load debug runs');
            setRuns(Array.isArray(data.runs) ? data.runs : []);
        } catch (err) {
            setError(err.message || 'Failed to load debug runs');
            setRuns([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => { loadRuns(); }, [loadRuns]);

    const openBucket = async (run, bucket) => {
        setOpenRun({ run, bucket });
        setLoadingSamples(true);
        setSamples([]);
        setSampleTotal(0);
        try {
            const res = await fetch(
                `${BASE}/detection-debug/${encodeURIComponent(run)}/${bucket}/samples`,
                { credentials: 'include' },
            );
            const data = await res.json();
            setSamples(Array.isArray(data.samples) ? data.samples : []);
            setSampleTotal(data.total || 0);
        } catch {
            setSamples([]);
        }
        setLoadingSamples(false);
    };

    const closeModal = () => {
        setOpenRun(null);
        setSamples([]);
        setSampleTotal(0);
    };

    const bucketHint = openRun
        ? (BUCKETS.find((b) => b.key === openRun.bucket)?.hint || '')
        : '';

    return (
        <div style={{ marginTop: 4 }}>
            <style>{cssReset}</style>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                        Every crop the detector produced on a live attendance run, kept per run and
                        split into three buckets. Turn collection on with <strong>Detection debug
                        crops</strong> under ML Fine Tuning → Face Detector; it captures a limited
                        number of frames per run and should be switched off once you have a sample.
                        Run folders are removed automatically — see Other Controls.
                    </div>
                </div>
                <button
                    onClick={loadRuns}
                    disabled={loading}
                    style={{ ...styles.btnGhost, padding: '6px 14px', fontSize: 12 }}
                >
                    {loading ? 'Loading…' : '↻ Refresh'}
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>Loading…</div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.danger, fontSize: 13 }}>
                    {error}
                </div>
            ) : runs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 13 }}>
                    No debug runs collected yet. Enable “Detection debug crops” under ML Fine Tuning →
                    Face Detector, then start a live attendance run.
                </div>
            ) : (
                <table className="ams-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left' }}>Run</th>
                            <th style={{ textAlign: 'left' }}>Collected</th>
                            <th style={{ textAlign: 'center' }}>Raw</th>
                            <th style={{ textAlign: 'center' }}>Rejected</th>
                            <th style={{ textAlign: 'center' }}>Accepted</th>
                            <th style={{ textAlign: 'left' }}>Reject reasons</th>
                        </tr>
                    </thead>
                    <tbody>
                        {runs.map((r) => (
                            <tr key={r.run}>
                                <td style={{ textAlign: 'left', fontWeight: 600, wordBreak: 'break-all' }}>
                                    {r.run}
                                </td>
                                <td style={{ textAlign: 'left', fontSize: 12, color: theme.textMuted }}>
                                    {formatDate(r.updatedAt)}
                                </td>
                                {BUCKETS.map((b) => (
                                    <td key={b.key} style={{ textAlign: 'center' }}>
                                        {r.counts?.[b.key] > 0 ? (
                                            <button
                                                onClick={() => openBucket(r.run, b.key)}
                                                title={b.hint}
                                                style={{ ...styles.btnGhost, padding: '4px 10px', fontSize: 11 }}
                                            >
                                                {r.counts[b.key]}
                                            </button>
                                        ) : (
                                            <span style={{ color: theme.textMuted }}>0</span>
                                        )}
                                    </td>
                                ))}
                                <td style={{ textAlign: 'left' }}>
                                    {Object.keys(r.rejectReasons || {}).length === 0 ? (
                                        <span style={{ fontSize: 11, color: theme.textMuted }}>—</span>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {Object.entries(r.rejectReasons)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([reason, count]) => (
                                                    <span
                                                        key={reason}
                                                        title={REASON_HELP[reason] || REASON_HELP.OTHER}
                                                        style={{
                                                            fontSize: 10, fontWeight: 700,
                                                            padding: '2px 7px', borderRadius: 999,
                                                            background: `${theme.warning}18`,
                                                            color: theme.warning,
                                                            cursor: 'help',
                                                        }}
                                                    >
                                                        {reason} {count}
                                                    </span>
                                                ))}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {openRun && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.55)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 24,
                }}>
                    <div style={{
                        background: theme.surface, borderRadius: 12, padding: '20px 24px 24px',
                        maxWidth: 900, width: '100%', maxHeight: '85vh', overflowY: 'auto',
                        border: `1px solid ${theme.border}`,
                        boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'flex-start',
                            justifyContent: 'space-between', gap: 12, marginBottom: 16,
                        }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, wordBreak: 'break-all' }}>
                                    {openRun.run} · {openRun.bucket}
                                </div>
                                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, maxWidth: 620 }}>
                                    {loadingSamples
                                        ? 'Loading…'
                                        : `Showing ${samples.length} of ${sampleTotal} crop(s). ${bucketHint}`}
                                </div>
                            </div>
                            <button
                                onClick={closeModal}
                                style={{ ...styles.btnGhost, padding: '6px 14px', fontSize: 12 }}
                            >
                                Close
                            </button>
                        </div>

                        {loadingSamples ? (
                            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted }}>Loading…</div>
                        ) : samples.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: theme.textMuted, fontSize: 13 }}>
                                No crops in this bucket.
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                gap: 10,
                            }}>
                                {samples.map((s) => (
                                    <div
                                        key={s.filename}
                                        onClick={() => setLightbox(s)}
                                        style={{
                                            borderRadius: 8, overflow: 'hidden',
                                            border: `1px solid ${theme.border}`, cursor: 'zoom-in',
                                        }}
                                    >
                                        <img
                                            src={`${apiUrl}${s.url}`}
                                            alt={s.filename}
                                            loading="lazy"
                                            style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
                                        />
                                        <div style={{
                                            padding: '4px 6px', fontSize: 9, color: theme.textMuted,
                                            wordBreak: 'break-all', lineHeight: 1.4,
                                        }}>
                                            {s.filename}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', zIndex: 10001,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 12, padding: 24, cursor: 'zoom-out',
                    }}
                >
                    <img
                        src={`${apiUrl}${lightbox.url}`}
                        alt={lightbox.filename}
                        style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
                    />
                    <div style={{ color: '#fff', fontSize: 12, textAlign: 'center', wordBreak: 'break-all', maxWidth: '90vw' }}>
                        {lightbox.filename}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
                        style={{ ...styles.btnGhost, padding: '6px 16px', fontSize: 12 }}
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}
