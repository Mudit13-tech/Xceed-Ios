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
  SimpleGrid,
  Skeleton,
  Text,
  Tooltip,
  VStack,
  useToast,
} from '@chakra-ui/react';

import getEnvironment from '../../getenvironment';
import { EmptyState, ErrorState, Loading, SectionCard } from './common';
import { relativeTime } from '../format';

/**
 * "Which photos does attendance know me by?" — and the one change a student is
 * allowed to make to the answer.
 *
 * Every student folder holds more photos than recognition uses: five feed the
 * embedding attendance actually matches against, and the rest sit in reserve,
 * topped up automatically by the active-learning loop each time the cameras
 * recognise them. Which five are in use was, until now, decided either by the
 * upload order or by an administrator mailing a one-time link. A student who
 * knew perfectly well that one of their five was a bad frame had no way to say
 * so.
 *
 * So: swap between the two groups, and nothing else. There is no delete and no
 * upload here, and not because the buttons are missing — the server accepts a
 * save only when the two lists it receives are a rearrangement of exactly the
 * photos already on disk.
 *
 * The ERP photo sits alongside for reference. It is not part of the swap: it is
 * the official record, read-only from here.
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
        title: err.code === 'TOO_SOON' ? 'Just a moment' : 'Could not save',
        description: err.message,
        duration: 7000,
      });
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
          icon="🪪"
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

  return (
    <VStack align="stretch" spacing={5}>
      <SectionCard
        title="Your ERP photo"
        subtitle="The official photo on your ERP record. Shown for reference — it is not changed from here."
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
                No ERP photo on file
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
          icon="📷"
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

          <SectionCard
            title="In use for attendance"
            subtitle={`These ${limits.minEmbedding}–${limits.maxEmbedding} photos are what the cameras match you against. Pick the clearest ones — a badly lit or side-on photo makes you harder to recognise.`}
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
                  actionLabel="Move to reserve"
                  actionHint={`Keep at least ${limits.minEmbedding} photos in use.`}
                  onAction={demote}
                  disabled={!canDemote}
                />
              ))}
            </SimpleGrid>
          </SectionCard>

          <SectionCard
            title="Reserve photos"
            subtitle="Photos the attendance system has collected of you but is not currently matching against. Move one up to swap it in."
            action={<Badge colorScheme="blue">{reserve.length}</Badge>}
          >
            {reserve.length === 0 ? (
              <Text fontSize="sm" color="lmFg.muted">
                Nothing in reserve yet. The system adds a photo here each time it recognises you in class.
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 3, sm: 4, md: 5 }} spacing={3}>
                {reserve.map((photo) => (
                  <PhotoCard
                    key={photo.filename}
                    photo={photo}
                    accent="blue"
                    actionLabel="Use for attendance"
                    actionHint={`Move one of the ${limits.maxEmbedding} in use to reserve first.`}
                    onAction={promote}
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
              {dirty
                ? 'Unsaved changes. Nothing is applied until you save.'
                : 'Photos are never deleted here — moving one to reserve keeps it.'}
            </Text>
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
          </Flex>
        </>
      )}
    </VStack>
  );
}
