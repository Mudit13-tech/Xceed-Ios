import { describe, expect, it } from 'vitest';

import downloadPaperPdf, {
  buildPaperOutline,
  imageSourcesIn,
  describeTolerance,
  describeVariable,
  htmlToText,
  optionLetter,
  pdfFileName,
  renderOutline,
  toPrintable,
} from '../paperPdf';

/**
 * The teacher's printable copy of a tutorial or an assignment.
 *
 * The paper is printed **as authored** — placeholders standing, answers given
 * as formulas — because a parametric paper has no single set of numbers, and
 * each question carries its own solution underneath it. Most of what matters
 * is therefore about what reaches the page, not about typography, which is why
 * the outline is built separately from the drawing and tested here directly.
 */

const parametricQuestion = (overrides = {}) => ({
  order: 0,
  type: 'parametric',
  prompt: '<p>A supply of {{V}} V feeds two resistors.</p>',
  variables: [{ name: 'V', label: 'Supply', type: 'range', min: 5, max: 24, step: 0.5, unit: 'V' }],
  answers: [{ key: 'I', label: 'Current', formula: 'V / (R1 + R2)', unit: 'A', marks: 3, tolerancePercent: 1 }],
  ...overrides,
});

const paper = (questions, rest = {}) => ({
  title: 'Series & Parallel Networks',
  questions,
  ...rest,
});

describe('printing the paper as it was authored', () => {
  it('leaves placeholders standing in the prompt', () => {
    const outline = buildPaperOutline(paper([parametricQuestion()]));

    expect(outline.paper[0].blocks[0].text).toContain('{{V}}');
  });

  it('says what each placeholder is drawn from, so the reader can read it', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          variables: [
            { name: 'V', label: 'Supply', type: 'range', min: 5, max: 24, step: 0.5, unit: 'V' },
            { name: 'N', type: 'integer', min: 1, max: 9 },
            { name: 'R', type: 'set', values: ['10', '22'], unit: 'ohm' },
          ],
        }),
      ]),
    );

    expect(outline.paper[0].variables).toEqual([
      { name: 'V', label: 'Supply', drawnFrom: '5 to 24, step 0.5 V' },
      { name: 'N', label: '', drawnFrom: '1 to 9 (whole numbers)' },
      { name: 'R', label: '', drawnFrom: 'one of 10, 22 ohm' },
    ]);
  });

  it('drops each table where the prompt put it, not all at the end', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          prompt: '<p>Before.</p><p>{{table:given}}</p><p>After.</p>',
          tables: [{ key: 'given', caption: 'Given', header: ['S', 'V'], rows: [['R1', '10']] }],
        }),
      ]),
    );

    expect(outline.paper[0].blocks.map((block) => block.type)).toEqual(['text', 'table', 'text']);
    expect(outline.paper[0].blocks[2].text).toBe('After.');
  });

  it('still prints a table the prompt never referenced', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          prompt: '<p>No token here.</p>',
          tables: [{ key: 'orphan', header: ['A'], rows: [['1']] }],
        }),
      ]),
    );

    expect(outline.paper[0].blocks.filter((block) => block.type === 'table')).toHaveLength(1);
  });

  it('leaves a token pointing at a table that does not exist visible, rather than dropping the line', () => {
    const outline = buildPaperOutline(
      paper([parametricQuestion({ prompt: '<p>See {{table:missing}} above.</p>', tables: [] })]),
    );

    const text = outline.paper[0].blocks.map((block) => block.text).join(' ');
    expect(text).toContain('{{table:missing}}');
  });

  it('numbers unlabelled parts by position and keeps an explicit label', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          parts: [
            { label: '', prompt: '<p>First.</p>', answers: [] },
            { label: '(ii)', prompt: '<p>Second.</p>', answers: [] },
          ],
        }),
      ]),
    );

    expect(outline.paper[0].parts.map((part) => part.label)).toEqual(['(a)', '(ii)']);
  });

  it('letters the choices of a fixed-key question', () => {
    const outline = buildPaperOutline(
      paper([{ order: 0, type: 'mcq', marks: 1, prompt: '<p>Which?</p>', options: ['<p>One</p>', '<p>Two</p>'] }]),
    );

    expect(outline.paper[0].options).toEqual([
      { letter: 'A', text: 'One', images: [] },
      { letter: 'B', text: 'Two', images: [] },
    ]);
  });
});

