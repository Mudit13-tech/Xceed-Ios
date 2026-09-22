/**
 * The sidebar the two iLEED leadership shells share.
 *
 * It exists because the head's and the Dean's shells each had a sidebar of
 * their own — a fixed 240px column of NavLinks — while the department admin
 * next door had a collapsing one. What is pinned here is the behaviour that
 * made it worth sharing rather than restyling twice, and the one rule this
 * component adds: a destination outside the shell opens in a new tab, because
 * the shell cannot render it.
 */
import { expect, it, describe, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import LeadershipSidebar from '../LeadershipSidebar';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const MENUS = [
    { id: 'dashboard', route: '/ileed-hod/dashboard', label: 'Dashboard', exact: true, color: '#6366f1' },
    { id: 'attendanceReports', route: '/ileed-hod/reports', label: 'Attendance Reports', color: '#14b8a6' },
    { id: 'helpManual', route: '/ams-manual', label: 'Help & Manual', newTab: true, color: '#64748b' },
];

const render = (props = {}) => renderWithProviders(
    <LeadershipSidebar label="iLEED head of department" menus={MENUS} basePath="/ileed-hod" {...props} />,
    { route: '/ileed-hod/dashboard' },
);

describe('what it draws', () => {
    it('lists the menus it is handed', () => {
        render();
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Attendance Reports')).toBeInTheDocument();
    });

    /* null is "still loading", which is not the same as "no menus": drawing an
       empty column and then filling it reads as a broken page. */
    it('says it is loading rather than drawing an empty column', () => {
        render({ menus: null });
        expect(screen.getByText('Loading…')).toBeInTheDocument();
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('draws the footer when there is one', () => {
        render({ footer: 'This view is read-only.' });
        expect(screen.getByText('This view is read-only.')).toBeInTheDocument();
    });
});

describe('collapsing', () => {
    it('hides the labels and the footer, keeping the menus reachable', () => {
        render({ footer: 'This view is read-only.' });

        fireEvent.click(screen.getByText('Collapse'));

        expect(screen.queryByText('Attendance Reports')).not.toBeInTheDocument();
        expect(screen.queryByText('This view is read-only.')).not.toBeInTheDocument();
        // Collapsed rows keep the first letter, and the full label as a tooltip.
        expect(screen.getByTitle('Attendance Reports')).toBeInTheDocument();
    });
});

describe('where a row goes', () => {
    /* The shell renders only its own routes. A menu pointing elsewhere — the
       manual, the camera registry — would navigate to a path this shell has no
       route for and land the reader on nothing. */
    it('opens a destination outside the shell in a new tab', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        render();

        fireEvent.click(screen.getByText('Help & Manual'));

        expect(open).toHaveBeenCalledWith('/ams-manual', '_blank', 'noopener,noreferrer');
    });

    it('offers its own routes a new tab too, without navigating', () => {
        const open = vi.spyOn(window, 'open').mockImplementation(() => null);
        render();

        fireEvent.click(screen.getByTitle('Open Attendance Reports in new tab'));

        expect(open).toHaveBeenCalledWith('/ileed-hod/reports', '_blank', 'noopener,noreferrer');
    });

    /* The tab button sits inside the row, so without stopPropagation the row's
       own click would fire as well and navigate the page out from under it. */
    it('does not also navigate when the new-tab button is used', () => {
        vi.spyOn(window, 'open').mockImplementation(() => null);
        render();

        fireEvent.click(screen.getByTitle('Open Attendance Reports in new tab'));

        // Still on the dashboard: the row underneath did not fire.
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
});
