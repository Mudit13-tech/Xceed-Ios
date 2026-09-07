// client/src/attendancemodule/LiveRoomCards.jsx
//
// One card per room running a class right now — what the scheduler is doing,
// how many checks it has saved, and the latest present/absent split.
//
// The data comes from /scheduler/live-status, which scopes its room list to
// the caller: a full-access admin sees the whole campus, a department admin
// sees only the rooms whose CURRENT class belongs to their department. Rooms
// are shared between departments across the day, so that filter is on the
// class in the room this period, not on the room itself — which is why this
// component never filters by department on its own. Whatever the API returns
// is already the caller's scope.

import { useCallback, useEffect, useRef, useState } from 'react';
import getEnvironment from '../getenvironment';
import { styles, theme } from './config';
import usePeriods from './usePeriods';

const LIVE_STATUS_API = `${getEnvironment()}/attendancemodule/scheduler/live-status`;

const REFRESH_MS = 15000;

function RoomCard({ room }) {
    const isSkipped = room.status === 'skipped';
    const hasCtx = !!room.ctx;
    const isComplete = hasCtx && room.runsCompleted >= room.targetRuns;
    const isDone = room.status === 'finalized' || isComplete;
    const color = isSkipped ? theme.textMuted : isDone ? theme.success : theme.accent;
    const pct = room.lastRecord ? room.lastRecord.attendancePct : 0;
    const target = room.targetRuns || 1;

    return (
        <div
            style={{
                border: `1px solid ${color}28`,
                borderTop: `2px solid ${color}`,
                borderRadius: 10,
                padding: '12px 14px',
                background: theme.surface,
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{room.room}</div>
                <span
                    style={{
                        fontSize: 9, padding: '2px 6px', borderRadius: 99, fontWeight: 700,
                        background: `${color}18`, color, textTransform: 'uppercase', flexShrink: 0,
                    }}
                >
                    {isSkipped ? 'Skip' : isDone ? 'Done' : 'Live'}
                </span>
            </div>

            {isSkipped ? (
                <div style={{ fontSize: 11, color: theme.danger }}>{room.reason || 'No class scheduled'}</div>
            ) : hasCtx ? (
                <>
                    <div
                        title={room.ctx.subject}
                        style={{
                            fontSize: 11, color: theme.textMuted, marginBottom: 6,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                    >
                        {room.ctx.subject}
                    </div>
                    {room.lastRecord && (
                        <div style={{ fontSize: 11, display: 'flex', gap: 8, marginBottom: 6 }}>
                            <span style={{ color: theme.success }}>P: {room.lastRecord.present}</span>
                            <span style={{ color: theme.danger }}>A: {room.lastRecord.absent}</span>
                            <span style={{ fontWeight: 700, color: theme.text }}>{pct}%</span>
                        </div>
                    )}
                    <div style={{ height: 3, background: theme.border, borderRadius: 2, overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${Math.min(100, (room.runsCompleted / target) * 100)}%`,
                                height: '100%', background: color, transition: 'width .3s',
                            }}
                        />
                    </div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 5, fontFamily: theme.fontMono }}>
                        {room.runsCompleted}/{target} checks
                    </div>
                </>
            ) : (
                <div style={{ fontSize: 11, color: theme.textMuted }}>Initializing…</div>
            )}
        </div>
    );
}

export default function LiveRoomCards({ title = 'Live classrooms', department = '' }) {
    const { slotLabel } = usePeriods();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    // Polls every 15s for as long as the page is open, so a response that
    // arrives after unmount must not set state on a dead component.
    const alive = useRef(true);

    const load = useCallback(async () => {
        try {
            // `department` only narrows the campus-wide view a full-access admin
            // otherwise gets — a real dept admin is already scoped server-side
            // and this is ignored for them. See schedulerController.liveStatus.
            const query = department ? `?department=${encodeURIComponent(department)}` : '';
            const response = await fetch(`${LIVE_STATUS_API}${query}`, { credentials: 'include' });
            const body = await response.json();
            if (!alive.current) return;
            if (!response.ok) throw new Error(body.error || 'Could not load live status.');
            setData(body);
            setError('');
            setLastUpdated(new Date());
        } catch (err) {
            // Keep the last good snapshot on screen rather than blanking the
            // panel — a single failed poll should not erase a live view.
            if (alive.current) setError(err.message);
        } finally {
            if (alive.current) setLoading(false);
        }
    }, [department]);

    useEffect(() => {
        alive.current = true;
        load();
        const id = setInterval(load, REFRESH_MS);
        return () => {
            alive.current = false;
            clearInterval(id);
        };
    }, [load]);

    const rooms = data?.rooms || [];
    const scoped = data?.scopedToDepartments;

    let body;
    if (loading && !data) {
        body = <div style={{ padding: 18, fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>Loading live status…</div>;
    } else if (!data?.slot) {
        body = <div style={{ padding: 18, fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>No lecture period is running right now.</div>;
    } else if (rooms.length === 0) {
        // An empty list means two very different things, and saying "no rooms"
        // for both would read as a fault when it is simply somebody else's
        // period.
        body = (
            <div style={{ padding: 18, fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>
                {scoped && scoped.length
                    ? `No ${scoped.join(', ')} classes are scheduled this period.`
                    : 'No classrooms are running this period.'}
            </div>
        );
    } else {
        body = (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {rooms.map((room) => <RoomCard key={room.room} room={room} />)}
            </div>
        );
    }

    return (
        <section style={{ ...styles.card, marginTop: 18 }}>
            <div
                style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 8, marginBottom: 14,
                }}
            >
                <div style={{ ...styles.heading, fontSize: 17 }}>{title}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 10 }}>
                    {data?.slot && <span>{slotLabel(data.slot)}</span>}
                    {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
                    <button
                        type="button"
                        onClick={load}
                        title="Refresh now"
                        style={{
                            fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                            background: theme.accentDim, color: theme.accent,
                            border: `1px solid ${theme.accent}30`, fontWeight: 700,
                        }}
                    >
                        ↻
                    </button>
                </div>
            </div>

            {data && data.acquisitionActive === false && (
                <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 12, color: theme.danger, background: theme.dangerDim }}>
                    ⚠ Global acquisition is OFF — no new attendance runs will execute.
                </div>
            )}
            {data && data.isWorkingDay === false && (
                <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 12, color: theme.warning, background: theme.warningDim }}>
                    {data.workingDayReason || 'Non-working day'} — the scheduler will not run today.
                </div>
            )}
            {error && (
                <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 12, color: theme.warning, background: theme.warningDim }}>
                    {error}{data ? ' — showing the last update.' : ''}
                </div>
            )}

            {body}
        </section>
    );
}
