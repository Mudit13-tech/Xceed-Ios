import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Image,
  ListItem,
  SimpleGrid,
  Skeleton,
  Text,
  Tooltip,
  UnorderedList,
  VStack,
  useToast,
} from '@chakra-ui/react';

import getEnvironment from '../../getenvironment';
import { EmptyState, ErrorState, Loading, SectionCard } from './common';
import { formatDate, relativeTime } from '../format';

/**
 * "Which photos does attendance know me by?" — and the one change a student is
 * allowed to make to the answer.
 *
 * Every student folder holds more photos than recognition uses: five feed the
 * embedding attendance actually matches against, and the rest sit in backup,
 * topped up daily by the active-learning loop each time the cameras recognise
 * them. Which five are in use was, until now, decided either by the
 * upload order or by an administrator mailing a one-time link — a flow that no
 * longer exists, leaving this page as the only way the choice can be made. A
 * student who knew perfectly well that one of their five was a bad frame had no
 * way to say so.
 *
 * So: swap between the two groups, and nothing else. There is no delete and no
 * upload here, and not because the buttons are missing — the server accepts a
 * save only when the two lists it receives are a rearrangement of exactly the
 * photos already on disk.
 *
 * The ERP photo sits alongside for reference. It is not part of the swap: it is
 * the official record, read-only from here.
 *
 * How often: once a week, or once through a window the department admin opens
 * for a student who cannot wait — single use, spent by the save it pays for. A
 * ground truth that changes daily is not a ground truth, and every change
 * rebuilds the embeddings of every subject the student is enrolled in, so the
 * rule is about cost as much as stability.
 *
 * The server decides (myGroundTruthController.updateWindowFor) and re-checks on
 * every save; this page only explains the answer it is given. When the answer
 * is "not yet", the controls are not rendered at all rather than rendered
 * disabled — a disabled attribute is one devtools edit away from gone, and a
 * button that looks re-enablable invites exactly that. Deleting it costs the
 * would-be tamperer nothing they could not do with curl anyway, but it stops
 * the page implying a rule it does not itself enforce.
 */

