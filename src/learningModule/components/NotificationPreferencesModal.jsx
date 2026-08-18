import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  FormControl,
  FormLabel,
  FormHelperText,
  Stack,
  Divider,
  Text,
  Box,
  Flex,
  Select,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';

export default function NotificationPreferencesModal({
  isOpen,
  onClose,
  classId: initialClassId = null,
  className: initialClassName = '',
  isTeacher: initialIsTeacher = false,
}) {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [muted, setMuted] = useState(false);
  const [prefs, setPrefs] = useState({
    announcements: true,
    assignments: true,
    grades: true,
    comments: true,
    deadlines: true,
    submissions: true,
  });

  // If no classId provided, load user's classes
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    if (initialClassId) {
      setSelectedClassId(initialClassId);
      return;
    }

    const fetchClasses = async () => {
      try {
        const list = await lmApi.listClasses();
        if (isMounted && Array.isArray(list) && list.length > 0) {
          setClasses(list);
          setSelectedClassId(list[0]._id);
        }
      } catch (err) {
        console.error('Failed to load classes for notification settings:', err);
      }
    };

    fetchClasses();
    return () => { isMounted = false; };
  }, [isOpen, initialClassId]);

  // Load preferences when selectedClassId changes
  useEffect(() => {
    if (!isOpen || !selectedClassId) return;
    let isMounted = true;

    const fetchPreferences = async () => {
      setLoading(true);
      try {
        const res = await lmApi.getMyPreferences(selectedClassId);
        if (isMounted) {
          setMuted(Boolean(res.muted));
          setPrefs({
            announcements: true,
            assignments: true,
            grades: true,
            comments: true,
            deadlines: true,
            submissions: true,
            ...(res.notificationPreferences || {}),
          });
        }
      } catch (err) {
        toast({ status: 'error', title: 'Failed to load notification settings', description: err.message });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreferences();
    return () => { isMounted = false; };
  }, [isOpen, selectedClassId, toast]);

  const togglePref = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!selectedClassId) return;
    setSaving(true);
    try {
      await lmApi.updateMyPreferences(selectedClassId, {
        muted,
        notificationPreferences: prefs,
      });
      toast({ status: 'success', title: 'Notification preferences saved' });
      onClose();
    } catch (err) {
      toast({ status: 'error', title: 'Failed to save preferences', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const currentClassObj = classes.find((c) => c._id === selectedClassId);
  const activeClassName = initialClassName || currentClassObj?.name || '';
  const isTeacher = initialIsTeacher || Boolean(currentClassObj?.isTeacher);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent borderRadius="xl">
        <ModalHeader borderBottomWidth="1px" pb={3}>
          <Text fontSize="lg" fontWeight="700" color="lmFg.heading">
            Notification Settings
          </Text>
          {activeClassName && (
            <Text fontSize="xs" fontWeight="normal" color="lmFg.muted" mt={0.5}>
              {activeClassName}
            </Text>
          )}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody py={4}>
          {!initialClassId && classes.length > 0 && (
            <FormControl mb={4}>
              <FormLabel fontSize="xs" fontWeight="700" textTransform="uppercase" color="lmFg.muted">
                Select Class
              </FormLabel>
              <Select
                size="sm"
                value={selectedClassId || ''}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.section ? `(${c.section})` : ''}
                  </option>
                ))}
              </Select>
            </FormControl>
          )}

          {loading ? (
            <Flex justify="center" align="center" py={10}>
              <Spinner color="blue.500" size="lg" />
            </Flex>
          ) : (
            <Stack spacing={4}>
              <FormControl display="flex" alignItems="center" justifyContent="space-between" bg="lmBg.sunken" p={3} borderRadius="lg">
                <Box>
                  <FormLabel htmlFor="mute-class" mb="0" fontSize="sm" fontWeight="600">
                    Mute all notifications for this class
                  </FormLabel>
                  <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                    Silence both in-app notifications and email digests for this class
                  </FormHelperText>
                </Box>
                <Switch
                  id="mute-class"
                  colorScheme="red"
                  isChecked={muted}
                  onChange={(e) => setMuted(e.target.checked)}
                />
              </FormControl>

              <Divider />

              <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="wider" color="lmFg.muted">
                Choose what triggers notifications & emails
              </Text>

              <Stack spacing={3} opacity={muted ? 0.5 : 1} pointerEvents={muted ? 'none' : 'auto'}>
                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box pr={4}>
                    <FormLabel mb="0" fontSize="sm" fontWeight="600">
                      Faculty Posts & Announcements
                    </FormLabel>
                    <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                      Updates, stream posts, and announcements created by teachers
                    </FormHelperText>
                  </Box>
                  <Switch
                    colorScheme="blue"
                    isChecked={prefs.announcements}
                    onChange={() => togglePref('announcements')}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box pr={4}>
                    <FormLabel mb="0" fontSize="sm" fontWeight="600">
                      Coursework, Quizzes & Materials
                    </FormLabel>
                    <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                      New assignments, quizzes, and learning materials published
                    </FormHelperText>
                  </Box>
                  <Switch
                    colorScheme="blue"
                    isChecked={prefs.assignments}
                    onChange={() => togglePref('assignments')}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box pr={4}>
                    <FormLabel mb="0" fontSize="sm" fontWeight="600">
                      Grades & Returned Work
                    </FormLabel>
                    <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                      Notifications when teachers grade or return your submitted work
                    </FormHelperText>
                  </Box>
                  <Switch
                    colorScheme="blue"
                    isChecked={prefs.grades}
                    onChange={() => togglePref('grades')}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box pr={4}>
                    <FormLabel mb="0" fontSize="sm" fontWeight="600">
                      Forum Replies & Comments
                    </FormLabel>
                    <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                      Replies to your posts and discussion comments from classmates or teachers
                    </FormHelperText>
                  </Box>
                  <Switch
                    colorScheme="blue"
                    isChecked={prefs.comments}
                    onChange={() => togglePref('comments')}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center" justifyContent="space-between">
                  <Box pr={4}>
                    <FormLabel mb="0" fontSize="sm" fontWeight="600">
                      Deadline Alerts
                    </FormLabel>
                    <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                      Upcoming due date alerts for assignments and quizzes
                    </FormHelperText>
                  </Box>
                  <Switch
                    colorScheme="blue"
                    isChecked={prefs.deadlines}
                    onChange={() => togglePref('deadlines')}
                  />
                </FormControl>

                {isTeacher && (
                  <FormControl display="flex" alignItems="center" justifyContent="space-between">
                    <Box pr={4}>
                      <FormLabel mb="0" fontSize="sm" fontWeight="600">
                        Student Submissions
                      </FormLabel>
                      <FormHelperText mt={0} fontSize="xs" color="lmFg.muted">
                        Alerts when students turn in assignments or quizzes
                      </FormHelperText>
                    </Box>
                    <Switch
                      colorScheme="blue"
                      isChecked={prefs.submissions}
                      onChange={() => togglePref('submissions')}
                    />
                  </FormControl>
                )}
              </Stack>
            </Stack>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px" pt={3}>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave} isLoading={saving} isDisabled={loading || !selectedClassId}>
            Save Preferences
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
