import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The iOS edge-back gesture.
 *
 * Most of what this file asserts is the gesture *not* firing. A back swipe that
 * goes off when it should not costs the user the screen they were on — and on a
 * quiz attempt, the work on it — so the refusals are the part worth pinning
 * down; the happy path is one case among many.
 */
let platform = 'ios';
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => platform } }));

const { setupSwipeBack } = await import('../swipeBack');

const WIDTH = 390; // an iPhone's CSS width; commit distance is a quarter of it

let goBack;
let path;
let teardown;

const touch = (x, y) => ({ clientX: x, clientY: y });

const fire = (type, points, timeStamp) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = points.map(([x, y]) => touch(x, y));
  Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', { value: list });
  if (type === 'touchend') Object.defineProperty(event, 'touches', { value: [] });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp ?? 0 });
  (points.target ?? document.body).dispatchEvent(event);
  return event;
};

/** A slow, deliberate drag from `from` to `to`, as a thumb would make it. */
const swipe = (from, to, { target = document.body, duration = 400 } = {}) => {
  const start = new Event('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(start, 'touches', { value: [touch(from, 300)] });
  Object.defineProperty(start, 'timeStamp', { value: 0 });
  target.dispatchEvent(start);

  for (const x of [from + 20, (from + to) / 2, to]) {
    const move = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(move, 'touches', { value: [touch(x, 300)] });
    target.dispatchEvent(move);
  }

  const end = new Event('touchend', { bubbles: true, cancelable: true });
  Object.defineProperty(end, 'changedTouches', { value: [touch(to, 300)] });
  Object.defineProperty(end, 'touches', { value: [] });
  Object.defineProperty(end, 'timeStamp', { value: duration });
  target.dispatchEvent(end);
};

beforeEach(() => {
  platform = 'ios';
  goBack = vi.fn();
  path = '/learning/class/c1/quizzes';
  window.innerWidth = WIDTH;
  // history.length is 1 in a fresh jsdom, which the gesture reads as "nothing
  // behind us"; give it something to go back to.
  window.history.pushState({}, '', '/a');
  window.history.pushState({}, '', '/b');
  teardown = setupSwipeBack({ getPath: () => path, goBack });
});

afterEach(() => {
  teardown?.();
  document.body.innerHTML = '';
});

describe('mobile swipe-back', () => {
  it('goes back on a drag from the left edge', () => {
    swipe(6, 220);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('goes back on a short fast flick', () => {
    swipe(4, 90, { duration: 120 });
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('ignores a drag that does not travel far enough', () => {
    swipe(4, 50, { duration: 600 });
    expect(goBack).not.toHaveBeenCalled();
  });

  it('ignores a drag that starts away from the edge', () => {
    swipe(140, 340);
    expect(goBack).not.toHaveBeenCalled();
  });

  it('ignores a scroll that starts at the edge and drifts sideways', () => {
    // Deliberately far enough across to pass the distance test on its own: what
    // disqualifies it is that it travelled further down the screen than across
    // it, which is a thumb scrolling the page, not asking to go back.
    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: [touch(5, 620)] });
    document.body.dispatchEvent(start);

    for (const [x, y] of [[40, 500], [130, 260], [210, 60]]) {
      const move = new Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(move, 'touches', { value: [touch(x, y)] });
      document.body.dispatchEvent(move);
    }

    const end = new Event('touchend', { bubbles: true, cancelable: true });
    Object.defineProperty(end, 'changedTouches', { value: [touch(210, 60)] });
    Object.defineProperty(end, 'touches', { value: [] });
    Object.defineProperty(end, 'timeStamp', { value: 400 });
    document.body.dispatchEvent(end);

    expect(goBack).not.toHaveBeenCalled();
  });

  it.each([
    ['a quiz attempt', '/learning/class/c1/quiz/q1/attempt/a1'],
    ['a live Short', '/learning/short/live/s1'],
    ['a presentation', '/learning/class/c1/tutorial/t1/present'],
  ])('refuses to walk out of %s', (_label, locked) => {
    path = locked;
    swipe(6, 300);
    expect(goBack).not.toHaveBeenCalled();
  });

  it.each(['/', '/login', '/home', '/learning', '/userroles'])('does nothing at %s', (root) => {
    path = root;
    swipe(6, 300);
    // Notably it does not exit the app either, unlike the hardware back key: a
    // thumb resting on the edge must not be able to close it.
    expect(goBack).not.toHaveBeenCalled();
  });

  it('leaves a horizontal scroller to scroll', () => {
    // The class tab row: it reaches the left edge, so scrolling it back to
    // "Stream" begins exactly where this gesture begins.
    const tabs = document.createElement('div');
    document.body.appendChild(tabs);
    Object.defineProperty(tabs, 'scrollWidth', { value: 900 });
    Object.defineProperty(tabs, 'clientWidth', { value: 390 });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ overflowX: 'auto' });

    swipe(5, 300, { target: tabs });

    expect(goBack).not.toHaveBeenCalled();
    window.getComputedStyle.mockRestore();
  });

  it('leaves an open dialog alone', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);

    swipe(6, 300);

    expect(goBack).not.toHaveBeenCalled();
  });

  it('leaves an open modal alone', () => {
    const modal = document.createElement('section');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);

    swipe(6, 300);

    expect(goBack).not.toHaveBeenCalled();
  });

  it('is not blocked by a closed popover that stays mounted', () => {
    // Chakra's <Popover> keeps its role="dialog" content in the DOM while closed
    // and hides it with visibility on the positioner around it. The bell on
    // every Learning page renders one, so treating it as open refused the
    // gesture on every screen that has the bell.
    const positioner = document.createElement('div');
    positioner.style.visibility = 'hidden';
    const content = document.createElement('section');
    content.setAttribute('role', 'dialog');
    content.style.visibility = 'hidden';
    positioner.appendChild(content);
    document.body.appendChild(positioner);

    swipe(6, 220);

    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('ignores a two-finger gesture', () => {
    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'touches', { value: [touch(5, 300), touch(200, 300)] });
    document.body.dispatchEvent(start);
    fire('touchmove', [[260, 300]]);
    fire('touchend', [[260, 300]], 400);

    expect(goBack).not.toHaveBeenCalled();
  });

  it('is not installed on Android', () => {
    teardown();
    platform = 'android';
    goBack = vi.fn();
    teardown = setupSwipeBack({ getPath: () => path, goBack });

    swipe(6, 300);

    expect(goBack).not.toHaveBeenCalled();
  });

  it('stops listening once torn down', () => {
    teardown();
    teardown = null;
    swipe(6, 300);
    expect(goBack).not.toHaveBeenCalled();
  });
});
