import React, { useEffect, useRef, useState } from 'react';
import { Flex, IconButton, Input, Text, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { FiCheck, FiEdit2, FiX } from 'react-icons/fi';

/**
 * A name in a table, editable in place.
 *
 * Both leadership appointments — head of department and Dean (Academic) — are
 * made from an email address and nothing else. Neither form asks for a name,
 * deliberately: the person being appointed is not the person at the keyboard,
 * and an administrator making a round of appointments should not have to invent
 * a round of names. So an HOD's account is named for the post it holds
 * (`Head-CSE`) and a dean's carries the address until somebody says otherwise.
 *
 * This is the somebody-says-otherwise. It lives in the row rather than behind a
 * separate "edit user" screen, and it is there permanently rather than only
 * just after the appointment is made — the name is usually learned later than
 * the address, often much later, and a rename that requires finding another
 * screen is a rename that does not happen.
 *
 * The write belongs to the caller. Each panel already owns its own fetches and
 * its own reload, and this component knowing either would tie a table cell to
 * two different endpoints.
 *
 * @param {string} value        the current name, or a placeholder to replace
 * @param {string} label        what is being renamed, for the screen reader
 * @param {(name: string) => Promise<void>} onSave  resolves once it is written
 */
const EditableName = ({ value, label, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const subColor = useColorModeValue('gray.600', 'gray.400');

  // A reload that brings back a different name — somebody renamed it in another
  // tab, or the save landed — should be what the cell shows, but never while it
  // is being typed into.
  useEffect(() => {
    if (!editing) setDraft(value || '');
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const name = draft.trim();
    // Nothing typed, or nothing changed: closing is the honest answer, not a
    // request to the server that writes what is already there.
    if (!name || name === (value || '')) {
      setEditing(false);
      setDraft(value || '');
      return;
    }
    setSaving(true);
    try {
      await onSave(name);
      setEditing(false);
    } catch {
      // The caller raises the toast; the cell stays open on the typed name so
      // the correction is not lost to a failed request.
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value || '');
    setEditing(false);
  };

  if (!editing) {
    return (
      <Flex align="center" gap={1} minW="10rem">
        <Text noOfLines={1} color={value ? undefined : subColor}>
          {value || '—'}
        </Text>
        <Tooltip label={`Edit the name for ${label}`} openDelay={400}>
          <IconButton
            aria-label={`Edit the name for ${label}`}
            icon={<FiEdit2 />}
            size="xs"
            variant="ghost"
            onClick={() => setEditing(true)}
          />
        </Tooltip>
      </Flex>
    );
  }

  return (
    <Flex align="center" gap={1} minW="12rem">
      <Input
        ref={inputRef}
        size="sm"
        value={draft}
        maxLength={120}
        aria-label={`Name for ${label}`}
        placeholder="Full name"
        isDisabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          // Enter and Escape, because a one-field edit that can only be
          // finished with the mouse is slower than the screen it replaced.
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />
      <IconButton
        aria-label={`Save the name for ${label}`}
        icon={<FiCheck />}
        size="xs"
        colorScheme="green"
        variant="ghost"
        isLoading={saving}
        onClick={commit}
      />
      <IconButton
        aria-label={`Cancel renaming ${label}`}
        icon={<FiX />}
        size="xs"
        variant="ghost"
        isDisabled={saving}
        onClick={cancel}
      />
    </Flex>
  );
};

export default EditableName;
