// client/src/attendancemodule/menuCatalogue.js
//
// The iLEED menu catalogue — one list, read by everything that shows or hides
// an iLEED screen.
//
// It used to live inside DeptMenuConfig.jsx, which was fine while that screen
// was the only place the toggles were edited. It is now edited from two places
// (Dept Menu Config, and the Academic Administration screen's HOD and Dean
// columns) and rendered from three layouts, and a list copied into any of them
// would start disagreeing with the others the first time a menu was added.
//
// `key` is the contract. The same key names a menu in every layout, a field on
// `deptMenus` in the Batch model, and a field on `hodMenus` / `deanMenus` in
// LeadershipMenuSettings — which is what lets one entry here drive all three
// audiences. To add a menu: add it here, add the key to `deptMenus` on
// server/src/models/attendanceModule/batch.js, and add it to
// LEADERSHIP_MENU_KEYS in
// server/src/models/attendanceModule/leadershipMenuSettings.js. Nothing else
// has to change.

export const ALL_MENUS = [
    { key: 'dashboard',         label: 'Dashboard',            desc: 'Main overview and stats',                color: '#6366f1' },
    { key: 'groundTruth',       label: 'Ground Truth Capture', desc: 'RTSP stream capture for training data',  color: '#0ea5e9' },
    { key: 'rollAssignment',    label: 'Roll Assignment',       desc: 'Assign roll numbers to student faces',   color: '#10b981' },
    { key: 'erpUpload',         label: 'ERP Upload',            desc: 'Upload student data from ERP',           color: '#f472b6' },
    { key: 'attendanceReports', label: 'Attendance Reports',    desc: 'View and export attendance records',     color: '#14b8a6' },
    { key: 'classVerification', label: 'Class Verification',    desc: 'Frame-level attendance verification',    color: '#ec4899' },
    { key: 'cameraRegistry',    label: 'Camera Registry',       desc: 'Manage registered cameras',              color: '#f97316' },
    { key: 'subjectEmbeddings', label: 'Subject Embeddings',    desc: 'Generate face embeddings per subject',   color: '#f59e0b' },
    { key: 'livePreview',       label: 'Live Preview',          desc: 'Live camera feed preview',               color: '#8b5cf6' },
    { key: 'confidenceMonitor', label: 'Confidence Monitor',    desc: 'Model confidence tracking',              color: '#ef4444' },
    { key: 'recordStream',      label: 'Record Stream',         desc: 'Save and schedule RTSP recordings',      color: '#7c3aed' },
    { key: 'extraClasses',      label: 'Extra Classes',         desc: 'Schedule extra classes outside the timetable', color: '#f59e0b' },
    { key: 'alteringClasses',   label: 'Altering Classes',      desc: 'One-time faculty/subject swaps',          color: '#d946ef' },
    { key: 'instituteIdentification', label: 'Institute Identification', desc: 'Identify students institute-wide from video/stream', color: '#8b5cf6' },
    { key: 'erpOverrides',      label: 'ERP Overrides',         desc: 'Audit manually/ERP-overridden attendance records',      color: '#f59e0b' },
    { key: 'attendanceDisputes', label: 'Attendance Disputes',  desc: 'Accept or reject student challenges to a marking',      color: '#0ea5e9' },
    { key: 'bugReports',        label: 'Raise a Bug / Suggestion', desc: 'Report defects and ideas to the platform admins', color: '#ef4444' },
    { key: 'helpManual',        label: 'Help & Manual',         desc: 'Documentation and user guide',           color: '#64748b' },
];

/**
 * The screens the two read-only leadership views can draw, with their routes.
 *
 * Every entry here has a real page behind it inside both leadership shells —
 * the same components the department admin uses, rendered against the
 * leadership shell's own outlet context, which is why they come out scoped to
 * the head's department (or, for the Dean, to the whole institute) without a
 * second set of screens existing.
 *
 * `path` is the suffix; each shell supplies its own base, because the two views
 * are the same screens at two scopes and differ only in their URL. The one
 * exception is the manual, which is the platform's rather than the module's:
 * an absolute route, opened in a new tab, because losing the screen you were
 * reading about is a poor way to read about it.
 *
 * Being listed here does NOT mean a viewer gets the screen — every entry but
 * the dashboard obeys its toggle on the Academic Administration screen, and
 * the audience lists below decide which shell carries it at all.
 */
