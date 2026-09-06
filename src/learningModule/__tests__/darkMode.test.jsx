import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';

const getAllFiles = (dir) => {
  const entries = readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const res = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files = files.concat(getAllFiles(res));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) {
      files.push(res);
    }
  }
  return files;
};
import { execSync } from 'node:child_process';
import { ChakraProvider, Box, Text, extendTheme, theme as chakraTheme } from '@chakra-ui/react';

import { learningModuleColors, learningModuleSemanticTokens, learningModuleTheme } from '../theme';
import { SectionCard, StatTile, EmptyState, Loading } from '../components/common';
import TimetableGrid from '../components/TimetableGrid';

/**
 * Dark mode was reported as "many pages font and text is not visible": the module
 * shipped a theme toggle, but its pages were written against light-mode literals
 * that cannot answer for two modes. Two things need holding.
 *
 * The first is that the tokens actually flip — a token that resolved to the same
 * colour in both modes would look like a fix and change nothing.
 *
 * The second, and the one that matters over time, is that the literals stay gone.
 * A single `color="gray.500"` added to a page next month is invisible text again,
 * and nothing in a build or a render test would notice. So the guard below reads
 * the source.
 */

// The same object main.jsx registers, so the scale extension the tokens point
// at is present here too — without it a token resolves to the bare string
// `lmGray.550`, which is not a colour any browser will paint.
const theme = extendTheme(learningModuleTheme);

/**
 * Renders once and returns the stylesheet Chakra emitted.
 *
 * There is no need to render twice: Chakra writes *both* branches of every
 * semantic token into the same stylesheet — light values in the `:root` rule,
 * dark ones in a `[data-theme=dark]` rule that overrides it — and the browser
 * picks between them. Reading both out of one render is also the only option
 * available, since clearing emotion's style tags between renders detaches nodes
 * it still expects to own.
 */