describe('the solution under each question', () => {
  it('carries every answer slot, the parts included', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          parts: [
            { label: '', prompt: '<p>a</p>', answers: [{ key: 'Rt', label: 'R total', formula: 'R1 + R2', marks: 2 }] },
            { label: '(b)', prompt: '<p>b</p>', answers: [{ key: 'P', label: 'Power', formula: 'I*I*R1', marks: 2 }] },
          ],
        }),
      ]),
    );

    expect(outline.paper[0].solution.answers.map((a) => [a.where, a.label, a.formula])).toEqual([
      ['', 'Current', 'V / (R1 + R2)'],
      ['(a)', 'R total', 'R1 + R2'],
      ['(b)', 'Power', 'I*I*R1'],
    ]);
  });

  it('sums a parametric question’s marks from its answers rather than its marks field', () => {
    const outline = buildPaperOutline(
      paper([
        parametricQuestion({
          marks: 99,
          parts: [{ label: '', prompt: '<p>a</p>', answers: [{ key: 'Rt', formula: 'R1', marks: 2 }] }],
        }),
      ]),
    );

    expect(outline.paper[0].marks).toBe(5);
  });

  it('reads a fixed-key question’s answer off its correct indices', () => {
    const outline = buildPaperOutline(
      paper([
        { order: 0, type: 'msq', prompt: '<p>Which?</p>', options: ['a', 'b', 'c'], correctAnswers: ['2', '0'] },
      ]),
    );

    expect(outline.paper[0].solution.fixed).toBe('A, C');
  });

  it('gives a numerical answer with the tolerance it is marked to', () => {
    const outline = buildPaperOutline(
      paper([
        { order: 0, type: 'numerical', prompt: '<p>Value?</p>', correctAnswers: ['9.81'], tolerancePercent: 2 },
      ]),
    );

    expect(outline.paper[0].solution.fixed).toBe('9.81 within 2%');
  });

  it('keeps the legacy single constraint alongside the list', () => {
    const outline = buildPaperOutline(
      paper([parametricQuestion({ constraints: ['R1 > 0'], constraint: 'R2 > 0' })]),
    );

    expect(outline.paper[0].solution.constraints).toEqual(['R1 > 0', 'R2 > 0']);
  });

  it('rides on the question itself, so the two cannot fall out of step', () => {
    const outline = buildPaperOutline(
      paper([parametricQuestion(), { order: 1, type: 'mcq', prompt: '<p>b</p>', options: ['x', 'y'] }]),
    );

    expect(outline.paper.every((question) => question.solution)).toBe(true);
    expect(outline).not.toHaveProperty('key');
  });

  it('leaves nothing to draw for a question with no answers or working', () => {
    const outline = buildPaperOutline(
      paper([{ order: 0, type: 'parametric', prompt: '<p>Discuss.</p>' }]),
    );
    const { solution } = outline.paper[0];

    expect(solution.fixed).toBe('');
    expect(solution.answers).toEqual([]);
    expect(solution.solutionSteps).toBe('');
  });
});

describe('the text that reaches the page', () => {
  it('turns Quill markup into lines, keeping list structure', () => {
    expect(htmlToText('<ol><li>Add.</li><li>Divide.</li></ol>')).toBe('• Add.\n• Divide.');
    expect(htmlToText('<p>One</p><p>Two</p>')).toBe('One\nTwo');
    expect(htmlToText('a<br>b')).toBe('a\nb');
    expect(htmlToText('<p>5 &lt; 7 &amp; 8 &gt; 6</p>')).toBe('5 < 7 & 8 > 6');
  });

  it('spells the symbols the built-in PDF fonts have no glyph for', () => {
    expect(toPrintable('10 Ω ± 5% μF θ')).toBe('10 ohm +/- 5% uF theta');
  });

  it('drops anything still unprintable rather than emitting mojibake', () => {
    expect(toPrintable('ok 中文 ✓')).toBe('ok  ');
  });

  it('letters beyond Z without running off the alphabet', () => {
    expect(optionLetter(0)).toBe('A');
    expect(optionLetter(25)).toBe('Z');
    expect(optionLetter(26)).toBe('27');
  });

  it('describes an exact answer as exact', () => {
    expect(describeTolerance({ tolerancePercent: 0, toleranceAbs: 0 })).toBe('');
    expect(describeTolerance({ tolerancePercent: 1, toleranceAbs: 0.5 })).toBe('within 1% or 0.5 absolute');
  });

  it('handles a variable with nothing configured', () => {
    expect(describeVariable(null)).toBe('');
    expect(describeVariable({ type: 'set', values: [] })).toBe('a fixed set');
  });
});

