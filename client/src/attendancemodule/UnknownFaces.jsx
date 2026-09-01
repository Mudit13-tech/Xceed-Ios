import { useState, useEffect, useMemo } from 'react';
import getEnvironment from '../getenvironment';
import { theme, styles, cssReset, DEGREES, YEARS, API_BASE as GT_API_BASE } from './config';
import { useDepartments } from './useDepartments';
import PipelineStageNote from './PipelineStageNote';
import { GTModal } from './rollassign';

const apiUrl = getEnvironment();
const API_BASE = `${apiUrl}/attendancemodule/unknown-faces`;
const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

// Roll numbers mix letters and digits ("22CS7" must sort before "22CS10"), so
// compare with numeric collation instead of plain string order.
const rollCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Clusters that were never matched to a student have no roll number — they sort
// to the end so the identified ones read as one clean ascending list.
const compareByRollNo = (a, b) => {
    const ra = (a.closestRollNo || '').trim();
    const rb = (b.closestRollNo || '').trim();
    if (!ra && !rb) return rollCollator.compare(a.clusterPath || '', b.clusterPath || '');
    if (!ra) return 1;
    if (!rb) return -1;
    return rollCollator.compare(ra, rb) || rollCollator.compare(a.clusterPath || '', b.clusterPath || '');
};

