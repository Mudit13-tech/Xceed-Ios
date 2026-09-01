import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';

/**
 * Getting Safe Exam Browser from the quiz list.
 *
 * The brief already offers this, but only once a proctored paper is about to
 * start — the worst moment to find out a 100MB install is in the way. On the
 * list it sits on the page students and staff open days earlier, and it is
 * shown to students too: they have no other route to the installer that does
 * not begin with a test.
 */

let isTeacher = true;
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useOutletContext: () => ({ classId: 'c1', klass: { name: 'Signals' }, isTeacher }),
  };
});

const listQuizzes = vi.fn();
const getSebInstallers = vi.fn();
vi.mock('../api/lmApi', () => ({
  default: {
    listQuizzes: (...args) => listQuizzes(...args),
    getSebInstallers: (...args) => getSebInstallers(...args),
    sebInstallerDownloadUrl: (platform) => `https://api.test/api/v1/learningmodule/seb-installer/${platform}/download`,
    setSebBypassCode: vi.fn(),
    quizResults: vi.fn(),
    exportQuizQuestions: vi.fn(),
    getSharedSebConfig: vi.fn(async () => ({ ready: false })),
    LmApiError: class LmApiError extends Error {},
  },
}));

const installers = (windows, mac) => ({
  windows: { available: windows, fileName: 'SEB.exe', fileSize: 1, uploadedByName: '', uploadedAt: null },
  mac: { available: mac, fileName: 'SEB.dmg', fileSize: 1, uploadedByName: '', uploadedAt: null },
});

const setUserAgent = (value) => {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
};

const render = async () => {
  listQuizzes.mockResolvedValue([]);
  const { default: Quizzes } = await import('../pages/Quizzes');
  renderWithProviders(<Quizzes />);
  await screen.findByText(/no quizzes yet/i);
};

beforeEach(() => {
  vi.clearAllMocks();
  isTeacher = true;
  setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
});

afterEach(() => {
  setUserAgent(window.navigator.userAgent);
});

describe('the Safe Exam Browser download on the quiz list', () => {
  it('is a direct link when only one build has been uploaded', async () => {
    getSebInstallers.mockResolvedValue(installers(true, false));
    await render();

    const link = await screen.findByRole('link', { name: /safe exam browser \(windows\)/i });
    expect(link).toHaveAttribute(
      'href',
      'https://api.test/api/v1/learningmodule/seb-installer/windows/download',
    );
  });

  it('offers this machine\u2019s build first when both are uploaded', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    getSebInstallers.mockResolvedValue(installers(true, true));
    await render();

    const menu = await screen.findByRole('button', { name: /safe exam browser/i });
    // fireEvent, not the DOM's own click(): a raw click dispatches outside
    // act(), so the menu's state update is not flushed before the query below
    // starts retrying — which is fine on an idle machine and a race under load.
    fireEvent.click(menu);

    /* Longer than Testing Library's 1s default, for this query alone.
       The menu opens behind a Chakra transition and its list is portalled, so
       the items appear a frame or two after the click — comfortably inside a
       second on an idle machine, and not always when seventy test files are
       competing for the CPU. Raising it globally was worse: it also stretches
       every query written to fail fast. */
    const items = await screen.findAllByRole('menuitem', {}, { timeout: 5000 });
    expect(items.map((i) => i.textContent)).toEqual(['Download for Mac', 'Download for Windows']);
  });

  it('shows students the download even though the teacher controls are hidden', async () => {
    isTeacher = false;
    getSebInstallers.mockResolvedValue(installers(true, false));
    await render();

    expect(await screen.findByRole('link', { name: /safe exam browser/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create quiz/i })).toBeNull();
  });

  it('offers nothing at all when no installer has been uploaded', async () => {
    getSebInstallers.mockResolvedValue(installers(false, false));
    await render();

    await waitFor(() => expect(getSebInstallers).toHaveBeenCalled());
    expect(screen.queryByText(/safe exam browser/i)).toBeNull();
  });

  it('stays out of the way when the endpoint fails', async () => {
    getSebInstallers.mockRejectedValue(new Error('nope'));
    await render();

    await waitFor(() => expect(getSebInstallers).toHaveBeenCalled());
    expect(screen.queryByText(/safe exam browser/i)).toBeNull();
  });
});
