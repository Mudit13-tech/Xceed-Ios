import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import { richTextBlocks } from './richTextUtils';
import { fitImage, resolveImages } from './utils/pdfImages';

/**
 * A tutorial or an assignment, as a PDF a teacher can print.
 *
 * Serves both, from one builder, for the same reason PaperPreviewModal does:
 * their question schemas are identical, and two copies would drift.
 *
 * It prints the paper **as authored** — `{{R1}}` placeholders left standing and
 * the answers given as formulas — not one student's drawn numbers. A
 * parametric paper has no single set of numbers, so a sheet showing one
 * student's would be a sheet no other student sat; the authored version is the
 * one thing that is true for all of them, and it is what a teacher proof-reads,
 * files and hands to a colleague. The variables each question draws are listed
 * under it, so a reader knows what `{{R1}}` stands for and the range it is
 * drawn from.
 *
 * It reads straight through: each question is followed by its own solution —
 * working, answer table, worked steps, hint and constraints — rather than by a
 * separate key at the back, so whoever is marking has the explanation beside
 * the question it belongs to. That puts the answers on every page, which is
 * why the document says it is staff-only at the top and again in every footer.
 */

/* ── text ─────────────────────────────────────────────────────────────── */

/**
 * jsPDF's built-in fonts are WinAnsi: they have no glyph for Ω, μ, θ and the
 * rest of the set an engineering paper is written in, and render them as
 * mojibake rather than failing. Embedding a Unicode font would add a megabyte
 * to every download for a handful of symbols, so the symbols are spelled
 * instead — "ohm" is readable on a printed sheet in a way that a black
 * diamond is not.
 */
const SYMBOLS = [
  [/[ΩΩ]/g, 'ohm'],
  [/µ|μ/g, 'u'],
  [/°/g, 'deg'],
  [/±/g, '+/-'],
  [/×/g, 'x'],
  [/÷/g, '/'],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/≠/g, '!='],
  [/≈/g, '~='],
  [/√/g, 'sqrt'],
  [/∞/g, 'infinity'],
  [/→/g, '->'],
  [/←/g, '<-'],
  [/α/g, 'alpha'],
  [/β/g, 'beta'],
  [/γ/g, 'gamma'],
  [/Δ/g, 'delta'],
  [/δ/g, 'delta'],
  [/θ/g, 'theta'],
  [/λ/g, 'lambda'],
  [/π/g, 'pi'],
  [/ρ/g, 'rho'],
  [/σ/g, 'sigma'],
  [/φ|ϕ/g, 'phi'],
  [/ω/g, 'omega'],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, '-'],
  [/…/g, '...'],
  [/\u00a0/g, ' '],
];

/** Anything still outside Latin-1 after the table above would render as noise. */
export const toPrintable = (value) => {
  let text = String(value ?? '');
  SYMBOLS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x09\x0a\x20-\xff]/g, '');
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ',
};

/**
 * Quill's HTML down to plain text, keeping the line structure that carries
 * meaning: paragraphs and <br> become breaks, list items become bullets.
 * Placeholders are just characters, so `{{R1}}` survives untouched — which is
 * the whole point of printing the authored version.
 */
export const htmlToText = (html) => {
  const source = String(html ?? '');
  if (!source) return '';

  const text = source
    .replace(/<\s*(br|BR)\s*\/?\s*>/g, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\s*\/\s*li\s*>/gi, '\n')
    .replace(/<\s*\/\s*(td|th)\s*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (match, name) => (name in ENTITIES ? ENTITIES[name] : match));

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** "A" for 0, "B" for 1 — how a choice reads on a mark sheet. */
export const optionLetter = (index) =>
  (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));

/** "(a)", "(b)" … derived from position when a part carries no label of its own. */
const partLabel = (part, index) => part?.label?.trim() || `(${String.fromCharCode(97 + index)})`;

/** What a variable is drawn from, in one line: "1 to 10, step 0.5 (ohm)". */
export const describeVariable = (variable) => {
  if (!variable) return '';
  const unit = variable.unit ? ` ${variable.unit}` : '';
  if (variable.type === 'set') {
    const values = (variable.values || []).filter((v) => String(v).trim() !== '');
    return values.length ? `one of ${values.join(', ')}${unit}` : `a fixed set${unit}`;
  }
  const step = Number(variable.step) > 0 ? `, step ${variable.step}` : '';
  const kind = variable.type === 'integer' ? ' (whole numbers)' : '';
  return `${variable.min} to ${variable.max}${step}${kind}${unit}`;
};

