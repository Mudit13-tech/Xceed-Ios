import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  IconButton,
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
import { FiMaximize2, FiMinimize2 } from 'react-icons/fi';
import FormRenderer from './FormRenderer';
import { LmIcon } from './Icon';

/**
 * FormPreviewModal
 * Provides a faculty preview of how a form will look and behave for students.
 * Purely visual — responses submitted in preview mode display a notice and are not saved.
 */
export default function FormPreviewModal({ isOpen, onClose, form, classId }) {
  const toast = useToast();
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsFullScreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isOpen]);

  const toggleFullScreen = async () => {
    if (!isFullScreen) {
      setIsFullScreen(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {}
    } else {
      setIsFullScreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (err) {}
    }
  };

  const handleClose = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullScreen(false);
    onClose();
  };

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
    <Modal isOpen={isOpen} onClose={handleClose} size={isFullScreen ? 'full' : '4xl'} scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(3px)" />
      <ModalContent borderRadius={isFullScreen ? '0' : 'xl'}>
        <ModalHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} pr={8}>
            <Box>
              <Text fontSize="lg" fontWeight="700">
                <LmIcon name="preview" size={17} style={{ marginRight: 6 }} />
            Student Preview: {form.title || 'Untitled form'}
              </Text>
              <Text fontSize="xs" color="lmFg.muted" fontWeight="normal">
                {questions.length} question{questions.length === 1 ? '' : 's'}
              </Text>
            </Box>
            <IconButton
              icon={isFullScreen ? <FiMinimize2 /> : <FiMaximize2 />}
              aria-label={isFullScreen ? 'Exit full screen' : 'Full screen'}
              title={isFullScreen ? 'Exit full screen' : 'Full screen'}
              size="sm"
              variant="ghost"
              onClick={toggleFullScreen}
            />
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
          <Button colorScheme="gray" onClick={handleClose}>
            Close Preview
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
