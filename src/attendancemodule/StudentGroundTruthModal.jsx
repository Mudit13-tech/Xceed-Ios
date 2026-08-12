// client/src/attendancemodule/StudentGroundTruthModal.jsx
//
// The ground-truth photos behind one row of an attendance report. Opened by
// clicking a roll number in the report tables, so a coordinator looking at a
// wrong-looking present/absent call can see the exact images the match was
// made against — split into the photos that actually built the embedding and
// the backups held in reserve — and re-assign them without leaving the page.
//
// Reads  GET  /attendancemodule/ground-truth/student-ground-truth/:batch/:rollNo
// Writes POST /attendancemodule/ground-truth/update-embedding
// (the same endpoints the Roll Assign page uses, so both views stay in step).

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import getEnvironment from '../getenvironment';
import { theme, styles } from './config';
import { Trash2 } from 'lucide-react';

const apiUrl = getEnvironment();
const GT_BASE = `${apiUrl}/attendancemodule/ground-truth`;
const fetchWithAuth = (input, init = {}) => window.fetch(input, {
    credentials: 'include',
    ...init,
});

// Server-side cap in groundTruthController.updateStudentEmbedding — mirrored
// here so the limit is visible in the UI rather than arriving as a 400.
const MAX_EMBEDDING = 5;

const MODAL_CSS = `
    .gt-modal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
    }
    .gt-photo-card img { display: block; }
    @media (max-width: 720px) {
        .gt-modal-shell { width: 100% !important; padding: 16px !important; }
        .gt-modal-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
    }
`;

const GROUPS = {
    embedding: {
        title: 'Embedding photos',
        hint: `Used to build this student's face embedding — at most ${MAX_EMBEDDING}.`,
        color: theme.success,
        dim: theme.successDim,
    },
    backup: {
        title: 'Backup photos',
        hint: 'Approved and held in reserve — not part of the current embedding.',
        color: theme.warning,
        dim: theme.warningDim,
    },
    other: {
        title: 'Other photos',
        hint: 'In the folder but not classified either way.',
        color: theme.textMuted,
        dim: theme.surfaceAlt,
    },
};

