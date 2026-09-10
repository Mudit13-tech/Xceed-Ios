import React from 'react';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import RichTextEditor from './RichTextEditor';
import { LmIcon } from './Icon';
import { duplicateOptionIndexes } from '../questionRules';
import { QUESTION_TYPES, questionTypeOf } from '../questionTypes';

/** "+ Add question", asking for the type first. */
export function AddQuestionMenu({ onAdd, ...buttonProps }) {
  return (
    <Menu>
      <MenuButton as={Button} {...buttonProps}>
        + Add question
      </MenuButton>
      <MenuList zIndex="dropdown">
        {QUESTION_TYPES.map((option) => (
          <MenuItem key={option.value} onClick={() => onAdd(option.value)}>
            <Box>
              <Text fontSize="sm" fontWeight="600">
                {option.label}
              </Text>
              <Text fontSize="xs" color="lmFg.muted">
                {option.hint}
              </Text>
            </Box>
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

/**
 * The answer section of an MCQ, MSQ or numerical question — the quiz editor's
 * fields, carried over: options with the right ones ticked (repeats flagged as
 * they are typed), or a correct value with percentage and absolute tolerance,
 * and the marks the question carries.
 *
 * `onChange` takes an updater, applied to the current question rather than to
 * the one this render saw — Quill emits its own change in the same tick as an
 * edit, and a plain spread would drop one of the two.
 */
export function FixedQuestionFields({ question, onChange }) {
  const type = questionTypeOf(question);
  const set = (field, value) => onChange((current) => ({ ...current, [field]: value }));
  const options = question.options || [];
  const correct = (question.correctAnswers || []).map(String);
  const duplicates = duplicateOptionIndexes(options);

  const toggleCorrect = (index, checked) =>
    onChange((current) => {
      const now = (current.correctAnswers || []).map(String);
      const id = String(index);
      const next =
        type === 'msq'
          ? checked
            ? [...now.filter((entry) => entry !== id), id]
            : now.filter((entry) => entry !== id)
          : checked
            ? [id]
            : [];
      return { ...current, correctAnswers: next };
    });

  const setOption = (index, html) =>
    onChange((current) => {
      const next = [...(current.options || [])];
      next[index] = html;
      return { ...current, options: next };
    });

  const removeOption = (index) =>
    onChange((current) => ({
      ...current,
      options: (current.options || []).filter((_, i) => i !== index),
      // The key points at positions, so ticks below the removed option move up
      // with the options they belong to.
      correctAnswers: (current.correctAnswers || [])
        .map(Number)
        .filter((i) => i !== index)
        .map((i) => String(i > index ? i - 1 : i)),
    }));

  const marksField = (
    <FormControl maxW="120px">
      <FormLabel fontSize="xs">Marks</FormLabel>
      <Input
        size="sm"
        type="number"
        min={0}
        value={question.marks ?? 1}
        onChange={(e) => set('marks', Number(e.target.value) || 0)}
      />
    </FormControl>
  );

  if (type === 'numerical') {
    return (
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
        <FormControl>
          <FormLabel fontSize="xs">Correct value</FormLabel>
          <Input
            size="sm"
            value={(question.correctAnswers || [])[0] ?? ''}
            placeholder="42"
            onChange={(e) => set('correctAnswers', [e.target.value])}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs">Tolerance %</FormLabel>
          <Input
            size="sm"
            type="number"
            min={0}
            value={question.tolerancePercent ?? 0}
            onChange={(e) => set('tolerancePercent', Number(e.target.value) || 0)}
          />
        </FormControl>
        <FormControl>
          <Tooltip label="Absolute allowance — needed when the answer is near zero">
            <FormLabel fontSize="xs">Tolerance ±</FormLabel>
          </Tooltip>
          <Input
            size="sm"
            type="number"
            min={0}
            value={question.toleranceAbs ?? 0}
            onChange={(e) => set('toleranceAbs', Number(e.target.value) || 0)}
          />
        </FormControl>
        {marksField}
      </SimpleGrid>
    );
  }

  return (
    <Stack spacing={2}>
      <Text fontSize="xs" color="lmFg.muted">
        {type === 'msq'
          ? 'Tick the correct answers — a student must tick all of them, and no others.'
          : 'Tick the correct answer.'}
      </Text>
      {options.map((option, optionIndex) => (
        <Flex key={optionIndex} gap={2} align="flex-start">
          <Checkbox
            mt={2}
            aria-label={`Option ${optionIndex + 1} is correct`}
            isChecked={correct.includes(String(optionIndex))}
            onChange={(event) => toggleCorrect(optionIndex, event.target.checked)}
          />
          <Box
            flex="1"
            borderWidth={duplicates.has(optionIndex) ? '1px' : 0}
            borderColor="red.400"
            borderRadius="md"
          >
            <RichTextEditor
              compact
              minH="46px"
              value={option}
              onChange={(html) => setOption(optionIndex, html)}
              placeholder={`Option ${optionIndex + 1}`}
            />
            {duplicates.has(optionIndex) && (
              <Text fontSize="xs" color="red.600" px={2} pb={1}>
                Same as an option above — a student could be right and wrong at once.
              </Text>
            )}
          </Box>
          {options.length > 2 && (
            <IconButton
              mt={1}
              size="xs"
              variant="ghost"
              aria-label="Remove option"
              colorScheme="red"
              icon={<LmIcon name="delete" size={15} />}
              onClick={() => removeOption(optionIndex)}
            />
          )}
        </Flex>
      ))}
      <Button
        size="xs"
        variant="link"
        alignSelf="flex-start"
        onClick={() => onChange((current) => ({ ...current, options: [...(current.options || []), ''] }))}
      >
        + Add option
      </Button>
      {marksField}
    </Stack>
  );
}
