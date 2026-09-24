import React, { useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiLogOut } from 'react-icons/fi';

/**
 * The "are you sure you want to log out?" dialog, in one place.
 *
 * It was the same eight lines of bare Modal copied into the platform navbar and
 * the learning-module header, which is how the two drifted: one closed on an
 * overlay click and the other did not, and neither said what logging out would
 * actually do. One component instead, so the answer to "what happens if I press
 * this" is the same wherever it is asked.
 *
 * ## Why AlertDialog rather than Modal
 *
 * This is a confirmation with a destructive-ish default, which is precisely what
 * `AlertDialog` is for: it carries `role="alertdialog"`, so a screen reader
 * announces the question rather than reading an unlabelled container, and
 * `leastDestructiveRef` puts the initial focus on **Cancel**. That matters here
 * more than it looks — the previous Modal focused nothing in particular, so
 * somebody who opened this by keyboard and pressed Enter out of habit was signed
 * out by the same keystroke that opened the question. The overlay is not a way
 * out either (`closeOnOverlayClick={false}`), so the answer is always a
 * deliberate one; Escape still cancels, because leaving by the key that means
 * "never mind" is not the risky direction.
 *
 * ## Why it holds the pending state
 *
 * Logging out is a network round trip. Both callers used to close the dialog
 * the instant the button was pressed and then do the work behind it, so on a
 * slow connection the page sat there looking signed in with nothing happening —
 * and a second press, on a button that was still on screen a moment ago, fired
 * a second request. Here the button reports itself busy and the dialog stays up
 * until `onConfirm` settles, which also makes the button the one thing that can
 * be pressed twice impossible to press twice.
 */
const LogoutConfirmModal = ({ isOpen, onClose, onConfirm, accountLabel = '' }) => {
  const cancelRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const markBg = useColorModeValue('red.50', 'rgba(254, 178, 178, 0.14)');
  const markColor = useColorModeValue('red.500', 'red.300');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const panelBg = useColorModeValue('gray.50', 'whiteAlpha.100');
  const panelBorder = useColorModeValue('gray.200', 'whiteAlpha.300');

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      /* The caller navigates away on success, so this usually runs against an
         unmounted dialog — harmless, and the alternative (leaving it busy) is
         a dead button on the failure path, which is the path that needs it. */
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      isOpen={isOpen}
      onClose={onClose}
      leastDestructiveRef={cancelRef}
      isCentered
      closeOnOverlayClick={false}
      motionPreset="slideInBottom"
      size="sm"
    >
      <AlertDialogOverlay bg="blackAlpha.600" backdropFilter="blur(3px)">
        <AlertDialogContent borderRadius="xl" mx={4} overflow="hidden">
          <AlertDialogBody pt={7} pb={5} px={6}>
            <Flex direction="column" align="center" textAlign="center" gap={3}>
              <Flex
                align="center"
                justify="center"
                boxSize={12}
                borderRadius="full"
                bg={markBg}
                color={markColor}
              >
                <Icon as={FiLogOut} boxSize={6} />
              </Flex>
              <Text fontSize="lg" fontWeight="700">
                Log out of XCEED?
              </Text>
              <Text fontSize="sm" color={subColor} lineHeight="1.6">
                You will be signed out on this device and returned to the login page.
                Nothing you have saved is lost — sign back in to pick up where you left off.
              </Text>
              {/* Which account, when the caller knows. On a shared lab machine
                  "log out" is ambiguous in the one way that matters, and the
                  address is the only thing that settles it. */}
              {accountLabel ? (
                <Box
                  w="full"
                  mt={1}
                  px={3}
                  py={2}
                  borderWidth="1px"
                  borderColor={panelBorder}
                  borderRadius="md"
                  bg={panelBg}
                >
                  <Text fontSize="xs" color={subColor} textTransform="uppercase" letterSpacing="0.06em" fontWeight="700">
                    Signed in as
                  </Text>
                  <Text fontSize="sm" fontWeight="600" wordBreak="break-word">
                    {accountLabel}
                  </Text>
                </Box>
              ) : null}
            </Flex>
          </AlertDialogBody>
          <AlertDialogFooter px={6} pb={6} pt={0}>
            {/* Full width and stacked-friendly: on a phone two buttons sharing a
                row end up narrow enough that the wrong one is easy to hit, and
                this is a dialog where hitting the wrong one costs a login. */}
            <HStack spacing={3} w="full">
              <Button ref={cancelRef} onClick={onClose} variant="outline" flex="1" isDisabled={busy}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={confirm} flex="1" isLoading={busy} loadingText="Logging out">
                Log out
              </Button>
            </HStack>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default LogoutConfirmModal;
