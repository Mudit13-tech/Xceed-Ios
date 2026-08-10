// client/src/attendancemodule/PipelineStageNote.jsx
//
// One shared banner so the two kinds of "missing face" can never be read as the
// same thing. A face that never appears in a report failed at exactly one of
// two stages, and the remedy is completely different at each:
//
//   DETECTOR stage  — found in the frame, then discarded before any embedding
//                     existed (too small / too blurry / judged a spoof). It
//                     never reached the matching model, so it is NOT unknown —
//                     nothing was ever compared against ground truth.
//                     Remedy: detection thresholds, resolution, liveness.
//
//   MATCHING stage  — detected and embedded cleanly, clustered, but no enrolled
//                     student cleared the recognition threshold. THIS is an
//                     unknown face. Remedy: enrolment quality or the
//                     recognition threshold.
//
// Rendered at the top of the Detector Rejects and Unknown Faces pages, with the
// current page's stage highlighted, so whichever one an admin lands on shows
// where it sits in the funnel and what the other one is.

import { theme } from './config';

const STAGES = {
    detector: {
        label: 'Detector stage',
        headline: 'Faces the detector found and then discarded',
        detail:
            'These never produced an embedding, so they were never compared against ground truth — '
            + 'they are not "unknown", they simply never got that far. Each crop\'s filename carries '
            + 'the reason and the value that missed: REJECT_SMALL (min_face_px), REJECT_BLUR '
            + '(min_sharpness) or REJECT_SPOOF (liveness threshold).',
        remedy: 'Fix by raising detect resolution / det_size, or loosening the named threshold.',
    },
    matching: {
        label: 'Matching stage',
        headline: 'Faces detected cleanly that matched no enrolled student',
        detail:
            'These passed every detector filter and produced a good embedding, but no student in '
            + 'ground truth cleared the recognition threshold — so they are reported as unknown and '
            + 'can be assigned a roll number here.',
        remedy: 'Fix by improving enrolment for that student, or lowering the recognition threshold.',
    },
};

export default function PipelineStageNote({ stage }) {
    const s = STAGES[stage];
    if (!s) return null;
    const other = stage === 'detector' ? STAGES.matching : STAGES.detector;
    const otherPage = stage === 'detector'
        ? 'Unknown Faces (No GT Match)'
        : 'Detector Rejects';

    return (
        <div style={{
            border: `1px solid ${theme.border}`,
            borderLeft: `3px solid ${theme.accent}`,
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16,
            background: `${theme.accent}0d`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
                    textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999,
                    background: theme.accent, color: '#fff',
                }}>
                    {s.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
                    {s.headline}
                </span>
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
                {s.detail}
            </div>
            <div style={{ fontSize: 12, color: theme.text, marginTop: 6, fontWeight: 500 }}>
                {s.remedy}
            </div>
            <div style={{
                fontSize: 11, color: theme.textMuted, marginTop: 8,
                paddingTop: 8, borderTop: `1px dashed ${theme.border}`,
            }}>
                <strong>Not to be confused with:</strong> {other.label.toLowerCase()} —{' '}
                {other.headline.toLowerCase()}. See the <strong>{otherPage}</strong> tab.
            </div>
        </div>
    );
}
