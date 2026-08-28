import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import ExamCodes from '../components/ExamCodes';

/**
 * Both codes are read off a screen by staff standing in a hall — the room code
 * out loud, the access code handed to one student. These pin that they are shown
 * where they can be, that a code that would unlock nothing is not offered, and
 * that a student copy of the settings renders nothing at all.
 */

const wrap = (ui) => render(<ChakraProvider>{ui}</ChakraProvider>);

afterEach(cleanup);

describe('ExamCodes', () => {
  it('shows both codes when both are set', () => {
    wrap(
      <ExamCodes
        settings={{ roomCode: 'K7PQR', requireSafeExamBrowser: true, sebBypassEnabled: true, sebBypassCode: 'ZX8HT4' }}
      />,
    );
    expect(screen.getByText('K7PQR')).toBeTruthy();
    expect(screen.getByText('ZX8HT4')).toBeTruthy();
  });

  it('renders nothing on a student copy of the settings, which carries neither', () => {
    // What `publicSettings` sends: the flags, never the codes.
    const { container } = wrap(
      <ExamCodes settings={{ roomCodeRequired: true, roomCodeLength: 5, sebBypassEnabled: true }} />,
    );
    expect(container.textContent).toBe('');
  });

  it('does not offer an access code on a paper with no lockdown to bypass', () => {
    wrap(<ExamCodes settings={{ roomCode: 'K7PQR', sebBypassEnabled: true, sebBypassCode: 'ZX8HT4' }} />);
    expect(screen.getByText('K7PQR')).toBeTruthy();
    expect(screen.queryByText('ZX8HT4')).toBeNull();
  });

  it('says so when an active code predates being kept readable', () => {
    wrap(<ExamCodes settings={{ requireSafeExamBrowser: true, sebBypassEnabled: true, sebBypassCode: '' }} />);
    expect(screen.getByText(/generate a new one/i)).toBeTruthy();
  });
});
