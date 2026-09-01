import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import getEnvironment from '../../getenvironment';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Text,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon, CheckIcon } from '@chakra-ui/icons';

const UserEventRegistration = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const apiUrl = getEnvironment();

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ExpiryDate: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Event name required',
        description: 'Give the event a name before creating it.',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/certificatemodule/addevent/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const responseData = await response.json();

      if (response.ok) {
        toast({
          title: 'Event Added',
          description: 'Event created successfully',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
        navigate('/cm/dashboard');
      } else {
        console.error('Error submitting form:', responseData.error || response.statusText);
        toast({
          title: 'Error',
          description: responseData.error || 'Failed to add event',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: 'Failed to add event',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxW="3xl" pb={10}>
      <Box
        mt={4}
        mb={5}
        px={{ base: 5, md: 8 }}
        py={{ base: 6, md: 7 }}
        borderRadius="2xl"
        bgGradient="linear(to-r, teal.600, blue.600)"
        color="white"
        boxShadow="lg"
      >
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ md: 'flex-start' }}
          justify="space-between"
          gap={4}
        >
          <Box>
            <Text fontSize="xs" textTransform="uppercase" letterSpacing="widest" opacity={0.85}>
              Certificate Module
            </Text>
            <Heading size="lg" mt={1}>
              New Event
            </Heading>
            <Text mt={2} fontSize="sm" opacity={0.9}>
              Name the event and set its date. You can design certificates and add participants
              from the dashboard once it is created.
            </Text>
          </Box>

          <Button
            leftIcon={<ArrowBackIcon />}
            variant="outline"
            color="white"
            borderColor="whiteAlpha.700"
            _hover={{ bg: 'whiteAlpha.200' }}
            onClick={() => navigate('/cm/dashboard')}
            flexShrink={0}
          >
            Back to Dashboard
          </Button>
        </Flex>
      </Box>

      <Box
        as="form"
        onSubmit={handleSubmit}
        borderWidth="1px"
        borderColor="gray.100"
        borderRadius="xl"
        bg="white"
        boxShadow="sm"
        px={{ base: 5, md: 8 }}
        py={{ base: 6, md: 7 }}
      >
        <FormControl mb="5" isRequired>
          <FormLabel>Event Name</FormLabel>
          <Input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g. National Workshop on Data Science"
            focusBorderColor="teal.500"
          />
        </FormControl>

        <FormControl mb="6">
          <FormLabel>Event Date</FormLabel>
          <Input
            type="date"
            name="ExpiryDate"
            value={formData.ExpiryDate}
            onChange={handleChange}
            focusBorderColor="teal.500"
          />
          <Text mt={2} fontSize="xs" color="gray.500">
            Shown on the certificate and used to order events on the dashboard.
          </Text>
        </FormControl>

        <Flex gap={3} justify="flex-end" wrap="wrap">
          <Button variant="ghost" onClick={() => navigate('/cm/dashboard')}>
            Cancel
          </Button>
          <Button
            type="submit"
            colorScheme="teal"
            leftIcon={<CheckIcon />}
            isLoading={submitting}
            loadingText="Creating"
          >
            Create Event
          </Button>
        </Flex>
      </Box>
    </Container>
  );
};

export default UserEventRegistration;