export default function StudentGroundTruthModal({ batch, rollNo, student, onClose }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    // One flat list, each photo tagged with the group it currently sits in.
    // Reassignment is local until Save, so a mis-click costs nothing.
    const [photos, setPhotos] = useState([]);
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchWithAuth(
                `${GT_BASE}/student-ground-truth/${encodeURIComponent(batch)}/${encodeURIComponent(rollNo)}`,
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load ground truth');

            const tag = (list, group) => (Array.isArray(list) ? list : []).map((p) => ({
                filename: p.filename,
                score: p.score,
                group,
            }));
            setPhotos([
                ...tag(data.embeddingFiles, 'embedding'),
                ...tag(data.backupFiles, 'backup'),
                ...tag(data.untrackedFiles, 'other'),
            ]);
            setDirty(false);
        } catch (err) {
            setError(err.message || 'Could not load ground truth');
            setPhotos([]);
        } finally {
            setLoading(false);
        }
    }, [batch, rollNo]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const inGroup = (group) => photos.filter((p) => p.group === group);
    const embeddingCount = inGroup('embedding').length;

    function moveTo(filename, group) {
        setNotice('');
        if (group === 'embedding' && embeddingCount >= MAX_EMBEDDING) {
            setNotice(`At most ${MAX_EMBEDDING} embedding photos — move one out first.`);
            return;
        }
        setPhotos((current) => current.map(
            (p) => (p.filename === filename ? { ...p, group } : p),
        ));
        setDirty(true);
    }

    async function save() {
        const embeddingFiles = inGroup('embedding').map((p) => p.filename);
        const backupFiles = inGroup('backup').map((p) => p.filename);

        if (embeddingFiles.length === 0) {
            setNotice('Keep at least one embedding photo.');
            return;
        }

        setSaving(true);
        setNotice('');
        setError('');
        try {
            const res = await fetchWithAuth(`${GT_BASE}/update-embedding`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch, rollNo, embeddingFiles, backupFiles }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not update ground truth');
            setDirty(false);
            setNotice(
                `Ground truth updated — embedding rebuilt from ${embeddingFiles.length} photo${embeddingFiles.length === 1 ? '' : 's'}.`,
            );
        } catch (err) {
            setError(err.message || 'Could not update ground truth');
        } finally {
            setSaving(false);
        }
    }

    async function deletePhoto(filename) {
        if (!window.confirm(`Permanently delete ${filename}?`)) return;
        setSaving(true);
        setNotice('');
        setError('');
        try {
            const res = await fetchWithAuth(
                `${GT_BASE}/photo/${encodeURIComponent(batch)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not delete photo');
            setNotice(`Deleted ${filename}.`);
            // Removing from state
            setPhotos((current) => current.filter((p) => p.filename !== filename));
        } catch (err) {
            setError(err.message || 'Could not delete photo');
        } finally {
            setSaving(false);
        }
    }

    const photoUrl = (filename) =>
        `${GT_BASE}/photo/${encodeURIComponent(batch)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`;

    const allPhotos = [...(student.embeddingFiles || []), ...(student.backupFiles || []), ...(student.untrackedFiles || [])];
    let maxAddedAt = 0;
    allPhotos.forEach(p => {
        if (p.addedAt) {
            const time = new Date(p.addedAt).getTime();
            if (time > maxAddedAt) maxAddedAt = time;
        }
    });
    
    function PhotoCard({ photo }) {
        const group = GROUPS[photo.group];
        // Where this photo can go — never back to "other", which is a
        // read-only "found in the folder, unclassified" bucket.
        const targets = ['embedding', 'backup'].filter((g) => g !== photo.group);

        const isNew = photo.addedAt && maxAddedAt > 0 && (maxAddedAt - new Date(photo.addedAt).getTime() < 30 * 1000);

        return (
            <div
                className="gt-photo-card"
                style={{
                    border: `1px solid ${isNew ? theme.accent : theme.border}`,
                    borderTop: `3px solid ${isNew ? theme.accent : group.color}`,
                    boxShadow: isNew ? `0 0 8px ${theme.accent}66` : 'none',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: theme.surface,
                    position: 'relative',
                }}
            >
                {isNew && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: theme.accent, color: '#fff', fontSize: 9, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4, zIndex: 10 }}>
                        NEW
                    </div>
                )}
                <img
                    src={photoUrl(photo.filename)}
                    alt={photo.filename}
                    style={{
                        width: '100%',
                        height: 130,
                        objectFit: 'cover',
                        background: theme.surfaceAlt,
                    }}
                />
                <div style={{ padding: '8px 8px 10px' }}>
                    <div
                        title={photo.filename}
                        style={{
                            fontSize: 10,
                            color: theme.textMuted,
                            fontFamily: theme.fontMono,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: 6,
                        }}
                    >
                        {photo.filename}
                        {photo.score != null ? ` · ${Number(photo.score).toFixed(2)}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {targets.map((target) => (
                            <button
                                key={target}
                                type="button"
                                disabled={saving}
                                onClick={() => moveTo(photo.filename, target)}
                                style={{
                                    ...styles.btnGhost,
                                    padding: '3px 8px',
                                    fontSize: 10,
                                    opacity: saving ? 0.5 : 1,
                                }}
                            >
                                → {target === 'embedding' ? 'Embedding' : 'Backup'}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => deletePhoto(photo.filename)}
                            style={{
                                ...styles.btnGhost,
                                color: theme.danger,
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: saving ? 0.5 : 1,
                            }}
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    function Section({ group }) {
        const meta = GROUPS[group];
        const items = inGroup(group);

        return (
            <div style={{ marginBottom: 20 }}>
                <div style={{
                    display: 'flex', alignItems: 'baseline', gap: 8,
                    flexWrap: 'wrap', marginBottom: 8,
                }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>
                        {meta.title}
                    </span>
                    <span style={{
                        fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                        background: meta.dim, color: meta.color,
                    }}>
                        {group === 'embedding' ? `${items.length} / ${MAX_EMBEDDING}` : items.length}
                    </span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>{meta.hint}</span>
                </div>

                {items.length > 0 ? (
                    <div className="gt-modal-grid">
                        {items.map((photo) => (
                            <PhotoCard key={photo.filename} photo={photo} />
                        ))}
                    </div>
                ) : (
                    <div style={{
                        fontSize: 12, color: theme.textMuted, padding: '12px 14px',
                        border: `1px dashed ${theme.border}`, borderRadius: 8,
                    }}>
                        None.
                    </div>
                )}
            </div>
        );
    }

    const attendanceFacts = [
        ['ML status', student?.status || '—'],
        ['Final', student?.finalStatus || '—'],
        [
            'Confidence',
            student?.avgConfidence > 0 ? `${(student.avgConfidence * 100).toFixed(1)}%` : '—',
        ],
        ['Zone', student?.confidenceZone || '—'],
        [
            'First seen',
            student?.firstSeenSec != null
                ? `${Math.floor(student.firstSeenSec / 60)}m ${Math.round(student.firstSeenSec % 60)}s`
                : '—',
        ],
    ];

    return createPortal(
        <>
            <style>{MODAL_CSS}</style>
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(7,10,22,0.55)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                }}
            >
                <div
                    className="gt-modal-shell"
                    onClick={(event) => event.stopPropagation()}
                    style={{
                        ...styles.card,
                        width: 'min(900px, 100%)',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: 24,
                    }}
                >
                    <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'flex-start', gap: 12, marginBottom: 6,
                    }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontSize: 17, fontWeight: 700, color: theme.text,
                                fontFamily: theme.fontMono,
                            }}>
                                {rollNo}
                            </div>
                            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                                Ground truth · {batch}
                            </div>
                        </div>
                        <button type="button" onClick={onClose} style={styles.btnGhost}>
                            Close
                        </button>
                    </div>

                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        margin: '14px 0 18px',
                    }}>
                        {attendanceFacts.map(([label, value]) => (
                            <span
                                key={label}
                                style={{
                                    fontSize: 11,
                                    padding: '4px 10px',
                                    borderRadius: 999,
                                    background: theme.surfaceAlt,
                                    color: theme.textMuted,
                                }}
                            >
                                {label}: <strong style={{ color: theme.text }}>{value}</strong>
                            </span>
                        ))}
                    </div>

                    {error ? (
                        <div style={{
                            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                            background: theme.dangerDim, color: theme.danger, fontSize: 12,
                        }}>
                            {error}
                        </div>
                    ) : null}

                    {notice ? (
                        <div style={{
                            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                            background: theme.accentDim, color: theme.accent, fontSize: 12,
                        }}>
                            {notice}
                        </div>
                    ) : null}

                    {loading ? (
                        <div style={{ padding: '28px 0', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
                            Loading ground truth photos…
                        </div>
                    ) : photos.length === 0 && !error ? (
                        <div style={{ padding: '28px 0', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>
                            No ground truth photos on file for this student.
                        </div>
                    ) : (
                        <>
                            <Section group="embedding" />
                            <Section group="backup" />
                            <Section group="other" />
                        </>
                    )}

                    {!loading && photos.length > 0 ? (
                        <div style={{
                            display: 'flex', gap: 10, alignItems: 'center',
                            flexWrap: 'wrap', borderTop: `1px solid ${theme.border}`, paddingTop: 16,
                        }}>
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving || !dirty}
                                style={{
                                    ...styles.btnPrimary,
                                    opacity: saving || !dirty ? 0.55 : 1,
                                    cursor: saving || !dirty ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {saving ? 'Rebuilding embedding…' : 'Save ground truth'}
                            </button>
                            <button
                                type="button"
                                onClick={load}
                                disabled={saving}
                                style={{ ...styles.btnGhost, opacity: saving ? 0.55 : 1 }}
                            >
                                Reset
                            </button>
                            <span style={{ fontSize: 11, color: theme.textMuted }}>
                                {dirty
                                    ? 'Saving re-runs this student’s embedding and every subject PKL they appear in.'
                                    : 'Move a photo between groups to enable saving.'}
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>
        </>,
        document.body,
    );
}
