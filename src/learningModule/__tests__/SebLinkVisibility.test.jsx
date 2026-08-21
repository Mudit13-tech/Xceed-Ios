import { describe, expect, it } from 'vitest';

import { isSafeExamBrowser } from '../sebDiagnosis';

/**
 * Who gets offered the Safe Exam Browser setup check.
 *
 * The check itself is no longer a screen in this app — it is plain HTML from the
 * server (`learningModule/services/sebCheckPage.js`), because the React version
 * rendered blank inside a kiosk and bounced to the sign-in page. What is left on
 * the client is the one decision the server cannot make: whether to show the
 * link at all, on a sign-in page every ordinary visitor sees.
 */

describe('who gets offered the link', () => {
  const withAgent = (ua, run) => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: ua });
    try {
      run();
    } finally {
      if (original) Object.defineProperty(window.navigator, 'userAgent', original);
    }
  };

  it('recognises Safe Exam Browser, on both spellings its builds use', () => {
    withAgent('Mozilla/5.0 SEB/3.5.0', () => expect(isSafeExamBrowser()).toBe(true));
    withAgent('Mozilla/5.0 SEB 3.5.0 (x64)', () => expect(isSafeExamBrowser()).toBe(true));
    withAgent('Mozilla/5.0 SafeExamBrowser/3.5', () => expect(isSafeExamBrowser()).toBe(true));
  });

  it('leaves an ordinary browser alone — the sign-in page is seen by everyone', () => {
    withAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120', () =>
      expect(isSafeExamBrowser()).toBe(false));
    // Not fooled by a word that merely contains the letters.
    withAgent('Mozilla/5.0 Websebra/1.0', () => expect(isSafeExamBrowser()).toBe(false));
  });
});
