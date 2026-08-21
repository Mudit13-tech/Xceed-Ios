/**
 * What a student is told when a save fails.
 *
 * A message the server *chose* is worth reading: "Going back is not allowed in
 * this quiz", "This attempt is already finished" — each says what to do next.
 * An unhandled 500 is not. Its text is whatever threw somewhere inside the
 * request, and a student sitting an exam once had to read Mongoose's own words
 * about it — "No matching document found for id … version 19 modifiedPaths
 * …" — printed across the top of their paper, which is frightening and tells
 * them nothing they can act on.
 *
 * Split on the status rather than by matching the text, so this covers the next
 * internal error as well as that one.
 */
export const saveFailureMessage = (err) =>
  err?.status && err.status < 500
    ? err.message
    : "Couldn't save that just now — check your connection and try again. Your answer is still on screen.";
