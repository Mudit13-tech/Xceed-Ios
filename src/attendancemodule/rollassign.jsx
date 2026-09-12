import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import getEnvironment from '../getenvironment';
import { DEGREES, theme, styles, cssReset } from './config';
import { useDepartments } from './useDepartments';
import { useBatchYears } from './useBatchYears';
import { AmsSubtab } from './SubtabNewTabButton';
import { readSubtabFromSearch } from './subtabNavigation';

const apiUrl    = getEnvironment();
const RA_BASE   = `${apiUrl}/attendancemodule/roll-assign`;
const GT_BASE   = `${apiUrl}/attendancemodule/ground-truth`;
const FLAG_BASE = `${apiUrl}/attendancemodule/flags`;
const fetch = (input, init = {}) => window.fetch(input, {
    credentials: 'include',
    ...init,
});

const HIGH   = 0.62;
const MEDIUM = 0.45;

const RESPONSIVE_CSS = `
    ${cssReset}

    .roll-page { overflow-x: hidden; }
    .roll-page .ams-tabs {
        max-width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    .roll-filter-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
        gap: 16px;
        align-items: end;
    }
    .roll-filter-grid > *, .roll-page select { min-width: 0; }
    .roll-summary-scroll {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-gutter: stable;
    }
    .roll-summary-table { min-width: 940px; }
    .roll-summary-table th,
    .roll-summary-table td {
        border-left: 0 !important;
        border-right: 0 !important;
    }
    .roll-modal-overlay { box-sizing: border-box; }
    .roll-modal-shell { min-width: 0; }
    .roll-modal-body { min-width: 0; }
    .roll-modal-header, .roll-modal-footer, .roll-modal-actions { min-width: 0; }

    @media (max-width: 1000px) {
        .roll-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .roll-filter-action { width: 100% !important; }
        .roll-modal-body { grid-template-columns: minmax(0, 1fr) minmax(220px, 0.7fr) !important; }
    }

    @media (max-width: 700px) {
        .roll-filter-grid { grid-template-columns: 1fr; gap: 12px; }
        .roll-page-card { padding: 16px !important; }
        .roll-card-grid { grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)) !important; }
        .roll-toast {
            left: 12px !important;
            right: 12px !important;
            min-width: 0 !important;
            max-width: none !important;
            transform: none !important;
        }
        .roll-modal-overlay {
            align-items: stretch !important;
            padding: 8px !important;
        }
        .roll-modal-shell {
            width: 100% !important;
            max-width: none !important;
            max-height: calc(100dvh - 16px) !important;
            border-radius: 10px !important;
        }
        .roll-modal-body {
            grid-template-columns: 1fr !important;
            padding: 12px !important;
            overflow-x: hidden !important;
        }
        .roll-modal-header, .roll-modal-footer {
            padding: 10px 12px !important;
            gap: 8px;
            flex-wrap: wrap;
        }
        .roll-modal-header-main { min-width: 0; flex: 1 1 220px; flex-wrap: wrap; }
        .roll-modal-footer { align-items: stretch !important; }
        .roll-modal-footer > * { max-width: 100%; }
        .roll-modal-actions { width: 100%; display: grid !important; grid-template-columns: 1fr 1fr; }
        .roll-edit-modal { width: 100% !important; max-width: 420px; padding: 18px !important; }
        .roll-photo-grid { grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)) !important; }
        .roll-section-heading { align-items: flex-start !important; gap: 8px; flex-wrap: wrap; }
        .roll-section-actions { width: 100%; flex-wrap: wrap; }
    }

    @media (max-width: 420px) {
        .roll-modal-actions { grid-template-columns: 1fr; }
        .roll-page .ams-tab { padding-left: 16px; padding-right: 16px; }
    }

    @keyframes rollRefreshPulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
    .roll-refresh-dot { animation: rollRefreshPulse 1s ease-in-out infinite; }
    .roll-skeleton { animation: rollRefreshPulse 1.4s ease-in-out infinite; }

    @media (prefers-reduced-motion: reduce) {
        .roll-refresh-dot, .roll-skeleton { animation: none; opacity: 0.7; }
    }
`;

