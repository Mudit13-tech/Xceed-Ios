function rollValue(value) {
  return String(value?.rollNo ?? value ?? '').trim();
}

function uniqueSortedRolls(values = []) {
  return [...new Set(values.map(rollValue).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet applications from interpreting imported text as a
  // formula while preserving the value that the coordinator sees.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function subjectName(file) {
  return file.displayName || file.subject || file.subjectName || file.filename || 'Unknown';
}

export function buildSemesterEmbeddingCsv(files = []) {
  const header = [
    'Subject',
    'Subject Roster Roll Nos',
    'Embedded Roll Nos',
    'Ground Truth Missing Roll Nos',
  ];

  const rows = files
    .map((file) => {
      const missingRolls = uniqueSortedRolls(file.missedRollNos);
      const missingSet = new Set(missingRolls);
      const embeddedRolls = uniqueSortedRolls(file.rollNos)
        .filter((rollNo) => !missingSet.has(rollNo));

      return [
        subjectName(file),
        uniqueSortedRolls(file.rosterRollNos).join('; '),
        embeddedRolls.join('; '),
        missingRolls.join('; '),
      ];
    })
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function buildMissingGroundTruthCsv(files = []) {
  const missingRolls = uniqueSortedRolls(
    files.flatMap((file) => file.missedRollNos || []),
  );

  return [
    csvCell('Ground Truth Missing Roll No'),
    ...missingRolls.map(csvCell),
  ].join('\r\n');
}

export function downloadCsv(csv, filename) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function csvFilenamePart(value, fallback) {
  const safe = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || fallback;
}
