import React, { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Text,
} from '@chakra-ui/react';
import RichText from './RichText';

const TYPE_LABEL = {
  mcq: 'Choose one',
  msq: 'Choose all that apply',
  truefalse: 'True or false',
  numerical: 'Enter a number',
};

/**
 * QuizPreviewModal
 * Provides a faculty preview of quiz questions as rendered for students.
 * Purely visual — no answer tracking, timer enforcement, proctoring, or SEB rules.
 */
export default function QuizPreviewModal({ isOpen, onClose, quiz }) {
  const [deliveryMode, setDeliveryMode] = useState(
    quiz?.settings?.deliveryMode === 'one_at_a_time' ? 'one_at_a_time' : 'all_at_once',
  );
  const [showAnswers, setShowAnswers] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});

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
        <Box my={2}>
          <Input
            type="text"
            inputMode="decimal"
            maxW="260px"
            placeholder="Enter a number"
            value={currentVal || ''}
            onChange={(e) => handleOptionChange(qId, e.target.value)}
          />
          {showAnswers && question.correctAnswers?.[0] && (
            <Text fontSize="xs" color="green.600" fontWeight="600" mt={1}>
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
        <Stack spacing={2} my={2}>
          {(question.options || []).map((option, idx) => {
            const isCorrect = showAnswers && isCorrectOption(question, idx);
            const isChecked = selectedList.includes(String(idx));
            return (
              <Box
                key={idx}
                p={2}
                borderRadius="md"
                bg={isCorrect ? 'green.50' : 'transparent'}
                borderWidth={isCorrect ? '1px' : '0px'}
                borderColor="green.300"
              >
                <HStack align="flex-start" spacing={2}>
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
        my={2}
      >
        <Stack spacing={2}>
          {(question.options || []).map((option, idx) => {
            const isCorrect = showAnswers && isCorrectOption(question, idx);
            return (
              <Box
                key={idx}
                p={2}
                borderRadius="md"
                bg={isCorrect ? 'green.50' : 'transparent'}
                borderWidth={isCorrect ? '1px' : '0px'}
                borderColor="green.300"
              >
                <HStack align="flex-start" spacing={2}>
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
        p={4}
        mb={4}
        borderWidth="1px"
        borderColor="lmBorder.base"
        borderRadius="lg"
        bg="lmBg.surface"
        boxShadow="sm"
      >
        <Flex justify="space-between" align="flex-start" gap={3} mb={3} wrap="wrap">
          <Box flex="1" minW="0">
            <HStack spacing={2} mb={2} wrap="wrap">
              <Flex
                align="center"
                justify="center"
                w="24px"
                h="24px"
                borderRadius="md"
                fontSize="xs"
                fontWeight="700"
                bg="purple.500"
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
            <Badge colorScheme="gray">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </Badge>
          </HStack>
        </Flex>

        {renderAnswerInput(question)}

        {showAnswers && question.explanation && (
          <Box mt={3} p={3} bg="purple.50" borderRadius="md" borderWidth="1px" borderColor="purple.200">
            <Text fontSize="xs" fontWeight="700" color="purple.700" mb={1}>
              💡 Explanation
            </Text>
            <RichText>{question.explanation}</RichText>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(3px)" />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottomWidth="1px">
          <Flex justify="space-between" align="center" wrap="wrap" gap={2} pr={8}>
            <Box>
              <HStack spacing={2}>
                <Text fontSize="lg" fontWeight="700">
                  👁️ Student Preview: {quiz.title}
                </Text>
              </HStack>
              <Text fontSize="xs" color="lmFg.muted" fontWeight="normal">
                {questions.length} question{questions.length === 1 ? '' : 's'} · {totalMarks} total mark
                {totalMarks === 1 ? '' : 's'}
              </Text>
            </Box>
          </Flex>
        </ModalHeader>

        <ModalCloseButton />

        <ModalBody py={4}>
          <Alert status="info" borderRadius="md" mb={4} fontSize="xs">
            <AlertIcon />
            <Box>
              <Text fontWeight="600">Student View Preview</Text>
              Visual inspection mode for faculty to check question formatting, image sizing, and layout.
              No proctoring, locks, timer expiry, or Safe Exam Browser required. Answers clicked here are local
              and not saved.
            </Box>
          </Alert>

          {/* Controls Bar */}
          <Flex
            p={3}
            mb={4}
            bg="lmBg.subtle"
            borderRadius="md"
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={3}
          >
            <HStack spacing={3}>
              <Text fontSize="xs" fontWeight="600">
                Delivery mode:
              </Text>
              <Button
                size="xs"
                variant={deliveryMode === 'all_at_once' ? 'solid' : 'outline'}
                colorScheme={deliveryMode === 'all_at_once' ? 'purple' : 'gray'}
                onClick={() => setDeliveryMode('all_at_once')}
              >
                📋 All on one page
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
              <FormLabel htmlFor="show-answers" mb="0" fontSize="xs" fontWeight="600" cursor="pointer">
                Show answer key &amp; explanations
              </FormLabel>
              <Switch
                id="show-answers"
                size="sm"
                colorScheme="green"
                isChecked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
              />
            </FormControl>
          </Flex>

          {/* Question Index Quick-Bar */}
          {questions.length > 0 && (
            <Box mb={4}>
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

          <Divider mb={4} />

          {/* Question Content */}
          {questions.length === 0 ? (
            <Text fontSize="sm" color="lmFg.muted" py={6} textAlign="center">
              No questions added to this quiz yet.
            </Text>
          ) : deliveryMode === 'all_at_once' ? (
            questions.map((q, idx) => renderQuestionCard(q, idx))
          ) : (
            <Box>
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
        </ModalBody>

        <ModalFooter borderTopWidth="1px">
          <Button colorScheme="gray" onClick={onClose}>
            Close Preview
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
