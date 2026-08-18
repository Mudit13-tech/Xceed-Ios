/**
 * Colour tokens that answer for both light and dark mode.
 *
 * ## Why this exists
 *
 * The module ships a dark-mode toggle in its header, but the pages behind it were
 * written against light-mode literals — `bg="white"`, `color="gray.500"`,
 * `borderColor="gray.200"` and so on, 500-odd of them. A literal cannot answer
 * for two modes, so switching to dark left dark text on dark cards: readable in
 * the shell, invisible in the content.
 *
 * The fix is not a `useColorModeValue` call at each of those 500 sites — that is
 * five hundred chances to miss one, and no way to tell that you did. Chakra
 * resolves *semantic* tokens per colour mode at the theme level, so one
 * definition here covers every use of it. `color="lmFg.muted"` is correct in both
 * modes with no hook, no prop threading, and no per-file state.
 *
 * ## The two families
 *
 * **Semantic** (`lmBg`, `lmFg`, `lmBorder`) — greys and white, where the shade
 * already tells you the role: a heading is the darkest step, body text the next,
 * a caption the one below that, and each has one right counterpart on a dark
 * surface. These are named for the job so the next page written can pick
 * correctly without knowing the ramp.
 *
 * **Mirrored** (`lmHue`) — the coloured tints, where `red.50` behind `red.700`
 * is a pale-tint-and-dark-ink pair that has no single semantic name (is it a
 * warning, a diff, a selected row? all three, in different files). Rather than
 * invent a taxonomy the call sites do not have, each `hue.shade` maps to the
 * shade mirrored across the ramp: `red.700` ink becomes `red.200`, `red.50`
 * backing becomes `red.900`. Contrast is preserved because the relationship is,
 * and the light value is untouched.
 *
 * ## What the values are anchored to
 *
 * `LearningLayout` already did this correctly for the shell — page `gray.50`/
 * `gray.900`, cards `white`/`gray.800`, borders `gray.200`/`gray.700`, headings
 * `gray.800`/`gray.100`, captions `gray.500`/`gray.400`. These tokens are those
 * pairs — with the caption's light value corrected, see below — so the content
 * agrees with the frame around it instead of inventing a second dark palette.
 *
 * ## The two steps that moved
 *
 * Every `default` is the literal it replaced — surfaces, borders and tints render
 * in light mode exactly as they did — with two deliberate exceptions.
 *
 * `lmFg.muted` was `gray.500`, which measures **4.02:1** on white. WCAG AA for
 * normal text is 4.5, so the module's most-used text colour — captions,
 * timestamps, subtitles, 240-odd sites — was failing it, and had been all along.
 * `lmFg.faint` was `gray.400` at **2.26:1**, which is not text at any size.
 *
 * Both now point at half-steps of the ramp (see `lmGray`), taking muted to
 * 5.40:1 and faint to 3.25:1. A fifth step below faint, `gray.300` at 1.49:1, is
 * gone: its two uses were em dashes standing in for an ungiven grade, which is
 * what faint is for.
 *
 * This makes light mode slightly darker in the lower half of the ramp. That is
 * the visible cost of the text being legible, and the hierarchy still reads —
 * each step stays 1.4–1.8x from its neighbours, the same spacing Chakra's own
 * scale uses.
 */

/**
 * The two greys Chakra's ramp is missing.
 *
 * Chakra's grey scale steps 400 → 500 → 600, which on white measures 2.26 → 4.02
 * → 7.53. WCAG AA for normal text is 4.5, and the ramp steps straight over it:
 * `gray.500` misses by half a point and `gray.600` overshoots to the point of
 * colliding with the step above it. There is no Chakra grey that is both a
 * legible caption and visibly lighter than body text.
 *
 * So two half-steps, each the exact midpoint of the pair it sits between, which
 * keeps them on the same blue-grey hue line as the rest of the scale.
 */
const lmGray = {
  // Midpoint of gray.500 and gray.600. On white 5.40:1, on the sunken panel
  // 5.16:1 — clears AA for body text on both surfaces the module puts it on.
  550: '#5E6B7F',
  // Midpoint of gray.400 and gray.500, nudged a shade darker to clear 3:1 on
  // the sunken panel as well as on white (3.25 and 3.10). Three is the bar for
  // non-text marks under SC 1.4.11, which is all this step is used for.
  450: '#8190A5',
};

/**
 * Hues that appear as pale-tint panels or as ink on them.
 *
 * Deliberately no `gray`: every grey in the module is a surface, a border or a
 * step of text, and all three are covered by the semantic families below.
 * Generating `lmHue.gray500` as well would give two names for one colour and
 * invite half a page to use each.
 */
