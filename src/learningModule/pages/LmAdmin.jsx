import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Input,
  Link as RouterLinkStyle,
  SimpleGrid,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import lmApi from '../api/lmApi';
import { EmptyState, ErrorState, Loading, SectionCard, StatTile } from '../components/common';
import { relativeTime } from '../format';
import { sebDiagnosis } from '../sebDiagnosis';

/**
 * The lm-admin dashboard: what the module looks like right now, platform-wide.
 *
 * Deliberately a *summary* rather than a second copy of the bug queue or the
 * feedback inbox — those already exist, already work, and duplicating their
 * review actions here would just be a second place for the two to disagree.
 * This page answers the questions neither of them can: how many classes and
 * people are actually using the module, and what needs a look right now.
 */

const BUG_STATUS_STYLE = {
  open: { colorScheme: 'blue', label: 'open' },
  acknowledged: { colorScheme: 'green', label: 'acknowledged' },
  duplicate: { colorScheme: 'purple', label: 'duplicate' },
  rejected: { colorScheme: 'gray', label: 'rejected' },
  fixed: { colorScheme: 'teal', label: 'fixed' },
};

const FEEDBACK_STATUS_STYLE = {
  new: { colorScheme: 'purple', label: 'unread' },
  read: { colorScheme: 'gray', label: 'read' },
  actioned: { colorScheme: 'green', label: 'acted on' },
};

function CountBadges({ counts, styles }) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return <Text fontSize="sm" color="lmFg.muted">Nothing yet.</Text>;
  return (
    <Flex gap={2} wrap="wrap">
      {entries.map(([key, count]) => (
        <Badge key={key} colorScheme={styles[key]?.colorScheme || 'gray'} borderRadius="full" px={2}>
          {count} {styles[key]?.label || key}
        </Badge>
      ))}
    </Flex>
  );
}

/**
 * The institution's Safe Exam Browser setup, in one place.
 *
 * It used to be per quiz: every SEB exam meant another trip through SEB's
 * Configuration Tool for a file that was the same every time. One file here
 * serves every paper — the hash SEB and the server compare is over the
 * *request's* URL plus the Config Key, so one key is valid for every quiz under
 * it (see services/sebGate.js).
 *
 * The Config Key is asked for alongside the file and never shown back. It is the
 * secret half of the check for every exam at once, so it goes in and does not
 * come out.
 */
/** One line of the shared-configuration status: present, or not, and why it matters. */
function SebStatusRow({ ok, label, detail }) {
  return (
    <Flex align="center" gap={2} py={1}>
      <Text fontSize="sm" color={ok ? 'green.500' : 'red.500'} fontWeight="700" w="16px">
        {ok ? '✓' : '✗'}
      </Text>
      <Text fontSize="sm" fontWeight="600" minW="190px">
        {label}
      </Text>
      <Text fontSize="sm" color="lmFg.subtle">
        {detail}
      </Text>
    </Flex>
  );
}

