/**
 * The iLEED dashboard a head of department lands on from their role card.
 *
 * The bug these pin: every field was read straight off the stats response, so
 * a 200 whose body was not that payload threw during render — and with an
 * ErrorBoundary above the route, the head's whole screen became the words
 * "Something went wrong". No department, no endpoint, nothing to act on, and
 * indistinguishable from any other crash in the app.
 *
 * What matters is not which field was missing but that the page never answers
 * a bad payload with a blank screen: it either draws, or says what it could
 * not read and where it came from.
 */
import { expect, it, describe, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import ErrorBoundary from '../../components/ErrorBoundary';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; vi.restoreAllMocks(); cleanup(); });
beforeEach(() => { vi.resetModules(); });

const response = (status, data) => ({ ok: status < 400, status, json: async () => data });

const STATS = {
    department: 'CSE', date: '2026-09-20', attendancePct: 80, present: 40, absent: 10,
    totalStudents: 50, review: 0, sessions: 3, groundTruthPending: 1, groundTruthApproved: 2,
    matchAccuracy: 90, fullAccess: false, batch: null, pendingAcquisition: 0,
    attendanceVerificationPending: 0,
    byYear: [{ year: 1, attendancePct: 80, present: 40, totalStudents: 50, review: 0, sessions: 2 }],
    recentReports: [{
        _id: 'r1', batch: 'CSE-1', subject: 'Maths', room: 'LT1',
        date: '2026-09-20', timeSlot: '9-10', summary: {}, status: 'done',
    }],
};

/** Renders the dashboard under the real ErrorBoundary, as the route does. */
const renderWith = async (statsBody, { status = 200 } = {}) => {
    globalThis.fetch = vi.fn((url) => {
        const target = String(url);
        if (target.includes('/dept-admin/stats/today')) {
            return Promise.resolve(response(status, statsBody));
        }
        if (target.includes('/scheduler/live-status')) return Promise.resolve(response(200, { rooms: [] }));
        return Promise.resolve(response(200, {}));
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { default: HodDashboard } = await import('../HodDashboard');
    renderWithProviders(<ErrorBoundary><HodDashboard /></ErrorBoundary>);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((resolve) => { setTimeout(resolve, 120); });
};

const crashed = () => Boolean(screen.queryByText(/something went wrong/i));

describe('a payload the page cannot read never blanks the screen', () => {
    it('draws the dashboard when the payload is whole', async () => {
        await renderWith(STATS);
        expect(crashed()).toBe(false);
        expect(screen.getByText(/CSE Attendance/i)).toBeInTheDocument();
    });

    /* `byYear` is spread into Math.max and `recentReports` is iterated, so
       these two are what the page genuinely cannot do without. Each used to
       throw; each must now explain itself. */
    it.each([
        ['byYear'],
        ['recentReports'],
    ])('explains itself when "%s" is missing, rather than crashing', async (key) => {
        const partial = { ...STATS };
        delete partial[key];
        await renderWith(partial);
        expect(crashed()).toBe(false);
    });

    it.each([
        ['an empty body', {}],
        ['a null body', null],
    ])('explains itself on %s', async (_label, body) => {
        await renderWith(body);
        expect(crashed()).toBe(false);
        expect(screen.getByText(/could not be read/i)).toBeInTheDocument();
        // It names the endpoint, so the next person has somewhere to look.
        expect(screen.getByText(/stats\/today/)).toBeInTheDocument();
    });

    /* The live-classroom and progress panels fetch their own endpoints. A
       failure in either is theirs to show, and must not take the page with
       it — the day's totals above them are still worth reading. */
    it.each([
        ['live-status', '/scheduler/live-status'],
        ['progress', '/dept-admin/stats/progress'],
    ])('survives the %s endpoint refusing', async (_label, path) => {
        globalThis.fetch = vi.fn((url) => {
            const target = String(url);
            if (target.includes('/dept-admin/stats/today')) return Promise.resolve(response(200, STATS));
            if (target.includes(path)) return Promise.resolve(response(403, { message: 'Forbidden' }));
            return Promise.resolve(response(200, {}));
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { default: HodDashboard } = await import('../HodDashboard');
        renderWithProviders(<ErrorBoundary><HodDashboard /></ErrorBoundary>);
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        await new Promise((resolve) => { setTimeout(resolve, 120); });
        expect(crashed()).toBe(false);
        expect(screen.getByText(/CSE Attendance/i)).toBeInTheDocument();
    });

    /* A refusal still reads as a refusal: this guard must not swallow the
       server's own message and replace it with a shrug. */
    it('still shows the server\'s message when it refuses', async () => {
        await renderWith({ message: 'No department is assigned to this head of department.' }, { status: 403 });
        expect(crashed()).toBe(false);
        expect(screen.getByText(/No department is assigned/i)).toBeInTheDocument();
    });
});