function NoEmbeddingBanner({ info, onDismiss }) {
    return (
        <div style={{
            marginTop: 14,
            padding: '14px 18px',
            borderRadius: 10,
            background: '#fef9c3',
            border: '1.5px solid #f59e0b',
            display: 'flex',
            gap: 14,
            alignItems: 'flex-start',
        }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                    ERP Embeddings Not Available
                </div>
                <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    No pre-built face embeddings were found for batch{' '}
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{info.batch}</span>.
                    Matching cannot run without them.
                    <br />
                    Go to the <strong>ERP Photos</strong> tab and click{' '}
                    <strong>"Generate Embeddings"</strong> for this batch, then come back and try again.
                </div>
                <button
                    onClick={onDismiss}
                    style={{
                        marginTop: 8, padding: '4px 12px', borderRadius: 6,
                        border: '1px solid #d97706', background: 'transparent',
                        color: '#92400e', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
}

function confidenceColor(score) {
    if (score >= HIGH)   return theme.success;
    if (score >= MEDIUM) return theme.warning;
    return theme.danger || '#f87171';
}
function confidenceLabel(score) {
    if (score >= HIGH)   return 'High';
    if (score >= MEDIUM) return 'Medium';
    return 'Low';
}

function broadcastRefresh(batchName) {
    try { new BroadcastChannel('attendance_refresh').postMessage({ type: 'refresh', batch: batchName }); } catch (_) {}
}

export default function RollAssign({ fixedDepartment = '' }) {
    const { departments, deptLoading, deptError } = useDepartments();
    const { batchYears, batchYearsLoading } = useBatchYears();

    const [searchParams] = useSearchParams();
    const [activeTab,      setActiveTab]      = useState(() => readSubtabFromSearch(
        ['assign', 'summary', 'images'],
        'assign',
        'tab',
        searchParams.toString(),
    ));
    const [summary,        setSummary]        = useState([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError,   setSummaryError]   = useState(null);

    const [degree,        setDegree]        = useState('BTECH');
    const [degrees, setDegrees]             = useState([]);
    const [department,    setDepartment]    = useState(fixedDepartment);
    const [year,          setYear]          = useState('');

    const fetchDegrees = async () => {
        const url = `${apiUrl}/attendancemodule/settings/batches/degrees`
        const res = await fetch(url, {credentials: "include"})
        const data = await res.json();
        setDegrees(data.degrees);
    }

    useEffect(() => {
        fetchDegrees();
    }, [])

    useEffect(() => {
        if (fixedDepartment) setDepartment(fixedDepartment);
    }, [fixedDepartment]);

    useEffect(() => {
        if (activeTab !== 'summary') return;
        setSummaryLoading(true);
        setSummaryError(null);
        fetch(`${RA_BASE}/summary`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load summary')))
            .then(d => setSummary(d.batches || []))
            .catch(e => setSummaryError(e.message))
            .finally(() => setSummaryLoading(false));
    }, [activeTab]);

    const [loading,       setLoading]       = useState(false);
    const [refreshing,    setRefreshing]    = useState(false);
    const [matching,      setMatching]      = useState(false);
    const [matchDone,     setMatchDone]     = useState(false);
    const [matchProgress, setMatchProgress] = useState(null);
    const [saving,        setSaving]        = useState(null);
    const [toast,         setToast]         = useState(null);
    const [matchError,    setMatchError]    = useState(null);
    const [approvingAll,  setApprovingAll]  = useState(false);

    const [unprocessed,    setUnprocessed]    = useState([]);
    const [pendingReview,  setPendingReview]  = useState([]);
    const [approvedItems,  setApprovedItems]  = useState([]);
    const [unmatchedItems, setUnmatchedItems] = useState([]);
    const [crossDeptItems, setCrossDeptItems] = useState([]);
    const [flaggedItems,   setFlaggedItems]   = useState([]);
    const [mergedItems,    setMergedItems]    = useState([]);

    const [unapprovedMap,  setUnapprovedMap]  = useState({});
    const [approvedStats,  setApprovedStats]  = useState({});
    const [approvingPhoto, setApprovingPhoto] = useState({});

    const [matches,      setMatches]      = useState({});

    const [modal,        setModal]        = useState(null);
    const [overrideRoll, setOverrideRoll] = useState('');

    const [flagModal,     setFlagModal]     = useState(null);
    const [flagRollInput, setFlagRollInput] = useState('');

    const [gtModal,    setGtModal]    = useState(null);
   const [noEmbeddingError, setNoEmbeddingError] = useState(null);

    // CHANGE 2: state for edit-roll-no modal on assigned cards
    const [editRollModal,    setEditRollModal]    = useState(null); // { item }
    const [editRollInput,    setEditRollInput]    = useState('');
    const [editRollSaving,   setEditRollSaving]   = useState(false);
    const [deletingAllImgs,  setDeletingAllImgs]  = useState(null); // folderName
    const [erpStatus,        setErpStatus]        = useState({ loading: false, available: null, pklName: null, studentCount: null, studentCountSource: null });

    const batchName = degree && department && year
        ? `${degree}_${department}_${year}`.toUpperCase()
        : null;

    const highConfCount = matchDone
        ? Object.entries(matches).filter(([, m]) => m?.best?.confidence >= HIGH).length
        : 0;

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const photoUrl    = (batch, folder, filename) =>
        `${RA_BASE}/photo/${encodeURIComponent(batch)}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
    const erpPhotoUrl = (filename) =>
        `${RA_BASE}/erp-photo/${encodeURIComponent(batchName)}/${encodeURIComponent(filename)}`;

    const flagPhotoUrl    = (batch, folder, filename) =>
        `${FLAG_BASE}/photo/${encodeURIComponent(batch)}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
    const flagErpPhotoUrl = (filename) =>
        `${FLAG_BASE}/erp-photo/${encodeURIComponent(batchName)}/${encodeURIComponent(filename)}`;

    // `silent` keeps the already-rendered folders mounted while data is refetched,
    // so post-approval refreshes don't blank the page out.
    const loadClusters = useCallback(async ({ silent = false } = {}) => {
        if (!batchName) return;
        if (silent) setRefreshing(true); else setLoading(true);
        setMatchError(null);
        try {
            const [clusterRes, matchRes, studentsRes] = await Promise.all([
                fetch(`${RA_BASE}/clusters/${batchName}`),
                fetch(`${RA_BASE}/matches/${batchName}`),
                fetch(`${GT_BASE}/batches/${encodeURIComponent(batchName)}/students`),
            ]);
            const clusterData = clusterRes.ok ? await clusterRes.json() : { unprocessed: [] };
            const unprocessedFromServer = clusterData.unprocessed || [];

            if (matchRes.ok) {
                const { matchMap = {} } = await matchRes.json();
                for (const u of unprocessedFromServer) {
                    if (!matchMap[u.folderName]) matchMap[u.folderName] = u;
                }
                const records = Object.values(matchMap);
                setPendingReview(records.filter(r => r.status === 'matched' && !r.approved));
                // CHANGE 3: sort approved by rollNo
                setApprovedItems(records.filter(r => r.approved).sort((a, b) => (a.rollNo || '').localeCompare(b.rollNo || '')));
                
                const allUnmatched = records.filter(r => r.status === 'unmatched');
                const isUnprocessed = r => !r.error && r.imageCount > 0;
                setUnprocessed(allUnmatched.filter(isUnprocessed));
                setUnmatchedItems(allUnmatched.filter(r => !isUnprocessed(r)));
                
                setCrossDeptItems(records.filter(r => r.status === 'cross_dept'));
                setFlaggedItems(records.filter(r => r.status === 'flagged'));
                setMergedItems(records.filter(r => r.status === 'merged_unapproved'));
            } else {
                setUnprocessed(unprocessedFromServer);
            }

            if (studentsRes.ok) {
                const { students = [] } = await studentsRes.json();
                const uMap = {}, sMap = {};
                for (const s of students) {
                    if (/^person_\d+$/i.test(s.rollNo)) continue;
                    if ((s.unapprovedFiles || []).length > 0) {
                        uMap[s.rollNo] = (s.unapprovedFiles || []).map(f => ({
                            ...f,
                            url: `${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(s.rollNo)}/${encodeURIComponent(f.filename)}`,
                        }));
                    }
                    sMap[s.rollNo] = {
                        approvedCount:   s.approvedCount   || 0,
                        embeddingCount:  s.embeddingCount  || 0,
                        backupCount:     s.backupCount     || 0,
                        unapprovedCount: s.unapprovedCount || 0,
                        previewFiles:    [...(s.embeddingFiles || []), ...(s.backupFiles || [])].slice(0, 4).map(f => f.filename),
                    };
                }
                setUnapprovedMap(uMap);
                setApprovedStats(sMap);
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (silent) setRefreshing(false); else setLoading(false);
        }
    }, [batchName]);

    const refreshClusters = useCallback(() => loadClusters({ silent: true }), [loadClusters]);

    useEffect(() => { loadClusters(); }, [loadClusters]);

    useEffect(() => {
        if (!batchName) return;
        let ch;
        try {
            ch = new BroadcastChannel('attendance_refresh');
            ch.onmessage = (e) => {
                if (e.data?.type === 'refresh' && e.data?.batch === batchName) refreshClusters();
            };
        } catch (_) {}
        return () => { try { ch?.close(); } catch (_) {} };
    }, [batchName, refreshClusters]);

    useEffect(() => {
        if (!batchName) { setErpStatus({ loading: false, available: null, pklName: null, studentCount: null, studentCountSource: null }); return; }
        setErpStatus(s => ({ ...s, loading: true, available: null }));
        fetch(`${RA_BASE}/erp-embedding/status/${encodeURIComponent(batchName)}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            // studentCount is null when the count could not be established —
            // leave it null rather than coercing to 0, which reads as an empty
            // batch instead of an unknown one.
            .then(d => setErpStatus({
                loading: false,
                available: !!d.available,
                pklName: d.pklName || null,
                studentCount: Number.isInteger(d.studentCount) ? d.studentCount : null,
                studentCountSource: d.studentCountSource || null,
            }))
            .catch(() => setErpStatus({ loading: false, available: null, pklName: null, studentCount: null, studentCountSource: null }));
    }, [batchName]);

   const runAutoMatch = useCallback(async () => {
    if (!batchName) return;
    setMatching(true); setMatchDone(false); setMatchError(null);
    setNoEmbeddingError(null);   // clear any previous no-embedding banner
    setMatchProgress({ msg: 'Starting…', done: 0, total: 0, step: 'init' });
    const localMatches = {};
    let sseSucceeded = false, matchCount = 0;
    try {
        const res = await fetch(`${RA_BASE}/auto-match/${batchName}`, { method: 'POST' });
        if (!res.ok) {
            const d = await res.json();
            // ── Structured "no embedding" error ──────────────────────────
            if (d.noEmbedding) {
                setNoEmbeddingError({ batch: d.batch, department: d.department });
                return;
            }
            throw new Error(d.error || 'Match failed');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const processLine = async (line) => {
            if (!line.startsWith('data:')) return;
            let evt;
            try { evt = JSON.parse(line.slice(5).trim()); } catch { return; }
            if (evt.type === 'erp_progress') {
                setMatchProgress({ msg: evt.msg, done: evt.done, total: evt.total, step: 'erp' });
            } else if (evt.type === 'cluster_progress') {
                setMatchProgress({ msg: evt.msg, done: evt.done, total: evt.total, step: 'cluster', current: evt.current });
            } else if (evt.type === 'status') {
                setMatchProgress(p => ({ ...p, msg: evt.msg, step: evt.step }));
            } else if (evt.type === 'match_result') {
                localMatches[evt.folder] = evt.match; matchCount++;
                try {
                    const sr = await fetch(`${RA_BASE}/save-match-result`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ batch: batchName, folderName: evt.folder, matchData: evt.match }),
                    });
                    if (sr.ok) {
                        setMatches(prev => ({ ...prev, [evt.folder]: evt.match }));
                        setMatchProgress(p => ({ ...p, msg: `Saved ${matchCount} matches...`, done: matchCount }));
                    }
                } catch (_) {}
            } else if (evt.type === 'done') {
                sseSucceeded = true; setMatchDone(true);
                showToast(`✓ Matched ${matchCount} clusters — saved to database`);
            } else if (evt.type === 'error') { throw new Error(evt.msg); }
        };
        while (true) {
            const { done, value } = await reader.read();
            if (done) { buf += decoder.decode(); for (const l of buf.split('\n')) await processLine(l); break; }
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n'); buf = lines.pop();
            for (const l of lines) await processLine(l);
        }
        if (sseSucceeded && matchCount > 0) {
            setMatchProgress({ msg: 'Renaming folders…', done: matchCount, total: matchCount, step: 'saving' });
            const ar = await fetch(`${RA_BASE}/auto-assign-all`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, matches: localMatches }),
            });
            const ad = await ar.json();
            if (!ar.ok) showToast(`⚠ Matching saved, but rename failed: ${ad.error}`, 'warning');
            else showToast(`✓ ${ad.renamed} clusters auto-assigned` + (ad.unmatched ? `, ${ad.unmatched} unmatched` : '') + (ad.conflicts ? `, ${ad.conflicts} conflicts` : ''));
            await refreshClusters();
        }
    } catch (err) {
        setMatchError(err.message); showToast(err.message, 'error');
        setTimeout(() => refreshClusters(), 500);
    } finally { setMatching(false); setMatchProgress(null); }
}, [batchName, refreshClusters]);

    const reviewQueue = [...pendingReview, ...mergedItems, ...flaggedItems];

    // Every still-unassigned cluster keeps its person_N folder name, and
    // /auto-match re-scans the whole batch directory — so unmatched and
    // cross-dept clusters get reprocessed too, not just `unprocessed`.
    const rematchable = [...unprocessed, ...unmatchedItems, ...crossDeptItems]
        .filter(r => /^person_\d+$/i.test(r.currentFolder || r.folderName || ''));

    const openModal = (item, queue) => {
        if (matching) return;
        setModal({ item, match: item, queue: queue || reviewQueue }); setOverrideRoll(item.rollNo || '');
    };
    const openQueueItem = (queue, currentFolderName, direction) => {
        const idx = queue.findIndex(r => r.folderName === currentFolderName);
        const next = queue[idx + direction];
        if (next) { setModal({ item: next, match: next, queue }); setOverrideRoll(next.rollNo || ''); }
        else setModal(null);
    };

    const openFlagModal = (item) => {
        if (matching) return;
        setFlagModal(item); setFlagRollInput(item.suggestedRollNo || '');
    };
    const openFlaggedItem = (direction) => {
        if (!flagModal) return;
        const idx  = flaggedItems.findIndex(f => f.folderName === flagModal.folderName);
        const next = flaggedItems[idx + direction];
        if (next) { setFlagModal(next); setFlagRollInput(next.suggestedRollNo || ''); }
    };

    const handleFlagResolve = async (folderName, rollNo) => {
        const trimmed = rollNo.trim().toUpperCase();
        if (!trimmed) { showToast('Enter a roll number', 'error'); return; }
        setSaving(folderName);
        try {
            const res  = await fetch(`${FLAG_BASE}/resolve-flag`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, folderName, rollNo: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            broadcastRefresh(batchName);
            const currentIndex = flaggedItems.findIndex(f => f.folderName === folderName);
            const remaining    = flaggedItems.filter(f => f.folderName !== folderName);
            setFlaggedItems(remaining);
            if (remaining.length > 0) {
                const nextItem = remaining[Math.min(currentIndex, remaining.length - 1)];
                setFlagModal(nextItem); setFlagRollInput('');
            } else { setFlagModal(null); }
            showToast(data.rollNo, 'success');
            refreshClusters();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSaving(null); }
    };

    const handleFlagFolderDeleted = () => {
        broadcastRefresh(batchName);
        const remaining = flaggedItems.filter(f => f.folderName !== flagModal?.folderName);
        setFlaggedItems(remaining);
        if (remaining.length > 0) { setFlagModal(remaining[0]); setFlagRollInput(remaining[0].suggestedRollNo || ''); }
        else setFlagModal(null);
    };

    const deleteUnmatchedFolder = async (item) => {
        if (!window.confirm(
            `Delete folder "${item.folderName}" permanently?\n\nRemoves all photos, DB record and flag entry. Cannot be undone.`
        )) return;
        setSaving(item.folderName);
        try {
            const folder = item.currentFolder || item.folderName;
            const res = await fetch(
                `${FLAG_BASE}/cluster/${encodeURIComponent(batchName)}/${encodeURIComponent(item.folderName)}`,
                { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentFolder: folder }) }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted "${item.folderName}" permanently`);
            setUnmatchedItems(prev => prev.filter(r => r.folderName !== item.folderName));
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSaving(null); }
    };

    // CHANGE 8: delete unprocessed folder
    const deleteUnprocessedFolder = async (item) => {
        if (!window.confirm(`Delete unprocessed folder "${item.folderName}" permanently?\n\nThis cannot be undone.`)) return;
        setSaving(item.folderName);
        try {
            const res = await fetch(
                `${FLAG_BASE}/cluster/${encodeURIComponent(batchName)}/${encodeURIComponent(item.folderName)}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted "${item.folderName}"`);
            setUnprocessed(prev => prev.filter(r => r.folderName !== item.folderName));
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSaving(null); }
    };

    const deleteAllUnprocessed = async () => {
        if (!unprocessed.length) return;
        if (!window.confirm(`Delete ALL ${unprocessed.length} unprocessed clusters permanently?\n\nThis cannot be undone.`)) return;
        setLoading(true);
        try {
            const folders = unprocessed.map(u => u.folderName);
            const res = await fetch(`${FLAG_BASE}/cluster-multiple/${encodeURIComponent(batchName)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folders })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted ${data.deleted.length} unprocessed clusters`);
            setUnprocessed([]);
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setLoading(false); }
    };

    const deleteAllUnmatched = async () => {
        if (!crossDeptItems.length) return;
        if (!window.confirm(`Delete ALL ${crossDeptItems.length} unmatched clusters permanently?\n\nThis cannot be undone.`)) return;
        setLoading(true);
        try {
            const folders = crossDeptItems.map(c => c.folderName);
            const res = await fetch(`${FLAG_BASE}/cluster-multiple/${encodeURIComponent(batchName)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folders })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted ${data.deleted.length} unmatched clusters`);
            setCrossDeptItems([]);
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setLoading(false); }
    };

    const deleteAllNoFace = async () => {
        if (!unmatchedItems.length) return;
        if (!window.confirm(`Delete ALL ${unmatchedItems.length} undetected face clusters permanently?\n\nThis cannot be undone.`)) return;
        setLoading(true);
        try {
            const folders = unmatchedItems.map(c => c.folderName);
            const res = await fetch(`${FLAG_BASE}/cluster-multiple/${encodeURIComponent(batchName)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folders })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted ${data.deleted.length} undetected clusters`);
            setUnmatchedItems([]);
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleApprove = async (item, rollNo) => {
        const { folderName, _id } = item;
        const trimmed = (rollNo || '').trim().toUpperCase();
        if (!trimmed) { showToast('Enter a roll number', 'error'); return; }
        if (!_id)     { showToast('Cluster ID missing — reload', 'error'); return; }

        // CHANGE 5: check if roll no already approved
        const alreadyApproved = approvedItems.find(a => a.rollNo === trimmed);
        if (alreadyApproved) {
            const choice = window.confirm(
                `⚠ Ground truth for "${trimmed}" already exists!\n\nClick OK to merge photos into the existing folder.\nClick Cancel to abort.`
            );
            if (!choice) return;
        }

        setSaving(folderName);
        const queueSnapshot = [...pendingReview, ...mergedItems, ...flaggedItems];
        try {
            const res  = await fetch(`${RA_BASE}/approve`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: _id, rollNo: trimmed, mergeIfExists: !!alreadyApproved }),
            });
            let data; try { data = await res.json(); } catch { data = {}; }
            if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
            const found = queueSnapshot.find(r => r.folderName === folderName);
            setPendingReview(prev => prev.filter(r => r.folderName !== folderName));
            setMergedItems(prev  => prev.filter(r => r.folderName !== folderName));
            setFlaggedItems(prev => prev.filter(r => r.folderName !== folderName));
            if (found && !alreadyApproved) {
                setApprovedItems(prev => [...prev, { ...found, rollNo: data.rollNo || trimmed, approved: true, status: 'approved' }]
                    .sort((a, b) => (a.rollNo || '').localeCompare(b.rollNo || '')));
            }
            showToast(alreadyApproved ? `Merged into ${trimmed}` : (data.rollNo || trimmed), 'success');
            setModal(null);
            refreshClusters();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSaving(null); }
    };

    const handleFlag = async (item, match) => {
        const { folderName, _id } = item;
        if (!_id) { showToast('Cluster ID missing — reload', 'error'); return; }
        setSaving(folderName);
        const queueSnapshot = [...pendingReview, ...mergedItems, ...flaggedItems];
        try {
            const res = await fetch(`${RA_BASE}/flag`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: _id,
                    suggestedRollNo: match?.rollNo     || match?.best?.rollNo     || null,
                    confidence:      match?.confidence || match?.best?.confidence || null,
                    reason: 'operator_rejected',
                }),
            });
            let data; try { data = await res.json(); } catch { data = {}; }
            if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
            const alreadyFlagged = flaggedItems.some(r => r.folderName === folderName);
            const found = queueSnapshot.find(r => r.folderName === folderName);
            setPendingReview(prev => prev.filter(r => r.folderName !== folderName));
            setMergedItems(prev  => prev.filter(r => r.folderName !== folderName));
            if (found && !alreadyFlagged) setFlaggedItems(prev => [...prev, { ...found, status: 'flagged' }]);
            showToast(found?.rollNo || folderName, 'flag');
            openQueueItem(queueSnapshot, folderName, +1);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setSaving(null); }
    };

    const approveAllHigh = async () => {
        if (!matchDone) { showToast('Run ERP match first', 'error'); return; }
        const seen = new Map();
        for (const r of pendingReview.filter(r => matches[r.folderName]?.best?.confidence >= HIGH)) {
            const c = { _id: r._id, folderName: r.folderName, match: matches[r.folderName] };
            const roll = c.match.best.rollNo;
            const prev = seen.get(roll);
            if (!prev || c.match.best.confidence > prev.match.best.confidence) seen.set(roll, c);
        }
        const toApprove = [...seen.values()];
        if (!toApprove.length) { showToast('No high-confidence matches found', 'error'); return; }
        const lines = toApprove.map(c => `${c.folderName} -> ${c.match.best.rollNo} (${(c.match.best.confidence*100).toFixed(0)}%)`).join('\n');
        if (!window.confirm(`Approve all ${toApprove.length} high-confidence matches?\n\n${lines}`)) return;
        setApprovingAll(true);
        try {
            const res = await fetch(`${RA_BASE}/bulk-assign`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, assignments: toApprove.map(c => ({ id: c._id, folderName: c.folderName, rollNo: c.match.best.rollNo })) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(`Auto-assigned ${data.assigned} high-confidence clusters`);
            refreshClusters();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setApprovingAll(false); }
    };

    const openGtModal = (rollNo) => {
        setGtModal({ rollNo });
    };

  

    const approvePhoto = useCallback(async (rollNo, filename) => {
        const key = `${rollNo}::${filename}`;
        setApprovingPhoto(prev => ({ ...prev, [key]: true }));
        try {
            const res  = await fetch(`${GT_BASE}/approve-photos`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, rollNo, filenames: [filename] }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(`Approved & added to embedding`);
            setUnapprovedMap(prev => {
                const u = { ...(prev[rollNo] ? { [rollNo]: prev[rollNo].filter(f => f.filename !== filename) } : {}) };
                if (u[rollNo]?.length === 0) delete u[rollNo];
                return { ...prev, ...u };
            });
            setApprovedStats(prev => ({ ...prev, [rollNo]: { ...prev[rollNo], approvedCount: (prev[rollNo]?.approvedCount || 0) + 1, embeddingCount: (prev[rollNo]?.embeddingCount || 0) + 1, unapprovedCount: Math.max(0, (prev[rollNo]?.unapprovedCount || 1) - 1) } }));
        } catch (err) { showToast(err.message, 'error'); }
        finally { setApprovingPhoto(prev => { const n = { ...prev }; delete n[key]; return n; }); }
    }, [batchName]);

    const approveAllPhotos = useCallback(async (rollNo, files) => {
        if (!files?.length) return;
        const allKey = `${rollNo}::all`;
        setApprovingPhoto(prev => ({ ...prev, [allKey]: true }));
        try {
            const res  = await fetch(`${GT_BASE}/approve-photos`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, rollNo, filenames: files.map(f => f.filename) }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(`Approved ${files.length} photo(s) for ${rollNo}`);
            setUnapprovedMap(prev => { const n = { ...prev }; delete n[rollNo]; return n; });
            setApprovedStats(prev => ({ ...prev, [rollNo]: { approvedCount: data.approvedCount || 0, embeddingCount: data.embeddingCount || 0, backupCount: data.backupCount || 0, unapprovedCount: 0 } }));
        } catch (err) { showToast(err.message, 'error'); }
        finally { setApprovingPhoto(prev => { const n = { ...prev }; delete n[allKey]; return n; }); }
    }, [batchName]);

    const deleteUnapprovedPhoto = useCallback(async (rollNo, filename) => {
        if (!window.confirm(`Delete photo ${filename}?`)) return;
        const key = `${rollNo}::${filename}`;
        setApprovingPhoto(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch(`${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            showToast(`Deleted ${filename}`);
            setUnapprovedMap(prev => {
                const u = { ...(prev[rollNo] ? { [rollNo]: prev[rollNo].filter(f => f.filename !== filename) } : {}) };
                if (u[rollNo]?.length === 0) delete u[rollNo];
                return { ...prev, ...u };
            });
        } catch (err) { showToast(err.message, 'error'); }
        finally { setApprovingPhoto(prev => { const n = { ...prev }; delete n[key]; return n; }); }
    }, [batchName]);

    const deleteAllUnapprovedPhotos = useCallback(async (rollNo, files) => {
        if (!files?.length) return;
        if (!window.confirm(`Delete all ${files.length} pending photos for ${rollNo}?`)) return;
        const allKey = `${rollNo}::all`;
        setApprovingPhoto(prev => ({ ...prev, [allKey]: true }));
        try {
            for (const f of files) {
                const res = await fetch(`${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(f.filename)}`, { method: 'DELETE' });
                if (!res.ok) throw new Error('Delete failed');
            }
            showToast(`Deleted ${files.length} photo(s)`);
            setUnapprovedMap(prev => { const n = { ...prev }; delete n[rollNo]; return n; });
        } catch (err) { showToast(err.message, 'error'); }
        finally { setApprovingPhoto(prev => { const n = { ...prev }; delete n[allKey]; return n; }); }
    }, [batchName]);

    // CHANGE 2: delete all images for an assigned roll no
    const handleDeleteAllImages = async (item) => {
        if (!window.confirm(`Delete cluster "${item.rollNo}" permanently?\n\nThis removes all photos from disk and the assignment record from DB. Cannot be undone.`)) return;
        if (!item._id) { showToast('Cluster ID missing — reload the page', 'error'); return; }
        setDeletingAllImgs(item.folderName);
        try {
            const res  = await fetch(`${RA_BASE}/cluster/${encodeURIComponent(item._id)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted cluster for ${item.rollNo}`);
            setApprovedItems(prev => prev.filter(r => r.folderName !== item.folderName));
            setFlaggedItems(prev => prev.filter(r => r.folderName !== item.folderName));
            setApprovedStats(prev => { const n = { ...prev }; delete n[item.rollNo]; return n; });
            broadcastRefresh(batchName);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setDeletingAllImgs(null); }
    };

    // CHANGE 2: edit roll no for an assigned item
    const handleEditRollSave = async () => {
        const trimmed = editRollInput.trim().toUpperCase();
        if (!trimmed) { showToast('Enter a roll number', 'error'); return; }
        if (!editRollModal?._id) { showToast('Cluster ID missing', 'error'); return; }

        // Retyping a roll number that is already assigned merges the two —
        // there is one folder per student on disk, so they cannot stay apart.
        const owner = approvedItems.find(a => a.rollNo === trimmed && a._id !== editRollModal._id);
        if (owner && !window.confirm(
            `⚠ Ground truth for "${trimmed}" already exists!

Click OK to merge these photos into the existing folder.
Click Cancel to abort.`
        )) return;

        setEditRollSaving(true);
        try {
            const res  = await fetch(`${RA_BASE}/approve`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: editRollModal._id, rollNo: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(`Roll no updated to ${trimmed}`);
            setEditRollModal(null);
            refreshClusters();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setEditRollSaving(false); }
    };

    return (
        <div className="roll-page" style={styles.page}>
            <style>{RESPONSIVE_CSS}</style>
          {toast && !modal && !flagModal && (
                <>
                <style>{`
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                    }
                `}</style>
                <div className="roll-toast" style={{
                    position: 'fixed', top: 96, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9000, pointerEvents: 'none',
                    animation: 'slideDown 0.22s cubic-bezier(0.16,1,0.3,1)',
                    minWidth: 300, maxWidth: 400,
                    background: toast.type === 'error' ? '#ef4444' : toast.type === 'flag' ? '#f59e0b' : '#22c55e',
                    borderRadius: 8,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                    border: 'none',
                    padding: '12px 20px',
                }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        {toast.type === 'error' ? 'Error' : toast.type === 'flag' ? 'Flagged' : 'Success'}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
                        {toast.msg}
                    </div>
                </div>
                </>
            )}

            {modal && createPortal((() => {
                const currentQueue = modal.queue || reviewQueue;
                const queueIdx = currentQueue.findIndex(r => r.folderName === modal.item.folderName);
                return (
                    <VerifyModal
                        item={modal.item} match={modal.match} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                        overrideRoll={overrideRoll} setOverrideRoll={setOverrideRoll}
                        saving={saving === modal.item.folderName}
                        onApprove={() => handleApprove(modal.item, overrideRoll)}
                        onFlag={() => handleFlag(modal.item, modal.match)}
                        onClose={() => setModal(null)}
                        hasPrev={queueIdx > 0} hasNext={queueIdx < currentQueue.length - 1}
                        onPrev={() => openQueueItem(currentQueue, modal.item.folderName, -1)}
                        onNext={() => openQueueItem(currentQueue, modal.item.folderName, 1)}
                        position={queueIdx + 1} total={currentQueue.length}
                        toast={toast}
                        showToast={showToast}
                        onPhotoDeleted={(filename) => {
                            setModal(prev => ({
                                ...prev,
                                item: {
                                    ...prev.item,
                                    previewFiles: (prev.item.previewFiles || []).filter(f => f !== filename),
                                    imageFiles:   (prev.item.imageFiles   || []).filter(f => f !== filename),
                                },
                            }));
                        }}
                    />
                );
            })(), document.body)}

            {flagModal && createPortal((() => {
                const idx = flaggedItems.findIndex(f => f.folderName === flagModal.folderName);
                return (
                    <FlagResolveModal
                        item={flagModal} batchName={batchName}
                        flagPhotoUrl={flagPhotoUrl} flagErpPhotoUrl={flagErpPhotoUrl}
                        rollInput={flagRollInput} setRollInput={setFlagRollInput}
                        saving={saving === flagModal.folderName}
                        onResolve={() => handleFlagResolve(flagModal.folderName, flagRollInput)}
                        onClose={() => setFlagModal(null)}
                        hasPrev={idx > 0} hasNext={idx < flaggedItems.length - 1}
                        onPrev={() => openFlaggedItem(-1)} onNext={() => openFlaggedItem(+1)}
                        position={idx + 1} total={flaggedItems.length}
                        showToast={showToast}
                        toast={toast}
                        onFolderDeleted={handleFlagFolderDeleted}
                        onPhotoDeleted={(filename) => {
                            setFlagModal(prev => ({
                                ...prev,
                                previewFiles: (prev.previewFiles || []).filter(f => f !== filename),
                                imageFiles:   (prev.imageFiles   || []).filter(f => f !== filename),
                            }));
                        }}
                    />
                );
            })(), document.body)}

          {gtModal && createPortal(
                <GTModal
                    rollNo={gtModal.rollNo}
                    batchName={batchName}
                    onClose={() => { setGtModal(null); refreshClusters(); }}
                    showToast={showToast}
                    onMoved={refreshClusters}
                />,
                document.body
            )}

            {/* CHANGE 2: Edit Roll No modal */}
            {editRollModal && createPortal(
                <div className="roll-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                    onClick={e => { if (e.target === e.currentTarget) setEditRollModal(null); }}>
                    <div className="roll-edit-modal" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 28, width: 340 }}>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: 12 }}>Edit Roll Number</div>
                        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fefce8', border: '1px solid #fbbf24', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                                <path d="M8 1.5L14.5 13H1.5L8 1.5z" stroke="#d97706" strokeWidth="1.3" strokeLinejoin="round"/>
                                <line x1="8" y1="6" x2="8" y2="9.5" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
                                <circle cx="8" cy="11.5" r="0.7" fill="#d97706"/>
                            </svg>
                            <span style={{ fontSize: '11.5px', color: '#92400e', lineHeight: 1.5 }}>
                                Changing the roll number will rename the cluster folder and re-link all associated images. Existing embeddings tied to the old roll number will be affected. Proceed only if you are sure.
                            </span>
                        </div>
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: 8 }}>Current: <span style={{ fontFamily: theme.fontMono, color: theme.text, fontWeight: 700 }}>{editRollModal.rollNo}</span></div>
                        <input
                            autoFocus
                            value={editRollInput}
                            onChange={e => setEditRollInput(e.target.value.toUpperCase())}
                            onKeyDown={e => { if (e.key === 'Enter') handleEditRollSave(); if (e.key === 'Escape') setEditRollModal(null); }}
                            placeholder="New roll number"
                            style={{ ...styles.input, marginBottom: 16, fontFamily: theme.fontMono, fontWeight: 700, fontSize: '15px' }}
                        />
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setEditRollModal(null)} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleEditRollSave} disabled={editRollSaving || !editRollInput.trim()} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', background: theme.success, color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (editRollSaving || !editRollInput.trim()) ? 0.5 : 1 }}>
                                {editRollSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div style={{ marginBottom: 16 }}>
                <div style={styles.heading}>Roll Assignment</div>
                <div style={styles.subheading}>Assign roll numbers to face clusters and track progress across batches</div>
            </div>

            <div className="ams-tabs">
                <AmsSubtab value="assign" label="Assign" active={activeTab === 'assign'} onSelect={setActiveTab} />
                <AmsSubtab value="summary" label="Summary" active={activeTab === 'summary'} onSelect={setActiveTab} />
                <AmsSubtab value="images" label="Image Counts" active={activeTab === 'images'} onSelect={setActiveTab} />
            </div>

            {activeTab === 'assign' && (<>
            <div className="roll-page-card" style={{ ...styles.card, marginBottom: 20 }}>
                <div className="roll-filter-grid">
                    <div>
                        <label style={styles.label}>Degree</label>
                        <select value={degree} onChange={e => setDegree(e.target.value)} style={styles.select}>
                            {degrees.map(d => <option key={d.degreeName}>{d.degreeName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={styles.label}>Department</label>
                        {fixedDepartment ? (
                            <div style={{ ...styles.select, display: 'flex', alignItems: 'center', background: theme.surfaceAlt, color: theme.textMuted, cursor: 'not-allowed' }}>
                                {fixedDepartment.replace(/_/g, ' ')}
                            </div>
                        ) : (
                            <>
                                <select value={department} onChange={e => setDepartment(e.target.value)} style={styles.select} disabled={deptLoading}>
                                    <option value="">{deptLoading ? 'Loading…' : deptError ? 'Error' : 'Select...'}</option>
                                    {departments.map((d) => {
                                    const normalisedDepartment = d.replace(/_/g, " ")
                                    const selectedDegree = degrees.find(d => d.degreeName === degree);
                                    const branch = selectedDegree?.branches?.find( b => b.dept === normalisedDepartment );
                                    return (
                                        <option key={d} value={d}>
                                            {branch?.branchName || normalisedDepartment}
                                        </option>
                                    );
                                })}
                                </select>
                                {deptError && <div style={{ fontSize: '11px', color: theme.danger, marginTop: 3 }}>{deptError}</div>}
                            </>
                        )}
                    </div>
                    <div>
                        <label style={styles.label}>Year</label>
                        <select value={year} onChange={e => setYear(e.target.value)} style={styles.select}>
                            <option value="">Select...</option>
                            {batchYearsLoading
                                ? <option>Loading…</option>
                                : batchYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <button className="roll-filter-action" onClick={runAutoMatch} disabled={matching || !batchName || rematchable.length === 0 || (!erpStatus.loading && erpStatus.available === false)}
                        style={{ ...styles.btnPrimary, padding: '9px 20px', fontSize: '13px', opacity: (matching || !batchName || rematchable.length === 0 || (!erpStatus.loading && erpStatus.available === false)) ? 0.5 : 1 }}>
                        {matching ? '🔄 Matching…' : `🔍 Match with ERP Photos${rematchable.length > 0 ? ` (${rematchable.length})` : ''}`}
                    </button>
                </div>

                {batchName && !matching && (
                    erpStatus.loading ? (
                        <div style={{ marginTop: 10, fontSize: '11px', color: theme.textMuted }}>Checking ERP embeddings…</div>
                    ) : erpStatus.available === true ? (
                        <div style={{ marginTop: 10, padding: '7px 14px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>✓ ERP embeddings ready</span>
                            {erpStatus.studentCount !== null
                                ? <span style={{ fontSize: '12px', color: '#15803d' }}>
                                    {erpStatus.studentCount} students in this file
                                    {erpStatus.studentCountSource === 'recorded' && ' (as last written)'}
                                  </span>
                                : <span style={{ fontSize: '12px', color: '#a16207' }}>student count unavailable — ML service could not read the file</span>}
                            {erpStatus.pklName && <span style={{ fontFamily: theme.fontMono, fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '2px 7px', borderRadius: 4 }}>{erpStatus.pklName}</span>}
                        </div>
                    ) : erpStatus.available === false ? (
                        <div style={{ marginTop: 10, padding: '7px 14px', borderRadius: 6, background: '#fef9c3', border: '1.5px solid #f59e0b', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>⚠️</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '12px', color: '#92400e' }}>ERP embeddings not built for this batch</div>
                                <div style={{ fontSize: '11px', color: '#78350f', lineHeight: 1.5, marginTop: 2 }}>Go to <strong>ERP Upload → Summary</strong> → click <strong>"Re-Generate Embeddings"</strong> for this batch, then return here to match.</div>
                            </div>
                        </div>
                    ) : null
                )}

                {matchDone && highConfCount > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={approveAllHigh} disabled={approvingAll} style={{ padding: '6px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none', background: theme.success, color: '#000', opacity: approvingAll ? 0.5 : 1 }}>
                            {approvingAll ? 'Assigning...' : `Approve All High (${highConfCount})`}
                        </button>
                    </div>
                )}

                {matching && matchProgress && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: theme.textMuted, marginBottom: 4 }}>
                            <span>{matchProgress.msg}</span>
                            {matchProgress.total > 0 && <span style={{ fontFamily: theme.fontMono }}>{matchProgress.done}/{matchProgress.total}</span>}
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: theme.border, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: matchProgress.step === 'erp' ? theme.warning : theme.accent, width: matchProgress.total > 0 ? `${(matchProgress.done / matchProgress.total) * 100}%` : '5%', transition: 'width 0.3s' }} />
                        </div>
                    </div>
                )}

                {matchError && <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#3f1212', color: '#f87171', fontSize: '12px' }}>{matchError}</div>}

                {noEmbeddingError && (
                    <NoEmbeddingBanner
                        info={noEmbeddingError}
                        onDismiss={() => setNoEmbeddingError(null)}
                    />
                )}

                {!matching && pendingReview.length > 0 && (
                    <div style={{ marginTop: 12, padding: '8px 14px', borderRadius: 6, background: theme.successDim, border: `1px solid ${theme.success}44`, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: theme.success, fontWeight: 700, fontSize: '13px' }}>✓ Auto-assignment done</span>
                        <span style={{ color: theme.textMuted, fontSize: '12px' }}>{pendingReview.length} pending review · click any card to verify and approve</span>
                    </div>
                )}
                {!matching && rematchable.length > 0 && (
                    <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 7, background: theme.accentDim, border: `1px solid ${theme.accent}44`, fontSize: '12px', color: theme.textMuted }}>
                        <strong style={{ color: theme.accent }}>{rematchable.length} clusters awaiting assignment</strong>
                        {unprocessed.length !== rematchable.length && (
                            <span> ({unprocessed.length} unprocessed, {rematchable.length - unprocessed.length} previously unmatched)</span>
                        )}
                        {' '}— click <strong>Match with ERP Photos</strong> to (re)process them
                    </div>
                )}
            </div>

            {loading && <div style={{ ...styles.card, textAlign: 'center', padding: '40px 20px', color: theme.textMuted }}>Loading folders...</div>}

            {!loading && refreshing && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 7, margin: '10px 2px 0', fontSize: '11px', color: theme.textMuted }}>
                    <span className="roll-refresh-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.accent, display: 'inline-block' }} />
                    Refreshing folders…
                </div>
            )}

            {!loading && batchName && (
                <>
                    {/* CHANGE 7: Pending Review — no roll no field shown in cards, just click to open modal */}
                    <Section title="Pending Review" count={pendingReview.length} accentColor={theme.accent} emptyText="No clusters pending review">
                        {pendingReview.map(item => (
                            <ClusterCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                                onClick={() => openModal(item)} disabled={matching} />
                        ))}
                    </Section>

                    {Object.keys(unapprovedMap).length > 0 && (
                        <Section title="New Photos — Pending Approval" count={Object.values(unapprovedMap).reduce((s, a) => s + a.length, 0)} accentColor={theme.warning}>
                            {Object.entries(unapprovedMap).map(([rollNo, photos]) => (
                                <UnapprovedPhotoCard key={rollNo} rollNo={rollNo} photos={photos} stats={approvedStats[rollNo]}
                                    busy={approvingPhoto} onApprove={approvePhoto} onApproveAll={() => approveAllPhotos(rollNo, photos)}
                                    onDelete={deleteUnapprovedPhoto} onDeleteAll={() => deleteAllUnapprovedPhotos(rollNo, photos)}
                                    onClick={() => openGtModal(rollNo)} />
                            ))}
                        </Section>
                    )}

                    {/* CHANGE 1+2+3: Approved — sorted, no folder name, with Delete All + Edit Roll No */}
                    <Section title="Approved" count={approvedItems.length} accentColor={theme.success} emptyText="No approved clusters yet">
                        {approvedItems.map(item => (
                            <ClusterCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                                isAssigned stats={approvedStats[item.rollNo]} unapprovedCount={unapprovedMap[item.rollNo]?.length || 0}
                                onClick={() => openGtModal(item.rollNo)}
                                onDeleteAllImages={() => handleDeleteAllImages(item)}
                                deletingAllImages={deletingAllImgs === item.folderName}
                                onEditRoll={() => { setEditRollModal(item); setEditRollInput(item.rollNo || ''); }}
                            />
                        ))}
                    </Section>

                    {mergedItems.length > 0 && (
                        <Section title="Merged — Pending Review" count={mergedItems.length} accentColor={theme.warning} emptyText="">
                            {mergedItems.map(item => (
                                <ClusterCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                                    isMerged onClick={() => openModal(item)} />
                            ))}
                        </Section>
                    )}

                    <Section title="Flagged" count={flaggedItems.length} accentColor={theme.warning} emptyText="No flagged clusters">
                        {flaggedItems.map(item => (
                            <FlaggedClusterCard key={item.folderName} item={item} batchName={batchName}
                                flagPhotoUrl={flagPhotoUrl} onClick={() => openFlagModal(item)}
                                onEditRoll={() => { setEditRollModal(item); setEditRollInput(item.rollNo || ''); }}
                                onDeleteAllImages={() => handleDeleteAllImages(item)}
                                deletingAllImages={deletingAllImgs === item.folderName} />
                        ))}
                    </Section>

                    <Section 
                        title="No Face Detected" 
                        count={unmatchedItems.length} 
                        accentColor={theme.textMuted} 
                        emptyText="No undetected clusters"
                        rightElement={
                            unmatchedItems.length > 0 && (
                                <button 
                                    onClick={deleteAllNoFace} 
                                    style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: theme.danger, border: `1px solid ${theme.danger}`, outline: 'none' }}
                                >
                                    Delete All
                                </button>
                            )
                        }
                    >
                        {unmatchedItems.map(item => (
                            <ClusterCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                                isUnmatched
                                onClick={() => openModal(item, unmatchedItems)} disabled={matching}
                                onDeleteFolder={() => deleteUnmatchedFolder(item)}
                                deletingFolder={saving === item.folderName} />
                        ))}
                    </Section>

                    <Section 
                        title="Unmatched Cluster" 
                        count={crossDeptItems.length} 
                        accentColor="#a78bfa" 
                        emptyText="No cross-department clusters"
                        rightElement={
                            crossDeptItems.length > 0 && (
                                <button 
                                    onClick={deleteAllUnmatched} 
                                    style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: theme.danger, border: `1px solid ${theme.danger}`, outline: 'none' }}
                                >
                                    Delete All
                                </button>
                            )
                        }
                    >
                        {crossDeptItems.map(item => (
                            <CrossDeptCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl}
                                saving={saving === item.folderName}
                                onClick={() => openModal(item, crossDeptItems)}
                                onApprove={(rollNo) => handleApprove(item, rollNo)}
                                onDeleteFolder={() => deleteUnmatchedFolder(item)}
                                deletingFolder={saving === item.folderName} />
                        ))}
                    </Section>

                    {/* CHANGE 7+8: Unprocessed — no roll no field, delete folder button */}
                    {unprocessed.length > 0 && (
                        <Section 
                            title="Unprocessed" 
                            count={unprocessed.length} 
                            accentColor={theme.textMuted}
                            rightElement={
                                unprocessed.length > 0 && (
                                    <button 
                                        onClick={deleteAllUnprocessed} 
                                        style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: 'transparent', color: theme.danger, border: `1px solid ${theme.danger}`, outline: 'none' }}
                                    >
                                        Delete All
                                    </button>
                                )
                            }
                        >
                            {unprocessed.map(item => (
                                <ClusterCard key={item.folderName} item={item} batchName={batchName} photoUrl={photoUrl} erpPhotoUrl={erpPhotoUrl}
                                    isUnprocessed
                                    onClick={() => openModal(item, unprocessed)} disabled={matching}
                                    onDeleteFolder={() => deleteUnprocessedFolder(item)}
                                    deletingFolder={saving === item.folderName} />
                            ))}
                        </Section>
                    )}

                    {!unprocessed.length && !pendingReview.length && !approvedItems.length && !unmatchedItems.length && !crossDeptItems.length && !flaggedItems.length && (
                        <div style={{ ...styles.card, textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                            <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: 12 }}>📷</div>
                            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: 6 }}>No ground truth data found for this batch</div>
                            <div style={{ fontSize: '13px', color: theme.textMuted, marginBottom: 12 }}>Run <strong>Ground Truth Capture</strong> first to generate face clusters, then return here to assign roll numbers.</div>
                            <a href="/attendance/groundtruth/rtsp" style={{ display: 'inline-block', padding: '7px 18px', borderRadius: 7, background: theme.accent, color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                                Go to Ground Truth Capture →
                            </a>
                        </div>
                    )}
                </>
            )}

            {!loading && !batchName && (
                <div style={{ ...styles.card, textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                    <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: 12 }}>🎓</div>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Select a batch to start</div>
                </div>
            )}
            </>)}

            {activeTab === 'summary' && (
                <SummaryPanel summary={summary} summaryLoading={summaryLoading} summaryError={summaryError} fixedDepartment={fixedDepartment} />
            )}

            {activeTab === 'images' && (
                <ImageStatsPanel fixedDepartment={fixedDepartment} showToast={showToast} />
            )}
        </div>
    );
}

// ── Summary tab helpers ───────────────────────────────────────────

function parseBatch(batch) {
    const parts = (batch || '').split('_');
    if (parts.length < 3) return { degree: parts[0] || batch, dept: batch, year: '' };
    return { degree: parts[0], dept: parts.slice(1, -1).join('_'), year: parts[parts.length - 1] };
}

function SummaryPanel({ summary, summaryLoading, summaryError, fixedDepartment }) {
    const [expandedRow, setExpandedRow] = useState(null); // batch name currently expanded, or null

    if (summaryLoading) return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted, fontSize: '14px' }}>Loading summary…</div>
    );
    if (summaryError) return (
        <div style={{ ...styles.card, color: '#ef4444', padding: 20, fontSize: '13px' }}>Error: {summaryError}</div>
    );
    if (!summary.length) return (
        <div style={{ ...styles.card, textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
            <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: 6 }}>No data yet</div>
            <div style={{ fontSize: '13px', color: theme.textMuted }}>Run roll assignment to see batch statistics</div>
        </div>
    );

    const groups = {};
    for (const row of summary) {
        const { dept } = parseBatch(row.batch);
        if (!groups[dept]) groups[dept] = [];
        groups[dept].push(row);
    }
    const sortedDepts = Object.keys(groups).sort();

    const badge = (val, color) => (
        <span style={{ fontWeight: 700, color: val > 0 ? color : theme.textMuted }}>{val}</span>
    );

    return (
        <div>
            {/* If admin, no filtering directly show all | If dept coordinator show only concerned dept. summary */}
            {sortedDepts.filter(dept => !fixedDepartment || dept.toLowerCase() === fixedDepartment.toLowerCase())
                        .map(dept => {
                const rows = groups[dept].slice().sort((a, b) => a.batch.localeCompare(b.batch));
                const totals = rows.reduce((acc, r) => ({
                    total:         acc.total         + r.total,
                    approved:      acc.approved      + r.approved,
                    pending:       acc.pending       + r.pending,
                    flagged:       acc.flagged       + r.flagged,
                    unmatched:     acc.unmatched     + r.unmatched,
                    cross_dept:    acc.cross_dept    + (r.cross_dept || 0),
                    unclustered:   acc.unclustered   + (r.unclustered || 0),
                    erpPhotoTotal: acc.erpPhotoTotal + (r.erpPhotoTotal || 0),
                }), { total: 0, approved: 0, pending: 0, flagged: 0, unmatched: 0, cross_dept: 0, unclustered: 0, erpPhotoTotal: 0 });

                return (
                    <div key={dept} style={{ ...styles.card, marginBottom: 24, overflow: 'hidden', padding: 0 }}>
                        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: theme.text }}>{dept.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: '12px', color: theme.textMuted }}>{rows.length} batch{rows.length !== 1 ? 'es' : ''}</div>
                        </div>
                        <div className="roll-summary-scroll">
                            <table className="ams-table roll-summary-table">
                                <thead>
                                    <tr>
                                        <th>Batch</th>
                                        <th style={{ textAlign: 'right' }}>ERP Photos</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                        <th style={{ textAlign: 'right', color: theme.success }}>Approved</th>
                                        <th style={{ textAlign: 'right', color: '#f59e0b' }}>Pending Review</th>
                                        <th style={{ textAlign: 'right', color: theme.warning }}>Flagged</th>
                                        <th style={{ textAlign: 'right', color: '#a78bfa' }}>Diff Dept</th>
                                        <th style={{ textAlign: 'right' }}>Unmatched</th>
                                        <th style={{ textAlign: 'right', color: '#ef4444' }}>Unclustered</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => {
                                        const { degree, year } = parseBatch(r.batch);
                                        const isExpanded = expandedRow === r.batch;
                                        return (
                                            <Fragment key={r.batch}>
                                                <tr>
                                                    <td>{degree} {year}</td>
                                                    <td style={{ textAlign: 'right', color: theme.textMuted }}>{r.erpPhotoTotal ?? '—'}</td>
                                                    <td style={{ textAlign: 'right' }}>{r.total}</td>
                                                    <td style={{ textAlign: 'right' }}>{badge(r.approved,           theme.success)}</td>
                                                    <td style={{ textAlign: 'right' }}>{badge(r.pending,            '#f59e0b')}</td>
                                                    <td style={{ textAlign: 'right' }}>{badge(r.flagged,            theme.warning)}</td>
                                                    <td style={{ textAlign: 'right' }}>{badge(r.cross_dept || 0,   '#a78bfa')}</td>
                                                    <td style={{ textAlign: 'right', color: theme.textMuted }}>{r.unmatched}</td>
                                                    <td style={{ textAlign: 'right' }}>{badge(r.unclustered || 0,  '#ef4444')}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => setExpandedRow(isExpanded ? null : r.batch)}
                                                            style={{
                                                                padding: '3px 10px', fontSize: '11px', fontWeight: 600,
                                                                borderRadius: 6, border: `1px solid ${theme.border}`,
                                                                background: isExpanded ? theme.accent : 'transparent',
                                                                color: isExpanded ? '#fff' : theme.accent, cursor: 'pointer',
                                                            }}
                                                        >
                                                            Roll Nos {isExpanded ? '▲' : '▼'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={10} style={{ background: theme.bg, padding: '12px 18px' }}>
                                                            <RollNoDropdown
                                                                approvedRollNos={r.approvedRollNos || []}
                                                                pendingRollNos={r.pendingRollNos || []}
                                                            />
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</td>
                                        <td style={{ textAlign: 'right', color: theme.textMuted }}>{totals.erpPhotoTotal}</td>
                                        <td style={{ textAlign: 'right' }}>{totals.total}</td>
                                        <td style={{ textAlign: 'right' }}>{badge(totals.approved,   theme.success)}</td>
                                        <td style={{ textAlign: 'right' }}>{badge(totals.pending,    '#f59e0b')}</td>
                                        <td style={{ textAlign: 'right' }}>{badge(totals.flagged,    theme.warning)}</td>
                                        <td style={{ textAlign: 'right' }}>{badge(totals.cross_dept, '#a78bfa')}</td>
                                        <td style={{ textAlign: 'right', color: theme.textMuted }}>{totals.unmatched}</td>
                                        <td style={{ textAlign: 'right' }}>{badge(totals.unclustered, '#ef4444')}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Image Counts tab ──────────────────────────────────────────────
// Batch-wise breakdown of how many ground-truth images each student has in
// each category (embedding, backup, untracked, approved, unapproved). One row
// per batch; per-student rows load only when a row is expanded. Roll numbers
// open the same ground-truth modal the Assign tab uses, so images can be
// updated without leaving the page.

const IMG_CATEGORIES = [
    { key: 'total',      label: 'Total',      color: theme.text,     hint: 'All images in the student folder' },
    { key: 'embedding',  label: 'Embedding',  color: theme.accent,   hint: 'Images used to build the face embedding' },
    { key: 'backup',     label: 'Backup',     color: '#0284c7',      hint: 'Classified images kept in reserve' },
    { key: 'untracked',  label: 'Untracked',  color: '#a78bfa',      hint: 'On disk but in neither embedding nor backup' },
    { key: 'approved',   label: 'Approved',   color: theme.success,  hint: 'Operator-approved images' },
    { key: 'unapproved', label: 'Unapproved', color: '#f59e0b',      hint: 'Awaiting operator approval' },
];

const EMPTY_TOTALS = { total: 0, embedding: 0, backup: 0, untracked: 0, approved: 0, unapproved: 0, students: 0 };

const sumCategories = (list, pick = (r) => r) => list.reduce((acc, row) => {
    const r = pick(row);
    for (const c of IMG_CATEGORIES) acc[c.key] += r[c.key] || 0;
    acc.students += row.studentCount != null ? row.studentCount : 1;
    return acc;
}, { ...EMPTY_TOTALS });

const batchLabel = (r) => [r.degree, (r.department || '').replace(/_/g, ' '), r.year].filter(Boolean).join(' · ') || r.batch;

// Numeric-aware so 22CS2 sorts before 22CS10, not after it.
const byRollNo = (a, b) => String(a.rollNo).localeCompare(String(b.rollNo), 'en', { numeric: true, sensitivity: 'base' });

// Default order puts the students who need attention first: fewest images at
// the top, ties broken by roll number. 'roll' switches to plain ascending.
const SORT_MODES = [
    { key: 'fewest', label: 'Fewest images' },
    { key: 'roll',   label: 'Roll No' },
];
const sortStudents = (list, mode) => [...list].sort(
    mode === 'roll' ? byRollNo : (a, b) => (a.total - b.total) || byRollNo(a, b),
);

// A folder with no images is a hole in the ground truth; under the 5 the
// embedding builder wants is thin but usable.
const LOW_IMAGE_THRESHOLD = 5;
const totalCellColor = (total) => (
    total === 0 ? theme.danger : total < LOW_IMAGE_THRESHOLD ? theme.warning : theme.text
);

function ImageStatsPanel({ fixedDepartment, showToast }) {
    const [rows,        setRows]        = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState(null);
    const [generatedAt, setGeneratedAt] = useState(null);

    const { batchYears, batchYearsLoading } = useBatchYears();

    const [deptFilter, setDeptFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [details,    setDetails]    = useState({});     // batch → { loading, error, students }

    // Roll-no search runs against every batch the user may see, so a student
    // can be found without knowing which batch they sit in.
    const [searchInput, setSearchInput] = useState('');
    const [search,      setSearch]      = useState(null); // { loading, error, students, truncated, totalMatches }

    // Ground-truth modal — same component the Assign tab opens on a cluster.
    const [gtTarget, setGtTarget] = useState(null);       // { batch, rollNo }

    const load = useCallback((refresh = false) => {
        setLoading(true);
        setError(null);
        fetch(`${RA_BASE}/image-stats${refresh ? '?refresh=1' : ''}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load image counts')))
            .then(d => {
                setRows(d.batches || []);
                setGeneratedAt(d.generatedAt || null);
                if (refresh) { setDetails({}); setSearch(null); }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // Department + batch-year scope. Computed above the early returns so the
    // auto-load effect below (and the render) can rely on it.
    const inScope = rows.filter(r => !fixedDepartment || (r.department || '').toLowerCase() === fixedDepartment.toLowerCase());
    const visible = inScope.filter(r => (
        (!deptFilter || r.department === deptFilter)
        && (!yearFilter || r.year === yearFilter)
    ));

    // When a department AND a batch year are both selected, load the student
    // image-count tables right away so they render directly — no row-expand step.
    // (When a department is fixed by the route, only the batch year is needed.)
    useEffect(() => {
        if ((!deptFilter && !fixedDepartment) || !yearFilter) return;
        visible.forEach(r => {
            if (details[r.batch]?.students || details[r.batch]?.loading) return;
            setDetails(prev => ({ ...prev, [r.batch]: { loading: true } }));
            fetch(`${RA_BASE}/image-stats/${encodeURIComponent(r.batch)}`)
                .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load students')))
                .then(d => setDetails(prev => ({ ...prev, [r.batch]: { loading: false, students: d.students || [] } })))
                .catch(e => setDetails(prev => ({ ...prev, [r.batch]: { loading: false, error: e.message } })));
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deptFilter, yearFilter, visible]);

    // Re-read one batch straight from disk and fold the new numbers into both
    // the expanded student list and its rollup row.
    const refreshBatch = useCallback(async (batch) => {
        setDetails(prev => ({ ...prev, [batch]: { ...(prev[batch] || {}), loading: true } }));
        try {
            const res = await fetch(`${RA_BASE}/image-stats/${encodeURIComponent(batch)}?refresh=1`);
            if (!res.ok) throw new Error('Failed to load students');
            const d = await res.json();
            const students = d.students || [];
            setDetails(prev => ({ ...prev, [batch]: { loading: false, students } }));

            const totals = sumCategories(students);
            setRows(prev => prev.map(r => r.batch === batch ? {
                ...r,
                ...IMG_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: totals[c.key] }), {}),
                studentCount:       students.length,
                emptyStudents:      students.filter(s => s.total === 0).length,
                unassignedClusters: d.unassignedClusters ?? r.unassignedClusters,
                unassignedImages:   d.unassignedImages   ?? r.unassignedImages,
            } : r));
        } catch (e) {
            setDetails(prev => ({ ...prev, [batch]: { loading: false, error: e.message } }));
        }
    }, []);

    const runSearch = (raw) => {
        const q = String(raw ?? searchInput).trim();
        if (q.length < 2) {
            setSearch({ error: 'Enter at least 2 characters of a roll number' });
            return;
        }
        setSearch({ loading: true });
        fetch(`${RA_BASE}/image-stats-search?rollNo=${encodeURIComponent(q)}`)
            .then(async r => {
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || 'Search failed');
                return d;
            })
            .then(d => setSearch({ loading: false, ...d }))
            .catch(e => setSearch({ loading: false, error: e.message }));
    };

    const clearSearch = () => { setSearchInput(''); setSearch(null); };

    // After the GT modal edits a student, both the batch row and any open
    // search result need the fresh numbers.
    const handleGtClose = () => {
        const batch = gtTarget?.batch;
        setGtTarget(null);
        if (!batch) return;
        refreshBatch(batch);
        if (search?.students?.length) runSearch();
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted, fontSize: '14px' }}>Counting images…</div>
    );
    if (error) return (
        <div style={{ ...styles.card, color: '#ef4444', padding: 20, fontSize: '13px' }}>Error: {error}</div>
    );

    const allDepts = [...new Set(inScope.map(r => r.department).filter(Boolean))].sort();
    // Batch Year dropdown — mirror the ERP photo page: list configured batch
    // years from the settings API (Batch Management), falling back to any years
    // that actually have ground-truth rows on disk.
    const allYears = [...new Set([
        ...(batchYears || []),
        ...inScope.map(r => r.year).filter(Boolean),
    ])].filter(Boolean).sort().reverse();

    return (
        <div>
            {gtTarget && createPortal(
                <GTModal
                    rollNo={gtTarget.rollNo}
                    batchName={gtTarget.batch}
                    onClose={handleGtClose}
                    showToast={showToast}
                    onMoved={() => refreshBatch(gtTarget.batch)}
                />,
                document.body
            )}

            <div className="roll-page-card" style={{ ...styles.card, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {!fixedDepartment && (
                        <div style={{ minWidth: 180, flex: '1 1 180px' }}>
                            <label style={styles.label}>Department</label>
                            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setYearFilter(''); }} style={styles.select}>
                                <option value="">All departments</option>
                                {allDepts.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                            </select>
                        </div>
                    )}
                    <div style={{ minWidth: 130, flex: '0 1 150px' }}>
                        <label style={styles.label}>Batch Year</label>
                        <select
                            value={yearFilter}
                            onChange={e => setYearFilter(e.target.value)}
                            style={styles.select}
                            disabled={batchYearsLoading}
                        >
                            <option value="">{batchYearsLoading ? 'Loading…' : 'All years'}</option>
                            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div style={{ minWidth: 200, flex: '1 1 220px' }}>
                        <label style={styles.label}>Search Roll No (all batches)</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                value={searchInput}
                                onChange={e => setSearchInput(e.target.value.toUpperCase())}
                                onKeyDown={e => { if (e.key === 'Enter') runSearch(); if (e.key === 'Escape') clearSearch(); }}
                                placeholder="e.g. 22CS045"
                                style={{ ...styles.input, fontFamily: theme.fontMono }}
                            />
                            <button onClick={() => runSearch()} style={{ ...styles.btnPrimary, padding: '9px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                🔍
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => load(true)}
                        style={{ padding: '9px 18px', fontSize: '13px', fontWeight: 600, borderRadius: 7, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer' }}
                    >
                        ↻ Recount
                    </button>
                </div>

                {generatedAt && (
                    <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: 12 }}>
                        Counted from disk at {new Date(generatedAt).toLocaleString()} — click Recount for fresh numbers.
                    </div>
                )}
            </div>

            {search && (
                <SearchResults
                    search={search}
                    query={searchInput}
                    onClear={clearSearch}
                    onOpenGt={(batch, rollNo) => setGtTarget({ batch, rollNo })}
                />
            )}

            {(!deptFilter && !fixedDepartment) || !yearFilter ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                    <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: 12 }}>🗂️</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: 6 }}>Select a department and batch year to view tables</div>
                    <div style={{ fontSize: '13px', color: theme.textMuted }}>Choose both filters above to see per-student image counts.</div>
                </div>
            ) : !visible.length ? (
                <div style={{ ...styles.card, textAlign: 'center', padding: '60px 20px', borderStyle: 'dashed' }}>
                    <div style={{ fontSize: '36px', opacity: 0.3, marginBottom: 12 }}>🖼️</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: 6 }}>No ground truth images found for this batch</div>
                    <div style={{ fontSize: '13px', color: theme.textMuted }}>Pick another department or batch year.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {visible.map(r => (
                        <div key={r.batch} style={{ ...styles.card, overflow: 'hidden', padding: 0 }}>
                            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${theme.border}`, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: theme.text }}>{batchLabel(r)}</div>
                                <div style={{ fontSize: '12px', color: theme.textMuted }}>
                                    {r.studentCount} student{r.studentCount !== 1 ? 's' : ''} · {r.total} images
                                </div>
                            </div>
                            <div style={{ padding: '14px 18px' }}>
                                <StudentImageTable
                                    batch={r.batch}
                                    detail={details[r.batch]}
                                    onOpenGt={(rollNo) => setGtTarget({ batch: r.batch, rollNo })}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StudentCountCell({ category, student }) {
    const value = student[category.key] || 0;
    const color = category.key === 'total'
        ? totalCellColor(student.total || 0)
        : (value > 0 ? category.color : theme.textMuted);
    return (
        <td style={{ textAlign: 'right', color, fontWeight: value > 0 || category.key === 'total' ? 700 : 400 }}>
            {value}
        </td>
    );
}

// Roll number rendered as a link into the ground-truth modal, where the
// student's images can be moved between embedding/backup, deleted or approved.
function RollNoLink({ rollNo, onClick }) {
    return (
        <button
            onClick={onClick}
            title={`Open ground truth for ${rollNo} — update images`}
            style={{
                padding: 0, border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: theme.fontMono, fontWeight: 700, fontSize: '13px',
                color: theme.accent, textDecoration: 'underline', textUnderlineOffset: 3,
            }}
        >
            {rollNo}
        </button>
    );
}

function SearchResults({ search, query, onClear, onOpenGt }) {
    const shell = (children) => (
        <div style={{ ...styles.card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${theme.border}`, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    Search results{query ? <span style={{ fontFamily: theme.fontMono, color: theme.accent }}> · {query}</span> : null}
                </div>
                <button onClick={onClear} style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer' }}>
                    Clear
                </button>
            </div>
            {children}
        </div>
    );

    if (search.loading) return shell(<div style={{ padding: '18px', fontSize: '12px', color: theme.textMuted }}>Searching…</div>);
    if (search.error)   return shell(<div style={{ padding: '18px', fontSize: '12px', color: theme.danger }}>{search.error}</div>);

    // Fewest images first here too — a search usually means "what is thin?"
    const students = sortStudents(search.students || [], 'fewest');
    if (!students.length) return shell(<div style={{ padding: '18px', fontSize: '12px', color: theme.textMuted }}>No roll number matches this search.</div>);

    return shell(
        <>
            <div className="roll-summary-scroll">
                <table className="ams-table roll-summary-table">
                    <thead>
                        <tr>
                            <th>Roll No</th>
                            <th>Batch</th>
                            {IMG_CATEGORIES.map(c => (
                                <th key={c.key} style={{ textAlign: 'right', color: c.color }} title={c.hint}>{c.label}</th>
                            ))}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={`${s.batch}::${s.rollNo}`}>
                                <td><RollNoLink rollNo={s.rollNo} onClick={() => onOpenGt(s.batch, s.rollNo)} /></td>
                                <td style={{ fontSize: '12px', color: theme.textMuted }}>{batchLabel(s)}</td>
                                {IMG_CATEGORIES.map(c => <StudentCountCell key={c.key} category={c} student={s} />)}
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => onOpenGt(s.batch, s.rollNo)}
                                        style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        Update images →
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {search.truncated && (
                <div style={{ padding: '10px 18px', fontSize: '11px', color: theme.warning, borderTop: `1px solid ${theme.border}` }}>
                    Showing the first {students.length} of {search.totalMatches} matches — type more of the roll number to narrow it down.
                </div>
            )}
        </>
    );
}

function StudentImageTable({ batch, detail, onOpenGt }) {
    const [query,    setQuery]    = useState('');
    const [sortMode, setSortMode] = useState('fewest');

    if (!detail || detail.loading) return (
        <div style={{ fontSize: '12px', color: theme.textMuted, padding: '8px 0' }}>Loading students…</div>
    );
    if (detail.error) return (
        <div style={{ fontSize: '12px', color: theme.danger, padding: '8px 0' }}>{detail.error}</div>
    );
    if (!detail.students?.length) return (
        <div style={{ fontSize: '12px', color: theme.textMuted, padding: '8px 0' }}>No students with assigned roll numbers in this batch.</div>
    );

    const q = query.trim().toUpperCase();
    const filtered = q ? detail.students.filter(s => s.rollNo.toUpperCase().includes(q)) : detail.students;
    const students = sortStudents(filtered, sortMode);
    const lowCount = filtered.filter(s => s.total < LOW_IMAGE_THRESHOLD).length;

    const exportCsv = () => {
        const header = ['Roll No', ...IMG_CATEGORIES.map(c => c.label)];
        const lines  = [header.join(',')];
        for (const s of students) lines.push([s.rollNo, ...IMG_CATEGORIES.map(c => s[c.key] ?? 0)].join(','));
        const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }));
        const a   = document.createElement('a');
        a.href = url;
        a.download = `${batch}_image_counts.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Filter this batch by roll no…"
                    style={{ ...styles.input, maxWidth: 240, fontSize: '12px', padding: '6px 10px' }}
                />
                <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
                    {SORT_MODES.map(m => (
                        <button
                            key={m.key}
                            onClick={() => setSortMode(m.key)}
                            style={{
                                padding: '5px 12px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer',
                                background: sortMode === m.key ? theme.accent : 'transparent',
                                color:      sortMode === m.key ? '#fff' : theme.textMuted,
                            }}
                        >
                            {m.label} ↑
                        </button>
                    ))}
                </div>
                <span style={{ fontSize: '11px', color: theme.textMuted }}>
                    {students.length} of {detail.students.length} students
                    {lowCount > 0 && (
                        <span style={{ color: theme.warning, fontWeight: 700 }}> · {lowCount} under {LOW_IMAGE_THRESHOLD} images</span>
                    )}
                </span>
                <button
                    onClick={exportCsv}
                    style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: '11px', fontWeight: 600, borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer' }}
                >
                    ⬇ Export CSV
                </button>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto', border: `1px solid ${theme.border}`, borderRadius: 8 }}>
                <table className="ams-table" style={{ margin: 0 }}>
                    <thead>
                        <tr>
                            <th>Roll No</th>
                            {IMG_CATEGORIES.map(c => (
                                <th key={c.key} style={{ textAlign: 'right', color: c.color }} title={c.hint}>{c.label}</th>
                            ))}
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.rollNo}>
                                <td><RollNoLink rollNo={s.rollNo} onClick={() => onOpenGt(s.rollNo)} /></td>
                                {IMG_CATEGORIES.map(c => <StudentCountCell key={c.key} category={c} student={s} />)}
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        onClick={() => onOpenGt(s.rollNo)}
                                        style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        Update images →
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!students.length && (
                            <tr><td colSpan={IMG_CATEGORIES.length + 2} style={{ color: theme.textMuted, fontSize: '12px' }}>No roll number matches this filter.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function RollNoDropdown({ approvedRollNos, pendingRollNos }) {
    const [tab, setTab] = useState('approved');
    const list = tab === 'approved' ? approvedRollNos : pendingRollNos;
    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                    onClick={() => setTab('approved')}
                    style={{
                        padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 999,
                        border: `1px solid ${theme.success}`,
                        background: tab === 'approved' ? theme.success : 'transparent',
                        color: tab === 'approved' ? '#fff' : theme.success, cursor: 'pointer',
                    }}
                >
                    Approved ({approvedRollNos.length})
                </button>
                <button
                    onClick={() => setTab('pending')}
                    style={{
                        padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: 999,
                        border: '1px solid #f59e0b',
                        background: tab === 'pending' ? '#f59e0b' : 'transparent',
                        color: tab === 'pending' ? '#fff' : '#f59e0b', cursor: 'pointer',
                    }}
                >
                    Pending ({pendingRollNos.length})
                </button>
            </div>
            {list.length === 0 ? (
                <div style={{ fontSize: '12px', color: theme.textMuted }}>None</div>
            ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {list.map((rn) => (
                        <span key={rn} style={{
                            fontFamily: theme.fontMono, fontSize: '11px', padding: '3px 8px',
                            borderRadius: 5, background: theme.surface, border: `1px solid ${theme.border}`,
                        }}>
                            {rn}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}


// ─────────────────────────────────────────────────────────────────

function FlaggedClusterCard({ item, batchName, flagPhotoUrl, onClick, onEditRoll, onDeleteAllImages, deletingAllImages }) {
    const folder    = item.currentFolder || item.folderName;
    const flaggedAt = item.flaggedAt ? new Date(item.flaggedAt).toLocaleDateString() : '';
    return (
        <div onClick={onClick} style={{ background: theme.surface, border: `1px solid ${theme.warning}55`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.warning; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.warning + '55'; }}>
            <div style={{ display: 'flex', height: 80, background: '#000', gap: 1, overflow: 'hidden' }}>
                {(item.previewFiles || []).slice(0, 4).map((f, i) => (
                    <img key={i} src={flagPhotoUrl(batchName, folder, f)} alt="" style={{ flex: 1, height: '100%', objectFit: 'cover', minWidth: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                ))}
                {!(item.previewFiles || []).length && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: '11px' }}>No images</div>
                )}
            </div>
            <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: theme.fontMono, fontSize: '12px', fontWeight: 700, color: theme.text }}>{item.folderName}</span>
                    <span style={{ fontSize: '11px', color: theme.textMuted }}>{item.imageCount} img</span>
                </div>
                {flaggedAt && <div style={{ fontSize: '10px', color: theme.textMuted, marginBottom: 6 }}>Flagged {flaggedAt}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: 99, background: theme.warning + '22', color: theme.warning, fontWeight: 600 }}>⚑ Flagged</span>
                    <button title="Delete cluster" onClick={e => { e.stopPropagation(); onDeleteAllImages && onDeleteAllImages(); }}
                        disabled={deletingAllImages}
                        style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid #f87171', background: '#ffffff', color: '#f87171', cursor: deletingAllImages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: deletingAllImages ? 0.5 : 1 }}>
                        {deletingAllImages ? '…' : (
                            <svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

function FlagResolveModal({ item, batchName, flagPhotoUrl, flagErpPhotoUrl, rollInput, setRollInput, saving, onResolve, onClose, hasPrev, hasNext, onPrev, onNext, position, total, showToast, toast, onFolderDeleted, onPhotoDeleted }) {
    const folder     = item.currentFolder || item.folderName;
    const conf       = item.confidence;
    const candidates = item.candidates || [];

    const [editMode,       setEditMode]       = useState(false);
    const [allPhotos,      setAllPhotos]      = useState([]);
    const [loadingPhotos,  setLoadingPhotos]  = useState(false);
    const [deleting,       setDeleting]       = useState(null);
    const [deletingFolder, setDeletingFolder] = useState(false);

    useEffect(() => {
        if (!editMode) return;
        const load = async () => {
            setLoadingPhotos(true);
            try {
                const res  = await fetch(`${FLAG_BASE}/all-clusters/${batchName}`);
                const data = await res.json();
                if (res.ok) {
                    const found = (data.clusters || []).find(c => c.folderName === item.folderName || c.folderName === folder);
                    if (found) { setAllPhotos((found.imageFiles || []).map(f => typeof f === 'string' ? f : f.filename)); return; }
                }
            } catch (_) {}
            setAllPhotos(item.imageFiles?.length ? item.imageFiles : item.previewFiles || []);
        };
        load().finally(() => setLoadingPhotos(false));
    }, [editMode, batchName, item.folderName, folder, item.imageFiles, item.previewFiles]);

    const deletePhoto = async (filename) => {
        if (!window.confirm(`Delete "${filename}"?`)) return;
        setDeleting(filename);
        try {
            const res  = await fetch(`${FLAG_BASE}/cluster-photo/${encodeURIComponent(batchName)}/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            setAllPhotos(prev => prev.filter(f => f !== filename));
            onPhotoDeleted(filename);
            showToast(`Deleted ${filename}`);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setDeleting(null); }
    };

    const deleteFolder = async () => {
        if (!window.confirm(`Delete entire folder "${item.folderName}" and remove from database?\n\nThis cannot be undone.`)) return;
        setDeletingFolder(true);
        try {
            const res  = await fetch(`${FLAG_BASE}/cluster/${encodeURIComponent(batchName)}/${encodeURIComponent(item.folderName)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentFolder: folder }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted "${item.folderName}" and removed from DB`);
            onFolderDeleted();
        } catch (err) { showToast(err.message, 'error'); setDeletingFolder(false); }
    };

    useEffect(() => {
        const handler = (e) => {
            if (editMode) return;
            if (e.key === 'ArrowLeft'  && hasPrev && !saving) onPrev();
            if (e.key === 'ArrowRight' && hasNext && !saving) onNext();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [hasPrev, hasNext, saving, onPrev, onNext, onClose, editMode]);

    const navBtn = (enabled) => ({ padding: '3px 8px', borderRadius: 6, border: `1px solid ${theme.border}`, background: enabled ? theme.surface : 'transparent', color: enabled ? theme.text : theme.textMuted, cursor: enabled ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, opacity: enabled ? 1 : 0.3, lineHeight: 1 });

    return (
        <div className="roll-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {toast && <InModalToast toast={toast} />}
            <div className="roll-modal-shell" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: editMode ? 860 : 740, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'max-width 0.2s' }}>

                <div className="roll-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, gap: 8 }}>
                    {!editMode && <button onClick={onPrev} disabled={!hasPrev || saving} style={navBtn(hasPrev && !saving)}>&#8592;</button>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: theme.text, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: theme.fontMono }}>{item.folderName}</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, background: theme.warning + '22', color: theme.warning, padding: '2px 7px', borderRadius: 8 }}>Flagged</span>
                            {!editMode && total > 1 && <span style={{ marginLeft: 'auto', fontSize: '11px', color: theme.textMuted, background: theme.bg, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{position} / {total}</span>}
                            {editMode && <span style={{ marginLeft: 4, fontSize: '11px', fontWeight: 600, background: '#3f1212', color: '#f87171', padding: '2px 8px', borderRadius: 8 }}>Edit Mode</span>}
                        </div>
                    </div>
                    {editMode && <button onClick={() => setEditMode(false)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Back</button>}
                    {!editMode && <button onClick={onNext} disabled={!hasNext || saving} style={navBtn(hasNext && !saving)}>&#8594;</button>}
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '18px', cursor: 'pointer', marginLeft: 2 }}>x</button>
                </div>

                {editMode ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                        {item.suggestedRollNo && (
                            <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 8, background: '#3f1212', border: '1px solid #f87171', fontSize: '12px' }}>
                                <span style={{ color: '#f87171' }}>Rejected suggestion: </span>
                                <span style={{ color: theme.text, fontWeight: 700 }}>{item.suggestedRollNo}</span>
                                {item.confidence != null && <span style={{ color: '#f87171', marginLeft: 6 }}>({(item.confidence * 100).toFixed(0)}%)</span>}
                            </div>
                        )}
                        <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: 12 }}>
                            {loadingPhotos ? 'Loading photos…' : `${allPhotos.length} photo(s) — click the trash icon to delete from disk and DB`}
                        </div>
                        {loadingPhotos ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: theme.textMuted }}>Loading…</div>
                        ) : allPhotos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: theme.textMuted }}>No photos in this folder</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                                {allPhotos.map(filename => (
                                    <div key={filename} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}`, opacity: deleting === filename ? 0.25 : 1, transition: 'opacity 0.15s' }}>
                                        <img src={flagPhotoUrl(batchName, folder, filename)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.opacity = '0.15'; }} />
                                        <button onClick={() => deletePhoto(filename)} disabled={!!deleting} title="Delete this photo" style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 5, background: '#ffffff', border: '1.5px solid #f87171', color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                            <svg width="11" height="12" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                                        </button>
                                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '3px 5px', fontSize: '8px', color: '#ccc', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{filename}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="roll-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, alignItems: 'start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extracted Face Images</div>
                            <div className="roll-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                                {(item.imageFiles?.length > 0 ? item.imageFiles : item.previewFiles || []).map((f, i) => (
                                    <div key={f + i} style={{ position: 'relative' }}>
                                        <img src={flagPhotoUrl(batchName, folder, f)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: `1px solid ${theme.border}`, display: 'block', opacity: deleting === f ? 0.2 : 1, transition: 'opacity 0.15s' }} onError={e => { e.target.style.opacity = '0.1'; }} />
                                        <button
                                            onClick={() => {
                                                if (!window.confirm(`Delete this photo?\nRemoves from disk + database.`)) return;
                                                setDeleting(f);
                                                fetch(`${FLAG_BASE}/cluster-photo/${encodeURIComponent(batchName)}/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`, { method: 'DELETE' })
                                                    .then(r => r.json()).then(d => { if (d.ok) { onPhotoDeleted(f); showToast(`Deleted ${f}`); } else showToast(d.error || 'Delete failed', 'error'); })
                                                    .catch(err => showToast(err.message, 'error')).finally(() => setDeleting(null));
                                            }}
                                            disabled={!!deleting} title="Delete this photo"
                                            style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 5, background: '#ffffff', border: '1.5px solid #f87171', color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                            <svg width="11" height="12" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                                            </button>
                                    </div>
                                ))}
                                {!(item.previewFiles || []).length && <div style={{ gridColumn: '1 / -1', padding: '30px 0', textAlign: 'center', color: theme.textMuted, fontSize: '12px' }}>No preview images</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button onClick={() => setEditMode(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✏ Edit All Photos</button>
                                <button onClick={deleteFolder} disabled={deletingFolder} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid #f87171', background: '#ffffff', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: deletingFolder ? 'not-allowed' : 'pointer', opacity: deletingFolder ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    {deletingFolder ? 'Deleting…' : (<>
                                        <svg width="12" height="13" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                                        Delete Folder
                                    </>)}
                                </button>
                            </div>
                            <div style={{ fontSize: '10px', color: '#f8717177', textAlign: 'center' }}>Delete Folder removes all photos, DB record &amp; flag entry permanently</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {item.suggestedRollNo ? 'ERP Match (Rejected → Select New)' : 'ERP Match'}
                                </div>
                                {(() => {
                                    const selCand = candidates.find(c => c.rollNo === rollInput);
                                    const showPhoto = selCand?.erpPhoto || (rollInput === item.suggestedRollNo ? item.erpPhoto : null) || item.erpPhoto || null;
                                    const showConf  = selCand?.confidence ?? conf;
                                    const showRoll  = rollInput || item.suggestedRollNo;
                                    if (!showPhoto && !item.suggestedRollNo && candidates.length === 0) return (
                                        <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: '12px', padding: '16px 0', borderRadius: 8, background: theme.bg, border: `1px dashed ${theme.border}` }}>No ERP suggestion</div>
                                    );
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: rollInput ? theme.successDim : '#3f121255', border: `2px solid ${rollInput ? theme.success : '#f8717155'}`, transition: 'all 0.2s' }}>
                                            {showPhoto
                                                ? <img src={flagErpPhotoUrl(showPhoto)} alt="ERP" style={{ width: 68, height: 68, objectFit: 'cover', flexShrink: 0, borderRadius: 7, border: `2.5px solid ${rollInput ? theme.success : confidenceColor(showConf)}`, transition: 'all 0.2s' }} onError={e => { e.target.style.opacity = '0.3'; }} />
                                                : <div style={{ width: 68, height: 68, borderRadius: 7, flexShrink: 0, background: '#3f1212', border: '2px solid #f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#f87171', textAlign: 'center', padding: 4 }}>No photo</div>
                                            }
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 800, color: rollInput ? theme.success : '#f87171', fontFamily: theme.fontMono, textDecoration: !rollInput && item.suggestedRollNo ? 'line-through' : 'none' }}>{showRoll || '—'}</div>
                                                {showConf != null && <div style={{ fontSize: '11px', color: confidenceColor(showConf), fontWeight: 600, marginTop: 2 }}>{confidenceLabel(showConf)} · {(showConf * 100).toFixed(1)}%</div>}
                                                <div style={{ fontSize: '10px', marginTop: 2, color: rollInput ? theme.success : '#f87171', fontWeight: 600 }}>{rollInput ? '✓ Selected' : '✕ Rejected'}</div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {candidates.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidates — <span style={{ textTransform: 'none', fontWeight: 400 }}>click to select</span></div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {candidates.map((c, i) => {
                                            const isSelected = rollInput === c.rollNo;
                                            return (
                                                <div key={i} onClick={() => setRollInput(isSelected ? '' : c.rollNo)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', background: isSelected ? theme.successDim : theme.bg, border: `2px solid ${isSelected ? theme.success : theme.border}`, transition: 'all 0.15s' }}>
                                                    {c.erpPhoto && <img src={flagErpPhotoUrl(c.erpPhoto)} alt="" style={{ width: 44, height: 44, borderRadius: 5, objectFit: 'cover', flexShrink: 0, border: `2px solid ${confidenceColor(c.confidence)}` }} onError={e => { e.target.style.display = 'none'; }} />}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? theme.success : theme.text, fontFamily: theme.fontMono }}>{c.rollNo}</div>
                                                        <div style={{ fontSize: '10px', color: confidenceColor(c.confidence), fontWeight: 600, marginTop: 1 }}>{confidenceLabel(c.confidence)} · {(c.confidence * 100).toFixed(1)}%</div>
                                                    </div>
                                                    {isSelected && <span style={{ fontSize: '16px', color: theme.success, fontWeight: 900 }}>✓</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {rollInput ? (
                                <div style={{ padding: '8px 12px', borderRadius: 7, background: theme.successDim, border: `1.5px solid ${theme.success}66`, fontSize: '15px', fontWeight: 800, color: theme.success, fontFamily: theme.fontMono, textAlign: 'center' }}>
                                    {rollInput}
                                </div>
                            ) : (
                                <div style={{ padding: '8px 12px', borderRadius: 7, background: theme.border + '33', border: `1.5px dashed ${theme.border}`, fontSize: '11px', color: theme.textMuted, textAlign: 'center' }}>
                                    Select a candidate to assign
                                </div>
                            )}

                            <div style={{ marginTop: 'auto' }}>
                                <button onClick={onResolve} disabled={saving || !rollInput.trim()} style={{ width: '100%', padding: '10px 0', borderRadius: 7, border: 'none', background: theme.success, color: '#000', fontSize: '13px', fontWeight: 700, cursor: rollInput.trim() ? 'pointer' : 'not-allowed', opacity: (saving || !rollInput.trim()) ? 0.45 : 1 }}>
                                    {saving ? 'Saving…' : '✓ Assign & Resolve'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function UnapprovedPhotoCard({ rollNo, photos, stats, busy, onApprove, onApproveAll, onDelete, onDeleteAll, onClick }) {
    const allKey  = `${rollNo}::all`;
    const allBusy = !!busy[allKey];
    const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    return (
        <div 
            onClick={onClick}
            style={{ background: theme.surface, border: `1px solid ${theme.warning}55`, borderRadius: 10, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
            onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = theme.warning; }}
            onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = theme.warning + '55'; }}
        >
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: '13px', fontWeight: 700, flex: 1 }}>{rollNo}</span>
                {stats && <span style={{ fontSize: '10px', color: theme.textMuted }}>{stats.embeddingCount}E · {stats.backupCount}B · {stats.approvedCount}✓</span>}
                <button onClick={(e) => { e.stopPropagation(); onDeleteAll(); }} disabled={allBusy} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${theme.danger}`, background: 'transparent', color: theme.danger, fontSize: '11px', fontWeight: 700, cursor: allBusy ? 'not-allowed' : 'pointer', opacity: allBusy ? 0.5 : 1 }}>
                    {allBusy ? '…' : `Delete All`}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onApproveAll(); }} disabled={allBusy} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: theme.success, color: '#000', fontSize: '11px', fontWeight: 700, cursor: allBusy ? 'not-allowed' : 'pointer', opacity: allBusy ? 0.5 : 1 }}>
                    {allBusy ? '…' : `Approve All (${photos.length})`}
                </button>
            </div>
            <div style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                {photos.map(photo => {
                    const photoKey  = `${rollNo}::${photo.filename}`;
                    const photoBusy = !!busy[photoKey] || allBusy;
                    return (
                        <div key={photo.filename} style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', border: `1.5px solid ${theme.warning}55`, opacity: photoBusy ? 0.4 : 1, transition: 'opacity 0.15s' }}>
                            <img src={photo.url} alt={photo.filename} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.opacity = '0.15'; }} />
                            {photo.addedAt && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '2px 4px', fontSize: '8px', color: '#ccc', textAlign: 'center' }}>{fmtDate(photo.addedAt)}</div>}
                            <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(rollNo, photo.filename); }} disabled={photoBusy} title="Delete photo" style={{ width: 22, height: 22, borderRadius: '50%', background: theme.surface, border: `1px solid ${theme.danger}`, color: theme.danger, cursor: photoBusy ? 'not-allowed' : 'pointer', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
                                <button onClick={(e) => { e.stopPropagation(); onApprove(rollNo, photo.filename); }} disabled={photoBusy} title="Approve & add to embedding" style={{ width: 22, height: 22, borderRadius: '50%', background: theme.success, border: 'none', color: '#000', cursor: photoBusy ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✓</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Section({ title, count, accentColor, children, emptyText, rightElement }) {
    const [open, setOpen] = useState(true);
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: open ? 14 : 0 }}>
                <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ fontSize: '10px', color: accentColor, display: 'inline-block', transition: 'transform .18s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>{title}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, background: accentColor + '22', color: accentColor, padding: '2px 8px', borderRadius: 10 }}>{count}</span>
                </div>
                {rightElement && <div>{rightElement}</div>}
            </div>
            {open && (count === 0 && emptyText
                ? <div style={{ padding: '14px 16px', borderRadius: 8, fontSize: '12px', color: theme.textMuted, background: theme.surface, border: `1px dashed ${theme.border}` }}>{emptyText}</div>
                : <div className="roll-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>{children}</div>
            )}
        </div>
    );
}

// CHANGE 1+2+7+8: ClusterCard updated — no folder name for assigned, delete+edit buttons for assigned, delete for unprocessed
function ClusterCard({ item, batchName, photoUrl, erpPhotoUrl, onClick, isAssigned, isUnmatched, isUnprocessed, isMerged, disabled, stats, unapprovedCount, onDeleteFolder, deletingFolder, onDeleteAllImages, deletingAllImages, onEditRoll }) {
    const folderForPhoto = item.currentFolder || item.folderName;
    const previews       = (isAssigned && stats?.previewFiles) ? stats.previewFiles : (item.previewFiles || []);
    const borderColor    = isAssigned ? theme.success + '44' : isMerged ? theme.warning + '88' : (isUnmatched || isUnprocessed) ? theme.border + '88' : theme.border;

    return (
        <div
            onClick={disabled ? undefined : onClick}
            style={{ background: theme.surface, border: `1px solid ${borderColor}`, borderRadius: 10, opacity: disabled ? 0.6 : 1, overflow: 'hidden', cursor: disabled ? 'default' : 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = isAssigned ? theme.success : (isUnmatched || isUnprocessed) ? '#f8717155' : theme.accent; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; }}
        >
            <div style={{ display: 'flex', height: 80, overflow: 'hidden', background: '#000', gap: 1 }}>
                {previews.slice(0, 4).map((f, i) => (
                    <img key={i} src={photoUrl(batchName, folderForPhoto, f)} alt="" style={{ flex: 1, height: '100%', objectFit: 'cover', minWidth: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                ))}
                {previews.length === 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: '11px' }}>No images</div>}
            </div>

            <div style={{ padding: '10px 12px' }}>
                {/* CHANGE 1: for assigned cards, hide folder name, show only image count */}
                {!isAssigned && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontFamily: theme.fontMono, fontSize: '12px', fontWeight: 700, color: theme.text }}>{item.folderName}</span>
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>{item.imageCount} img</span>
                    </div>
                )}

                {isAssigned ? (
                    <div>
                        {/* CHANGE 1: show only roll no, no folder name */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ padding: '5px 8px', borderRadius: 5, background: theme.successDim, color: theme.success, fontSize: '13px', fontWeight: 700, flex: 1, textAlign: 'center' }}>{item.rollNo}</div>
                            <span style={{ fontSize: '11px', color: theme.textMuted, marginLeft: 8 }}>{item.imageCount} img</span>
                        </div>
                        {stats && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 99, background: theme.accentDim, color: theme.accent }}>{stats.embeddingCount} embed</span>
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 99, background: theme.warningDim, color: theme.warning }}>{stats.backupCount} backup</span>
                                {unapprovedCount > 0 && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 99, background: theme.dangerDim, color: theme.danger }}>{unapprovedCount} new</span>}
                            </div>
                        )}
                        {/* icon-only edit + delete */}
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button
                                title="Edit roll number"
                                onClick={e => { e.stopPropagation(); onEditRoll && onEditRoll(); }}
                                style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid #3b82f6', background: '#ffffff', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8.5 1.5a1.2 1.2 0 011.7 1.7L3.5 10H1.5V8L8.5 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                                    <line x1="7" y1="3" x2="9" y2="5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                </svg>
                            </button>
                            <button
                                title="Delete all images"
                                onClick={e => { e.stopPropagation(); onDeleteAllImages && onDeleteAllImages(); }}
                                disabled={deletingAllImages}
                                style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid #f87171', background: '#ffffff', color: '#f87171', cursor: deletingAllImages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, opacity: deletingAllImages ? 0.5 : 1 }}>
                                {deletingAllImages ? '…' : (
                                    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                        <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                ) : isUnmatched ? (
                    <div>
                        <div style={{ padding: '5px 8px', borderRadius: 5, background: theme.border + '44', color: theme.textMuted, fontSize: '11px', textAlign: 'center', marginBottom: 8 }}>⚠ No face detected</div>
                        <button
                            onClick={e => { e.stopPropagation(); onDeleteFolder && onDeleteFolder(); }}
                            disabled={deletingFolder}
                            style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: '1px solid #f87171', background: '#ffffff', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: deletingFolder ? 'not-allowed' : 'pointer', opacity: deletingFolder ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                            {deletingFolder ? <><Spinner /> Deleting…</> : (<><svg width="12" height="13" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>Delete Folder Permanently</>)}
                        </button>
                    </div>
                ) : isUnprocessed ? (
                    /* CHANGE 7+8: unprocessed — no roll no field, just delete button */
                    <div>
                        <div style={{ padding: '5px 8px', borderRadius: 5, background: theme.border + '44', color: theme.textMuted, fontSize: '11px', textAlign: 'center', marginBottom: 8 }}>Unprocessed</div>
                        <button
                            onClick={e => { e.stopPropagation(); onDeleteFolder && onDeleteFolder(); }}
                            disabled={deletingFolder}
                            style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: '1px solid #f87171', background: '#ffffff', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: deletingFolder ? 'not-allowed' : 'pointer', opacity: deletingFolder ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                            {deletingFolder ? <><Spinner /> Deleting…</> : (<><svg width="12" height="13" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>Delete Folder</>)}
                        </button>
                    </div>
                ) : isMerged ? (
                    <div>
                        <div style={{ padding: '5px 8px', borderRadius: 5, background: theme.warningDim, color: theme.warning, fontSize: '12px', fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>Merged → {item.rollNo}</div>
                        <div style={{ fontSize: '10px', color: theme.textMuted, textAlign: 'center' }}>{item.imageCount} new photo{item.imageCount !== 1 ? 's' : ''} — click to review</div>
                    </div>
                ) : (
                    /* CHANGE 7: pending review — no roll no input field in card, just prompt to click */
                    <div style={{ padding: '5px 8px', borderRadius: 5, background: theme.accentDim, color: theme.accent, fontSize: '12px', fontWeight: 600, textAlign: 'center' }}>
                        Click to review &amp; assign
                    </div>
                )}
            </div>
        </div>
    );
}