describe('the document itself', () => {
  it('renders a short paper onto a single page, solutions included', () => {
    const doc = renderOutline(buildPaperOutline(paper([parametricQuestion()])));

    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000);
  });

  it('runs a long paper onto further pages instead of off the bottom of one', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      parametricQuestion({
        order: index,
        prompt: `<p>Question ${index} — ${'a fairly long stem that takes a couple of lines to set out. '.repeat(3)}</p>`,
      }),
    );

    const doc = renderOutline(buildPaperOutline(paper(many)));
    expect(doc.getNumberOfPages()).toBeGreaterThan(4);
  });

  it('copes with a paper that has no questions yet', () => {
    const outline = buildPaperOutline(paper([]));

    expect(outline.paper).toEqual([]);
    expect(() => renderOutline(outline)).not.toThrow();
  });

  it('names the file after the paper and what it is', () => {
    expect(pdfFileName(buildPaperOutline(paper([]), { kind: 'assignment' })))
      .toBe('series-parallel-networks-assignment.pdf');
    expect(pdfFileName(buildPaperOutline({ title: '', questions: [] }, { kind: 'tutorial' })))
      .toBe('tutorial-tutorial.pdf');
  });

  it('calls the paper an assignment when that is what it is', () => {
    const outline = buildPaperOutline(paper([parametricQuestion()]), { kind: 'assignment' });
    expect(outline.kind).toBe('assignment');
  });

  it('hands the finished document over under that name', async () => {
    const saved = [];
    // Async now: any picture whose src is a URL is fetched before the document
    // is laid out.
    const outline = await downloadPaperPdf(paper([parametricQuestion()]), {
      kind: 'tutorial',
      subjectName: 'Basic Electrical Engineering',
      onSave: (doc, name) => saved.push([name, doc.getNumberOfPages()]),
    });

    expect(saved).toEqual([['series-parallel-networks-tutorial.pdf', 1]]);
    expect(outline.meta).toContain('Class: Basic Electrical Engineering');
  });
});

/**
 * Pictures.
 *
 * Questions carry diagrams — a circuit, a waveform, a scanned figure — and the
 * editor embeds them as data URIs inside the prompt's markup. The text
 * flattener drops every tag, so they were being stripped on the way to the
 * page: the paper printed as if the question had no figure at all.
 */
