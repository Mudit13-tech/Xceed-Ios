import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Container,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import RichText from '../components/RichText';
import { ErrorState, Loading } from '../components/common';
import { LmIcon } from '../components/Icon';

const TYPE_LABEL = {
  mcq: 'Choose one',
  msq: 'Choose all that apply',
  truefalse: 'True or false',
  numerical: 'Enter a number',
};

export default function QuizPreviewPage() {
  const { classId } = useOutletContext();
  const { quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deliveryMode, setDeliveryMode] = useState('all_at_once');
  const [showAnswers, setShowAnswers] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggleFullScreen = async () => {
    if (!isFullScreen) {
      setIsFullScreen(true);
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {}
    } else {
      setIsFullScreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (err) {}
    }
  };

  const loadQuiz = useCallback(async () => {
    setError(null);
    try {
      const data = await lmApi.getQuiz(classId, quizId);
      setQuiz(data);
      if (data?.settings?.deliveryMode === 'one_at_a_time') {
        setDeliveryMode('one_at_a_time');
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [classId, quizId]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  if (loading) return <Loading label="Loading quiz preview…" />;
  if (error) return <ErrorState error={error} onRetry={loadQuiz} />;
  if (!quiz) return null;

  const questions = quiz.questions || [];
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const handleOptionChange = (qId, optionVal) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: optionVal }));
  };

  const isCorrectOption = (q, optionIdx) => {
    if (!q.correctAnswers) return false;
    return q.correctAnswers.map(String).includes(String(optionIdx));
  };

  const renderAnswerInput = (question) => {
    const qId = question._id || question.id;
    const currentVal = userAnswers[qId];

    if (question.type === 'numerical') {
      return (
        <Box my={3}>
          <Input
            type="text"
            inputMode="decimal"
            maxW="280px"
            placeholder="Enter a number"
            value={currentVal || ''}
            onChange={(e) => handleOptionChange(qId, e.target.value)}
          />
          {showAnswers && question.correctAnswers?.[0] && (
            <Text fontSize="xs" color="green.600" fontWeight="600" mt={2}>
              ✓ Expected answer: {question.correctAnswers[0]}
              {question.tolerancePercent ? ` (±${question.tolerancePercent}%)` : ''}
            </Text>
          )}
        </Box>
      );
    }

    if (question.type === 'msq') {
      const selectedList = Array.isArray(currentVal) ? currentVal : [];
      return (
        <Stack spacing={3} my={3}>
          {(question.options || []).map((option, idx) => {
            const isCorrect = showAnswers && isCorrectOption(question, idx);
            const isChecked = selectedList.includes(String(idx));
            return (
              <Box
                key={idx}
                p={3.5}
                borderRadius="lg"
                bg={isCorrect ? 'green.50' : 'lmBg.subtle'}
                borderWidth="1px"
                borderColor={isCorrect ? 'green.400' : 'lmBorder.base'}
              >
                <HStack align="flex-start" spacing={3}>
                  <Checkbox
                    isChecked={isChecked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selectedList, String(idx)]
                        : selectedList.filter((i) => i !== String(idx));
                      handleOptionChange(qId, next);
                    }}
                  >
                    <RichText>{option}</RichText>
                  </Checkbox>
                  {isCorrect && (
                    <Badge colorScheme="green" size="xs" ml={2}>
                      ✓ Correct
                    </Badge>
                  )}
                </HStack>
              </Box>
            );
          })}
        </Stack>
      );
    }

    // MCQ or True/False
    return (
      <RadioGroup
        value={typeof currentVal === 'string' ? currentVal : ''}
        onChange={(val) => handleOptionChange(qId, val)}
        my={3}
      >
        <Stack spacing={3}>
          {(question.options || []).map((option, idx) => {
            const isCorrect = showAnswers && isCorrectOption(question, idx);
            return (
              <Box
                key={idx}
                p={3.5}
                borderRadius="lg"
                bg={isCorrect ? 'green.50' : 'lmBg.subtle'}
                borderWidth="1px"
                borderColor={isCorrect ? 'green.400' : 'lmBorder.base'}
              >
                <HStack align="flex-start" spacing={3}>
                  <Radio value={String(idx)} alignItems="flex-start">
                    <RichText>{option}</RichText>
                  </Radio>
                  {isCorrect && (
                    <Badge colorScheme="green" size="xs" ml={2}>
                      ✓ Correct
                    </Badge>
                  )}
                </HStack>
              </Box>
            );
          })}
        </Stack>
      </RadioGroup>
    );
  };

  const renderQuestionCard = (question, index) => {
    const sectionObj = (quiz.sections || []).find(
      (s) => s._id === question.sectionId || s.id === question.sectionId,
    );

    return (
      <Box
        key={question._id || index}
        p={6}
        mb={5}
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="xl"
        bg="lmBg.surface"
        boxShadow="sm"
      >
        <Flex justify="space-between" align="flex-start" gap={3} mb={3} wrap="wrap">
          <Box flex="1" minW="0">
            <HStack spacing={2} mb={2} wrap="wrap">
              <Flex
                align="center"
                justify="center"
                w="28px"
                h="28px"
                borderRadius="md"
                fontSize="xs"
                fontWeight="700"
                bg="purple.600"
                color="white"
              >
                {index + 1}
              </Flex>
              {sectionObj && (
                <Badge colorScheme="purple" fontSize="xs">
                  {sectionObj.name}
                </Badge>
              )}
              {question.difficulty && (
                <Badge colorScheme="gray" fontSize="xs">
                  {question.difficulty}
                </Badge>
              )}
            </HStack>
            <RichText>{question.question}</RichText>
          </Box>
          <HStack flexShrink={0} align="start" spacing={2}>
            {TYPE_LABEL[question.type] && (
              <Badge colorScheme="blue" variant="subtle">
                {TYPE_LABEL[question.type]}
              </Badge>
            )}
            <Badge colorScheme="purple">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </Badge>
          </HStack>
        </Flex>

        {renderAnswerInput(question)}

        {showAnswers && question.explanation && (
          <Box mt={4} p={3.5} bg="purple.50" borderRadius="lg" borderWidth="1px" borderColor="purple.200">
            <Text fontSize="xs" fontWeight="700" color="purple.700" mb={1}>
              <LmIcon name="tip" size={12} style={{ marginRight: 4 }} />
              Explanation
            </Text>
            <RichText>{question.explanation}</RichText>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box minH="100vh" py={8} px={{ base: 4, md: 10 }} bg="lmBg.subtle">
      <Container maxW="container.xl">
        {/* Top Header styled like Quiz Sitting View */}
        <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={3}>
          <Box>
            <Button
              size="sm"
              variant="ghost"
              mb={1}
              onClick={() => navigate(`/learning/class/${classId}/quiz/${quizId}/edit`)}
            >
              ← Back to quiz editor
            </Button>
            <Heading size="lg" color="lmFg.heading">
              <LmIcon name="preview" size={17} style={{ marginRight: 6 }} />
            Quiz Preview: {quiz.title}
            </Heading>
            <Text fontSize="sm" color="lmFg.muted">
              Student Sitting Layout · {questions.length} question{questions.length === 1 ? '' : 's'} · {totalMarks} mark
              {totalMarks === 1 ? '' : 's'}
            </Text>
          </Box>

          <HStack spacing={2}>
            <Button
              size="sm"
              colorScheme="purple"
              variant="outline"
              onClick={toggleFullScreen}
            >
              <LmIcon name={isFullScreen ? 'close' : 'desktop'} size={13} style={{ marginRight: 6 }} />
            {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            </Button>
            <Button
              size="sm"
              colorScheme="gray"
              variant="outline"
              onClick={() => {
                if (document.fullscreenElement && document.exitFullscreen) {
                  document.exitFullscreen().catch(() => {});
                }
                navigate(`/learning/class/${classId}/quizzes`);
              }}
            >
              Exit Preview
            </Button>
          </HStack>
        </Flex>

        <Alert status="info" borderRadius="lg" mb={5} fontSize="xs">
          <AlertIcon />
          <Box>
            <Text fontWeight="700">Full Screen Student View Preview</Text>
            This full screen preview displays questions in the layout students experience during an attempt.
          </Box>
        </Alert>

        {/* Controls Bar */}
        <Flex
          p={4}
          mb={5}
          bg="lmBg.surface"
          borderRadius="lg"
          borderWidth="1px"
          borderColor="lmBorder.base"
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={3}
          boxShadow="sm"
        >
          <HStack spacing={3}>
            <Text fontSize="xs" fontWeight="700" color="lmFg.subtle">
              Delivery mode:
            </Text>
            <Button
              size="xs"
              variant={deliveryMode === 'all_at_once' ? 'solid' : 'outline'}
              colorScheme={deliveryMode === 'all_at_once' ? 'purple' : 'gray'}
              onClick={() => setDeliveryMode('all_at_once')}
            >
              <LmIcon name="quiz" size={13} style={{ marginRight: 4 }} />
            All on one page
            </Button>
            <Button
              size="xs"
              variant={deliveryMode === 'one_at_a_time' ? 'solid' : 'outline'}
              colorScheme={deliveryMode === 'one_at_a_time' ? 'purple' : 'gray'}
              onClick={() => {
                setDeliveryMode('one_at_a_time');
                setCurrentIdx(0);
              }}
            >
              1️⃣ One at a time
            </Button>
          </HStack>

          <FormControl display="flex" alignItems="center" w="auto">
            <FormLabel htmlFor="show-answers-page" mb="0" fontSize="xs" fontWeight="700" cursor="pointer">
              Show answer key &amp; explanations
            </FormLabel>
            <Switch
              id="show-answers-page"
              size="sm"
              colorScheme="green"
              isChecked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
            />
          </FormControl>
        </Flex>

        {/* Question Quick-Navigation */}
        {questions.length > 0 && (
          <Box mb={5} p={3.5} bg="lmBg.surface" borderRadius="lg" borderWidth="1px" borderColor="lmBorder.base">
            <Text fontSize="xs" color="lmFg.muted" mb={2} fontWeight="600">
              Question Quick Navigation:
            </Text>
            <Flex gap={2} wrap="wrap">
              {questions.map((q, idx) => (
                <Button
                  key={q._id || idx}
                  size="xs"
                  variant={deliveryMode === 'one_at_a_time' && currentIdx === idx ? 'solid' : 'outline'}
                  colorScheme={
                    deliveryMode === 'one_at_a_time' && currentIdx === idx
                      ? 'purple'
                      : userAnswers[q._id || q.id]
                      ? 'green'
                      : 'gray'
                  }
                  onClick={() => {
                    if (deliveryMode === 'one_at_a_time') {
                      setCurrentIdx(idx);
                    }
                  }}
                >
                  {idx + 1}
                </Button>
              ))}
            </Flex>
          </Box>
        )}

        <Divider mb={5} />

        {/* Question Cards */}
        {questions.length === 0 ? (
          <Text fontSize="sm" color="lmFg.muted" py={10} textAlign="center">
            No questions added to this quiz yet.
          </Text>
        ) : deliveryMode === 'all_at_once' ? (
          questions.map((q, idx) => renderQuestionCard(q, idx))
        ) : (
          <Box maxW="container.lg" mx="auto">
            {renderQuestionCard(questions[currentIdx], currentIdx)}
            <Flex justify="space-between" align="center" mt={4}>
              <Button
                size="sm"
                variant="outline"
                isDisabled={currentIdx === 0}
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              >
                ← Previous
              </Button>

              <Text fontSize="xs" color="lmFg.muted" fontWeight="600">
                Question {currentIdx + 1} of {questions.length}
              </Text>

              <Button
                size="sm"
                colorScheme="purple"
                isDisabled={currentIdx >= questions.length - 1}
                onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next →
              </Button>
            </Flex>
          </Box>
        )}
      </Container>
    </Box>
  );
}
