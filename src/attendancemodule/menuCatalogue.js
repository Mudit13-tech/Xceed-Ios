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
 * The screens the two read-only leadership views actually carry today.
 *
 * A much shorter list than the catalogue above, and deliberately so: the rest
 * of iLEED is somebody operating the system, which is exactly what a head of
 * department and the Dean (Academic) do not do here. The toggles for those
 * other menus are still stored for both audiences — they are one field per
 * audience and a key per menu — but nothing renders them, so an administrator
 * turning one on would be waiting for a link that never appears.
 *
 * Exported so the settings screen can SAY which those are rather than offering
 * eighteen switches of which five do something, and so that the day a screen is
 * added here, the settings screen learns about it without being edited.
 *
 * `path` is the suffix; each layout supplies its own base, because the two
 * views are the same screens at two scopes and differ only in their URL.
 */
export const LEADERSHIP_MENUS = [
    { id: 'dashboard',         menuKey: 'dashboard',         path: 'dashboard',    label: 'Dashboard',          exact: true, color: '#6366f1' },
    { id: 'attendanceReports', menuKey: 'attendanceReports', path: 'reports',      label: 'Attendance Reports',              color: '#14b8a6' },
    { id: 'confidenceMonitor', menuKey: 'confidenceMonitor', path: 'confidence',   label: 'Confidence Monitor',              color: '#ef4444' },
    { id: 'classVerification', menuKey: 'classVerification', path: 'verification', label: 'Class Verification',              color: '#ec4899' },
    // The manual is the platform's, not the module's, so it has an absolute
    // route and no base to hang off — and it opens in a new tab because losing
    // the screen you were reading about is a poor way to read about it.
    { id: 'helpManual',        menuKey: 'helpManual',        route: '/ams-manual', label: 'Help & Manual',      newTab: true, color: '#64748b' },
];

/**
 * The two screens a head of department is NOT offered, unlike the dean.
 *
 * Both judge the recognition system itself rather than report a department's
 * attendance — an operator's tools, and a head can act on nothing either
 * shows. They have no route inside `/ileed-hod` at all, so this is not merely
 * an unlinked page: it cannot be reached by typing the path either.
 *
 * It lives here rather than in HodLayout because the settings screen has to
 * know it too. While it did not, an administrator switching Class Verification
 * on for the heads was told the menu "has a screen" and then watched nothing
 * appear — a toggle that could never do anything, with nothing on screen
 * saying so.
 *
 * Named as an exclusion rather than an inclusion so a screen added to the list
 * above reaches a head by default, the way this catalogue intends, instead of
 * being silently dropped by a list nobody remembered to extend.
 */
export const NOT_FOR_HEADS = ['confidenceMonitor', 'classVerification'];

/** The leadership screens one audience actually draws. */
export const leadershipMenusForAudience = (audience) =>
    (audience === 'hod'
        ? LEADERSHIP_MENUS.filter((menu) => !NOT_FOR_HEADS.includes(menu.id))
        : LEADERSHIP_MENUS);

/**
 * Just the keys one audience has a screen for — what the settings screen marks.
 *
 * Per audience, and there is deliberately no union of the two: asking "does
 * this menu have a screen *somewhere*" is what let the settings screen promise
 * a head of department the Dean's Class Verification, so the question can only
 * be asked about one audience at a time.
 */
export const leadershipMenuKeysFor = (audience) =>
    leadershipMenusForAudience(audience)
        .map((menu) => menu.menuKey)
        .filter(Boolean);

/**
 * The leadership menu list for one view, with its routes resolved.
 *
 * @param {string} base e.g. '/ileed-hod' or '/ileed-dean'
 * @param {'hod'|'dean'} audience which view is asking — they draw different sets
 */
export const leadershipMenusFor = (base, audience) =>
    leadershipMenusForAudience(audience).map(({ path, route, ...menu }) => ({
        ...menu,
        route: route || `${base}/${path}`,
    }));
