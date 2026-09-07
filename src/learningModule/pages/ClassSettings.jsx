import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import getEnvironment from '../../getenvironment';
import lmApi from '../api/lmApi';
import { ClassCardPreview, ColorPicker, SectionCard } from '../components/common';
import { CLASS_COLORS } from '../format';

export default function ClassSettings() {
  const { classId, klass, reloadClass } = useOutletContext();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    name: klass.name,
    section: klass.section,
    subject: klass.subject,
    subjectCode: klass.subjectCode,
    room: klass.room,
    description: klass.description,
    coverColor: klass.coverColor,
    meetLink: klass.meetLink,
    academicYear: klass.academicYear,
    semester: klass.semester,
    batch: klass.batch,
  });
  const [settings, setSettings] = useState({
    ...klass.settings,
    emailTriggers: {
      announcements: true,
      assignments: true,
      grades: true,
      comments: true,
      submissions: true,
      ...(klass.settings?.emailTriggers || {}),
    },
  });
  const [code, setCode] = useState(klass.code);
  const [saving, setSaving] = useState(false);
  const [lockedRooms, setLockedRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [branchCode, setBranchCode] = useState(null);

  const { onCopy, hasCopied } = useClipboard(code);

  // Resolve branch code from dept name
  useEffect(() => {
    if (!klass.dept) return;
    let cancelled = false;
    lmApi.ttBranches().then(branches => {
      if (cancelled) return;
      const branch = branches.find(b => b.dept === klass.dept);
      if (branch) setBranchCode(branch.code);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [klass.dept]);

  useEffect(() => {
    if (!klass.dept || !klass.semester || !klass.subject) return;
    
    let isMounted = true;
    const fetchRooms = async () => {
      setLoadingRooms(true);
      try {
        const branches = await lmApi.ttBranches();
        const branch = branches.find(b => b.dept === klass.dept);
        if (!branch || !branch.code) {
          if (isMounted) setLoadingRooms(false);
          return;
        }
        
        const LOCK_API = `${getEnvironment()}/api/v1/timetablemodule/lock`;
        const url = `${LOCK_API}/lockclasstt/${encodeURIComponent(branch.code)}/${encodeURIComponent(klass.semester)}`;
        const token = localStorage.getItem('token');
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.timetableData) {
            const roomSet = new Set();
            Object.keys(data.timetableData).forEach(day => {
              if (day === 'sem' || day === 'code') return;
              const slots = data.timetableData[day];
              Object.keys(slots).forEach(slot => {
                const slotArrays = slots[slot];
                if (Array.isArray(slotArrays)) {
                  slotArrays.forEach(slotDataArray => {
                    if (Array.isArray(slotDataArray)) {
                      slotDataArray.forEach(entry => {
                        if (entry.subject === klass.subject && entry.room) {
                          roomSet.add(String(entry.room).trim().toUpperCase());
                        }
                      });
                    }
                  });
                }
              });
            });
            const fetchedRooms = [...roomSet].sort();
            setLockedRooms(fetchedRooms);
            if (fetchedRooms.length > 0) {
              setForm(prev => ({ ...prev, room: fetchedRooms.join(', ') }));
            } else {
              setForm(prev => ({ ...prev, room: '' }));
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch rooms", err);
      } finally {
        if (isMounted) setLoadingRooms(false);
      }
    };
    fetchRooms();
    return () => { isMounted = false; };
  }, [klass.dept, klass.semester, klass.subject]);

  useEffect(() => {
    if (!branchCode) return undefined;
    let cancelled = false;
    setLoadingSemesters(true);
    lmApi
      .ttSemesters(branchCode)
      .then((list) => !cancelled && setSemesters(list))
      .catch(() => !cancelled && setSemesters([]))
      .finally(() => !cancelled && setLoadingSemesters(false));
    return () => {
      cancelled = true;
    };
  }, [branchCode]);

  useEffect(() => {
    if (!branchCode || !form.semester) {
      setSubjects([]);
      return undefined;
    }
    let cancelled = false;
    setLoadingSubjects(true);
    lmApi
      .ttSubjects(branchCode, form.semester)
      .then((list) => !cancelled && setSubjects(list))
      .catch(() => !cancelled && setSubjects([]))
      .finally(() => !cancelled && setLoadingSubjects(false));
    return () => {
      cancelled = true;
    };
  }, [branchCode, form.semester]);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setSetting = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));
  const setEmailTrigger = (key, value) =>
    setSettings((prev) => ({
      ...prev,
      emailTriggers: { ...(prev.emailTriggers || {}), [key]: value },
    }));

  const save = async () => {
    setSaving(true);
    try {
      await lmApi.updateClass(classId, { ...form, settings });
      toast({ status: 'success', title: 'Class updated' });
      reloadClass();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Generate a new class code? The old one stops working immediately.')) return;
    try {
      const result = await lmApi.regenerateCode(classId);
      setCode(result.code);
      reloadClass();
      toast({ status: 'success', title: 'New class code generated' });
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };

  const archive = async () => {
    const archiving = klass.status !== 'archived';
    try {
      await lmApi.archiveClass(classId, archiving);
      toast({ status: 'success', title: archiving ? 'Class archived' : 'Class restored' });
      reloadClass();
    } catch (error) {
      toast({ status: 'error', title: error.message });
    }
  };
  const complete = async () => {
  const completing = klass.status !== 'completed';
  try {
    await lmApi.completeClass(classId, completing);
    toast({ status: 'success', title: completing ? 'Class marked as completed' : 'Class restored' });
    reloadClass();
  } catch (error) {
    toast({ status: 'error', title: error.message });
  }
};

  const destroy = async () => {
  const typed = window.prompt(
    `The class will be hidden from your view and a deletion request will be sent to the admin. Data will not be deleted until the admin approves.\n\nType the class name "${klass.name}" to confirm.`
  );
  if (typed !== klass.name) return;
  try {
    await lmApi.requestClassDeletion(classId);
    toast({ status: 'success', title: 'Deletion request sent to admin' });
    navigate('/learning');
  } catch (error) {
    toast({ status: 'error', title: error.message });
  }
};

  return (
    <Box maxW="820px">
      <SectionCard title="Class details" mb={4}>
        <FormControl mb={4}>
          <FormLabel fontSize="sm">Class name</FormLabel>
          <Input value={form.name} onChange={set('name')} />
        </FormControl>
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} mb={4}>
          <FormControl>
            <FormLabel fontSize="sm">Section</FormLabel>
            <Input value={form.section} onChange={set('section')} />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Subject</FormLabel>
            <Select
              value={subjects.find(s => s.subCode === form.subjectCode)?.id || ''}
              onChange={(event) => {
                const selected = subjects.find(s => s.id === event.target.value);
                if (selected) {
                  setForm(prev => ({
                    ...prev,
                    subject: selected.subName || selected.name,
                    subjectCode: selected.subCode
                  }));
                }
              }}
              placeholder={loadingSubjects ? 'Loading…' : 'Select subject'}
              isDisabled={!form.semester || loadingSubjects}
            >
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.subCode, item.subName || item.name].filter(Boolean).join(' — ')}
                  {item.type ? ` (${item.type})` : ''}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Room</FormLabel>
            <Input 
              value={loadingRooms ? 'Loading...' : form.room} 
              isReadOnly 
              bg="lmBg.sunken"
              placeholder="No rooms allotted"
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Department</FormLabel>
            <Input value={klass.dept || ''} isReadOnly bg="lmBg.sunken" placeholder="No department set" />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Academic year</FormLabel>
            <Input value={form.academicYear} onChange={set('academicYear')} placeholder="2025-26" />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Semester</FormLabel>
            <Select
              value={form.semester}
              onChange={(event) => {
                setForm(prev => ({ ...prev, semester: event.target.value, subject: '', subjectCode: '' }));
              }}
              placeholder={loadingSemesters ? 'Loading…' : 'Select semester'}
              isDisabled={loadingSemesters}
            >
              {semesters.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </FormControl>
        </SimpleGrid>
        <FormControl mb={4}>
          <FormLabel fontSize="sm">Description</FormLabel>
          <Textarea rows={3} value={form.description} onChange={set('description')} />
        </FormControl>
        <FormControl mb={4}>
          <FormLabel fontSize="sm">Meeting link</FormLabel>
          <Input value={form.meetLink} onChange={set('meetLink')} placeholder="https://meet.google.com/…" />
        </FormControl>
        <FormControl mb={4}>
          <FormLabel fontSize="sm">Theme colour</FormLabel>
          <ColorPicker
            value={form.coverColor}
            options={CLASS_COLORS}
            onChange={(color) => setForm((prev) => ({ ...prev, coverColor: color }))}
          />
        </FormControl>
        <Box maxW="360px">
          <Text fontSize="xs" color="lmFg.muted" mb={2}>
            Preview
          </Text>
          <ClassCardPreview
            color={form.coverColor}
            title={form.name || 'Class name'}
            subtitle={[form.section, form.subject].filter(Boolean).join(' · ')}
          />
        </Box>
      </SectionCard>

      <SectionCard title="Class code" subtitle="Students use this to join." mb={4}>
        <Flex align="center" gap={4} wrap="wrap">
          <Text fontSize="2xl" fontWeight="700" fontFamily="mono" letterSpacing="wider">
            {code}
          </Text>
          <Button size="sm" variant="outline" onClick={onCopy}>
            {hasCopied ? 'Copied!' : 'Copy'}
          </Button>
          <Button size="sm" variant="outline" onClick={regenerate}>
            Generate new code
          </Button>
        </Flex>
        <Checkbox
          mt={4}
          size="sm"
          isChecked={settings.allowJoinByCode}
          onChange={(event) => setSetting('allowJoinByCode', event.target.checked)}
        >
          Allow joining with this code
        </Checkbox>
        <Checkbox
          mt={2}
          size="sm"
          isChecked={settings.requireApproval}
          onChange={(event) => setSetting('requireApproval', event.target.checked)}
        >
          Review every join request before admitting a student
        </Checkbox>
      </SectionCard>

      <SectionCard title="Permissions & notifications" mb={4}>
        <FormControl mb={4} maxW="360px">
          <FormLabel fontSize="sm">Who can post and comment</FormLabel>
          <Select value={settings.whoCanPost || 'students_can_comment'} onChange={(event) => setSetting('whoCanPost', event.target.value)}>
            <option value="students_can_comment">Students can only comment</option>
            <option value="students_can_post">Students can post and comment</option>
            <option value="teachers_only">Only teachers can post or comment</option>
          </Select>
        </FormControl>
        <Checkbox
          size="sm"
          isChecked={settings.showGradesToStudents}
          onChange={(event) => setSetting('showGradesToStudents', event.target.checked)}
        >
          Let students see their gradebook
        </Checkbox>
        <Checkbox
          mt={2}
          size="sm"
          isChecked={settings.emailNotifications}
          onChange={(event) => setSetting('emailNotifications', event.target.checked)}
        >
          Email class members on updates
        </Checkbox>

        {settings.emailNotifications && (
          <Box ml={6} mt={2} p={3} bg="lmBg.sunken" borderRadius="md" borderLeft="3px solid" borderColor="blue.400">
            <Text fontSize="xs" fontWeight="700" color="lmFg.subtle" mb={2}>
              Class email triggers:
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
              <Checkbox
                size="sm"
                isChecked={settings.emailTriggers?.announcements !== false}
                onChange={(e) => setEmailTrigger('announcements', e.target.checked)}
              >
                Stream announcements & posts
              </Checkbox>
              <Checkbox
                size="sm"
                isChecked={settings.emailTriggers?.assignments !== false}
                onChange={(e) => setEmailTrigger('assignments', e.target.checked)}
              >
                New assignments & quizzes
              </Checkbox>
              <Checkbox
                size="sm"
                isChecked={settings.emailTriggers?.grades !== false}
                onChange={(e) => setEmailTrigger('grades', e.target.checked)}
              >
                Grades returned
              </Checkbox>
              <Checkbox
                size="sm"
                isChecked={settings.emailTriggers?.comments !== false}
                onChange={(e) => setEmailTrigger('comments', e.target.checked)}
              >
                Forum replies & comments
              </Checkbox>
              <Checkbox
                size="sm"
                isChecked={settings.emailTriggers?.submissions !== false}
                onChange={(e) => setEmailTrigger('submissions', e.target.checked)}
              >
                Student submissions
              </Checkbox>
            </SimpleGrid>
          </Box>
        )}
        <FormControl mt={4} maxW="200px">
          <FormLabel fontSize="sm">Default points for new work</FormLabel>
          <Input
            type="number"
            min={0}
            value={settings.defaultPoints}
            onChange={(event) => setSetting('defaultPoints', Number(event.target.value) || 0)}
          />
          <FormHelperText fontSize="xs">Pre-filled when you create an assignment.</FormHelperText>
        </FormControl>
      </SectionCard>

      <Flex gap={2} mb={8}>
        <Button colorScheme="blue" onClick={save} isLoading={saving}>
          Save changes
        </Button>
      </Flex>

      <SectionCard title="Danger zone" borderColor="lmHue.red200">
        <Flex justify="space-between" align="center" gap={3} wrap="wrap" py={2}>
          <Box>
            <Text fontSize="sm" fontWeight="600">
              {klass.status === 'completed' ? 'Unmark as completed' : 'Mark as completed'}
            </Text>
            <Text fontSize="xs" color="lmFg.muted">
              Signals the class has been completed successfully. Stays readable, drops out of the main list.
            </Text>
          </Box>
          <Button size="sm" variant="outline" colorScheme="green" onClick={complete}>
            {klass.status === 'completed' ? 'Unmark' : 'Complete'}
          </Button>
        </Flex>
        <Divider my={3} />
        <Flex justify="space-between" align="center" gap={3} wrap="wrap" py={2}>
          <Box>
            <Text fontSize="sm" fontWeight="600">
              {klass.status === 'archived' ? 'Restore this class' : 'Archive this class'}
            </Text>
            <Text fontSize="xs" color="lmFg.muted">
              Archived classes stay readable but drop out of the main list and accept no new work.
            </Text>
          </Box>
          <Button size="sm" variant="outline" onClick={archive}>
            {klass.status === 'archived' ? 'Restore' : 'Archive'}
          </Button>
        </Flex>
        {klass.isOwner && (
          <>
            <Divider my={3} />
            <Flex justify="space-between" align="center" gap={3} wrap="wrap" py={2}>
              <Box>
                <Text fontSize="sm" fontWeight="600" color="red.600">
                  Request class deletion
                </Text>
                <Text fontSize="xs" color="lmFg.muted">
                  Sends a deletion request to the admin. The class is hidden from your view but data stays until the admin approves permanent deletion.
                </Text>
              </Box>
              <Button size="sm" colorScheme="red" variant="outline" onClick={destroy}>
                Request deletion
              </Button>
            </Flex>
          </>
        )}
      </SectionCard>
    </Box>
  );
}
