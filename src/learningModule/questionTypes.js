// Question types for tutorials and assignments, shared by the editors, the
// players and the results pages.
//
// The server is the authority (variantGenerator's QUESTION_TYPES and
// CHOICE_TYPES); this copy exists so the screens can lay a question out by its
// type without a round trip. Keep the two in step.

/**
 * In the order a teacher is offered them. `parametric` is the original tutorial
 * question and what a question with no type is. The other three are authored and
 * marked exactly as the matching quiz types — the server hands them to the quiz's
 * own marker.
 */
//
// Each type has its own colour, used wherever a question is named — the editor,
// the student's paper, the results and the live board — so a teacher can tell a
// paper's make-up at a glance. `short` is for tight spots like the tab strip.
export const QUESTION_TYPES = [
  {
    value: 'parametric',
    label: 'Numerical with random variables',
    short: 'Random',
    colorScheme: 'purple',
    hint: 'Every student gets their own numbers; answers are worked out from formulas.',
  },
  { value: 'mcq', label: 'Multiple choice', short: 'MCQ', colorScheme: 'blue', hint: 'One correct option.' },
  {
    value: 'msq',
    label: 'Multiple answers',
    short: 'MSQ',
    colorScheme: 'pink',
    hint: 'Several options may be correct — a student must tick all of them, and no others.',
  },
  {
    value: 'numerical',
    label: 'Numerical',
    short: 'Num',
    colorScheme: 'orange',
    hint: 'One correct number, the same for everyone, with a tolerance.',
  },
];

const FIXED_TYPES = ['mcq', 'msq', 'numerical'];
export const CHOICE_TYPES = ['mcq', 'msq'];

export const questionTypeOf = (question) =>
  FIXED_TYPES.includes(question?.type) ? question.type : 'parametric';

export const isFixedType = (question) => questionTypeOf(question) !== 'parametric';

export const isChoiceQuestion = (question) => CHOICE_TYPES.includes(question?.type);

/** Marks a question carries — the answers' (parts included) for a parametric one. */
export function questionMarks(question) {
  if (isFixedType(question)) return Number(question.marks) || 0;
  const sum = (answers) => (answers || []).reduce((total, answer) => total + (Number(answer.marks) || 0), 0);
  return sum(question.answers) + (question.parts || []).reduce((total, part) => total + sum(part.answers), 0);
}

/**
 * The question switched to another type, with the answer section reset the way
 * the quiz editor resets it. `parametricSeed` supplies a starting variable and
 * answer when a question with none is switched to the parametric type, so it is
 * not left unsaveable.
 */
export function withType(question, type, parametricSeed = {}) {
  if (type === 'numerical') {
    return { ...question, type, options: [], correctAnswers: [''], marks: question.marks ?? 1 };
  }
  if (type === 'mcq' || type === 'msq') {
    return {
      ...question,
      type,
      options: question.options?.length ? question.options : ['', '', '', ''],
      correctAnswers: [],
      marks: question.marks ?? 1,
    };
  }
  const hasAnswers = (question.answers || []).length || (question.parts || []).length;
  return { ...question, type: 'parametric', ...(hasAnswers ? {} : parametricSeed) };
}

/** Whether an input holds an answer — typed text, or at least one ticked option. */
export const hasAnswer = (value) =>
  Array.isArray(value) ? value.length > 0 : String(value ?? '').trim() !== '';

export const optionLetter = (index) => (index < 26 ? String.fromCharCode(65 + index) : String(index + 1));

/** "A, C" for option indices ["0", "2"] — the same reading the server stores in `raw`. */
export const optionLetters = (indices) =>
  (indices || [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)
    .map(optionLetter)
    .join(', ');