export const LEADERSHIP_MENUS = [
    { id: 'dashboard',         menuKey: 'dashboard',         path: 'dashboard',               label: 'Dashboard',            exact: true, color: '#6366f1' },
    { id: 'groundTruth',       menuKey: 'groundTruth',       path: 'live-rtsp',               label: 'Ground Truth Capture',              color: '#0ea5e9' },
    { id: 'rollAssignment',    menuKey: 'rollAssignment',    path: 'assign-rolls',            label: 'Roll Assignment',                   color: '#10b981' },
    { id: 'erpUpload',         menuKey: 'erpUpload',         path: 'erp-upload',              label: 'ERP Upload',                        color: '#f472b6' },
    { id: 'attendanceReports', menuKey: 'attendanceReports', path: 'reports',                 label: 'Attendance Reports',                color: '#14b8a6' },
    { id: 'classVerification', menuKey: 'classVerification', path: 'verification',            label: 'Class Verification',                color: '#ec4899' },
    { id: 'cameraRegistry',    menuKey: 'cameraRegistry',    path: 'cameras',                 label: 'Camera Registry',                   color: '#f97316' },
    { id: 'subjectEmbeddings', menuKey: 'subjectEmbeddings', path: 'embeddings',              label: 'Subject Embeddings',                color: '#f59e0b' },
    { id: 'livePreview',       menuKey: 'livePreview',       path: 'preview',                 label: 'Live Preview',                      color: '#8b5cf6' },
    { id: 'confidenceMonitor', menuKey: 'confidenceMonitor', path: 'confidence',              label: 'Confidence Monitor',                color: '#ef4444' },
    { id: 'recordStream',      menuKey: 'recordStream',      path: 'record-stream',           label: 'Record Stream',                     color: '#7c3aed' },
    { id: 'extraClasses',      menuKey: 'extraClasses',      path: 'extra-class',             label: 'Extra Classes',                     color: '#f59e0b' },
    { id: 'alteringClasses',   menuKey: 'alteringClasses',   path: 'altering-class',          label: 'Altering Classes',                  color: '#d946ef' },
    { id: 'instituteIdentification', menuKey: 'instituteIdentification', path: 'institute-identification', label: 'Institute Identification', color: '#8b5cf6' },
    { id: 'erpOverrides',      menuKey: 'erpOverrides',      path: 'erp-overrides',           label: 'ERP Overrides',                     color: '#f59e0b' },
    { id: 'attendanceDisputes', menuKey: 'attendanceDisputes', path: 'disputes',              label: 'Attendance Disputes',               color: '#0ea5e9' },
    { id: 'bugReports',        menuKey: 'bugReports',        path: 'bug-report',              label: 'Raise a Bug / Suggestion',          color: '#ef4444' },
    { id: 'helpManual',        menuKey: 'helpManual',        route: '/ams-manual',            label: 'Help & Manual',       newTab: true, color: '#64748b' },
];

/**
 * Both leadership shells draw every screen above.
 *
 * The head of department's view was widened to the whole catalogue first and
 * the Dean (Academic)'s followed, so there is no longer a per-audience list —
 * one statement, and the two shells cannot drift apart by one being edited.
 *
 * What is NOT shared, and must not become shared, is which of them a given
 * viewer gets: `hodMenus` and `deanMenus` are separate documents with separate
 * values, so an institute can show the dean a screen it does not show every
 * head, and the other way round. Drawing the same catalogue is a statement
 * about which screens EXIST in each shell; the toggles decide who sees them.
 *
 * If the two ever do need different screens again, add the per-audience list
 * back here AND make the settings screen's "has a screen" badge per-audience
 * with it. Those two were once out of step, and the result was an
 * administrator being told a switch had a screen behind it, turning it on, and
 * waiting for a link that could never appear.
 *
 * The one asymmetry left is not here: the head's shell splices in their own
 * Email Notifications, which a dean has no use for because they head no
 * department. See HodLayout.
 */

/** Just the keys — what the settings screen marks as having a screen. */
export const LEADERSHIP_MENU_KEYS = LEADERSHIP_MENUS
    .map((menu) => menu.menuKey)
    .filter(Boolean);

/**
 * The leadership menu list for one shell, with its routes resolved.
 *
 * @param {string} base e.g. '/ileed-hod' or '/ileed-dean'
 */
export const leadershipMenusFor = (base) =>
    LEADERSHIP_MENUS.map(({ path, route, ...menu }) => ({
        ...menu,
        route: route || `${base}/${path}`,
    }));

/**
 * The catalogue menu a path inside a leadership shell belongs to, or null.
 *
 * Used by both shells to answer "is the screen being asked for one an
 * administrator has switched off?". Longest match wins, so a detail page —
 * `/ileed-hod/erp-overrides/:reportId` — is governed by the same toggle as the
 * listing it was reached from rather than falling through as unknown.
 *
 * Null means the path is not a catalogue screen at all: the head's own Email
 * Notifications, or something that does not exist. Neither is a toggle's to
 * withhold, so both are left to the router.
 */
export const menuForPath = (base, pathname) => {
    const clean = String(pathname || '').replace(/\/+$/, '');
    return leadershipMenusFor(base)
        .filter((menu) => menu.route.startsWith(`${base}/`))
        .filter((menu) => clean === menu.route || clean.startsWith(`${menu.route}/`))
        .sort((a, b) => b.route.length - a.route.length)[0] || null;
};
