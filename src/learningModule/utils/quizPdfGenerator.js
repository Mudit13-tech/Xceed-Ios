import pdfMakeInitializer from '../../filedownload/pdfMakeInitializer';
import { richTextBlocks, richTextToPlain } from '../richTextUtils';
import { resolveImages } from './pdfImages';

pdfMakeInitializer();

/** A4 minus pdfmake's 40pt page margins — the width an image has to fit. */
const CONTENT_WIDTH = 515;

/**
 * Formats correct answers for display in the PDF document.
 */
function formatCorrectAnswers(q) {
  if (!q.correctAnswers || q.correctAnswers.length === 0) {
    return 'Not specified';
  }

  if (q.type === 'numerical') {
    let ans = q.correctAnswers.join(', ');
    if (q.toleranceAbs > 0 || q.tolerancePercent > 0) {
      const tol = q.toleranceAbs > 0 ? `±${q.toleranceAbs}` : `±${q.tolerancePercent}%`;
      ans += ` (${tol})`;
    }
    return ans;
  }

  if (q.type === 'truefalse') {
    const val = String(q.correctAnswers[0]).toLowerCase();
    return val === '0' || val === 'true' ? 'True' : 'False';
  }

  // MCQ / MSQ: correctAnswers contain 0-based option indices
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const formatted = q.correctAnswers
    .map((ansIdxStr) => {
      const idx = Number(ansIdxStr);
      if (Number.isInteger(idx) && q.options && q.options[idx] !== undefined) {
        const letter = optionLetters[idx] || `${idx + 1}`;
        return `(${letter}) ${richTextToPlain(q.options[idx])}`;
      }
      return ansIdxStr;
    })
    .join('; ');

  return formatted || 'Not specified';
}

/**
 * Generates and triggers download of the Quiz PDF.
 * @param {Object} quizData Quiz payload returned by exportQuestions endpoint.
 * @param {boolean} withAnswers Whether to include answer keys and explanations.
 */