const TINT_HUES = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'cyan', 'purple', 'pink'];

/**
 * Across-the-ramp counterpart. Chakra's scales run light (50) to dark (900), so
 * mirroring turns "dark ink" into "light ink" and "pale backing" into "deep
 * backing" while keeping the distance between them.
 */
const MIRROR = {
  50: '900', 100: '800', 200: '700', 300: '600', 400: '500',
  500: '400', 600: '300', 700: '200', 800: '100', 900: '50',
};

const lmHue = {};
TINT_HUES.forEach((hue) => {
  Object.entries(MIRROR).forEach(([shade, dark]) => {
    lmHue[`${hue}${shade}`] = { default: `${hue}.${shade}`, _dark: `${hue}.${dark}` };
  });
});

/** The raw scale extension the tokens above reference. */
export const learningModuleColors = { lmGray };

export const learningModuleSemanticTokens = {
  colors: {
    /* ── surfaces ──────────────────────────────────────────────────────────
       `white` has no mirror worth having: the counterpart of a white card is not
       black but the raised grey the shell already uses, so these are stated
       rather than derived. */
    lmBg: {
      // The page itself, behind the cards.
      page: { default: 'gray.50', _dark: 'gray.900' },
      // A card or panel sitting on the page.
      surface: { default: 'white', _dark: 'gray.800' },
      // An inset panel inside a card — a quoted answer, a read-only field. Goes
      // *darker* than its card in dark mode, which is what reads as inset when
      // the card is already dark.
      sunken: { default: 'gray.50', _dark: 'gray.900' },
      // The unfilled part of a progress bar. Alpha rather than a grey so it
      // works on both the page and a card without knowing which it is on.
      track: { default: 'gray.100', _dark: 'whiteAlpha.300' },
      // Hover on a row or a nav item: lighter than the surface in dark mode,
      // because on a dark ground "raised" is the direction of light.
      hover: { default: 'gray.100', _dark: 'gray.700' },
      // A tooltip, popover or code block that should read as a layer above.
      elevated: { default: 'white', _dark: 'gray.700' },
    },

    /* ── text ──────────────────────────────────────────────────────────────
       Four steps of text and one mark, which is what the module actually needs.
       Naming them for the job is what lets a new page pick the right one without
       reading this file — and what keeps a fifth step of grey from creeping back
       in below the point where grey is still legible. */
    lmFg: {
      /* Four steps of text, every one of which clears AA on both surfaces it is
         used on — white cards and the sunken panel — in both modes. */
      heading: { default: 'gray.800', _dark: 'gray.100' },   // 16.3 light · 14.5 dark
      body: { default: 'gray.700', _dark: 'gray.200' },      // 12.0 light · 13.2 dark
      subtle: { default: 'gray.600', _dark: 'gray.300' },    //  7.5 light · 11.0 dark
      muted: { default: 'lmGray.550', _dark: 'gray.400' },   //  5.4 light ·  7.2 dark

      /**
       * Not a fifth step of text — a mark.
       *
       * Held to 3:1 rather than 4.5:1, which is the right bar only because
       * nothing that has to be *read* uses it: the left icon inside a search
       * field, a loading spinner, the em dash standing in for a grade nobody
       * has given yet. Anything with words in it belongs on `muted`.
       */
      faint: { default: 'lmGray.450', _dark: 'gray.500' },   //  3.3 light ·  4.1 dark

      // Ink that must stay legible on a saturated brand fill in both modes —
      // a badge on a class's cover colour. Deliberately *not* mode-aware.
      onAccent: { default: 'white', _dark: 'white' },
    },

    /* ── borders ───────────────────────────────────────────────────────────
       All three land on `gray.700`-ish in dark mode rather than mirroring:
       `gray.100` mirrored is `gray.800`, which is the card colour, so a subtle
       border would vanish exactly where it is doing its job. */
    lmBorder: {
      subtle: { default: 'gray.100', _dark: 'gray.700' },
      base: { default: 'gray.200', _dark: 'gray.700' },
      strong: { default: 'gray.300', _dark: 'gray.600' },
    },

    /* ── coloured tints, mirrored ──────────────────────────────────────── */
    lmHue,
  },
};

/** Everything `extendTheme` needs, in one object. */
export const learningModuleTheme = {
  colors: learningModuleColors,
  semanticTokens: learningModuleSemanticTokens,
};

export default learningModuleTheme;
