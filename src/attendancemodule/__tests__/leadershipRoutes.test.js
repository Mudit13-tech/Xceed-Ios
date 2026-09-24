import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { leadershipMenusFor } from '../menuCatalogue';

/**
 * Every leadership menu has a route behind it.
 *
 * The two shells build their sidebars from the catalogue and the routes are
 * written out by hand in App.jsx, so the two can disagree — and the disagreement
 * is silent in both directions. A menu with no route draws a link that lands on
 * the shell with nothing matched; a route with no menu is a screen nobody can
 * find. Neither shows up in a component test, because the sidebar renders
 * perfectly well pointing at a path that does not exist.
 *
 * Asserted against the source text rather than a rendered router on purpose:
 * mounting App.jsx pulls in every page in the platform, and what is being
 * checked here is the manifest, not the rendering.
 */

const APP = fs.readFileSync(
    path.join(__dirname, '..', '..', 'App.jsx'),
    'utf8',
);

/** The `<Route path="…">` children of one shell's block in App.jsx. */
const routePathsUnder = (base) => {
    const open = APP.indexOf(`<Route path="${base}" element=`);
    expect(open).toBeGreaterThan(-1);
    // The shell's block ends at the first `</Route>` that closes it. Every
    // child route in these blocks is self-closing, so the first one is it.
    const close = APP.indexOf('</Route>', open);
    const block = APP.slice(open, close);
    return [...block.matchAll(/<Route\s+path="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((value) => value !== base);
};

describe.each([
    ['the head of department shell', '/ileed-hod'],
    ['the Dean (Academic) shell', '/ileed-dean'],
])('%s', (_label, base) => {
    const routed = routePathsUnder(base);
    // Menus pointing outside the shell (the platform manual) open in a new tab
    // and are nobody's child route.
    const menus = leadershipMenusFor(base)
        .filter((menu) => menu.route.startsWith(`${base}/`));

    it('routes every menu its sidebar can draw', () => {
        expect(menus.length).toBeGreaterThan(0);
        for (const menu of menus) {
            const suffix = menu.route.slice(base.length + 1);
            expect(
                routed.includes(suffix),
                `${menu.label} links to ${menu.route}, which has no route under ${base}`,
            ).toBe(true);
        }
    });

    it('draws a menu for every route it carries', () => {
        const linked = new Set(menus.map((menu) => menu.route.slice(base.length + 1)));
        // The head's own mailbox is spliced into the menu by the layout rather
        // than coming from the catalogue, and a detail page is reached from its
        // listing rather than from the sidebar.
        const reachedWithoutALink = ['notifications', 'dashboard', 'erp-overrides/:reportId'];
        expect(routed.length).toBeGreaterThan(reachedWithoutALink.length);
        for (const route of routed) {
            if (reachedWithoutALink.includes(route)) continue;
            expect(
                linked.has(route),
                `${base}/${route} is routed but no menu links to it`,
            ).toBe(true);
        }
    });
});

/**
 * The two shells carry the same screens.
 *
 * A dean reads every department where a head reads the one they head: a
 * difference of scope, which the server decides, and not of which pages exist.
 * They were allowed to differ once and the settings screen's badge did not
 * follow, so an administrator was shown a switch that claimed a screen the
 * head's shell had no route for. If they are meant to differ again, this test
 * is the reminder that the badge has to become per-audience in the same
 * change rather than afterwards.
 */
describe('the two leadership shells', () => {
    const suffixes = (base) => routePathsUnder(base)
        // A head's own mailbox is theirs alone: a dean heads no department, and
        // it is the one thing in either view that a viewer may write.
        .filter((route) => route !== 'notifications')
        .sort();

    it('route the same screens, at two scopes', () => {
        expect(suffixes('/ileed-dean')).toEqual(suffixes('/ileed-hod'));
    });

    it('does not give the dean the head\'s email preferences', () => {
        expect(routePathsUnder('/ileed-hod')).toContain('notifications');
        expect(routePathsUnder('/ileed-dean')).not.toContain('notifications');
    });
});