const API = `${getEnvironment()}/attendancemodule/my-photos`;

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function api(path = '', { method = 'GET', body } = {}) {
  const options = { method, credentials: 'include', headers: { ...authHeaders() } };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Request failed');
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

/**
 * Photos are fetched rather than pointed at.
 *
 * An <img src> cannot set an Authorization header, so it can only authenticate
 * with the session cookie — which is SameSite=None and therefore dropped in
 * private windows and wherever third-party cookies are blocked, exactly the
 * places a student is most likely to check something personal from. The usual
 * escape hatch, a ?token= query parameter, is deliberately refused by
 * readAuthToken because it puts a whole session into every access log.
 *
 * Fetching to a blob URL sidesteps both: the request carries the header like
 * every other call on the page, and the URL the browser renders is local to the
 * document. A student folder holds twenty photos at the very most, so the cost
 * is a handful of small requests.
 */
function useAuthedImage(kind, filename) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!filename) return undefined;
    let objectUrl = null;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API}/image/${kind}/${encodeURIComponent(filename)}`, {
          credentials: 'include',
          headers: authHeaders(),
        });
        if (!response.ok) throw new Error('image failed');
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (_) {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      // Without the revoke the blob stays resident for the life of the tab, and
      // this component remounts on every save.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, filename]);

  return { src, failed };
}

function PhotoCard({ kind = 'gt', photo, accent, actionLabel, actionHint, onAction, disabled }) {
  const { src, failed } = useAuthedImage(kind, photo.filename);

  return (
    <Box
      borderWidth="1px"
      borderColor={`${accent}.200`}
      borderRadius="lg"
      overflow="hidden"
      bg="lmBg.surface"
    >
      <Box position="relative" bg="lmBg.sunken" sx={{ aspectRatio: '1' }}>
        {src ? (
          <Image src={src} alt="" objectFit="cover" width="100%" height="100%" />
        ) : failed ? (
          <Flex align="center" justify="center" height="100%" fontSize="xs" color="lmFg.faint">
            Unavailable
          </Flex>
        ) : (
          <Skeleton height="100%" />
        )}
        {typeof photo.score === 'number' && (
          <Tooltip label="Recognition quality of this photo, scored by the attendance system.">
            <Badge
              position="absolute"
              top={1}
              right={1}
              fontSize="10px"
              colorScheme={photo.score >= 0.7 ? 'green' : photo.score >= 0.45 ? 'yellow' : 'red'}
            >
              {photo.score.toFixed(2)}
            </Badge>
          </Tooltip>
        )}
      </Box>
      {onAction && (
        <Tooltip label={disabled ? actionHint : ''} isDisabled={!disabled}>
          <Box p={2}>
            <Button
              size="xs"
              width="100%"
              variant="outline"
              colorScheme={accent}
              isDisabled={disabled}
              onClick={() => onAction(photo)}
            >
              {actionLabel}
            </Button>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

/**
 * What actually makes a ground-truth set work, said before the student starts
 * clicking rather than after they have picked five frames of the same moment.
 *
 * The point students get wrong is variety. Recognition matches a live face
 * against the mean of these photos, so five near-identical frames describe one
 * angle very precisely and every other angle not at all — which is why a set of
 * five lookalikes recognises worse than three genuinely different poses.
 */
function PoseGuide() {
  return (
    <SectionCard
      title="Choosing your ground truth images"
      subtitle="You move photos between two groups. Which ones end up in the embedding decides how reliably the cameras recognise you."
    >
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3} mb={4}>
        <Box borderWidth="1px" borderColor="green.200" borderRadius="md" p={3}>
          <Text fontWeight="600" fontSize="sm" mb={1}>
            <Badge colorScheme="green" mr={2}>Embedding</Badge>
            used for recognition
          </Text>
          <Text fontSize="sm" color="lmFg.muted">
            The photos the face recognition actually matches against when it marks a class. These
            are the only ones that affect your attendance.
          </Text>
        </Box>
        <Box borderWidth="1px" borderColor="blue.200" borderRadius="md" p={3}>
          <Text fontWeight="600" fontSize="sm" mb={1}>
            <Badge colorScheme="blue" mr={2}>Backup</Badge>
            collected daily
          </Text>
          <Text fontSize="sm" color="lmFg.muted">
            Topped up automatically — each time the cameras recognise you in class, that frame is
            kept here. Nothing in backup is used for recognition until you move it across.
          </Text>
        </Box>
      </SimpleGrid>

      <UnorderedList spacing={2} fontSize="sm" color="lmFg.muted" pl={1}>
        <ListItem>
          <Text as="span" fontWeight="600" color="lmFg.body">Pick different poses.</Text>{' '}
          Straight on, turned slightly left, slightly right, chin a little up, a little down. The
          set should look like several different moments, not one moment photographed five times.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="600" color="lmFg.body">Near-identical photos are wasted slots.</Text>{' '}
          Two frames from the same second add nothing the first one did not already say — and they
          take the place of an angle the cameras will actually see you from.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="600" color="lmFg.body">Face clear and evenly lit.</Text>{' '}
          Avoid heavy shadow, strong backlight, motion blur, and anything covering your face. A
          mask, a hand or hair across the eyes makes a photo worse than useless.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="600" color="lmFg.body">Prefer recent photos.</Text>{' '}
          If how you usually look has changed — glasses, a beard, a different hairstyle — the
          newer frames describe the face the cameras will meet on Monday.
        </ListItem>
        <ListItem>
          <Text as="span" fontWeight="600" color="lmFg.body">Use the score as a tie-breaker, not a rule.</Text>{' '}
          The number on each photo is the system&apos;s own quality read. Between two similar
          photos take the higher one — but a varied set of good photos beats five high-scoring
          photos of the same angle.
        </ListItem>
      </UnorderedList>
    </SectionCard>
  );
}

/**
 * How often this may be changed, in the three states the server can be in.
 *
 * Said up front rather than only as a rejected save: a student who picks a new
 * set, presses Save and is refused has wasted the effort, and the reason ("you
 * changed it four days ago") is not something they can be expected to guess.
 */
function UpdateWindowNotice({
  open, canUpdate, cooldownUntil, cooldownDays = 7, lastPhotoUpdateAt, selfServiceEnabled = true,
}) {
  // An institute-wide switch, not this student's turn coming round: there is
  // no date to wait for and nothing they can do about it, so it is said
  // plainly and the once-a-week wording is left out entirely.
  if (!selfServiceEnabled && !open) {
    return (
      <Alert status="info" borderRadius="md" fontSize="sm" alignItems="start">
        <AlertIcon />
        <Box>
          <Text fontWeight="600">Choosing your own photos is turned off.</Text>
          <Text color="lmFg.muted">
            Your institute has switched off changing your own attendance photos. They are below to
            look at. If yours are wrong, your department admin can fix them or let you do it.
          </Text>
        </Box>
      </Alert>
    );
  }

  if (open) {
    return (
      <Alert status="success" borderRadius="md" fontSize="sm" alignItems="start">
        <AlertIcon />
        <Box>
          <Text fontWeight="600">An update window is open for you — good for one change.</Text>
          <Text color="lmFg.muted">
            Your department admin has waived the usual wait. The window closes the moment you
            save, so pick the set you actually want before you do: after that the once-a-week rule
            applies again.
          </Text>
        </Box>
      </Alert>
    );
  }

  if (!canUpdate && cooldownUntil) {
    return (
      <Alert status="warning" borderRadius="md" fontSize="sm" alignItems="start">
        <AlertIcon />
        <Box>
          <Text fontWeight="600">
            Locked until {formatDate(cooldownUntil)} ({relativeTime(cooldownUntil)}).
          </Text>
          <Text color="lmFg.muted">
            Ground truth images can be updated once every {cooldownDays} days
            {lastPhotoUpdateAt ? `, and you last changed yours ${relativeTime(lastPhotoUpdateAt)}` : ''}.
            Your photos are below to look at, but the set is fixed until then. Contact your
            department admin if you need to update it before that.
          </Text>
        </Box>
      </Alert>
    );
  }

  return (
    <Alert status="info" borderRadius="md" fontSize="sm" alignItems="start">
      <AlertIcon />
      <Box>
        <Text fontWeight="600">You can update this once every {cooldownDays} days.</Text>
        <Text color="lmFg.muted">
          After you save, the next change is available a week later. Take the time to pick the set
          properly — if you need to change it before then, that has to go through your department
          admin.
        </Text>
      </Box>
    </Alert>
  );
}

export default function MyGroundTruthPhotos() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [active, setActive] = useState([]);
  const [reserve, setReserve] = useState([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const initial = useRef({ active: [], reserve: [] });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await api();
      setActive(data.embedding || []);
      setReserve(data.backup || []);
      initial.current = {
        active: (data.embedding || []).map((p) => p.filename),
        reserve: (data.backup || []).map((p) => p.filename),
      };
      setState({ loading: false, error: null, data });
    } catch (err) {
      setState({ loading: false, error: err, data: null });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const limits = state.data?.limits || { minEmbedding: 3, maxEmbedding: 5 };

  const dirty = useMemo(() => {
    const now = active.map((p) => p.filename).join('|');
    return now !== initial.current.active.join('|');
  }, [active]);

  const promote = (photo) => {
    setReserve((prev) => prev.filter((p) => p.filename !== photo.filename));
    setActive((prev) => [...prev, photo]);
  };

  const demote = (photo) => {
    setActive((prev) => prev.filter((p) => p.filename !== photo.filename));
    setReserve((prev) => [photo, ...prev]);
  };

  const reset = () => {
    const all = [...active, ...reserve];
    const byName = new Map(all.map((p) => [p.filename, p]));
    setActive(initial.current.active.map((name) => byName.get(name)).filter(Boolean));
    setReserve(initial.current.reserve.map((name) => byName.get(name)).filter(Boolean));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api('/order', {
        method: 'POST',
        body: {
          embeddingFiles: active.map((p) => p.filename),
          backupFiles: reserve.map((p) => p.filename),
        },
      });
      toast({
        status: 'success',
        title: 'Photos updated',
        description: result.message,
        duration: 6000,
      });
      await load();
    } catch (err) {
      toast({
        status: err.code === 'TOO_SOON' ? 'info' : 'error',
        title: err.code === 'TOO_SOON' ? 'Not yet — this changes once a week' : 'Could not save',
        description: err.message,
        duration: 8000,
      });
      // A refusal on the weekly rule means this page thought the window was
      // open and it is not — reload so the banner and the button agree with
      // the server rather than inviting the same rejected save again.
      if (err.code === 'TOO_SOON') await load();
      // A rejected save means this page is describing photos that have since
      // changed, so reload rather than leave the student editing a stale list.
      if (err.code === 'PHOTO_SET_CHANGED') await load();
    } finally {
      setSaving(false);
    }
  };

  if (state.loading && !state.data) return <Loading label="Loading your photos…" />;

  if (state.error) {
    if (state.error.code === 'NOT_ON_ERP_ROSTER') {
      return (
        <EmptyState
          icon="attendance-card"
          title="We could not match your account to the student list"
          description={state.error.message}
        />
      );
    }
    return <ErrorState error={state.error} onRetry={load} />;
  }

  const data = state.data || {};
  const canPromote = active.length < limits.maxEmbedding;
  const canDemote = active.length > limits.minEmbedding;
  // Absent on an older server: default to allowed rather than to locked, so a
  // version skew disables nothing the server would in fact have accepted.
  const canUpdate = data.canUpdate !== false;

  return (
    <VStack align="stretch" spacing={5}>
      <SectionCard
        title="Refrence photo"
        subtitle="Shown for reference — it is not changed from here."
      >
        <HStack align="start" spacing={5} flexWrap="wrap">
          <Box width="140px" flexShrink={0}>
            {data.erpPhoto ? (
              <PhotoCard kind="erp" photo={{ filename: data.erpPhoto.filename }} accent="gray" />
            ) : (
              <Flex
                height="140px"
                align="center"
                justify="center"
                borderWidth="1px"
                borderStyle="dashed"
                borderRadius="lg"
                fontSize="xs"
                color="lmFg.faint"
                textAlign="center"
                p={2}
              >
                No reference photo on file
              </Flex>
            )}
          </Box>
          <VStack align="start" spacing={1} fontSize="sm">
            <Text fontWeight="600" fontSize="md">{data.name || '—'}</Text>
            <Text color="lmFg.muted">Roll {data.rollNo}</Text>
            {data.branch && <Text color="lmFg.muted">{data.branch}</Text>}
            {data.lastPhotoUpdateAt && (
              <Text color="lmFg.faint" fontSize="xs">
                You last changed your photos {relativeTime(data.lastPhotoUpdateAt)}
              </Text>
            )}
          </VStack>
        </HStack>
      </SectionCard>

      {!data.hasGroundTruth ? (
        <EmptyState
          icon="camera"
          title="No attendance photos yet"
          description="Your class has not been photographed for the attendance system yet. Once it has, your photos will appear here and you will be able to choose which are used."
        />
      ) : (
        <>
          {data.rebuild?.pending > 0 && (
            <Alert status="info" borderRadius="md" fontSize="sm">
              <AlertIcon />
              A change you made is queued — attendance will start using your new selection shortly.
            </Alert>
          )}

          <UpdateWindowNotice
            open={Boolean(data.open)}
            canUpdate={canUpdate}
            selfServiceEnabled={data.selfServiceEnabled !== false}
            cooldownUntil={data.cooldownUntil}
            cooldownDays={data.cooldownDays || 7}
            lastPhotoUpdateAt={data.lastPhotoUpdateAt}
          />

          {/* The one problem on this tab a student must NOT try to fix here.
              Moving a stranger's photo to backup leaves it in their folder, so
              the active-learning loop can put it back and the batch rebuild
              still reads it; only staff can take it out of the folder. Said as
              a warning rather than buried in the guide because a student who
              spots it will otherwise reach for the buttons in front of them. */}
          <Alert status="warning" borderRadius="md" fontSize="sm" alignItems="start">
            <AlertIcon />
            <Box>
              <Text fontWeight="600">Is one of these photos not you?</Text>
              <Text color="lmFg.muted">
                Do not move it to backup and leave it at that — it stays in your folder either way,
                and while it is there the cameras can mark the wrong person present. Contact your
                department coordinator at iLEED and ask them to remove it; they are the only ones
                who can.
              </Text>
            </Box>
          </Alert>

          <PoseGuide />

          <SectionCard
            title="Embedding — in use for recognition"
            subtitle={`These ${limits.minEmbedding}–${limits.maxEmbedding} photos are the ones the face recognition actually matches you against in class. Aim for clear photos in different poses — near-identical frames spend a slot without adding anything.`}
            action={(
              <Badge colorScheme={active.length >= limits.minEmbedding ? 'green' : 'red'}>
                {active.length} of {limits.maxEmbedding}
              </Badge>
            )}
          >
            <SimpleGrid columns={{ base: 3, sm: 4, md: 5 }} spacing={3}>
              {active.map((photo) => (
                <PhotoCard
                  key={photo.filename}
                  photo={photo}
                  accent="green"
                  actionLabel="Move to backup"
                  actionHint={`Keep at least ${limits.minEmbedding} photos in the embedding.`}
                  onAction={canUpdate ? demote : undefined}
                  disabled={!canDemote}
                />
              ))}
            </SimpleGrid>
          </SectionCard>

          <SectionCard
            title="Backup photos"
            subtitle={canUpdate
              ? 'Collected automatically and topped up daily — every time the cameras recognise you in class, that frame is kept here. None of them is used for recognition until you move it into the embedding.'
              : 'Collected automatically and topped up daily — every time the cameras recognise you in class, that frame is kept here. None of them is used for recognition until you move it into the embedding.'}
            action={<Badge colorScheme="blue">{reserve.length}</Badge>}
          >
            {reserve.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                No backup photos yet. The system adds one here each time the cameras recognise you in class, so this fills up on its own over the first few weeks.
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 3, sm: 4, md: 5 }} spacing={3}>
                {reserve.map((photo) => (
                  <PhotoCard
                    key={photo.filename}
                    photo={photo}
                    accent="blue"
                    actionLabel="Move to embedding"
                    actionHint={`Move one of the ${limits.maxEmbedding} in the embedding to backup first.`}
                    onAction={canUpdate ? promote : undefined}
                    disabled={!canPromote}
                  />
                ))}
              </SimpleGrid>
            )}
          </SectionCard>

          <Flex
            justify="space-between"
            align="center"
            gap={3}
            flexWrap="wrap"
            position="sticky"
            bottom={0}
            bg="lmBg.surface"
            borderWidth="1px"
            borderRadius="md"
            p={3}
          >
            <Text fontSize="xs" color="lmFg.muted" flex="1" minW="220px">
              {!canUpdate
                ? (data.selfServiceEnabled === false
                  ? 'Read-only — your institute has turned off changing your own photos. Contact your department admin if yours need updating.'
                  : `Read-only until ${formatDate(data.cooldownUntil)}. Contact your department admin if you need to update it sooner.`)
                : dirty
                  ? 'Unsaved changes. Nothing is applied until you save.'
                  : 'Photos are never deleted here — moving one to backup keeps it.'}
            </Text>
            {/* Rendered, not merely disabled, only while a save would be
                accepted. A disabled button is a button a devtools console can
                re-enable, and leaving one there invites the attempt; the server
                refuses it either way (updateMyPhotoOrder re-checks the window
                on every request), so this is about not misleading anyone. */}
            {canUpdate && (
              <HStack>
                <Button size="sm" variant="ghost" onClick={reset} isDisabled={!dirty || saving}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  colorScheme="blue"
                  onClick={save}
                  isLoading={saving}
                  isDisabled={!dirty || active.length < limits.minEmbedding}
                >
                  Save changes
                </Button>
              </HStack>
            )}
          </Flex>
        </>
      )}
    </VStack>
  );
}