function SharedSebCard() {
  const [state, setState] = useState(null);
  const [file, setFile] = useState(null);
  const [configKey, setConfigKey] = useState('');
  const [busy, setBusy] = useState(false);
  // The address students will open. Defaults to wherever this page is being
  // viewed from, which is right in production and wrong on a developer's laptop
  // - and getting it wrong is not cosmetic: SEB computes the Config Key over the
  // settings, Start URL included.
  const [origin, setOrigin] = useState(() => window.location.origin);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  /* The verdict from a real request, and whether one is in flight. Null until
     the button is pressed: an unrun check must never look like a failed one,
     which is the whole reason two green ticks above are not an answer. */
  const [check, setCheck] = useState(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await lmApi.getSharedSebConfig());
    } catch {
      // A failure here is not worth a red page on a dashboard: the card simply
      // shows nothing configured, which is also the state it would be in.
      setState({ ready: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Ask the server whether this browser passes the gate.
   *
   * Everything above this is a description of what is *stored*. This is the only
   * control on the page that can say whether it works, because a Config Key
   * cannot be checked by looking at it — only by a real Safe Exam Browser making
   * a real request, which is what pressing this from inside SEB does.
   */
  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await lmApi.checkSharedSebConfig());
    } catch (err) {
      setCheck({ verified: false, reason: 'unknown', error: err.message });
    } finally {
      setChecking(false);
    }
  };

  // A new file or key makes any earlier verdict a statement about something that
  // is no longer there, and a stale green tick is worse than none.
  const upload = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      setState(await lmApi.setSharedSebConfig(file, configKey.trim()));
      setFile(null);
      setConfigKey('');
      setSaved(true);
      setCheck(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Safe Exam Browser — shared configuration"
      subtitle="One .seb file and its Config Key for every exam in the institution. A quiz that uploads its own still uses its own."
    >
      {state === null ? (
        <Loading label="Checking…" />
      ) : (
        <>
          {/* Itemised, because "not working" has two causes and an administrator
              needs to know which one they are looking at: a missing file is an
              upload, a missing key is a trip through SEB's Configuration Tool. */}
          <Box borderWidth="1px" borderColor="lmBorder.default" borderRadius="md" p={3} mb={4}>
            <SebStatusRow
              ok={state.hasFile}
              label="Settings file on the server"
              detail={state.hasFile ? state.fileName : 'Not uploaded'}
            />
            <SebStatusRow
              ok={state.hasKey}
              label="Config Key on the server"
              detail={state.hasKey ? 'Stored (never shown again)' : 'Not set'}
            />
            <Text fontSize="xs" color="lmFg.subtle" mt={2}>
              {state.ready
                ? `Safe Exam Browser exams are ready to run.${state.uploadedByName ? ` Set by ${state.uploadedByName}.` : ''}`
                : 'Until both are present, a quiz requiring Safe Exam Browser can only run if it carries a file of its own.'}
            </Text>
          </Box>

          <Text fontSize="sm" fontWeight="600" mb={1}>
            1. Start from the sample
          </Text>
          <Text fontSize="xs" color="lmFg.subtle" mb={2}>
            Built for this installation with the lockdown at maximum — no other applications, no
            keyboard route out, no reload or downloads, one screen, and a URL filter that admits
            only this server. Open it in SEB&apos;s Configuration Tool: that is where the Config Key
            comes from, and where to set a quit password.
          </Text>
          <Stack direction={{ base: 'column', md: 'row' }} spacing={2} mb={2} maxW="520px">
            <Input
              size="sm"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="https://xceed.nitj.ac.in"
            />
            <Button as="a" href={lmApi.sampleSebUrl(origin)} size="sm" flexShrink={0}>
              &#11015; Download sample .seb
            </Button>
          </Stack>
          <Alert status="warning" borderRadius="md" mb={4} py={2} fontSize="xs">
            <AlertIcon boxSize={3} />
            <Box>
              This must be the address students actually open. SEB computes the Config Key over the
              settings, Start URL included, so a file built for localhost carries a key that will
              refuse every student on the real site.
            </Box>
          </Alert>

          <Text fontSize="sm" fontWeight="600" mb={1}>
            2. Upload the file and its key
          </Text>
          <Text fontSize="xs" color="lmFg.subtle" mb={2}>
            Both together — a key that does not belong to the file beside it fails every request, and
            would take every SEB exam down at once.
          </Text>
          <Stack spacing={2} maxW="520px">
            <Input
              type="file"
              accept=".seb"
              size="sm"
              p={1}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <Input
              size="sm"
              fontFamily="mono"
              placeholder="Config Key, from the SEB Configuration Tool"
              value={configKey}
              onChange={(event) => setConfigKey(event.target.value)}
            />
            <Box>
              <Button
                size="sm"
                colorScheme="purple"
                onClick={upload}
                isLoading={busy}
                isDisabled={!file || !configKey.trim()}
              >
                {state.ready ? 'Replace the shared configuration' : 'Save the shared configuration'}
              </Button>
            </Box>
            {error && (
              <Text fontSize="xs" color="red.500">
                {error}
              </Text>
            )}
            {saved && (
              <Text fontSize="xs" color="green.600">
                Saved. Every SEB exam uses it from now on.
              </Text>
            )}
          </Stack>

          {/* ---- step 3 ----
              The only control on this card that reports whether the setup
              *works*. The two ticks at the top say a file and a key are stored;
              nothing about them says the key belongs to the file, and nothing
              can, because a Config Key is a value pasted from another
              application and is only ever proved by a real Safe Exam Browser
              making a real request. Before this existed, that request was the
              first student of the exam. */}
          <Box borderTopWidth="1px" borderColor="lmBorder.default" mt={5} pt={4}>
            <Text fontSize="sm" fontWeight="600" mb={1}>
              3. Check it actually works
            </Text>
            <Text fontSize="xs" color="lmFg.subtle" mb={2}>
              Open <strong>this page inside Safe Exam Browser</strong> and press the button. It runs
              the same check a student&apos;s Start does, against the key stored above — so a pass here
              is the real thing. Run from an ordinary browser it can only tell you there are no SEB
              headers, which says nothing either way.
            </Text>
            <Stack direction={{ base: 'column', md: 'row' }} spacing={2}>
              <Button size="sm" onClick={runCheck} isLoading={checking} isDisabled={!state.hasFile}>
                Run the check from this browser
              </Button>
              {/* The same verdict without a sign-in, for the machine in the hall.
                  An invigilator launches SEB there and follows the link on the
                  sign-in page it lands on — see `SebCheck`. Offered here because
                  this is where somebody setting SEB up is standing, and the page
                  is otherwise reachable only from inside SEB itself. */}
              <Button
                as="a"
                href="/learning/seb-check"
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="outline"
              >
                Open the sign-in-free check page
              </Button>
            </Stack>

            {check && (
              <Alert
                status={check.verified ? 'success' : 'warning'}
                borderRadius="md"
                mt={3}
                py={2}
                fontSize="xs"
                alignItems="flex-start"
              >
                <AlertIcon boxSize={3} mt={1} />
                <Box>
                  {check.verified ? (
                    <>
                      <Text fontWeight="600" mb={1}>
                        Verified — Safe Exam Browser matched the stored Config Key.
                      </Text>
                      <Text>
                        This is the check every student&apos;s Start will run. Nothing further to do;
                        re-run it after any change to the file or the key.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text fontWeight="600" mb={1}>
                        Not verified{check.reason ? ` — ${check.reason}` : ''}
                      </Text>
                      <Text mb={check.seenHost ? 1 : 0}>{sebDiagnosis(check.reason)}</Text>
                      {/* The one fact an administrator cannot see from their own
                          side. The Config Key is computed over the settings, Start
                          URL included, so a file built for the wrong address fails
                          with nothing else to point at — and a sample downloaded
                          from a laptop points at localhost. */}
                      {check.seenHost && (
                        <Text color="lmFg.muted">
                          This request arrived on <strong>{check.seenHost}</strong>. The settings
                          file&apos;s Start URL must be this address.
                        </Text>
                      )}
                    </>
                  )}
                </Box>
              </Alert>
            )}
          </Box>
        </>
      )}
    </SectionCard>
  );
}

