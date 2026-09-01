import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import useProctoring from '../hooks/useProctoring';
import {
  fullscreenSupported,
  getQuizStageHost,
  isInFullscreen,
  onFullscreenChange,
  requestQuizFullscreen,
} from '../quizStage';

/**
 * The exam screen on a browser that spells the Fullscreen API the old way.
 *
 * The fault this pins, reported from a hall running macOS: the same paper that
 * worked on every Windows machine showed Mac students "Fullscreen required" and
 * a button that did nothing, while the server's clock ran. Nothing about Safe
 * Exam Browser was wrong — SEB for macOS renders in a WKWebView, and WebKit had
 * only `webkitRequestFullscreen` until Safari 16.4. `node.requestFullscreen()`
 * was not a call that failed there, it was a property that did not exist: the
 * throw was caught, the request reported false, and `document.fullscreenElement`
 * — the unprefixed one, which WebKit also does not define — stayed null for the
 * rest of the sitting. A gate waiting on that can never open.
 *
 * So these run in a document that has *only* the prefixed half, which is the one
 * environment none of the other fullscreen tests cover: `jsdom` and every
 * machine this is developed on have the unprefixed one.
 */

/** A document and an element with the WebKit spelling and nothing else. */
const useWebkitOnly = () => {
  const host = getQuizStageHost();
  const removed = [];

  const strip = (target, name) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    removed.push([target, name, descriptor]);
    Object.defineProperty(target, name, { configurable: true, value: undefined });
  };

  // Whatever jsdom provides under the standard names goes away entirely.
  strip(document, 'fullscreenElement');
  strip(document, 'fullscreenEnabled');
  strip(document, 'exitFullscreen');
  strip(host, 'requestFullscreen');

  const webkitRequest = vi.fn(() => undefined); // WebKit returns no promise
  Object.defineProperty(host, 'webkitRequestFullscreen', {
    configurable: true,
    value: webkitRequest,
  });
  Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable: true, value: true });
  Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, value: null });

  return {
    webkitRequest,
    /** What the prefixed API does when the request lands: element, then event. */
    enter: () => {
      Object.defineProperty(document, 'webkitFullscreenElement', {
        configurable: true,
        value: host,
      });
      act(() => {
        document.dispatchEvent(new Event('webkitfullscreenchange'));
      });
    },
    leave: () => {
      Object.defineProperty(document, 'webkitFullscreenElement', {
        configurable: true,
        value: null,
      });
      act(() => {
        document.dispatchEvent(new Event('webkitfullscreenchange'));
      });
    },
    restore: () => {
      removed.forEach(([target, name, descriptor]) => {
        if (descriptor) Object.defineProperty(target, name, descriptor);
        else delete target[name];
      });
      delete host.webkitRequestFullscreen;
      delete document.webkitFullscreenEnabled;
      delete document.webkitFullscreenElement;
    },
  };
};

describe('a WebKit browser with only the prefixed Fullscreen API', () => {
  let webkit;

  beforeEach(() => {
    webkit = useWebkitOnly();
    sessionStorage.clear();
  });

  afterEach(() => {
    webkit.restore();
    sessionStorage.clear();
  });

  it('asks for fullscreen through the prefixed method', async () => {
    // Before the fix this reached for `host.requestFullscreen`, found undefined,
    // and returned false without ever asking the browser for anything.
    await act(async () => {
      await requestQuizFullscreen();
    });
    expect(webkit.webkitRequest).toHaveBeenCalled();
  });

  it('is reported as capable of fullscreen, so the paper is not withheld', () => {
    expect(fullscreenSupported()).toBe(true);
  });

  it('sees the prefixed element once the request lands', () => {
    expect(isInFullscreen()).toBe(false);
    webkit.enter();
    expect(isInFullscreen()).toBe(true);
  });

  it('hears the prefixed change event', () => {
    const heard = vi.fn();
    const stop = onFullscreenChange(heard);
    webkit.enter();
    expect(heard).toHaveBeenCalled();
    stop();
    webkit.leave();
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('lets the proctoring hook see the sitting as fullscreen', () => {
    // The value the sitting's entry gate reads. Permanently false here was the
    // whole macOS lockout.
    webkit.enter();
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation: vi.fn(), settings: {} }),
    );
    expect(result.current.isFullscreen).toBe(true);
  });

  it('still reports leaving fullscreen, on the prefixed event', () => {
    // The relaxation must not cost the enforcement: a Mac student who drops out
    // of fullscreen ends their paper exactly as a Windows one does.
    webkit.enter();
    const onViolation = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() =>
      useProctoring({ active: true, attemptId: 'a1', onViolation, settings: {} }),
    );

    webkit.leave();

    expect(onViolation).toHaveBeenCalledWith('fullscreen_exit', expect.any(String));
    expect(result.current.departed).toBe(true);
  });
});

describe('a browser with no Fullscreen API at all', () => {
  const removed = [];
  const strip = (target, name) => {
    removed.push([target, name, Object.getOwnPropertyDescriptor(target, name)]);
    Object.defineProperty(target, name, { configurable: true, value: undefined });
  };

  beforeEach(() => {
    const host = getQuizStageHost();
    strip(document, 'fullscreenEnabled');
    strip(document, 'fullscreenElement');
    strip(host, 'requestFullscreen');
  });

  afterEach(() => {
    removed.splice(0).forEach(([target, name, descriptor]) => {
      if (descriptor) Object.defineProperty(target, name, descriptor);
      else delete target[name];
    });
  });

  it('says so, so the sitting can let the student through instead of stalling', () => {
    // `fullscreenSupported()` false is what drops QuizAttempt's entry gate. The
    // alternative is a screen whose only control cannot work — which is not
    // enforcing the rule, it is withholding the paper.
    expect(fullscreenSupported()).toBe(false);
  });

  it('refuses the request quietly rather than throwing', async () => {
    await expect(requestQuizFullscreen()).resolves.toBe(false);
  });
});
