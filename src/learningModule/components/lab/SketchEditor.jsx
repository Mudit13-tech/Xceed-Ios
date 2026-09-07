import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react';

/**
 * The sketch a microcontroller on the bench is running.
 *
 * ## Why this is not just a Textarea in the inspector
 *
 * Every other field in the palette is a number in a 110-pixel box. Code is not:
 * it is the *experiment* when there is a microcontroller in the circuit, and the
 * side panel is 290 px wide. So the inspector shows enough to recognise which
 * sketch is loaded and to make a one-line change, and a full-height modal is one
 * click away for actually writing one.
 *
 * ## Why a plain textarea and not CodeMirror
 *
 * A syntax-highlighting editor is 400 kB of bundle for a language with twenty
 * keywords, on a page a student may open over a lab's wifi. What actually helps
 * when a sketch will not compile is knowing *which line* — and that comes from
 * the server's compile error, which is shown here against a gutter of line
 * numbers. Tab-inserts-a-tab and the line gutter are the two things a textarea
 * genuinely lacks, and both are a few lines each.
 *
 * ## Why the drafts are local
 *
 * Every keystroke committing to the circuit would push a circuit revision per
 * character — the undo history would be one entry per letter typed and the
 * autosave would fire constantly. So the text is held here while it is being
 * typed and handed over on blur, on Ctrl-Enter, and when the modal is closed,
 * which is the same shape `NumberField` already uses for a half-typed number.
 */

/**
 * Sketches worth starting from.
 *
 * Not a tutorial — four circuits a student will actually be asked to build, each
 * one exercising a different half of the boundary. Blink drives a pin and reads
 * nothing; button reads a pin and drives from it; fade is analogWrite; and the
 * last one closes the loop through the analog input, which is the one that
 * demonstrates that the sketch and the solver are genuinely talking.
 */
const SKETCH_EXAMPLES = [
  {
    name: 'Blink',
    hint: 'Drives D2 high and low every half second. Wire D2 through a resistor to an LED to GND.',
    source: [
      'void setup() {',
      '  pinMode(2, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  digitalWrite(2, HIGH);',
      '  delay(500);',
      '  digitalWrite(2, LOW);',
      '  delay(500);',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'Button',
    hint:
      'Reads D3 and mirrors it on D2. Wire a switch from D3 to GND — INPUT_PULLUP means '
      + 'you need nothing else, because the pull-up is inside the chip.',
    source: [
      'void setup() {',
      '  pinMode(2, OUTPUT);',
      '  pinMode(3, INPUT_PULLUP);',
      '}',
      '',
      'void loop() {',
      '  // The pull-up makes an open switch read HIGH, so a press is LOW.',
      '  if (digitalRead(3) == LOW) {',
      '    digitalWrite(2, HIGH);',
      '  } else {',
      '    digitalWrite(2, LOW);',
      '  }',
      '  delay(1);',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'Fade',
    hint:
      'Ramps D5 from off to full and back. analogWrite is a duty cycle, and the bench shows '
      + 'it as the average level a real PWM pin would give you.',
    source: [
      'int level = 0;',
      'int step = 5;',
      '',
      'void setup() {',
      '  pinMode(5, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  analogWrite(5, level);',
      '  level = level + step;',
      '  if (level >= 255 || level <= 0) {',
      '    step = -step;',
      '  }',
      '  delay(10);',
      '}',
      '',
    ].join('\n'),
  },
  {
    name: 'Threshold',
    hint:
      'Reads A0 and switches D2 when it passes half the rail. Wire a potential divider — a '
      + 'rheostat between GND and a supply — into A0 and turn it while the run happens.',
    source: [
      'void setup() {',
      '  pinMode(2, OUTPUT);',
      '}',
      '',
      'void loop() {',
      '  // analogRead is 0 at 0 V and 1023 at 5 V, exactly as on the board.',
      '  int reading = analogRead(A0);',
      '  if (reading > 512) {',
      '    digitalWrite(2, HIGH);',
      '  } else {',
      '    digitalWrite(2, LOW);',
      '  }',
      '  delay(1);',
      '}',
      '',
    ].join('\n'),
  },
];

/** The 1-based line the compile error points at, or null. */
const errorLine = (error) => {
  const line = Number(error?.line);
  return Number.isFinite(line) && line > 0 ? line : null;
};

/**
 * A textarea with a line-number gutter, and the failing line marked.
 *
 * The gutter is a sibling column scrolled in lockstep rather than anything
 * clever: it is the only way to get line numbers beside a real textarea, and a
 * real textarea is what gives selection, undo and a mobile keyboard for free.
 */
function CodeArea({ value, onChange, onCommit, error, rows, readOnly }) {
  const gutter = useRef(null);
  const bad = errorLine(error);
  const lines = value.split('\n');

  return (
    <Flex
      align="stretch"
      borderWidth="1px"
      borderColor={bad ? 'lmHue.red600' : 'lmBorder.base'}
      borderRadius="md"
      overflow="hidden"
      bg="lmBg.sunken"
    >
      <Box
        ref={gutter}
        flex="0 0 auto"
        py={2}
        px={1.5}
        overflow="hidden"
        borderRightWidth="1px"
        borderColor="lmBorder.subtle"
        userSelect="none"
        aria-hidden="true"
      >
        {lines.map((_, index) => (
          <Text
            key={index}
            fontFamily="mono"
            fontSize="xs"
            lineHeight="1.5rem"
            textAlign="right"
            color={index + 1 === bad ? 'lmHue.red700' : 'lmFg.subtle'}
            fontWeight={index + 1 === bad ? '700' : '400'}
          >
            {index + 1}
          </Text>
        ))}
      </Box>
      <Textarea
        flex="1"
        value={value}
        rows={rows}
        isReadOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        fontFamily="mono"
        fontSize="xs"
        lineHeight="1.5rem"
        border="none"
        borderRadius="0"
        bg="transparent"
        py={2}
        resize="none"
        _focusVisible={{ boxShadow: 'none' }}
        onScroll={(event) => {
          if (gutter.current) gutter.current.scrollTop = event.target.scrollTop;
        }}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit()}
        onKeyDown={(event) => {
          // Tab in a code box indents; letting it move focus would make the
          // editor unusable for the one language it exists to edit.
          if (event.key === 'Tab') {
            event.preventDefault();
            const box = event.target;
            const { selectionStart: start, selectionEnd: end } = box;
            const next = `${value.slice(0, start)}  ${value.slice(end)}`;
            onChange(next);
            // Restored after React has written the new value back.
            requestAnimationFrame(() => {
              box.selectionStart = start + 2;
              box.selectionEnd = start + 2;
            });
          }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onCommit();
          }
        }}
      />
    </Flex>
  );
}

