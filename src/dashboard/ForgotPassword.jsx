import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  PinInput,
  PinInputField,
  Text,
  useColorModeValue,
  VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiMail, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

const ForgotPassword = () => {
  const [step, setStep] = useState('email'); // 'email' | 'reset' | 'done'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Asked for only once the server sees this address being requested too
  // often (see forgotPasswordGate.js on the server) — an ordinary reset never
  // shows this.
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [emailCode, setEmailCode] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const navigate = useNavigate();

  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('gray.200', 'gray.700');
  const subColor = useColorModeValue('gray.600', 'gray.400');
  const iconBg = useColorModeValue('cyan.50', 'cyan.900');
  const iconColor = useColorModeValue('cyan.600', 'cyan.300');

  /**
   * The accessible alternative for anyone who cannot read the picture — a
   * code posted to the address being requested, same as the login form's.
   */
  const requestEmailCode = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then ask for a code.');
      return;
    }
    setSendingCode(true);
    try {
      const response = await fetch(`${apiUrl}/auth/captcha/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Could not send a code. Please try again.');
        return;
      }
      // No svg: the challenge is the code in their inbox.
      setCaptcha({ token: data.token, svg: null });
      setCaptchaAnswer('');
      setEmailCode(true);
      setInfo(data.message);
    } catch {
      setError('Could not send a code. Please try again.');
    } finally {
      setSendingCode(false);
    }
  };

  const loadCaptcha = async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/captcha`);
      if (!response.ok) throw new Error('challenge unavailable');
      const data = await response.json();
      setCaptcha({ token: data.token, svg: data.svg });
      setCaptchaAnswer('');
      setEmailCode(false);
    } catch {
      setError('Could not load the challenge image. Please try again.');
    }
  };

  const sendOtp = async () => {
    setError('');
    setInfo('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const body = { email: email.trim() };
      if (captcha) {
        body.captchaToken = captcha.token;
        body.captchaAnswer = captchaAnswer;
      }
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        if (data.captchaRequired) {
          // A fresh image when the last one expired or was already spent; the
          // same one stays put after a simple typo, so the user is not made to
          // re-read a new one for a slip.
          if (!captcha || data.captchaStale) await loadCaptcha();
          else setCaptchaAnswer('');
        }
        throw new Error(data.message || 'Could not send OTP');
      }
      setStep('reset');
      setCaptcha(null);
      setCaptchaAnswer('');
      setInfo(`An OTP has been sent to ${email.trim()}. It is valid for 10 minutes.`);
    } catch (err) {
      setError(err.message === 'User not exists'
        ? 'No account found with this email address.'
        : err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setInfo('');
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit OTP sent to your email.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const passwordRuleRegex = /^(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{6,}$/;
    if (!passwordRuleRegex.test(password)) {
      setError('Password must be at least 6 characters and contain a special character.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.message || 'Could not reset password');
      }
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex bg={pageBg} minH="100vh" align="center" justify="center" px={4} py={10}>
      <Box
        bg={cardBg}
        borderWidth="1px"
        borderColor={border}
        borderRadius="xl"
        boxShadow="lg"
        p={{ base: 6, md: 10 }}
        w="full"
        maxW="md"
      >
        <VStack spacing={5} align="stretch">
          <Flex align="center" justify="center" direction="column" gap={3}>
            <Flex align="center" justify="center" boxSize={14} borderRadius="full" bg={iconBg} color={iconColor}>
              <Icon as={step === 'done' ? FiCheckCircle : FiLock} boxSize={7} />
            </Flex>
            <Heading as="h1" size="lg" textAlign="center">
              {step === 'done' ? 'Password Updated' : 'Forgot Password'}
            </Heading>
            <Text color={subColor} fontSize="sm" textAlign="center">
              {step === 'email' &&
                "Enter your registered email and we'll send you a one-time password (OTP)."}
              {step === 'reset' &&
                'Enter the OTP you received and choose a new password.'}
              {step === 'done' &&
                'Your password has been reset successfully. You can now log in with your new password.'}
            </Text>
          </Flex>

          {info && step !== 'done' && (
            <Alert status="info" borderRadius="md" fontSize="sm">
              <AlertIcon />
              {info}
            </Alert>
          )}
          {error && (
            <Alert status="error" borderRadius="md" fontSize="sm">
              <AlertIcon />
              {error}
            </Alert>
          )}

          {step === 'email' && (
            <>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiMail} color={subColor} />
                  </InputLeftElement>
                  <Input
                    type="email"
                    placeholder="you@nitj.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                  />
                </InputGroup>
              </FormControl>
              {captcha && (
                <FormControl isRequired>
                  <FormLabel>
                    {emailCode ? 'Enter the code we emailed you' : 'Type the characters shown'}
                  </FormLabel>
                  {!emailCode && (
                    <HStack spacing={3} align="center" mb={2}>
                      {/* Rendered through an <img> data URI, not injected into the
                          DOM directly — see LoginForm.jsx for why. */}
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
                    onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                    autoComplete="off"
                    inputMode={emailCode ? 'numeric' : 'text'}
                  />
                  <Box mt={1}>
                    <Text fontSize="xs" color={subColor}>
                      {emailCode
                        ? 'The code expires in five minutes and works once.'
                        : 'Asked for after several requests for this address. Not case sensitive.'}
                    </Text>
                    {!emailCode && (
                      <Button
                        variant="link"
                        size="sm"
                        colorScheme="blue"
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
              <Button colorScheme="cyan" isLoading={isLoading} onClick={sendOtp}>
                Send OTP
              </Button>
            </>
          )}

          {step === 'reset' && (
            <>
              <FormControl isRequired>
                <FormLabel>OTP</FormLabel>
                <HStack justify="center">
                  <PinInput otp value={otp} onChange={setOtp} size="lg">
                    <PinInputField />
                    <PinInputField />
                    <PinInputField />
                    <PinInputField />
                    <PinInputField />
                    <PinInputField />
                  </PinInput>
                </HStack>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>New Password</FormLabel>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Confirm Password</FormLabel>
                <Input
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && resetPassword()}
                />
              </FormControl>
              <Button colorScheme="cyan" isLoading={isLoading} onClick={resetPassword}>
                Reset Password
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<FiArrowLeft />}
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                  setInfo('');
                }}
              >
                Use a different email / resend OTP
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button colorScheme="cyan" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          )}
        </VStack>
      </Box>
    </Flex>
  );
};

export default ForgotPassword;