/** The tolerance an answer is marked to, or '' when it is exact. */
export const describeTolerance = (answer) => {
  const percent = Number(answer?.tolerancePercent) || 0;
  const absolute = Number(answer?.toleranceAbs) || 0;
  const parts = [];
  if (percent) parts.push(`${percent}%`);
  if (absolute) parts.push(`${absolute} absolute`);
  return parts.length ? `within ${parts.join(' or ')}` : '';
};

/* ── outline ──────────────────────────────────────────────────────────── */

/**
 * A prompt split around its `{{table:key}}` tokens, so the tables land where
 * the teacher put them rather than all at the end. Anything a token points at
 * but does not exist is left as written — better a visible token than silently
 * dropping the line that referenced it.
 */
const promptBlocks = (prompt, tables) => {
  const byKey = new Map((tables || []).map((table) => [String(table.key), table]));
  const blocks = [];
  const seenTables = new Set();

  const pushText = (text) => {
    // A text run still has to be split around its {{table:key}} tokens so the
    // tables land where the teacher put them.
    const pattern = /\{\{\s*table\s*:\s*([^}\s]+)\s*\}\}/g;
    let cursor = 0;
    let match = pattern.exec(text);
    while (match) {
      const before = text.slice(cursor, match.index).trim();
      if (before) blocks.push({ type: 'text', text: before });
      const table = byKey.get(match[1]);
      if (table) {
        blocks.push({ type: 'table', table });
        seenTables.add(table);
      } else {
        // Better a visible token than silently dropping the line that
        // referenced a table that is not there.
        blocks.push({ type: 'text', text: match[0] });
      }
      cursor = match.index + match[0].length;
      match = pattern.exec(text);
    }
    const rest = text.slice(cursor).trim();
    if (rest) blocks.push({ type: 'text', text: rest });
  };

  /* Images first, so a diagram keeps its place in the prompt rather than being
     stripped with the rest of the markup — see richTextBlocks. */
  richTextBlocks(prompt).forEach((block) => {
    if (block.type === 'image') blocks.push({ type: 'image', src: block.src, alt: block.alt });
    else pushText(block.text);
  });

  // A table the prompt never referenced is still part of the question.
  (tables || []).forEach((table) => {
    if (!seenTables.has(table)) blocks.push({ type: 'table', table });
  });

  return blocks;
};

/** The pictures in a piece of rich text, in the order they appear. */
const imagesIn = (html) =>
  richTextBlocks(html)
    .filter((block) => block.type === 'image')
    .map((block) => ({ src: block.src, alt: block.alt }));

/** Every answer slot on a question, parts included, flattened for its solution. */
const answerRows = (question) => {
  const rows = [];
  const push = (answer, where) => {
    rows.push({
      where,
      label: answer.label || answer.key || '',
      formula: answer.formula || '',
      unit: answer.unit || '',
      marks: Number(answer.marks) || 0,
      tolerance: describeTolerance(answer),
    });
  };

  (question.answers || []).forEach((answer) => push(answer, ''));
  (question.parts || []).forEach((part, index) => {
    (part.answers || []).forEach((answer) => push(answer, partLabel(part, index)));
  });
  return rows;
};

/** What a question with a fixed answer expects, for its solution block. */
const fixedAnswer = (question) => {
  if (question.type === 'mcq' || question.type === 'msq') {
    const indices = (question.correctAnswers || [])
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0)
      .sort((a, b) => a - b);
    return indices.length ? indices.map(optionLetter).join(', ') : '—';
  }
  if (question.type === 'numerical') {
    const expected = (question.correctAnswers || [])[0];
    const tolerance = describeTolerance(question);
    return [expected ?? '—', tolerance].filter(Boolean).join(' ');
  }
  return '';
};

const questionMarks = (question) => {
  if (question.type !== 'parametric') return Number(question.marks) || 0;
  return answerRows(question).reduce((sum, row) => sum + row.marks, 0);
};

/**
 * The whole document as structured blocks, before any of it is drawn.
 *
 * Separated from the rendering so what goes on the page can be tested without
 * parsing a PDF back out — the questions that matter (does a placeholder
 * survive? does the key carry every part's answers?) are questions about this,
 * not about typography.
 */
