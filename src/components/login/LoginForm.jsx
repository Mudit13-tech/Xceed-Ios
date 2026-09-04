import React, { useState, useEffect } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useBiometricAuth } from '../../utils/useBiometricAuth';
import { useQueryClient } from '@tanstack/react-query';
import FormHeader from './FormHeader'
import { isSafeExamBrowser } from '../../learningModule/sebDiagnosis'
import getEnvironment from '../../getenvironment'
import { redirectTargetFrom } from '../../authRedirect'
import { takePendingRoute } from '../../utils/deepLink'
import PinEntry from './PinEntry'
import AccountSwitcher from './AccountSwitcher'
import { useAccountManager } from '../../utils/useAccountManager'
import { activateAccount } from '../../utils/sessionSwitch'
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
        if (available && lastUsed.token) {
          const result = await authenticate(`Log in as ${lastUsed.email}`);
          if (result.success) {
            await activateAccount({
              account: lastUsed,
              queryClient,
              updateLastActiveEmail,
              fallbackTarget: redirectTargetFrom(location.search) || '/userroles',
            });
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

  /**
   * Picking an account in the switcher signs into it there and then.
   *
   * It used to set the account and drop the user on the password form unless
   * that account had a PIN, which meant a saved, still-valid session was worth
   * nothing: switching cost a full password login every time. The saved token
   * is the credential — this uses it, behind whichever lock the account has.
   */
  const handleSelectAccount = async (acc) => {
    setActiveAccount(acc);

    // Nothing to sign in with. Only a password can restore this one.
    if (!acc.token) {
      setCurrentView('form');
      return;
    }

    if (acc.pin) {
      setCurrentView('pin');
      return;
    }

    const available = await isAvailable();
    if (available) {
      const result = await authenticate(`Switch to ${acc.email}`);
      // A declined prompt leaves them on the switcher. Falling through to the
      // password form would be a worse answer to "not now" than simply staying
      // put, and falling through to the switch would make the prompt a
      // formality.
      if (!result.success) return;
    }

    await activateAccount({
      account: acc,
      queryClient,
      updateLastActiveEmail,
      fallbackTarget: redirectTargetFrom(location.search) || '/userroles',
    });
  };

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

      // Read the body as text first, then parse. `response.json()` throws on an
      // empty or non-JSON body — a gateway's HTML 502 page, a proxy timeout, a
      // response cut short — and that throw lands in the catch below, where it
      // used to be reported as the same blank "An error occurred" as a dropped
      // connection. Those are different faults with different fixes, so they are
      // told apart here and the status is shown rather than swallowed.
      const rawBody = await response.text()
      let responseData
      try {
        responseData = rawBody ? JSON.parse(rawBody) : {}
      } catch (parseError) {
        console.error('Login: non-JSON response', response.status, rawBody.slice(0, 500))
        setMessage(
          `Login failed: the server replied with ${response.status} ${response.statusText || ''} `.trim() +
            ' (not a valid response). Please tell an administrator.',
        )
        return
      }

      if (!response.ok) {
        setMessage(`Login failed: ${responseData.message || `${response.status} ${response.statusText}`}`);
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

        // Working out *where* to go must not be able to fail the sign-in that has
        // already succeeded. This block used to sit in the same `try` as the fetch,
        // so anything thrown while resolving the destination — a role shape the
        // redirect map does not expect, a user object missing a field it reads —
        // surfaced as the network error below: the account was signed in, the token
        // was stored, and the form still said the request had failed. The worst case
        // here is landing on the roles picker, which every account can use.
        let target = '/userroles'
        try {
          target = redirectTargetFrom(location.search, responseData.user) || '/userroles'
        } catch (redirectError) {
          console.error('Login: could not resolve redirect target', redirectError, responseData.user)
        }
        // A full load rather than a client-side navigation: the platform navbar
        // reads the session once on mount, so a router push would land on the
        // target with a stale "signed out" navbar that bounces straight back.
        // A deep link the user was headed for wins over the default landing
        // page. `takePendingRoute` also discards a saved value that is not a
        // route — see src/utils/deepLink.js.
        window.location.href = (await takePendingRoute()) || target;
      }
    } catch (error) {
      console.error('An error occurred', error)
      // A rejected fetch is the browser saying the request never completed:
      // the server is unreachable, the origin is not on the CORS allow-list, or
      // the connection was dropped. It is never a wrong password — the server
      // answers those with a 401 and a message — so saying so saves the user
      // retrying credentials that were fine.
      const unreachable = error instanceof TypeError
      setMessage(
        unreachable
          ? 'Could not reach the sign-in service. This is not a password problem — check your connection, or tell an administrator the server did not respond.'
          : 'An error occurred. Please try again.',
      )
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
          onSelectAccount={handleSelectAccount}
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
              
              {/* Two ways out of a sign-in that is not working, side by side. The
                  help desk belongs here rather than three pages away: "forgot my
                  password" is only one of the reasons somebody is stuck on this
                  screen, and the others — no account yet, an invitation that never
                  arrived, a role that opens nothing — are exactly what it answers,
                  without needing a sign-in to reach it. */}
              <Flex justify="center" align="center" gap={3} wrap="wrap">
                <Text color="blue.500" cursor="pointer" onClick={handleForgotPassword}>
                  Forgot Password ?
                </Text>
                <Text color="gray.400" aria-hidden="true">
                  ·
                </Text>
                <Text
                  as={RouterLink}
                  to="/help"
                  color="blue.500"
                  fontWeight="600"
                  _hover={{ textDecoration: 'underline' }}
                >
                  Need help?
                </Text>
              </Flex>
              
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

          {/* Only inside Safe Exam Browser, and only there because of where SEB
              lands. Verifying a Config Key means making a request from a real SEB,
              and SEB opens on the learning module, which bounces anyone not signed
              in to this page — with no address bar to type a different one into. So
              this is the only screen from which an invigilator can reach the check
              without first signing in to a kiosk that has a restricted keyboard and
              no password manager.

              Hidden from every ordinary visitor: the user-agent test is not a
              security boundary and is not asked to be one — the check's verdict
              rests on the request hash, not on this. */}
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