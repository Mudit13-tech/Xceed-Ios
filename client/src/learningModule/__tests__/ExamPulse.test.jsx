import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';

import ExamPulse from '../components/ExamPulse';

/**
 * The invigilation pulse has two phases. A single kick-off ring fires ~1.2s
 * after the pulse goes live, so an invigilator can see straight away that it is
 * working. From there every ring lands on the *server's* clock, not this
 * browser's, so a hall blooms together and a screen out of the rhythm is the one
 * that stands out. These tests pin both phases, the colour, and the manual pulse.
 */

let mockNow = 0;
vi.mock('../serverClock', () => ({
  default: { now: () => mockNow },
}));

const KICKOFF_MS = 1_200;
const ring = () => document.querySelector('.lm-exam-pulse-ring');
const overlay = () => document.querySelector('.lm-exam-pulse-overlay');

beforeEach(() => {
  vi.useFakeTimers();
  mockNow = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('fires a kick-off ring shortly after load, so the pulse is visibly live', () => {
  mockNow = 10_000; // next 30s boundary is 20s away — well past the kick-off
  render(<ExamPulse auto intervalMs={30_000} />);
  expect(ring()).toBeNull();

  act(() => vi.advanceTimersByTime(KICKOFF_MS - 1));
  expect(ring()).toBeNull();

  act(() => vi.advanceTimersByTime(1));
  expect(ring()).not.toBeNull();
  expect(overlay()).not.toBeNull();
});

it('after the kick-off, lands the next ring on the server-clock boundary, not mount time', () => {
  mockNow = 25_000; // 5s from the next 30s boundary
  render(<ExamPulse auto intervalMs={30_000} />);

  act(() => vi.advanceTimersByTime(KICKOFF_MS)); // the kick-off ring
  const kickoff = ring();
  expect(kickoff).not.toBeNull();

  // Between the kick-off and the boundary, nothing new blooms.
  act(() => vi.advanceTimersByTime(5_000 - KICKOFF_MS - 1));
  expect(ring()).toBe(kickoff);

  // The 5s-away boundary lands — a fresh ring, remounted.
  act(() => vi.advanceTimersByTime(1));
  expect(ring()).not.toBe(kickoff);
});

it('keeps pulsing every interval after the boundary', () => {
  mockNow = 0; // boundary a full interval away
  render(<ExamPulse auto intervalMs={30_000} />);

  act(() => vi.advanceTimersByTime(KICKOFF_MS)); // kick-off
  act(() => vi.advanceTimersByTime(30_000 - KICKOFF_MS)); // first boundary
  const boundary = ring();
  expect(boundary).not.toBeNull();

  act(() => vi.advanceTimersByTime(30_000)); // next interval — a fresh ring
  expect(ring()).not.toBe(boundary);
});

it('runs no ring at all when auto is off and nothing is fired — not even a kick-off', () => {
  render(<ExamPulse auto={false} intervalMs={30_000} />);
  act(() => vi.advanceTimersByTime(120_000));
  expect(ring()).toBeNull();
  expect(overlay()).toBeNull();
});

it('still blooms a manual pulse when the automatic pulse is off — the whole point of Pulse now', () => {
  mockNow = 10_000;
  const { rerender } = render(<ExamPulse auto={false} intervalMs={30_000} manualPulseAt={null} />);
  // No standing pulse and no kick-off: time can pass and nothing rings on its own.
  act(() => vi.advanceTimersByTime(120_000));
  expect(ring()).toBeNull();

  // The invigilator presses "Pulse now"; the fresh stamp arrives on a heartbeat.
  mockNow = 130_000;
  rerender(<ExamPulse auto={false} intervalMs={30_000} manualPulseAt="1970-01-01T00:02:10.000Z" />);
  expect(ring()).not.toBeNull();

  // And it does not start a standing rhythm — one bloom, then quiet again.
  const fired = ring();
  act(() => vi.advanceTimersByTime(120_000));
  expect(ring()).toBe(fired);
});

it('stops its timers on unmount', () => {
  const { unmount } = render(<ExamPulse auto intervalMs={30_000} />);
  unmount();
  // No throw, and nothing appears in a detached tree after unmount.
  expect(() => act(() => vi.advanceTimersByTime(90_000))).not.toThrow();
  expect(ring()).toBeNull();
});

it('paints the ring in the teacher-chosen colour', () => {
  render(<ExamPulse auto intervalMs={30_000} color="#ff0066" />);
  act(() => vi.advanceTimersByTime(KICKOFF_MS));
  expect(ring()).not.toBeNull();
  // A hex sets the inline border colour; browsers normalise it to rgb().
  expect(ring().style.borderColor).toBe('rgb(255, 0, 102)');
});

it('blooms immediately for a fresh manual pulse, before the kick-off or any scheduled ring', () => {
  mockNow = 5_000;
  const { rerender } = render(<ExamPulse auto intervalMs={30_000} manualPulseAt={null} />);
  expect(ring()).toBeNull(); // nothing yet — kick-off is ~1.2s out, no timers advanced

  // Teacher pressed "pulse now" a moment ago; the stamp arrives on a heartbeat.
  rerender(<ExamPulse auto intervalMs={30_000} manualPulseAt="1970-01-01T00:00:04.000Z" />);
  expect(ring()).not.toBeNull();
});

it('ignores a stale manual pulse handed to it on load or reconnect', () => {
  // auto off, so the only thing that could paint is the manual pulse itself —
  // isolating the staleness guard from the kick-off ring.
  mockNow = 120_000; // the stamp below is ~120s old — well past the freshness window
  render(<ExamPulse auto={false} intervalMs={30_000} manualPulseAt="1970-01-01T00:00:00.000Z" />);
  act(() => vi.advanceTimersByTime(9_999));
  expect(ring()).toBeNull();
});

it('skips the next automatic ring after a manual pulse so nobody is pulsed twice', () => {
  mockNow = 0; // boundary a full interval away, clear of the kick-off
  const { rerender } = render(<ExamPulse auto intervalMs={30_000} manualPulseAt={null} />);

  act(() => vi.advanceTimersByTime(KICKOFF_MS)); // kick-off ring out of the way
  act(() => vi.advanceTimersByTime(20_000 - KICKOFF_MS)); // total 20s, before the 30s boundary

  // Manual pulse lands 10s before the scheduled boundary.
  rerender(<ExamPulse auto intervalMs={30_000} manualPulseAt="1970-01-01T00:00:00.000Z" />);
  const manual = ring();
  expect(manual).not.toBeNull();

  // The boundary arrives — but it is swallowed, so the ring is not remounted.
  act(() => vi.advanceTimersByTime(10_000)); // total 30s
  expect(ring()).toBe(manual); // same node: no fresh bloom

  // The interval after that fires normally again — a fresh ring.
  act(() => vi.advanceTimersByTime(30_000));
  expect(ring()).not.toBe(manual);
});
