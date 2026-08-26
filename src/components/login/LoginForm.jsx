import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from "react-router-dom";
import { useBiometricAuth } from '../../utils/useBiometricAuth';
import { useQueryClient } from '@tanstack/react-query';
import FormHeader from './FormHeader'
import { isSafeExamBrowser } from '../../learningModule/sebDiagnosis'
import getEnvironment from '../../getenvironment'
import { redirectTargetFrom } from '../../authRedirect'
import PinEntry from './PinEntry'
import AccountSwitcher from './AccountSwitcher'
import { useAccountManager } from '../../utils/useAccountManager'
import {
  Box,
  Button,
  HStack,
  Image,
  Input,
  Link,
  Text,
  VStack,
  Flex,
  FormControl,
  FormLabel,
} from '@chakra-ui/react'

const LoginForm = () => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Views: 'loading', 'switcher', 'pin', 'setup', 'form'
  const [currentView, setCurrentView] = useState('loading')
  const [activeAccount, setActiveAccount] = useState(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const {
    accounts,
    lastActiveEmail,
    isLoading: isAccountsLoading,
    hasLegacyData,
    saveAccount,
    removeAccount,
    updateLastActiveEmail,
    clearLegacyData,
  } = useAccountManager();

  const [captcha, setCaptcha] = useState(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [emailCode, setEmailCode] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  
  const apiUrl = getEnvironment()
  const navigate = useNavigate();
  const location = useLocation();

  const { isAvailable, authenticate } = useBiometricAuth();

  useEffect(() => {
    if (isAccountsLoading || isInitialized) return;
    
    const initAuth = async () => {
      setIsInitialized(true);
      
      if (hasLegacyData) {
        // Force logout for legacy users as requested
        await clearLegacyData();
        setCurrentView('form');
        return;
      }
      
      if (accounts.length > 0) {
        const lastUsed = accounts.find(a => a.email === lastActiveEmail) || accounts[0];
        setActiveAccount(lastUsed);
        
        // Try biometric immediately if they have a saved token
        const available = await isAvailable();
        if (available) {
          const result = await authenticate();
          if (result.success) {
            localStorage.setItem('token', lastUsed.token);
            queryClient.invalidateQueries({ queryKey: ['user', 'details'] });
            window.location.href = redirectTargetFrom(location.search) || '/userroles';
            return; // Redirecting immediately
          }
        }
        
        // If biometric skipped or failed, determine next screen
        if (lastUsed.pin) {
          setCurrentView('pin');
        } else {
          setCurrentView('switcher');
        }
      } else {
        setCurrentView('form');
      }
    };
    
    initAuth();
  }, [isAccountsLoading, isInitialized, hasLegacyData, accounts, lastActiveEmail]);

  const handleForgotPassword = () => {
    navigate(`/forgot-password`);
  };

  const requestEmailCode = async () => {
    if (!email.trim()) {
      setMessage('Enter your email address first, then ask for a code.')
      return
    }
    setSendingCode(true)
    try {
      const response = await fetch(`${apiUrl}/auth/captcha/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        setMessage(data.message || 'Could not send a code. Please try again.')
        return
      }
      setCaptcha({ token: data.token, svg: null })
      setCaptchaAnswer('')
      setEmailCode(true)
      setMessage(data.message)
    } catch {
      setMessage('Could not send a code. Please try again.')
    } finally {
      setSendingCode(false)
    }
  }

  const loadCaptcha = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/captcha`, { credentials: 'include' })
      if (!response.ok) throw new Error('challenge unavailable')
      const data = await response.json()
      setCaptcha({ token: data.token, svg: data.svg })
      setCaptchaAnswer('')
      setEmailCode(false)
    } catch {
      setMessage('Could not load the challenge image. Please try again.')
    }
  }

  const handleSubmit = async (e) => {
    setIsLoading(true)
    e.preventDefault()
    const userData = { email, password }
    if (captcha) {
      userData.captchaToken = captcha.token
      userData.captchaAnswer = captchaAnswer
    }

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Name': 'xceed-learning',
        },
        body: JSON.stringify(userData),
        credentials: 'include',
      })

      const responseData = await response.json()

      if (!response.ok) {
        setMessage(`Login failed: ${responseData.message}`);
        if (responseData.captchaRequired) {
          if (!captcha || responseData.captchaStale) await loadCaptcha()
          else setCaptchaAnswer('')
        }
        return;
      }

      queryClient.clear();

      if (responseData.token) {
        const userEmail = responseData.user?.email 
            ? (Array.isArray(responseData.user.email) ? responseData.user.email[0] : responseData.user.email) 
            : email;
            
        const newAccount = {
          email: userEmail,
          name: responseData.user?.name || userEmail,
          token: responseData.token,
          pin: null
        };
        
        setActiveAccount(newAccount);
        setCurrentView('setup');
      } else {
        setMessage(responseData.message);
        window.location.href = redirectTargetFrom(location.search, responseData.user);
      }
    } catch (error) {
      console.error('An error occurred', error)
      setMessage('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Flex
      flex={{
        base: '50%',
        lg: '30%',
      }}
      marginBlock={{ base: 10, md: 0 }}
      display='flex'
      flexDirection='column'
      paddingInline={{
        base: '1rem',
        md: '2rem',
      }}>
      
      {currentView === 'loading' || !isInitialized ? (
        <Text>Loading...</Text>
      ) : currentView === 'switcher' ? (
        <AccountSwitcher 
          accounts={accounts} 
          onSelectAccount={(acc) => {
            setActiveAccount(acc);
            setCurrentView(acc.pin ? 'pin' : 'form');
          }}
          onAddAccount={() => setCurrentView('form')}
          onRemoveAccount={removeAccount}
        />
      ) : currentView === 'pin' ? (
        <PinEntry 
          isSetup={false} 
          activeAccount={activeAccount}
          removeAccount={removeAccount}
          updateLastActiveEmail={updateLastActiveEmail}
          onCancel={() => setCurrentView(accounts.length > 0 ? 'switcher' : 'form')} 
        />
      ) : currentView === 'setup' ? (
        <PinEntry 
          isSetup={true} 
          activeAccount={activeAccount}
          saveAccount={saveAccount}
          onSetupComplete={() => {
            window.location.href = redirectTargetFrom(location.search) || '/userroles';
          }} 
        />
      ) : (
        <>
          <FormHeader />
          <form onSubmit={handleSubmit}>
            <VStack spacing={3} width='100%'>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  type='email'
                  placeholder='Enter your email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Password</FormLabel>
                <Input
                  type='password'
                  placeholder='Enter your password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  isRequired
                />
              </FormControl>
              
              {captcha && (
                <FormControl>
                  <FormLabel>
                    {emailCode ? 'Enter the code we emailed you' : 'Type the characters shown'}
                  </FormLabel>
                  {!emailCode && (
                    <HStack spacing={3} align="center" mb={2}>
                      <Image
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
                        alt="Characters to type"
                        height="60px"
                        borderWidth="1px"
                        borderRadius="md"
                      />
                      <Button size="sm" variant="ghost" onClick={loadCaptcha}>
                        New image
                      </Button>
                    </HStack>
                  )}
                  <Input
                    placeholder={emailCode ? 'Six-digit code from your email' : 'Characters from the image'}
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    autoComplete='off'
                    inputMode={emailCode ? 'numeric' : 'text'}
                    isRequired
                  />
                  <Box mt={1}>
                    <Text fontSize='xs' color='gray.600'>
                      {emailCode
                        ? 'The code expires in five minutes and works once.'
                        : 'Asked for after several failed attempts. Not case sensitive.'}
                    </Text>
                    {!emailCode && (
                      <Button
                        variant='link'
                        size='sm'
                        colorScheme='blue'
                        mt={1}
                        isLoading={sendingCode}
                        onClick={requestEmailCode}
                      >
                        Can&apos;t see the image? Email me a code instead
                      </Button>
                    )}
                  </Box>
                </FormControl>
              )}
              
              <Text textAlign="center" color="blue.500" cursor="pointer" onClick={handleForgotPassword}>
                Forgot Password ?
              </Text>
              
              <Button
                isLoading={isLoading}
                type='submit'
                colorScheme='blackAlpha'
                bg={'blackAlpha.900 !important'}
                width={'100%'}>
                Login
              </Button>
              
              {accounts.length > 0 && (
                <Button variant="ghost" onClick={() => setCurrentView('switcher')}>
                  Cancel & Go Back
                </Button>
              )}
            </VStack>
          </form>

          {message && <Text mt={4}>{message}</Text>}

          {isSafeExamBrowser() && (
            <Text mt={6} fontSize="xs" textAlign="center">
              <Link href="/learning/seb-check" color="blue.500">
                Check this machine&apos;s Safe Exam Browser setup
              </Link>
            </Text>
          )}
        </>
      )}
    </Flex>
  )
}

export default LoginForm