import React, { useEffect, useRef, useState } from 'react';
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
  FormHelperText,
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
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { formatDateTime, toDateTimeInput } from '../format';

/**
 * Publishing, and the four moments it settles.
 *
 * They are laid out as a timeline because they are one: the link appears, the
 * paper opens, the door shuts on latecomers, the paper closes, and afterwards
 * the marks go out. Two of them used to be labelled in ways a teacher could not
 * tell apart — "close entry after a set time" and "closes at" both read as
 * "when does this thing close" — so each row now says what *stops* at that
 * moment, in the student's terms, and the two closing times sit next to each
 * other where the difference between them is visible.
 *
 * Shared by the quiz list and the editor so the two entry points cannot drift
 * into setting different things.
 */

/** One row of the timeline: a number, a name, what it stops, and a field. */
function ClockRow({ step, title, subtitle, children, isInvalid, action }) {
  return (
    <FormControl mb={5} isInvalid={isInvalid}>
      <Flex gap={3} align="flex-start">
        <Flex
          align="center"
          justify="center"
          flexShrink={0}
          w="26px"
          h="26px"
          mt="2px"
          borderRadius="full"
          bg="purple.500"
          color="lmFg.onAccent"
          fontSize="xs"
          fontWeight="700"
        >
          {step}
        </Flex>
        <Box flex="1" minW={0}>
          <Flex align="center" gap={2} wrap="wrap">
            <FormLabel fontSize="sm" mb={0} fontWeight="600">
              {title}
            </FormLabel>
            {action}
          </Flex>
          <Text fontSize="xs" color="lmFg.subtle" mb={2}>
            {subtitle}
          </Text>
          {children}
        </Box>
      </Flex>
    </FormControl>
  );
}

/** Now, as `<input type="datetime-local">` wants it. */
const nowForInput = () => toDateTimeInput(new Date());
/** Current date and time plus 5 minutes, formatted for `<input type="datetime-local">`. */
const nowPlus5ForInput = () => toDateTimeInput(new Date(Date.now() + 5 * 60 * 1000));