export async function generateQuizPdf(quizData, withAnswers = false) {
  const pdfMake = globalThis.pdfMake;
  if (!pdfMake) {
    throw new Error('PDF generator library is not initialized.');
  }

  /* Every picture in the paper, fetched once, before anything is laid out.
     pdfmake cannot take a URL in the browser, so an image has to be bytes by
     the time the document definition mentions it — see pdfImages.js. */
  const questions = quizData.questions || [];
  const imageBlocks = [];
  questions.forEach((q) => {
    imageBlocks.push(richTextBlocks(q.question));
    (q.options || []).forEach((option) => imageBlocks.push(richTextBlocks(option)));
    if (q.explanation) imageBlocks.push(richTextBlocks(q.explanation));
  });
  const images = await resolveImages(imageBlocks);

  /* The pictures in a piece of rich text, as pdfmake nodes.
     Only the pictures: the words are already laid out by the callers below,
     inside a columns row that carries the question number and the marks, and
     rebuilding that to interleave images would cost more than it buys. An
     image follows the text it was written into, indented to line up under it.
     `fit` keeps the aspect ratio and never upscales past the column. */
  const imageNodes = (html, indent = 18) =>
    richTextBlocks(html)
      .filter((block) => block.type === 'image')
      .map((block) => {
        const dataUri = images.get(block.src);
        if (!dataUri) {
          return {
            text: block.alt ? `[image: ${block.alt} — could not be loaded]` : '[image could not be loaded]',
            fontSize: 8.5,
            italics: true,
            color: '#b45309',
            margin: [indent, 2, 0, 4],
          };
        }
        return {
          image: dataUri,
          fit: [CONTENT_WIDTH - indent, 320],
          margin: [indent, 4, 0, 6],
        };
      });

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const nowStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const titleText = quizData.title || 'Quiz Paper';
  const modeLabel = withAnswers ? 'Question Paper & Answer Key' : 'Question Paper';

  // Group questions by section if sections exist
  const sectionsMap = new Map();
  if (Array.isArray(quizData.sections) && quizData.sections.length > 0) {
    quizData.sections.forEach((sec) => {
      sectionsMap.set(String(sec._id || sec.name), { name: sec.name, questions: [] });
    });
  }

  const unsectionedQuestions = [];

  (quizData.questions || []).forEach((q) => {
    const secId = q.sectionId ? String(q.sectionId) : null;
    if (secId && sectionsMap.has(secId)) {
      sectionsMap.get(secId).questions.push(q);
    } else if (q.sectionName && Array.from(sectionsMap.values()).some((s) => s.name === q.sectionName)) {
      const found = Array.from(sectionsMap.values()).find((s) => s.name === q.sectionName);
      found.questions.push(q);
    } else {
      unsectionedQuestions.push(q);
    }
  });

  const content = [];

  // Header Document Banner
  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            fillColor: withAnswers ? '#1e3a8a' : '#1e293b',
            color: '#ffffff',
            padding: [12, 10],
            stack: [
              { text: titleText.toUpperCase(), fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
              { text: modeLabel, fontSize: 11, bold: true, alignment: 'center', color: withAnswers ? '#93c5fd' : '#cbd5e1' },
            ],
          },
        ],
      ],
    },
    margin: [0, 0, 0, 12],
  });

  // Metadata Grid
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: `Course / Class: ${quizData.className || 'N/A'}`, fontSize: 10, bold: true, color: '#334155' },
          { text: `Subject: ${quizData.subject || 'N/A'}`, fontSize: 9, color: '#64748b' },
          { text: `Faculty: ${quizData.facultyName || 'N/A'}`, fontSize: 9, color: '#64748b' },
        ],
      },
      {
        width: 'auto',
        alignment: 'right',
        stack: [
          { text: `Date: ${nowStr}`, fontSize: 9, color: '#64748b' },
          { text: `Total Questions: ${quizData.questions.length}`, fontSize: 9, bold: true, color: '#334155' },
          { text: `Total Marks: ${quizData.totalMarks || 0}`, fontSize: 9, bold: true, color: '#334155' },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  });

  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }],
    margin: [0, 0, 0, 12],
  });

  // Instructions Block if available
  if (Array.isArray(quizData.instructions) && quizData.instructions.length > 0) {
    content.push({
      text: 'INSTRUCTIONS:',
      fontSize: 10,
      bold: true,
      color: '#1e293b',
      margin: [0, 0, 0, 4],
    });
    const instList = quizData.instructions.map((inst) => ({ text: inst, fontSize: 9, color: '#475569', margin: [0, 0, 0, 2] }));
    content.push({ ul: instList, margin: [0, 0, 0, 12] });
  }

  // Render Questions
  let globalQIndex = 1;

  const renderQuestionBlock = (q) => {
    const qBlock = [];
    const plainText = richTextToPlain(q.question);
    const marksText = `[${q.marks} Mark${q.marks > 1 ? 's' : ''}${q.negativeMarks ? ` | Negative: -${q.negativeMarks}` : ''}]`;
    const typeLabel = (q.type || 'mcq').toUpperCase();

    // Question Header line
    qBlock.push({
      columns: [
        {
          text: `Q${globalQIndex}. `,
          bold: true,
          fontSize: 10.5,
          color: '#0f172a',
          width: 'auto',
        },
        {
          text: plainText,
          fontSize: 10.5,
          color: '#0f172a',
          width: '*',
        },
        {
          text: marksText,
          fontSize: 9,
          bold: true,
          color: '#475569',
          alignment: 'right',
          width: 'auto',
        },
      ],
      margin: [0, 0, 0, 4],
    });

    // Any diagram the prompt carried. Stock Quill embeds these as data URIs,
    // and richTextToPlain above drops them, which is the bug this restores.
    qBlock.push(...imageNodes(q.question));

    // Sub-info badge (Type)
    qBlock.push({
      text: `Type: ${typeLabel}${q.topic ? ` | Topic: ${q.topic}` : ''}`,
      fontSize: 8,
      color: '#64748b',
      margin: [18, 0, 0, 6],
    });

    // Options for MCQ / MSQ / TrueFalse
    if ((q.type === 'mcq' || q.type === 'msq') && Array.isArray(q.options) && q.options.length > 0) {
      const optionRows = q.options.flatMap((optText, optIdx) => {
        const letter = optionLetters[optIdx] || `${optIdx + 1}`;
        return [
          {
            text: `(${letter})  ${richTextToPlain(optText)}`,
            fontSize: 9.5,
            color: '#334155',
            margin: [24, 1, 0, 1],
          },
          // An option is often a picture on its own — a waveform, a circuit —
          // in which case the text above it is empty and this is the answer.
          ...imageNodes(optText, 30),
        ];
      });
      qBlock.push({ stack: optionRows, margin: [0, 0, 0, 6] });
    } else if (q.type === 'truefalse') {
      qBlock.push({
        text: '(A) True     (B) False',
        fontSize: 9.5,
        color: '#334155',
        margin: [24, 2, 0, 6],
      });
    } else if (q.type === 'numerical') {
      qBlock.push({
        text: 'Answer: _________________________________________',
        fontSize: 9.5,
        color: '#475569',
        margin: [24, 4, 0, 6],
      });
    }

    // Answer Key & Explanation if requested
    if (withAnswers) {
      const correctStr = formatCorrectAnswers(q);
      const answerStack = [
        {
          text: `✓ Correct Answer: ${correctStr}`,
          fontSize: 9.5,
          bold: true,
          color: '#15803d',
        },
      ];

      if (q.explanation && richTextToPlain(q.explanation).trim()) {
        answerStack.push({
          text: `Explanation: ${richTextToPlain(q.explanation)}`,
          fontSize: 9,
          color: '#334155',
          margin: [0, 3, 0, 0],
        });
      }
      // A worked explanation is where a diagram most often lives, so it is
      // added whether or not the explanation carries any words with it.
      if (q.explanation) answerStack.push(...imageNodes(q.explanation, 0));

      qBlock.push({
        table: {
          widths: ['*'],
          body: [
            [
              {
                fillColor: '#f0fdf4',
                borderColor: ['#bbf7d0', '#bbf7d0', '#bbf7d0', '#bbf7d0'],
                padding: [8, 6],
                stack: answerStack,
              },
            ],
          ],
        },
        margin: [18, 4, 0, 8],
      });
    } else {
      qBlock.push({ text: '', margin: [0, 0, 0, 6] });
    }

    globalQIndex += 1;
    return qBlock;
  };

  // Render Sectioned Questions or List
  const sectionsList = Array.from(sectionsMap.values()).filter((s) => s.questions.length > 0);

  if (sectionsList.length > 0) {
    sectionsList.forEach((sec, sIdx) => {
      content.push({
        text: `SECTION ${String.fromCharCode(65 + sIdx)}: ${sec.name.toUpperCase()}`,
        fontSize: 11,
        bold: true,
        color: '#1e3a8a',
        margin: [0, 10, 0, 8],
      });
      sec.questions.forEach((q) => {
        content.push(...renderQuestionBlock(q));
      });
    });
  }

  if (unsectionedQuestions.length > 0) {
    if (sectionsList.length > 0) {
      content.push({
        text: 'ADDITIONAL QUESTIONS',
        fontSize: 11,
        bold: true,
        color: '#1e3a8a',
        margin: [0, 10, 0, 8],
      });
    }
    unsectionedQuestions.forEach((q) => {
      content.push(...renderQuestionBlock(q));
    });
  }

  const docDefinition = {
    content,
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#94a3b8',
      margin: [0, 10, 0, 0],
    }),
    styles: {},
  };

  const cleanFilename = titleText.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const suffix = withAnswers ? 'questions_and_answers' : 'questions';
  const filename = `${cleanFilename}_${suffix}.pdf`;

  pdfMake.createPdf(docDefinition).download(filename);
}
