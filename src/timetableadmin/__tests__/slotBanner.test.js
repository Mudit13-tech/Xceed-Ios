/**
 * The colour and the staying power of the slot-availability banner.
 *
 * Both are read from the message text, so the server's two answers are pinned
 * here verbatim: a rewording that moved "not available" out of the refusal
 * would paint every clash green, and nothing else in the app would notice.
 */
import { describe, it, expect } from 'vitest';
import { bannerTone, bannerColor, bannerHolds } from '../slotBanner';

// Exactly as timetableModule/controllers/classtimetable.js sends them.
const AVAILABLE = 'Slot is available';
const UNAVAILABLE =
  'Slot is not available. Check faculty and room availability for more details';
const CHECKING = 'Checking slot availability...';

describe('bannerTone', () => {
  it('knows a question from its two answers', () => {
    expect(bannerTone(CHECKING)).toBe('checking');
    expect(bannerTone(AVAILABLE)).toBe('available');
    expect(bannerTone(UNAVAILABLE)).toBe('unavailable');
  });

  it('reads a refusal as a refusal, not as an offer', () => {
    // "not available" contains "available"; the order of the two tests is the
    // whole safety of this.
    expect(bannerTone('Slot is NOT AVAILABLE')).toBe('unavailable');
    expect(bannerTone('Room unavailable at this hour')).toBe('unavailable');
  });

  it('leaves the page’s other messages alone', () => {
    expect(bannerTone('Data is being locked')).toBe('info');
    expect(bannerTone('Data saved successfully')).toBe('info');
  });

  it('says nothing for nothing', () => {
    expect(bannerTone('')).toBeNull();
    expect(bannerTone(null)).toBeNull();
    expect(bannerTone(undefined)).toBeNull();
  });
});

describe('bannerColor', () => {
  it('asks in violet and answers in green or red', () => {
    expect(bannerColor('checking')).toBe('purple.500');
    expect(bannerColor('available')).toBe('green.500');
    expect(bannerColor('unavailable')).toBe('red.500');
  });

  it('keeps the page’s other messages as they were', () => {
    expect(bannerColor('info')).toBe('orange.500');
    expect(bannerColor(null)).toBe('transparent');
  });
});

describe('bannerHolds', () => {
  it('holds a question open until it is answered', () => {
    // The three-second sweep used to take this down mid-check, so the answer
    // arrived to an empty screen.
    expect(bannerHolds(CHECKING)).toBe(true);
  });

  it('lets an answer clear itself', () => {
    expect(bannerHolds(AVAILABLE)).toBe(false);
    expect(bannerHolds(UNAVAILABLE)).toBe(false);
    expect(bannerHolds('Data saved successfully')).toBe(false);
    expect(bannerHolds('')).toBe(false);
  });
});