export default function PublishQuizModal({ isOpen, onClose, quiz, classId, onPublished }) {
  const [publishAt, setPublishAt] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableTo, setAvailableTo] = useState('');
  const [limitEntry, setLimitEntry] = useState(false);
  const [startDeadline, setStartDeadline] = useState('');
  // '' until the teacher has answered the results question — see `answered`.
  const [resultsMode, setResultsMode] = useState('');
  const [resultReleaseAt, setResultReleaseAt] = useState('');
  /* The room code, asked here for the same reason the results question is: it
     is a decision about how the paper is sat, and the only other place to make
     it was a button on the quiz card — which a teacher reliably remembers about
     when they are already standing in front of a hall that has started. '' until
     answered, exactly like `resultsMode`. */
  const [roomCodeMode, setRoomCodeMode] = useState('');
  const [regenerateRoomCode, setRegenerateRoomCode] = useState(false);
  // The code the server actually minted, shown once published so it can be read
  // out. Only ever arrives on a teacher's response.
  const [roomCode, setRoomCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState('');
  const toast = useToast();

  const url = link && typeof window !== 'undefined' ? new URL(link, window.location.origin).href : '';
  const { onCopy, hasCopied } = useClipboard(url);
  const roomClip = useClipboard(roomCode);
  /* No Safe Exam Browser link here, deliberately.
     A `seb://` launch has to carry a token, because SEB fetches the settings
     itself with none of the student's session — and a token is minted for one
     student and lasts minutes, which is the opposite of a link a teacher pastes
     into a notice board. Students get the launch button on the test page, where
     their own token is minted when they open it. The link above is the one to
     hand out, and it works for everybody. */

  // Hydrates once per opening, not on every new `quiz` object.
  //
  // Publishing calls `onPublished`, and a parent that reloads the quiz there
  // hands back a fresh object with the same contents. Keying the effect on the
  // prop itself made that reload re-run it, which cleared `link` and dropped
  // the teacher back into the form a moment after they had scheduled the paper
  // — the link they came for gone, and the dialog looking like it had failed.
  const hydratedFor = useRef(null);

  useEffect(() => {
    if (!isOpen || !quiz) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === String(quiz._id)) return;
    hydratedFor.current = String(quiz._id);

    setLink('');
    setRoomCode('');
    setRegenerateRoomCode(false);
    /* Unanswered until a teacher answers it, on the same rule as the results
       question below. A paper that already carries a code has been answered
       once — `roomCode` on a teacher's copy, `roomCodeRequired` on the list's
       student-facing one, whichever this quiz was serialised with. */
    const currentRoomCode = quiz.settings?.roomCode || '';
    const roomCodeSet = Boolean(currentRoomCode || quiz.settings?.roomCodeRequired);
    setRoomCodeMode(roomCodeSet ? 'required' : quiz.published ? 'none' : '');
    setPublishAt(toDateTimeInput(quiz.publishAt) || nowForInput());
    setAvailableFrom(toDateTimeInput(quiz.settings?.availableFrom) || nowPlus5ForInput());
    setAvailableTo(toDateTimeInput(quiz.settings?.availableTo));
    // `window.startDeadline` rather than the setting, so a quiz still carrying
    // the older "minutes after opening" margin opens the toggle already on,
    // showing the moment that margin actually works out to.
    const cutOff = quiz.settings?.startDeadline || quiz.window?.startDeadline;
    setLimitEntry(Boolean(cutOff));
    setStartDeadline(toDateTimeInput(cutOff));
    // The results question is unanswered until a teacher answers it, and a
    // quiz that has never been published has never been asked. An already
    // published paper carries its own answer: a release time means "at a set
    // time", and its absence means the teacher published once already knowing
    // marks appear on submit.
    const releaseTime = quiz.settings?.resultReleaseAt;
    setResultsMode(releaseTime ? 'scheduled' : quiz.published ? 'immediate' : '');
    setResultReleaseAt(toDateTimeInput(releaseTime));
  }, [isOpen, quiz]);

  // Orderings that produce a quiz nobody can sit, or a result nobody can wait
  // for: a paper that opens before the link it lives behind exists, an entry
  // cut-off that has passed before either, or marks announced while students
  // are still writing. Caught here as well as on the server so the teacher sees
  // it while they are still looking at the fields.
  const isAlreadyPublished = Boolean(quiz?.published);
  const cutOff = limitEntry ? startDeadline : '';
  const releaseAt = resultsMode === 'scheduled' ? resultReleaseAt : '';
  const effectivePublishTime = isAlreadyPublished
    ? (quiz?.publishAt || quiz?.announcedAt || quiz?.createdAt
        ? new Date(quiz.publishAt || quiz.announcedAt || quiz.createdAt)
        : null)
    : publishAt
      ? new Date(publishAt)
      : new Date();
  const publishInPast = Boolean(
    !isAlreadyPublished && publishAt && new Date(publishAt) < new Date(Date.now() - 60000),
  );
  const startsBeforePublished = Boolean(
    !isAlreadyPublished && availableFrom && effectivePublishTime && new Date(availableFrom) < effectivePublishTime,
  );
  const closesTooEarly = Boolean(
    cutOff &&
      ((availableFrom && new Date(cutOff) < new Date(availableFrom)) ||
        (effectivePublishTime && new Date(cutOff) < effectivePublishTime)),
  );
  const testClosesTooEarly = Boolean(
    availableTo &&
      ((availableFrom && new Date(availableTo) < new Date(availableFrom)) ||
        (cutOff && new Date(availableTo) < new Date(cutOff)) ||
        (effectivePublishTime && new Date(availableTo) < effectivePublishTime)),
  );
  const missingCutOff = limitEntry && !startDeadline;
  const resultsBeforeClose = Boolean(
    releaseAt && availableTo && new Date(releaseAt) < new Date(availableTo),
  );
  const missingRelease = resultsMode === 'scheduled' && !resultReleaseAt;
  const unanswered = !resultsMode;
  // What this paper already has, which decides whether "require a room code"
  // means "mint one" or "keep the one that is set".
  const existingRoomCode = quiz?.settings?.roomCode || '';
  const roomCodeSet = Boolean(existingRoomCode || quiz?.settings?.roomCodeRequired);
  const roomUnanswered = !roomCodeMode;
  const outOfOrder =
    publishInPast ||
    startsBeforePublished ||
    closesTooEarly ||
    missingCutOff ||
    resultsBeforeClose ||
    missingRelease ||
    unanswered ||
    roomUnanswered;

  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        publish: true,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        startDeadline: cutOff || null,
        resultReleaseAt: releaseAt || null,
      };
      /* Only ever sent as an instruction, never as a code: the server mints it,
         so a code cannot be chosen (and so guessed) by whoever sets it up.
         Omitted entirely when the answer is "keep what is already set", which is
         what a re-save of an unchanged paper sends. */
      if (roomCodeMode === 'required' && (!roomCodeSet || regenerateRoomCode)) {
        payload.roomCode = 'generate';
      } else if (roomCodeMode === 'none') {
        payload.roomCode = 'none';
      }
      if (!isAlreadyPublished) {
        payload.publishAt = publishAt || null;
      }
      const result = await lmApi.publishQuiz(classId, quiz._id, payload);
      setLink(result.link);
      setRoomCode(result.roomCode || '');
      await onPublished?.();
    } catch (error) {
      toast({
        status: 'error',
        title: isAlreadyPublished ? 'Could not save schedule' : 'Could not publish',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!quiz) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent mt="100px" mb="50px" pt={6} pb={4}>
        <ModalHeader>
          {link
            ? isAlreadyPublished
              ? 'Schedule updated'
              : 'Published'
            : isAlreadyPublished
              ? `Schedule for "${quiz.title}"`
              : `Publish "${quiz.title}"`}
        </ModalHeader>
        <ModalCloseButton top={8} />
        <ModalBody>
          {link ? (
            <>
              <Alert status="success" borderRadius="md" mb={4}>
                <AlertIcon />
                <Box>
                  <Text fontWeight="600">
                    {publishAt ? `Scheduled for ${formatDateTime(publishAt)}` : 'Live now'}
                  </Text>
                  <Text fontSize="sm">
                    {availableFrom
                      ? `Students can start from ${formatDateTime(availableFrom)} — until then the link shows the instructions and a countdown.`
                      : 'Students can start as soon as they open the link.'}
                  </Text>
                  {cutOff && (
                    <Text fontSize="sm">
                      Nobody may begin after {formatDateTime(cutOff)}.
                    </Text>
                  )}
                  {availableTo && (
                    <Text fontSize="sm">The paper closes {formatDateTime(availableTo)}.</Text>
                  )}
                  <Text fontSize="sm">
                    {releaseAt
                      ? `Results are announced ${formatDateTime(releaseAt)} — you can release them earlier from the results page.`
                      : 'Each student sees their result as soon as they submit.'}
                  </Text>
                </Box>
              </Alert>

              {/* Above the link, deliberately: the link is pasted somewhere and
                  forgotten, while this has to be carried into the room and read
                  out. A teacher who closes this dialog without noticing it can
                  still get it back from the quiz card, but they should not have
                  to. */}
              {roomCode && (
                <Box
                  borderWidth="1px"
                  borderColor="lmHue.blue200"
                  bg="lmHue.blue50"
                  borderRadius="md"
                  p={4}
                  mb={4}
                >
                  <Text fontSize="xs" color="lmFg.muted" mb={1}>
                    Room code — read this out to the hall when the sitting starts
                  </Text>
                  <HStack>
                    <Text fontFamily="mono" fontSize="2xl" fontWeight="800" letterSpacing="0.15em">
                      {roomCode}
                    </Text>
                    <Button size="xs" onClick={roomClip.onCopy}>
                      {roomClip.hasCopied ? 'Copied' : 'Copy'}
                    </Button>
                  </HStack>
                  <Text fontSize="xs" color="lmFg.muted" mt={1}>
                    Students cannot start without it. It is on the quiz card too, and generating a
                    new one there retires this.
                  </Text>
                </Box>
              )}

              <FormLabel fontSize="sm">Share this link</FormLabel>
              <HStack>
                <Input value={url} isReadOnly fontSize="sm" onFocus={(event) => event.target.select()} />
                <Button onClick={onCopy} colorScheme={hasCopied ? 'green' : 'blue'} flexShrink={0}>
                  {hasCopied ? '✓ Copied' : 'Copy'}
                </Button>
              </HStack>
              <Text fontSize="xs" color="lmFg.muted" mt={2}>
                It opens the test in fullscreen. Anyone in the class can use it; nobody outside can.
              </Text>
            </>
          ) : (
            <>
              {!isAlreadyPublished && (
                <ClockRow
                  step="1"
                  title="Link goes live"
                  subtitle="When the quiz appears in the class and the link starts answering. Nothing starts yet."
                  isInvalid={publishInPast}
                  action={
                    publishAt ? (
                      <Button size="xs" variant="outline" onClick={() => setPublishAt('')}>
                        Publish now instead
                      </Button>
                    ) : (
                      <Badge colorScheme="green" borderRadius="full" px={2}>
                        ✓ Publishing now
                      </Badge>
                    )
                  }
                >
                  <Input
                    type="datetime-local"
                    maxW="260px"
                    value={publishAt}
                    onChange={(event) => setPublishAt(event.target.value)}
                  />
                  <FormHelperText fontSize="xs">
                    {publishAt
                      ? 'Scheduled. Clear this box — or press "Publish now instead" — to put it up the moment you publish.'
                      : 'Empty means now: the class sees it as soon as you press Publish.'}
                  </FormHelperText>
                </ClockRow>
              )}

              <ClockRow
                step={isAlreadyPublished ? '1' : '2'}
                title="Students can start"
                subtitle="When the Start button unlocks. Before this the link shows the instructions and a countdown."
                isInvalid={startsBeforePublished}
              >
                <Input
                  type="datetime-local"
                  maxW="260px"
                  value={availableFrom}
                  onChange={(event) => setAvailableFrom(event.target.value)}
                />
                <FormHelperText fontSize="xs">
                  Leave blank to let them start straight away.
                </FormHelperText>
              </ClockRow>

              {/* The two closing times, deliberately adjacent. They answer
                  different questions — "who may still walk in" and "when does
                  the room shut" — and reading them side by side is the only way
                  the difference is obvious. */}
              <ClockRow
                step={isAlreadyPublished ? '2' : '3'}
                title="Last time to start (latecomers turned away)"
                subtitle="Nobody may begin after this. Students already sitting the paper keep their full time and finish normally."
                isInvalid={closesTooEarly || missingCutOff}
                action={
                  <HStack spacing={2}>
                    <Switch
                      id="limit-entry"
                      size="sm"
                      isChecked={limitEntry}
                      onChange={(event) => setLimitEntry(event.target.checked)}
                    />
                    <Text fontSize="xs" color="lmFg.muted">
                      {limitEntry ? 'On' : 'Off — anyone may begin while it is open'}
                    </Text>
                  </HStack>
                }
              >
                {limitEntry && (
                  <Input
                    type="datetime-local"
                    maxW="260px"
                    value={startDeadline}
                    onChange={(event) => setStartDeadline(event.target.value)}
                  />
                )}
              </ClockRow>

              <ClockRow
                step={isAlreadyPublished ? '3' : '4'}
                title="Test closes (paper ends for everyone)"
                subtitle="After this nobody can open the paper, and any sitting still running is submitted. It is also the due date on the class stream."
                isInvalid={testClosesTooEarly}
              >
                <Input
                  type="datetime-local"
                  maxW="260px"
                  value={availableTo}
                  onChange={(event) => setAvailableTo(event.target.value)}
                />
                <FormHelperText fontSize="xs">
                  Leave blank for a paper with no closing time.
                </FormHelperText>
              </ClockRow>

              {/* Not a moment on the timeline above — it is the one thing about
                  the sitting itself that has to be decided before the paper goes
                  out, and the only other place to decide it was a button on the
                  quiz card that a teacher remembers about while the hall is
                  already writing. Marked with a pin rather than a step number so
                  it does not read as a fifth clock. */}
              <ClockRow
                step="📍"
                title="Room code"
                subtitle="A short code you read out to the room when the sitting begins. Students type it on an on-screen keypad to start, so somebody sitting the paper from anywhere else never hears it — it is what stops a friend taking the test remotely."
                isInvalid={roomUnanswered}
                action={
                  roomUnanswered ? (
                    <Badge colorScheme="orange" borderRadius="full" px={2}>
                      Answer required
                    </Badge>
                  ) : null
                }
              >
                <RadioGroup value={roomCodeMode} onChange={setRoomCodeMode}>
                  <Stack spacing={2}>
                    <Radio value="required">
                      <Text fontSize="sm">Require a room code</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        {roomCodeSet
                          ? 'Keeps the code this paper already has — you can replace it below, or any time from the quiz card.'
                          : 'One is generated when you publish and shown here, ready to read out.'}
                      </Text>
                    </Radio>
                    <Radio value="none">
                      <Text fontSize="sm">No room code</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        Anyone in the class can start from wherever they are.
                      </Text>
                    </Radio>
                  </Stack>
                </RadioGroup>
                {roomCodeMode === 'required' && roomCodeSet && (
                  <Checkbox
                    mt={3}
                    size="sm"
                    isChecked={regenerateRoomCode}
                    onChange={(event) => setRegenerateRoomCode(event.target.checked)}
                  >
                    <Text fontSize="xs">
                      Generate a new code, retiring the current one
                      {existingRoomCode ? ` (${existingRoomCode})` : ''}
                    </Text>
                  </Checkbox>
                )}
              </ClockRow>

              <Divider mb={5} />

              <ClockRow
                step={isAlreadyPublished ? '4' : '5'}
                title="Results announced"
                subtitle="When students see their score and the answers. They are notified, and the subject stays marked on their class card until they have read it."
                isInvalid={resultsBeforeClose || missingRelease || unanswered}
                action={
                  unanswered ? (
                    <Badge colorScheme="orange" borderRadius="full" px={2}>
                      Answer required
                    </Badge>
                  ) : null
                }
              >
                <RadioGroup
                  value={resultsMode}
                  onChange={(value) => {
                    setResultsMode(value);
                    // A cohort released together is almost always released
                    // after the paper shuts, so that is the offered start.
                    if (value === 'scheduled' && !resultReleaseAt) {
                      setResultReleaseAt(availableTo || nowForInput());
                    }
                  }}
                >
                  <Stack spacing={2}>
                    <Radio value="immediate">
                      <Text fontSize="sm">As each student submits</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        Their score appears on the last page of their own paper.
                      </Text>
                    </Radio>
                    <Radio value="scheduled">
                      <Text fontSize="sm">At a set time, for the whole class together</Text>
                      <Text fontSize="xs" color="lmFg.subtle">
                        Nobody sees a mark until then, however early they finish.
                      </Text>
                    </Radio>
                  </Stack>
                </RadioGroup>
                {resultsMode === 'scheduled' && (
                  <Box mt={3}>
                    <Input
                      type="datetime-local"
                      maxW="260px"
                      value={resultReleaseAt}
                      onChange={(event) => setResultReleaseAt(event.target.value)}
                    />
                    <FormHelperText fontSize="xs">
                      You can always release them sooner — the results page has a “Publish results
                      now” button that overrides this once the quiz is conducted.
                    </FormHelperText>
                  </Box>
                )}
              </ClockRow>

              {publishInPast && (
                <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Publish date cannot be in the past.
                </Alert>
              )}
              {startsBeforePublished && (
                <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  {publishAt
                    ? 'The quiz cannot start before it is published. Move the start time later, or publish earlier.'
                    : 'Starting time cannot be earlier than publish time.'}
                </Alert>
              )}
              {closesTooEarly && (
                <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Entry would close before the quiz opens, so nobody could ever begin. Move the
                  cut-off later.
                </Alert>
              )}
              {testClosesTooEarly && (
                <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Test closing time cannot be earlier than the start time or entry cut-off time.
                </Alert>
              )}
              {missingCutOff && (
                <Alert status="warning" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Set the time after which nobody may begin, or switch the cut-off off.
                </Alert>
              )}
              {resultsBeforeClose && (
                <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Results would be announced while the test is still open, so anyone still writing
                  could read the answers. Announce them after it closes.
                </Alert>
              )}
              {missingRelease && (
                <Alert status="warning" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Set the time the results are announced, or choose to show each student their score
                  as they submit.
                </Alert>
              )}
              {roomUnanswered && (
                <Alert status="warning" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Choose whether this paper needs a room code. It is the check that the student
                  sitting it is in the room you are invigilating, and it is far harder to add once
                  the class has the link.
                </Alert>
              )}
              {unanswered && (
                <Alert status="warning" borderRadius="md" mt={4} fontSize="sm">
                  <AlertIcon />
                  Choose when results are announced ({isAlreadyPublished ? 'step 4' : 'step 5'}) before publishing. Everything else on
                  this paper can be changed afterwards; when a class first sees its marks cannot.
                </Alert>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant={link ? 'solid' : 'ghost'} onClick={onClose}>
            {link ? 'Done' : 'Cancel'}
          </Button>
          {!link && (
            <Button colorScheme="green" onClick={submit} isLoading={saving} isDisabled={outOfOrder}>
              {isAlreadyPublished
                ? 'Save changes'
                : publishAt
                ? 'Schedule & get link'
                : 'Publish now & get link'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
