import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Badge, Box, Button, Flex, HStack, Heading, Text } from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { CopyLinkButton, DeadlineCountdown, SectionCard, requestFullscreen } from './common';
import DeleteButton from './DeleteButton';

/**
 * One form in a list. Shared by the Forms tab and the Assignments tab — a form
 * with the Assignment category is listed on both, with the same actions.
 */
export default function FormCard({ form, classId, isTeacher, onDeleted, onPreview, showCategory = true }) {
  return (
    <SectionCard mb={3}>
      <Flex align="center" gap={4} wrap="wrap">
        <Box flex="1" minW="220px">
          <HStack wrap="wrap">
            <Heading size="sm">{form.title}</Heading>
            {showCategory && form.category === 'assignment' && <Badge colorScheme="orange">Assignment</Badge>}
            {isTeacher && (
              <Badge colorScheme={form.published ? 'green' : 'gray'}>
                {form.published ? 'Published' : 'Draft'}
              </Badge>
            )}
            {isTeacher && form.settings?.accessMode === 'anyone' && (
              <Badge colorScheme="purple">Anyone with the link</Badge>
            )}
            {form.closed && <Badge colorScheme="red">Closed</Badge>}
            {!form.closed && form.dueDate && <DeadlineCountdown dueDate={form.dueDate} prefix="Closes in" />}
          </HStack>
          {form.description && (
            <Text fontSize="sm" color="lmFg.subtle" noOfLines={2} mt={1}>
              {form.description}
            </Text>
          )}
          <Text fontSize="xs" color="lmFg.muted" mt={1}>
            {form.questions?.length ?? form.questionCount ?? 0} question(s)
            {isTeacher
              ? form.settings?.accessMode === 'class'
                ? ` · ${form.responseCount ?? 0}/${form.enrolledCount ?? 0} students filled`
                : ` · ${form.responseCount ?? 0} response(s)`
              : ''}
          </Text>
          {!isTeacher && form.responded && <Badge colorScheme="green" mt={1}>Responded</Badge>}
        </Box>

        <HStack>
          {isTeacher ? (
            <>
              {form.published && form.shareCode && (
                <CopyLinkButton to={`/learning/form/link/${form.shareCode}`} size="sm" />
              )}
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/form/${form._id}/edit`}
                size="sm"
                variant="outline"
              >
                Edit
              </Button>
              <Button size="sm" variant="outline" colorScheme="purple" onClick={() => onPreview(form)}>
                Preview
              </Button>
              <Button
                as={RouterLink}
                to={`/learning/class/${classId}/form/${form._id}/responses`}
                size="sm"
                variant="outline"
              >
                Responses
              </Button>
              <DeleteButton
                label="Delete form"
                onClick={async () => {
                  // eslint-disable-next-line no-alert
                  if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
                  try {
                    await lmApi.deleteForm(classId, form._id);
                    onDeleted();
                  } catch (err) {
                    // eslint-disable-next-line no-alert
                    window.alert(err.message);
                  }
                }}
              />
            </>
          ) : (
            <Button
              as={RouterLink}
              to={`/learning/class/${classId}/form/${form._id}`}
              size="sm"
              colorScheme="teal"
              isDisabled={form.closed}
              onClick={() => {
                // Fired synchronously inside the click, so it still counts as
                // a user gesture by the time the form itself has loaded.
                if (form.autoFullscreen) requestFullscreen();
              }}
            >
              {form.closed ? 'Closed' : form.responded ? 'View / edit response' : 'Fill in'}
            </Button>
          )}
        </HStack>
      </Flex>
    </SectionCard>
  );
}
