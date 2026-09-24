// Who is offered ERP Embedding Generation.
//
// Pulling a whole department's roster out of the ERP is an institute-level
// action. A department coordinator works from roll numbers they were given, so
// the tab is admin-only — and the endpoints behind it already refuse a
// coordinator by default (requireDeptMenu('erpSync')), which is what makes
// hiding it presentation rather than the access control itself.
//
// The subtle half is the URL. `?tab=3` is bookmarkable and an admin might paste
// one to a coordinator, so narrowing the DEFAULT tab is not enough: the allowed
// list has to narrow too, or the page renders its tab bar over an empty panel.

import { describe, it, expect } from 'vitest';
import { readSubtabFromSearch } from '../subtabNavigation';

// Exactly the two expressions EmbeddingGeneration picks between.
const activeTabFor = (showErpTab, search) => (
  showErpTab
    ? readSubtabFromSearch([3, 1, 2], 3, 'tab', search)
    : readSubtabFromSearch([1, 2], 1, 'tab', search)
);

describe('the admin view', () => {
  it('opens on the ERP tab', () => {
    expect(activeTabFor(true, '')).toBe(3);
  });

  it('honours a link to any of the three tabs', () => {
    expect(activeTabFor(true, '?tab=3')).toBe(3);
    expect(activeTabFor(true, '?tab=1')).toBe(1);
    expect(activeTabFor(true, '?tab=2')).toBe(2);
  });
});

describe('the department coordinator view', () => {
  it('opens on Manual Generation, since ERP is not on offer', () => {
    expect(activeTabFor(false, '')).toBe(1);
  });

  it('falls back to Manual when handed a link to the ERP tab', () => {
    // The regression this guards: with only the default narrowed, ?tab=3 still
    // resolved to 3 and the coordinator got a tab bar with nothing under it.
    expect(activeTabFor(false, '?tab=3')).toBe(1);
  });

  it('never resolves to the ERP tab for any input', () => {
    for (const search of ['', '?tab=3', '?tab=0', '?tab=abc', '?other=3', '?tab=']) {
      expect(activeTabFor(false, search)).not.toBe(3);
    }
  });

  it('still reaches the tabs it is allowed', () => {
    expect(activeTabFor(false, '?tab=1')).toBe(1);
    expect(activeTabFor(false, '?tab=2')).toBe(2);
  });
});
