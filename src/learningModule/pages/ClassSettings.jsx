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
  Wrap,
  WrapItem,
  useClipboard,
  useToast,
} from '@chakra-ui/react';
import getEnvironment from '../../getenvironment';
import lmApi from '../api/lmApi';
import {
  CardActions,
  CardBody,
  CardRow,
  ClassCardPreview,
  ColorPicker,
  SectionCard,
} from '../components/common';
import { CLASS_COLORS } from '../format';

/* Departments are typed by hand across the platform and arrive spelled every
   which way. Folded to compare, exactly as services/departmentHeads.deptKeyOf
   does on the server — the two have to agree or a class resolves to a branch
   here and to nothing there. */
const deptKey = (value) =>
  String(value || '').trim().replace(/[\s_.-]+/g, '').toUpperCase();

/* The value of the "(current)" option in the Subject dropdown — the subject the
   class already carries, shown when the timetable list does not contain it. A
   sentinel rather than the subject's own code, which could collide with a row
   or, when the class has no code, with the placeholder's empty value. */
const CURRENT_SUBJECT = '__current_subject__';

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
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  // Which timetable row the Subject dropdown has selected. See the note on the
  // control itself for why a row id and not the subject code.
  const [subjectRowId, setSubjectRowId] = useState('');

  const { onCopy, hasCopied } = useClipboard(code);

  /* The class's department, resolved to the timetable branch whose subjects it
     may pick from.
     
     Matched on a folded key rather than by `===`, which is what this did and
     why the Subject dropdown was inert for most classes: department names are
     typed by hand in half a dozen places and reach the database as "Computer
     Science and Engineering", "computer science & engineering" and
     "Computer_Science". An exact comparison against the timetable's spelling
     missed, `branchCode` stayed null, and with no branch there are no
     semesters and no subjects — so the control rendered, disabled and empty,
     with nothing to say why. The same folding the rest of the module uses for
     this (services/departmentHeads deptKeyOf).
     
     Creation never hit this: there the teacher picks the branch from a list,
     so the code is in hand rather than inferred. */
  useEffect(() => {
    let cancelled = false;
    setLoadingBranches(true);
    lmApi
      .ttBranches()
      .then((list) => {
        if (cancelled) return;
        setBranches(list);
        const match = list.find((b) => deptKey(b.dept) === deptKey(klass.dept));
        if (match) setBranchCode(match.code);
      })
      .catch(() => !cancelled && setBranches([]))
      .finally(() => !cancelled && setLoadingBranches(false));
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
            /* Kept exactly as the timetable spells it.

               This used to uppercase every room, and that was the one place in
               the whole chain where the string changed. A room is picked from
               the master room list when a department adds it, and picked from
               that list again when a slot is filled in, so `masterroom.room`
               reaches a timetable entry character for character — and then
               "Lt-1" was stored on the class as "LT-1", which no longer matched
               the record it came from.

               Deduplicated by a folded key rather than by folding the value, so
               the same room listed twice is still one room without the spelling
               being rewritten. */
            const roomByKey = new Map();
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
                          const name = String(entry.room).trim();
                          const key = name.toLowerCase();
                          if (name && !roomByKey.has(key)) roomByKey.set(key, name);
                        }
                      });
                    }
                  });
                }
              });
            });
            const fetchedRooms = [...roomByKey.values()].sort((a, b) => a.localeCompare(b));
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

  /**
   * The class's stored subject, found again in the list once it loads.
   *
   * Matched on the code *and* the name, not the code alone: a lab split across
   * batches is one timetable row per batch, all sharing `subCode` and differing
   * only in `subName` — which is the field the dropdown renders. By code alone
   * a class taught to B3b comes back selected as B3a.
   */
  useEffect(() => {
    if (!subjects.length) {
      setSubjectRowId('');
      return;
    }
    const code = form.subjectCode || '';
    const name = form.subject || '';
    const exact = subjects.find((s) => s.subCode === code && (s.subName || s.name) === name);
    const byCode = code ? subjects.find((s) => s.subCode === code) : null;
    setSubjectRowId((exact || byCode)?.id || '');
  }, [subjects, form.subjectCode, form.subject]);

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
              /**
               * Keyed by the timetable row id, the way the create-class picker
               * is, because a subject code does not identify a row.
               *
               * This was keyed by `subCode`, and two things followed. A lab
               * split across batches is one row per batch sharing the code
               * (see the server's listSubjects), so the dropdown carried
               * several options with the same value and the browser selected
               * the first of them whatever was clicked — the second batch of a
               * lab could not be picked at all. And a timetable row with no
               * code at all rendered as value="", which is the placeholder's
               * value, so choosing it read as "No subject" and cleared the
               * field instead of setting it.
               */
              value={subjectRowId || (form.subjectCode || form.subject ? CURRENT_SUBJECT : '')}
              onChange={(event) => {
                const id = event.target.value;
                // Already the subject on the class; there is nothing to apply.
                if (id === CURRENT_SUBJECT) return;
                if (!id) {
                  setSubjectRowId('');
                  setForm(prev => ({ ...prev, subject: '', subjectCode: '' }));
                  return;
                }
                const selected = subjects.find(s => s.id === id);
                if (!selected) return;
                setSubjectRowId(id);
                setForm(prev => ({
                  ...prev,
                  // What creation stores, so a class edited here and a class
                  // created there carry the same thing.
                  subject: selected.subName || selected.name || '',
                  subjectCode: selected.subCode || '',
                }));
              }}
              placeholder={loadingSubjects ? 'Loading…' : 'No subject'}
              isDisabled={loadingSubjects || (!subjects.length && !form.subjectCode)}
            >
              {/* The subject the class already has, when the list does not
                  carry it — a different semester, a subject since retired, or
                  a branch that could not be resolved. Without this the field
                  reads as empty for a class that plainly has a subject, and
                  saving would then clear it. Its own sentinel value, so it can
                  never collide with a row's id or with the placeholder. */}
              {!subjectRowId && (form.subjectCode || form.subject) ? (
                <option value={CURRENT_SUBJECT}>
                  {[form.subjectCode, form.subject].filter(Boolean).join(' — ')} (current)
                </option>
              ) : null}
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.subCode, item.subName || item.name].filter(Boolean).join(' — ')}
                  {item.type ? ` (${item.type})` : ''}
                </option>
              ))}
            </Select>
            {/* Why the list is empty, rather than a disabled control and no
                explanation — which is what this was. */}
            {!loadingSubjects && !subjects.length ? (
              <FormHelperText fontSize="xs">
                {!branchCode
                  ? 'No timetable branch matches this class\u2019s department, so its subjects cannot be listed. Pick the branch below.'
                  : !form.semester
                    ? 'Choose a semester and its subjects will be listed here.'
                    : 'The timetable lists no subjects for this branch and semester.'}
              </FormHelperText>
            ) : null}
          </FormControl>

          {/* Offered only when the department did not resolve to a branch on
              its own. A class whose department is blank, or spelled in a way
              the timetable does not carry, could otherwise never have its
              subject changed at all — the dropdown had nothing to offer and no
              way to be given anything. */}
          {!branchCode && !loadingBranches ? (
            <FormControl>
              <FormLabel fontSize="sm">Subject list from</FormLabel>
              <Select
                value={branchCode || ''}
                onChange={(event) => setBranchCode(event.target.value || null)}
                placeholder="Select a branch"
              >
                {branches.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.dept || item.code}
                  </option>
                ))}
              </Select>
              <FormHelperText fontSize="xs">
                Only decides which subjects are offered here. The class stays in{' '}
                {klass.dept || 'its own department'}.
              </FormHelperText>
            </FormControl>
          ) : null}
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
              {/* Same reason as the subject above: a semester the branch does
                  not list still belongs to this class, and a field that reads
                  blank invites somebody to "fix" it and lose what was there. */}
              {form.semester && !semesters.includes(form.semester) ? (
                <option value={form.semester}>{form.semester} (current)</option>
              ) : null}
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
        <CardRow>
          <CardBody minW="auto" flex="0 0 auto">
            <Text fontSize="2xl" fontWeight="700" fontFamily="mono" letterSpacing="wider">
              {code}
            </Text>
          </CardBody>
          <CardActions justify={{ base: 'flex-start', md: 'flex-start' }} flex="1">
            <Button size="sm" variant="outline" onClick={onCopy}>
              {hasCopied ? 'Copied!' : 'Copy'}
            </Button>
            <Button size="sm" variant="outline" onClick={regenerate}>
              Generate new code
            </Button>
          </CardActions>
        </CardRow>
        <Wrap spacing={6} mt={4}>
          <WrapItem>
            <Checkbox
              size="sm"
              isChecked={settings.allowJoinByCode}
              onChange={(event) => setSetting('allowJoinByCode', event.target.checked)}
            >
              Allow joining with this code
            </Checkbox>
          </WrapItem>
          <WrapItem>
            <Checkbox
              size="sm"
              isChecked={settings.requireApproval}
              onChange={(event) => setSetting('requireApproval', event.target.checked)}
            >
              Review every join request before admitting a student
            </Checkbox>
          </WrapItem>
        </Wrap>
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
        <Wrap spacing={6}>
          <WrapItem>
            <Checkbox
              size="sm"
              isChecked={settings.showGradesToStudents}
              onChange={(event) => setSetting('showGradesToStudents', event.target.checked)}
            >
              Let students see their gradebook
            </Checkbox>
          </WrapItem>
          <WrapItem>
            <Checkbox
              size="sm"
              isChecked={settings.emailNotifications}
              onChange={(event) => setSetting('emailNotifications', event.target.checked)}
            >
              Email class members on updates
            </Checkbox>
          </WrapItem>
        </Wrap>

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