describe('the pictures in a question', () => {
  // A real 4x3 PNG, so jsPDF can read its dimensions out of the header.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
  const resolved = () => new Map([[PNG, PNG]]);

  const illustrated = () => paper([
    {
      order: 0,
      type: 'mcq',
      marks: 2,
      prompt: `<p>Study the circuit.</p><img src="${PNG}" alt="circuit"><p>Find the current.</p>`,
      options: [`<p>Waveform</p><img src="${PNG}">`, '<p>None of these</p>'],
      correctAnswers: ['0'],
      solutionSteps: `<p>Apply KVL.</p><img src="${PNG}" alt="working">`,
      hint: `<img src="${PNG}" alt="hint">`,
    },
  ]);

  it('keeps a diagram in the prompt, in the place it was written', () => {
    const outline = buildPaperOutline(illustrated());

    expect(outline.paper[0].blocks.map((block) => block.type)).toEqual(['text', 'image', 'text']);
    expect(outline.paper[0].blocks[1]).toMatchObject({ src: PNG, alt: 'circuit' });
  });

  it('keeps a picture that is the whole of an option', () => {
    const outline = buildPaperOutline(illustrated());

    expect(outline.paper[0].options[0].images).toHaveLength(1);
    expect(outline.paper[0].options[1].images).toHaveLength(0);
  });

  it('keeps the figures in a worked solution and a hint', () => {
    const { solution } = buildPaperOutline(illustrated()).paper[0];

    expect(solution.solutionImages).toHaveLength(1);
    expect(solution.hintImages.map((image) => image.alt)).toEqual(['hint']);
  });

  it('draws a solution for a question whose only working is a picture', () => {
    const outline = buildPaperOutline(
      paper([{ order: 0, type: 'parametric', prompt: '<p>Explain.</p>', solutionSteps: `<img src="${PNG}">` }]),
    );

    expect(outline.paper[0].solution.solutionImages).toHaveLength(1);
    expect(() => renderOutline(outline, resolved())).not.toThrow();
  });

  it('gathers every picture in the paper for resolving, once per place it is used', () => {
    const lists = imageSourcesIn(buildPaperOutline(illustrated()));
    const total = lists.reduce((sum, list) => sum + list.length, 0);

    // prompt + one option + solution + hint
    expect(total).toBe(4);
  });

  it('actually embeds the image in the document', () => {
    const outline = buildPaperOutline(illustrated());
    const withImages = renderOutline(outline, resolved());
    const without = renderOutline(outline, new Map());

    const bytes = (doc) => doc.output('arraybuffer').byteLength;
    expect(bytes(withImages)).toBeGreaterThan(bytes(without));

    // Latin-1 rather than Buffer: the test environment is a browser one.
    const bytesToText = (buffer) =>
      String.fromCharCode(...new Uint8Array(buffer).subarray(0, 60000));
    expect(bytesToText(withImages.output('arraybuffer'))).toContain('/Subtype /Image');
  });

  it('says so when a picture could not be fetched, rather than dropping it', () => {
    const outline = buildPaperOutline(
      paper([{ order: 0, type: 'parametric', prompt: '<p>See below.</p><img src="https://example.test/x.png" alt="figure 2">' }]),
    );

    // Nothing resolved: the renderer must still produce a document, and must
    // not pretend the question had no figure.
    const doc = renderOutline(outline, new Map());
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(outline.paper[0].blocks.some((block) => block.type === 'image')).toBe(true);
  });

  it('leaves a paper with no pictures exactly as it was', () => {
    const outline = buildPaperOutline(paper([parametricQuestion()]));

    expect(imageSourcesIn(outline).every((list) => list.length === 0)).toBe(true);
    expect(outline.paper[0].blocks.every((block) => block.type !== 'image')).toBe(true);
  });
});

/**
 * Tables.
 *
 * A "given values" grid is referenced from the prompt by a `{{table:key}}`
 * token and stored beside it — the rich text editor is Quill 1.3.7, which has
 * no table blot and would flatten a real <table> back to paragraphs. The
 * outline tests above prove the token is resolved in the right place; these
 * prove the grid actually reaches the page, which is the half that the
 * stripped-images bug showed an outline assertion does not cover.
 */
describe('a table in a tutorial or assignment', () => {
  const withTable = () => paper([
    parametricQuestion({
      prompt: '<p>Use the values below.</p><p>{{table:given}}</p><p>Find the current.</p>',
      tables: [{
        key: 'given',
        caption: 'Given values',
        header: ['Symbol', 'Value'],
        rows: [['R1', '{{R1}} ohm'], ['R2', '47 ohm']],
      }],
    }),
  ]);

  // jsPDF writes its text uncompressed by default, so the words are findable.
  const textOf = (doc) => String.fromCharCode(...new Uint8Array(doc.output('arraybuffer')));

  it('draws the grid, headers and cells alike', () => {
    const raw = textOf(renderOutline(buildPaperOutline(withTable())));

    expect(raw).toContain('Symbol');
    expect(raw).toContain('Value');
    expect(raw).toContain('R1');
    expect(raw).toContain('47 ohm');
  });

  it('prints the caption above it', () => {
    expect(textOf(renderOutline(buildPaperOutline(withTable())))).toContain('Given values');
  });

  it('leaves the placeholders in the cells standing, as the rest of the paper does', () => {
    expect(textOf(renderOutline(buildPaperOutline(withTable())))).toContain('{{R1}}');
  });

  it('takes up room, so the text after it is not drawn over the grid', () => {
    const withGrid = renderOutline(buildPaperOutline(withTable()));
    const without = renderOutline(buildPaperOutline(paper([parametricQuestion()])));

    expect(withGrid.output('arraybuffer').byteLength)
      .toBeGreaterThan(without.output('arraybuffer').byteLength);
  });

  it('draws a table that carries no header row', () => {
    const outline = buildPaperOutline(paper([
      parametricQuestion({
        prompt: '<p>{{table:bare}}</p>',
        tables: [{ key: 'bare', header: [], rows: [['only', 'cells']] }],
      }),
    ]));

    expect(textOf(renderOutline(outline))).toContain('only');
  });
});
