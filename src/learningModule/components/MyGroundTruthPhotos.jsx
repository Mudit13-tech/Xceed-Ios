import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
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
import { EmptyState, ErrorState, Loading, SectionCard, SectionCardSkeleton } from './common';
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
 * So: swap between the two groups. The save itself does nothing else — there is
 * no delete and no upload in it, and not because the buttons are missing: the
 * server accepts a save only when the two lists it receives are a rearrangement
 * of exactly the photos already on disk.
 *
 * One photo a student CAN throw away is a bad crop in the backup set — a
 * half-face, a blur, the person sitting behind them — because backups are
 * collected automatically by the cameras and nobody else is going to look
 * through thousands of them. That is a separate request to a separate endpoint
 * (POST /attendancemodule/photo-cleanup/:rollNo), capped at two a week, and it
 * refuses anything that is in the embedding or that would leave the embedding
 * under its floor. Nothing on this page can delete a photo recognition is
 * currently using.
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
// Removing a bad backup crop is not part of the photo tab's own API surface:
// different endpoint, different rules, different allowance. Addressed by roll
// number, which the server checks against the roster row for the signed-in
// account before it does anything — the roll number in the URL is not what
// authorises the call, it is what the call must agree with.
const CLEANUP_API = `${getEnvironment()}/attendancemodule/photo-cleanup`;

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
 * The one call from this page that removes a file.
 *
 * Kept out of `api()` above rather than given a path argument, because it is
 * not the same API: it answers to different rules, a different allowance and a
 * different endpoint, and a helper that could reach both would make "which
 * requests can delete something" a question about an argument rather than about
 * a function name.
 */
