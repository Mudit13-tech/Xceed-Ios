import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  IconButton,
  Text,
  Textarea,
  useToast,
} from '@chakra-ui/react';
import lmApi from '../api/lmApi';
import { relativeTime } from '../format';
import { LmIcon } from './Icon';

/**
 * Comment list + composer, reused for class comments on stream posts and
 * classwork, and for the private teacher ⇄ student thread on a submission.
 */
export default function CommentThread({
  classId,
  targetType,
  targetId,
  currentUserId,
  canModerate = false,
  placeholder = 'Add a class comment…',
  emptyLabel = 'No comments yet.',
  collapsedCount = 3,
  onCountChange,
}) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!targetId) return;
    try {
      setComments(await lmApi.listComments(classId, targetType, targetId));
    } catch (error) {
      // A failed comment fetch should not blank the post it belongs to.
      console.error('[Learning] comments', error);
    } finally {
      setLoading(false);
    }
  }, [classId, targetType, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  // The thread is the source of truth for how many comments there are, so the
  // badge that opened it follows the list rather than a stored counter that
  // can drift. Held in a ref so an inline callback does not re-fire the effect.
  const countCallback = useRef(onCountChange);
  countCallback.current = onCountChange;
  useEffect(() => {
    if (!loading) countCallback.current?.(comments.length);
  }, [comments.length, loading]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    try {
      const created = await lmApi.createComment(classId, targetType, targetId, body);
      setComments((prev) => [...prev, created]);
      setText('');
      setExpanded(true);
    } catch (error) {
      toast({ status: 'error', title: 'Could not post comment', description: error.message });
    } finally {
      setPosting(false);
    }
  };

  const remove = async (commentId) => {
    try {
      await lmApi.deleteComment(classId, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (error) {
      toast({ status: 'error', title: 'Could not delete comment', description: error.message });
    }
  };

  const visible = expanded ? comments : comments.slice(-collapsedCount);
  const hidden = comments.length - visible.length;

  return (
    <Box>
      {!loading && comments.length === 0 && (
        <Text fontSize="sm" color="lmFg.muted" mb={2}>
          {emptyLabel}
        </Text>
      )}

      {hidden > 0 && (
        <Button size="xs" variant="link" colorScheme="blue" mb={2} onClick={() => setExpanded(true)}>
          Show {hidden} earlier {hidden === 1 ? 'comment' : 'comments'}
        </Button>
      )}

      {visible.map((comment) => (
        <Flex key={comment._id} gap={3} mb={3} align="flex-start">
          <Avatar size="xs" name={comment.authorName} flexShrink={0} />
          <Box flex="1" minW={0}>
            <HStack spacing={2} align="baseline" wrap="wrap">
              <Text fontSize="sm" fontWeight="600" color="lmFg.heading" noOfLines={1} maxW="100%" wordBreak="break-all">
                {comment.authorName}
              </Text>
              <Text fontSize="xs" color="lmFg.muted" flexShrink={0}>
                {relativeTime(comment.created_at)}
              </Text>
            </HStack>
            <Text fontSize="sm" color="lmFg.body" whiteSpace="pre-wrap" wordBreak="break-word" overflowWrap="anywhere">
              {comment.text}
            </Text>
          </Box>
          {(canModerate || String(comment.authorId) === String(currentUserId)) && (
            <IconButton
              size="xs"
              variant="ghost"
              colorScheme="gray"
              aria-label="Delete comment"
              icon={<LmIcon name="close" size={13} />}
              onClick={() => remove(comment._id)}
              flexShrink={0}
            />
          )}
        </Flex>
      ))}

      <Flex gap={2} align="center" mt={2}>
        <Textarea
          size="sm"
          rows={1}
          resize="vertical"
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line — the convention
            // students already expect from chat apps.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button size="sm" colorScheme="blue" onClick={submit} isLoading={posting} isDisabled={!text.trim()} flexShrink={0}>
          Post
        </Button>
      </Flex>
    </Box>
  );
}
