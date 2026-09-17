import React, { useId, useState } from 'react';
import { Box, Button } from '@chakra-ui/react';

import RichText from './RichText';
import { LmIcon } from './Icon';

/**
 * A question's hint, behind a press.
 *
 * It used to be printed into the card the moment the question opened. "Show
 * hints" defaults on and most hints are the method written out, so that put the
 * working in front of every student before they had tried anything — the paper
 * explaining itself to someone who came to answer it. The hint is still one
 * press away; it is just a press they have to make, which is also what makes
 * asking for it mean something.
 *
 * Not remembered across a reload, deliberately: this is the state of the
 * question in front of them, not a record of anything. The teacher's own "Show
 * hints" switch still decides whether there is a press to make at all — an
 * empty hint renders nothing rather than an offer that opens onto nothing.
 */
export default function QuestionHint({ hint }) {
  const [shown, setShown] = useState(false);
  const regionId = useId();

  if (!hint) return null;

  return (
    <Box mb={3}>
      <Button
        size="sm"
        variant="ghost"
        fontSize="xs"
        color="blue.600"
        aria-expanded={shown}
        aria-controls={regionId}
        onClick={() => setShown((was) => !was)}
        leftIcon={
          <Box as="span" color="orange.400" display="inline-flex">
            <LmIcon name="tip" size={16} />
          </Box>
        }
      >
        {shown ? 'Hide hint' : 'Show hint'}
      </Button>
      {/* Kept in the tree and hidden, rather than unmounted, so `aria-controls`
          always resolves to something. `hidden` takes it out of the accessibility
          tree too, so a closed hint is not read out on the way past. */}
      <Box id={regionId} hidden={!shown} fontSize="xs" color="blue.600" mt={2} ml={1}>
        <RichText fontSize="xs" color="blue.600">
          {hint}
        </RichText>
      </Box>
    </Box>
  );
}
