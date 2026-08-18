import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import useProctoring from '../hooks/useProctoring';
import NumericKeypad, { applyKey } from '../components/NumericKeypad';
import useQuizCountdown from '../hooks/useQuizCountdown';
import { sync, now as serverNow, reset as resetClock, state as clockState } from '../serverClock';

/**
 * Two defects reported from a live examination on macOS.
 *
 * The first: a student summoned the Gemini desktop assistant with its global
 * hotkey. It draws a non-activating panel over the browser, so the frontmost
 * application stays frontmost — no `blur`, `visibilityState` still "visible",
 * fullscreen intact — and every signal the proctoring watches for is one the
 * operating system never sends. The answer is not to detect the panel, which no
 * web API can do, but to make the keyboard itself illegitimate: every answer type
 * is clicked, so a keypress during a sitting has no innocent purpose.
 *
 * The second: the countdown was wrong. It subtracted the *browser's* clock from a
 * deadline computed by the *server's*, so it was off by exactly the drift between
 * them — minutes, on a laptop that had been asleep.
 */

/* ─────────────────────── the keyboard lockdown ────────────────────────── */

function Harness({ onViolation, lockdown = true, active = true }) {
  const { departed } = useProctoring({
    settings: { keyboardLockdown: lockdown },
    active,
    attemptId: 'a1',
    onViolation,
  });
  return (
    <div>
      <span data-testid="departed">{String(departed)}</span>
      <input data-testid="field" aria-label="typed answer" />
    </div>
  );
}

