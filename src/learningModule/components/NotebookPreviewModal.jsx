import React from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import RichText from './RichText';

/**
 * The notebook as a student will actually receive it.
 *
 * ## Why this is not "Open Python sample"
 *
 * That button creates a ready-made *template* to edit — a different notebook,
 * with somebody else's cells in it. It answers "what does a good exercise look
 * like", which is useful once. This answers "what does *mine* look like to the
 * class", which is the question a teacher has every time they publish.
 *
 * ## What it is showing
 *
 * The same filtering the server does in `seedAttemptCells` and `publicTestCase`,
 * applied here so a teacher can see the consequences of their own switches
 * without a second account:
 *
 *   - **Hidden cells are gone.** They run into the kernel before the student's
 *     cells and are never shown, so a teacher who put the answer in one can see
 *     that it is not on screen.
 *   - **Locked cells are marked**, because the student cannot edit them.
 *   - **Sample cases are shown in full**; hidden ones are a count, because that
 *     is all the student's browser is sent.
 *
 * It is deliberately not runnable. A preview that started a kernel would be the
 * player, and the player is one click away on a published notebook — this is for
 * checking what is *visible*, which is the thing that goes wrong silently.
 */
export default function NotebookPreviewModal({ isOpen, onClose, notebook, cells = [], language }) {
  const label = language === 'c' ? 'C' : 'Python';
  const visible = [...cells]
    .filter((cell) => !cell.hidden)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const hiddenCount = cells.length - visible.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={3} wrap="wrap">
            <Text>Student preview</Text>
            <Badge colorScheme="purple">{label}</Badge>
            {!notebook?.published && <Badge colorScheme="gray">Draft — not visible yet</Badge>}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {!notebook?.published && (
              <Alert status="info" borderRadius="md" fontSize="sm" py={2}>
                <AlertIcon />
                This is a draft. Students see nothing at all until you press Save &amp; publish.
              </Alert>
            )}

            <Box>
              <Heading size="md">{notebook?.title || 'Untitled notebook'}</Heading>
              {notebook?.description && (
                <Text fontSize="sm" opacity={0.8} mt={1}>
                  {notebook.description}
                </Text>
              )}
              <HStack spacing={3} mt={2} fontSize="xs" opacity={0.7} wrap="wrap">
                <Text>{visible.length} {visible.length === 1 ? 'cell' : 'cells'} visible</Text>
                {hiddenCount > 0 && <Text>· {hiddenCount} hidden setup not shown</Text>}
                {notebook?.dueDate && (
                  <Text>· due {new Date(notebook.dueDate).toLocaleString()}</Text>
                )}
              </HStack>
            </Box>

            <Divider />

            {visible.length === 0 ? (
              <Alert status="warning" borderRadius="md" fontSize="sm">
                <AlertIcon />
                Every cell in this notebook is hidden setup, so a student would open it and find an
                empty page. Un-hide at least one cell.
              </Alert>
            ) : (
              visible.map((cell, index) => (
                <PreviewCell key={cell._id || index} cell={cell} index={index} language={language} />
              ))
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button size="sm" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function PreviewCell({ cell, index, language }) {
  const samples = (cell.testCases || []).filter((tc) => tc.isSample);
  const hidden = (cell.testCases || []).length - samples.length;

  if (cell.type === 'markdown') {
    return (
      <Box borderWidth="1px" borderRadius="md" borderColor="lmBorder.subtle" p={3}>
        <Badge fontSize="2xs" mb={2}>Text</Badge>
        <RichText value={cell.source} />
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="md" borderColor="lmBorder.base" overflow="hidden">
      <Flex
        px={3}
        py={1.5}
        bg="lmBg.sunken"
        align="center"
        gap={2}
        wrap="wrap"
        borderBottomWidth="1px"
        borderColor="lmBorder.subtle"
      >
        <Badge fontSize="2xs">Code {index + 1}</Badge>
        {cell.locked && (
          <Badge colorScheme="orange" fontSize="2xs">Locked — they can run it, not edit it</Badge>
        )}
        {samples.length > 0 && (
          <Badge colorScheme="blue" fontSize="2xs">
            {samples.length} sample shown
          </Badge>
        )}
        {hidden > 0 && (
          <Badge colorScheme="purple" fontSize="2xs">
            {hidden} hidden {hidden === 1 ? 'test' : 'tests'}
          </Badge>
        )}
      </Flex>

      <Box as="pre" fontFamily="mono" fontSize="xs" p={3} overflowX="auto" m={0}>
        {cell.source || '(empty cell)'}
      </Box>

      {cell.stdin ? (
        <Box px={3} pb={3}>
          <Text fontSize="2xs" fontWeight="600" opacity={0.6} mb={0.5}>
            Input ({language === 'c' ? 'what scanf reads' : 'what input() reads'})
          </Text>
          <Box as="pre" fontFamily="mono" fontSize="xs" m={0} overflowX="auto">
            {cell.stdin}
          </Box>
        </Box>
      ) : null}

      {samples.length > 0 && (
        <Box bg="lmHue.blue50" borderTopWidth="1px" borderColor="lmBorder.subtle" p={3}>
          <Text fontSize="2xs" fontWeight="700" color="lmHue.blue700" textTransform="uppercase" mb={2}>
            Sample the student sees
          </Text>
          <VStack align="stretch" spacing={2}>
            {samples.map((tc, i) => (
              <Flex key={tc._id || i} gap={4} direction={{ base: 'column', sm: 'row' }}>
                <Box flex="1" minW={0}>
                  <Text fontSize="2xs" opacity={0.6}>Input</Text>
                  <Box as="pre" fontFamily="mono" fontSize="xs" m={0} overflowX="auto">
                    {tc.input || '(none)'}
                  </Box>
                </Box>
                <Box flex="1" minW={0}>
                  <Text fontSize="2xs" opacity={0.6}>Should print</Text>
                  <Box as="pre" fontFamily="mono" fontSize="xs" m={0} overflowX="auto" color="lmHue.blue700">
                    {tc.output}
                  </Box>
                </Box>
              </Flex>
            ))}
          </VStack>
        </Box>
      )}

      {hidden > 0 && samples.length === 0 && (
        <Box px={3} pb={3}>
          <Alert status="warning" borderRadius="md" fontSize="xs" py={2}>
            <AlertIcon />
            {hidden} hidden {hidden === 1 ? 'test' : 'tests'} and no sample. The student is never told
            what format to print, and an otherwise-correct answer will fail on it.
          </Alert>
        </Box>
      )}
    </Box>
  );
}
