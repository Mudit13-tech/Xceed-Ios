// Authoring rules shared by the quiz editor and the AI Studio draft editor.
//
// The server enforces the same rules in services/questionRules.js — this copy
// exists so a teacher is told which option is the repeat while they are still
// looking at it, rather than by a toast after a failed save. Keep the two in
// step; the server one is the authority.

const CHOICE_TYPES = ['mcq', 'msq', 'truefalse'];

/**
 * The comparable text of an option. Options are rich text, so "Ohm" and
 * "<b>Ohm</b>" are the same answer to the student reading them. Image sources
 * are folded in so that a picture-only option is not treated as blank.
 */
export function optionKey(option) {
  const html = String(option ?? '');
  const images = (html.match(/<img[^>]+src=["']([^"']+)["']/gi) || []).join(' ');
  return `${html.replace(/<[^>]*>/g, ' ')} ${images}`
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Indices of options that repeat an earlier one. Blanks are ignored: a
 * half-typed option is a different complaint, and marking every empty row while
 * the teacher is still filling them in is noise.
 */
export function duplicateOptionIndexes(options) {
  const seen = new Set();
  const duplicates = new Set();
  (options || []).forEach((option, index) => {
    const key = optionKey(option);
    if (!key) return;
    if (seen.has(key)) duplicates.add(index);
    else seen.add(key);
  });
  return duplicates;
}

/** 1-based numbers of the questions that repeat an option. */
export function questionsWithDuplicateOptions(questions) {
  return (questions || [])
    .map((question, index) =>
      CHOICE_TYPES.includes(question?.type) && duplicateOptionIndexes(question.options).size
        ? index + 1
        : null,
    )
    .filter(Boolean);
}


/* ─────────────────── images a locked-down browser cannot fetch ───────────── */

/** Every `src` in a question — its text, its options and its explanation. */
export function imageSources(question) {
  const html = [
    question?.question,
    question?.explanation,
    ...(Array.isArray(question?.options) ? question.options : []),
  ]
    .filter(Boolean)
    .join(' ');

  return [...String(html).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
}

/**
 * Whether a student inside Safe Exam Browser could fetch this image.
 *
 * The settings file this module issues runs SEB's URL filter with its content
 * filter on and one rule, admitting this installation and nothing else — it is
 * there so a link pasted into a paper cannot become a way out of the kiosk, and
 * the content filter half applies to every request the page makes rather than
 * only to navigation. So a picture hosted anywhere else never leaves the
 * machine.
 *
 * The failure it produces is the reason this warning exists: the paper opens,
 * the text is all there, and the diagram the question is *about* is a blank
 * space — for the students in SEB only. Everyone else, the teacher included,
 * sees it perfectly.
 *
 * `data:` survives (the bytes are already in the page — this is what the
 * editor's own image button produces) and so does anything served from this
 * origin.
 */
export function isReachableImage(src, sameOrigin = '') {
  const value = String(src || '').trim();
  if (!value) return true;
  if (/^data:/i.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (!/^(?:https?:)?\/\//i.test(value)) return true;

  if (!sameOrigin) return false;
  try {
    const host = new URL(value, /^https?:/i.test(value) ? undefined : 'https:').host;
    return host === String(sameOrigin).replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  } catch {
    return false;
  }
}

/** 1-based numbers of the questions carrying an image SEB would refuse to fetch. */
export function questionsWithUnreachableImages(questions, sameOrigin = '') {
  return (questions || [])
    .map((question, index) =>
      imageSources(question).some((src) => !isReachableImage(src, sameOrigin)) ? index + 1 : null,
    )
    .filter(Boolean);
}

export { CHOICE_TYPES };