const stylesheet = (ui) => {
  render(
    <ChakraProvider theme={theme}>
      {ui}
    </ChakraProvider>,
  );
  return [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('');
};

/** What a token resolves to in one mode, read out of the emitted variables. */
const resolve = (css, token, mode) => {
  const name = `--chakra-colors-${token.replace('.', '-')}`;
  const blocks = [...css.matchAll(/([^{}]*)\{([^{}]*--chakra-colors[^{}]*)\}/g)];
  for (const [, selector, body] of blocks) {
    const isDark = selector.includes('data-theme=dark');
    if (isDark !== (mode === 'dark')) continue;
    const hit = new RegExp(`${name}:([^;]+);`).exec(body);
    if (hit) return hit[1].trim();
  }
  return null;
};

describe('the tokens answer for both modes', () => {
  it('resolves every surface, text and border token to a different value in dark mode', () => {
    const css = stylesheet(<Box bg="lmBg.surface" />);

    const mustDiffer = [
      'lmBg.page', 'lmBg.surface', 'lmBg.sunken', 'lmBg.track', 'lmBg.hover', 'lmBg.elevated',
      'lmFg.heading', 'lmFg.body', 'lmFg.subtle', 'lmFg.muted', 'lmFg.faint',
      'lmBorder.subtle', 'lmBorder.base', 'lmBorder.strong',
    ];

    mustDiffer.forEach((token) => {
      const lightValue = resolve(css, token, 'light');
      const darkValue = resolve(css, token, 'dark');
      expect(lightValue, `${token} has no light value`).toBeTruthy();
      expect(darkValue, `${token} has no dark value`).toBeTruthy();
      expect(darkValue, `${token} is the same in both modes`).not.toBe(lightValue);
    });
  });

  it('keeps ink-on-accent white in both modes', () => {
    // A badge sits on a class's cover colour, which does not change with the
    // theme, so its text must not either. This token exists to say that out loud
    // rather than leaving a bare `color="white"` for a later sweep to "fix".
    const css = stylesheet(<Text color="lmFg.onAccent" />);
    expect(resolve(css, 'lmFg.onAccent', 'light')).toBe(resolve(css, 'lmFg.onAccent', 'dark'));
  });

  it('mirrors a coloured tint pair across the ramp', () => {
    const dark = stylesheet(<Box bg="lmHue.red50" color="lmHue.red700" />);
    // Pale backing becomes deep backing, dark ink becomes light ink — so the
    // pairing survives instead of collapsing to red-on-red.
    expect(resolve(dark, 'lmHue.red50', 'dark')).toContain('red-900');
    expect(resolve(dark, 'lmHue.red700', 'dark')).toContain('red-200');
  });

  it('dereferences the half-steps to a real colour, not a bare token name', () => {
    /* A near miss worth holding. Chakra does not validate a semantic token's
       target: point one at `lmGray.550` without registering an `lmGray` scale and
       it emits `--chakra-colors-lmFg-muted: lmGray.550` — a string no browser can
       paint, so every caption in the module falls back to inherited colour. The
       scale and the tokens have to be registered together, and this fails loudly
       if a later change separates them. */
    const css = stylesheet(<Text color="lmFg.muted" />);
    ['lmFg.muted', 'lmFg.faint'].forEach((token) => {
      const value = resolve(css, token, 'light');
      expect(value, `${token} resolves to ${value}`).toMatch(/^var\(--chakra-colors-/);
    });
    // And the variable it points at has to exist.
    expect(resolve(css, 'lmGray.550', 'light')).toBe('#5E6B7F');
    expect(resolve(css, 'lmGray.450', 'light')).toBe('#8190A5');
  });

  it('leaves light mode as it was, apart from the two steps that were retuned', () => {
    const light = stylesheet(<Box bg="lmBg.surface" />);
    // Surfaces, borders and tints keep the literal they replaced, so the light
    // theme that was already working is not disturbed by the dark-mode work.
    expect(resolve(light, 'lmBg.surface', 'light')).toContain('white');
    expect(resolve(light, 'lmFg.heading', 'light')).toContain('gray-800');
    expect(resolve(light, 'lmFg.body', 'light')).toContain('gray-700');
    expect(resolve(light, 'lmFg.subtle', 'light')).toContain('gray-600');
    expect(resolve(light, 'lmBorder.base', 'light')).toContain('gray-200');
    expect(resolve(light, 'lmHue.red50', 'light')).toContain('red-50');

    // The exceptions, on purpose: `gray.500` captions measured 4.02:1 on white,
    // under AA, and `gray.400` marks 2.26:1. Both now point at the half-steps.
    expect(resolve(light, 'lmFg.muted', 'light')).toContain('lmGray-550');
    expect(resolve(light, 'lmFg.faint', 'light')).toContain('lmGray-450');
  });
});

/* ──────────────────────────── contrast ─────────────────────────────────── */

/** A token reference (`gray.500`, `lmGray.550`, `white`) as a hex string. */
const asHex = (ref) => {
  if (ref.startsWith('#')) return ref;
  if (ref === 'white') return '#FFFFFF';
  if (ref === 'black') return '#000000';
  const [hue, shade] = ref.split('.');
  // The module's own half-steps first, then Chakra's scales.
  const value = learningModuleColors[hue]?.[shade] ?? chakraTheme.colors[hue]?.[shade];
  if (!value) throw new Error(`no colour for ${ref}`);
  return value;
};

/** Relative luminance, per WCAG 2.x. */
const luminance = (hexValue) => {
  const raw = hexValue.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [lighter, darker] = [luminance(asHex(a)), luminance(asHex(b))].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
};

/** The literal a token resolves to in one mode, read from the definitions. */
const valueOf = (path, mode) => {
  const [group, key] = path.split('.');
  const def = learningModuleSemanticTokens.colors[group][key];
  return mode === 'dark' ? def._dark : def.default;
};

describe('the dark palette is legible', () => {
  /**
   * "The values differ" is not the claim worth testing — a dark value can differ
   * and still be dark-on-dark. These are the pairs that actually appear on screen,
   * measured.
   *
   * `lmFg.faint` is left out on purpose and checked separately: it is not a step
   * of text but a mark — a search icon, a spinner, the em dash standing in for a
   * grade nobody has given — and marks are held to 3:1, not 4.5:1.
   */
  const readable = [
    ['lmFg.heading', 'lmBg.surface'],
    ['lmFg.body', 'lmBg.surface'],
    ['lmFg.subtle', 'lmBg.surface'],
    ['lmFg.muted', 'lmBg.surface'],
    ['lmFg.muted', 'lmBg.sunken'],
    ['lmFg.body', 'lmBg.sunken'],
    ['lmFg.heading', 'lmBg.page'],
    ['lmFg.muted', 'lmBg.page'],
    ['lmFg.body', 'lmBg.hover'],
  ];

  it.each(['light', 'dark'])('clears AA for text on every surface, in %s mode', (mode) => {
    readable.forEach(([fg, bg]) => {
      const ratio = contrast(valueOf(fg, mode), valueOf(bg, mode));
      expect(ratio, `${fg} on ${bg} in ${mode} mode is ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(4.5);
    });
  });

  it('never reads worse in dark mode than it does in light', () => {
    /* The point of the change. A dark value chosen carelessly can pass 4.5:1 and
       still be a step down from the light theme it replaced.

       The bar is the light ratio, capped at AAA: above 7:1 the difference between
       14:1 and 16:1 is not something an eye resolves, and holding the high end to
       an exact match would fail on arithmetic rather than on legibility. Below
       7:1 — where it does matter — dark has to match or beat light outright. */
    readable.forEach(([fg, bg]) => {
      const dark = contrast(valueOf(fg, 'dark'), valueOf(bg, 'dark'));
      const light = contrast(valueOf(fg, 'light'), valueOf(bg, 'light'));
      expect(dark, `${fg} on ${bg}: ${dark.toFixed(2)}:1 dark vs ${light.toFixed(2)}:1 light`)
        .toBeGreaterThanOrEqual(Math.min(light, 7));
    });
  });

  it.each(['light', 'dark'])('keeps non-text marks perceivable in %s mode', (mode) => {
    // SC 1.4.11: a control or graphical object needs 3:1, not the 4.5:1 that text
    // does. Checked on both the card and the inset panel, because the search icon
    // this covers sits on either depending on the page.
    ['lmBg.surface', 'lmBg.sunken'].forEach((bg) => {
      const ratio = contrast(valueOf('lmFg.faint', mode), valueOf(bg, mode));
      expect(ratio, `faint on ${bg} in ${mode} mode is ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(3);
    });
  });

  it('keeps every tint readable against its own backing', () => {
    ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'].forEach((hue) => {
      const ratio = contrast(valueOf(`lmHue.${hue}700`, 'dark'), valueOf(`lmHue.${hue}50`, 'dark'));
      expect(ratio, `${hue} ink on ${hue} tint in dark mode is ${ratio.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(4.5);
    });
  });
});

describe('the shared components use the tokens', () => {
  const sample = (
    <>
      <SectionCard title="Marks" subtitle="out of 40">
        <Text color="lmFg.body">body</Text>
      </SectionCard>
      <StatTile label="Attempts" value={12} hint="this week" />
      <EmptyState title="Nothing yet" description="No coursework has been posted." />
      <Loading />
      <TimetableGrid
        days={['Monday']}
        slots={[{ key: 'period1', label: 'Period 1' }]}
        cells={{ 'Monday|period1': [{ subject: 'DSP', room: 'L-204' }] }}
      />
    </>
  );

  it('reaches for mode-aware variables, not the raw grey ramp', () => {
    const css = stylesheet(sample);

    /* Worth being precise about what this can catch. `bg="white"` does not compile
       to `#fff` — Chakra turns it into `var(--chakra-colors-white)`, a variable
       whose value is the same in both modes. So looking for frozen hex finds
       nothing and proves nothing; what identifies the bug is *which* variable a
       rule points at. A surface, text or border colour reaching straight into
       `--chakra-colors-white` or `--chakra-colors-gray-*` is a value that cannot
       move when the mode does. */
    const rules = css.match(/\.css-[\w-]+\{[^}]*\}/g) || [];
    const fixed = [];

    rules.forEach((rule) => {
      const declarations = rule.slice(rule.indexOf('{') + 1, -1).split(';');
      declarations.forEach((declaration) => {
        if (!/^(background|color|border(-\w+)?-color)\s*:/.test(declaration)) return;
        const ref = /var\(--chakra-colors-(white|black|gray-\d+)\)/.exec(declaration);
        if (ref) fixed.push(declaration.trim());
      });
    });

    expect(fixed, `mode-blind colours: ${fixed.join('\n')}`).toEqual([]);
  });
});

/* ─────────────────────────── the regression guard ──────────────────────────── */

/**
 * Literals that cannot survive a mode switch, and the token that replaces each.
 * Kept as a table rather than a regex so the failure message can say what to
 * write instead of only what is wrong.
 */
const BANNED = {
  'bg=white': 'lmBg.surface',
  'bg=gray.50': 'lmBg.sunken',
  'bg=gray.100': 'lmBg.track',
  'bg=gray.200': 'lmBorder.base',
  // Both of these are below AA as text. `muted` is the answer for anything with
  // words in it; a genuine mark — an icon, a spinner, a placeholder dash — takes
  // `lmFg.faint` instead.
  'color=gray.300': 'lmFg.muted',
  'color=gray.400': 'lmFg.muted',
  'color=gray.500': 'lmFg.muted',
  'color=gray.600': 'lmFg.subtle',
  'color=gray.700': 'lmFg.body',
  'color=gray.800': 'lmFg.heading',
  'color=gray.900': 'lmFg.heading',
  'borderColor=gray.100': 'lmBorder.subtle',
  'borderColor=gray.200': 'lmBorder.base',
  'borderColor=gray.300': 'lmBorder.strong',
};

/**
 * The colours that are deliberately fixed, with the reason each one is.
 *
 * An allow-list rather than a looser rule: "some greys are fine" is not
 * checkable, whereas a named exception is, and a second one appearing forces
 * whoever adds it to say why here.
 */
const ALLOWED = [
  // The bezel of a scope screen that is dark in both modes.
  { file: 'components/lab/ScopeView.jsx', literal: 'borderColor=gray.700' },
];

const PROPS = [
  'bg', 'background', 'backgroundColor', 'color', 'textColor',
  'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
];

describe('no light-only colour literals in the module', () => {
  it('has none outside the named exceptions', () => {
    const files = getAllFiles('src/learningModule');

    const re = new RegExp(`\\b(${PROPS.join('|')})=(?:"([^"{}]*)"|'([^'{}]*)'|\\{([^{}]*)\\})`, 'g');
    const found = [];

    for (const file of files) {
      // Comments stripped first. This file and theme.js both have to *name* the
      // literals they replace in order to explain themselves, and a guard that
      // cannot tell prose from code makes documenting the rule break the rule.
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      let m;
      while ((m = re.exec(src))) {
        const [, prop, dq, sq, expr] = m;
        // A hook is already choosing per mode inside this expression.
        if (expr !== undefined && expr.includes('useColorModeValue')) continue;
        const values = dq ?? sq
          ? [dq ?? sq]
          : [...(expr || '').matchAll(/'([^']+)'|"([^"]+)"/g)].map((q) => q[1] ?? q[2]);

        for (const value of values) {
          const key = `${prop}=${value}`;
          if (!BANNED[key]) continue;
          const short = file.replace('src/learningModule/', '');
          if (ALLOWED.some((a) => a.file === short && a.literal === key)) continue;
          found.push(`${short}: ${key} → use "${BANNED[key]}"`);
        }
      }
    }

    expect(found, `light-only colours found:\n${found.join('\n')}`).toEqual([]);
  });

  it('still catches one if it is added', () => {
    // Guards that cannot fail are worse than no guard, because they read as
    // coverage. This checks the table itself is wired to the props.
    const re = new RegExp(`\\b(${PROPS.join('|')})=(?:"([^"{}]*)")`, 'g');
    const sample = '<Text color="gray.500">hi</Text>';
    const hits = [...sample.matchAll(re)].map(([, prop, value]) => BANNED[`${prop}=${value}`]);
    expect(hits).toEqual(['lmFg.muted']);
  });
});
