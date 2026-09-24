/**
 * The reply thread on a bug report.
 *
 * Three pages show a report — the superadmin queue, the department queue and
 * the learning module's own page — and each of them showed a single
 * `adminNote`, which was the last thing an admin had said and nothing else. A
 * question, the answer to it and the follow-up read as though only the
 * follow-up had happened.
 *
 * Reports filed before the thread existed carry only that one note and the
 * time of the review that wrote it. They are read here as a thread of one
 * rather than backfilled in the database, because that is what they are.
 */
export const noteThread = (report) => {
  const entries = Array.isArray(report?.adminNotes) ? report.adminNotes : [];
  if (entries.length) return entries;

  if (report?.adminNote) {
    return [
      {
        body: report.adminNote,
        authorName: report.reviewedByName || '',
        status: '',
        at: report.reviewedAt || report.updated_at || null,
      },
    ];
  }
  return [];
};

/** "3 notes sent" — or nothing to say, when none have been. */
export const noteThreadLabel = (thread) =>
  thread.length === 1 ? '1 note sent to the reporter' : `${thread.length} notes sent to the reporter`;

/**
 * The line under a note: who wrote it, when, and the verdict it rode with.
 *
 * `formatWhen` is the page's own date formatter — each of the three has one,
 * and they do not agree on a format, which is a smaller problem than three
 * copies of this.
 */
export const noteByline = (entry, formatWhen, statusLabel = (value) => value) => {
  const parts = [entry.authorName || 'Administrator'];
  if (entry.at) parts.push(formatWhen(entry.at));
  if (entry.status) parts.push(`marked ${statusLabel(entry.status)}`);
  return parts.join(' · ');
};