// CHANGE 4+9: GTModal with delete photo + move photo (embedding ↔ backup) tabs
export function GTModal({ rollNo, batchName, onClose, showToast, onMoved, embedded = false }) {
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [student,    setStudent]    = useState(null);
    const [busy,       setBusy]       = useState(null);
    const [doneSaving, setDoneSaving] = useState(false);
    const [selectedPhotos, setSelectedPhotos] = useState({});

    const togglePhotoSelection = (filename) => {
        setSelectedPhotos(prev => ({ ...prev, [filename]: !prev[filename] }));
    };

    // Once photos are on screen, later fetches refresh in place rather than
    // tearing the body down — only the very first load shows the skeleton.
    const hasLoadedRef = useRef(false);

    const fetchStudent = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true); else setLoading(true);
        try {
            const res  = await fetch(`${GT_BASE}/batches/${encodeURIComponent(batchName)}/students`);
            const data = await res.json();
            const found = (data.students || []).find(s => s.rollNo === rollNo);
            if (found) { setStudent(found); hasLoadedRef.current = true; }
            else showToast('Student not found', 'error');
        } catch { showToast('Failed to load', 'error'); }
        finally { if (silent) setRefreshing(false); else setLoading(false); }
    };

    useEffect(() => { fetchStudent({ silent: hasLoadedRef.current }); }, [rollNo, batchName]);

   const movePhoto = (filename, currentType) => {
        setStudent(prev => {
            if (!prev) return prev;
            const embFiles  = prev.embeddingFiles || [];
            const backFiles = prev.backupFiles    || [];
            const othFiles  = prev.untrackedFiles || [];

            if (currentType === 'embedding') {
                // embedding → backup
                const moved = embFiles.find(f => f.filename === filename);
                if (!moved) return prev;
                if (embFiles.length <= 1) { showToast('Must keep at least one embedding image', 'error'); return prev; }
                return { ...prev, embeddingFiles: embFiles.filter(f => f.filename !== filename), backupFiles: [...backFiles, { ...moved }] };
            } else {
                // backup/other → embedding
                if (embFiles.length >= 5) { showToast('Maximum 5 embedding images allowed', 'error'); return prev; }
                const srcArr = currentType === 'backup' ? backFiles : othFiles;
                const moved  = srcArr.find(f => f.filename === filename);
                if (!moved) return prev;
                const newBack = currentType === 'backup' ? backFiles.filter(f => f.filename !== filename) : backFiles;
                const newOth  = currentType === 'other'  ? othFiles.filter(f => f.filename !== filename)  : othFiles;
                return { ...prev, embeddingFiles: [...embFiles, { ...moved }], backupFiles: newBack, untrackedFiles: newOth };
            }
        });
    };

    const deletePhoto = async (filename) => {
        if (!window.confirm(`Delete "${filename}" from ${rollNo}?\nRemoves from disk and DB.`)) return;
        const key = `${rollNo}::${filename}`;
        setBusy(key);
        try {
            const res  = await fetch(`${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            showToast(`Deleted ${filename}`);
            setStudent(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    embeddingFiles: (prev.embeddingFiles || []).filter(f => f.filename !== filename),
                    backupFiles: (prev.backupFiles || []).filter(f => f.filename !== filename),
                    untrackedFiles: (prev.untrackedFiles || []).filter(f => f.filename !== filename)
                };
            });
        } catch (err) { showToast(err.message, 'error'); }
        finally { setBusy(null); }
    };

    const deleteAllBackups = async () => {
        const backupFiles = student?.backupFiles || [];
        if (backupFiles.length === 0) return;
        if (!window.confirm(`Delete all ${backupFiles.length} backup images from ${rollNo}?\nThis will remove them from disk and DB.`)) return;
        
        let deletedCount = 0;
        let errors = 0;
        setDoneSaving(true);
        for (const file of backupFiles) {
            const key = `${rollNo}::${file.filename}`;
            setBusy(key);
            try {
                const res = await fetch(`${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(file.filename)}`, { method: 'DELETE' });
                if (res.ok) {
                    deletedCount++;
                } else {
                    errors++;
                }
            } catch (err) {
                errors++;
            } finally {
                setBusy(null);
            }
        }
        
        showToast(`Deleted ${deletedCount} backup images${errors > 0 ? ` with ${errors} errors` : ''}`);
        setSelectedPhotos({});
        setStudent(prev => {
            if (!prev) return prev;
            return { ...prev, backupFiles: [] };
        });
        setDoneSaving(false);
    };

    const deleteSelectedBackups = async () => {
        const filesToDelete = Object.keys(selectedPhotos).filter(k => selectedPhotos[k]);
        if (filesToDelete.length === 0) return;
        if (!window.confirm(`Delete ${filesToDelete.length} selected backup images from ${rollNo}?\nThis will remove them from disk and DB.`)) return;
        
        let deletedCount = 0;
        let errors = 0;
        setDoneSaving(true);
        for (const filename of filesToDelete) {
            const key = `${rollNo}::${filename}`;
            setBusy(key);
            try {
                const res = await fetch(`${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
                if (res.ok) {
                    deletedCount++;
                } else {
                    errors++;
                }
            } catch (err) {
                errors++;
            } finally {
                setBusy(null);
            }
        }
        
        showToast(`Deleted ${deletedCount} selected images${errors > 0 ? ` with ${errors} errors` : ''}`);
        setSelectedPhotos({});
        setStudent(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                backupFiles: (prev.backupFiles || []).filter(f => !filesToDelete.includes(f.filename))
            };
        });
        setDoneSaving(false);
    };

    const handleDone = async () => {
        if (!student) return;
        const currentEmbedding = (student.embeddingFiles || []).map(f => f.filename);
        const currentBackup = (student.backupFiles || []).map(f => f.filename);
        if (currentEmbedding.length === 0) { showToast('Must keep at least one embedding image', 'error'); return; }
        setDoneSaving(true);
        try {
            const res  = await fetch(`${GT_BASE}/update-embedding`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchName, rollNo, embeddingFiles: currentEmbedding, backupFiles: currentBackup }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(`✓ Embedding approved — ${currentEmbedding.length} active`);
            onMoved && onMoved();
            onClose();
        } catch (err) { showToast(err.message, 'error'); }
        finally { setDoneSaving(false); }
    };

    const embCount   = (student?.embeddingFiles || []).length;
    const backCount  = (student?.backupFiles    || []).length;
    const othCount   = (student?.untrackedFiles || []).length;
    const totalCount = embCount + backCount + othCount;

    const photoUrl = (filename) =>
        `${GT_BASE}/photo/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}/${encodeURIComponent(filename)}`;

    const allPhotos = [...(student?.embeddingFiles || []), ...(student?.backupFiles || []), ...(student?.untrackedFiles || [])];
    let maxAddedAt = 0;
    allPhotos.forEach(p => {
        if (p.addedAt) {
            const time = new Date(p.addedAt).getTime();
            if (time > maxAddedAt) maxAddedAt = time;
        }
    });

    let hasOlderPhotos = false;
    allPhotos.forEach(p => {
        if (p.addedAt && maxAddedAt - new Date(p.addedAt).getTime() >= 30 * 1000) {
            hasOlderPhotos = true;
        }
    });

    const PhotoCard = ({ photo, type }) => {
        const busyKey = `${rollNo}::${photo.filename}`;
        const isBusy  = busy === busyKey;
        const isEmbed = type === 'embedding';
        const isOther = type === 'other';
        
        // Only highlight as NEW if there is at least one older photo to distinguish it from.
        const isNew = hasOlderPhotos && photo.addedAt && maxAddedAt > 0 && (maxAddedAt - new Date(photo.addedAt).getTime() < 30 * 1000);
        const borderC = isNew ? theme.accent : (isEmbed ? theme.success : isOther ? theme.border : theme.warning);
        
        const isSelected = selectedPhotos[photo.filename] || false;
        
        return (
            <div style={{ background: isSelected ? theme.danger + '11' : theme.bg, border: `1.5px solid ${isSelected ? theme.danger : borderC}33`, boxShadow: isNew ? `0 0 8px ${theme.accent}66` : 'none', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isBusy ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', cursor: type === 'backup' ? 'pointer' : 'default' }} onClick={() => type === 'backup' && togglePhotoSelection(photo.filename)}>
                    {isNew && (
                        <div style={{ position: 'absolute', top: 4, left: 4, background: theme.accent, color: '#fff', fontSize: 9, fontWeight: 'bold', padding: '2px 6px', borderRadius: 4, zIndex: 10, pointerEvents: 'none' }}>
                            NEW
                        </div>
                    )}
                    <img src={photoUrl(photo.filename)} alt={photo.filename} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.opacity = '0.15'; }} />
                    {type === 'backup' && (
                        <div style={{ position: 'absolute', top: isNew ? 22 : 6, left: 6 }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={(e) => { togglePhotoSelection(photo.filename); }} style={{ width: 16, height: 16, accentColor: theme.danger, cursor: 'pointer' }} />
                        </div>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deletePhoto(photo.filename); }} disabled={isBusy} title="Delete photo"
                        style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 5, background: '#ffffff', border: `1.5px solid ${theme.danger}`, color: theme.danger, cursor: isBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 3h9M4 3V2h3v1M2 3l.6 7.5a.5.5 0 00.5.5h4.8a.5.5 0 00.5-.5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            <line x1="4.5" y1="5.5" x2="4.5" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                            <line x1="6.5" y1="5.5" x2="6.5" y2="9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>
                <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }} onClick={(e) => { if (type === 'backup') e.stopPropagation(); }}>
                    <div style={{ fontSize: '9px', fontFamily: theme.fontMono, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{photo.filename}</div>
                    {photo.score != null && <span style={{ fontSize: '9px', color: theme.accent, background: theme.accentDim, padding: '1px 4px', borderRadius: 3, alignSelf: 'flex-start' }}>{photo.score.toFixed(2)}</span>}
                    {(photo.createdAt || photo.addedAt) && <div style={{ fontSize: '8px', color: theme.textMuted, opacity: 0.8 }}>{new Date(photo.createdAt || photo.addedAt).toLocaleString()}</div>}
                    <button onClick={(e) => { e.stopPropagation(); movePhoto(photo.filename, type); }} disabled={isBusy}
                        style={{ padding: '3px 0', fontSize: '9px', fontWeight: 700, background: isEmbed ? theme.warningDim : theme.successDim, color: isEmbed ? theme.warning : theme.success, border: `1px solid ${isEmbed ? theme.warning + '44' : theme.success + '44'}`, borderRadius: 4, cursor: isBusy ? 'not-allowed' : 'pointer', width: '100%' }}>
                        {isEmbed ? '→ Backup' : '↑ Embedding'}
                    </button>
                </div>
            </div>
        );
    };

    const SectionRow = ({ label, color, bg, photos, type, empty, onDeleteAll }) => {
        const selectedCount = type === 'backup' ? Object.keys(selectedPhotos).filter(k => selectedPhotos[k]).length : 0;
        return (
            <div style={{ marginBottom: 20 }}>
                <div className="roll-section-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${color}33` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                        <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: 99, background: bg, color, fontWeight: 700 }}>{photos.length}</span>
                    </div>
                    <div className="roll-section-actions" style={{ display: 'flex', gap: 8 }}>
                        {selectedCount > 0 && (
                            <button onClick={deleteSelectedBackups} disabled={doneSaving} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, border: `1px solid ${theme.danger}`, background: theme.danger, color: '#fff', cursor: doneSaving ? 'not-allowed' : 'pointer', opacity: doneSaving ? 0.5 : 1 }}>
                                Delete Selected ({selectedCount})
                            </button>
                        )}
                        {onDeleteAll && photos.length > 0 && (
                            <button onClick={onDeleteAll} disabled={doneSaving} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, border: `1px solid ${theme.danger}`, background: 'transparent', color: theme.danger, cursor: doneSaving ? 'not-allowed' : 'pointer', opacity: doneSaving ? 0.5 : 1 }}>
                                Delete All
                            </button>
                        )}
                    </div>
                </div>
                {photos.length === 0
                    ? <div style={{ fontSize: '12px', color: theme.textMuted, padding: '10px 0' }}>{empty}</div>
                    : <div className="roll-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                        {photos.map(p => <PhotoCard key={p.filename} photo={p} type={type} />)}
                      </div>
                }
            </div>
        );
    };

    // Mirrors SectionRow's heading + grid so the modal opens at roughly its
    // final height instead of a short shell that snaps taller once photos land.
    const SkeletonRow = ({ label, color, bg, tiles }) => (
        <div style={{ marginBottom: 20 }}>
            <div className="roll-section-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${color}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                    <span className="roll-skeleton" style={{ display: 'inline-block', width: 22, height: 16, borderRadius: 99, background: bg }} />
                </div>
            </div>
            <div className="roll-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                {Array.from({ length: tiles }).map((_, i) => (
                    <div key={i} className="roll-skeleton" style={{ aspectRatio: '1', borderRadius: 8, background: theme.bg, border: `1.5px solid ${theme.border}` }} />
                ))}
            </div>
        </div>
    );

    const modalContent = (
        <div className="roll-modal-shell" style={{ background: theme.surface, border: embedded ? 'none' : `1px solid ${theme.border}`, borderRadius: embedded ? 0 : 12, width: '100%', height: embedded ? '100%' : 'auto', maxWidth: embedded ? '100%' : 960, maxHeight: embedded ? '100%' : '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div className="roll-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, flexShrink: 0 }}>
                    <div className="roll-modal-header-main" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: '15px' }}>Ground Truth — <span style={{ fontFamily: theme.fontMono }}>{rollNo}</span></span>
                        {refreshing && <span className="roll-refresh-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: theme.accent, display: 'inline-block' }} />}
                        {student && (
                            <div style={{ display: 'flex', gap: 6 }}>
                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 99, background: theme.successDim, color: theme.success, fontWeight: 700 }}>{embCount} embedding</span>
                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 99, background: theme.warningDim, color: theme.warning, fontWeight: 700 }}>{backCount} backup</span>
                                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 99, background: theme.border, color: theme.textMuted, fontWeight: 700 }}>{totalCount} total</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>

                {/* Body */}
                <div className="roll-modal-body" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'grid', gridTemplateColumns: '1fr 220px', gap: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {loading && (
                            <>
                                <SkeletonRow label="Embedding" color={theme.success} bg={theme.successDim} tiles={3} />
                                <SkeletonRow label="Backup"    color={theme.warning} bg={theme.warningDim} tiles={6} />
                            </>
                        )}

                        {!loading && !student && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: theme.textMuted }}>Could not load photos for this student</div>
                        )}

                        {!loading && student && totalCount === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: theme.textMuted }}>No photos found</div>
                        )}

                        {!loading && student && (
                            <>
                                <SectionRow label="Embedding" color={theme.success} bg={theme.successDim}
                                    photos={student.embeddingFiles || []} type="embedding"
                                    empty="No embedding images — move some from Backup" />
                                <SectionRow label="Backup" color={theme.warning} bg={theme.warningDim}
                                    photos={student.backupFiles || []} type="backup"
                                    empty="No backup images" onDeleteAll={deleteAllBackups} />
                                {othCount > 0 && (
                                    <SectionRow label="Other" color={theme.textMuted} bg={theme.border}
                                        photos={student.untrackedFiles || []} type="other"
                                        empty="" />
                                )}
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textMuted, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${theme.border}`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ERP Reference</div>
                        <div style={{ background: theme.bg, borderRadius: 8, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                            <img src={`${RA_BASE}/erp-photo-by-roll/${encodeURIComponent(batchName)}/${encodeURIComponent(rollNo)}`}
                                 style={{ width: '100%', display: 'block', objectFit: 'cover' }}
                                 onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} alt="ERP" />
                            <div style={{ display: 'none', padding: '40px 20px', textAlign: 'center', color: theme.textMuted, fontSize: '12px' }}>
                                <div style={{ fontSize: '24px', marginBottom: 8, opacity: 0.3 }}>📷</div>
                                No ERP photo found
                            </div>
                        </div>
                    </div>
                </div>

               {/* Footer */}
                <div className="roll-modal-footer" style={{ padding: '14px 20px', borderTop: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', color: theme.textMuted }}>
                        {student ? `${embCount} embedding · ${backCount} backup` : ''}
                    </span>
                    <div className="roll-modal-actions" style={{ display: 'flex', gap: 10 }}>
                        {!embedded && <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 7, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', cursor: 'pointer' }}>Close</button>}
                        <button onClick={handleDone} disabled={doneSaving || !student} style={{ padding: '8px 24px', borderRadius: 7, border: 'none', background: theme.success, color: '#000', fontSize: '13px', fontWeight: 700, cursor: (doneSaving || !student) ? 'not-allowed' : 'pointer', opacity: (doneSaving || !student) ? 0.5 : 1 }}>
                            {doneSaving ? 'Saving…' : '✓ Done'}
                        </button>
                    </div>
                </div>
            </div>
        );

    if (embedded) return modalContent;

    return (
        <div className="roll-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.80)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, paddingTop: 72 }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {modalContent}
        </div>
    );
}

function InModalToast({ toast }) {
    const accent = toast.type === 'success' ? '#22c55e' : toast.type === 'flag' ? '#f59e0b' : '#ef4444';
    const label  = toast.type === 'success' ? 'Success' : toast.type === 'flag' ? 'Flagged' : 'Error';
    return (
        <>
        <style>{`
            @keyframes slideDown {
                from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `}</style>
        <div className="roll-toast" style={{
           position: 'fixed', top: 96, left: '50%',
            zIndex: 9000, pointerEvents: 'none',
            animation: 'slideDown 0.22s cubic-bezier(0.16,1,0.3,1)',
            minWidth: 300, maxWidth: 400,
            background: accent,
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
            border: 'none',
            padding: '12px 20px',
        }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>{toast.msg}</div>
        </div>
        </>
    );
}

function VerifyModal({ item, match, batchName, photoUrl, erpPhotoUrl, overrideRoll, setOverrideRoll, saving, onApprove, onFlag, onClose, hasPrev, hasNext, onPrev, onNext, position, total, toast, showToast, onPhotoDeleted }) {
    const conf           = match?.confidence;
    const allCandidates  = match?.candidates || [];
    const candMap        = {};
    allCandidates.forEach(c => { candMap[c.rollNo] = c; });
    const primaryMatch   = allCandidates[0] || (match?.rollNo ? match : null);
    const otherCands     = allCandidates.slice(1);
    const displayPhoto   = match?.erpPhoto || primaryMatch?.erpPhoto || null;
    const displayConf    = conf;
    const displayRoll    = match?.rollNo || primaryMatch?.rollNo || null;
    const folderForPhoto = item.currentFolder || item.folderName;
    const [candOpen, setCandOpen] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const photos = item.imageFiles?.length > 0 ? item.imageFiles : item.previewFiles || [];

    const deletePhoto = async (filename) => {
        if (!window.confirm(`Delete this photo?\nRemoves from disk + database.`)) return;
        setDeleting(filename);
        try {
            const res  = await fetch(`${RA_BASE}/cluster-photo/${encodeURIComponent(item._id)}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Delete failed');
            onPhotoDeleted(filename);
            showToast(`Deleted ${filename}`);
        } catch (err) { showToast(err.message, 'error'); }
        finally { setDeleting(null); }
    };
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'ArrowLeft'  && hasPrev && !saving) onPrev();
            if (e.key === 'ArrowRight' && hasNext && !saving) onNext();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [hasPrev, hasNext, saving, onPrev, onNext, onClose]);
    const navBtn = (enabled) => ({ padding: '3px 8px', borderRadius: 6, border: `1px solid ${theme.border}`, background: enabled ? theme.surface : 'transparent', color: enabled ? theme.text : theme.textMuted, cursor: enabled ? 'pointer' : 'default', fontSize: '13px', fontWeight: 700, opacity: enabled ? 1 : 0.3, lineHeight: 1 });
    return (
        <div className="roll-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 64, paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {toast && <InModalToast toast={toast} />}
            <div className="roll-modal-shell" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className="roll-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, gap: 8, flexShrink: 0 }}>
                    <button onClick={onPrev} disabled={!hasPrev || saving} style={navBtn(hasPrev && !saving)}>&#8592;</button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: theme.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: theme.fontMono }}>{item.folderName}</span>
                            <span style={{ fontSize: '11px', color: theme.textMuted, fontWeight: 400 }}>{photos.length} imgs</span>
                            {total > 1 && <span style={{ marginLeft: 'auto', fontSize: '10px', color: theme.textMuted, background: theme.bg, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{position} / {total}</span>}
                        </div>
                    </div>
                    <button onClick={onNext} disabled={!hasNext || saving} style={navBtn(hasNext && !saving)}>&#8594;</button>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '18px', cursor: 'pointer', marginLeft: 2 }}>×</button>
                </div>
                <div className="roll-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 250px', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: theme.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extracted Face Images</div>
                        <div className="roll-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                            {photos.map((f, i) => (
                                <div key={f + i} style={{ position: 'relative' }}>
                                    <img src={photoUrl(batchName, folderForPhoto, f)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6, border: `1px solid ${theme.border}`, display: 'block', opacity: deleting === f ? 0.2 : 1, transition: 'opacity 0.15s' }} onError={e => { e.target.style.display = 'none'; }} />
                                    <button
                                        onClick={() => deletePhoto(f)}
                                        disabled={!!deleting} title="Delete this photo"
                                        style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 5, background: '#ffffff', border: '1.5px solid #f87171', color: '#f87171', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                        <svg width="10" height="11" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                                    </button>
                                </div>
                            ))}
                            {photos.length === 0 && <div style={{ gridColumn: '1 / -1', padding: '20px 0', textAlign: 'center', color: theme.textMuted, fontSize: '12px' }}>No preview images</div>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: theme.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ERP Match</div>
                            {displayPhoto ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: theme.bg, border: `2px solid ${confidenceColor(displayConf) + '55'}` }}>
                                    <img src={erpPhotoUrl(displayPhoto)} alt="ERP" style={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0, borderRadius: 6, border: `2.5px solid ${confidenceColor(displayConf)}` }} onError={e => { e.target.style.opacity = '0.3'; }} />
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: theme.text, fontFamily: theme.fontMono }}>{displayRoll || '—'}</div>
                                        {displayConf != null && <div style={{ fontSize: '11px', color: confidenceColor(displayConf), fontWeight: 600, marginTop: 3 }}>{confidenceLabel(displayConf)} · {(displayConf * 100).toFixed(1)}%</div>}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: '12px', padding: '10px 0', borderRadius: 8, background: theme.bg, border: `1px dashed ${theme.border}` }}>No ERP match</div>
                            )}
                        </div>
                        {allCandidates.length > 0 && (
                            <div style={{ borderRadius: 8, border: `1px solid ${theme.border}`, overflow: 'hidden' }}>
                                <button onClick={() => setCandOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: theme.bg, border: 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <span>Candidates ({allCandidates.length})</span>
                                    <span style={{ fontSize: '9px', transition: 'transform 0.2s', display: 'inline-block', transform: candOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                                </button>
                                {candOpen && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '6px' }}>
                                        {allCandidates.map((c, i) => {
                                            const isSel = overrideRoll === c.rollNo;
                                            return (
                                                <div key={i} onClick={() => setOverrideRoll(isSel ? '' : c.rollNo)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 6, cursor: 'pointer', background: isSel ? theme.successDim : theme.surface, border: `2px solid ${isSel ? theme.success : theme.border}`, transition: 'all 0.15s' }}>
                                                    {c.erpPhoto && <img src={erpPhotoUrl(c.erpPhoto)} alt="" style={{ width: 34, height: 34, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: `2px solid ${confidenceColor(c.confidence)}` }} onError={e => { e.target.style.display = 'none'; }} />}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, color: isSel ? theme.success : theme.text, fontFamily: theme.fontMono }}>{c.rollNo}</div>
                                                        <div style={{ fontSize: '10px', color : confidenceColor(c.confidence), fontWeight: 600 }}>{confidenceLabel(c.confidence)} · {(c.confidence * 100).toFixed(1)}%</div>
                                                    </div>
                                                    {isSel && <span style={{ fontSize: '13px', color: theme.success, fontWeight: 900 }}>✓</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: theme.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Roll Number</div>
                            <input
                                value={overrideRoll}
                                onChange={e => setOverrideRoll(e.target.value.toUpperCase())}
                                placeholder="Select candidate or type roll no."
                                style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${overrideRoll.trim() ? theme.success : theme.border}`, background: overrideRoll.trim() ? theme.successDim : theme.bg, color: overrideRoll.trim() ? theme.success : theme.text, fontSize: '14px', fontWeight: 800, fontFamily: theme.fontMono, outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                            <button onClick={onApprove} disabled={saving || !overrideRoll.trim()} style={{ padding: '9px 0', borderRadius: 7, border: 'none', background: theme.success, color: '#000', fontSize: '13px', fontWeight: 700, cursor: overrideRoll.trim() ? 'pointer' : 'not-allowed', opacity: (saving || !overrideRoll.trim()) ? 0.45 : 1 }}>
                                {saving ? 'Assigning...' : 'Approve & Assign'}
                            </button>
                            <button onClick={onFlag} disabled={saving} style={{ padding: '9px 0', borderRadius: 7, border: `1px solid ${theme.warning}`, background: 'transparent', color: theme.warning, fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                                Flag as Incorrect
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CrossDeptCard({ item, batchName, photoUrl, saving, onApprove, onDeleteFolder, deletingFolder, onClick }) {
    const folderForPhoto = item.currentFolder || item.folderName;
    const previews       = item.previewFiles || [];

    return (
        <div style={{
            background: theme.surface,
            border: `1px solid #a78bfa55`,
            borderRadius: 10,
            overflow: 'hidden',
            transition: 'border-color 0.15s',
            cursor: onClick ? 'pointer' : 'default'
        }}
            onClick={onClick}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#a78bfa'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#a78bfa55'; }}
        >
            {/* Preview strip */}
            <div style={{ display: 'flex', height: 80, overflow: 'hidden', background: '#000', gap: 1 }}>
                {previews.slice(0, 4).map((f, i) => (
                    <img key={i} src={photoUrl(batchName, folderForPhoto, f)} alt="" style={{ flex: 1, height: '100%', objectFit: 'cover', minWidth: 0 }} onError={e => { e.target.style.display = 'none'; }} />
                ))}
                {previews.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, fontSize: '11px' }}>No images</div>
                )}
            </div>

            <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: theme.fontMono, fontSize: '12px', fontWeight: 700, color: theme.text }}>{item.folderName}</span>
                    <span style={{ fontSize: '11px', color: theme.textMuted }}>{item.imageCount} img</span>
                </div>

                {/* Badge */}
                <div style={{ marginBottom: 8, padding: '3px 8px', borderRadius: 5, background: '#a78bfa22', color: '#a78bfa', fontSize: '11px', fontWeight: 600, textAlign: 'center' }}>
                    👤 Face found — no ERP match (different dept?)
                    {item.confidence != null && (
                        <span style={{ marginLeft: 6, fontSize: '10px', fontWeight: 400, color: '#c4b5fd' }}>
                            best guess: {(item.confidence * 100).toFixed(0)}%
                        </span>
                    )}
                </div>

                {/* Delete */}
                <button
                    onClick={e => { e.stopPropagation(); onDeleteFolder && onDeleteFolder(); }}
                    disabled={deletingFolder}
                    style={{
                        width: '100%', padding: '6px 0', borderRadius: 6,
                        border: '1px solid #f87171', background: '#ffffff',
                        color: '#f87171', fontSize: '11px', fontWeight: 700,
                        cursor: deletingFolder ? 'not-allowed' : 'pointer',
                        opacity: deletingFolder ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                >
                    {deletingFolder ? 'Deleting…' : (
                        <><svg width="11" height="12" viewBox="0 0 12 13" fill="none"><path d="M1.5 3.5h9M4.5 3.5V2.5h3v1M3 3.5l.6 7.5a.5.5 0 00.5.5h3.8a.5.5 0 00.5-.5L9 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="5" y1="6" x2="5" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>Delete Folder</>
                    )}
                </button>
            </div>
        </div>
    );
}

function Spinner() {
    return (
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #f8717144', borderTopColor: '#f87171', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </span>
    );
}
