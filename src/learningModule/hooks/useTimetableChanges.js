import { useCallback, useEffect, useMemo, useState } from 'react';
import lmApi from '../api/lmApi';

/**
 * The timetable changes a student has not dealt with yet.
 *
 * A published timetable that moves produces one notification per affected
 * student, of type `timetable`, carrying the change-set itself in `payload`
 * (see the server's studentTimetableNotifier). Two surfaces read them, and
 * they clear at different moments on purpose:
 *
 *   - the **modal** that greets a student shows each change once. Dismissing
 *     it records the ids locally and leaves the notifications unread, so the
 *     bell still holds them and the card below still marks the class. A modal
 *     that marked them read would be the only place the change was ever shown,
 *     and a student who blinked past it would never see it again;
 *   - the **class card** carries a mark while the notification is unread, and
 *     clears it when that class is opened — which is the student saying "I
 *     have seen this", in the one gesture that proves it.
 *
 * The local record is per browser. That is the right scope for "I have already
 * been shown this dialog", and the wrong one for "I know about this change",
 * which is why only the first is kept here and the second lives on the server.
 */

const SEEN_KEY = 'lm.timetableChanges.seen';

const readSeen = () => {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A private window, or storage the browser refuses. The modal then shows
    // a change it has shown before, which is better than not showing one.
    return [];
  }
};

const writeSeen = (ids) => {
  try {
    // Bounded: a student who stays enrolled for four years should not carry
    // four years of ids around.
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* nothing to do — see readSeen */
  }
};

export default function useTimetableChanges() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seen, setSeen] = useState(readSeen);

  const load = useCallback(async () => {
    try {
      // Unread only: a change the student has already acknowledged in the bell
      // is not news, and the card must agree with the bell about that.
      const data = await lmApi.notifications({ limit: 50, unread: 'true' });
      const all = Array.isArray(data?.items) ? data.items : [];
      setItems(all.filter((item) => item?.type === 'timetable'));
    } catch {
      // The rest of the module works without this; a failed fetch shows no
      // mark rather than an error the student can do nothing about.
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // The bell dispatches this after it marks anything read, so acknowledging
    // a change there clears the card here without a reload.
    const onUpdated = () => load();
    window.addEventListener('lmNotificationsUpdated', onUpdated);
    return () => window.removeEventListener('lmNotificationsUpdated', onUpdated);
  }, [load]);

  /** Class ids the student has an unread timetable change for. */
  const changedClassIds = useMemo(
    () => new Set(items.map((item) => String(item.classId || '')).filter(Boolean)),
    [items],
  );

  /** What the greeting modal should show: unread, and not yet shown here. */
  const unseen = useMemo(
    () => items.filter((item) => !seen.includes(String(item._id))),
    [items, seen],
  );

  /** The modal was read and closed. Remembered locally, left unread. */
  const dismiss = useCallback(() => {
    const next = [...new Set([...seen, ...items.map((item) => String(item._id))])];
    setSeen(next);
    writeSeen(next);
  }, [items, seen]);

  /**
   * The student opened the class, which is the acknowledgement the card was
   * waiting for. Marks that class's timetable notifications read on the
   * server, so the mark is gone on their phone too.
   */
  const acknowledgeClass = useCallback(
    async (classId) => {
      const ids = items
        .filter((item) => String(item.classId || '') === String(classId))
        .map((item) => String(item._id));
      if (!ids.length) return;
      setItems((current) => current.filter((item) => !ids.includes(String(item._id))));
      await lmApi.markNotificationsRead(ids, { silent: true }).catch(() => {});
    },
    [items],
  );

  return { items, unseen, changedClassIds, loading, dismiss, acknowledgeClass, reload: load };
}