/**
 * Safe Exam Browser's own installer, one per platform.
 *
 * Separate from `SharedSebCard` above on purpose: that card holds the
 * settings file and Config Key a paper's proctoring actually checks against.
 * This is a plain convenience — the installer itself, so a student gets the
 * exact build this installation was set up and tested against rather than
 * whatever SEB's own site happens to be serving that week, which is what
 * used to turn "which version did you install" into the reason an exam
 * would not start.
 */
// Mirrors `MAX_INSTALLER_BYTES` in the server's `sebInstallerController.js`.
// Checked here as well so an oversized file is refused before the browser
// spends minutes pushing it up only to be turned away at the far end.
const MAX_INSTALLER_MB = 1024;

function SebInstallerRow({ platform, label, accept, info, onUploaded }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const upload = async () => {
    if (file && file.size > MAX_INSTALLER_MB * 1024 * 1024) {
      setError(`The installer must be under ${MAX_INSTALLER_MB} MB.`);
      return;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await lmApi.uploadSebInstaller(platform, file);
      setFile(null);
      setSaved(true);
      await onUploaded();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box borderWidth="1px" borderColor="lmBorder.default" borderRadius="md" p={3}>
      <Text fontSize="sm" fontWeight="600" mb={2}>
        {label}
      </Text>
      <SebStatusRow
        ok={info.available}
        label="Installer on the server"
        detail={
          info.available
            ? `${info.fileName}${info.uploadedByName ? ` — set by ${info.uploadedByName}` : ''}`
            : 'Not uploaded'
        }
      />
      <Stack direction={{ base: 'column', md: 'row' }} spacing={2} mt={2} maxW="480px">
        <Input
          type="file"
          accept={accept}
          size="sm"
          p={1}
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <Button size="sm" colorScheme="purple" onClick={upload} isLoading={busy} isDisabled={!file} flexShrink={0}>
          {info.available ? 'Replace' : 'Upload'}
        </Button>
      </Stack>
      {info.available && (
        <Button
          as="a"
          href={lmApi.sebInstallerDownloadUrl(platform)}
          size="xs"
          variant="link"
          colorScheme="purple"
          mt={2}
        >
          Download the file currently stored
        </Button>
      )}
      {error && (
        <Text fontSize="xs" color="red.500" mt={1}>
          {error}
        </Text>
      )}
      {saved && (
        <Text fontSize="xs" color="green.600" mt={1}>
          Saved. Students see the download on the quiz screen from now on.
        </Text>
      )}
    </Box>
  );
}

function SebInstallerCard() {
  const [state, setState] = useState(null);

  const load = useCallback(async () => {
    try {
      setState(await lmApi.getSebInstallers());
    } catch {
      // Same reasoning as `SharedSebCard`: nothing here is worth a red page —
      // the card simply shows neither platform uploaded yet.
      setState({ windows: { available: false }, mac: { available: false } });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SectionCard
      title="Safe Exam Browser — the installer"
      subtitle="A known-good Windows and Mac build, downloadable straight from the quiz screen — not the settings file above, the application itself."
      data-testid="seb-installer-card"
    >
      {state === null ? (
        <Loading label="Checking…" />
      ) : (
        <Stack spacing={3}>
          <SebInstallerRow
            platform="windows"
            label="Windows (.exe or .msi)"
            accept=".exe,.msi"
            info={state.windows}
            onUploaded={load}
          />
          <SebInstallerRow
            platform="mac"
            label="Mac (.dmg or .pkg)"
            accept=".dmg,.pkg"
            info={state.mac}
            onUploaded={load}
          />
        </Stack>
      )}
    </SectionCard>
  );
}

export default function LmAdmin() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await lmApi.adminSummary());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading label="Loading admin dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const { courses, people, bugs, feedback } = summary;

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Text fontSize="xl" fontWeight="700" color="lmFg.heading">
          Learning Module — Admin
        </Text>
        <Text fontSize="sm" color="lmFg.muted">
          Platform-wide numbers for the module, plus anything currently waiting on a look.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
        <StatTile label="Courses" value={courses.total} hint={`${courses.active} active`} accent="blue.500" />
        <StatTile label="Students enrolled" value={people.students} accent="teal.500" />
        {/* Teaching *memberships*, not accounts: somebody teaching four classes
            is four of this. The faculty page counts accounts, which is the
            other question and the one an administrator adding staff is asking. */}
        <StatTile label="Teaching staff" value={people.teachers} accent="orange.500" />
        <StatTile
          label="Bugs & suggestions"
          value={bugs.total}
          hint={`${bugs.byStatus.open || 0} open`}
          accent="red.500"
        />
        <StatTile
          label="Feedback"
          value={feedback.total}
          hint={`${feedback.byStatus.new || 0} unread`}
          accent="purple.500"
        />
      </SimpleGrid>

      <SectionCard
        title="Faculty accounts"
        subtitle="Create an account for a new faculty member, and see how many there are."
        action={
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/faculty" fontSize="sm" color="blue.600">
            Open faculty →
          </RouterLinkStyle>
        }
      >
        <Text fontSize="sm" color="lmFg.muted">
          FACULTY is the only role that can open a class, set a paper or read an answer key, so
          handing it out lives on its own page rather than in this summary.
        </Text>
      </SectionCard>

      <SectionCard
        title="Student accounts & enrollment"
        subtitle="Invite students to the module, view department-wise distribution, and monitor class enrollments."
        action={
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/students" fontSize="sm" color="blue.600">
            Open students →
          </RouterLinkStyle>
        }
      >
        <Text fontSize="sm" color="lmFg.muted">
          Invite new students by email, provision accounts, track department-wise enrollment numbers, and view which classes students have joined.
        </Text>
      </SectionCard>

      <SectionCard
        title="HOD Dashboard"
        subtitle="A department semester by semester: cohort sizes, content set, work handed in, quiz scores and six months of trend."
        action={
          <RouterLinkStyle as={RouterLink} to="/learning/lm-admin/hod-dashboard" fontSize="sm" color="purple.600" fontWeight="600">
            Open HOD Dashboard →
          </RouterLinkStyle>
        }
      >
        <Text fontSize="sm" color="lmFg.muted">
          Shows heads of department and administrators what each semester holds and what students are doing with it — never a ranking of the faculty who own those classes.
        </Text>
      </SectionCard>

      <SharedSebCard />

      <SebInstallerCard />

      <SectionCard
        title="Bugs & suggestions"
        subtitle="Full queue, with review actions, lives on the Bug / Suggestion page."
        action={
          <RouterLinkStyle as={RouterLink} to="/learning/bugs" fontSize="sm" color="blue.600">
            Open queue →
          </RouterLinkStyle>
        }
      >
        <VStack align="stretch" spacing={4}>
          <CountBadges counts={bugs.byStatus} styles={BUG_STATUS_STYLE} />
          {bugs.recent.length === 0 ? (
            <EmptyState icon="success" title="Nothing open" />
          ) : (
            <VStack align="stretch" spacing={2}>
              {bugs.recent.map((report) => (
                <Flex key={report._id} justify="space-between" gap={3} wrap="wrap" borderWidth="1px" borderRadius="md" p={3}>
                  <Box>
                    <Text fontSize="sm" fontWeight="600">{report.title}</Text>
                    <Text fontSize="xs" color="lmFg.muted">
                      {report.reporterName} · {relativeTime(report.created_at)}
                      {report.className ? ` · in ${report.className}` : ' · platform-wide'}
                    </Text>
                  </Box>
                  <Badge colorScheme={report.kind === 'suggestion' ? 'orange' : 'red'}>
                    {report.kind === 'suggestion' ? 'Suggestion' : 'Bug'}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          )}
        </VStack>
      </SectionCard>

      <SectionCard
        title="Feedback"
        subtitle="Recent items across every class. Respond from the class's own Feedback tab."
      >
        <VStack align="stretch" spacing={4}>
          <CountBadges counts={feedback.byStatus} styles={FEEDBACK_STATUS_STYLE} />
          {feedback.recent.length === 0 ? (
            <EmptyState icon="comment" title="No feedback yet" />
          ) : (
            <VStack align="stretch" spacing={2}>
              {feedback.recent.map((item) => (
                <Box key={item._id} borderWidth="1px" borderRadius="md" p={3}>
                  <Flex justify="space-between" gap={2} wrap="wrap" mb={1}>
                    <Text fontSize="sm" fontWeight="600">
                      {item.className || 'Unknown class'}
                    </Text>
                    <Badge colorScheme={FEEDBACK_STATUS_STYLE[item.status]?.colorScheme || 'gray'}>
                      {FEEDBACK_STATUS_STYLE[item.status]?.label || item.status}
                    </Badge>
                  </Flex>
                  <Text fontSize="sm" color="lmFg.body" noOfLines={2}>
                    {item.text}
                  </Text>
                  <Text fontSize="xs" color="lmFg.muted" mt={1}>
                    {item.studentName || 'Unknown student'} · {relativeTime(item.created_at)}
                  </Text>
                </Box>
              ))}
            </VStack>
          )}
        </VStack>
      </SectionCard>
    </VStack>
  );
}