async function removeBackupPhoto(rollNo, filename) {
  const response = await fetch(`${CLEANUP_API}/${encodeURIComponent(rollNo)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'Could not remove that photo.');
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

function PhotoCard({
  kind = 'gt', photo, accent, actionLabel, actionHint, onAction, disabled,
  // The second, destructive action. Passed only for a photo the SERVER
  // currently holds in backup, and only while a removal would actually be
  // accepted — a photo moved into the embedding on this page but not yet saved
  // is still an embedding photo everywhere else, and offering a button the
  // server would refuse is worse than offering none.
  onRemove, removeLabel = 'Remove',
}) {
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
      {(onAction || onRemove) && (
        <VStack p={2} spacing={1} align="stretch">
          {onAction && (
            <Tooltip label={disabled ? actionHint : ''} isDisabled={!disabled}>
              <Box>
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
          {onRemove && (
            <Button
              size="xs"
              width="100%"
              variant="ghost"
              colorScheme="red"
              onClick={() => onRemove(photo)}
            >
              {removeLabel}
            </Button>
          )}
        </VStack>
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
  // The backup photo whose removal is waiting on a confirmation, and whether
  // that removal is in flight. Confirmed rather than done on the click: it is
  // the only irreversible thing on the page, and the allowance behind it is two
  // a week.
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [removing, setRemoving] = useState(false);
  const cancelRemoveRef = useRef(null);
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

  /**
   * Removing a bad backup crop.
   *
   * Local state rather than a reload afterwards: a student may have rearranged
   * the two lists and not saved yet, and re-fetching would silently throw that
   * away as the price of deleting one blurred frame. The server's own answer
   * carries the new allowance, which is what the notice re-renders from.
   */
  const confirmRemoval = async () => {
    const photo = pendingRemoval;
    if (!photo) return;
    setRemoving(true);
    try {
      const result = await removeBackupPhoto(state.data?.rollNo, photo.filename);
      setReserve((prev) => prev.filter((p) => p.filename !== photo.filename));
      // Also out of the baseline, so Reset does not try to put back a photo
      // that no longer exists.
      initial.current = {
        ...initial.current,
        reserve: initial.current.reserve.filter((name) => name !== photo.filename),
      };
      setState((prev) => (prev.data ? {
        ...prev,
        data: {
          ...prev.data,
          backup: (prev.data.backup || []).filter((p) => p.filename !== photo.filename),
          cleanup: result.cleanup || prev.data.cleanup,
        },
      } : prev));
      setPendingRemoval(null);
      toast({
        status: 'success',
        title: 'Photo removed',
        description: result.cleanup?.remaining === 0
          ? 'That was your last removal for this week.'
          : `You can remove ${result.cleanup?.remaining} more this week.`,
        duration: 6000,
      });
    } catch (err) {
      toast({
        status: err.code === 'REMOVAL_LIMIT' ? 'info' : 'error',
        title: err.code === 'REMOVAL_LIMIT' ? 'That is all for this week' : 'Could not remove that photo',
        description: err.message,
        duration: 8000,
      });
      setPendingRemoval(null);
      // The page is describing photos that have since changed — an admin
      // deleted one, or the set moved under it. Reload rather than leave the
      // student clicking at names that are gone.
      if (err.code === 'PHOTO_NOT_FOUND' || err.code === 'PHOTO_IN_USE') await load();
    } finally {
      setRemoving(false);
    }
  };

  if (state.loading && !state.data) return <Loading label="Loading your photos…" skeleton={<SectionCardSkeleton lines={4} />} />;

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

  // The removal allowance. Absent on an older server means the endpoint is not
  // there either, so this one defaults the other way — to no buttons at all
  // rather than to buttons that would 404.
  const cleanup = data.cleanup || null;
  const canRemove = Boolean(cleanup?.enabled) && (cleanup?.remaining ?? 0) > 0;
  // Only a photo the server itself holds in backup may be removed. A photo
  // moved across on this page but not yet saved is still an embedding photo to
  // the server, which would refuse it — see PhotoCard's onRemove. Computed
  // plainly rather than memoised: this sits after the early returns above, and
  // a hook here would be a hook that does not run on every render.
  const serverBackup = new Set((data.backup || []).map((p) => p.filename));
  // The embedding floor, from the removal side: while the set in use is thin,
  // the reserve is what refills it, and the server refuses to spend it. Read
  // off the server's own lists, not the pending arrangement on this page —
  // unsaved moves have not reached the folder the server will look at.
  const embeddingThin = (data.embedding || []).length < limits.minEmbedding;
  // Whether a Remove would be accepted right now. One name for the three
  // conditions, so the notice and the buttons cannot describe different rules.
  const removalOpen = canRemove && !embeddingThin;

  return (
    <VStack align="stretch" spacing={5}>
      <SectionCard
        title="Reference photo"
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
              {/* Subject rebuilds either drain within the minute or wait for the
                  nightly pass, depending on an admin switch. Promising
                  "shortly" under the nightly setting is the one wording that
                  brings a student back asking why nothing happened. */}
              {data.rebuild?.nightly
                ? 'A change you made is queued — attendance starts using your new selection after tonight’s rebuild.'
                : 'A change you made is queued — attendance will start using your new selection shortly.'}
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

          {/* Moving a photo of somebody else to backup does not get rid of it —
              it stays in the folder either way, and while it is there the batch
              rebuild still reads it. What differs by group is who can take it
              out: a backup photo the student can remove themselves (two a
              week), an embedding photo only staff can. Said as a warning rather
              than buried in the guide because a student who spots a stranger in
              their folder will otherwise reach for the nearest button. */}
          <Alert status="warning" borderRadius="md" fontSize="sm" alignItems="start">
            <AlertIcon />
            <Box>
              <Text fontWeight="600">Is one of these photos not you?</Text>
              <Text color="lmFg.muted">
                Moving it to backup does not get rid of it — it stays in your folder, and while it
                is there the cameras can mark the wrong person present. If it is already in{' '}
                <Text as="span" fontWeight="600">Backup photos</Text> below, use Remove and it is
                gone for good. If it is one of the photos in use for recognition, contact your
                department coordinator at iLEED — they are the only ones who can take that one out.
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
            subtitle="Collected automatically and topped up daily — every time the cameras recognise you in class, that frame is kept here. None of them is used for recognition until you move it into the embedding."
            action={<Badge colorScheme="blue">{reserve.length}</Badge>}
          >
            {/* What Remove costs, said before the button is used rather than
                after. Two a week is not a number anyone guesses, and a student
                who has spent both needs the date, not a greyed-out button. */}
            {cleanup?.enabled && (
              <Alert
                status={removalOpen ? 'info' : 'warning'}
                borderRadius="md"
                fontSize="sm"
                mb={3}
                alignItems="start"
              >
                <AlertIcon />
                <Box>
                  {removalOpen && (
                    <>
                      <Text fontWeight="600">
                        Bad crop in here? You can remove {cleanup.remaining} more this week.
                      </Text>
                      <Text color="lmFg.muted">
                        The cameras keep whatever they caught, so some of these are blurred, half a
                        face, or somebody sitting behind you. Removing those is worth doing — this
                        is the pool a photo is promoted from when one of the photos in use gets
                        deleted. It cannot be undone, and it is {cleanup.allowance} a week.
                      </Text>
                    </>
                  )}
                  {!removalOpen && embeddingThin && (
                    <>
                      <Text fontWeight="600">
                        Removing backups is held until {limits.minEmbedding} photos are in use for
                        recognition.
                      </Text>
                      <Text color="lmFg.muted">
                        These are what refills the set the cameras match you against, so while that
                        set is thin they are the last thing to throw away. Move a good one across
                        first, or ask your department admin.
                      </Text>
                    </>
                  )}
                  {!removalOpen && !embeddingThin && (
                    <>
                      <Text fontWeight="600">
                        You have used both removals for this week
                        {cleanup.nextSlotAt ? ` — the next is on ${formatDate(cleanup.nextSlotAt)}` : ''}.
                      </Text>
                      <Text color="lmFg.muted">
                        Contact your department admin if more of these need to go before then.
                      </Text>
                    </>
                  )}
                </Box>
              </Alert>
            )}
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
                    // Offered only for photos the server itself has in backup,
                    // and only while a removal would be accepted — the notice
                    // above says why when it is not. Same reasoning as the Save
                    // button below: a disabled button is one devtools edit away
                    // from gone, and the page should not imply a rule it does
                    // not itself enforce.
                    onRemove={canRemove && !embeddingThin && serverBackup.has(photo.filename)
                      ? setPendingRemoval
                      : undefined}
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
                  : 'Moving a photo to backup keeps it — only Remove, on a backup photo, deletes one.'}
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

          {/* Confirmed, and confirmed with the photo in view: the filenames are
              camera timestamps, so a student picking between two blurred frames
              by name alone would be guessing. Nothing here is recoverable and
              the allowance is two a week. */}
          <AlertDialog
            isOpen={Boolean(pendingRemoval)}
            leastDestructiveRef={cancelRemoveRef}
            onClose={() => { if (!removing) setPendingRemoval(null); }}
            isCentered
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="600">
                  Remove this backup photo?
                </AlertDialogHeader>
                <AlertDialogBody>
                  <HStack align="start" spacing={4}>
                    <Box width="120px" flexShrink={0}>
                      {pendingRemoval && (
                        <PhotoCard photo={pendingRemoval} accent="red" />
                      )}
                    </Box>
                    <VStack align="start" spacing={2} fontSize="sm">
                      <Text>
                        It is deleted for good — it does not go anywhere you can get it back from.
                      </Text>
                      <Text color="lmFg.muted">
                        {cleanup?.remaining === 1
                          ? 'This is your last removal for this week.'
                          : `You can remove ${cleanup?.remaining ?? 0} this week, including this one.`}
                      </Text>
                    </VStack>
                  </HStack>
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button
                    ref={cancelRemoveRef}
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingRemoval(null)}
                    isDisabled={removing}
                  >
                    Keep it
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="red"
                    ml={3}
                    onClick={confirmRemoval}
                    isLoading={removing}
                  >
                    Remove
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>
        </>
      )}
    </VStack>
  );
}