describe('keyboard lockdown', () => {
  let violation;

  beforeEach(() => {
    violation = vi.fn().mockResolvedValue({ terminated: true, message: 'Submitted.' });
    sessionStorage.clear();
  });

  it('ends the paper on the first key pressed', async () => {
    render(<Harness onViolation={violation} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'a' });
    });

    expect(violation).toHaveBeenCalledTimes(1);
    expect(violation.mock.calls[0][0]).toBe('key_press');
    // Latched locally, without waiting for the server to agree — the browser
    // already saw it.
    expect(screen.getByTestId('departed').textContent).toBe('true');
  });

  it('records the modifier, which is the only part of a global hotkey we ever see', async () => {
    render(<Harness onViolation={violation} />);

    // macOS consumes Option+Space before the page is handed it, so what actually
    // arrives is the modifier going down first. That is the tripwire.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Alt', altKey: true });
    });

    expect(violation.mock.calls[0][2]).toBe('Alt');
  });

  it('names a combination when one does reach us', async () => {
    render(<Harness onViolation={violation} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true, shiftKey: true });
    });

    expect(violation.mock.calls[0][2]).toBe('Meta+Shift+k');
  });

  it('stops the keystroke reaching the page at all', async () => {
    render(<Harness onViolation={violation} />);
    const field = screen.getByTestId('field');
    field.focus();

    /* The capture phase is the claim, so it has to be the assertion. A handler
       bound *inside* the page runs before a window handler in the bubble phase —
       so binding on bubble would let the page act on the key first, which is
       exactly what a lockdown must not allow. This listener stands in for one. */
    const sawIt = vi.fn();
    field.addEventListener('keydown', sawIt);

    const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    await act(async () => {
      field.dispatchEvent(event);
    });

    expect(sawIt, 'a handler inside the page saw the key').not.toHaveBeenCalled();
    // And the character is never inserted.
    expect(event.defaultPrevented).toBe(true);
    field.removeEventListener('keydown', sawIt);
  });

  it('reports one departure however many keys follow', async () => {
    render(<Harness onViolation={violation} />);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'a' });
      fireEvent.keyDown(window, { key: 'b' });
      fireEvent.keyDown(window, { key: 'c' });
    });

    // A student whose hand is on the keyboard should not generate a report per
    // key against an attempt that is already over.
    expect(violation).toHaveBeenCalledTimes(1);
  });

  it('blocks keys during the brief but reports nothing', async () => {
    // The brief is sat on the same locked screen, so a student finds out the
    // keyboard is dead while reading the rules rather than at the cost of their
    // paper. There is no attempt yet to end.
    render(<Harness onViolation={violation} active={false} />);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(violation).not.toHaveBeenCalled();
  });

  it('leaves the keyboard alone when the setting is off', async () => {
    // The escape hatch for a candidate who navigates by keyboard with a screen
    // reader. Without it the rule locks them out of the examination entirely.
    render(<Harness onViolation={violation} lockdown={false} />);

    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(violation).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────── the keypad ─────────────────────────────── */

describe('the numeric keypad', () => {
  it('builds a number a digit at a time', () => {
    let text = '';
    ['1', '2', '.', '5'].forEach((key) => { text = applyKey(text, key); });
    expect(text).toBe('12.5');
  });

  it('refuses a second decimal point', () => {
    expect(applyKey('1.5', '.')).toBe('1.5');
  });

  it('never leaves a value that is not a number', () => {
    // A bare "." would not parse, so the leading zero the student would have
    // typed anyway is supplied.
    expect(applyKey('', '.')).toBe('0.');
    expect(applyKey('-', '.')).toBe('-0.');
    [applyKey('', '.'), applyKey('-', '.'), applyKey('', '5')].forEach((text) => {
      expect(Number.isNaN(Number(text))).toBe(false);
    });
  });

  it('toggles the minus rather than inserting it', () => {
    expect(applyKey('40', '-')).toBe('-40');
    expect(applyKey('-40', '-')).toBe('40');
    // And nowhere but the front, so "4-0" is unreachable.
    expect(applyKey('-40', '-')).not.toContain('4-');
  });

  it('does not accumulate leading zeros', () => {
    expect(applyKey('0', '7')).toBe('7');
    expect(applyKey('-0', '7')).toBe('-7');
  });

  it('deletes and clears', () => {
    expect(applyKey('12.5', 'back')).toBe('12.');
    expect(applyKey('12.5', 'clear')).toBe('');
  });

  it('enters a value entirely by clicking', () => {
    const onChange = vi.fn();
    let value = '';
    const { rerender } = render(<NumericKeypad value={value} onChange={onChange} />);

    ['3', '.', '1', '4'].forEach((key) => {
      fireEvent.click(screen.getByRole('button', { name: key === '.' ? 'Decimal point' : key }));
      value = onChange.mock.calls.at(-1)[0];
      rerender(<NumericKeypad value={value} onChange={onChange} />);
    });

    expect(value).toBe('3.14');
    // Shown back to the student, since with no keyboard there is no other way to
    // check what was entered.
    expect(screen.getByLabelText('Your answer').textContent).toContain('3.14');
  });

  it('offers no focusable text field to type into', () => {
    render(<NumericKeypad value="1" onChange={() => {}} />);
    // A field that cannot be typed in invites a student to try, and under
    // lockdown trying costs them the paper.
    expect(document.querySelector('input')).toBeNull();
  });
});

/* ─────────────────────────── the server clock ─────────────────────────── */

function Countdown({ deadline, onExpire = () => {} }) {
  const remaining = useQuizCountdown({ deadline, departed: false, finished: false, onExpire });
  return <span data-testid="left">{String(remaining)}</span>;
}

describe('the countdown counts against the server clock', () => {
  beforeEach(() => {
    resetClock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetClock();
  });

  it('uses this browser until it has been told the server time', () => {
    // The fallback, and also the shape of the reported bug: with no offset learned
    // the countdown is the browser's own arithmetic, and is wrong by whatever the
    // browser's clock is wrong by. The test below is the fix.
    const deadline = new Date('2026-08-18T10:03:00.000Z').toISOString();
    render(<Countdown deadline={deadline} />);
    expect(screen.getByTestId('left').textContent).toBe('180');
  });

  it('shows the true remaining time once the offset is known', () => {
    // The server is seven minutes behind this browser, so a deadline the server
    // put 10 minutes out lands 3 minutes out by the browser's clock.
    sync(new Date('2026-08-18T09:53:00.000Z').toISOString());
    expect(clockState().synced).toBe(true);

    const deadline = new Date('2026-08-18T10:03:00.000Z').toISOString();
    render(<Countdown deadline={deadline} />);

    // 10 minutes, measured against the clock that set the deadline.
    expect(screen.getByTestId('left').textContent).toBe('600');
  });

  it('ticks down against the corrected clock', () => {
    sync(new Date('2026-08-18T09:53:00.000Z').toISOString());
    render(<Countdown deadline={new Date('2026-08-18T10:03:00.000Z').toISOString()} />);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('left').textContent).toBe('595');
  });

  it('ignores an unparseable server time rather than poisoning the clock', () => {
    // A NaN offset would make every countdown read 00:00 and expire on arrival —
    // far worse than the drift it is here to fix.
    expect(sync('not a date')).toBe(false);
    expect(sync(undefined)).toBe(false);
    expect(clockState().synced).toBe(false);
    expect(serverNow()).toBe(Date.now());
  });

  it('falls back to this browser when nothing has been learned', () => {
    expect(serverNow()).toBe(Date.now());
  });

  it('expires on the server clock, not the browser one', () => {
    // The browser thinks there are 3 minutes left; the server says the deadline
    // has already passed. The server wins, which is the only answer that agrees
    // with the paper actually being closed.
    sync(new Date('2026-08-18T10:05:00.000Z').toISOString());
    const onExpire = vi.fn();
    render(<Countdown deadline={new Date('2026-08-18T10:03:00.000Z').toISOString()} onExpire={onExpire} />);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
