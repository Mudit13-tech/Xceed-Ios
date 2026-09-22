/**
 * Which timetable changes a student is shown, and when each surface lets go.
 *
 * The two surfaces clear at different moments on purpose, and both mistakes
 * are silent: a modal that marked its changes read would be the only place a
 * change was ever shown, and a card mark that never cleared would follow a
 * student around for a change they had already dealt with.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../api/lmApi', () => ({
  default: {
    notifications: vi.fn(),
    markNotificationsRead: vi.fn().mockResolvedValue({}),
  },
}));

import lmApi from '../../api/lmApi';
import useTimetableChanges from '../useTimetableChanges';

const change = (id, classId, sem) => ({
  _id: id,
  type: 'timetable',
  classId,
  className: `Class ${classId}`,
  body: `Semester ${sem}: 1 moved.`,
  payload: { sem, updated: [{ subject: 'Data Structures' }] },
});

beforeEach(() => {
  window.localStorage.clear();
  lmApi.notifications.mockResolvedValue({
    items: [
      change('n1', 'c1', '5'),
      change('n2', 'c2', '5'),
      // Everything else in the bell is somebody else's business here.
      { _id: 'n3', type: 'announcement', classId: 'c1' },
    ],
  });
  lmApi.markNotificationsRead.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useTimetableChanges', () => {
  it('keeps only timetable changes, and only unread ones', async () => {
    const { result } = renderHook(() => useTimetableChanges());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.map((i) => i._id)).toEqual(['n1', 'n2']);
    expect(lmApi.notifications).toHaveBeenCalledWith({ limit: 50, unread: 'true' });
  });

  it('marks every class that has one', async () => {
    const { result } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.changedClassIds.has('c1')).toBe(true);
    expect(result.current.changedClassIds.has('c2')).toBe(true);
    expect(result.current.changedClassIds.has('c9')).toBe(false);
  });

  it('shows the modal once, without marking anything read', async () => {
    // Dismissing is "I have seen this dialog", not "I know about this change":
    // the bell and the card must still hold it.
    const { result, unmount } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unseen).toHaveLength(2);

    act(() => result.current.dismiss());

    expect(result.current.unseen).toHaveLength(0);
    expect(result.current.changedClassIds.has('c1')).toBe(true);
    expect(lmApi.markNotificationsRead).not.toHaveBeenCalled();

    // And it stays dismissed for the next visit.
    unmount();
    const second = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.unseen).toHaveLength(0);
    expect(second.result.current.items).toHaveLength(2);
  });

  it('shows a change that arrived after the last dismissal', async () => {
    const { result, unmount } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.dismiss());
    unmount();

    lmApi.notifications.mockResolvedValue({
      items: [change('n1', 'c1', '5'), change('n4', 'c1', '5')],
    });
    const second = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(second.result.current.unseen.map((i) => i._id)).toEqual(['n4']);
  });

  it('clears one class’s mark when the student opens it', async () => {
    const { result } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.acknowledgeClass('c1'));

    expect(lmApi.markNotificationsRead).toHaveBeenCalledWith(['n1'], { silent: true });
    expect(result.current.changedClassIds.has('c1')).toBe(false);
    // The other class is untouched — it is a different change.
    expect(result.current.changedClassIds.has('c2')).toBe(true);
  });

  it('asks for nothing when a class has no change', async () => {
    const { result } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.acknowledgeClass('c9'));

    expect(lmApi.markNotificationsRead).not.toHaveBeenCalled();
  });

  it('shows no mark at all when the fetch fails', async () => {
    // The rest of the module works without this; an error the student can do
    // nothing about is not worth a screen.
    lmApi.notifications.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTimetableChanges());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.unseen).toEqual([]);
  });

  it('refreshes when the bell marks something read', async () => {
    const { result } = renderHook(() => useTimetableChanges());
    await waitFor(() => expect(result.current.loading).toBe(false));

    lmApi.notifications.mockResolvedValue({ items: [change('n2', 'c2', '5')] });
    act(() => {
      window.dispatchEvent(new Event('lmNotificationsUpdated'));
    });

    await waitFor(() =>
      expect(result.current.changedClassIds.has('c1')).toBe(false),
    );
  });
});
