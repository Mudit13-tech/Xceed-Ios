import React from 'react';
import { theme } from './config';

// Shared badge for AttendanceReport.enrollment (see server/src/models/
// attendanceReport.js and resolveEnrollment in embeddingSyncHelper.js).
//
// A run no longer skips when a subject has no .pkl or no ground truth for its
// batch — a period happens once and cannot be re-run, so the run goes ahead
// against whatever gallery can be assembled. That makes "everyone absent"
// ambiguous: it can mean the class really was empty, or that the model was
// comparing faces against the wrong people. This is what tells the two apart,
// so it has to appear anywhere a result is read, not just on the live page.
//
// Renders nothing for a normal run, which is the common case.

const SOURCE_LABEL = {
    'batch+roster': 'Cross-batch roster',
    pkl: 'Subject .pkl fallback',
    institute: 'Institute-wide fallback',
    none: 'No embeddings',
};

const SOURCE_TONE = {
    // Not degraded on its own — an elective legitimately spans batches — but
    // still worth surfacing, since it means students came from another
    // department's folder.
    'batch+roster': { fg: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
    pkl: { fg: '#f59e0b', bg: 'rgba(245,158,11,0.09)' },
    institute: { fg: '#f97316', bg: 'rgba(249,115,22,0.10)' },
    none: { fg: '#ef4444', bg: 'rgba(239,68,68,0.09)' },
};

// Not exported: keeping this file a component-only module is what lets Vite
// fast-refresh it. Callers just render the component, which no-ops on a normal
// run anyway.
function isNoteworthy(enrollment) {
    if (!enrollment) return false;
    return !!enrollment.degraded || enrollment.source === 'batch+roster';
}

export default function EnrollmentWarning({ enrollment, compact = false }) {
    if (!isNoteworthy(enrollment)) return null;

    const source = enrollment.source || 'batch';
    const tone = SOURCE_TONE[source] || SOURCE_TONE.pkl;
    const label = SOURCE_LABEL[source] || 'Fallback enrollment';
    const notes = enrollment.notes || [];

    if (compact) {
        return (
            <span
                title={notes.join('\n')}
                style={{
                    display: 'inline-block', fontSize: 9, fontWeight: 800,
                    color: tone.fg, background: tone.bg, border: `1px solid ${tone.fg}33`,
                    padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase',
                    letterSpacing: '.05em', whiteSpace: 'nowrap',
                }}
            >
                {label}
            </span>
        );
    }

    return (
        <div
            style={{
                fontSize: 11, color: tone.fg, fontWeight: 600,
                background: tone.bg, padding: '6px 10px', borderRadius: 6,
                display: 'flex', flexDirection: 'column', gap: 4,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>⚠</span>
                <span>{label}</span>
            </div>
            {notes.map((note, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 500, color: theme.textMuted, lineHeight: 1.4 }}>
                    {note}
                </div>
            ))}
            {(enrollment.unresolvedRolls || []).length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 500, color: theme.textMuted }}>
                    Generate embeddings for the unresolved roll numbers to clear this.
                </div>
            )}
        </div>
    );
}
