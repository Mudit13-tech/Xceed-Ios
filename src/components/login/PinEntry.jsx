import React, { useState, useEffect } from 'react';
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
  Box
} from '@chakra-ui/react';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { redirectTargetFrom } from '../../authRedirect';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBiometricAuth } from '../../utils/useBiometricAuth';

const PinEntry = ({ onCancel, isSetup, onSetupComplete, loginToken }) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAvailable, authenticate } = useBiometricAuth();

  useEffect(() => {
    if (!isSetup) {
      const runBiometric = async () => {
        const available = await isAvailable();
        if (available) {
          const result = await authenticate();
          if (result.success) {
            setIsLoading(true);
            try {
              const storedTokenResult = await SecureStoragePlugin.get({ key: 'auth_token' });
              if (storedTokenResult.value) {
                 localStorage.setItem('token', storedTokenResult.value);
                 window.location.href = redirectTargetFrom(location.search) || '/userroles';
              } else {
                 throw new Error('Token missing');
              }
            } catch (err) {
              console.error(err);
              toast({ title: 'Error logging in', status: 'error', duration: 3000 });
            } finally {
              setIsLoading(false);
            }
          }
        }
      };
      runBiometric();
    }
  }, [isSetup]);

  const handlePinComplete = async (value) => {
    setPin(value);
  };

  const handleSubmit = async (currentPin = pin) => {
    // If called via onClick, currentPin is a React Event, so fallback to the state 'pin'
    if (typeof currentPin !== 'string') currentPin = pin;
    
    if (currentPin.length !== 4) return;
    setIsLoading(true);
    
    try {
      if (isSetup) {
        // Save PIN and Token to Secure Storage
        await SecureStoragePlugin.set({ key: 'user_pin', value: currentPin });
        await SecureStoragePlugin.set({ key: 'auth_token', value: loginToken });
        
        toast({
          title: 'PIN configured successfully.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Also ensure token is in localStorage so rest of app works
        localStorage.setItem('token', loginToken);
        
        if (onSetupComplete) {
          onSetupComplete();
        } else {
          navigate('/userroles');
        }
      } else {
        // Verify PIN
        const storedPinResult = await SecureStoragePlugin.get({ key: 'user_pin' });
        const storedPin = storedPinResult.value;
        
        if (currentPin === storedPin) {
          // Success! Restore token to localStorage and navigate
          const storedTokenResult = await SecureStoragePlugin.get({ key: 'auth_token' });
          if (storedTokenResult.value) {
             localStorage.setItem('token', storedTokenResult.value);
             window.location.href = redirectTargetFrom(location.search) || '/userroles';
          } else {
             throw new Error('Token missing');
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
      if (errMsg.includes('token') || errMsg.includes('not found') || errMsg.includes('invalid') || errMsg.includes('exist')) {
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
      await SecureStoragePlugin.remove({ key: 'user_pin' });
      await SecureStoragePlugin.remove({ key: 'auth_token' });
      localStorage.removeItem('token');
      if (onCancel) onCancel();
    } catch (e) {
      console.error(e);
      if (onCancel) onCancel();
    }
  };

  return (
    <VStack spacing={6} align="center" w="100%">
      <Heading size="md" color="white">{isSetup ? 'Create a 4-Digit PIN' : 'Enter your PIN'}</Heading>
      <Text color="gray.300" textAlign="center">
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
            <Link color="blue.300" onClick={handleResetPin} fontSize="sm">
              Switch Account
            </Link>
          </VStack>
        ) : (
          <Link color="gray.400" onClick={() => {
            // Skip PIN setup
            localStorage.setItem('token', loginToken);
            if (onSetupComplete) onSetupComplete();
            else navigate('/userroles');
          }} fontSize="sm">
            Skip for now
          </Link>
        )}
      </Box>
    </VStack>
  );
};

export default PinEntry;
