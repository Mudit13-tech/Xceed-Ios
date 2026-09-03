import getEnvironment from '../../getenvironment';
import { sync as syncServerClock } from '../serverClock';

// Every learning-module call goes through here so auth, error shape and the
// base URL are decided in exactly one place.
const BASE = () => `${getEnvironment()}/api/v1/learningmodule`;

class LmApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'LmApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * A guest's identity for one live Short — see the `requireLogin` setting. Kept
 * in sessionStorage rather than localStorage: it belongs to this tab and this
 * lecture, and should not outlive either. Private windows allow it, which is
 * rather the point when the whole feature exists for people without accounts.
 */
const GUEST_KEY = 'lmShortGuest';

export const shortGuest = {
  save: (sessionId, token) => {
    try {
      sessionStorage.setItem(GUEST_KEY, JSON.stringify({ sessionId: String(sessionId), token }));
    } catch {
      // A browser refusing storage is not a reason to fail the join; the
      // participant simply cannot survive a reload.
    }
  },
  token: () => {
    try {
      return JSON.parse(sessionStorage.getItem(GUEST_KEY) || 'null')?.token || null;
    } catch {
      return null;
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

/**
 * A guest's identity for one Forms link — the same pattern as `shortGuest`
 * above, for a respondent who opened a share link with no account. Its own
 * key and its own header, so a Forms guest and a Shorts guest in the same
 * browser tab (a student answering a poll, then filling in a form from a
 * different class's link) never collide.
 */
const FORM_GUEST_KEY = 'lmFormGuest';

export const formGuest = {
  save: (formId, token) => {
    try {
      sessionStorage.setItem(FORM_GUEST_KEY, JSON.stringify({ formId: String(formId), token }));
    } catch {
      // A browser refusing storage is not a reason to fail the join; the
      // respondent simply cannot survive a reload.
    }
  },
  token: () => {
    try {
      return JSON.parse(sessionStorage.getItem(FORM_GUEST_KEY) || 'null')?.token || null;
    } catch {
      return null;
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(FORM_GUEST_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

/**
 * The token naming this browser as the one sitting a given quiz attempt.
 *
 * Minted server-side when the attempt starts and echoed on every request that
 * drives the sitting, so the server can tell one student's two screens apart —
 * the phone reading the paper beside the laptop breaks no browser-side rule, and
 * this is the only angle from which it is visible at all.
 *
 * sessionStorage, so it belongs to this tab: a reload keeps it and carries on,
 * while a genuinely new browser has to earn the binding through the server's
 * rule (allowed only once the first has stopped checking in). Keyed by attempt
 * so two quizzes in two tabs do not overwrite each other.
 */
const QUIZ_SESSION_KEY = (attemptId) => `lmQuizSession:${attemptId}`;

/** Carries the token both ways; `SESSION_HEADER` in the server's quizController. */
const SESSION_HEADER = 'X-Quiz-Session';

export const quizSession = {
  save: (attemptId, token) => {
    if (!attemptId || !token) return;
    try {
      sessionStorage.setItem(QUIZ_SESSION_KEY(attemptId), token);
    } catch {
      // Without storage the sitting still works; it just cannot prove it is the
      // same browser after a reload, and rebinds once the old one goes quiet.
    }
  },
  token: (attemptId) => {
    try {
      return sessionStorage.getItem(QUIZ_SESSION_KEY(attemptId)) || null;
    } catch {
      return null;
    }
  },
  clear: (attemptId) => {
    try {
      sessionStorage.removeItem(QUIZ_SESSION_KEY(attemptId));
    } catch {
      /* nothing to clear */
    }
  },
};

/** `/classes/:classId/attempts/:attemptId/...` → the attempt id, or null. */
const attemptIdIn = (path) => path.match(/\/attempts\/([a-f\d]{24})(?:\/|$)/i)?.[1] || null;

async function request(path, { method = 'GET', body, raw = false, signal, keepalive = false } = {}) {
  const options = {
    method,
    credentials: 'include',
    headers: {},
    signal,
    // For a request that has to survive the page tearing down under it — the
    // tab closing, or navigating away — while it is still in flight. An
    // ordinary fetch is aborted the moment the document unloads; a keepalive
    // one is handed to the browser to finish on its own. Chrome caps the total
    // body of all in-flight keepalive requests at 64KB, which a quiz answer is
    // nowhere near.
    keepalive,
  };

  const token = localStorage.getItem('token');
  if (token) options.headers.Authorization = `Bearer ${token}`;

  // Sent alongside, not instead of: a signed-in user who also holds a guest
  // token is resolved by their account, and the server ignores the header.
  const guestToken = shortGuest.token();
  if (guestToken) options.headers['X-Short-Guest'] = guestToken;

  const formGuestToken = formGuest.token();
  if (formGuestToken) options.headers['X-Form-Guest'] = formGuestToken;

  // Attached by path rather than by each call site, so a sitting endpoint added
  // later cannot forget it and silently reopen the second-screen hole.
  const attemptId = attemptIdIn(path);
  const sessionToken = attemptId && quizSession.token(attemptId);
  if (sessionToken) options.headers[SESSION_HEADER] = sessionToken;

  if (body instanceof FormData) {
    // Let the browser set the multipart boundary.
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE()}${path}`, options);

  /* The binding, as the server currently sees it.
     `guardSitting` mints a fresh token whenever it rebinds a sitting whose old
     browser had gone quiet — a crash, a closed tab, a flat battery, or simply a
     paper reopened from its own URL in a tab that no longer has the token in
     sessionStorage. That token used to be echoed only by `startAttempt`, so a
     rebind through any other endpoint produced a token the browser could never
     present: the next request arrived tokenless against a binding that was now
     seconds old and therefore "live", and the student was locked out of their own
     paper with the second-screen 409. Taking it from the header here keeps this
     browser in step with whatever the server last decided, on every path that
     drives a sitting.

     A losing second screen is unaffected: the conflict path sends no header, so
     it cannot pick up the binding it was just refused. */
  const issuedSession = attemptId && response.headers.get(SESSION_HEADER);
  if (issuedSession) quizSession.save(attemptId, issuedSession);

  if (raw) {
    if (!response.ok) throw new LmApiError('Request failed', response.status, null);
    return response;
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    throw new LmApiError(payload?.message || `Request failed (${response.status})`, response.status, payload);
  }

  /* Learn the server's clock from anything that volunteers it.
     Done here rather than at each call site for the same reason the sitting token
     above is: a quiz deadline is only meaningful against the clock that produced
     it, and an endpoint added later would otherwise have to remember to sync — ten
     call sites being ten chances to miss one. See serverClock.js. */
  if (payload && typeof payload === 'object') syncServerClock(payload.serverTime);

  return payload;
}

const qs = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString();
  return search ? `?${search}` : '';
};

const lmApi = {
  LmApiError,
  fileUrl: (url) => (url?.startsWith('http') ? url : `${getEnvironment()}${url}`),

  /* account level */
  me: () => request('/me'),
  overview: () => request('/overview'),
  todo: () => request('/todo'),
  calendar: (params) => request(`/calendar${qs(params)}`),
  claimInvites: () => request('/claim-invites', { method: 'POST', body: {} }),

  /* The one-time name — plus a roll number, from a student — an account gives
     before the module opens. `myIdentity` is fetched only by that form; `me()`
     already carries the `needsIdentity` flag that decides whether to show it.
     `saveIdentity` refuses a second, different name; `correctIdentity` is the
     one exception — a single self-service edit of both fields, offered in the
     account menu while `me().canCorrectIdentity` holds and spent by using it. */
  myIdentity: () => request('/me/identity'),
  saveIdentity: (body) => request('/me/identity', { method: 'POST', body }),
  correctIdentity: (body) => request('/me/identity/correct', { method: 'POST', body }),

  notifications: (params) => request(`/notifications${qs(params)}`),
  markNotificationsRead: async (ids, options = {}) => {
    const res = await request('/notifications/read', { method: 'POST', body: { ids } });
    if (!options.silent) window.dispatchEvent(new Event('lmNotificationsUpdated'));
    return res;
  },
  clearReadNotifications: async () => {
    const res = await request('/notifications/read', { method: 'DELETE' });
    window.dispatchEvent(new Event('lmNotificationsUpdated'));
    return res;
  },
  deleteNotification: async (id) => {
    const res = await request(`/notifications/${id}`, { method: 'DELETE' });
    window.dispatchEvent(new Event('lmNotificationsUpdated'));
    return res;
  },

  /* the signed-in person's own weekly timetable */
  // Two calls, not four: `timetableOptions` answers "which timetable is mine and
  // what else can I pick", `timetableGrid` returns the week. The joining — from
  // enrolments to a department, to that department's current session, to the grid —
  // happens on the server, because doing it here is what made the student view
  // fetch nothing at all.
  timetableOptions: () => request('/timetable/options'),
  timetableGrid: (dept, sem) => request(`/timetable/grid${qs({ dept, sem })}`),

  /* timetable-sourced pickers (create class) */
  ttBranches: () => request('/timetable/branches'),
  ttSemesters: (code) => request(`/timetable/semesters${qs({ code })}`),
  ttSubjects: (code, sem) => request(`/timetable/subjects${qs({ code, sem })}`),

  /* classes */
  listClasses: (status) => request(`/classes${qs({ status })}`),
  createClass: (body) => request('/classes', { method: 'POST', body }),
  getClass: (classId) => request(`/classes/${classId}`),
  updateClass: (classId, body) => request(`/classes/${classId}`, { method: 'PATCH', body }),
  archiveClass: (classId, archive) => request(`/classes/${classId}/archive`, { method: 'POST', body: { archive } }),
  completeClass: (classId, complete) => request(`/classes/${classId}/complete`, { method: 'POST', body: { complete } }),
  regenerateCode: (classId) => request(`/classes/${classId}/code/regenerate`, { method: 'POST', body: {} }),
  deleteClass: (classId) => request(`/classes/${classId}`, { method: 'DELETE' }),
  joinByCode: (code) => request('/join', { method: 'POST', body: { code } }),
  previewCode: (code) => request(`/preview/${encodeURIComponent(code)}`),
  leaveClass: (classId) => request(`/classes/${classId}/leave`, { method: 'POST', body: {} }),

  /* topics */
  listTopics: (classId) => request(`/classes/${classId}/topics`),
  createTopic: (classId, name) => request(`/classes/${classId}/topics`, { method: 'POST', body: { name } }),
  updateTopic: (classId, topicId, body) => request(`/classes/${classId}/topics/${topicId}`, { method: 'PATCH', body }),
  deleteTopic: (classId, topicId) => request(`/classes/${classId}/topics/${topicId}`, { method: 'DELETE' }),

  /* people */
  listMembers: (classId) => request(`/classes/${classId}/members`),
  // Accounts are always provisioned for addresses without one, and the platform
  // role is always granted to people who already have an account without it —
  // both were once modal checkboxes and are now the only supported behaviour.
  inviteMembers: (classId, emails, role) =>
    request(`/classes/${classId}/members/invite`, {
      method: 'POST',
      body: {
        emails,
        role,
        createAccounts: true,
        grantRoleToExisting: true,
      },
    }),
  inviteStatus: (classId, batchId) => request(`/classes/${classId}/members/invite-status/${batchId}`),
  decideJoinRequest: (classId, membershipId, approve) =>
    request(`/classes/${classId}/members/${membershipId}/decide`, { method: 'POST', body: { approve } }),
  updateMember: (classId, membershipId, body) =>
    request(`/classes/${classId}/members/${membershipId}`, { method: 'PATCH', body }),
  removeMember: (classId, membershipId) =>
    request(`/classes/${classId}/members/${membershipId}`, { method: 'DELETE' }),
  memberProgress: (classId, membershipId) =>
    request(`/classes/${classId}/members/${membershipId}/progress`),
  emailMember: (classId, membershipId, { subject, body }) =>
    request(`/classes/${classId}/members/${membershipId}/email`, { method: 'POST', body: { subject, body } }),
  transferOwnership: (classId, membershipId) =>
    request(`/classes/${classId}/members/${membershipId}/transfer-ownership`, { method: 'POST', body: {} }),
  getMyPreferences: (classId) => request(`/classes/${classId}/my-preferences`),
  updateMyPreferences: (classId, body) => request(`/classes/${classId}/my-preferences`, { method: 'PATCH', body }),

  /* stream */
  getStream: (classId, params) => request(`/classes/${classId}/stream${qs(params)}`),
  searchClass: (classId, query) => request(`/classes/${classId}/search${qs({ q: query })}`),
  createAnnouncement: (classId, body) => request(`/classes/${classId}/announcements`, { method: 'POST', body }),
  updateAnnouncement: (classId, id, body) =>
    request(`/classes/${classId}/announcements/${id}`, { method: 'PATCH', body }),
  deleteAnnouncement: (classId, id) => request(`/classes/${classId}/announcements/${id}`, { method: 'DELETE' }),
  reactToAnnouncement: (classId, id, emoji) =>
    request(`/classes/${classId}/announcements/${id}/react`, { method: 'POST', body: { emoji } }),

  /* comments */
  listComments: (classId, targetType, targetId) =>
    request(`/classes/${classId}/comments/${targetType}/${targetId}`),
  createComment: (classId, targetType, targetId, text, parentId) =>
    request(`/classes/${classId}/comments/${targetType}/${targetId}`, {
      method: 'POST',
      body: { text, parentId },
    }),
  deleteComment: (classId, commentId) => request(`/classes/${classId}/comments/${commentId}`, { method: 'DELETE' }),

  /* anonymous feedback — the response shape depends on who is asking, see
     feedbackController.listFeedback: `view` is 'student' | 'teacher' | 'admin' */
  listFeedback: (classId) => request(`/classes/${classId}/feedback`),
  sendFeedback: (classId, body) => request(`/classes/${classId}/feedback`, { method: 'POST', body }),
  updateFeedback: (classId, feedbackId, body) =>
    request(`/classes/${classId}/feedback/${feedbackId}`, { method: 'PATCH', body }),
  deleteFeedback: (classId, feedbackId) =>
    request(`/classes/${classId}/feedback/${feedbackId}`, { method: 'DELETE' }),

  /* classwork */
  listCoursework: (classId, params) => request(`/classes/${classId}/coursework${qs(params)}`),
  createCoursework: (classId, body) => request(`/classes/${classId}/coursework`, { method: 'POST', body }),
  getCoursework: (classId, id) => request(`/classes/${classId}/coursework/${id}`),
  updateCoursework: (classId, id, body) => request(`/classes/${classId}/coursework/${id}`, { method: 'PATCH', body }),
  deleteCoursework: (classId, id) => request(`/classes/${classId}/coursework/${id}`, { method: 'DELETE' }),
  submissionGrid: (classId, id) => request(`/classes/${classId}/coursework/${id}/submissions`),

  /* submissions */
  saveDraft: (classId, courseworkId, body) =>
    request(`/classes/${classId}/coursework/${courseworkId}/draft`, { method: 'POST', body }),
  turnIn: (classId, courseworkId, body) =>
    request(`/classes/${classId}/coursework/${courseworkId}/turn-in`, { method: 'POST', body }),
  unsubmit: (classId, courseworkId) =>
    request(`/classes/${classId}/coursework/${courseworkId}/unsubmit`, { method: 'POST', body: {} }),
  gradeSubmission: (classId, submissionId, body) =>
    request(`/classes/${classId}/submissions/${submissionId}/grade`, { method: 'PATCH', body }),
  returnSubmissions: (classId, submissionIds) =>
    request(`/classes/${classId}/submissions/return`, { method: 'POST', body: { submissionIds } }),
  reclaimSubmission: (classId, submissionId) =>
    request(`/classes/${classId}/submissions/${submissionId}/reclaim`, { method: 'POST', body: {} }),

  /* grades */
  gradebook: (classId) => request(`/classes/${classId}/gradebook`),
  bulkGrade: (classId, grades) => request(`/classes/${classId}/gradebook/bulk`, { method: 'POST', body: { grades } }),
  gradebookCsvUrl: (classId) => `${BASE()}/classes/${classId}/gradebook.csv`,

  /* reusing questions from another class the same teacher staffs. `type` is one
     of quiz | short | tutorial | notebook, and never crosses: quiz questions go
     into a quiz, slides into a Short. */
  importSources: (classId, type) =>
    request(`/classes/${classId}/import/sources?type=${encodeURIComponent(type)}`),
  importItems: (classId, sourceClassId, type) =>
    request(`/classes/${classId}/import/sources/${sourceClassId}/items?type=${encodeURIComponent(type)}`),
  importParts: (classId, itemId, type) =>
    request(`/classes/${classId}/import/items/${itemId}/parts?type=${encodeURIComponent(type)}`),
  importTargets: (classId, type) =>
    request(`/classes/${classId}/import/targets?type=${encodeURIComponent(type)}`),
  importInto: (classId, body) => request(`/classes/${classId}/import`, { method: 'POST', body }),

  /* quizzes */
  listQuizzes: (classId) => request(`/classes/${classId}/quizzes`),
  createQuiz: (classId, body) => request(`/classes/${classId}/quizzes`, { method: 'POST', body }),
  getQuiz: (classId, quizId) => request(`/classes/${classId}/quizzes/${quizId}`),
  exportQuizQuestions: (classId, quizId, withAnswers = false) =>
    request(`/classes/${classId}/quizzes/${quizId}/export-questions${qs({ withAnswers })}`),
  updateQuiz: (classId, quizId, body) => request(`/classes/${classId}/quizzes/${quizId}`, { method: 'PATCH', body }),
  deleteQuiz: (classId, quizId) => request(`/classes/${classId}/quizzes/${quizId}`, { method: 'DELETE' }),
  publishQuiz: (classId, quizId, body) =>
    request(`/classes/${classId}/quizzes/${quizId}/publish`, { method: 'POST', body: body || {} }),
  quizResults: (classId, quizId) => request(`/classes/${classId}/quizzes/${quizId}/results`),

  /* An invigilator confirming they have physically looked at a flagged laptop.
     Clears the alert off the live panel without judging what they found — see
     quizController.clearVmFlag. */
  markVmChecked: (classId, attemptId) =>
    request(`/classes/${classId}/attempts/${attemptId}/vm-checked`, { method: 'POST', body: {} }),

  /* The webcam watch reporting what it saw — see quizController.recordWebcamCheck.
     Best-effort: the sitting must not stall on a failed report, so callers fire
     and forget. `image` is a small JPEG data URI, sent only on a flagged frame. */
  recordWebcamCheck: (classId, attemptId, body) =>
    request(`/classes/${classId}/attempts/${attemptId}/webcam`, { method: 'POST', body: body || {} }),

  /* One random snapshot from a sitting, as an object URL the caller must revoke.
     Fetched rather than linked because the route is staff-only and this module
     authenticates with a bearer token: an <img src> carries no header, so a
     plain link to it would come back 401. See quizController.serveWebcamSnapshot. */
  webcamSnapshot: async (classId, attemptId, file) => {
    const response = await request(
      `/classes/${classId}/attempts/${attemptId}/webcam-snapshots/${encodeURIComponent(file)}`,
      { raw: true },
    );
    return URL.createObjectURL(await response.blob());
  },

  /* An invigilator confirming they have looked at a webcam flag — the mirror of
     markVmChecked. Clears the flag off the live panel without judging it. */
  markWebcamChecked: (classId, attemptId) =>
    request(`/classes/${classId}/attempts/${attemptId}/webcam-checked`, { method: 'POST', body: {} }),

  /* Grant (or withdraw) a webcam waiver for one student, from Live control — the
     escape hatch for a camera that cannot be made to work. See
     quizController.setWebcamExemption. */
  setWebcamExemption: (classId, quizId, studentId, exempt) =>
    request(`/classes/${classId}/quizzes/${quizId}/webcam-exempt`, {
      method: 'POST',
      body: { studentId, exempt },
    }),

  /* Fire the invigilation pulse across every live screen at once — the same 30s
     bloom asked for out of turn from the live panel. It rides the heartbeat, so
     a sitting sees it within one beat and skips its next automatic ring. See
     quizController.triggerPulse. */
  pulseQuiz: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/pulse`, { method: 'POST', body: {} }),
  setQuizCollaborators: (classId, quizId, emails) =>
    request(`/classes/${classId}/quizzes/${quizId}/collaborators`, { method: 'POST', body: { emails } }),
  deleteQuizResponses: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/responses`, { method: 'DELETE' }),
  quizResultsCsvUrl: (classId, quizId) => `${BASE()}/classes/${classId}/quizzes/${quizId}/results.csv`,

  /* quiz sitting */
  quizBrief: (classId, quizId) => request(`/classes/${classId}/quizzes/${quizId}/brief`),
  /* Check the Safe Exam Browser access code on its own, without spending the
     sitting. The pre-test screen asks the two gates in order — right browser,
     then right room — so it needs to know the code is good before it draws the
     room-code pad. Throws the usual LmApiError on a wrong code; resolves with
     `{ ok: true, roomCodeRequired }` on a right one. Nothing is granted by it:
     `startAttempt` checks the code again from scratch. */
  verifyAccessCode: (classId, quizId, code) =>
    request(`/classes/${classId}/quizzes/${quizId}/verify-access-code`, {
      method: 'POST',
      // The same field name the start endpoint reads, because the shared rate
      // limiter counts guesses by that field.
      body: { sebBypassCode: code },
    }),
  /* Check the room code on its own, the moment it is complete. Same shape as
     `verifyAccessCode` and the same shared guess budget; resolves with
     `{ ok: true }`, throws LmApiError on a wrong code. Grants nothing —
     `startAttempt` checks the code again from scratch. */
  verifyRoomCode: (classId, quizId, code) =>
    request(`/classes/${classId}/quizzes/${quizId}/verify-room-code`, {
      method: 'POST',
      body: { roomCode: code },
    }),
  // The only call that mints a session token, so it is also the only one that
  // stores it. Everything else on the attempt picks it up from `request`.
  // `sebBypassCode` is only ever sent for a quiz that requires Safe Exam
  // Browser and could not be opened in it — see QuizBrief for where a student
  // enters one. `roomCode` is the invigilator's spoken code, sent when the quiz
  // requires one. Sending either on a quiz that does not use it is harmless: the
  // server only looks at each when its own setting is on.
  startAttempt: async (classId, quizId, { sebBypassCode, roomCode, cameraReady, cameraUnavailable } = {}) => {
    const body = {};
    if (sebBypassCode) body.sebBypassCode = sebBypassCode;
    if (roomCode) body.roomCode = roomCode;
    // Only ever true once the pre-test screen has the camera grant in hand; the
    // server refuses a required-camera start without it.
    if (cameraReady) body.cameraReady = true;
    // The other way past the webcam gate: a machine with no usable camera. The
    // server lets it start but flags the sitting; a plain refusal sends neither.
    if (cameraUnavailable) body.cameraUnavailable = cameraUnavailable;
    const result = await request(`/classes/${classId}/quizzes/${quizId}/attempts`, {
      method: 'POST',
      body,
    });
    quizSession.save(result?.attempt?._id, result?.sessionToken);
    return result;
  },
  getAttemptPaper: (classId, attemptId) => request(`/classes/${classId}/attempts/${attemptId}/paper`),
  getCurrentQuestion: (classId, attemptId) => request(`/classes/${classId}/attempts/${attemptId}/current`),
  // The question after this one, fetched while the student reads. Sealed unless
  // the paper already lets them walk forward and back; 403 when the quiz does
  // not allow prefetching at all, which the caller treats as "just don't".
  getNextQuestion: (classId, attemptId) => request(`/classes/${classId}/attempts/${attemptId}/next`),

  /* The institution's shared Safe Exam Browser setup. Module-level, not
     class-scoped: one file and one Config Key serve every exam. */
  getSharedSebConfig: () => request('/seb-config'),

  /* Whether the stored file and key actually work, asked from this browser.
     Only meaningful when the page is open inside Safe Exam Browser: the answer
     is built from the SEB headers on this very request, so run from Chrome it
     truthfully reports that there are none. An ordinary XHR on purpose — so is
     `startAttempt`, and this has to test the path an exam takes, not an easier
     one. */
  checkSharedSebConfig: () => request('/seb-config/check'),
  // `origin` is the address students will actually open. It is written into the
  // file as the Start URL, and SEB computes the Config Key over the settings —
  // so a sample built for the wrong host carries a key that is invalid for the
  // right one. Defaults server-side to wherever the request came from.
  sampleSebUrl: (origin) => `${BASE()}/seb-config/sample${origin ? `?origin=${encodeURIComponent(origin)}` : ''}`,
  setSharedSebConfig: (file, configKey) => {
    const body = new FormData();
    body.append('file', file);
    // Sent with the file rather than separately: a key that does not belong to
    // the file beside it fails every request hash, so they are only ever written
    // as a pair.
    body.append('configKey', configKey);
    return request('/seb-config', { method: 'POST', body });
  },

  /* Safe Exam Browser's own installer — separate from the settings-file setup
     above, and from any quiz: a plain convenience so a student gets the exact
     build this installation was tested against instead of whatever SEB's own
     site is currently serving. */
  getSebInstallers: () => request('/seb-installer'),
  sebInstallerDownloadUrl: (platform) => `${BASE()}/seb-installer/${platform}/download`,
  uploadSebInstaller: (platform, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(`/seb-installer/${platform}`, { method: 'POST', body });
  },
  answerAndAdvance: (classId, attemptId, body) =>
    request(`/classes/${classId}/attempts/${attemptId}/answer`, { method: 'POST', body }),
  saveAttemptDraft: (classId, attemptId, answers, { keepalive = false } = {}) =>
    request(`/classes/${classId}/attempts/${attemptId}/save`, {
      method: 'POST',
      body: { answers },
      keepalive,
    }),
  // `at` is when the event happened, which is not always when it is sent: a
  // report that failed offline is queued and replayed, and the server judges it
  // by this timestamp rather than by its arrival. Clamped server-side, so a
  // hand-written one buys nothing.
  // `detail` is a short note about the event — which key was pressed on a paper
  // under keyboard lockdown. The server caps and strips it before storing.
  recordViolation: (classId, attemptId, type, at, detail) =>
    request(`/classes/${classId}/attempts/${attemptId}/violation`, {
      method: 'POST',
      body: { type, ...(at ? { at } : {}), ...(detail ? { detail } : {}) },
    }),
  // Sent on a timer while a paper is open. Its absence is the signal — a client
  // that has had its reporting blocked stops sending these, and the server notes
  // the silence.
  // `env` is the machine fingerprint from `environmentProbe`, sent on the first
  // beat of a sitting and every few minutes after rather than on all of them —
  // it is the same answer each time, and this is the hottest request in an exam.
  // Omitted entirely when there is nothing new to say, so the body stays `{}`.
  heartbeat: (classId, attemptId, env) =>
    request(`/classes/${classId}/attempts/${attemptId}/heartbeat`, {
      method: 'POST',
      body: env ? { env } : {},
    }),
  submitAttempt: (classId, attemptId, answers, expired = false) =>
    request(`/classes/${classId}/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { answers, expired },
    }),
  getAttempt: (classId, attemptId) => request(`/classes/${classId}/attempts/${attemptId}`),

  /* staff putting one student's sitting right — see quizController.reopenAttempt.
     `mode` is 'continue' (keep their answers) or 'restart' (fresh paper). */
  reopenQuizAttempt: (classId, attemptId, body) =>
    request(`/classes/${classId}/attempts/${attemptId}/reopen`, { method: 'POST', body }),
  deleteQuizAttempt: (classId, attemptId) =>
    request(`/classes/${classId}/attempts/${attemptId}`, { method: 'DELETE' }),
  // Ends a sitting that is still running, by hand. The mirror of `reopen` — a
  // sitting stopped this way lands in the same shut-out list and is undone by
  // the same "Let in" button.
  terminateQuizAttempt: (classId, attemptId, reason) =>
    request(`/classes/${classId}/attempts/${attemptId}/terminate`, {
      method: 'POST',
      body: { reason },
    }),

  /* the hall register. `entries` is [{ studentId, status }] with status
     'present' | 'absent'; marking absent also ends that student's sitting and
     keeps them out of a fresh one until they are marked present again. */
  quizAttendance: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/attendance`),
  markQuizAttendance: (classId, quizId, entries) =>
    request(`/classes/${classId}/quizzes/${quizId}/attendance`, {
      method: 'POST',
      body: { entries },
    }),

  /* correcting the answer key of a paper the class has already sat.
     `questions` is [{ questionId, correctAnswers, marks, negativeMarks,
     tolerancePercent, toleranceAbs, explanation }] — only the fields sent are
     written, and the whole cohort is re-marked unless `regrade: false`. */
  updateAnswerKey: (classId, quizId, questions, regrade = true) =>
    request(`/classes/${classId}/quizzes/${quizId}/answer-key`, {
      method: 'PATCH',
      body: { questions, regrade },
    }),
  // Re-mark every finished sitting against the answer key as it stands now.
  regradeQuiz: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/regrade`, { method: 'POST', body: {} }),
  // Marks out now, whatever the schedule said, and every student who sat the
  // paper is notified.
  releaseQuizResults: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/release-results`, { method: 'POST', body: {} }),

  /* parameterised tutorials */
  listTutorials: (classId) => request(`/classes/${classId}/tutorials`),
  createTutorial: (classId, body) => request(`/classes/${classId}/tutorials`, { method: 'POST', body }),

  /* ---- building a tutorial from an uploaded question paper ---- */
  listTutorialImports: (classId) => request(`/classes/${classId}/tutorial-imports`),
  getTutorialImport: (classId, draftId) => request(`/classes/${classId}/tutorial-imports/${draftId}`),
  startTutorialImport: (classId, body) =>
    request(`/classes/${classId}/tutorial-imports`, { method: 'POST', body }),
  deleteTutorialImport: (classId, draftId) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}`, { method: 'DELETE' }),
  suggestImportVariables: (classId, draftId, questionId) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}/questions/${questionId}/suggest-variables`, {
      method: 'POST',
      body: {},
    }),
  updateImportQuestion: (classId, draftId, questionId, body) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}/questions/${questionId}`, {
      method: 'PATCH',
      body,
    }),
  deriveImportAnswers: (classId, draftId, questionId) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}/questions/${questionId}/derive`, {
      method: 'POST',
      body: {},
    }),
  previewTutorialImport: (classId, draftId, body) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}/preview`, {
      method: 'POST',
      body: body || {},
    }),
  mergeTutorialImport: (classId, draftId, body) =>
    request(`/classes/${classId}/tutorial-imports/${draftId}/merge`, { method: 'POST', body }),
  getTutorial: (classId, tutorialId) => request(`/classes/${classId}/tutorials/${tutorialId}`),
  updateTutorial: (classId, tutorialId, body) =>
    request(`/classes/${classId}/tutorials/${tutorialId}`, { method: 'PATCH', body }),
  deleteTutorial: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}`, { method: 'DELETE' }),
  previewTutorial: (classId, tutorialId, count) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/preview`, { method: 'POST', body: { count } }),
  publishTutorial: (classId, tutorialId, body) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/publish`, { method: 'POST', body: body || {} }),
  tutorialResults: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/results`),
  // Re-works every issued paper against the corrected questions, keeping each
  // student's drawn values.
  reevaluateTutorial: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/reevaluate`, { method: 'POST' }),
  // One question worked out for values the teacher typed, rather than drawn ones.
  evaluateTutorialQuestion: (classId, tutorialId, questionIndex, values) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/questions/${questionIndex}/evaluate`, {
      method: 'POST',
      body: { values },
    }),
  validateFormula: (classId, formula, variables) =>
    request(`/classes/${classId}/tutorials/validate-formula`, {
      method: 'POST',
      body: { formula, variables },
    }),
  formulaReference: (classId) => request(`/classes/${classId}/tutorials/formula-reference`),
  myTutorialAttempt: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/attempt`),
  saveTutorialAttempt: (classId, attemptId, responses) =>
    request(`/classes/${classId}/tutorial-attempts/${attemptId}/save`, {
      method: 'POST',
      body: { responses },
    }),
  // "Is this one right?" for a single answer, while the student is still
  // working. Returns a boolean only — never the expected value.
  checkTutorialAnswer: (classId, tutorialId, attemptId, body) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/attempts/${attemptId}/check`, {
      method: 'POST',
      body,
    }),
  submitTutorialAttempt: (classId, attemptId, responses) =>
    request(`/classes/${classId}/tutorial-attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { responses },
    }),
  adjustTutorialAttempt: (classId, attemptId, adjustment, feedback) =>
    request(`/classes/${classId}/tutorial-attempts/${attemptId}/adjust`, {
      method: 'POST',
      body: { adjustment, feedback },
    }),
  // Photos/PDFs of a student's working on a tutorial attempt (10 MB each, images
  // and PDFs, enforced server-side). `files` is a FileList or array of File.
  addTutorialUploads: (classId, attemptId, files) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    return request(`/classes/${classId}/tutorial-attempts/${attemptId}/uploads`, {
      method: 'POST',
      body: form,
    });
  },
  removeTutorialUpload: (classId, attemptId, url) =>
    request(`/classes/${classId}/tutorial-attempts/${attemptId}/uploads`, {
      method: 'DELETE',
      body: { url },
    }),

  /* live (teacher-paced) tutorials — the Shorts-style pace on top of a tutorial */
  presentTutorial: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/present`, { method: 'POST' }),
  tutorialSessionState: (classId, sessionId) =>
    request(`/classes/${classId}/tutorial-sessions/${sessionId}/state`),
  controlTutorialSession: (classId, sessionId, body) =>
    request(`/classes/${classId}/tutorial-sessions/${sessionId}/control`, { method: 'POST', body }),
  endTutorialSession: (classId, sessionId) =>
    request(`/classes/${classId}/tutorial-sessions/${sessionId}/end`, { method: 'POST' }),
  // The student side: current pace (poll), read by the player to reveal newly
  // opened questions.
  tutorialLiveState: (classId, tutorialId) =>
    request(`/classes/${classId}/tutorials/${tutorialId}/live`),

  /* parameterised assignments — the assessed sibling of tutorials, on its own
     routes so neither has to know about the other */
  listAssignments: (classId) => request(`/classes/${classId}/assignments`),
  createAssignment: (classId, body) => request(`/classes/${classId}/assignments`, { method: 'POST', body }),
  getAssignment: (classId, assignmentId) => request(`/classes/${classId}/assignments/${assignmentId}`),
  updateAssignment: (classId, assignmentId, body) =>
    request(`/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', body }),
  deleteAssignment: (classId, assignmentId) =>
    request(`/classes/${classId}/assignments/${assignmentId}`, { method: 'DELETE' }),
  previewAssignment: (classId, assignmentId, count) =>
    request(`/classes/${classId}/assignments/${assignmentId}/preview`, { method: 'POST', body: { count } }),
  publishAssignment: (classId, assignmentId, body) =>
    request(`/classes/${classId}/assignments/${assignmentId}/publish`, { method: 'POST', body: body || {} }),
  assignmentResults: (classId, assignmentId) =>
    request(`/classes/${classId}/assignments/${assignmentId}/results`),
  // Its own formula endpoints, so a future divergence in either does not silently
  // change validation for the other.
  // Re-works every issued paper against the corrected questions, keeping each
  // student's drawn values.
  reevaluateAssignment: (classId, assignmentId) =>
    request(`/classes/${classId}/assignments/${assignmentId}/reevaluate`, { method: 'POST' }),
  // One question worked out for values the teacher typed, rather than drawn ones.
  evaluateAssignmentQuestion: (classId, assignmentId, questionIndex, values) =>
    request(`/classes/${classId}/assignments/${assignmentId}/questions/${questionIndex}/evaluate`, {
      method: 'POST',
      body: { values },
    }),
  validateAssignmentFormula: (classId, formula, variables) =>
    request(`/classes/${classId}/assignments/validate-formula`, {
      method: 'POST',
      body: { formula, variables },
    }),
  assignmentFormulaReference: (classId) => request(`/classes/${classId}/assignments/formula-reference`),
  myAssignmentAttempt: (classId, assignmentId) =>
    request(`/classes/${classId}/assignments/${assignmentId}/attempt`),
  // Upload photos/PDFs of working straight onto an assignment submission (10 MB
  // each, images and PDFs only — enforced server-side), and remove one. `files`
  // is a FileList or array of File objects.
  addAssignmentUploads: (classId, attemptId, files) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    return request(`/classes/${classId}/assignment-attempts/${attemptId}/uploads`, {
      method: 'POST',
      body: form,
    });
  },
  removeAssignmentUpload: (classId, attemptId, url) =>
    request(`/classes/${classId}/assignment-attempts/${attemptId}/uploads`, {
      method: 'DELETE',
      body: { url },
    }),
  saveAssignmentAttempt: (classId, attemptId, responses) =>
    request(`/classes/${classId}/assignment-attempts/${attemptId}/save`, {
      method: 'POST',
      body: { responses },
    }),
  checkAssignmentAnswer: (classId, assignmentId, attemptId, body) =>
    request(`/classes/${classId}/assignments/${assignmentId}/attempts/${attemptId}/check`, {
      method: 'POST',
      body,
    }),
  submitAssignmentAttempt: (classId, attemptId, responses) =>
    request(`/classes/${classId}/assignment-attempts/${attemptId}/submit`, {
      method: 'POST',
      body: { responses },
    }),
  adjustAssignmentAttempt: (classId, attemptId, adjustment, feedback) =>
    request(`/classes/${classId}/assignment-attempts/${attemptId}/adjust`, {
      method: 'POST',
      body: { adjustment, feedback },
    }),

  /* ---- building an assignment from an uploaded question paper ---- */
  listAssignmentImports: (classId) => request(`/classes/${classId}/assignment-imports`),
  getAssignmentImport: (classId, draftId) =>
    request(`/classes/${classId}/assignment-imports/${draftId}`),
  startAssignmentImport: (classId, body) =>
    request(`/classes/${classId}/assignment-imports`, { method: 'POST', body }),
  deleteAssignmentImport: (classId, draftId) =>
    request(`/classes/${classId}/assignment-imports/${draftId}`, { method: 'DELETE' }),
  suggestAssignmentImportVariables: (classId, draftId, questionId) =>
    request(`/classes/${classId}/assignment-imports/${draftId}/questions/${questionId}/suggest-variables`, {
      method: 'POST',
      body: {},
    }),
  updateAssignmentImportQuestion: (classId, draftId, questionId, body) =>
    request(`/classes/${classId}/assignment-imports/${draftId}/questions/${questionId}`, {
      method: 'PATCH',
      body,
    }),
  deriveAssignmentImportAnswers: (classId, draftId, questionId) =>
    request(`/classes/${classId}/assignment-imports/${draftId}/questions/${questionId}/derive`, {
      method: 'POST',
      body: {},
    }),
  previewAssignmentImport: (classId, draftId, body) =>
    request(`/classes/${classId}/assignment-imports/${draftId}/preview`, {
      method: 'POST',
      body: body || {},
    }),
  mergeAssignmentImport: (classId, draftId, body) =>
    request(`/classes/${classId}/assignment-imports/${draftId}/merge`, { method: 'POST', body }),

  /* Virtual lab — a bench the student wires up, solved on the server */
  // The palette and the domain dropdown come from the server rather than being
  // duplicated here, so a component added to the solver appears on the canvas
  // without a second edit in a second language.
  labCatalogue: (classId) => request(`/classes/${classId}/labs/catalogue`),
  listLabs: (classId) => request(`/classes/${classId}/labs`),
  createLab: (classId, body) => request(`/classes/${classId}/labs`, { method: 'POST', body }),
  getLab: (classId, labId) => request(`/classes/${classId}/labs/${labId}`),
  updateLab: (classId, labId, body) =>
    request(`/classes/${classId}/labs/${labId}`, { method: 'PATCH', body }),
  deleteLab: (classId, labId) =>
    request(`/classes/${classId}/labs/${labId}`, { method: 'DELETE' }),
  publishLab: (classId, labId, body) =>
    request(`/classes/${classId}/labs/${labId}/publish`, { method: 'POST', body }),
  // One request per Run. A run is a deliberate act after wiring something, not a
  // keystroke, so the round trip is the right cost for having one solver.
  runLab: (classId, labId, body) =>
    request(`/classes/${classId}/labs/${labId}/run`, { method: 'POST', body }),
  myLabAttempt: (classId, labId) => request(`/classes/${classId}/labs/${labId}/attempt`),
  saveLabCircuit: (classId, labId, body) =>
    request(`/classes/${classId}/labs/${labId}/attempt/save`, { method: 'POST', body }),
  submitLabAttempt: (classId, labId, body) =>
    request(`/classes/${classId}/labs/${labId}/attempt/submit`, { method: 'POST', body }),
  listLabAttempts: (classId, labId) => request(`/classes/${classId}/labs/${labId}/attempts`),
  getLabAttempt: (classId, attemptId) => request(`/classes/${classId}/lab-attempts/${attemptId}`),
  markLabAttempt: (classId, attemptId, body) =>
    request(`/classes/${classId}/lab-attempts/${attemptId}/mark`, { method: 'POST', body }),

  /* AI studio */
  studioStatus: (classId) => request(`/classes/${classId}/studio/status`),
  studioRecordings: (classId) => request(`/classes/${classId}/studio/recordings`),
  studioAudioUrl: (classId, filename) =>
    `${BASE()}/classes/${classId}/studio/recordings/${encodeURIComponent(filename)}/audio`,
  listSessions: (classId) => request(`/classes/${classId}/studio/sessions`),
  createSession: (classId, body) => request(`/classes/${classId}/studio/sessions`, { method: 'POST', body }),
  getSession: (classId, sessionId) => request(`/classes/${classId}/studio/sessions/${sessionId}`),
  updateSession: (classId, sessionId, body) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}`, { method: 'PATCH', body }),
  deleteSession: (classId, sessionId) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}`, { method: 'DELETE' }),
  transcribeSession: (classId, sessionId, language) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/transcribe`, {
      method: 'POST',
      body: { language },
    }),
  generateFromSession: (classId, sessionId, body) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/generate`, { method: 'POST', body }),
  askSession: (classId, sessionId, question) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/ask`, { method: 'POST', body: { question } }),
  publishNotes: (classId, sessionId, body) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/publish/notes`, { method: 'POST', body: body || {} }),
  // Distinct from publishTutorial() above: this publishes an AI-generated
  // tutorial from a lecture session as class material, not a parameterised
  // tutorial. The two used to share a name and silently collided.
  publishSessionTutorial: (classId, sessionId, body) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/publish/tutorial`, { method: 'POST', body: body || {} }),
  publishQuizDraft: (classId, sessionId, body) =>
    request(`/classes/${classId}/studio/sessions/${sessionId}/publish/quiz`, { method: 'POST', body: body || {} }),

  /* coding notebooks — code that runs in the student's browser */
  listNotebooks: (classId) => request(`/classes/${classId}/notebooks`),
  createNotebook: (classId, body) => request(`/classes/${classId}/notebooks`, { method: 'POST', body }),
  getNotebook: (classId, notebookId) => request(`/classes/${classId}/notebooks/${notebookId}`),
  updateNotebook: (classId, notebookId, body) =>
    request(`/classes/${classId}/notebooks/${notebookId}`, { method: 'PATCH', body }),
  deleteNotebook: (classId, notebookId) =>
    request(`/classes/${classId}/notebooks/${notebookId}`, { method: 'DELETE' }),
  /* ---- points and badges ---- */
  leaderboard: (classId, scope = 'week') =>
    request(`/classes/${classId}/leaderboard?scope=${scope}`),
  myPoints: (classId) => request(`/classes/${classId}/my-points`),
  // Staff may ask for anybody on the table; a student only for themselves.
  studentPoints: (classId, studentId) => request(`/classes/${classId}/students/${studentId}/points`),
  pointsGuide: (classId) => request(`/classes/${classId}/points-guide`),

  /* ---- profile and bugs/suggestions (outside any class) ---- */
  myProfile: () => request('/me/profile'),
  reportBug: (body) => request('/bugs', { method: 'POST', body }),
  myBugReports: () => request('/bugs/mine'),
  // 403s for anyone who is not a platform admin; the page uses that to decide
  // whether to show the queue at all.
  allBugReports: ({ status, kind } = {}) => request(`/bugs${qs({ status, kind })}`),
  reviewBug: (reportId, body) => request(`/bugs/${reportId}`, { method: 'PATCH', body }),

  /* ---- joining the development team ---- */
  applyToDevTeam: (body) => request('/dev-team/apply', { method: 'POST', body }),
  // Carries this semester's application (if any) alongside the history, so the
  // page knows whether to show the form before anything has been typed.
  myDevApplication: () => request('/dev-team/mine'),
  // 403s for anyone who is not a platform admin; the page uses that to decide
  // whether to show the queue at all.
  allDevApplications: ({ status } = {}) => request(`/dev-team${qs({ status })}`),
  reviewDevApplication: (applicationId, body) =>
    request(`/dev-team/${applicationId}`, { method: 'PATCH', body }),

  /* ---- XCEED event participation, the other half of dev-team eligibility ----
     Multipart: the proof file and the fields describing it go together in one
     request, so nothing is written to disk that no record points at. */
  submitEventParticipation: ({ eventType, eventName, eventDate, role, description, proof }) => {
    const form = new FormData();
    form.append('proof', proof);
    form.append('eventType', eventType || 'other');
    form.append('eventName', eventName || '');
    if (eventDate) form.append('eventDate', eventDate);
    if (role) form.append('role', role);
    if (description) form.append('description', description);
    return request('/dev-team/events', { method: 'POST', body: form });
  },
  myEventParticipations: () => request('/dev-team/events/mine'),
  // 403s for anyone who is not a platform admin, the same as the queues above.
  allEventParticipations: ({ status } = {}) => request(`/dev-team/events${qs({ status })}`),
  reviewEventParticipation: (participationId, body) =>
    request(`/dev-team/events/${participationId}`, { method: 'PATCH', body }),

  /* lm-admin dashboard — platform-wide stats, 403 for anyone else */
  adminSummary: () => request('/admin/summary'),
  /* lm-admin — faculty accounts. Same 403 for anyone who is not a platform admin. */
  adminListFaculty: ({ q, dept } = {}) => request(`/admin/faculty${qs({ q, dept })}`),
  adminCreateFaculty: (body) => request('/admin/faculty', { method: 'POST', body }),
  /* Bulk import from the timetable module's master faculty table. The preview
     is a read — what the button would do, department by department — and the
     import is the button. `dept` omitted imports every department. */
  adminFacultyImportPreview: () => request('/admin/faculty/import'),
  adminImportFaculty: (dept) => request('/admin/faculty/import', { method: 'POST', body: { dept } }),
  /* lm-admin — student accounts. Same 403 for anyone who is not a platform admin. */
  adminListStudents: (params = {}) => request(`/admin/students${qs(params)}`),
  adminCreateStudent: (body) => request('/admin/students', { method: 'POST', body }),
  /* lm-admin — all classes owned by a specific faculty member.
     Powers the class-count click-through on the faculty directory page. */
  adminGetFacultyClasses: (facultyId) => request(`/admin/faculty/${facultyId}/classes`),
  /* lm-admin / HOD — platform-wide per-class activity breakdown, ranked by score.
     Accepts optional { semester, session } filters. */
  adminGetHodDashboard: (params = {}) => request(`/admin/hod-dashboard${qs(params)}`),
  /* Bulk import from an ERP roster export (.xlsx: name, roll no, branch,
     email), parsed client-side — the server only ever sees plain rows of
     `{ name, rollNumber, dept, email }`. `preview` classifies each row
     without writing anything; `import` is the button. Both take `rows`.
     An address that already has an account is updated (name/roll/dept
     corrected to match the roster) rather than skipped. */
  adminPreviewStudentImport: (body) => request('/admin/students/import/preview', { method: 'POST', body }),
  adminImportStudents: (body) => request('/admin/students/import', { method: 'POST', body }),
  /* Editing a student's name/email/dept from the directory. */
  adminUpdateStudent: (studentId, body) => request(`/admin/students/${studentId}`, { method: 'PATCH', body }),

  /* ---- discussion forum ---- */
  listDiscussions: (classId) => request(`/classes/${classId}/discussions`),
  createDiscussion: (classId, body) =>
    request(`/classes/${classId}/discussions`, { method: 'POST', body }),
  getDiscussion: (classId, discussionId) =>
    request(`/classes/${classId}/discussions/${discussionId}`),
  updateDiscussion: (classId, discussionId, body) =>
    request(`/classes/${classId}/discussions/${discussionId}`, { method: 'PATCH', body }),
  deleteDiscussion: (classId, discussionId) =>
    request(`/classes/${classId}/discussions/${discussionId}`, { method: 'DELETE' }),

  publishNotebook: (classId, notebookId, body) =>
    request(`/classes/${classId}/notebooks/${notebookId}/publish`, { method: 'POST', body: body || {} }),
  notebookAttempt: (classId, notebookId) =>
    request(`/classes/${classId}/notebooks/${notebookId}/attempt`),
  listNotebookAttempts: (classId, notebookId) =>
    request(`/classes/${classId}/notebooks/${notebookId}/attempts`),
  getNotebookAttempt: (classId, attemptId) => request(`/classes/${classId}/notebook-attempts/${attemptId}`),
  saveNotebookAttempt: (classId, attemptId, body) =>
    request(`/classes/${classId}/notebook-attempts/${attemptId}/save`, { method: 'POST', body }),
  submitNotebookAttempt: (classId, attemptId, body) =>
    request(`/classes/${classId}/notebook-attempts/${attemptId}/submit`, { method: 'POST', body: body || {} }),
  reopenNotebookAttempt: (classId, attemptId) =>
    request(`/classes/${classId}/notebook-attempts/${attemptId}/reopen`, { method: 'POST', body: {} }),
  gradeNotebookAttempt: (classId, attemptId, body) =>
    request(`/classes/${classId}/notebook-attempts/${attemptId}/grade`, { method: 'PATCH', body }),

  /* shorts — instant in-class polls */
  listShorts: (classId) => request(`/classes/${classId}/shorts`),
  createShort: (classId, body) => request(`/classes/${classId}/shorts`, { method: 'POST', body }),
  getShort: (classId, shortId) => request(`/classes/${classId}/shorts/${shortId}`),
  updateShort: (classId, shortId, body) =>
    request(`/classes/${classId}/shorts/${shortId}`, { method: 'PATCH', body }),
  deleteShort: (classId, shortId) =>
    request(`/classes/${classId}/shorts/${shortId}`, { method: 'DELETE' }),
  /* `email` overrides the deck's own emailOnStart setting for this one run;
     omit it to present the way the deck is configured. */
  presentShort: (classId, shortId, { email } = {}) =>
    request(`/classes/${classId}/shorts/${shortId}/present`, {
      method: 'POST',
      body: typeof email === 'boolean' ? { email } : {},
    }),
  listShortSessions: (classId, shortId) => request(`/classes/${classId}/shorts/${shortId}/sessions`),
  shortPresenterState: (classId, sessionId) =>
    request(`/classes/${classId}/short-sessions/${sessionId}/state`),
  controlShortSession: (classId, sessionId, action, extra) =>
    request(`/classes/${classId}/short-sessions/${sessionId}/control`, {
      method: 'POST',
      body: { action, ...(extra || {}) },
    }),
  endShortSession: (classId, sessionId) =>
    request(`/classes/${classId}/short-sessions/${sessionId}/end`, { method: 'POST', body: {} }),
  shortSessionReport: (classId, sessionId) =>
    request(`/classes/${classId}/short-sessions/${sessionId}/report`),
  shortSessionCsvUrl: (classId, sessionId) =>
    `${BASE()}/classes/${classId}/short-sessions/${sessionId}/report.csv`,

  // The participant side is not class-scoped: a phone has the join code and
  // nothing else until the server resolves it.
  // `name` is only read by the server when the deck allows guests and nobody is
  // signed in; it is what the room and the report will show.
  joinShort: (code, { name } = {}) =>
    request(`/shorts/join/${encodeURIComponent(code)}`, {
      method: 'POST',
      body: name ? { name } : {},
    }),
  shortGuest,
  shortLiveState: (sessionId) => request(`/shorts/live/${sessionId}`),
  answerShort: (sessionId, body) =>
    request(`/shorts/live/${sessionId}/answer`, { method: 'POST', body }),

  // SSE endpoints are read by useShortStream, which uses fetch + ReadableStream
  // rather than EventSource. EventSource cannot set an Authorization header, and
  // the alternative — putting the JWT in the query string — would write it into
  // every access log between here and the server.
  shortPresenterStreamUrl: (classId, sessionId) =>
    `${BASE()}/classes/${classId}/short-sessions/${sessionId}/stream`,
  shortParticipantStreamUrl: (sessionId) => `${BASE()}/shorts/live/${sessionId}/stream`,

  // Live-tutorial SSE, read by the same useShortStream hook. The presenter's is
  // the per-student progress board; the student's is the tiny pace payload that
  // wakes the player when the teacher opens the next question.
  tutorialPresenterStreamUrl: (classId, sessionId) =>
    `${BASE()}/classes/${classId}/tutorial-sessions/${sessionId}/stream`,
  tutorialLiveStreamUrl: (classId, tutorialId) =>
    `${BASE()}/classes/${classId}/tutorials/${tutorialId}/live/stream`,

  /* forms — a Google-Forms-like builder for the class. Own model, own
     controller, own routes; nothing here is read by or written to quizzes or
     tutorials. Authoring/results are staff-only server-side; the class-mode
     fill pair is open to any class member. Link-mode responding (including
     guests) is not class-scoped — see `joinFormByLink` below. */
  listForms: (classId) => request(`/classes/${classId}/forms`),
  createForm: (classId, body) => request(`/classes/${classId}/forms`, { method: 'POST', body }),
  getForm: (classId, formId) => request(`/classes/${classId}/forms/${formId}`),
  updateForm: (classId, formId, body) => request(`/classes/${classId}/forms/${formId}`, { method: 'PATCH', body }),
  deleteForm: (classId, formId) => request(`/classes/${classId}/forms/${formId}`, { method: 'DELETE' }),
  publishForm: (classId, formId, body) =>
    request(`/classes/${classId}/forms/${formId}/publish`, { method: 'POST', body: body || {} }),
  getFormForFill: (classId, formId) => request(`/classes/${classId}/forms/${formId}/fill`),
  submitFormResponse: (classId, formId, answers) =>
    request(`/classes/${classId}/forms/${formId}/fill`, { method: 'POST', body: { answers } }),
  listFormResponses: (classId, formId) => request(`/classes/${classId}/forms/${formId}/responses`),
  getFormSummary: (classId, formId) => request(`/classes/${classId}/forms/${formId}/responses/summary`),
  formResponsesCsvUrl: (classId, formId) => `${BASE()}/classes/${classId}/forms/${formId}/responses.csv`,
  deleteFormResponse: (classId, formId, responseId) =>
    request(`/classes/${classId}/forms/${formId}/responses/${responseId}`, { method: 'DELETE' }),

  // Link-mode responding — a share link has a code and nothing else, so there
  // is no classId to scope these under (the same reason Shorts' join/answer
  // routes sit outside the class router). `name` is only read by the server
  // when the form allows guests and nobody is signed in.
  formGuest,
  joinFormByLink: (shareCode, { name } = {}) =>
    request(`/forms/link/${encodeURIComponent(shareCode)}/join`, {
      method: 'POST',
      body: name ? { name } : {},
    }),
  getFormByLink: (shareCode) => request(`/forms/link/${encodeURIComponent(shareCode)}`),
  submitFormResponseByLink: (shareCode, answers) =>
    request(`/forms/link/${encodeURIComponent(shareCode)}/responses`, { method: 'POST', body: { answers } }),
  formShareUrl: (shareCode) => `${window.location.origin}/learning/form/link/${shareCode}`,

  /* analytics + uploads */
  analytics: (classId) => request(`/classes/${classId}/analytics`),

  /* Safe Exam Browser. `sebConfigUrl` is a plain link, not a `request()` call:
     it is meant to be clicked or downloaded, not fetched and parsed, and a
     browser navigation to it authenticates the same way any other file link in
     this module does — see lmApi.fileUrl and Attachments.jsx for the existing
     pattern this follows rather than reinvents. */
  sebConfigUrl: (classId, quizId) =>
    lmApi.fileUrl(`/api/v1/learningmodule/classes/${classId}/quizzes/${quizId}/seb-config`),

  /**
   * The same settings file as a quick-launch link.
   *
   * SEB registers the `seb://` and `sebs://` schemes: following one makes it
   * fetch the settings at that address, apply them, and open its own Start URL —
   * so a student clicks once instead of downloading a file and hunting for
   * wherever the browser put it. `sebs` for an https site, `seb` for http, which
   * is how SEB decides what to fetch the settings over.
   *
   * It lands on the module home rather than on this quiz, and deliberately: the
   * page SEB opens is the Start URL *inside the settings file*, and giving each
   * paper its own would change the file, which changes the Config Key, which is
   * the per-quiz trip through the Configuration Tool this whole arrangement
   * exists to remove.
   */
  /**
   * A one-click Safe Exam Browser launch, as a `seb://` address.
   *
   * Built from a short-lived token rather than from the ordinary config URL,
   * because of who does the fetching: following a `seb://` link hands it to
   * **SEB**, which has its own network stack and none of the student's session
   * in it. Pointed at the authenticated endpoint it got a 401 — the file
   * downloaded fine in the browser and the link did nothing, which is a
   * confusing pair of symptoms for one cause.
   *
   * The token is minted by the server for this student and this quiz and lasts
   * minutes, so the settings stay behind a check without requiring SEB to hold
   * a session it cannot have.
   *
   * `sebs` for an https site, `seb` for http — that is how SEB decides what to
   * fetch the settings over.
   */
  sebLaunchToken: (classId, quizId) =>
    request(`/classes/${classId}/quizzes/${quizId}/seb-launch-token`),

  sebLaunchUrlFromToken: (token) =>
    lmApi
      .fileUrl(`/api/v1/learningmodule/seb-launch/${encodeURIComponent(token)}`)
      .replace(/^https:/, 'sebs:')
      .replace(/^http:/, 'seb:'),

  uploadSebConfig: (classId, quizId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/classes/${classId}/quizzes/${quizId}/seb-config`, { method: 'POST', body: form });
  },
  setSebBypassCode: (classId, quizId, body) =>
    request(`/classes/${classId}/quizzes/${quizId}/seb-bypass-code`, { method: 'POST', body }),

  /* The room code the invigilator reads out to the hall. `{}` mints a fresh one
     (retiring the old), `{ clear: true }` removes it. Returns the plaintext for
     the teacher to read out — see quizController.setRoomCode. */
  setRoomCode: (classId, quizId, body = {}) =>
    request(`/classes/${classId}/quizzes/${quizId}/room-code`, { method: 'POST', body }),

  /* Attachments are filed under the class that owns them, so the upload is
     class-scoped: the server writes into that class's folder and mints a URL
     that names it. */
  uploadFiles: (classId, files) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('files', file));
    return request(`/classes/${classId}/uploads`, { method: 'POST', body: form });
  },
};

export default lmApi;
