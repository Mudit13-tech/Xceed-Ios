import React from 'react';
import { Box, Button, SimpleGrid, HStack, Spinner, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

/**
 * An on-screen keyboard for a short spoken code — the room code an invigilator
 * reads out to the hall.
 *
 * It is a keyboard on purpose, not a text field: the code must be entered with
 * taps, never the physical keyboard. A field would let a laptop elsewhere script
 * the code in, and it would need the keyboard unlocked to type into — the very
 * thing a proctored sitting turns off. Rendering the entry as a display and the
 * keys as buttons means the only way in is a tap, on this screen.
 *
 * The keys are exactly the alphabet the codes are minted from — no 0/O, no
 * 1/I/l, nothing a code read across a room could be misheard as — so a student
 * can only enter a character a code could actually contain.
 */

// Mirrors the server's `ALPHABET` in quizController — keep the two in step.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* The caret on the slot waiting to be filled. A blink is the one convention a
   student reading a row of empty boxes already knows means "this one next". */
const blink = keyframes`
  0%, 45% { opacity: 1; }
  55%, 100% { opacity: 0; }
`;

/* A wrong code shakes the row it was typed into. The row is the thing that was
   wrong, and moving it puts the message where the eyes already are — the line of
   text underneath is read second, not first. */
const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-5px); }
  40% { transform: translateX(5px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
`;

/** Border and backing for one slot, by what the row as a whole is doing. */
const SLOT_TONE = {
  idle: { border: 'lmBorder.strong', bg: 'lmBg.surface' },
  checking: { border: 'lmBorder.strong', bg: 'lmBg.surface' },
  verified: { border: 'lmHue.green400', bg: 'lmHue.green50' },
  error: { border: 'lmHue.red400', bg: 'lmHue.red50' },
};

/**
 * @param {string}   value      what has been tapped so far
 * @param {number}   maxLength  how much the pad will accept
 * @param {number}   length     how many slots to draw — the code's real length,
 *                              so the row shows up front how long a code the
 *                              student is listening for. Defaults to maxLength.
 * @param {string}   status     'idle' | 'checking' | 'verified' | 'error' — the
 *                              verdict on the completed code, drawn on the slots
 *                              themselves rather than only in a line of text.
 */
export default function CodeKeypad({
  value = '',
  onChange,
  maxLength = 8,
  length,
  status = 'idle',
  isDisabled = false,
}) {
  const slots = length || maxLength;
  /* A known code length is also a limit: there is no box to draw a sixth
     character in, so the pad must not take one. */
  const cap = length ? Math.min(maxLength, length) : maxLength;
  const tone = SLOT_TONE[status] || SLOT_TONE.idle;
  const full = value.length >= cap;

  const press = (ch) => {
    if (isDisabled || value.length >= cap) return;
    onChange(`${value}${ch}`);
  };
  const backspace = () => {
    if (isDisabled || !value.length) return;
    onChange(value.slice(0, -1));
  };

  return (
    <Box>
      {/* The entry: one box per character of the code, blank until tapped into.
          Boxes, not an input — nothing here is focusable or typeable. The row is
          announced as a whole so a screen reader hears "3 of 5 entered" rather
          than a stream of single letters. */}
      <HStack spacing={2} mb={1} align="center">
        <HStack
          spacing={2}
          aria-live="polite"
          aria-label={`Code entered, ${value.length} of ${slots} characters`}
          animation={status === 'error' ? `${shake} 0.4s ease-in-out` : undefined}
        >
          {Array.from({ length: slots }, (_, i) => {
            const ch = value[i] || '';
            // The slot the next tap lands in — only while there is a next tap to
            // make, so a full row has no caret hunting for a box that is gone.
            const isNext = !isDisabled && status !== 'verified' && i === value.length;
            return (
              <Box
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                position="relative"
                w={{ base: '38px', sm: '44px' }}
                h={{ base: '48px', sm: '54px' }}
                borderWidth="2px"
                borderStyle={ch ? 'solid' : 'dashed'}
                borderColor={isNext && status === 'idle' ? 'lmHue.blue400' : tone.border}
                bg={ch ? tone.bg : 'lmBg.sunken'}
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontFamily="mono"
                fontWeight="700"
                fontSize={{ base: 'xl', sm: '2xl' }}
                color="lmFg.heading"
                transition="border-color 0.15s, background-color 0.15s"
                boxShadow={isNext && status === 'idle' ? '0 0 0 3px var(--chakra-colors-blue-100)' : 'none'}
              >
                {ch}
                {!ch && isNext && (
                  <Box
                    w="2px"
                    h="45%"
                    bg="lmHue.blue500"
                    borderRadius="full"
                    animation={`${blink} 1.1s step-end infinite`}
                  />
                )}
              </Box>
            );
          })}
        </HStack>

        {/* The verdict, beside the row rather than under it: the tick lands on
            the same line the eye is already on when the last box fills. */}
        {status === 'checking' && <Spinner size="sm" color="lmFg.faint" aria-label="Checking the code" />}
        {status === 'verified' && (
          <Box
            w="32px"
            h="32px"
            borderRadius="full"
            bg="lmHue.green500"
            color="white"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="lg"
            fontWeight="700"
            role="img"
            aria-label="Code accepted"
          >
            ✓
          </Box>
        )}
      </HStack>

      {/* One line of instruction that changes with the state, so the row of
          boxes never sits there unexplained. */}
      <Text fontSize="xs" color="lmFg.muted" mb={3} minH="18px">
        {status === 'verified'
          ? 'Code accepted.'
          : status === 'checking'
            ? 'Checking…'
            : full
              ? 'Use ⌫ to correct the code.'
              : 'Tap the code your invigilator read out.'}
      </Text>

      <SimpleGrid columns={{ base: 6, sm: 8 }} spacing={1.5} maxW="360px">
        {CODE_ALPHABET.split('').map((ch) => (
          <Button
            key={ch}
            size="sm"
            variant="outline"
            fontFamily="mono"
            fontWeight="700"
            onClick={() => press(ch)}
            isDisabled={isDisabled || full}
            aria-label={`Enter ${ch}`}
          >
            {ch}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          colorScheme="red"
          gridColumn={{ base: 'span 2', sm: 'span 2' }}
          onClick={backspace}
          isDisabled={isDisabled || !value.length}
          aria-label="Delete last character"
        >
          ⌫
        </Button>
      </SimpleGrid>
    </Box>
  );
}