export function buildPaperOutline(item, { kind = 'tutorial', subjectName = '' } = {}) {
  const questions = [...(item?.questions || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  const totalMarks =
    Number(item?.totalMarks) || questions.reduce((sum, q) => sum + questionMarks(q), 0);

  const meta = [
    subjectName ? `Class: ${subjectName}` : '',
    `${questions.length} question${questions.length === 1 ? '' : 's'}`,
    totalMarks ? `${totalMarks} mark${totalMarks === 1 ? '' : 's'}` : '',
    item?.topicName ? `Topic: ${item.topicName}` : '',
  ].filter(Boolean);

  const solutionFor = (question) => ({
    answers: answerRows(question),
    fixed: fixedAnswer(question),
    solutionVariables: (question.solutionVariables || []).map((variable) => ({
      name: variable.name,
      formula: variable.formula,
      unit: variable.unit || '',
    })),
    constraints: [...(question.constraints || []), question.constraint]
      .filter((entry) => String(entry || '').trim() !== ''),
    hint: htmlToText(question.hint),
    hintImages: imagesIn(question.hint),
    solutionSteps: htmlToText(question.solutionSteps),
    // A worked solution is where a diagram most often lives.
    solutionImages: imagesIn(question.solutionSteps),
  });

  const paper = questions.map((question, index) => ({
    number: index + 1,
    marks: questionMarks(question),
    type: question.type || 'parametric',
    topic: question.topic || '',
    blocks: promptBlocks(question.prompt, question.tables),
    parts: (question.parts || []).map((part, partIndex) => ({
      label: partLabel(part, partIndex),
      text: htmlToText(part.prompt),
      images: imagesIn(part.prompt),
    })),
    options: (question.options || []).map((option, optionIndex) => ({
      letter: optionLetter(optionIndex),
      text: htmlToText(option),
      // An option is often a picture on its own — a waveform, a circuit.
      images: imagesIn(option),
    })),
    variables: (question.variables || []).map((variable) => ({
      name: variable.name,
      label: variable.label || '',
      drawnFrom: describeVariable(variable),
    })),
    solution: solutionFor(question),
  }));

  return {
    kind,
    title: item?.title || (kind === 'assignment' ? 'Assignment' : 'Tutorial'),
    description: htmlToText(item?.description),
    meta,
    paper,
  };
}

/* ── rendering ────────────────────────────────────────────────────────── */

const PAGE = { margin: 48, width: 595.28, height: 841.89 };
const BODY_WIDTH = PAGE.width - PAGE.margin * 2;

/** A cursor that knows how to start a new page before it runs off this one. */
function layout(doc) {
  let y = PAGE.margin;

  const room = (needed) => {
    if (y + needed <= PAGE.height - PAGE.margin) return;
    doc.addPage();
    y = PAGE.margin;
  };

  return {
    get y() { return y; },
    set y(value) { y = value; },
    room,
    gap(amount) { y += amount; },
    text(value, { size = 10, style = 'normal', indent = 0, colour = [17, 24, 28], leading = 1.35 } = {}) {
      const printable = toPrintable(value);
      if (!printable) return;
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...colour);
      const lines = doc.splitTextToSize(printable, BODY_WIDTH - indent);
      const lineHeight = size * leading;
      lines.forEach((line) => {
        room(lineHeight);
        doc.text(line, PAGE.margin + indent, y + size * 0.85);
        y += lineHeight;
      });
    },
    image(entry, images, indent = 0) {
      const dataUri = images?.get(entry.src);
      if (!dataUri) {
        // Said out loud rather than dropped: a teacher proof-reading a paper
        // needs to know a diagram did not make it into the file.
        this.text(
          entry.alt ? `[image: ${entry.alt} — could not be loaded]` : '[image could not be loaded]',
          { size: 8, style: 'italic', colour: WARN, indent },
        );
        return;
      }
      let natural;
      try {
        natural = doc.getImageProperties(dataUri);
      } catch {
        this.text('[image could not be read]', { size: 8, style: 'italic', colour: WARN, indent });
        return;
      }
      const { width, height } = fitImage(natural, { maxWidth: BODY_WIDTH - indent });
      const drawHeight = height || 120;
      room(drawHeight + 8);
      try {
        doc.addImage(dataUri, PAGE.margin + indent, y + 4, width, drawHeight);
      } catch {
        this.text('[image could not be drawn]', { size: 8, style: 'italic', colour: WARN, indent });
        return;
      }
      y += drawHeight + 8;
    },
    rule() {
      room(12);
      doc.setDrawColor(210, 214, 210);
      doc.line(PAGE.margin, y + 4, PAGE.width - PAGE.margin, y + 4);
      y += 12;
    },
    table(config) {
      room(60);
      doc.autoTable({
        startY: y,
        margin: { left: PAGE.margin, right: PAGE.margin },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: [17, 24, 28] },
        headStyles: { fillColor: [237, 239, 234], textColor: [17, 24, 28], fontStyle: 'bold' },
        ...config,
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 10;
    },
  };
}

const MUTED = [90, 99, 102];
const ACCENT = [23, 86, 92];
const WARN = [146, 64, 14];

function drawQuestion(view, question, images) {
  view.room(40);
  const heading = [
    `Question ${question.number}`,
    question.marks ? `[${question.marks} mark${question.marks === 1 ? '' : 's'}]` : '',
  ].filter(Boolean).join('  ');
  view.text(heading, { size: 11, style: 'bold' });
  if (question.topic) view.text(question.topic, { size: 8, colour: MUTED });
  view.gap(2);

  question.blocks.forEach((block) => {
    if (block.type === 'text') {
      view.text(block.text, { size: 10 });
      view.gap(3);
      return;
    }
    if (block.type === 'image') {
      view.image(block, images);
      return;
    }
    const { table } = block;
    if (table.caption) view.text(table.caption, { size: 9, style: 'italic', colour: MUTED });
    view.table({
      head: table.header?.length ? [table.header.map(toPrintable)] : undefined,
      body: (table.rows || []).map((row) => row.map(toPrintable)),
    });
  });

  question.parts.forEach((part) => {
    view.gap(2);
    view.text(`${part.label} ${part.text}`, { size: 10, indent: 14 });
    (part.images || []).forEach((entry) => view.image(entry, images, 14));
  });

  if (question.options.length) {
    view.gap(3);
    question.options.forEach((option) => {
      view.text(`${option.letter}.  ${option.text}`, { size: 10, indent: 14 });
      (option.images || []).forEach((entry) => view.image(entry, images, 22));
    });
  }

  if (question.variables.length) {
    view.gap(4);
    view.text('Values drawn per student', { size: 8, style: 'bold', colour: MUTED });
    question.variables.forEach((variable) => {
      const name = variable.label ? `{{${variable.name}}} — ${variable.label}` : `{{${variable.name}}}`;
      view.text(`${name}: ${variable.drawnFrom}`, { size: 9, indent: 14, colour: MUTED });
    });
  }

  drawSolution(view, question.solution, images);

  view.gap(6);
  view.rule();
}

function drawSolution(view, entry, images) {
  const hasAnything = entry.fixed
    || entry.answers.length
    || entry.solutionVariables.length
    || entry.solutionSteps
    || entry.solutionImages?.length
    || entry.hint
    || entry.hintImages?.length
    || entry.constraints.length;
  if (!hasAnything) return;

  view.gap(3);
  view.text('Solution', { size: 9, style: 'bold', colour: ACCENT, indent: 8 });

  if (entry.fixed) {
    view.text(`Correct answer: ${entry.fixed}`, { size: 10, indent: 18 });
  }

  if (entry.solutionVariables.length) {
    view.gap(1);
    view.text('Working', { size: 8, style: 'bold', colour: MUTED, indent: 18 });
    entry.solutionVariables.forEach((variable) => {
      const unit = variable.unit ? ` ${variable.unit}` : '';
      view.text(`${variable.name} = ${variable.formula}${unit}`, { size: 9, indent: 28 });
    });
  }

  if (entry.answers.length) {
    view.gap(2);
    view.table({
      head: [['Answer', 'Formula', 'Unit', 'Marks', 'Accepted']],
      body: entry.answers.map((answer) => [
        toPrintable([answer.where, answer.label].filter(Boolean).join(' ')),
        toPrintable(answer.formula),
        toPrintable(answer.unit),
        String(answer.marks || ''),
        toPrintable(answer.tolerance || 'exact'),
      ]),
      columnStyles: { 1: { cellWidth: 170 }, 3: { halign: 'right', cellWidth: 40 } },
      margin: { left: PAGE.margin + 18, right: PAGE.margin },
    });
  }

  if (entry.solutionSteps || entry.solutionImages?.length) {
    view.text('Worked solution', { size: 8, style: 'bold', colour: MUTED, indent: 18 });
    view.text(entry.solutionSteps, { size: 9, indent: 28 });
    (entry.solutionImages || []).forEach((image) => view.image(image, images, 28));
    view.gap(2);
  }

  if (entry.hint || entry.hintImages?.length) {
    view.text('Hint shown to students', { size: 8, style: 'bold', colour: MUTED, indent: 18 });
    view.text(entry.hint, { size: 9, indent: 28 });
    (entry.hintImages || []).forEach((image) => view.image(image, images, 28));
    view.gap(2);
  }

  if (entry.constraints.length) {
    view.text('Values are only accepted when', { size: 8, style: 'bold', colour: MUTED, indent: 18 });
    entry.constraints.forEach((constraint) => {
      view.text(constraint, { size: 9, indent: 28, colour: MUTED });
    });
  }
}

/** The outline, drawn. Returns the jsPDF document rather than saving it. */
export function renderOutline(outline, images = new Map()) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const view = layout(doc);

  const label = outline.kind === 'assignment' ? 'Assignment' : 'Tutorial';
  view.text(label.toUpperCase(), { size: 8, style: 'bold', colour: MUTED });
  view.text(outline.title, { size: 17, style: 'bold' });
  if (outline.meta.length) view.text(outline.meta.join('  ·  '), { size: 9, colour: MUTED });
  if (outline.description) {
    view.gap(4);
    view.text(outline.description, { size: 10 });
  }
  view.gap(6);
  /* Said at the top, and again in the footer of every page, because this
     document carries the answers next to the questions: a teacher who prints
     it and hands it round has handed out the solutions. It is the first thing
     a reader needs to know about the file, so it is not left to a heading
     halfway down. */
  view.text('Contains solutions — not for circulation to students.', {
    size: 9, style: 'bold', colour: ACCENT,
  });
  view.text(
    'Printed as authored: {{name}} marks a value drawn separately for each student, so the numbers on a student’s paper will differ from these.',
    { size: 8, style: 'italic', colour: MUTED },
  );
  view.gap(4);
  view.rule();

  if (!outline.paper.length) {
    view.text('This paper has no questions yet.', { size: 10, colour: MUTED });
  }
  outline.paper.forEach((question) => drawQuestion(view, question, images));

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      toPrintable(`${outline.title} — ${label} · contains solutions`),
      PAGE.margin,
      PAGE.height - PAGE.margin + 18,
    );
    doc.text(
      `Page ${page} of ${pages}`,
      PAGE.width - PAGE.margin,
      PAGE.height - PAGE.margin + 18,
      { align: 'right' },
    );
  }

  return doc;
}

