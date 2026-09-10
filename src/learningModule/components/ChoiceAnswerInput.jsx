import React from 'react';
import { Badge, Box, Checkbox, Flex, Radio, Stack, Text } from '@chakra-ui/react';
import RichText from './RichText';
import { optionLetter } from '../questionTypes';

/**
 * A student's answer to a multiple-choice (one right option) or multiple-answer
 * (every right option, and only those) question.
 *
 * `value` is the ticked option indices as strings — the shape the server stores
 * and marks. `correct`, when given, is the answer key released after the paper
 * is marked: the right options are outlined green and a wrong tick red, so the
 * student sees both what they chose and what they should have.
 */
export default function ChoiceAnswerInput({ name, type, options, value, onChange, readOnly = false, correct }) {
  const selected = (value || []).map(String);
  const key = Array.isArray(correct) ? correct.map(String) : null;

  const toggle = (index) => {
    if (readOnly) return;
    const id = String(index);
    if (type === 'msq') {
      onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
    } else {
      onChange([id]);
    }
  };

  const Control = type === 'msq' ? Checkbox : Radio;

  return (
    <Stack spacing={2}>
      <Text fontSize="xs" color="lmFg.muted">
        {type === 'msq' ? 'Select every correct option.' : 'Select one option.'}
      </Text>
      {(options || []).map((option, index) => {
        const id = String(index);
        const ticked = selected.includes(id);
        const right = key ? key.includes(id) : false;
        const borderColor = key
          ? right
            ? 'green.400'
            : ticked
              ? 'red.400'
              : 'lmBorder.base'
          : ticked
            ? 'teal.400'
            : 'lmBorder.base';

        return (
          <Box key={id} borderWidth="1px" borderColor={borderColor} borderRadius="md" px={3} py={2}>
            {/* The whole row is the control's label, so a click anywhere on the
                option ticks it — not only on the small box. */}
            <Control
              name={name}
              value={id}
              isChecked={ticked}
              isReadOnly={readOnly}
              onChange={() => toggle(index)}
              alignItems="flex-start"
              w="100%"
            >
              <Flex gap={2} align="flex-start">
                <Text fontSize="sm" fontWeight="700" minW="18px">
                  {optionLetter(index)}.
                </Text>
                <Box flex="1">
                  <RichText fontSize="sm">{option}</RichText>
                </Box>
                {right && (
                  <Badge colorScheme="green" alignSelf="center">
                    correct
                  </Badge>
                )}
              </Flex>
            </Control>
          </Box>
        );
      })}
    </Stack>
  );
}
