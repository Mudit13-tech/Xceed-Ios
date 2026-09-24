import React, { useState } from 'react';
import { Button, useToast } from '@chakra-ui/react';

import lmApi from '../api/lmApi';
import downloadPaperPdf from '../paperPdf';

/**
 * "PDF" on a tutorial or assignment card — the paper and its answer key, as a
 * file a teacher can print, file or hand to a colleague.
 *
 * Teacher-only, and placed with Edit/Results/Preview rather than inside the
 * editor: it is a thing you do to a finished paper, not while writing one.
 *
 * The list already carries the whole document for a teacher, so the common path
 * builds straight from what is on screen. It still falls back to fetching when
 * the questions are not there — a list that is narrowed to a projection later
 * should make this slower, not silently produce an empty paper.
 */
export default function DownloadPaperButton({ classId, item, kind, subjectName = '', ...rest }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const download = async () => {
    setBusy(true);
    try {
      let full = item;
      if (!Array.isArray(full?.questions)) {
        full = kind === 'assignment'
          ? await lmApi.getAssignment(classId, item._id)
          : await lmApi.getTutorial(classId, item._id);
      }
      await downloadPaperPdf(full, { kind, subjectName });
    } catch (error) {
      toast({
        status: 'error',
        title: 'Could not build the PDF',
        description: error.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={download} isLoading={busy} {...rest}>
      PDF
    </Button>
  );
}
