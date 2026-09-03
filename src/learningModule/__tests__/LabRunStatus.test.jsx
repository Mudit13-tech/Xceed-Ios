import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/renderWithProviders';
import { RunStatus } from '../components/lab/BenchPanels';
import { QUANTITY_COLOR } from '../components/lab/format';

/**
 * The bench solved correctly long before it *said* so. Pressing Run on an
 * unchanged circuit — or on one whose only meter reads zero — updated nothing
 * visible, which is indistinguishable from a button that does nothing and is
 * the usual reason a working bench gets reported as broken.
 */

describe('the run verdict', () => {
  it('tells a student what to press before anything has been run', () => {
    renderWithProviders(<RunStatus lastRun={null} running={false} result={null} />);
    expect(screen.getByText(/not run yet/i)).toBeInTheDocument();
  });

  it('says it is working while the solver is out', () => {
    renderWithProviders(<RunStatus lastRun={null} running result={null} />);
    expect(screen.getByText(/solving/i)).toBeInTheDocument();
  });

  it('confirms a solve, naming the analysis and the time it finished', () => {
    // The clock is the load-bearing part: it changes on every run, so a second
    // press reads as a second run even when the numbers come back identical.
    renderWithProviders(
      <RunStatus
        lastRun={{ at: new Date('2026-03-01T10:20:30'), ms: 12, ok: true, analysis: 'dc' }}
        running={false}
        result={{ ok: true }}
      />,
    );
    expect(screen.getByText(/solved/i)).toBeInTheDocument();
    expect(screen.getByText(/DC operating point/)).toBeInTheDocument();
    expect(screen.getByText(/10:20:30/)).toBeInTheDocument();
  });

  it('reports a refusal with the solver’s own reason', () => {
    // A circuit that will not solve is how a student finds out a node is
    // floating, so the message is a teaching surface, not just an error.
    renderWithProviders(
      <RunStatus
        lastRun={{ at: new Date(), ok: false, analysis: 'dc' }}
        running={false}
        result={{ ok: false, message: 'Node N2 is not connected to anything.' }}
      />,
    );
    expect(screen.getByText(/did not solve/i)).toBeInTheDocument();
    expect(screen.getByText(/Node N2 is not connected/)).toBeInTheDocument();
  });

  it('does not claim a solve when the request itself was refused', () => {
    // No result at all — the server rejected the circuit before solving it.
    renderWithProviders(
      <RunStatus
        lastRun={{ at: new Date(), ok: false, analysis: 'ac', error: 'Unknown part on this bench.' }}
        running={false}
        result={null}
      />,
    );
    expect(screen.getByText(/did not solve/i)).toBeInTheDocument();
    expect(screen.getByText(/Unknown part on this bench/)).toBeInTheDocument();
  });
});

describe('one hue per quantity', () => {
  it('gives voltage, current and power three distinct colours', () => {
    const used = Object.values(QUANTITY_COLOR);
    expect(new Set(used).size).toBe(3);
  });

  it('keeps them off red and green, which mean something else on this bench', () => {
    // Red is a circuit that did not solve; green is a source delivering rather
    // than absorbing. A quantity sharing either would say two things at once.
    Object.values(QUANTITY_COLOR).forEach((token) => {
      expect(token).not.toMatch(/red|green/);
    });
  });
});
