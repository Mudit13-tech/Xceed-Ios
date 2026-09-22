import { useCallback, useEffect, useMemo, useState } from 'react';
import getEnvironment from '../getenvironment';

/**
 * Which timetable slots a room records, every week.
 *
 * The same control as the room slot grid in acquisition settings
 * (SchedulerPage's RoomSlotGrid) and deliberately the same shape: pick a room,
 * see its week, click a class to switch it. Somebody who has used one should
 * not have to work the other out.
 *
 * One difference is load-bearing and the copy says so on the page. Acquisition
 * stores what is OFF, so a slot runs unless switched off; recording stores what
 * is ON, so nothing records until it is chosen. That is not a stylistic
 * inversion — a recording deny-list would have meant every camera in the
 * institute started writing video the moment this shipped.
 *
 * Distinct from the Scheduler tab beside it, which books a single named date.
 * This is the weekly standing order.
 */

const apiUrl = getEnvironment();
const API = `${apiUrl}/attendancemodule/cameras/recording`;

// Audio first and default: these recordings exist to become study notes, and
// the AI Studio's path to them — Whisper, then a model on the transcript —
// never looks at a frame. Video is offered for the rooms where the picture is
// the point (a demonstration lab, a room where the board matters), at roughly
// twenty times the disk per lecture.
const FORMATS = [
  { id: 'audio', label: 'Audio only — for lecture notes (~58 MB/hour)' },
  { id: 'video+audio', label: 'Video + Audio (~1 GB/hour)' },
  { id: 'video', label: 'Video only (~1 GB/hour)' },
];

const titleCase = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

