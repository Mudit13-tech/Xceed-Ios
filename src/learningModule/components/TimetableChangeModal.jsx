import React from 'react';
import {
  Badge,
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { LmIcon } from './Icon';

/**
 * What changed in your timetable, shown once on the way in.
 *
 * A student finds out that a class moved by arriving at an empty room. The
 * notification in the bell is the record; this is the part that cannot be
 * missed — it is put in front of them the first time they open the module
 * after the change, and then not again (see useTimetableChanges for what
 * "again" means and why dismissing it does not mark it read).
 *
 * It shows the change itself rather than a count. "Your timetable changed" is
 * not actionable at seven in the morning; "Data Structures now meets Wednesday
 * period 2, Lab-3" is.
 */

const Line = ({ children, tone }) => {
  const colors = {
    added: useColorModeValue('green.700', 'green.300'),
    removed: useColorModeValue('red.700', 'red.300'),
    moved: useColorModeValue('blue.700', 'blue.300'),
  };
  return (
    <Text fontSize="sm" color={colors[tone]} lineHeight="1.6">
      {children}
    </Text>
  );
};

const ChangeGroup = ({ payload }) => {
  const muted = useColorModeValue('gray.600', 'gray.400');
  const added = payload?.added || [];
  const removed = payload?.removed || [];
  const updated = payload?.updated || [];

  return (
    <VStack align="stretch" spacing={2}>
      {updated.map((item, i) => (
        <Box key={`u-${i}`}>
          <Line tone="moved">
            <strong>{item.subject}</strong>
            {item.faculty ? ` · ${item.faculty}` : ''}
          </Line>
          {item.room && (
            <Text fontSize="xs" color={muted} ml={3}>
              Room {item.room.from || '—'} → <strong>{item.room.to || '—'}</strong>
            </Text>
          )}
          {(item.slotsAdded || []).length > 0 && (
            <Text fontSize="xs" color={muted} ml={3}>
              Now at: {item.slotsAdded.join(', ')}
            </Text>
          )}
          {(item.slotsRemoved || []).length > 0 && (
            <Text fontSize="xs" color={muted} ml={3}>
              No longer at: {item.slotsRemoved.join(', ')}
            </Text>
          )}
        </Box>
      ))}

      {added.map((item, i) => (
        <Box key={`a-${i}`}>
          <Line tone="added">
            Added — <strong>{item.subject}</strong>
            {item.faculty ? ` · ${item.faculty}` : ''}
          </Line>
          {(item.slots || []).length > 0 && (
            <Text fontSize="xs" color={muted} ml={3}>
              {item.slots.join(' · ')}
            </Text>
          )}
        </Box>
      ))}

      {removed.map((item, i) => (
        <Box key={`r-${i}`}>
          <Line tone="removed">
            Removed — <strong>{item.subject}</strong>
            {item.faculty ? ` · ${item.faculty}` : ''}
          </Line>
          {(item.slots || []).length > 0 && (
            <Text fontSize="xs" color={muted} ml={3}>
              {item.slots.join(' · ')}
            </Text>
          )}
        </Box>
      ))}
    </VStack>
  );
};

export default function TimetableChangeModal({ changes = [], onClose }) {
  const panelBorder = useColorModeValue('gray.200', 'gray.700');
  const muted = useColorModeValue('gray.600', 'gray.400');

  // Nothing unseen: render nothing at all rather than an empty dialog.
  if (!changes.length) return null;

  return (
    <Modal isOpen onClose={onClose} size="lg" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <LmIcon name="timetable" size={18} />
            <Text>Your timetable has changed</Text>
          </HStack>
          <Text fontSize="sm" fontWeight="normal" color={muted} mt={1}>
            {changes.length === 1
              ? 'One update since you were last here.'
              : `${changes.length} updates since you were last here.`}
          </Text>
        </ModalHeader>

        <ModalBody pb={2}>
          <VStack align="stretch" spacing={4}>
            {changes.map((item) => (
              <Box
                key={item._id}
                borderWidth="1px"
                borderColor={panelBorder}
                borderRadius="md"
                p={3}
              >
                <HStack justify="space-between" mb={2} flexWrap="wrap" gap={2}>
                  <Text fontSize="sm" fontWeight="semibold">
                    {item.className || 'Your class'}
                  </Text>
                  {item.payload?.sem && (
                    <Badge colorScheme="purple" borderRadius="full">
                      Semester {item.payload.sem}
                    </Badge>
                  )}
                </HStack>
                {item.payload ? (
                  <ChangeGroup payload={item.payload} />
                ) : (
                  // A notification from before the change-set travelled with
                  // it, or one whose payload did not survive. The summary line
                  // is still true.
                  <Text fontSize="sm" color={muted}>
                    {item.body}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </ModalBody>

        <ModalFooter gap={3}>
          <Button
            as={RouterLink}
            to="/learning/timetable"
            variant="outline"
            onClick={onClose}
          >
            Open timetable
          </Button>
          <Button colorScheme="blue" onClick={onClose}>
            Got it
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
