/**
 * The DOM half of the quiz stage — see `components/QuizStage.jsx` for the
 * component that renders into it.
 *
 * The host element is created once and never removed, and that is the whole
 * point: the browser drops fullscreen the instant the fullscreened element
 * leaves the DOM, so fullscreening a page's own wrapper would end the moment
 * "Start test" swapped the brief for the paper. A host that lives outside the
 * route tree survives that hop, so the student sees one uninterrupted screen
 * from the instructions to the last question.
 */

/**
 * The Fullscreen API, on the two spellings that are still in the field.
 *
 * WebKit only gained the unprefixed names in Safari 16.4. Everything before
 * that — macOS 12 and earlier, and the WKWebView that Safe Exam Browser for
 * macOS renders in — has `webkitRequestFullscreen` and nothing else, so
 * `node.requestFullscreen()` is not a call that fails, it is a property that
 * does not exist. The throw was caught, the request quietly returned false, and
 * `isFullscreen` stayed false for the rest of the sitting: the student sat on
 * QuizAttempt's "Fullscreen required" gate, pressing a button that could never
 * work, with a clock the server had already started. Windows was unaffected
 * throughout, which is what made it look like a Safe Exam Browser fault.
 *
 * The prefixed half is not a courtesy. It is the only half a Mac in an exam
 * hall may have, and the module's own older quiz screens
 * (`quizModule/student/Instructions.jsx`) have always handled it.
 *
 * `webkitExitFullscreen` and the prefixed `webkitfullscreenchange` event are
 * part of the same set — an implementation has all three or none of them — but
 * each is looked up on its own rather than inferred, because a partial
 * implementation costs nothing to tolerate here.
 */
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

/** Both spellings of the change event, since only one of them will ever fire. */
export function onFullscreenChange(handler) {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}

/**
 * Whether the browser is in fullscreen right now.
 *
 * Exported because three separate places used to read `document.fullscreenElement`
 * directly — the stage, the proctoring hook and the sitting's entry gate — and a
 * gate that disagrees with the watcher about what fullscreen means is the shape
 * of the bug above. One answer, read from one place.
 */
export const isInFullscreen = () => Boolean(fullscreenElement());

/**
 * Whether this browser can go fullscreen at all.
 *
 * Not the same question as "did the request succeed", and the sitting's entry
 * gate needs this one rather than that one. A browser with no Fullscreen API —
 * or one where the document is not permitted to use it — will never satisfy a
 * gate that waits for `isInFullscreen()`, so demanding it there does not enforce
 * the rule, it removes the paper. The honest position is the one the proctoring
 * hook already takes about every other deterrent: ask for what the browser can
 * give, record what actually happens, and let the server judge it. Leaving the
 * window is still watched and still ends the sitting on a browser that lands
 * here — that half needs no fullscreen.
 *
 * `fullscreenEnabled` is the documented way to ask, and is false rather than
 * absent inside an iframe that was not granted the feature. Where neither
 * spelling of it exists, the presence of the request method is the fallback.
 */
export const fullscreenSupported = () => {
  if (typeof document.fullscreenEnabled === 'boolean' || typeof document.webkitFullscreenEnabled === 'boolean') {
    return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }
  const host = getQuizStageHost();
  return Boolean(host.requestFullscreen || host.webkitRequestFullscreen);
};

const HOST_ID = 'lm-quiz-stage';
// gray.50 — the background the rest of the module sits on.
const HOST_STYLE = 'position:fixed;inset:0;z-index:1300;overflow-y:auto;background:#F7FAFC;';

// How many quiz screens are mounted. Module scope rather than React state
// because this has to survive the handover between the two of them.
let openCount = 0;

export function getQuizStageHost() {
  let node = document.getElementById(HOST_ID);
  if (!node) {
    node = document.createElement('div');
    node.id = HOST_ID;
    node.style.cssText = `${HOST_STYLE}display:none;`;
    document.body.appendChild(node);
  }
  return node;
}

/** Fullscreens the stage. Resolves false when the browser wanted a gesture. */
export async function requestQuizFullscreen() {
  if (isInFullscreen()) return true;
  const host = getQuizStageHost();
  // Unprefixed first, so a browser that has both takes the standard path.
  const request = host.requestFullscreen || host.webkitRequestFullscreen;
  if (!request) return false;
  try {
    // WebKit's prefixed form returns undefined rather than a promise, which
    // `await` handles; what it does not do is report a refusal, so a false from
    // here means "asked and could not tell", not "granted". The change event is
    // what settles it either way.
    await request.call(host);
    return true;
  } catch {
    // Nothing to recover from — the stage header keeps offering the button.
    return false;
  }
}

/** The stage scrolls, not the window, so page-level scrolling goes through here. */
export function scrollStageToTop() {
  document.getElementById(HOST_ID)?.scrollTo({ top: 0 });
}

/**
 * Puts a quiz screen on the stage and returns the release function.
 *
 * The stage covers the viewport whether or not real fullscreen was granted:
 * `requestFullscreen` needs a user gesture, and a quiz opened from a pasted
 * link in a fresh tab has none. Being an overlay first and fullscreen second
 * means the test always fills the screen, and a refusal costs nothing but the
 * browser's own chrome.
 */
export function openQuizStage(options = {}) {
  const { autoFullscreen = true } = typeof options === 'boolean' ? { autoFullscreen: options } : options;
  const host = getQuizStageHost();
  openCount += 1;
  host.style.display = 'block';
  document.body.style.overflow = 'hidden';
  // Arriving from a link click still carries that click's transient activation,
  // so this normally lands without the student doing anything.
  //
  // `autoFullscreen: false` only withholds the request — it never *exits*. A
  // mounted stage leaving fullscreen on its own is what broke the handover: the
  // sitting mounts in its loading state, which is not yet a live paper, so the
  // flag was false for a beat and threw away the fullscreen the brief had been
  // granted. Re-requesting it a fetch later has no gesture behind it, the
  // browser refuses, and the student lands on the "Fullscreen required" gate for
  // a screen they never actually left. Only closing the stage drops fullscreen.
  if (openCount === 1 && autoFullscreen) {
    requestQuizFullscreen();
  }

  return () => {
    openCount -= 1;
    // The brief unmounts before the paper mounts; deciding a beat later keeps
    // that handover from blinking the app back into view.
    setTimeout(() => {
      if (openCount > 0) return;
      host.style.display = 'none';
      document.body.style.overflow = '';
      if (isInFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        try {
          Promise.resolve(exit.call(document)).catch(() => {});
        } catch {
          // Leaving fullscreen is the last thing a closing stage does; a browser
          // that refuses it has nothing left to break.
        }
      }
    }, 0);
  };
}