/**
 * The inspector's sketch field: a short preview, the examples, and the way in.
 *
 * `error` is the server's compile message for *this* component, already narrowed
 * by the caller — the panel does not decide whose error it is, because a bench
 * with two boards on it would then show both students' mistakes on one part.
 */
export default function SketchEditor({ value = '', error = null, readOnly, onChange }) {
  const [draft, setDraft] = useState(value);
  const modal = useDisclosure();

  // A different component was selected, or the circuit was reloaded: the draft
  // belongs to the sketch it was typed against, not to this panel.
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    if (draft !== value) onChange(draft);
  };

  const closeModal = () => {
    commit();
    modal.onClose();
  };

  const load = (name) => {
    const example = SKETCH_EXAMPLES.find((entry) => entry.name === name);
    if (!example) return;
    setDraft(example.source);
    onChange(example.source);
  };

  const lineCount = draft.split('\n').length;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={1} gap={2}>
        <Text fontSize="xs" color="lmFg.subtle">
          Sketch · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </Text>
        <HStack spacing={1}>
          {!readOnly && (
            <Tooltip label="Replace the sketch with a worked example">
              <Select
                size="xs"
                maxW="96px"
                placeholder="Examples"
                value=""
                onChange={(event) => load(event.target.value)}
              >
                {SKETCH_EXAMPLES.map((example) => (
                  <option key={example.name} value={example.name}>
                    {example.name}
                  </option>
                ))}
              </Select>
            </Tooltip>
          )}
          <Button size="xs" variant="outline" onClick={modal.onOpen}>
            ⤢ Expand
          </Button>
        </HStack>
      </Flex>

      <CodeArea
        value={draft}
        rows={8}
        readOnly={readOnly}
        error={error}
        onChange={setDraft}
        onCommit={commit}
      />

      {/* The message already names its line — the server's SketchError puts it
          there — so it is not repeated here; `error.line` is what marks the
          gutter. */}
      {error?.message && (
        <Text fontSize="xs" color="lmHue.red700" mt={1}>
          {error.message}
        </Text>
      )}

      <Modal isOpen={modal.isOpen} onClose={closeModal} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontSize="md">Sketch</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <CodeArea
              value={draft}
              rows={22}
              readOnly={readOnly}
              error={error}
              onChange={setDraft}
              onCommit={commit}
            />
            {error?.message && (
              <Text fontSize="sm" color="lmHue.red700" mt={2}>
                {error.message}
              </Text>
            )}
            <Text fontSize="xs" color="lmFg.muted" mt={3}>
              This is Arduino C as far as a bench needs it: <code>setup</code> and{' '}
              <code>loop</code>, <code>int</code>/<code>float</code>/<code>bool</code> variables,{' '}
              <code>if</code>/<code>for</code>/<code>while</code>, your own functions, and{' '}
              <code>pinMode</code>, <code>digitalWrite</code>, <code>digitalRead</code>,{' '}
              <code>analogRead</code>, <code>analogWrite</code>, <code>delay</code>,{' '}
              <code>millis</code>, <code>map</code>, <code>constrain</code> and the maths
              functions. <code>delay</code> counts simulated time, so a 500 ms blink needs a run at
              least a second long to show a full cycle. There are no libraries, no{' '}
              <code>Serial</code> and no pointers.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button size="sm" onClick={closeModal}>Done</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
