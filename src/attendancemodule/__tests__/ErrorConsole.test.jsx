import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import ErrorConsole from '../ErrorConsole';
import { mergeErrorRows } from '../errorConsoleRows';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

const metricsReply = (recentErrors) => ({ data: { recentErrors } });
const logsReply = (logs) => ({ data: { logs } });

/** Answers each endpoint by URL, since both are fetched at once. */
function respondWith({ recentErrors = [], logs = [] }) {
  axios.get.mockImplementation((url) =>
    (url.includes('/metrics')
      ? Promise.resolve(metricsReply(recentErrors))
      : Promise.resolve(logsReply(logs))));
}

const failure = (over = {}) => ({
  method: 'POST',
  path: '/api/v1/attendancemodule/erp/push',
  status: 500,
  ms: 42,
  message: 'Request failed with status code 400',
  at: '2026-09-07T21:16:35.000Z',
  count: 1,
  ...over,
});

describe('merging the two sources of errors', () => {
  it('reads newest first, unlike the log above it', () => {
    const rows = mergeErrorRows(
      [failure({ at: '2026-09-07T21:10:00.000Z', path: '/older' })],
      [{ timestamp: '2026-09-07T21:20:00.000Z', level: 'ERROR', message: 'newer' }],
    );
    expect(rows.map((r) => r.kind)).toEqual(['log', '5xx']);
  });

  it('takes only the error output from the log, not the whole log', () => {
    // The point of the panel. The buffer it reads is the same one the console
    // above shows, which on this server is mostly ffmpeg progress.
    const rows = mergeErrorRows([], [
      { timestamp: '2026-09-07T21:09:15.000Z', level: 'INFO', message: 'FFmpeg Audio: size= 22123kB' },
      { timestamp: '2026-09-07T21:16:35.000Z', level: 'ERROR', message: 'Embedding delete failed' },
      { timestamp: '2026-09-07T21:17:00.000Z', level: 'WARN', message: 'retrying' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.badge)).toEqual(['WARN', 'ERROR']);
  });

  it('sorts a 5xx above a 4xx that landed in the same second', () => {
    const at = '2026-09-07T21:16:35.000Z';
    const rows = mergeErrorRows(
      [failure({ at, status: 404, path: '/gone' }), failure({ at })],
      [{ timestamp: at, level: 'ERROR', message: 'and the line it printed' }],
    );
    // Requests before the log line they printed, so the two read together.
    expect(rows.map((r) => r.kind)).toEqual(['4xx', '5xx', 'log']);
  });
});

describe('the panel', () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it('names what failed, how often, and why', async () => {
    respondWith({ recentErrors: [failure({ count: 12 })] });
    render(<ErrorConsole />);

    expect(await screen.findByText(/POST .*erp\/push/)).toBeInTheDocument();
    // The count is the difference between "an error happened" and "this is the
    // thing that is wrong".
    expect(screen.getByText('×12')).toBeInTheDocument();
    expect(screen.getByText('Request failed with status code 400')).toBeInTheDocument();
    expect(screen.getByText('12 failed request(s)')).toBeInTheDocument();
  });

  it('says so plainly when a route failed without raising an error', async () => {
    // A blank line where the message goes reads as missing data rather than as
    // "there was never a message to show".
    respondWith({ recentErrors: [failure({ status: 404, message: null })] });
    render(<ErrorConsole />);

    expect(await screen.findByText(/answered 404 without raising an error/)).toBeInTheDocument();
  });

  it('narrows to one kind of error on request', async () => {
    respondWith({
      recentErrors: [failure(), failure({ status: 404, path: '/gone', message: null })],
      logs: [{ timestamp: '2026-09-07T21:16:35.000Z', level: 'ERROR', message: 'Embedding delete failed' }],
    });
    render(<ErrorConsole />);

    await screen.findByText(/erp\/push/);
    fireEvent.click(screen.getByRole('button', { name: /Server 5xx/ }));

    expect(screen.getByText(/erp\/push/)).toBeInTheDocument();
    expect(screen.queryByText(/\/gone/)).not.toBeInTheDocument();
    expect(screen.queryByText('Embedding delete failed')).not.toBeInTheDocument();
  });

  it('keeps the half of the picture that answered when the other endpoint fails', async () => {
    // The metrics endpoint needs attendance-module access and the log endpoint
    // does not, so one being refused is an ordinary state — and it must not
    // blank the errors the other one is still reporting.
    axios.get.mockImplementation((url) =>
      (url.includes('/metrics')
        ? Promise.reject(new Error('403'))
        : Promise.resolve(logsReply([
          { timestamp: '2026-09-07T21:16:35.000Z', level: 'ERROR', message: 'Embedding delete failed' },
        ]))));

    render(<ErrorConsole />);
    expect(await screen.findByText('Embedding delete failed')).toBeInTheDocument();
  });

  it('reports an unreachable server rather than an empty, reassuring panel', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    render(<ErrorConsole />);
    expect(await screen.findByText('Network Error')).toBeInTheDocument();
  });

  it('stops polling while paused', async () => {
    vi.useFakeTimers();
    try {
      respondWith({ recentErrors: [] });
      render(<ErrorConsole pollMs={1000} />);
      await vi.advanceTimersByTimeAsync(2500);
      const polledWhileRunning = axios.get.mock.calls.length;
      expect(polledWhileRunning).toBeGreaterThan(2);

      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      // One more pair for the load() that runs on the state change, then nothing.
      const afterPausing = axios.get.mock.calls.length;
      await vi.advanceTimersByTimeAsync(5000);
      expect(axios.get.mock.calls.length).toBe(afterPausing);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows nothing alarming on a server that is behaving', async () => {
    respondWith({ recentErrors: [], logs: [{ timestamp: '2026-09-07T21:00:00.000Z', level: 'INFO', message: 'fine' }] });
    render(<ErrorConsole />);

    expect(await screen.findByText('No errors since the server started')).toBeInTheDocument();
    const header = screen.getByText('Error Console').closest('section');
    expect(within(header).getByText('Nothing failing')).toBeInTheDocument();
  });
});
