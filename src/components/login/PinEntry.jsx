import React, { useState } from 'react';
import {
  VStack,
  HStack,
  PinInput,
  PinInputField,
  Button,
  Text,
  Heading,
  useToast,
  Link,
  Box,
  Avatar
} from '@chakra-ui/react';
import { redirectTargetFrom } from '../../authRedirect';
import { Preferences } from '@capacitor/preferences';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const PinEntry = ({
  onCancel,
  isSetup,
  onSetupComplete,
  activeAccount,
  saveAccount,
  removeAccount,
  updateLastActiveEmail
}) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const handlePinComplete = async (value) => {
    setPin(value);
  };

  const handleSubmit = async (currentPin = pin) => {
    if (typeof currentPin !== 'string') currentPin = pin;

    if (currentPin.length !== 4) return;
    setIsLoading(true);

    try {
      if (isSetup) {
        // Save PIN and Token to Secure Storage via account manager
        await saveAccount({ ...activeAccount, pin: currentPin });

        toast({
          title: 'PIN configured successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Ensure token is in localStorage so rest of app works
        localStorage.setItem('token', activeAccount.token);

        if (onSetupComplete) {
          onSetupComplete();
        } else {
          const { value: pending } = await Preferences.get({ key: 'pendingRoute' });
          if (pending) {
            await Preferences.remove({ key: 'pendingRoute' });
            window.location.href = pending;
          } else {
            window.location.href = redirectTargetFrom(location.search) || '/userroles';
          }
        }
      } else {
        // Verify PIN
        const storedPin = activeAccount?.pin;

        if (currentPin === storedPin) {
          // Success! Restore token to localStorage and navigate
          if (activeAccount?.token) {
            if (updateLastActiveEmail) {
              await updateLastActiveEmail(activeAccount.email);
            }
            localStorage.setItem('token', activeAccount.token);
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
            
            const { value: pending } = await Preferences.get({ key: 'pendingRoute' });
            if (pending) {
              await Preferences.remove({ key: 'pendingRoute' });
              window.location.href = pending;
            } else {
              window.location.href = redirectTargetFrom(location.search) || '/userroles';
            }
          } else {
            throw new Error('Token missing from saved account');
          }
        } else {
          toast({
            title: 'Incorrect PIN.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          setPin('');
        }
      }
    } catch (error) {
      console.error(error);
      const errMsg = (error.message || '').toLowerCase();
      if (errMsg.includes('token') || errMsg.includes('not found')) {
        handleResetPin();
        return;
      }
      toast({
        title: 'Error processing PIN.',
        description: error.message || 'Please try again.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPin = async () => {
    try {
      if (removeAccount && activeAccount) {
        await removeAccount(activeAccount.email);
      }
      localStorage.removeItem('token');
      if (onCancel) onCancel();
    } catch (e) {
      console.error(e);
      if (onCancel) onCancel();
    }
  };

  const handleSwitchAccount = () => {
    if (onCancel) onCancel();
  };

  return (
    <VStack spacing={6} align="center" w="100%">
      {activeAccount && (
        <VStack spacing={1} mb={2}>
          <Avatar size="lg" name={activeAccount.name || activeAccount.email} bg="blue.500" color="white" />
          <Heading size="md" color="gray.800" mt={2}>
            Welcome, {activeAccount.name ? activeAccount.name.split(' ')[0] : 'User'}!
          </Heading>
          <Text color="gray.500" fontSize="sm">{activeAccount.email}</Text>
        </VStack>
      )}

      <Heading 
        size="md" 
        color="gray.800" 
        display={activeAccount && !isSetup ? 'none' : 'block'}
      >
        {isSetup ? 'Create a 4-Digit PIN' : 'Enter your PIN'}
      </Heading>
      <Text color="gray.500" textAlign="center">
        {isSetup
          ? 'Set a PIN for quick access in the future.'
          : 'Use your PIN to quickly access your account.'}
      </Text>

      <HStack>
        <PinInput
          type="number"
          value={pin}
          onChange={(val) => {
            setPin(val);
            if (val.length === 4 && !isSetup) {
              handleSubmit(val);
            }
          }}
          onComplete={handlePinComplete}
          mask
          autoFocus
        >
          <PinInputField bg="white" color="black" />
          <PinInputField bg="white" color="black" />
          <PinInputField bg="white" color="black" />
          <PinInputField bg="white" color="black" />
        </PinInput>
      </HStack>

      <Button
        isLoading={isLoading}
        onClick={handleSubmit}
        isDisabled={pin.length !== 4}
        colorScheme='blackAlpha'
        bg={'blackAlpha.900 !important'}
        width={'100%'}
        mt={4}
      >
        {isSetup ? 'Save PIN' : 'Unlock'}
      </Button>

      <Box mt={4}>
        {!isSetup ? (
          <VStack spacing={2}>
            <Link color="blue.300" onClick={handleResetPin} fontSize="sm">
              Forgot PIN? Login with Password
            </Link>
            <Link color="blue.300" onClick={handleSwitchAccount} fontSize="sm">
              Switch Account
            </Link>
          </VStack>
        ) : (
          <Link color="gray.400" onClick={async () => {
            // Skip PIN setup - save account without PIN
            await saveAccount({ ...activeAccount, pin: null });
            localStorage.setItem('token', activeAccount.token);
            if (onSetupComplete) {
              onSetupComplete();
            } else {
              const { value: pending } = await Preferences.get({ key: 'pendingRoute' });
              if (pending) {
                await Preferences.remove({ key: 'pendingRoute' });
                window.location.href = pending;
              } else {
                window.location.href = redirectTargetFrom(location.search) || '/userroles';
              }
            }
          }} fontSize="sm">
            Skip for now
          </Link>
        )}
      </Box>
    </VStack>
  );
};

export default PinEntry;
