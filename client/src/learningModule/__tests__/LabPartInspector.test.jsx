/**
 * The panel that changes what a component *is*.
 *
 * Two failures here look identical from the outside — "the bench ignores me" — and
 * neither produces an error:
 *
 *   · **A value that will not take.** Every setting on a transformer is
 *     fractional: a turns ratio of 0.5, a coupling of 0.99. A field that commits
 *     each keystroke through `Number()` cannot hold the states a decimal is typed
 *     through, so the number snaps back and the part keeps its old rating while
 *     the teacher watches themselves type a new one.
 *   · **A delete that removes nothing.** The button is captioned with one
 *     component and used to act on whatever the page last called "selected". The
 *     two agree until a stray click on the canvas clears the selection, at which
 *     point the button silently does nothing to the part it names.
 *
 * So both are checked against the component that came out the other side, rather
 * than against what the panel displays.
 */

import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartInspector } from '../components/lab/BenchPanels';
import { removeComponent, updateComponent } from '../components/lab/benchOps';

const TRANSFORMER = {
  type: 'transformer',
  name: 'Transformer',
  fields: [
    { key: 'turnsRatio', label: 'Turns ratio N₁:N₂', unit: '', min: 0.01, max: 100 },
    { key: 'coupling', label: 'Coupling k', unit: '', min: 0, max: 0.9999, advanced: true },
  ],
  defaults: { turnsRatio: 2, coupling: 0.99 },
};

/** The bench, reduced to the part of it this panel talks to. */
function Bench({ onCircuit = () => {} }) {
  const [circuit, setCircuit] = useState({
    components: [
      { id: 'T1', type: 'transformer', label: 'T1', x: 0, y: 0, values: { turnsRatio: 2, coupling: 0.99 } },
      { id: 'R1', type: 'resistor', label: 'R1', x: 0, y: 0, values: { resistance: 100 } },
    ],
    wires: [{ from: { component: 'T1', pin: 0 }, to: { component: 'R1', pin: 0 } }],
  });

  const change = (next) => {
    setCircuit(next);
    onCircuit(next);
  };

  const selected = circuit.components.find((component) => component.id === 'T1') || null;

  return (
    <PartInspector
      component={selected}
      part={TRANSFORMER}
      onChange={(next) => change(updateComponent(circuit, next))}
      onRotate={() => {}}
      // Keyed by the id the panel hands over, exactly as both screens do — the
      // page's own idea of what is selected is deliberately not consulted.
      onDelete={(id) => change(removeComponent(circuit, id))}
    />
  );
}

const latest = () => {
  let seen = null;
  return {
    record: (circuit) => {
      seen = circuit;
    },
    circuit: () => seen,
    component: (id) => (seen?.components || []).find((component) => component.id === id),
  };
};

describe('the part inspector', () => {
  it('takes a fractional turns ratio, one keystroke at a time', async () => {
    const user = userEvent.setup();
    const state = latest();
    render(<Bench onCircuit={state.record} />);

    const field = screen.getByDisplayValue('2');
    await user.clear(field);
    await user.type(field, '0.5');

    // The whole number, not the digits either side of a dot that went missing.
    expect(state.component('T1').values.turnsRatio).toBe(0.5);
    expect(field).toHaveValue('0.5');
  });

  it('keeps the text a value is being typed through', async () => {
    const user = userEvent.setup();
    const state = latest();
    render(<Bench onCircuit={state.record} />);

    const field = screen.getByDisplayValue('2');
    await user.clear(field);
    await user.type(field, '0.');

    // Mid-decimal: what was typed is still on screen, and the component keeps the
    // last value that actually parsed rather than becoming 0 or empty.
    expect(field).toHaveValue('0.');
    expect(state.component('T1').values.turnsRatio).toBe(0);
  });

  it('brings a value back inside the range it is allowed on the way out', async () => {
    const user = userEvent.setup();
    const state = latest();
    render(<Bench onCircuit={state.record} />);

    const coupling = screen.getByDisplayValue('0.99');
    await user.clear(coupling);
    // Perfect coupling is not an idealisation the solver can carry: k = 1 makes
    // the two branch equations dependent and the matrix singular.
    await user.type(coupling, '2');
    await user.tab();

    expect(state.component('T1').values.coupling).toBe(0.9999);
  });

  it('never writes an empty field into the component', async () => {
    const user = userEvent.setup();
    const state = latest();
    render(<Bench onCircuit={state.record} />);

    const field = screen.getByDisplayValue('2');
    await user.clear(field);
    await user.tab();

    // Nothing was committed at all — an empty string in `values` is read by the
    // solver as zero, which for a turns ratio silently becomes 1: a transformer
    // that is not the one on screen.
    expect(state.circuit()).toBeNull();
    // And the field shows what the component is still set to, rather than staying
    // blank and inviting the same edit again.
    expect(field).toHaveValue('2');
  });

  it('deletes the component it is showing, and the wires that touched it', async () => {
    const user = userEvent.setup();
    const state = latest();
    render(<Bench onCircuit={state.record} />);

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(state.component('T1')).toBeUndefined();
    expect(state.component('R1')).toBeDefined();
    // A wire left naming a component that is not there resolves to ground in the
    // solver rather than failing, so the circuit would still run — as something
    // nobody drew.
    expect(state.circuit().wires).toHaveLength(0);
  });
});
