import React from 'react';
import { Box, Button, Flex, SimpleGrid, Text } from '@chakra-ui/react';

/**
 * The on-screen keypad a numerical answer is entered with.
 *
 * ## Why it exists
 *
 * Under `keyboardLockdown` the physical keyboard is dead for the whole sitting
 * and the first key pressed ends the paper. Every other answer type is already
 * answered by clicking — an option, a checkbox, true or false — so a numerical
 * question was the one place a student still had to type, and blocking the
 * keyboard without putting something in its place would have made those
 * questions unanswerable rather than harder.
 *
 * ## What it accepts
 *
 * Digits, one decimal point, and a leading minus. That is the whole grammar of
 * an answer here: the marking compares a parsed number against a tolerance, so
 * there is nothing a student could usefully write that these do not cover.
 *
 * Exponent notation is deliberately absent. `2.5e-3` is expressible as
 * `0.0025`, tolerances are set as percentages so the precision is unaffected,
 * and an `e` key is a key that has to be explained — on a keypad whose whole
 * value is that a student can look at it and know what to press.
 *
 * ## The grammar is enforced here, not repaired later
 *
 * Every key is applied to the current text and rejected if the result would not
 * be a number: a second decimal point does nothing, a minus anywhere but the
 * front does nothing. The alternative — accept anything and sanitise on submit —
 * shows the student a value that is not what will be marked, which on a paper
 * they cannot retype is the wrong way round.
 */

/** The text `key` would produce, or null if it would not be a number. */
export function applyKey(current, key) {
  const text = current || '';

  if (key === 'clear') return '';
  if (key === 'back') return text.slice(0, -1);

  if (key === '-') {
    // A toggle rather than an insert: there is one meaningful position for it and
    // pressing it twice should undo it, not queue a second one.
    return text.startsWith('-') ? text.slice(1) : `-${text}`;
  }

  if (key === '.') {
    if (text.includes('.')) return text;
    // A bare "." is not a number, and neither is "-." — the leading zero is what
    // the student would have typed anyway.
    if (text === '' || text === '-') return `${text}0.`;
    return `${text}.`;
  }

  if (/^[0-9]$/.test(key)) {
    // No run of leading zeros: "007" is not something anyone means to enter, and
    // it makes the field look like it has ignored a keypress.
    if (text === '0') return key;
    if (text === '-0') return `-${key}`;
    return `${text}${key}`;
  }

  return text;
}

const KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['-', '0', '.'],
];

export default function NumericKeypad({ value = '', onChange, isDisabled = false }) {
  const press = (key) => {
    if (isDisabled) return;
    const next = applyKey(value, key);
    if (next !== value) onChange(next);
  };

  return (
    <Box maxW="260px">
      {/* The answer as it stands. A read-only display rather than an input: there
          is no keyboard to type into it, and a focusable field that cannot be
          typed in invites a student to try — which under lockdown costs them the
          paper. */}
      <Box
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="md"
        bg="lmBg.sunken"
        px={3}
        py={2}
        mb={2}
        minH="44px"
        display="flex"
        alignItems="center"
        justifyContent="flex-end"
        aria-live="polite"
        aria-label="Your answer"
      >
        <Text fontFamily="mono" fontSize="xl" fontWeight="700" color="lmFg.heading" noOfLines={1}>
          {value || <Text as="span" color="lmFg.faint" fontSize="sm" fontFamily="body">Tap the keypad</Text>}
        </Text>
      </Box>

      <SimpleGrid columns={3} spacing={2}>
        {KEYS.flat().map((key) => (
          <Button
            key={key}
            onClick={() => press(key)}
            isDisabled={isDisabled}
            size="lg"
            variant="outline"
            fontFamily="mono"
            fontSize="lg"
            // Explicit, because a bare outline Button inherits its text colour and
            // a global `button { color: #fff }` from another module's stylesheet
            // can reach it. Same reason `buttonTextStyles` exists in common.jsx.
            color="lmFg.heading"
            aria-label={key === '-' ? 'Minus sign' : key === '.' ? 'Decimal point' : key}
          >
            {key}
          </Button>
        ))}
      </SimpleGrid>

      <Flex gap={2} mt={2}>
        <Button
          onClick={() => press('back')}
          isDisabled={isDisabled || !value}
          size="sm"
          flex="1"
          variant="outline"
          color="lmFg.heading"
        >
          ← Delete
        </Button>
        <Button
          onClick={() => press('clear')}
          isDisabled={isDisabled || !value}
          size="sm"
          flex="1"
          variant="outline"
          colorScheme="red"
        >
          Clear
        </Button>
      </Flex>
    </Box>
  );
}
