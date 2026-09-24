import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Pictures in the quiz PDF.
 *
 * Quiz questions carry diagrams — the editor is stock Quill, whose image button
 * embeds the picture as a `data:` URI inside the question's markup. The
 * generator flattened every field with `richTextToPlain`, which strips all
 * markup including `<img>`, so a paper with a circuit in it printed as though
 * the question had no figure at all.
 *
 * These read the document definition the generator hands pdfmake, which is
 * where an image either is or is not.
 */

vi.mock('../../filedownload/pdfMakeInitializer', () => ({ default: () => {} }));

// A real 4x3 PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

let captured;
const download = vi.fn();

beforeEach(() => {
  captured = null;
  download.mockClear();
  globalThis.pdfMake = {
    createPdf: (definition) => {
      captured = definition;
      return { download };
    },
  };
});

/** Every node in the document definition, flattened, whatever it is nested in. */
const allNodes = (node, out = []) => {
  if (Array.isArray(node)) {
    node.forEach((child) => allNodes(child, out));
    return out;
  }
  if (node && typeof node === 'object') {
    out.push(node);
    ['stack', 'columns', 'table', 'body', 'ul'].forEach((key) => {
      if (node[key]) allNodes(node[key], out);
    });
  }
  return out;
};

const imagesInDoc = () => allNodes(captured?.content || []).filter((node) => node.image);

const quiz = (question) => ({
  title: 'Circuits Test',
  questions: [{ marks: 2, type: 'mcq', ...question }],
  totalMarks: 2,
});

describe('a quiz question with a diagram', () => {
  it('puts the prompt’s picture in the document', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    await generateQuizPdf(
      quiz({ question: `<p>Study the circuit.</p><img src="${PNG}" alt="circuit">`, options: ['<p>Yes</p>', '<p>No</p>'] }),
    );

    expect(imagesInDoc().map((node) => node.image)).toEqual([PNG]);
  });

  it('puts a picture that is the whole of an option in the document', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    await generateQuizPdf(
      quiz({ question: '<p>Which waveform?</p>', options: [`<img src="${PNG}">`, '<p>None</p>'] }),
    );

    expect(imagesInDoc()).toHaveLength(1);
  });

  it('puts the explanation’s picture in, but only when answers were asked for', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    const withDiagram = quiz({
      question: '<p>Find the current.</p>',
      options: ['<p>1 A</p>', '<p>2 A</p>'],
      correctAnswers: ['0'],
      explanation: `<p>By KVL.</p><img src="${PNG}" alt="working">`,
    });

    await generateQuizPdf(withDiagram, false);
    expect(imagesInDoc()).toHaveLength(0);

    await generateQuizPdf(withDiagram, true);
    expect(imagesInDoc()).toHaveLength(1);
  });

  it('still downloads, under the same name as before', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    await generateQuizPdf(quiz({ question: `<p>x</p><img src="${PNG}">`, options: ['<p>a</p>', '<p>b</p>'] }));

    expect(download).toHaveBeenCalledWith('circuits_test_questions.pdf');
  });

  it('says a picture is missing rather than dropping it silently', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    // An http src cannot be fetched in the test environment, so it resolves to
    // nothing — the case of a deleted file or a host that refuses the request.
    await generateQuizPdf(
      quiz({ question: '<p>See figure.</p><img src="https://example.test/fig.png" alt="figure 2">', options: ['<p>a</p>', '<p>b</p>'] }),
    );

    expect(imagesInDoc()).toHaveLength(0);
    const notes = allNodes(captured.content)
      .map((node) => node.text)
      .filter((text) => typeof text === 'string' && text.includes('could not be loaded'));
    expect(notes).toEqual(['[image: figure 2 — could not be loaded]']);
  });

  it('leaves a paper with no pictures unchanged', async () => {
    const { generateQuizPdf } = await import('../utils/quizPdfGenerator');
    await generateQuizPdf(quiz({ question: '<p>Plain question.</p>', options: ['<p>a</p>', '<p>b</p>'] }));

    expect(imagesInDoc()).toHaveLength(0);
    expect(download).toHaveBeenCalled();
  });
});
