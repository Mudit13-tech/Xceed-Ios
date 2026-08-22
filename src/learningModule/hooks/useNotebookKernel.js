import usePyodide from './usePyodide';
import useCKernel from './useCKernel';

/**
 * Picks the kernel a notebook's language needs.
 *
 * Both hooks are called on every render, because hooks cannot be called
 * conditionally — but neither downloads anything until its `start()` is, so the
 * unused one costs a few pieces of state and nothing else.
 *
 * The two expose the same interface deliberately, so the pages below stay
 * language-agnostic: they call `runCell` and render outputs without knowing
 * whether a Python kernel or a C compiler is on the other end.
 *
 * @param {'python'|'c'} language
 * @param {string[]} packages Python only; ignored by the C kernel, which has no
 *        package installer.
 * @param {string[]} sources  Python only; scanned for imports at kernel start.
 */
export default function useNotebookKernel(language, packages = [], sources = []) {
  const python = usePyodide(packages, sources);
  const c = useCKernel();

  const kernel = language === 'c' ? c : python;

  return {
    ...kernel,
    language: language === 'c' ? 'c' : 'python',
    // What to call it in the UI. The label belongs with the kernel rather than
    // being re-derived at each of the four call sites.
    label: language === 'c' ? 'C' : 'Python',
  };
}
