import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import { ErrorState } from '../components/common';

/**
 * Telling somebody their wifi has gone, rather than that the site is broken.
 *
 * Campus connections drop constantly, and when one did the module answered
 * with whatever the fetch threw — "Failed to fetch" — which reads as a fault
 * in XCEED to the person it happens to. The browser knew all along.
 *
 * `navigator.onLine` is only trusted in one direction, and that is the whole
 * design of this: it is consulted after a request has already failed, never to
 * decide whether one would succeed. Campus wifi with no route out reports
 * online; nothing reports offline while there is a network.
 */

const setOnline = (value) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
};

const show = (error) =>
  render(
    <ChakraProvider>
      <ErrorState error={error} onRetry={() => {}} />
    </ChakraProvider>,
  );

afterEach(() => setOnline(true));

describe('an error raised while the connection is down', () => {
  it('says the connection is down, not what the fetch threw', () => {
    setOnline(false);
    show(new Error('Failed to fetch'));

    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
    expect(screen.queryByText(/failed to fetch/i)).not.toBeInTheDocument();
  });

  it('says what is still usable, because the cache means most of it is', () => {
    setOnline(false);
    show(new Error('Failed to fetch'));

    expect(screen.getByText(/anything already open stays readable/i)).toBeInTheDocument();
  });

  it('still offers the retry', () => {
    setOnline(false);
    show(new Error('Failed to fetch'));

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('leaves a genuine server error alone when the connection is fine', () => {
    // The point is not to blame the network for everything: a 500 is still a
    // 500, and its message is the one the server took the trouble to write.
    setOnline(true);
    show(new Error('That tutorial has been deleted.'));

    expect(screen.getByText('That tutorial has been deleted.')).toBeInTheDocument();
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
  });

  it('switches over the moment the connection goes, without a remount', () => {
    setOnline(true);
    show(new Error('Failed to fetch'));
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();

    setOnline(false);

    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();
  });

  it('goes back to the real message when the connection returns', () => {
    setOnline(false);
    show(new Error('Failed to fetch'));
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument();

    setOnline(true);

    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('says nothing at all when there is no error, offline or not', () => {
    // Being offline is not by itself something to interrupt a working page
    // with — the strip in the layout already says so, once.
    setOnline(false);
    show(null);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/you are offline/i)).not.toBeInTheDocument();
  });
});
