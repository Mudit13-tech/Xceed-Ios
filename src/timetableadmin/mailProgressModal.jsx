import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Progress,
  VStack,
  HStack,
  Box,
  Text,
  Tag,
  TagLabel,
  Icon,
  Divider,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiSlash,
  FiExternalLink,
  FiMail,
} from 'react-icons/fi';

/**
 * What happened to the notification mails, while it is happening and after.
 *
 * Both mail paths in this module (locking with "inform the teachers", and
 * publishing) send every message before they answer the request, and used to
 * report the outcome in a toast that named a count and then vanished. A count
 * is not actionable: the thing a coordinator needs is *which* teacher does not
 * know their timetable moved, and a way to try again. This holds still until
 * dismissed and, for a change lock, hands over the link that can resend.
 *
 * The progress bar is deliberately indeterminate. The server does the whole
 * fan-out inside one request and reports only when finished, so there is no
 * per-recipient progress to show — and a percentage that was really just a
 * timer would be a lie about how far along the send is.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {'sending'|'done'} phase
 * @param {Array}    results   Per-recipient outcomes, once phase is 'done'.
 * @param {string}   [logId]   Change-log id, when the flow records one; its
 *                             presence is what makes a resend possible.
 * @param {string}   [heading] Overrides the default title.
 * @param {string}   [note]    Extra line under the summary.
 */
const MailProgressModal = ({
  isOpen,
  onClose,
  phase,
  results,
  logId,
  heading,
  note,
}) => {
  const navigate = useNavigate();

  const rows = results || [];
  // An opt-out is not a failure — those faculty were left out on purpose, so
  // they are counted apart from the deliveries that actually went wrong. Note
  // this reads `optedOut`, not `skipped`: the publish flow marks a duplicate
  // recipient `skipped` as well, and that person *was* mailed under their
  // other spelling, so counting them here would both double-count and mislabel
  // a delivery as an opt-out.
  const skipped = rows.filter((r) => r.optedOut);
  const sent = rows.filter((r) => r.success && !r.optedOut);
  const failed = rows.filter((r) => !r.success && !r.optedOut);
  const sending = phase === 'sending';

  const openLogs = () => {
    onClose();
    navigate(`/tt/logs?log=${logId}`);
  };

  let title = heading || 'Faculty notifications';
  if (sending) {
    title = heading || 'Sending faculty notifications';
  } else if (failed.length) {
    title = heading || 'Some notifications did not go';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      // A send in flight must not be dismissed by a stray click or Escape:
      // closing mid-request loses the only report of what happened.
      closeOnOverlayClick={!sending}
      closeOnEsc={!sending}
      isCentered
      size={{ base: 'sm', md: 'lg' }}
      scrollBehavior="inside"
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <Icon
              as={
                sending
                  ? FiMail
                  : failed.length
                  ? FiAlertCircle
                  : FiCheckCircle
              }
              color={
                sending
                  ? 'purple.500'
                  : failed.length
                  ? 'red.500'
                  : 'green.500'
              }
            />
            <Text fontSize={{ base: 'md', md: 'lg' }}>{title}</Text>
          </HStack>
        </ModalHeader>
        {!sending && <ModalCloseButton />}

        <ModalBody>
          {sending ? (
            <VStack align="stretch" spacing={4}>
              <Progress
                isIndeterminate
                colorScheme="purple"
                borderRadius="full"
                size="sm"
              />
              <Text fontSize="sm" color="gray.600">
                Emailing each affected faculty member. A large department can
                take a minute — please keep this page open.
              </Text>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={4}>
              <HStack spacing={2} wrap="wrap">
                {sent.length > 0 && (
                  <Tag colorScheme="green" variant="subtle">
                    <Icon as={FiCheckCircle} mr={1} />
                    <TagLabel>{sent.length} delivered</TagLabel>
                  </Tag>
                )}
                {failed.length > 0 && (
                  <Tag colorScheme="red" variant="subtle">
                    <Icon as={FiAlertCircle} mr={1} />
                    <TagLabel>{failed.length} failed</TagLabel>
                  </Tag>
                )}
                {skipped.length > 0 && (
                  <Tag colorScheme="gray" variant="subtle">
                    <Icon as={FiSlash} mr={1} />
                    <TagLabel>{skipped.length} mail off</TagLabel>
                  </Tag>
                )}
                {rows.length === 0 && (
                  <Tag colorScheme="gray" variant="subtle">
                    <TagLabel>No notifications were due</TagLabel>
                  </Tag>
                )}
              </HStack>

              {note && (
                <Text fontSize="sm" color="gray.600">
                  {note}
                </Text>
              )}

              {failed.length > 0 && (
                <Alert status="warning" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  <Box>
                    {failed.length === 1
                      ? 'This faculty member has not been told their timetable changed.'
                      : 'These faculty members have not been told their timetable changed.'}
                  </Box>
                </Alert>
              )}

              {failed.length > 0 && (
                <VStack align="stretch" spacing={2}>
                  {failed.map((r, i) => (
                    <Box key={`f-${i}`}>
                      <Text fontSize="sm" fontWeight="bold" color="red.600">
                        {r.faculty || r.email || 'Unknown faculty'}
                      </Text>
                      <Text fontSize="xs" color="gray.600" wordBreak="break-all">
                        {r.email || 'no address on record'}
                      </Text>
                      <Text fontSize="xs" color="red.500">
                        {r.error || 'Not sent'}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              )}

              {sent.length > 0 && failed.length > 0 && <Divider />}

              {sent.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={1}>
                    DELIVERED
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {sent.map((r) => r.faculty || r.email).join(', ')}
                  </Text>
                </Box>
              )}

              {skipped.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={1}>
                    NOT EMAILED — MAIL TURNED OFF
                  </Text>
                  <Text fontSize="xs" color="gray.600">
                    {skipped.map((r) => r.faculty || r.email).join(', ')}
                  </Text>
                </Box>
              )}
            </VStack>
          )}
        </ModalBody>

        <ModalFooter gap={3}>
          {!sending && logId && (
            <Button
              colorScheme={failed.length ? 'red' : 'purple'}
              variant={failed.length ? 'solid' : 'outline'}
              rightIcon={<FiExternalLink />}
              onClick={openLogs}
            >
              {failed.length ? 'Open mail status to resend' : 'View mail status'}
            </Button>
          )}
          <Button onClick={onClose} isDisabled={sending} variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MailProgressModal;
