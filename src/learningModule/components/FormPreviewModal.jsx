import React from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
} from '@chakra-ui/react';
import FormRenderer from './FormRenderer';

/**
 * FormPreviewModal
 * Provides a faculty preview of how a form will look and behave for students.
 * Purely visual — responses submitted in preview mode display a notice and are not saved.
 */
export default function FormPreviewModal({ isOpen, onClose, form, classId }) {
  const toast = useToast();

  if (!form) return null;

  const questions = form.questions || [];

  const handlePreviewSubmit = async () => {
    toast({
      status: 'info',
      title: 'Preview submission',
      description: 'This is a preview. Form response was not saved.',
      duration: 4000,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} pr={8}>
            <Box>
              <Text fontSize="lg" fontWeight="700">
                👁️ Student Preview: {form.title || 'Untitled form'}
              </Text>
              <Text fontSize="xs" color="lmFg.muted" fontWeight="normal">
                {questions.length} question{questions.length === 1 ? '' : 's'}
              </Text>
            </Box>
          </Flex>
        </ModalHeader>

        <ModalCloseButton />

        <ModalBody py={4}>
          <Alert status="info" borderRadius="md" mb={4} fontSize="xs">
            <AlertIcon />
            <Box>
              <Text fontWeight="600">Student View Preview</Text>
              Visual inspection mode for faculty to check question formatting and form layout.
              Responses submitted here are local and not saved.
            </Box>
          </Alert>

          {questions.length === 0 ? (
            <Text fontSize="sm" color="lmFg.muted" py={6} textAlign="center">
              No questions added to this form yet.
            </Text>
          ) : (
            <FormRenderer
              form={form}
              onSubmit={handlePreviewSubmit}
              submitting={false}
              canUploadFiles
              classId={classId}
            />
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px">
          <Button colorScheme="gray" onClick={onClose}>
            Close Preview
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
