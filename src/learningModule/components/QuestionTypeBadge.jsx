import React from 'react';
import { Badge } from '@chakra-ui/react';
import { QUESTION_TYPES, questionTypeOf } from '../questionTypes';

/**
 * The question's type, in that type's colour.
 *
 * Takes either the question (anything with a `type`) or a bare `type`. A
 * question with no type is the random-variable kind, as everywhere else.
 * `short` gives the abbreviated label for cramped places such as the tab strip.
 */
export default function QuestionTypeBadge({ question, type, short = false, ...props }) {
  const kind = questionTypeOf(type !== undefined ? { type } : question);
  const meta = QUESTION_TYPES.find((entry) => entry.value === kind);
  return (
    <Badge
      colorScheme={meta.colorScheme}
      variant="subtle"
      textTransform={short ? 'uppercase' : 'none'}
      whiteSpace="nowrap"
      {...props}
    >
      {short ? meta.short : meta.label}
    </Badge>
  );
}
