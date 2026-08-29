import React, { useRef, useState } from 'react';
import { Box, Button, HStack, Link, Text, useToast } from '@chakra-ui/react';

import lmApi from '../api/lmApi';

/**
 * The student's attached working — photos or a PDF of what they did on paper.
 *
 * Only shown when the assignment allows it (`allowFileUpload`). Files go straight
 * onto the attempt through the 10 MB image/PDF uploader. Two ways in: pick from
 * files, or — the "Take a photo" input, with `capture` — open the camera
 * directly, which is what a phone does with it. `canEdit` is false once the
 * submission is closed to the student (deadline passed, or the teacher is
 * viewing) so the list shows but cannot be changed.
 */
const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * `uploadFn`/`removeFn` default to the assignment endpoints but are overridable,
 * so a tutorial attempt reuses this widget wholesale by passing its own two API
 * calls — the upload mechanics (10 MB cap, camera capture, the list) are
 * identical either side.
 */
export default function AssignmentUploads({
  classId,
  attemptId,
  uploads = [],
  canEdit = false,
  onChange,
  uploadFn = lmApi.addAssignmentUploads,
  removeFn = lmApi.removeAssignmentUpload,
}) {
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState('');
  const toast = useToast();

  const pick = () => inputRef.current?.click();
  const takePhoto = () => cameraRef.current?.click();

  const onFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // let the same file be chosen again after a remove
    if (!files.length) return;
    if (uploads.length + files.length > MAX_FILES) {
      toast({ status: 'warning', title: `You can attach at most ${MAX_FILES} files.`, duration: 5000 });
      return;
    }
    // Caught here for a clear message; the server enforces the same 10 MB cap.
    const tooBig = files.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      toast({
        status: 'warning',
        title: `"${tooBig.name}" is over 10 MB`,
        description: 'Each photo or PDF must be 10 MB or smaller.',
        duration: 6000,
      });
      return;
    }
    setBusy(true);
    try {
      const result = await uploadFn(classId, attemptId, files);
      onChange?.(result.uploads || []);
    } catch (err) {
      toast({ status: 'error', title: err.message || 'Could not upload the files', duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (url) => {
    setRemoving(url);
    try {
      const result = await removeFn(classId, attemptId, url);
      onChange?.(result.uploads || []);
    } catch (err) {
      toast({ status: 'error', title: err.message || 'Could not remove the file', duration: 6000 });
    } finally {
      setRemoving('');
    }
  };

  return (
    <Box borderWidth="1px" borderColor="lmBorder.base" borderRadius="md" p={3} mb={4}>
      <Text fontSize="sm" fontWeight="700" mb={1}>
        Your working {canEdit ? '' : '(read-only)'}
      </Text>
      <Text fontSize="xs" color="lmFg.muted" mb={2}>
        Attach photos or a PDF of your handwritten working. Images and PDFs, up to {MAX_FILES} files,
        10 MB each.
      </Text>

      {uploads.length > 0 && (
        <Box mb={2}>
          {uploads.map((file) => (
            <HStack key={file.url} justify="space-between" py={1} borderTopWidth="1px" borderColor="lmBorder.subtle">
              <Link href={lmApi.fileUrl(file.url)} isExternal fontSize="sm" color="lmHue.blue700" noOfLines={1}>
                {file.name || 'Attachment'}
              </Link>
              {canEdit && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  isLoading={removing === file.url}
                  onClick={() => remove(file.url)}
                >
                  Remove
                </Button>
              )}
            </HStack>
          ))}
        </Box>
      )}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={onFiles}
          />
          {/* `capture` asks the device for the camera directly — a phone opens the
              back camera; a laptop falls back to the file picker, so it is safe to
              always offer. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={onFiles}
          />
          <HStack>
            <Button size="sm" variant="outline" onClick={pick} isLoading={busy} loadingText="Uploading">
              Upload photos / PDF
            </Button>
            <Button size="sm" variant="outline" onClick={takePhoto} isDisabled={busy} leftIcon={<span aria-hidden="true">📷</span>}>
              Take a photo
            </Button>
          </HStack>
        </>
      )}
      {!canEdit && uploads.length === 0 && (
        <Text fontSize="sm" color="lmFg.subtle">
          No files were attached.
        </Text>
      )}
    </Box>
  );
}