export default function UnknownFaces({ embedded = false, defaultDate = '', defaultDept = '', fixedDept = '' }) {
    const [clusters, setClusters] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [editModal, setEditModal] = useState({ open: false, clusterPath: null, currentRollNo: '' });
    const [galleryModal, setGalleryModal] = useState({ open: false, cluster: null });

    // Filters
    const [filterDate, setFilterDate] = useState(defaultDate);
    const [filterDept, setFilterDept] = useState(fixedDept || defaultDept);
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');

    const { departments, deptLoading, deptError } = useDepartments();

    // Search is client-side over the already-fetched clusters, then the result is
    // ordered by roll number.
    const visibleClusters = useMemo(() => {
        const q = search.trim().toLowerCase();
        const matched = !q
            ? clusters
            : clusters.filter((c) =>
                [
                    c.closestRollNo,
                    c.closestStudentName,
                    c.department,
                    c.year,
                    c.room,
                    c.subjectCode,
                    c.slot,
                    c.status,
                    c.failureReason,
                    c.date || c.createdAt?.split('T')[0],
                ]
                    .filter(Boolean)
                    .some((f) => String(f).toLowerCase().includes(q)),
            );
        return [...matched].sort(compareByRollNo);
    }, [clusters, search]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchClusters = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterDate) params.append('date', filterDate);
            if (filterDept) params.append('department', filterDept);
            if (filterStatus) params.append('status', filterStatus);

            const res = await fetch(`${API_BASE}?${params}`);
            const data = await res.json();
            
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                setClusters(data.clusters || []);
                setStats(data.stats);
            }
        } catch (error) {
            showToast('Failed to fetch data', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchClusters();
    }, [filterDate, filterDept, filterStatus]);

    const updateStatus = async (clusterPath, newStatus) => {
        try {
            const res = await fetch(`${API_BASE}/cluster/${encodePath(clusterPath)}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to update status');
            
            showToast(`Marked as ${newStatus}`);
            fetchClusters();
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const deleteCluster = async (clusterPath) => {
        if (!window.confirm('Delete this cluster forever?')) return;
        try {
            const res = await fetch(`${API_BASE}/cluster/${encodePath(clusterPath)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to delete cluster');
            
            showToast('Cluster deleted');
            fetchClusters();
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    const downloadCluster = (clusterPath) => {
        window.open(`${API_BASE}/cluster/${encodePath(clusterPath)}/download`, '_blank');
    };

    const openEditModal = (clusterPath, currentRollNo) => {
        setEditModal({ open: true, clusterPath, currentRollNo: currentRollNo || '' });
    };

    const saveEditRollNo = async () => {
        const { clusterPath, currentRollNo } = editModal;
        const newRoll = currentRollNo.trim();
        if (!newRoll) {
            setEditModal({ open: false });
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/cluster/${encodePath(clusterPath)}/rollno`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollNo: newRoll })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            showToast('Roll No updated & saved to Ground Truth!');
            fetchClusters();
        } catch (error) {
            showToast(error.message, 'error');
        }
        setEditModal({ open: false });
    };

    return (
        <div style={embedded ? {} : styles.page}>
            {!embedded && <style>{cssReset}</style>}
            
            {toast && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 9999,
                    padding: '12px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                    animation: 'fadeIn 0.3s',
                    background: toast.type === 'error' ? theme.dangerDim  : theme.successDim,
                    color:      toast.type === 'error' ? theme.danger      : theme.success,
                    border: `1px solid ${toast.type === 'error' ? theme.danger : theme.success}`,
                }}>{toast.msg}</div>
            )}

            {!embedded && (
                <div style={{ marginBottom: 24 }}>
                    <div style={styles.heading}>Unknown Faces Debug</div>
                    <div style={styles.subheading}>
                        Faces detected cleanly during live attendance that matched no enrolled student
                    </div>
                </div>
            )}

            {/* Names this page's pipeline stage so it can't be confused with the
                detector-stage rejects, which never reached matching at all. */}
            <PipelineStageNote stage="matching" />

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: 'Total', val: stats.totalClusters ?? stats.total, color: theme.text },
                        { label: 'New Today', val: stats.newToday, color: theme.accent },
                        { label: 'Reviewed', val: stats.reviewedCount ?? stats.reviewed, color: theme.success },
                        { label: 'Archived', val: stats.archivedCount ?? stats.archived, color: theme.textMuted },
                        { label: 'Avg Similarity', val: `${Math.round((stats.avgConfidence || 0) * 100)}%`, color: theme.warning }
                    ].map(s => (
                        <div key={s.label} style={{ ...styles.card, textAlign: 'center', padding: '16px' }}>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, fontFamily: theme.fontMono }}>{s.val}</div>
                            <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ ...styles.card, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 260px', minWidth: 220 }}>
                    <label style={{ fontSize: '11px', color: theme.textMuted, display: 'block', marginBottom: 4 }}>Search</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            type="search"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Roll no, name, room, subject, reason…"
                            style={{ ...styles.input, padding: '8px 28px 8px 8px', fontSize: '13px' }}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                title="Clear search"
                                style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
                            >&times;</button>
                        )}
                    </div>
                </div>
                <div>
                    <label style={{ fontSize: '11px', color: theme.textMuted, display: 'block', marginBottom: 4 }}>Date</label>
                    <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...styles.input, padding: '8px', fontSize: '13px' }} />
                </div>
                <div>
                    <label style={{ fontSize: '11px', color: theme.textMuted, display: 'block', marginBottom: 4 }}>Status</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...styles.select, padding: '8px', fontSize: '13px' }}>
                        <option value="">All Statuses</option>
                        <option value="NEW">New</option>
                        <option value="REVIEWED">Reviewed</option>
                        <option value="ARCHIVED">Archived</option>
                    </select>
                </div>
                <div>
                    <label style={{ fontSize: '11px', color: theme.textMuted, display: 'block', marginBottom: 4 }}>Department</label>
                    {fixedDept ? (
                        <div style={{ ...styles.select, padding: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', background: theme.surfaceAlt, color: theme.textMuted, cursor: 'not-allowed' }}>
                            {fixedDept.replace(/_/g, ' ')}
                        </div>
                    ) : (
                        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...styles.select, padding: '8px', fontSize: '13px' }} disabled={deptLoading}>
                            <option value="">{deptLoading ? 'Loading...' : deptError ? 'Error' : 'All Departments'}</option>
                            {departments.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                        </select>
                    )}
                </div>
                <button onClick={() => { setFilterDate(''); setFilterDept(fixedDept || ''); setFilterStatus(''); setSearch(''); }} style={{ ...styles.btnGhost, marginTop: 18 }}>Clear Filters</button>
            </div>

            {!loading && clusters.length > 0 && (
                <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: 12 }}>
                    Showing {visibleClusters.length} of {clusters.length} cluster{clusters.length === 1 ? '' : 's'}, sorted by roll number
                </div>
            )}

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted }}>Loading...</div>
            ) : visibleClusters.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, ...styles.card }}>
                    {clusters.length === 0 ? 'No unknown faces found.' : `No clusters match "${search}".`}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {visibleClusters.map((c, i) => (
                        <div key={c.clusterPath || i} style={{ ...styles.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ fontSize: '12px', color: theme.textMuted, fontFamily: theme.fontMono }}>
                                    {c.date || c.createdAt?.split('T')[0]} • {c.slot}
                                </div>
                                <span style={{
                                    ...styles.badge(c.status === 'NEW' ? 'warning' : c.status === 'REVIEWED' ? 'success' : 'default'),
                                    fontSize: '10px'
                                }}>{c.status || 'NEW'}</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div 
                                    onClick={() => setGalleryModal({ open: true, cluster: c })}
                                    style={{ position: 'relative', width: 80, height: 80, cursor: 'pointer' }}
                                >
                                    <img 
                                        src={`${API_BASE}/image/${encodePath(c.clusterPath)}/representative.jpg`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, background: '#f0f0f0' }}
                                        alt="Representative"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    {c.images && c.images.length > 1 && (
                                        <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                                            +{c.images.length - 1}
                                        </div>
                                    )}
                                </div>
                                <div style={{ flex: 1, fontSize: '12px', lineHeight: 1.5 }}>
                                    <div><strong>{c.department}</strong> {c.year} • {c.subjectCode || 'No Subject'}</div>
                                    <div>Room: {c.room}</div>
                                    <div style={{ color: theme.danger, fontWeight: 600, marginTop: 4 }}>
                                        {c.failureReason || 'UNKNOWN_REASON'}
                                    </div>
                                    {c.closestRollNo ? (
                                        <div style={{ marginTop: 4 }}>
                                            <span style={{ color: theme.textMuted }}>Closest: </span>
                                            <strong style={{ fontFamily: theme.fontMono }}>{c.closestRollNo}</strong>
                                            <button 
                                                onClick={() => openEditModal(c.clusterPath, c.closestRollNo)}
                                                style={{ marginLeft: 6, background: 'none', border: 'none', color: theme.accent, cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                                            >
                                                Edit
                                            </button>
                                            <div style={{ color: theme.textMuted, fontSize: '11px' }}>{c.closestStudentName || 'Unknown Name'}</div>
                                            <div style={{ fontSize: '11px', color: theme.warning }}>
                                                Sim: {Math.round(c.bestSimilarity * 100)}% (Req: {Math.round(c.recognitionThreshold * 100)}%)
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: 8 }}>
                                            <button 
                                                onClick={() => openEditModal(c.clusterPath, '')}
                                                style={{ ...styles.btnGhost, padding: '4px 10px', fontSize: '11px' }}
                                            >
                                                Assign Roll No
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                                {c.status !== 'REVIEWED' && (
                                    <button 
                                        onClick={() => {
                                            updateStatus(c.clusterPath, 'REVIEWED');
                                            setGalleryModal({ open: true, cluster: c });
                                        }} 
                                        style={{ ...styles.btnPrimary, flex: 1, padding: '6px', fontSize: '11px' }}
                                    >
                                        Review
                                    </button>
                                )}
                                {c.status !== 'ARCHIVED' && (
                                    <button onClick={() => updateStatus(c.clusterPath, 'ARCHIVED')} style={{ ...styles.btnGhost, flex: 1, padding: '6px', fontSize: '11px' }}>Archive</button>
                                )}
                                <button onClick={() => downloadCluster(c.clusterPath)} style={{ ...styles.btnGhost, padding: '6px 10px', fontSize: '11px' }}>ZIP</button>
                                <button onClick={() => deleteCluster(c.clusterPath)} style={{ ...styles.btnDanger, padding: '6px 10px', fontSize: '11px' }}>Del</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editModal.open && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ ...styles.card, padding: 24, width: 320 }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: theme.text }}>Edit Roll Number</h3>
                        <input 
                            autoFocus
                            type="text" 
                            value={editModal.currentRollNo} 
                            onChange={e => setEditModal({...editModal, currentRollNo: e.target.value})} 
                            style={{ ...styles.input, width: '100%', marginBottom: 16 }} 
                            placeholder="Enter Roll Number"
                        />
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditModal({ open: false })} style={{ ...styles.btnGhost, padding: '8px 16px' }}>Cancel</button>
                            <button onClick={saveEditRollNo} style={{ ...styles.btnPrimary, padding: '8px 16px' }}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {galleryModal.open && galleryModal.cluster && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', zIndex: 999999, padding: 20 }}>
                    <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
                        <button onClick={() => setGalleryModal({ open: false, cluster: null })} style={{ background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                            <span style={{ fontSize: '20px', lineHeight: 1 }}>&times;</span> Close Gallery
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', width: '100%', height: '100%', gap: 20, paddingTop: 40 }}>
                        {/* LEFT: GROUND TRUTH */}
                        <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.2)', paddingRight: 20, overflowY: 'auto' }}>
                             {galleryModal.cluster.closestRollNo ? (
                                 <GTModal 
                                     rollNo={galleryModal.cluster.closestRollNo} 
                                     batchName={`${galleryModal.cluster.degree}_${galleryModal.cluster.department}_${galleryModal.cluster.year}`.toUpperCase()} 
                                     onClose={() => {}} 
                                     showToast={showToast} 
                                     embedded={true} 
                                 />
                             ) : (
                                 <div style={{ color: '#fff', textAlign: 'center', marginTop: 40 }}>
                                    <h2 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Ground Truth</h2>
                                    <p style={{ opacity: 0.8 }}>No closest Roll No assigned</p>
                                 </div>
                             )}
                        </div>

                        {/* RIGHT: UNKNOWN FACES */}
                        <div style={{ flex: 1, overflowY: 'auto', paddingLeft: 20 }}>
                            <div style={{ color: '#fff', marginBottom: 20, textAlign: 'center' }}>
                                <h2 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Unknown Cluster Images</h2>
                                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                                    {galleryModal.cluster.department} • {galleryModal.cluster.date || galleryModal.cluster.createdAt?.split('T')[0]} • {galleryModal.cluster.slot}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', maxWidth: '100%', padding: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {(galleryModal.cluster.images || ['representative.jpg']).map((imgName, idx) => (
                                    <div key={idx} style={{ background: '#000', borderRadius: 8, overflow: 'hidden', border: imgName === 'representative.jpg' ? `2px solid ${theme.accent}` : '2px solid transparent' }}>
                                        <img 
                                            src={`${API_BASE}/image/${encodePath(galleryModal.cluster.clusterPath)}/${imgName}`} 
                                            style={{ height: 200, width: 'auto', objectFit: 'contain', display: 'block' }} 
                                            alt="Cluster crop" 
                                        />
                                        {imgName === 'representative.jpg' && (
                                            <div style={{ textAlign: 'center', fontSize: '11px', padding: '4px', background: theme.accent, color: '#fff', fontWeight: 600 }}>Representative</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


