import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Box,
  Icon,
  IconButton
} from '@chakra-ui/react';
import { FiUser, FiPlus, FiTrash2 } from 'react-icons/fi';

const AccountSwitcher = ({ accounts, onSelectAccount, onAddAccount, onRemoveAccount }) => {
  return (
    <VStack spacing={6} align="stretch" w="100%">
      <Box textAlign="center" mb={2}>
        <Heading size="md" color="white" mb={2}>Choose an Account</Heading>
        <Text color="gray.300">Select an account to log in or add a new one.</Text>
      </Box>

      <VStack spacing={3}>
        {accounts.map((account) => (
          <HStack
            key={account.email}
            w="100%"
            p={4}
            bg="whiteAlpha.100"
            borderWidth="1px"
            borderColor="whiteAlpha.300"
            borderRadius="md"
            justify="space-between"
            _hover={{ bg: 'whiteAlpha.200', cursor: 'pointer' }}
            transition="all 0.2s"
          >
            <HStack flex={1} onClick={() => onSelectAccount(account)}>
              <Box bg="blue.500" p={2} borderRadius="full">
                <Icon as={FiUser} color="white" boxSize={5} />
              </Box>
              <VStack align="start" spacing={0} ml={3}>
                <Text color="white" fontWeight="bold" noOfLines={1}>
                  {account.name || 'Saved Account'}
                </Text>
                <Text color="gray.400" fontSize="sm" noOfLines={1}>
                  {account.email}
                </Text>
              </VStack>
            </HStack>
            
            <IconButton
              aria-label="Remove account"
              icon={<FiTrash2 />}
              size="sm"
              variant="ghost"
              colorScheme="red"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveAccount(account.email);
              }}
            />
          </HStack>
        ))}
      </VStack>

      <Button
        leftIcon={<FiPlus />}
        onClick={onAddAccount}
        variant="outline"
        colorScheme="blue"
        w="100%"
        mt={4}
      >
        Log into another account
      </Button>
    </VStack>
  );
};

export default AccountSwitcher;