/** Filesystem-safe, and recognisable in a downloads folder. */
export const pdfFileName = (outline) => {
  const slug = toPrintable(outline.title)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return `${slug || outline.kind}-${outline.kind === 'assignment' ? 'assignment' : 'tutorial'}.pdf`;
};

/**
 * Build and hand the file to the browser.
 *
 * `onSave` takes the finished document and its name instead of downloading it —
 * for a caller that wants the bytes (a preview, an attachment) rather than a
 * file in the downloads folder, and for tests, since jsPDF's own `save` is an
 * own property of each instance and really does write a file under jsdom.
 */
/** Every picture the outline refers to, as the block lists resolveImages wants. */
export const imageSourcesIn = (outline) => {
  const lists = [];
  (outline?.paper || []).forEach((question) => {
    lists.push((question.blocks || []).filter((block) => block.type === 'image'));
    (question.parts || []).forEach((part) => lists.push(part.images || []));
    (question.options || []).forEach((option) => lists.push(option.images || []));
    lists.push(question.solution?.solutionImages || []);
    lists.push(question.solution?.hintImages || []);
  });
  return lists.map((list) => list.map((entry) => ({ type: 'image', src: entry.src })));
};

export default async function downloadPaperPdf(item, { onSave, ...options } = {}) {
  const outline = buildPaperOutline(item, options);
  /* Resolved before anything is drawn: jsPDF's addImage wants bytes, and a
     picture whose src is a URL has to be fetched first. Failures come back
     absent from the map and are printed as a missing-image line rather than
     dropped — see pdfImages.js. */
  const images = await resolveImages(imageSourcesIn(outline));
  const doc = renderOutline(outline, images);
  const name = pdfFileName(outline);
  if (onSave) onSave(doc, name);
  else doc.save(name);
  return outline;
}
