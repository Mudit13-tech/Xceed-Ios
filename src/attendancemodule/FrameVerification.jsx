import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cssReset, styles, theme } from './config';
import { usePeriods } from './usePeriods';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();
const CAMERA_ROOMS_API = `${apiUrl}/attendancemodule/cameras/rooms`;
const MASTERROOM_API = `${apiUrl}/timetablemodule/masterroom`;
const VERIFY_API = `${apiUrl}/attendancemodule/frame-verification`;
const CLASS_INFO_API = `${apiUrl}/timetablemodule/lock/attendance-lookup`;

const PAGE_CSS = `
    ${cssReset}
    .frame-gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
    }
    .frame-chip {
        border: 1px solid ${theme.border};
        background: ${theme.surfaceAlt};
        color: ${theme.textMuted};
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background .15s ease, color .15s ease, border-color .15s ease;
    }
    .frame-chip.active {
        background: ${theme.accentDim};
        border-color: rgba(99,102,241,0.28);
        color: ${theme.accent};
    }
    .frame-thumb:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 22px rgba(26,31,60,0.12);
    }
    @media (max-width: 720px) {
        .frame-filter-grid {
            grid-template-columns: 1fr !important;
        }
        .frame-modal-body {
            grid-template-columns: 1fr !important;
        }
    }
`;

function StatBadge({ label, value, tone = 'default' }) {
    return (
        <span style={styles.badge(tone === 'default' ? undefined : tone)}>
            {label}: {value}
        </span>
    );
}

// "2026-08-10T09:15:47" → "09:15:47". The stamp is already local wall-clock
// (written by the server that ran the check), so it must not go through Date —
// that would re-interpret it in the browser's timezone.
function clockOf(isoLocal) {
    const m = /T(\d{2}:\d{2}:\d{2})/.exec(isoLocal || '');
    return m ? m[1] : null;
}

// One period folder holds every check of that period, so "Cam 1, 15s" alone
// doesn't identify a frame — which run it came from and when it was actually
// taken are what make it evidence.
function FrameStats({ frame }) {
    const captured = clockOf(frame.capturedAt);
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {frame.runTime ? (
                <StatBadge
                    label={frame.checkIndex ? `Run ${frame.checkIndex}` : 'Run'}
                    value={frame.runTime}
                />
            ) : null}
            {captured ? <StatBadge label="At" value={captured} /> : null}
            {frame.camera != null ? <StatBadge label="Cam" value={frame.camera} tone="success" /> : null}
            {frame.elapsedSec != null ? <StatBadge label="Sec" value={frame.elapsedSec} tone="warning" /> : null}
            {frame.facesCount != null ? <StatBadge label="Faces" value={frame.facesCount} tone="danger" /> : null}
        </div>
    );
}

function EmptyState({ title, subtitle }) {
    return (
        <div style={{
            ...styles.card,
            textAlign: 'center',
            padding: '36px 24px',
            color: theme.textMuted,
        }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13 }}>{subtitle}</div>
        </div>
    );
}

