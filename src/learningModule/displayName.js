/**
 * Telling a person's name from their email address.
 *
 * Mirrors server/src/modules/learningModule/services/displayName.js, which
 * stays the authority — this only decides what the UI says before a round trip,
 * and which accounts are offered the "Edit your name" prompt.
 *
 * Every account is created with its email address sitting in the name field,
 * because at that moment nobody knows anything else about the person. An
 * email-shaped name therefore means *no name given yet*, not a name.
 */
const EMAIL_SHAPED = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const looksLikeEmail = (value) => EMAIL_SHAPED.test(String(value || '').trim());

/** What the form should say when someone offers their address as their name. */
export const EMAIL_AS_NAME_MESSAGE =
  'That is your email address, not your name. Enter your full name as it should appear on results.';
