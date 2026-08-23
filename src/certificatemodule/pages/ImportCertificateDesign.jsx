import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spinner,
  Text,
  Tooltip,
  VStack,
  Wrap,
  WrapItem,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';
import getEnvironment from '../../getenvironment';

/*
  Starting an event's certificate from scratch means retyping the institute
  name and the body, and re-uploading the same logos and signatures every time.
  This offers the designs the same owner already saved on their other events,
  and copies one of them wholesale into the form.

  Nothing is written to the server here: the copy fills the form, and it is the
  usual Save on the design page that stores it under this event. Images travel
  as the addresses they were uploaded to, so they need no second upload.
*/

const ImportCertificateDesign = ({ eventId, currentType, onImport }) => {
  const apiUrl = getEnvironment();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedType, setSelectedType] = useState('');

  const selectedEvent = sources.find(
    (source) => source.eventId === selectedEventId
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;

    const loadSources = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/certificatemodule/certificate/importsources/${eventId}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error('Could not load events');
        const payload = await response.json();
        if (cancelled) return;

        const list = Array.isArray(payload.sources) ? payload.sources : [];
        setSources(list);
        // Opening on the most recent event saves a click in the common case,
        // where the design being copied is the one just finished.
        setSelectedEventId(list[0]?.eventId || '');
        setSelectedType(list[0]?.types?.[0] || '');
      } catch (error) {
        console.error('Could not load events to import from:', error);
        if (!cancelled) setSources([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadSources();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, eventId, isOpen]);

  const handleSelectEvent = (value) => {
    setSelectedEventId(value);
    const event = sources.find((source) => source.eventId === value);
    // A type picked on the previous event rarely exists on this one, so the
    // selection follows whichever types that event actually has.
    setSelectedType(
      event?.types?.includes(selectedType)
        ? selectedType
        : event?.types?.[0] || ''
    );
  };

  const handleImport = async () => {
    if (!selectedEventId || !selectedType) return;

    setIsImporting(true);
    try {
      const response = await fetch(
        `${apiUrl}/certificatemodule/certificate/getcertificatedetails/${selectedEventId}/${selectedType}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Could not read that design');

      const payload = await response.json();
      const doc =
        Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
      if (!doc) throw new Error('That design is no longer available');

      onImport(doc);

      toast({
        title: 'Design imported',
        description: `Copied from "${
          selectedEvent?.name || 'event'
        }". Save to keep it on this event.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      });
      onClose();
    } catch (error) {
      console.error('Could not import the design:', error);
      toast({
        title: 'Import failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Tooltip
        label="Copy the whole design — text, logos, signatures and template — from one of your other events"
        hasArrow
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          colorScheme="purple"
          leftIcon={<DownloadIcon />}
          onClick={onOpen}
        >
          Import from another event
        </Button>
      </Tooltip>

      <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Import certificate design</ModalHeader>
          <ModalCloseButton />

          <ModalBody>
            <Text fontSize="sm" color="gray.600" mb={4}>
              Pick a design from one of your other events. Its institute name,
              header, body text, logos, signatures, template and QR placement
              are all copied into the form for the{' '}
              <Text as="span" fontWeight="semibold" textTransform="capitalize">
                {currentType || 'current'}
              </Text>{' '}
              certificate. Nothing is stored until you save.
            </Text>

            {isLoading ? (
              <Center py={10}>
                <Spinner color="purple.500" />
              </Center>
            ) : sources.length === 0 ? (
              <Box
                borderWidth="1px"
                borderColor="gray.200"
                borderRadius="md"
                py={8}
                textAlign="center"
              >
                <Text color="gray.600" fontWeight="medium">
                  Nothing to import yet.
                </Text>
                <Text color="gray.500" fontSize="sm" mt={1}>
                  Designs from your other events will appear here once they are
                  saved.
                </Text>
              </Box>
            ) : (
              <RadioGroup value={selectedEventId} onChange={handleSelectEvent}>
                <VStack align="stretch" spacing={3}>
                  {sources.map((source) => {
                    const isSelected = source.eventId === selectedEventId;
                    return (
                      <Box
                        key={source.eventId}
                        borderWidth="1px"
                        borderColor={isSelected ? 'purple.400' : 'gray.200'}
                        bg={isSelected ? 'purple.50' : 'white'}
                        borderRadius="md"
                        px={3}
                        py={3}
                      >
                        <Radio value={source.eventId} colorScheme="purple">
                          <Flex align="baseline" gap={2} wrap="wrap">
                            <Text fontWeight="semibold">{source.name}</Text>
                            {source.ExpiryDate && (
                              <Text fontSize="xs" color="gray.500">
                                {new Date(source.ExpiryDate).toLocaleDateString(
                                  'en-GB'
                                )}
                              </Text>
                            )}
                          </Flex>
                        </Radio>

                        {/* Which of that event's certificates to copy. Shown
                            only on the selected event, so the list stays
                            readable when there are many events. */}
                        {isSelected && (
                          <Wrap spacing={2} mt={3} pl={6}>
                            {source.types.map((type) => (
                              <WrapItem key={type}>
                                <Badge
                                  as="button"
                                  type="button"
                                  onClick={() => setSelectedType(type)}
                                  px={3}
                                  py={1}
                                  borderRadius="md"
                                  borderWidth="1px"
                                  textTransform="capitalize"
                                  colorScheme={
                                    selectedType === type ? 'purple' : 'gray'
                                  }
                                  variant={
                                    selectedType === type ? 'solid' : 'outline'
                                  }
                                >
                                  {type}
                                </Badge>
                              </WrapItem>
                            ))}
                          </Wrap>
                        )}
                      </Box>
                    );
                  })}
                </VStack>
              </RadioGroup>
            )}
          </ModalBody>

          <ModalFooter>
            <HStack spacing={3}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="purple"
                onClick={handleImport}
                isLoading={isImporting}
                isDisabled={!selectedEventId || !selectedType}
              >
                Import design
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ImportCertificateDesign;