export default function FrameVerification({ fixedDepartment = '' }) {
    const { slotLabel } = usePeriods();
    // Deep-link support (e.g. from the ERP Overrides page): ?room=&date=&period=
    // pre-fills the selectors so the linked folder loads without manual clicks.
    const [searchParams] = useSearchParams();
    const [rooms, setRooms] = useState([]);
    const [roomsLoading, setRoomsLoading] = useState(true);
    const [room, setRoom] = useState(() => searchParams.get('room') || '');
    const [availableDates, setAvailableDates] = useState([]);
    const [availablePeriods, setAvailablePeriods] = useState([]);
    const [availableFolders, setAvailableFolders] = useState([]);
    const [date, setDate] = useState(() => searchParams.get('date') || '');
    const [period, setPeriod] = useState(() => searchParams.get('period') || '');
    const [availabilityLoading, setAvailabilityLoading] = useState(false);
    const [framesLoading, setFramesLoading] = useState(false);
    const [galleryData, setGalleryData] = useState(null);
    const [modalState, setModalState] = useState({ open: false, index: 0 });
    const [fullscreenActive, setFullscreenActive] = useState(false);
    // The live timetable answer, used ONLY as a fallback — see classInfo below.
    const [liveClassInfo, setLiveClassInfo] = useState(null);
    const [classInfoLoading, setClassInfoLoading] = useState(false);
    const [downloadError, setDownloadError] = useState(null);
    const modalRef = useRef(null);
    // Locate-a-student deep link (from ERP Override Analysis): ?roll= filters the
    // annotated gallery to frames containing that roll; ?sec= (fallback for old
    // sessions with no per-frame roll data) auto-opens the frame nearest that
    // elapsed second. autoOpenedRef ensures the auto-open fires only once.
    const [rollFilter, setRollFilter] = useState(() => searchParams.get('roll') || '');
    const targetSec = Number(searchParams.get('sec'));
    const autoOpenedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setRoomsLoading(true);
            try {
                // Only rooms that already have a camera registered are shown
                // (Camera registry → distinct roomId).
                const res = await fetch(CAMERA_ROOMS_API);
                const data = await res.json();
                let allRooms = Array.isArray(data.rooms) ? data.rooms : [];

                if (fixedDepartment) {
                    // Dept-admin: only show rooms belonging to their department.
                    // Intersect the camera-registered room list with the dept's
                    // master room list so we never show a room outside scope.
                    try {
                        const deptRes  = await fetch(`${MASTERROOM_API}/dept/${encodeURIComponent(fixedDepartment)}`);
                        const deptData = await deptRes.json();
                        const deptRoomNames = new Set(
                            (Array.isArray(deptData) ? deptData : [])
                                .map(r => String(r.room || '').trim().toUpperCase())
                        );
                        allRooms = allRooms.filter(r => deptRoomNames.has(String(r).trim().toUpperCase()));
                    } catch (_) {
                        // If the dept room lookup fails, fail safe to an empty list
                        // rather than showing rooms outside the dept-admin's scope.
                        allRooms = [];
                    }
                }

                if (!cancelled) {
                    setRooms(allRooms);
                }
            } catch (_) {
                if (!cancelled) {
                    setRooms([]);
                }
            } finally {
                if (!cancelled) setRoomsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [fixedDepartment]);

    useEffect(() => {
        if (!room) {
            setAvailableDates([]);
            setAvailablePeriods([]);
            setAvailableFolders([]);
            setDate('');
            setPeriod('');
            setGalleryData(null);
            return;
        }

        let cancelled = false;
        setAvailabilityLoading(true);
        setGalleryData(null);

        (async () => {
            try {
                const params = new URLSearchParams({ room });
                const res = await fetch(`${VERIFY_API}/availability?${params.toString()}`);
                const data = await res.json();

                if (cancelled) return;

                const nextDates = Array.isArray(data.dates) ? data.dates : [];
                const nextPeriods = Array.isArray(data.periods) ? data.periods : [];
                const nextFolders = Array.isArray(data.folders) ? data.folders : [];
                setAvailableDates(nextDates);
                setAvailablePeriods(nextPeriods);
                setAvailableFolders(nextFolders);
                setDate((current) => (nextDates.includes(current) ? current : ''));
                setPeriod((current) => (nextPeriods.includes(current) ? current : ''));
            } catch (_) {
                if (cancelled) return;
                setAvailableDates([]);
                setAvailablePeriods([]);
                setAvailableFolders([]);
                setDate('');
                setPeriod('');
            } finally {
                if (!cancelled) setAvailabilityLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [room]);

    useEffect(() => {
        if (!room || !date || !period) {
            setGalleryData(null);
            return;
        }

        let cancelled = false;
        setFramesLoading(true);

        (async () => {
            try {
                const params = new URLSearchParams({ room, date, period });
                const res = await fetch(`${VERIFY_API}/frames?${params.toString()}`);
                const data = await res.json();
                if (!cancelled) {
                    setGalleryData(data);
                    const annotated = data.annotatedFrames || [];

                    // Auto-open the frame for a deep-linked student, once.
                    if (!autoOpenedRef.current && annotated.length > 0) {
                        const matchIdx = rollFilter
                            ? annotated.findIndex((f) => Array.isArray(f.rolls) && f.rolls.includes(rollFilter))
                            : -1;
                        if (matchIdx >= 0) {
                            autoOpenedRef.current = true;
                            openModal(matchIdx);
                        } else if (Number.isFinite(targetSec)) {
                            // No per-frame roll data (old session) — jump to the
                            // annotated frame nearest the student's firstSeenSec.
                            let bestIdx = -1;
                            let bestDelta = Infinity;
                            annotated.forEach((f, i) => {
                                if (f.elapsedSec == null) return;
                                const delta = Math.abs(f.elapsedSec - targetSec);
                                if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
                            });
                            if (bestIdx >= 0) {
                                autoOpenedRef.current = true;
                                openModal(bestIdx);
                            }
                        }
                    }
                }
            } catch (_) {
                if (!cancelled) {
                    setGalleryData({
                        found: false,
                        folder: '',
                        annotatedFrames: [],
                    });
                }
            } finally {
                if (!cancelled) setFramesLoading(false);
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, date, period]);

    // A change of room/date/period loads a different folder — allow the
    // deep-link auto-open to fire again for the new gallery.
    useEffect(() => {
        autoOpenedRef.current = false;
    }, [room, date, period]);

    useEffect(() => {
        if (!room || !period) {
            setLiveClassInfo(null);
            return;
        }

        let cancelled = false;
        setClassInfoLoading(true);

        (async () => {
            try {
                const params = new URLSearchParams({ room, slot: period });
                const res = await fetch(`${CLASS_INFO_API}?${params.toString()}`);
                const data = await res.json();
                if (!cancelled) {
                    setLiveClassInfo({
                        subject: data.subject || '-',
                        faculty: data.faculty || '-',
                        batch: data.batch || '-',
                        degree: data.degree || '-',
                        dept: data.dept || '-',
                    });
                }
            } catch (_) {
                if (!cancelled) {
                    setLiveClassInfo({
                        subject: '-',
                        faculty: '-',
                        batch: '-',
                        degree: '-',
                        dept: '-',
                    });
                }
            } finally {
                if (!cancelled) setClassInfoLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [room, period]);

    // What the class WAS when these frames were captured, straight off the disk
    // (frameVerificationController → _class.json), in preference to what the
    // timetable says now. The live lookup is answered for TODAY — it takes no
    // date at all — so on any past date it describes a different day of the
    // week, and any timetable edit since the capture silently relabels history.
    // Only folders written before contexts were stored fall back to it, and
    // those are marked so nobody mistakes a guess for a record.
    const classInfo = galleryData?.classInfo || liveClassInfo;
    const classInfoIsStored = !!galleryData?.classInfo;
    const classInfoStale = !!galleryData?.found && !classInfoIsStored;

    const visiblePeriods = date
        ? [...new Set(
            availableFolders
                .filter((item) => item.date === date)
                .map((item) => item.period)
        )].sort((a, b) => {
            const aNum = Number(String(a || '').replace(/^\D+/i, '')) || 0;
            const bNum = Number(String(b || '').replace(/^\D+/i, '')) || 0;
            return aNum - bNum;
        })
        : availablePeriods;

    useEffect(() => {
        if (!period) return;
        if (!visiblePeriods.includes(period)) {
            setPeriod('');
        }
    }, [period, visiblePeriods]);

    useEffect(() => {
        if (!modalState.open) return undefined;

        const shiftIndex = (direction) => {
            setModalState((current) => {
                const list = galleryData?.annotatedFrames || [];
                if (list.length === 0) return current;

                const nextIndex = (current.index + direction + list.length) % list.length;
                return { ...current, index: nextIndex };
            });
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                    return;
                }
                setModalState((current) => ({ ...current, open: false }));
                return;
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                shiftIndex(1);
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                shiftIndex(-1);
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [modalState.open, modalState.index, galleryData]);

    useEffect(() => {
        const onFullscreenChange = () => {
            setFullscreenActive(Boolean(document.fullscreenElement));
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const annotatedFrames = galleryData?.annotatedFrames || [];
    const modalFrame = annotatedFrames[modalState.index] || null;

    // `identityLabels === false` means the ML service deliberately drew this
    // frame without roll numbers: the run had no gallery of its own, so the only
    // embeddings available were an institute-wide sweep of every enrolled
    // student. Matching against that finds names, but by a different search from
    // the one the attendance report is built on — which is how rooms that are
    // not running attendance ended up with confidently annotated frames. The
    // page says the identities are unavailable rather than showing them.
    // Undefined/null on frames captured before the flag existed; those keep the
    // old behaviour, since nothing can say after the fact how they were drawn.
    const identitiesShown = !modalFrame || modalFrame.identityLabels !== false;
    // Whole-selection version, for the notice above the gallery.
    const unlabelledFrames = annotatedFrames.filter((f) => f.identityLabels === false);

    // Frames containing the deep-linked student (empty if no per-frame roll
    // data). When there are matches, the annotated gallery shows only those;
    // the modal still indexes the FULL annotated list so prev/next don't drift.
    const rollMatches = rollFilter
        ? annotatedFrames.filter((f) => Array.isArray(f.rolls) && f.rolls.includes(rollFilter))
        : [];
    const displayedAnnotated = rollFilter && rollMatches.length > 0 ? rollMatches : annotatedFrames;

    function toImageUrl(relativeUrl) {
        return relativeUrl ? `${apiUrl}${relativeUrl}` : '';
    }

    function openModal(index) {
        setModalState({ open: true, index });
    }

    function moveModal(direction) {
        setModalState((current) => {
            const list = galleryData?.annotatedFrames || [];
            if (list.length === 0) return current;

            const nextIndex = (current.index + direction + list.length) % list.length;
            return { ...current, index: nextIndex };
        });
    }

    // Wall-clock capture time for a frame — the sidecar records it at snap
    // time; older folders fall back to the file's mtime server-side.
    function formatCapturedAt(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString([], {
            year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }

            if (modalRef.current?.requestFullscreen) {
                await modalRef.current.requestFullscreen();
            }
        } catch (_) {
            // Ignore browser fullscreen errors and keep the modal usable.
        }
    }

    async function downloadImage() {
        if (!modalFrame) return;

        setDownloadError(null);

        try {
            const imageUrl = toImageUrl(modalFrame.url);
            const response = await fetch(imageUrl);

            if (!response.ok) {
                throw new Error(`Failed to download: ${response.statusText}`);
            }

            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = modalFrame.filename || 'frame.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoking synchronously after click() tears the blob down before
            // the browser has started reading it, and the save silently never
            // happens. Defer past the current task so the download commits.
            setTimeout(() => window.URL.revokeObjectURL(url), 60000);
        } catch (error) {
            console.error('[Frame Download] Error:', error);
            setDownloadError(error.message || 'Failed to download image');

            setTimeout(() => setDownloadError(null), 5000);
        }
    }

    const selectionReady = room && date && period;

    return (
        <>
            <style>{PAGE_CSS}</style>
            <div style={styles.page}>
                <div style={{ maxWidth: 1440, margin: '0 auto' }}>
                    <div style={{ marginBottom: 24 }}>
                        <div style={styles.heading}>Frame Verification</div>
                        <div style={styles.subheading}>
                            Review saved classroom screenshots by room, date, and period. Switch between raw frames and annotated frames, then inspect them in fullscreen.
                        </div>
                    </div>

                    <div style={{ ...styles.card, marginBottom: 20 }}>
                        <div className="frame-filter-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 16,
                            alignItems: 'end',
                        }}>
                            <div>
                                <label style={styles.label}>Room</label>
                                <select value={room} onChange={(e) => setRoom(e.target.value)} style={styles.select} disabled={roomsLoading}>
                                    <option value="">
                                        {roomsLoading ? 'Loading rooms with cameras...' : 'Select room'}
                                    </option>
                                    {rooms.map((roomName) => (
                                        <option key={roomName} value={roomName}>{roomName}</option>
                                    ))}
                                </select>
                                {!roomsLoading && rooms.length === 0 && (
                                    <div style={{ marginTop: 6, fontSize: '11px', color: theme.danger }}>
                                        No cameras registered for any room. Add a camera in the Camera Registry first.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label style={styles.label}>Date</label>
                                <select
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    style={styles.select}
                                    disabled={!room || availabilityLoading}
                                >
                                    <option value="">
                                        {!room ? 'Select room first' : availabilityLoading ? 'Loading dates...' : 'Select date'}
                                    </option>
                                    {availableDates.map((item) => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={styles.label}>Period</label>
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    style={styles.select}
                                    disabled={!room || availabilityLoading}
                                >
                                    <option value="">
                                        {!room ? 'Select room first' : availabilityLoading ? 'Loading periods...' : 'Select period'}
                                    </option>
                                    {visiblePeriods.map((item) => (
                                        <option key={item} value={item}>{slotLabel(item)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectionReady && (
                            <div style={{
                                marginTop: 18,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 10,
                                alignItems: 'center',
                            }}>
                                <StatBadge label="Subject" value={classInfo?.subject || (classInfoLoading ? '...' : '-')} tone="success" />
                                <StatBadge label="Faculty" value={classInfo?.faculty || (classInfoLoading ? '...' : '-')} tone="warning" />
                                <StatBadge label="Batch" value={classInfo?.batch || (classInfoLoading ? '...' : '-')} tone="danger" />
                                {classInfo?.sem && <StatBadge label="Sem" value={classInfo.sem} />}
                                {classInfo?.dept && <StatBadge label="Dept" value={classInfo.dept} />}
                                {/* A substitution or extra class recorded at capture time. Worth
                                    showing outright: it is exactly the case where the timetable
                                    read today would disagree with what actually happened. */}
                                {classInfoIsStored && classInfo?.altered && (
                                    <StatBadge
                                        label="Altered"
                                        value={`was ${classInfo.originalSubject || '?'}${
                                            classInfo.originalFaculty ? ` / ${classInfo.originalFaculty}` : ''}`}
                                        tone="warning"
                                    />
                                )}
                                {classInfoIsStored ? (
                                    <StatBadge label="Source" value="recorded at capture" tone="success" />
                                ) : classInfoStale ? (
                                    <StatBadge label="Source" value="live timetable — not recorded for these frames" tone="danger" />
                                ) : null}
                            </div>
                        )}
                    </div>

                    {!room ? (
                        <EmptyState
                            title="Select a room to begin"
                            subtitle="The page loads room options from the timetable module, then shows only dates and periods that actually exist in the saved frame folders."
                        />
                    ) : null}

                    {room && !availabilityLoading && availableDates.length === 0 && availablePeriods.length === 0 ? (
                        <EmptyState
                            title="No frames available"
                            subtitle="No saved classroom screenshots are available for this room. Frames will appear once attendance sessions are recorded and processed."
                        />
                    ) : null}

                    {room && !selectionReady && (availableDates.length > 0 || availablePeriods.length > 0) ? (
                        <EmptyState
                            title="Select date and period"
                            subtitle="Choose a saved date and period to load the verification gallery."
                        />
                    ) : null}

                    {selectionReady ? (
                        <div style={{ display: 'grid', gap: 20 }}>
                            <div style={{ ...styles.card, padding: 18 }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                }}>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 6 }}>
                                            {room} · {slotLabel(period)} · {date}
                                        </div>
                                        <div style={{ fontSize: 13, color: theme.textMuted }}>
                                            {framesLoading ? 'Loading frames...' : 'Open any screenshot to see its capture time, run, detected roll numbers and unidentified faces.'}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                        <span className="frame-chip active" style={{ cursor: 'default' }}>
                                            Annotated Screenshots ({annotatedFrames.length})
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {framesLoading ? (
                                <EmptyState
                                    title="Loading verification gallery"
                                    subtitle="Reading the saved images from the existing attendance frame folders."
                                />
                            ) : null}

                            {!framesLoading && annotatedFrames.length === 0 ? (
                                <EmptyState
                                    title="No annotated screenshots for this selection"
                                    subtitle="Choose another saved date and period. Screenshots appear once an attendance run has been processed for this room and period."
                                />
                            ) : null}

                            {!framesLoading && annotatedFrames.length > 0 ? (
                                <>
                                    {/* Said once at the top rather than only per
                                        frame: a whole period drawn without roll
                                        numbers is a fact about the class's
                                        enrolment, not about the frames. */}
                                    {unlabelledFrames.length > 0 ? (
                                        <div style={{
                                            padding: '10px 14px', marginBottom: 16, borderRadius: 8,
                                            background: theme.surfaceAlt, border: `1px solid ${theme.border}`,
                                            fontSize: 13, lineHeight: 1.6, color: theme.textMuted,
                                        }}>
                                            <strong style={{ color: theme.text }}>
                                                {unlabelledFrames.length === annotatedFrames.length
                                                    ? 'Identities are not shown for these screenshots.'
                                                    : `Identities are not shown for ${unlabelledFrames.length} of ${annotatedFrames.length} screenshots.`}
                                            </strong>
                                            {' '}This class has no enrolled embeddings of its own, so the run had
                                            nothing class-specific to match the detected faces against. Faces are
                                            boxed but left unlabelled; roll numbers appear once the class&apos;s
                                            embeddings are available.
                                        </div>
                                    ) : null}
                                    {rollFilter ? (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                            padding: '10px 14px', marginBottom: 16, borderRadius: 8,
                                            background: theme.accentDim, border: `1px solid ${theme.border}`,
                                        }}>
                                            <span style={{ fontSize: 13, color: theme.text }}>
                                                {rollMatches.length > 0
                                                    ? `Showing ${rollMatches.length} of ${annotatedFrames.length} annotated frame${annotatedFrames.length === 1 ? '' : 's'} containing `
                                                    : `No per-frame roll data for `}
                                                <span style={{ fontFamily: theme.fontMono, fontWeight: 700 }}>{rollFilter}</span>
                                                {rollMatches.length === 0 ? ' — showing all frames' : ''}
                                                {rollMatches.length === 0 && Number.isFinite(targetSec) ? ' (jumped to nearest frame by time)' : ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setRollFilter('')}
                                                style={{ ...styles.btnGhost, padding: '4px 10px', fontSize: 12 }}
                                            >
                                                Show all frames
                                            </button>
                                        </div>
                                    ) : null}
                                    <div className="frame-gallery">
                                        {displayedAnnotated.map((frame) => {
                                            const index = annotatedFrames.indexOf(frame);
                                            return (
                                        <button
                                            key={`${frame.filename}-${index}`}
                                            type="button"
                                            className="frame-thumb"
                                            onClick={() => openModal(index)}
                                            style={{
                                                ...styles.card,
                                                padding: 12,
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                transition: 'transform .15s ease, box-shadow .15s ease',
                                            }}
                                        >
                                            <img
                                                src={toImageUrl(frame.url)}
                                                alt={frame.filename}
                                                style={{
                                                    width: '100%',
                                                    height: 180,
                                                    objectFit: 'cover',
                                                    borderRadius: 10,
                                                    border: `1px solid ${theme.border}`,
                                                    marginBottom: 12,
                                                    background: theme.surfaceAlt,
                                                }}
                                            />
                                            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>
                                                {frame.filename}
                                            </div>
                                            <FrameStats frame={frame} />
                                            {frame.identityLabels === false ? (
                                                <div style={{
                                                    fontSize: 10, fontWeight: 700, lineHeight: 1.4,
                                                    color: theme.textMuted, marginTop: 8,
                                                }}>
                                                    Identities not shown — no embeddings for this class
                                                </div>
                                            ) : Array.isArray(frame.rolls) && frame.rolls.length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                                    {frame.rolls.map((roll) => (
                                                        <span
                                                            key={roll}
                                                            style={{
                                                                fontFamily: theme.fontMono, fontSize: 10, fontWeight: 700,
                                                                padding: '1px 6px', borderRadius: 4,
                                                                color: roll === rollFilter ? theme.accent : theme.textMuted,
                                                                background: roll === rollFilter ? theme.accentDim : theme.surfaceAlt,
                                                            }}
                                                        >
                                                            {roll}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {modalState.open && modalFrame ? (
                    <div
                        onClick={() => setModalState((current) => ({ ...current, open: false }))}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(7, 10, 22, 0.88)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 24,
                        }}
                    >
                        <div
                            ref={modalRef}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                                width: 'min(1400px, 100%)',
                                maxHeight: '100%',
                                background: '#0c1228',
                                border: '1px solid rgba(228,232,245,0.14)',
                                borderRadius: 18,
                                overflow: 'hidden',
                                boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
                                color: '#ffffff',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                padding: '16px 18px',
                                borderBottom: '1px solid rgba(228,232,245,0.12)',
                                background: 'rgba(255,255,255,0.03)',
                            }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                                        {modalFrame.filename}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                                        Annotated screenshot · {modalState.index + 1} of {annotatedFrames.length}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <button onClick={() => moveModal(-1)} style={styles.btnGhost} type="button">Previous</button>
                                    <button onClick={() => moveModal(1)} style={styles.btnGhost} type="button">Next</button>
                                    <button onClick={downloadImage} style={styles.btnGhost} type="button" title="Download this image">↓ Download</button>
                                    <button onClick={toggleFullscreen} style={styles.btnPrimary} type="button">
                                        {fullscreenActive ? 'Exit Fullscreen' : 'Fullscreen'}
                                    </button>
                                    <button
                                        onClick={() => setModalState((current) => ({ ...current, open: false }))}
                                        style={styles.btnGhost}
                                        type="button"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            <div className="frame-modal-body" style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) 320px',
                                gap: 0,
                            }}>
                                <div style={{
                                    padding: 18,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#060b18',
                                    minHeight: 420,
                                }}>
                                    <img
                                        src={toImageUrl(modalFrame.url)}
                                        alt={modalFrame.filename}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '72vh',
                                            objectFit: 'contain',
                                            borderRadius: 14,
                                            boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
                                        }}
                                    />
                                </div>

                                <div style={{
                                    padding: 18,
                                    borderLeft: '1px solid rgba(228,232,245,0.12)',
                                    background: 'rgba(255,255,255,0.03)',
                                    maxHeight: '72vh',
                                    overflowY: 'auto',
                                }}>
                                    {/* Per-frame capture facts. Deliberately kept
                                        off the image itself — the screenshot only
                                        carries the boxes and roll labels. */}
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', marginBottom: 12 }}>
                                        Frame Details
                                    </div>

                                    <div style={{ display: 'grid', gap: 8, marginBottom: 20, fontSize: 12 }}>
                                        {[
                                            ['Captured at', formatCapturedAt(modalFrame.capturedAt)],
                                            ['Run', modalFrame.run != null ? `Run ${modalFrame.run}` : '—'],
                                            ['Camera', modalFrame.camera != null ? `Cam ${modalFrame.camera}` : '—'],
                                            ['Into run', modalFrame.elapsedSec != null ? `${modalFrame.elapsedSec}s` : '—'],
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                                <span style={{ color: 'rgba(255,255,255,0.62)' }}>{label}</span>
                                                <span style={{ fontWeight: 700, textAlign: 'right' }}>{value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', marginBottom: 12 }}>
                                        Faces In This Frame
                                    </div>

                                    <div style={{ display: 'grid', gap: 8, marginBottom: 12, fontSize: 12 }}>
                                        {(identitiesShown
                                            ? [
                                                ['Detected', modalFrame.facesCount ?? '—', '#ffffff'],
                                                ['Identified', modalFrame.identified ?? '—', '#86efac'],
                                                ['Not identified', modalFrame.unidentified ?? '—', '#fcd34d'],
                                            ]
                                            // No matching ran against this class, so
                                            // "identified: 0" would read as a result
                                            // rather than as the absence of one.
                                            : [['Detected', modalFrame.facesCount ?? '—', '#ffffff']]
                                        ).map(([label, value, color]) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                                <span style={{ color: 'rgba(255,255,255,0.62)' }}>{label}</span>
                                                <span style={{ fontWeight: 700, color }}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>
                                        {identitiesShown
                                            ? `Not identified counts faces the detector found in this frame that could not be matched to an enrolled roll number — not students absent from the class.`
                                            : `Faces were detected and boxed, but none were matched: this class has no enrolled embeddings, so there was nothing class-specific to match them against.`}
                                    </div>

                                    {/* "Labelled", not "Present". A label means the
                                        face cleared reviewThreshold; the report
                                        needs autoThreshold to mark a student
                                        present, so this count is an upper bound on
                                        the report's and heading it "Present"
                                        invited exactly the comparison that does
                                        not hold. */}
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', marginBottom: 12 }}>
                                        {identitiesShown
                                            ? `Roll Numbers Labelled (${(modalFrame.rolls || []).length})`
                                            : 'Identities Not Shown'}
                                    </div>

                                    <div style={{ marginBottom: 20 }}>
                                        {!identitiesShown ? (
                                            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)' }}>
                                                No roll numbers were drawn on this frame. This class has no
                                                enrolled embeddings of its own
                                                {modalFrame.enrollmentSource === 'institute'
                                                    ? ', so the run fell back to matching against every student in the institute'
                                                    : ''}
                                                {' — '}
                                                a different search from the one the attendance report is
                                                built on. Labels are drawn only once this class&apos;s
                                                embeddings are available.
                                            </div>
                                        ) : (modalFrame.rolls || []).length > 0 ? (
                                            <>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                                    {modalFrame.rolls.map((roll) => {
                                                        // Same three states as the drawn boxes, same
                                                        // colours. Frames captured before the split
                                                        // have no reviewRolls and stay neutral rather
                                                        // than claiming a state they never recorded.
                                                        const mark = (modalFrame.faceMarks || []).find((m) => m.roll === roll);
                                                        const isReview = modalFrame.reviewRolls
                                                            ? modalFrame.reviewRolls.includes(roll)
                                                            : false;
                                                        const known = !!modalFrame.reviewRolls;
                                                        const bg = roll === rollFilter ? '#86efac'
                                                            : !known ? 'rgba(255,255,255,0.1)'
                                                            : isReview ? 'rgba(250,204,21,0.22)'
                                                            : 'rgba(34,197,94,0.22)';
                                                        const fg = roll === rollFilter ? '#0c1228'
                                                            : !known ? '#ffffff'
                                                            : isReview ? '#fde68a' : '#86efac';
                                                        return (
                                                            <span
                                                                key={roll}
                                                                title={mark?.score != null
                                                                    ? `score ${mark.score.toFixed(2)} — ${mark.state}`
                                                                    : undefined}
                                                                style={{
                                                                    fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700,
                                                                    padding: '3px 7px', borderRadius: 4,
                                                                    color: fg, background: bg,
                                                                }}
                                                            >
                                                                {roll}{isReview && mark?.score != null ? ` ${mark.score.toFixed(2)}` : ''}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                                {modalFrame.reviewRolls && (
                                                    <div style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
                                                        {(modalFrame.presentRolls || []).length} cleared the present
                                                        threshold ({modalFrame.autoThreshold?.toFixed(2) ?? '?'}),
                                                        {' '}{modalFrame.reviewRolls.length} matched only in the review band
                                                        ({modalFrame.reviewThreshold?.toFixed(2) ?? '?'}–{modalFrame.autoThreshold?.toFixed(2) ?? '?'}).
                                                        The report decides on the whole run&apos;s clusters, not on
                                                        this one frame, so its counts can still differ from both.
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                                No roll numbers were matched in this frame.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', marginBottom: 12 }}>
                                        Class Details
                                    </div>

                                    {/* This frame's OWN recorded context, not the
                                        folder's: the checks of one period are
                                        resolved separately, so an extra class or
                                        a substitution can make one run a
                                        different class from the next. Falls back
                                        to the header's answer only when the frame
                                        predates stored contexts. */}
                                    <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                                        <StatBadge label="Subject" value={(modalFrame.classContext || classInfo)?.subject || '-'} tone="success" />
                                        <StatBadge label="Faculty" value={(modalFrame.classContext || classInfo)?.faculty || '-'} tone="warning" />
                                        <StatBadge label="Batch" value={(modalFrame.classContext || classInfo)?.batch || '-'} tone="danger" />
                                        {(modalFrame.classContext || classInfo)?.sem && (
                                            <StatBadge label="Sem" value={(modalFrame.classContext || classInfo).sem} />
                                        )}
                                        {(modalFrame.classContext || classInfo)?.dept && (
                                            <StatBadge label="Dept" value={(modalFrame.classContext || classInfo).dept} />
                                        )}
                                        {modalFrame.classContext?.altered && (
                                            <StatBadge
                                                label="Altered"
                                                value={`was ${modalFrame.classContext.originalSubject || '?'}${
                                                    modalFrame.classContext.originalFaculty
                                                        ? ` / ${modalFrame.classContext.originalFaculty}` : ''}`}
                                                tone="warning"
                                            />
                                        )}
                                        <StatBadge
                                            label="Source"
                                            value={modalFrame.classContext
                                                ? 'recorded at capture'
                                                : 'live timetable — not recorded for this frame'}
                                            tone={modalFrame.classContext ? 'success' : 'danger'}
                                        />
                                    </div>

                                    {/* Which run of this period the open frame
                                        belongs to, and when it was captured —
                                        the folder is shared by every run. */}
                                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.62)', marginBottom: 12 }}>
                                        Capture
                                    </div>
                                    <div style={{ display: 'grid', gap: 10 }}>
                                        <StatBadge
                                            label={modalFrame.checkIndex ? `Run ${modalFrame.checkIndex}` : 'Run'}
                                            value={modalFrame.runTime || 'not recorded'}
                                        />
                                        <StatBadge
                                            label="Captured"
                                            value={(modalFrame.capturedAt || '').replace('T', ' ') || 'not recorded'}
                                        />
                                        <StatBadge label="Cam" value={modalFrame.camera ?? '-'} tone="success" />
                                        <StatBadge label="Sec into run" value={modalFrame.elapsedSec ?? '-'} tone="warning" />
                                    </div>

                                    {downloadError && (
                                        <div style={{
                                            padding: 12,
                                            borderRadius: 8,
                                            background: 'rgba(239,68,68,0.15)',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            marginTop: 12,
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>Download Error</div>
                                            <div style={{ fontSize: 12, color: '#fecaca', lineHeight: 1.4 }}>{downloadError}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );
}
