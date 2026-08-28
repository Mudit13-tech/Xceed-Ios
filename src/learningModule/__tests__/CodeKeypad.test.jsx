import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import CodeKeypad, { CODE_ALPHABET } from '../components/CodeKeypad';

/**
 * The room code is entered by tapping, never by typing — that is the whole point
 * of rendering it as a keyboard rather than a text field. These tests pin that
 * the only characters offered are ones a code can contain, that taps build the
 * value the caller sees, and that there is no focusable input to type into.
 */

const wrap = (ui) => render(<ChakraProvider>{ui}</ChakraProvider>);

afterEach(cleanup);

it('offers only the unambiguous alphabet the codes are minted from', () => {
  wrap(<CodeKeypad value="" onChange={() => {}} />);
  // Every allowed character has a key…
  CODE_ALPHABET.split('').forEach((ch) => {
    expect(screen.getByRole('button', { name: `Enter ${ch}` })).toBeTruthy();
  });
  // …and the ambiguous ones have none.
  ['O', 'I', 'L', '0', '1'].forEach((ch) => {
    expect(screen.queryByRole('button', { name: `Enter ${ch}` })).toBeNull();
  });
});

it('appends the tapped character to the value', () => {
  const onChange = vi.fn();
  wrap(<CodeKeypad value="AB" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter C' }));
  expect(onChange).toHaveBeenCalledWith('ABC');
});

it('backspace drops the last character', () => {
  const onChange = vi.fn();
  wrap(<CodeKeypad value="ABC" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete last character' }));
  expect(onChange).toHaveBeenCalledWith('AB');
});

it('stops accepting input at the max length', () => {
  const onChange = vi.fn();
  wrap(<CodeKeypad value="ABCDEFGH" onChange={onChange} maxLength={8} />);
  fireEvent.click(screen.getByRole('button', { name: 'Enter C' }));
  expect(onChange).not.toHaveBeenCalled();
});

it('has no text input to type into — the only way in is a tap', () => {
  const { container } = wrap(<CodeKeypad value="AB" onChange={() => {}} />);
  expect(container.querySelector('input')).toBeNull();
  expect(container.querySelector('textarea')).toBeNull();
});

/**
 * The entry is drawn as one blank box per character of the real code, so a
 * student can see how long a code to listen for before the first tap, and the
 * verdict lands on those boxes rather than only in a line of text below them.
 */
describe('the entry row', () => {
  const boxes = (container) => container.querySelectorAll('[aria-label^="Code entered"] > div');

  it('draws a box for every character of the code, blank ones included', () => {
    const { container } = wrap(<CodeKeypad value="AB" onChange={() => {}} length={5} maxLength={5} />);
    expect(boxes(container).length).toBe(5);
    expect(screen.getByLabelText('Code entered, 2 of 5 characters')).toBeTruthy();
  });

  it('will not take a character past the code length, however high maxLength is', () => {
    const onChange = vi.fn();
    wrap(<CodeKeypad value="ABCDE" onChange={onChange} length={5} maxLength={8} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter C' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the tick only once the code has been accepted', () => {
    const { rerender } = wrap(
      <CodeKeypad value="ABCDE" onChange={() => {}} length={5} status="checking" />,
    );
    expect(screen.queryByLabelText('Code accepted')).toBeNull();
    expect(screen.getByLabelText('Checking the code')).toBeTruthy();

    rerender(
      <ChakraProvider>
        <CodeKeypad value="ABCDE" onChange={() => {}} length={5} status="verified" />
      </ChakraProvider>,
    );
    expect(screen.getByLabelText('Code accepted')).toBeTruthy();
  });
});
