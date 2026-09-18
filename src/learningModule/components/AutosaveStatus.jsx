import React from 'react';
import { Text } from '@chakra-ui/react';

/**
 * One line at the top of an editor answering one question: is my work safe?
 *
 * Paired with `useEditorAutosave`, which does the saving and reports the status
 * this renders. Kept to plain text on purpose — a spinner or a toast for
 * something that happens every half minute would pull an author's eye off the
 * question they are writing, which is the opposite of what a background save is
 * for.
 *
 * The states where the answer is *no* are the ones that earn their place. A
 * paused editor and a failing one both leave changes unsaved, and an author who
 * cannot tell them apart will either lose work or stop reading the line at all
 * — so each says which it is, and the failure says the work is still on screen.
 *
 * @param {object} props
 * @param {'idle'|'dirty'|'saving'|'saved'|'error'} props.status
 * @param {Date|null} props.lastSavedAt
 * @param {string} [props.pausedReason] why autosave is off, if it is — shown to
 *        the author verbatim after "Autosave off — ".
 */
export default function AutosaveStatus({ status, lastSavedAt, pausedReason }) {
  const clock = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  let message = null;
  if (status === 'saving') message = 'Saving…';
  else if (status === 'error') message = "Couldn't autosave — your changes are still here";
  else if (pausedReason) message = `Autosave off — ${pausedReason}`;
  else if (status === 'dirty') message = 'Unsaved changes';
  else if (clock) message = `Saved at ${clock}`;

  if (!message) return null;

  return (
    <Text
      role="status"
      aria-live="polite"
      fontSize="sm"
      color={status === 'error' ? 'orange.400' : 'lmFg.muted'}
    >
      {message}
    </Text>
  );
}