export default function SlotRecordingGrid({ theme: T, showToast }) {
  const [rooms, setRooms] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [room, setRoom] = useState('');
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API}/rooms`, { credentials: 'include' });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRooms(json.rooms || []);
      setScheduleEnabled(json.enabled !== false);
      setError('');
    } catch (e) {
      setRooms([]);
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const loadGrid = useCallback(async (which) => {
    if (!which) { setGrid(null); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/rooms/${encodeURIComponent(which)}/timetable`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setGrid(json);
      setError('');
    } catch (e) {
      setGrid(null);
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadGrid(room); }, [room, loadGrid]);

  /**
   * Save one or more edits, then re-read.
   *
   * Re-reading rather than patching local state: the grid also reports the
   * room-level and schedule-level switches, which are not ours to guess at —
   * a slot ticked on inside a paused room has to come back reading "paused",
   * not "on".
   */
  const save = useCallback(async (body) => {
    if (!room) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/rooms/${encodeURIComponent(room)}/slots`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await loadGrid(room);
      await loadRooms();
    } catch (e) {
      showToast?.(`Could not save: ${e.message}`, 'error');
    }
    setBusy(false);
  }, [room, loadGrid, loadRooms, showToast]);

  const slotAt = useCallback(
    (day, periodKey) =>
      (grid?.slots || []).find((s) => s.day === day && s.periodKey === periodKey) || null,
    [grid],
  );

  const onCount = useMemo(
    () => (grid?.slots || []).filter((s) => s.slotEnabled).length,
    [grid],
  );

  const styles = {
    card: {
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: 20, marginBottom: 20,
    },
    label: {
      display: 'block', fontSize: 12, fontWeight: 700,
      color: T.textMuted, marginBottom: 6,
    },
    select: {
      width: '100%', padding: '9px 11px', fontSize: 13, borderRadius: 7,
      border: `1px solid ${T.border}`, background: T.bg, color: T.text,
    },
    hint: { fontSize: 12, color: T.textMuted, lineHeight: 1.6 },
  };

  const cellStyle = (slot) => {
    if (!slot) {
      return {
        background: 'transparent',
        border: `1px dashed ${T.border}`,
        color: T.textMuted,
        cursor: 'default',
      };
    }
    if (slot.recording) {
      return {
        background: T.accentDim || 'rgba(59,130,246,.12)',
        border: `1px solid ${T.accent}`,
        color: T.text,
        cursor: 'pointer',
      };
    }
    if (slot.slotEnabled) {
      // Chosen, but something above it is off — the room, or the whole
      // schedule. Shown differently from both on and off so the toggle does
      // not read as having failed to save.
      return {
        background: 'transparent',
        border: `1px dashed ${T.accent}`,
        color: T.textMuted,
        cursor: 'pointer',
      };
    }
    return {
      background: T.bg,
      border: `1px solid ${T.border}`,
      color: T.textMuted,
      cursor: 'pointer',
    };
  };

  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={styles.label} htmlFor="slotrec-room">Room</label>
            {rooms === null ? (
              <div style={styles.hint}>Loading rooms…</div>
            ) : (
              <select
                id="slotrec-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                style={styles.select}
              >
                <option value="">Select a room…</option>
                {rooms.map((r) => (
                  <option key={r.room} value={r.room}>
                    {r.room}
                    {r.enabledSlots ? ` — ${r.enabledSlots} slot${r.enabledSlots === 1 ? '' : 's'} on` : ''}
                    {r.enabled === false ? ' (paused)' : ''}
                  </option>
                ))}
              </select>
            )}
            {rooms !== null && rooms.length === 0 ? (
              <div style={{ ...styles.hint, marginTop: 6, color: T.danger }}>
                No room has a camera registered, so there is nothing to record.
              </div>
            ) : null}
          </div>

          {grid ? (
            <div>
              <label style={styles.label} htmlFor="slotrec-format">Recording format</label>
              <select
                id="slotrec-format"
                value={grid.format}
                disabled={busy}
                onChange={(e) => save({ format: e.target.value })}
                style={styles.select}
              >
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
              <div style={{ ...styles.hint, marginTop: 6 }}>
                Applies to every slot in {grid.room}. Audio is what the learning
                module needs to generate notes; video only pays for itself in a
                room where the picture is the point.
              </div>
            </div>
          ) : null}
        </div>

        {grid ? (
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              marginTop: 18, cursor: busy ? 'default' : 'pointer', userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={grid.roomEnabled}
              disabled={busy}
              onChange={(e) => save({ roomEnabled: e.target.checked })}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
              Record {grid.room} this week
            </span>
            <span style={styles.hint}>
              Off pauses every slot below without losing which ones you picked.
            </span>
          </label>
        ) : null}
      </div>

      {!scheduleEnabled ? (
        <div
          style={{
            ...styles.card,
            borderColor: T.warning || '#b45309',
            background: 'transparent',
            fontSize: 13,
            color: T.text,
          }}
        >
          Recurring recording is switched off for the whole institute, so nothing
          below will run. Everything you set here is kept and takes effect when
          it is switched back on.
        </div>
      ) : null}

      {error ? (
        <div style={{ ...styles.card, borderColor: T.danger, color: T.danger, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {!room ? (
        <div style={{ ...styles.card, ...styles.hint }}>
          Pick a room to see its week. Nothing records until you switch a slot on
          — unlike attendance, which runs everywhere unless you switch it off.
        </div>
      ) : null}

      {loading ? (
        <div style={{ ...styles.card, ...styles.hint }}>Loading the timetable for {room}…</div>
      ) : null}

      {grid && !loading ? (
        (grid.slots || []).length === 0 ? (
          <div style={{ ...styles.card, ...styles.hint }}>
            No class in the {grid.session} timetable books {room}, so there is
            nothing to record. Use the Scheduler tab to record a one-off session
            in this room.
          </div>
        ) : (
          <div style={styles.card}>
            <div style={{ ...styles.hint, marginBottom: 12 }}>
              Session {grid.session}. Click a class to start or stop recording it
              every week. {onCount} of {grid.slots.length} booked slot
              {grid.slots.length === 1 ? '' : 's'} on. Free slots are not
              recordable — there is no class in them.
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'separate',
                  borderSpacing: 4,
                  minWidth: 120 + (grid.periods || []).length * 150,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: 'left', fontSize: 11, color: T.textMuted,
                        fontWeight: 700, padding: '4px 6px',
                      }}
                    >
                      Day
                    </th>
                    {(grid.periods || []).map((p) => (
                      <th
                        key={p.periodKey}
                        style={{
                          fontSize: 11, color: T.textMuted, fontWeight: 700,
                          padding: '4px 6px', textAlign: 'left', minWidth: 140,
                        }}
                      >
                        {p.label || p.periodKey}
                        {p.startTime ? (
                          <div style={{ fontWeight: 500, opacity: 0.75 }}>
                            {p.startTime}–{p.endTime}
                          </div>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(grid.days || []).map((day) => (
                    <tr key={day}>
                      <td
                        style={{
                          fontSize: 12, fontWeight: 700, color: T.text,
                          padding: '4px 6px', whiteSpace: 'nowrap', verticalAlign: 'top',
                        }}
                      >
                        {titleCase(day)}
                      </td>
                      {(grid.periods || []).map((p) => {
                        const slot = slotAt(day, p.periodKey);
                        return (
                          <td key={p.periodKey} style={{ verticalAlign: 'top' }}>
                            <button
                              type="button"
                              disabled={!slot || busy}
                              aria-pressed={slot ? !!slot.slotEnabled : undefined}
                              title={
                                slot
                                  ? slot.blockedBy === 'room'
                                    ? 'On, but this room is paused'
                                    : slot.blockedBy === 'schedule'
                                      ? 'On, but recurring recording is switched off institute-wide'
                                      : slot.slotEnabled
                                        ? 'Recording every week — click to stop'
                                        : 'Not recording — click to start'
                                  : 'No class booked'
                              }
                              onClick={() =>
                                slot &&
                                save({
                                  day,
                                  periodKey: p.periodKey,
                                  enabled: !slot.slotEnabled,
                                })
                              }
                              style={{
                                ...cellStyle(slot),
                                width: '100%', textAlign: 'left', padding: '7px 9px',
                                borderRadius: 7, fontSize: 12, lineHeight: 1.45,
                                minHeight: 56,
                              }}
                            >
                              {slot ? (
                                <>
                                  <div style={{ fontWeight: 700 }}>
                                    {slot.recording ? '⏺ ' : ''}
                                    {slot.subject || '(no subject)'}
                                  </div>
                                  {slot.faculty ? (
                                    <div style={{ opacity: 0.8 }}>{slot.faculty}</div>
                                  ) : null}
                                  {slot.blockedBy ? (
                                    <div style={{ opacity: 0.8, fontStyle: 'italic' }}>
                                      on, but {slot.blockedBy === 'room' ? 'room paused' : 'schedule off'}
                                    </div>
                                  ) : null}
                                  {slot.ambiguous ? (
                                    <div style={{ opacity: 0.8, fontStyle: 'italic' }}>
                                      also claimed by {slot.alsoClaimedBy.join(', ')}
                                    </div>
                                  ) : null}
                                </>
                              ) : (
                                <span style={{ opacity: 0.6 }}>—</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ ...styles.hint, marginTop: 14 }}>
              A recording starts when the period starts and stops when it ends.
              If an attendance check or a ground-truth capture is using the
              camera, that period is skipped — attendance has priority over a
              video.
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
