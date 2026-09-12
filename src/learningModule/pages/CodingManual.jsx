import { useState, useEffect } from 'react';
import getEnvironment from '../../getenvironment';
import { LmIcon } from '../components/Icon';

import shotList from '../manualAssets/notebooks/list.png';
import shotEditor from '../manualAssets/notebooks/editor.png';
import shotPlayer from '../manualAssets/notebooks/player.png';
import shotSubmissions from '../manualAssets/notebooks/submissions.png';
import shotSubmissionDetail from '../manualAssets/notebooks/submission-detail.png';
import shotEditorCell from '../manualAssets/notebooks/editor-cell.png';
import shotEditorTransfer from '../manualAssets/notebooks/editor-transfer.png';
import shotPlayerTests from '../manualAssets/notebooks/player-tests.png';
import shotPlayerFullscreen from '../manualAssets/notebooks/player-fullscreen.png';
import shotPlayerLeftFullscreen from '../manualAssets/notebooks/player-left-fullscreen.png';
import shotSubmissionIntegrity from '../manualAssets/notebooks/submission-integrity.png';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#1d4ed8',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
    purple: '#7c3aed', purpleBg: '#faf5ff', purpleBorder: '#e9d5ff',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; color: #1e293b; padding: 1px 5px; border-radius: 4px; }
    pre code, .cdm-code-block code, pre { background: transparent !important; padding: 0 !important; border-radius: 0 !important; }
    .cdm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cdm-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .cdm-page { padding: 24px 28px; max-width: 920px; margin: 0 auto; }
    .cdm-card { padding: 28px 32px; }
    .cdm-topbar { padding: 10px 28px; }
    .cdm-title { font-size: 20px; }
    .cdm-subtitle { font-size: 13px; }
    @media (max-width: 640px) {
        .cdm-grid-2, .cdm-grid-3 { grid-template-columns: 1fr; }
        .cdm-page { padding: 16px 12px; }
        .cdm-card { padding: 16px 14px; }
        .cdm-topbar { padding: 10px 12px; }
        .cdm-title { font-size: 16px; }
        .cdm-subtitle { font-size: 11px; }
        .cdm-header { flex-wrap: wrap; }
        code { word-break: break-word; }
    }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Step({ n, title, children }) {
    return (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: '#7c3aed',
                    color: '#fff', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(124,58,237,0.3)',
                }}>{n}</div>
                <div style={{ width: 2, flex: 1, background: '#e9d5ff', marginTop: 4 }} />
            </div>
            <div style={{ flex: 1, paddingBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4, paddingTop: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>{children}</div>
            </div>
        </div>
    );
}

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'warning' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'tip' },
        key:     { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'key' },
        purple:  { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8', icon: 'test' },
        danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: 'danger' },
    };
    const s = cfg[type] || cfg.info;
    return (
        <div style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
            <span style={{ flexShrink: 0, marginTop: 2, color: s.color }}><LmIcon name={s.icon} size={15} /></span>
            <div style={{ fontSize: 13, color: s.color, lineHeight: 1.65 }}>{children}</div>
        </div>
    );
}

function SectionTitle({ children }) {
    return (
        <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: T.textMuted,
            borderBottom: `1px solid ${T.border}`,
            paddingBottom: 6, marginBottom: 16, marginTop: 28,
        }}>{children}</div>
    );
}

function Shot({ src, alt, caption }) {
    return (
        <div style={{ margin: '10px 0 22px' }}>
            <img src={src} alt={alt} style={{
                width: '100%', display: 'block', borderRadius: 10,
                border: '1px solid #e4e8f5', boxShadow: '0 1px 8px rgba(26,31,60,0.10)',
            }} />
            {caption && (
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{caption}</div>
            )}
        </div>
    );
}

function TestCaseExampleCard({ title, language, code, testCases = [] }) {
    return (
        <div style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            margin: '14px 0 20px',
        }}>
            {/* Header */}
            <div style={{
                background: '#f8fafc',
                padding: '10px 16px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <LmIcon name={language === 'python' ? 'coding' : 'settings'} size={15} />
                    <span>{title}</span>
                </div>
                <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: language === 'python' ? '#eff6ff' : '#faf5ff',
                    color: language === 'python' ? '#1d4ed8' : '#7c3aed',
                    border: `1px solid ${language === 'python' ? '#bfdbfe' : '#e9d5ff'}`,
                    padding: '2px 8px',
                    borderRadius: 12,
                }}>
                    {language}
                </span>
            </div>

            {/* Code Section */}
            <div style={{ padding: '12px 16px', background: '#0f172a' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                    Code Written in Cell
                </div>
                <pre style={{
                    margin: 0,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12.5,
                    color: '#f1f5f9',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    background: 'transparent',
                }}>
                    <code style={{ background: 'transparent', padding: 0, color: '#f1f5f9' }}>{code}</code>
                </pre>
            </div>

            {/* Test Cases Section */}
            <div style={{ padding: '14px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>
                    Configured Hidden Test Cases
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {testCases.map((tc, idx) => (
                        <div key={idx} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '10px 14px',
                        }}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#7c3aed', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                    {idx + 1}
                                </span>
                                <span>{tc.name || `Test Case #${idx + 1}`}</span>
                            </div>
                            <div className="cdm-grid-2">
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                                        Input (stdin)
                                    </div>
                                    <div style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 5,
                                        padding: '6px 10px',
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        color: '#0f172a',
                                        minHeight: 28,
                                    }}>
                                        {tc.input || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(empty)</span>}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', marginBottom: 3 }}>
                                        Expected Output (stdout)
                                    </div>
                                    <div style={{
                                        background: '#ecfdf5',
                                        border: '1px solid #a7f3d0',
                                        borderRadius: 5,
                                        padding: '6px 10px',
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: 12,
                                        color: '#065f46',
                                        fontWeight: 600,
                                        minHeight: 28,
                                    }}>
                                        {tc.output}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Visual Mockup representing the Faculty Test Cases Panel in NotebookEditor
 */
function VisualTestCasesEditorMock() {
    return (
        <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e4e8f5',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden',
            margin: '12px 0 20px',
        }}>
            {/* Cell Top Header */}
            <div style={{
                background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>[In 1] Python</span>
                    <span style={{
                        fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534',
                        padding: '2px 8px', borderRadius: 12,
                    }}>Completed (Yes)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        fontSize: 11, fontWeight: 600, background: '#7c3aed', color: '#fff',
                        padding: '3px 10px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                        <LmIcon name="test" size={12} />
                        Test Cases (2)
                    </span>
                    <span style={{
                        fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#475569',
                        padding: '3px 8px', borderRadius: 6,
                    }}>
                        ⌨️ Input
                    </span>
                </div>
            </div>

            {/* Code Body */}
            <div style={{
                background: '#1e293b', padding: '12px 14px',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#f8fafc',
            }}>
                <div><span style={{ color: '#93c5fd' }}>def</span> <span style={{ color: '#86efac' }}>solve</span>():</div>
                <div style={{ paddingLeft: 16 }}><span style={{ color: '#fcd34d' }}>a</span>, <span style={{ color: '#fcd34d' }}>b</span> = map(int, input().split())</div>
                <div style={{ paddingLeft: 16 }}>print(a + b)</div>
                <div>solve()</div>
            </div>

            {/* Test Cases Panel */}
            <div style={{ background: '#faf5ff', borderTop: '1px solid #e9d5ff', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase' }}>
                            Hidden Test Cases (2)
                        </span>
                        <span style={{
                            fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d',
                            padding: '2px 7px', borderRadius: 10,
                        }}>Completed (Yes)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{
                            fontSize: 11, fontWeight: 700, background: '#7c3aed', color: '#fff',
                            border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                        }}>
                            ▶ Test Solution on Cell
                        </button>
                        <button style={{
                            fontSize: 11, fontWeight: 700, background: '#fff', color: '#7c3aed',
                            border: '1px solid #c084fc', padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                        }}>
                            + Add Test Case
                        </button>
                    </div>
                </div>

                <div style={{ fontSize: 11, color: '#6b21a8', opacity: 0.8, marginBottom: 10 }}>
                    Students will not see these inputs or expected outputs directly. They will click "Run Hidden Test Case" to test their code and receive Yes/No feedback.
                </div>

                {/* Test Case Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4c1d95', marginBottom: 6 }}>Test Case #1</div>
                        <div className="cdm-grid-2">
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Input (stdin)</div>
                                <div style={{
                                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 5,
                                    padding: '6px 10px', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                                    color: '#0f172a', fontWeight: 600, minHeight: 28,
                                }}>
                                    5 10
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Expected Output (stdout)</div>
                                <div style={{
                                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 5,
                                    padding: '6px 10px', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                                    color: '#065f46', fontWeight: 700, minHeight: 28,
                                }}>
                                    15
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4c1d95', marginBottom: 6 }}>Test Case #2</div>
                        <div className="cdm-grid-2">
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Input (stdin)</div>
                                <div style={{
                                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 5,
                                    padding: '6px 10px', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                                    color: '#0f172a', fontWeight: 600, minHeight: 28,
                                }}>
                                    -4 20
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#475569', marginBottom: 3 }}>Expected Output (stdout)</div>
                                <div style={{
                                    background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 5,
                                    padding: '6px 10px', fontSize: 12, fontFamily: "'IBM Plex Mono', monospace",
                                    color: '#065f46', fontWeight: 700, minHeight: 28,
                                }}>
                                    16
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Visual Mockup representing Student View in NotebookPlayer
 */
function VisualStudentTestMock() {
    return (
        <div style={{
            background: '#fff', borderRadius: 8, border: '1px solid #e4e8f5',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden',
            margin: '12px 0 20px',
        }}>
            {/* Student Cell Action Bar */}
            <div style={{
                background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={{
                        fontSize: 11, fontWeight: 700, background: '#1d4ed8', color: '#fff',
                        border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    }}>
                        ▶ Run
                    </button>
                    <button style={{
                        fontSize: 11, fontWeight: 700, background: '#10b981', color: '#fff',
                        border: 'none', padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    }}>
                        <LmIcon name="test" size={12} style={{ marginRight: 4 }} />
                        Run Hidden Test Case
                    </button>
                    <span style={{
                        fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#166534',
                        padding: '2px 8px', borderRadius: 12,
                    }}>
                        Passed (Yes - All Completed)
                    </span>
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>Autosaved</span>
            </div>

            {/* Test Results Banner */}
            <div style={{ background: '#f0fdf4', borderTop: '1px solid #bbf7d0', padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                        Test Case Results (2/2 Passed)
                    </span>
                    <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600 }}>Confidential Test Inputs</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{
                        background: '#fff', border: '1px solid #86efac', borderRadius: 6,
                        padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                            <span style={{ color: '#16a34a' }}>✓</span>
                            <span>Test #1:</span>
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>Yes (Passed)</span>
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Matched Expected Output</span>
                    </div>

                    <div style={{
                        background: '#fff', border: '1px solid #86efac', borderRadius: 6,
                        padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 }}>
                            <span style={{ color: '#16a34a' }}>✓</span>
                            <span>Test #2:</span>
                            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 10, padding: '1px 6px', borderRadius: 8 }}>Yes (Passed)</span>
                        </div>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>Matched Expected Output</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Two cells side by side, as they would sit in a notebook, with what happens. */
function TwoCellExample({ title, tone, cells, verdict }) {
    const good = tone === 'good';
    return (
        <div style={{ background: '#fff', border: `1px solid ${good ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: good ? '#166534' : '#991b1b', marginBottom: 8 }}>{title}</div>
            {cells.map((cell) => (
                <div key={cell.label} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 3 }}>
                        {cell.label}
                    </div>
                    <pre style={{
                        margin: 0, padding: '8px 10px', borderRadius: 6, background: '#0f172a', color: '#f1f5f9',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: 11.5, lineHeight: 1.55,
                        whiteSpace: 'pre-wrap', overflowX: 'auto',
                    }}>
                        <code style={{ background: 'transparent', padding: 0, color: '#f1f5f9' }}>{cell.code}</code>
                    </pre>
                </div>
            ))}
            <div style={{
                fontSize: 12, lineHeight: 1.6, padding: '6px 10px', borderRadius: 6,
                background: good ? '#f0fdf4' : '#fef2f2', color: good ? '#166534' : '#991b1b',
            }}>
                {verdict}
            </div>
        </div>
    );
}

/**
 * Whether one cell can use what another defined — the question every teacher
 * coming from Jupyter asks, and the answer differs by language. Checked against
 * the real kernels: Python cells share one interpreter; each C cell is compiled
 * and linked alone, so a call into another cell fails to link.
 */
function CellConnectionGuide() {
    return (
        <div>
            <Note type="danger">
                <strong>In C, every code cell is a separate, individual program.</strong> Each cell is compiled on its
                own with its own <code>main()</code>. A function, variable, <code>#define</code> or <code>struct</code>{' '}
                written in one C cell <strong>cannot be used in any other cell</strong> — not even the cell right below
                it, and not even after running the first cell. The only thing shared by every C cell is the{' '}
                <strong>Hidden setup</strong> cell.
            </Note>

            <div className="cdm-grid-2" style={{ marginBottom: 14 }}>
                <TwoCellExample
                    title="Python — cells are connected"
                    tone="good"
                    cells={[
                        { label: 'Cell 1', code: 'def square(x):\n    return x * x' },
                        { label: 'Cell 2', code: 'print(square(4))' },
                    ]}
                    verdict={<>Prints <code>16</code>. All Python cells share one session, so a function works in every cell run <em>after</em> the cell that defines it.</>}
                />
                <TwoCellExample
                    title="C — cells are NOT connected"
                    tone="bad"
                    cells={[
                        { label: 'Cell 1', code: '#include <stdio.h>\nint square(int x) { return x * x; }\nint main(void) { printf("%d\\n", square(3)); return 0; }' },
                        { label: 'Cell 2', code: '#include <stdio.h>\nint main(void) {\n    printf("%d\\n", square(4));\n    return 0;\n}' },
                    ]}
                    verdict={<>Cell 2 fails: <code>undefined symbol: square</code>. Cell 2 is its own program and has never seen Cell 1.</>}
                />
            </div>

            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 10 }}>
                <strong>How to share code between cells</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    <li>
                        <strong>Same cell (both languages, recommended for exercises):</strong> write the helper functions
                        one after another in the same cell, above the code that calls them — in C, above{' '}
                        <code>main()</code>. Hidden tests run one cell by itself, so everything the test needs must be
                        in that cell.
                    </li>
                    <li>
                        <strong>Hidden setup cell (both languages):</strong> for helpers every cell should be able to call.
                        In C its code is pasted in front of every cell before compiling, so it must not contain{' '}
                        <code>main()</code>. In Python it runs once before any student cell.
                    </li>
                    <li>
                        <strong>Python only, with care:</strong> a function in an earlier visible cell works only if that
                        cell was run first in the current session. After Restart or Stop it is gone until the cell is run
                        again, and a hidden test on a later cell fails if the student hasn&apos;t run the earlier one.
                    </li>
                </ul>
            </div>
        </div>
    );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview',  label: 'Overview',          icon: 'coding' },
    { id: 'create',    label: 'Author a Notebook', icon: 'edit' },
    { id: 'testcases', label: 'Hidden Test Cases', icon: 'test' },
    { id: 'share',     label: 'Download & Import', icon: 'download' },
    { id: 'integrity', label: 'Full Screen & Paste', icon: 'fullscreen' },
    { id: 'runtime',   label: 'What Can Run',      icon: 'settings' },
    { id: 'student',   label: 'What Students See', icon: 'preview' },
    { id: 'grade',     label: 'Grading',           icon: 'success' },
    { id: 'gotchas',   label: 'Gotchas',           icon: 'warning' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview() {
    return (
        <div>
            <Note type="key">
                Coding notebooks are Python or C worksheets — prose and code cells, Jupyter-notebook-like —
                that run <strong>entirely inside the student's own browser</strong>. Nothing to install, no
                server execution, and zero infrastructure load.
            </Note>

            <Shot src={shotList} alt="Coding notebooks list for a class"
                caption="The Coding tab. The sample notebook card sits at the top; Import notebook file and New notebook are top right; every card has Download." />

            <SectionTitle>Python or C — Decided at Creation</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Click <strong>New notebook</strong> and pick a <strong>Blank</strong> Python or C notebook, or a{' '}
                <strong>Sample with hidden test cases</strong>. The sample is also on the Coding tab
                (<strong>Open Python sample</strong> / <strong>Open C sample</strong>): a worked exercise with a teacher
                guide, starter code, a hidden setup cell, helper functions and hidden tests.
                The language is <strong>locked in once published</strong>: switching it afterward is refused,
                because students already have code written for that kernel.
            </div>

            <Note type="warning">
                <strong>Python cells are connected; C cells are not.</strong> In Python, a function defined in one cell
                can be called from later cells. In C, <strong>every cell is an individual program</strong> with its own{' '}
                <code>main()</code>, and nothing written in one cell can be used in another. See{' '}
                <strong>Author a Notebook → Are Cells Connected?</strong>
            </Note>

            <SectionTitle>Universal Hidden Test Cases & Verification</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Every code cell can have <strong>Hidden Test Cases</strong> attached (input <code>stdin</code> and expected <code>stdout</code> pairs).
                Students can click <strong>Run Hidden Test Case</strong> to test their solutions against confidential test cases in their browser
                and receive instant <strong>Yes/No</strong> feedback without seeing the test inputs or expected outputs.
            </div>

            <SectionTitle>New in the Coding Tab</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Sample notebook</strong> — a worked, tested exercise to learn from or copy (see <em>Hidden Test Cases</em>).</li>
                    <li><strong>Download &amp; Import</strong> — move a notebook, with its hidden test cases and settings, to another class or teacher.</li>
                    <li><strong>Full screen &amp; paste blocking</strong> — optional rules for work that must be done unaided, with every full-screen exit and blocked paste recorded.</li>
                </ul>
            </div>

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                Author cells (prose + code, locked, hidden setup, or test cases) → verify test cases on reference solution → publish →
                students code and evaluate against hidden test cases live in their own tab → submit → you review code, test pass rates,
                and recorded output in the Submissions dashboard.
            </div>
        </div>
    );
}

function TabCreate() {
    return (
        <div>
            <SectionTitle>Notebook Settings</SectionTitle>
            <Shot src={shotEditor} alt="Notebook editor settings, including full screen and paste blocking"
                caption="The editor's settings, shown here on the sample notebook. Packages and the Colab link appear for Python; a C notebook shows how C cells run instead." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Packages</strong> (Python only) — PyPI packages not already bundled with the in-browser runtime. <code>numpy</code>, <code>pandas</code>, <code>matplotlib</code>, <code>scipy</code>, <code>sympy</code> and <code>scikit-learn</code> ship for free and don't need declaring. <strong>Packages only install at kernel start</strong> — adding one to an already-running kernel does nothing until restarted.</li>
                    <li><strong>Open in Colab link</strong> (Python only) — for workloads the browser kernel cannot run (TensorFlow, PyTorch, GPU). Must be a <code>colab.research.google.com</code> address.</li>
                    <li><strong>Submission deadline</strong> — advisory only. Puts the exercise on the class calendar; late submissions are flagged.</li>
                    <li><strong>Let students add their own cells</strong> — toggle off to keep it a fixed worksheet.</li>
                    <li><strong>Show your version after they submit</strong> — your reference cell sources appear under a student's work once submitted.</li>
                    <li><strong>Students write code only in full screen</strong> — the notebook is covered until they enter full screen, and each exit is recorded. See <em>Full Screen &amp; Paste</em>.</li>
                    <li><strong>Block pasting into code cells</strong> — code must be typed; each blocked paste is recorded. See <em>Full Screen &amp; Paste</em>.</li>
                </ul>
            </div>

            <SectionTitle>Cell Types & Toolbar Controls</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 12 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Locked</strong> — visible and runnable, but the student cannot edit the source code (its Input/stdin box remains editable).</li>
                    <li><strong>Hidden setup</strong> — never shown to the student. In Python it runs once into the kernel before their cells; in C, its source is prepended literally to every cell before compiling (must not define <code>main()</code>).</li>
                    <li><strong><LmIcon name="test" size={13} /> Test Cases (N)</strong> — opens the hidden test case authoring panel to set up secret stdin/stdout test pairs and verify your solution before publishing.</li>
                    <li><strong>⌨️ Input (stdin)</strong> — sample input for the ▶ button, fed to <code>input()</code> in Python or <code>scanf</code>/<code>fgets</code> in C. Students get a copy; hidden tests use their own Input instead.</li>
                    <li><strong>Setup guide</strong> — explains, inside the cell, what to write versus leave for the student, how test inputs arrive, how output is checked, and where helper functions go. Opens by itself on an empty cell, which also offers <strong>Insert example</strong> (starter code, sample input and two test cases).</li>
                </ul>
            </div>

            <Shot src={shotEditorCell} alt="A code cell in the editor with the Setup guide and the Hidden Test Cases panel open"
                caption="A tested cell from the sample: starter code on top, then the Setup guide, the sample Input, and the four hidden test cases." />

            <VisualTestCasesEditorMock />

            <SectionTitle>Are Cells Connected? Python: Yes · C: No</SectionTitle>
            <CellConnectionGuide />

            <SectionTitle>Importing Existing Code</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                <strong>Import notebook file / .ipynb / .py</strong> (Python) or <strong>Import notebook file / .c</strong>{' '}
                appends cells from a file to the end of the notebook. A <strong>notebook file</strong> downloaded from here
                brings its hidden test cases and settings too — see <em>Download &amp; Import</em>. IPython magics (<code>%matplotlib inline</code>, <code>!pip install x</code>)
                are stripped or converted automatically into Packages. Separately,
                <strong> <LmIcon name="import" size={13} /> Import cells</strong> pulls cells from a notebook in another class you teach.
            </div>
        </div>
    );
}

function TabTestCases() {
    return (
        <div>
            <Note type="purple">
                <strong>Universal Hidden Test Cases:</strong> You can attach automated test cases (Input <code>stdin</code> &amp; Expected <code>stdout</code>)
                to any code cell in both <strong>Python</strong> and <strong>C</strong> notebooks. They evaluate 100% inside the student's browser with
                instant <strong>Yes (Passed) / No (Failed)</strong> feedback while keeping test inputs and outputs completely confidential!
            </Note>

            <SectionTitle>How Hidden Test Cases Work</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
                When you create a coding assignment, students need a way to verify their code against edge cases without revealing the answers.
                Hidden test cases solve this by running standard input/output assertions inside the browser's WebAssembly sandbox:
            </div>

            <div className="cdm-grid-3" style={{ marginBottom: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ marginBottom: 4, color: T.accent }}><LmIcon name="locked" size={17} /></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>Confidential Inputs</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                        Students never see your test inputs or expected outputs in their UI, preventing hardcoded or pattern-matched answers.
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ marginBottom: 4, color: T.accent }}><LmIcon name="short" size={17} /></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>In-Browser Execution</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                        Runs via WebAssembly workers (Pyodide &amp; Clang). Zero server latency, zero cloud compute costs, and infinite scalability.
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ marginBottom: 4, color: T.accent }}><LmIcon name="insights" size={17} /></div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>Submissions Analytics</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                        The Submissions dashboard shows instant test pass counts (e.g. <code>All Passed (3/3)</code>) for every student.
                    </div>
                </div>
            </div>

            <SectionTitle>Faculty Authoring &amp; Verification Interface</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                Here is what the authoring panel looks like in the <strong>Notebook Editor</strong> when you click the purple <strong>Test Cases</strong> button:
            </div>

            <VisualTestCasesEditorMock />

            <SectionTitle>Start From the Sample Notebook</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
                On the Coding tab, press <strong>Open Python sample</strong> or <strong>Open C sample</strong>. It opens as
                a draft in your class with a teacher guide cell, a hidden setup cell holding a helper function, a locked
                example, and two questions with starter code, sample input and four hidden tests each — the second one
                showing helper functions written in the same cell. Press <strong>Test Cases → Test Solution on
                Cell</strong> on either question to watch the tests run, then copy the pattern.
            </div>

            <SectionTitle>Step-by-Step Guide for Teachers</SectionTitle>

            <Step n="1" title="Open the Test Cases Panel in the Notebook Editor">
                In any code cell, click the purple <strong>Test Cases (N)</strong> button in the cell action bar. This expands the Hidden Test Cases panel below the cell editor.
            </Step>

            <Step n="2" title="Add Test Cases (Stdin & Expected Stdout)">
                Click <strong>+ Add Test Case</strong>. For each test case:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    <li><strong>Input (stdin)</strong>: Enter the exact input string that your program will read via <code>input()</code> in Python or <code>scanf()</code> / <code>fgets()</code> in C (e.g. <code>5 10</code> or multi-line text). Leave empty if the program takes no input.</li>
                    <li><strong>Expected Output (stdout)</strong>: Enter the exact output text your program should print to stdout (e.g. <code>15</code> or <code>Prime</code>).</li>
                </ul>
                You can add up to 20 test cases per cell. Use the red trash icon to delete unwanted test cases.
            </Step>

            <Step n="3" title="Start the Kernel & Write Reference Solution">
                Start the runtime kernel by clicking <strong>Start Python</strong> or <strong>Start C</strong> at the top of the editor.
                Write your complete, working reference solution directly into the code cell.
            </Step>

            <Step n="4" title="Verify Your Solution with 'Test Solution on Cell'">
                Click the purple <strong>Test Solution on Cell</strong> button (or <strong>Run Hidden Test Case</strong> in the cell toolbar).
                The test runner executes your reference solution against all configured test cases:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    <li>If all test cases match, a green <strong>Completed (Yes)</strong> badge appears.</li>
                    <li>If any test case fails, a red <strong>Failed (No - X/Y)</strong> badge appears with detailed diagnostic diffs showing <em>Input</em>, <em>Expected Output</em>, and <em>Actual Output</em> so you can fix any discrepancy.</li>
                </ul>
            </Step>

            <Step n="5" title="Provide Starter Prompt / Skeleton & Publish">
                Once you have verified that all test cases pass with your reference solution, replace the cell's code with the starter code students begin from — the input-reading lines, function headers and <code>TODO</code> comments — and click <strong>Save</strong> or <strong>Publish</strong>.
                Your test cases remain saved in the notebook. <strong>Don&apos;t forget this step:</strong> whatever code is in the cell when you publish is exactly what every student receives.
            </Step>

            <SectionTitle>What Students Experience in the Notebook Player</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>
                When students open the published notebook, they see a <strong>Run Hidden Test Case</strong> button on every cell that has test cases.
                When they click it, their code runs against the test cases and displays binary pass/fail indicators without exposing your confidential test values:
            </div>

            <Shot src={shotPlayerTests} alt="A student's cell failing all four hidden tests, with no inputs or expected outputs shown"
                caption="A half-finished answer: 0/4 hidden tests pass. Students see Yes/No per test, never your inputs or expected outputs." />

            <SectionTitle>Language-Specific Execution Details</SectionTitle>
            <div className="cdm-grid-2" style={{ marginBottom: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LmIcon name="coding" size={15} />
                        Python Test Execution
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                            <li>Runs in Pyodide WebAssembly worker.</li>
                            <li>Hidden setup cells execute first to load libraries or helper functions into the namespace.</li>
                            <li>A test runs only the tested cell. Functions from other visible cells exist only if the student ran those cells first, so keep helpers in the tested cell.</li>
                            <li><code>input()</code> reads line-by-line from the test case stdin string.</li>
                            <li>Standard <code>print()</code> output and expression return values are captured for stdout comparison.</li>
                        </ul>
                    </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e4e8f5', borderRadius: 8, padding: '14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <LmIcon name="settings" size={15} />
                        C Test Execution
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                            <li>Each cell is compiled with real Clang WebAssembly with its own <code>main()</code>.</li>
                            <li><strong>Each cell is an individual program</strong> — a test cannot call functions written in any other cell. Put helpers in the tested cell, above <code>main()</code>.</li>
                            <li>Hidden setup code is automatically prepended to the cell source before compilation.</li>
                            <li><code>scanf()</code> / <code>fgets()</code> reads from the test case stdin stream.</li>
                            <li><code>printf()</code> / <code>puts()</code> output is captured and matched.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <SectionTitle>Output Normalization & Matching Rules</SectionTitle>
            <Note type="tip">
                <strong>Smart Output Normalization:</strong> The test runner automatically normalizes outputs before comparison to prevent false failures from operating system discrepancies:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    <li>Converts Windows CRLF (<code>\r\n</code>) line breaks to Unix LF (<code>\n</code>).</li>
                    <li>Trims trailing spaces from each output line.</li>
                    <li>Trims overall leading and trailing whitespace from the final output string.</li>
                    <li>Comparison is strictly case-sensitive for characters and numbers (e.g. <code>True</code> vs <code>true</code>).</li>
                </ul>
            </Note>

            <SectionTitle>Example Test Case Patterns</SectionTitle>
            <TestCaseExampleCard
                title="Sum of Two Numbers"
                language="python"
                code={`a, b = map(int, input().split())
print(a + b)`}
                testCases={[
                    { name: 'Standard Case', input: '10 20', output: '30' },
                    { name: 'Negative Numbers', input: '-15 5', output: '-10' },
                    { name: 'Zero Handling', input: '0 0', output: '0' },
                ]}
            />

            <TestCaseExampleCard
                title="Reverse a String"
                language="c"
                code={`#include <stdio.h>
#include <string.h>

int main() {
    char str[100];
    if (scanf("%s", str) == 1) {
        int len = strlen(str);
        for (int i = len - 1; i >= 0; i--) {
            putchar(str[i]);
        }
        putchar('\\n');
    }
    return 0;
}`}
                testCases={[
                    { name: 'Standard Word', input: 'hello', output: 'olleh' },
                    { name: 'Palindrome', input: 'racecar', output: 'racecar' },
                ]}
            />
        </div>
    );
}

function TabShare() {
    return (
        <div>
            <Note type="key">
                A notebook can be saved as a <strong>notebook file</strong> (<code>.xnb.json</code>) and imported into
                another class — yours or another teacher&apos;s — <strong>with everything in it</strong>: every cell,
                the Locked and Hidden setup ticks, each cell&apos;s sample Input, <strong>all hidden test cases</strong>,
                the settings (including full screen and paste blocking), the packages and the Colab link. Works the same
                for Python and C notebooks.
            </Note>

            <SectionTitle>Download a Notebook File</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>From the <strong>Coding tab</strong>: press <strong>Download</strong> on the notebook&apos;s card.</li>
                    <li>From the <strong>editor</strong>: press <strong>Download notebook file</strong> at the bottom. This saves what is on screen, including edits you haven&apos;t saved yet.</li>
                </ul>
            </div>
            <Shot src={shotEditorTransfer} alt="Editor buttons: Import notebook file, Download notebook file, Import cells"
                caption="The foot of the editor: import a file, download this notebook as a file, or pull cells from another class." />

            <SectionTitle>Import It Somewhere Else</SectionTitle>
            <Step n="1" title="As a new notebook — Coding tab → Import notebook file">
                Pick the <code>.xnb.json</code> file. A new <strong>draft</strong> notebook is created with the file&apos;s
                title, language, cells, hidden test cases and settings, and the editor opens on it. Nothing reaches
                students until you publish.
            </Step>
            <Step n="2" title="Into an open notebook — editor → Import notebook file / …">
                The file&apos;s cells, with their test cases, are added to the end of this notebook, and its settings
                and packages are applied. This notebook keeps its own title (unless it is still &ldquo;Untitled&rdquo;)
                and its own deadline. A C file can only be imported into a C notebook, and Python into Python.
                Press <strong>Save</strong> to keep the result.
            </Step>

            <Note type="tip">
                <strong>The deadline:</strong> a file carries its deadline, but importing it as a new notebook keeps the
                deadline only if it is still in the future. A date that has already passed would mark every submission
                in the new class late, so you are asked to set a new one.
            </Note>

            <SectionTitle>What Is and Isn&apos;t in the File</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Included:</strong> title, description, language, cells in order, Locked / Hidden setup, sample Input, hidden test cases, all settings, packages, Colab link, deadline.</li>
                    <li><strong>Not included:</strong> students, their work, grades and submissions — those belong to the class the notebook came from.</li>
                    <li>The file is plain JSON. Treat it like an answer key: it contains the hidden test cases.</li>
                </ul>
            </div>
        </div>
    );
}

function TabIntegrity() {
    return (
        <div>
            <Note type="key">
                Two settings in the editor, both <strong>off by default</strong>, for work you want done without outside
                help. Both apply to <strong>students only</strong> — teachers opening the notebook are never held to
                them — and both stop applying once the student submits.
            </Note>

            <SectionTitle>Students Write Code Only in Full Screen</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>When a student opens the notebook, it is covered until they press <strong>Enter full screen</strong>.</li>
                    <li>If they leave full screen (Esc, switching app or tab, and so on), the notebook is covered again and the exit is <strong>recorded with the time</strong>. They see how many times they have left.</li>
                    <li>Their work is not lost — autosave keeps running — they just can&apos;t see or type until they return.</li>
                    <li>On a browser that can&apos;t do full screen (some phones and tablets), the student sees a warning and can still work; nothing is recorded.</li>
                </ul>
            </div>
            <div className="cdm-grid-2">
                <Shot src={shotPlayerFullscreen} alt="Notebook covered until the student enters full screen"
                    caption="On opening: the notebook is covered until the student enters full screen." />
                <Shot src={shotPlayerLeftFullscreen} alt="Notebook covered again after the student left full screen"
                    caption="After leaving: covered again, with the count. The exit is already recorded." />
            </div>

            <SectionTitle>Block Pasting into Code Cells</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Ctrl+V / Cmd+V, right-click → Paste and dragging text into a <strong>code cell</strong> are all refused, so code has to be typed.</li>
                    <li>The student sees &ldquo;Pasting is turned off for this notebook&rdquo;, and a note at the top of the notebook says so.</li>
                    <li>Each blocked attempt is <strong>counted and recorded with the time</strong>.</li>
                    <li>The <strong>Input</strong> boxes still accept pasting — pasting a long list of input numbers is legitimate.</li>
                </ul>
            </div>

            <SectionTitle>Where You See It</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <strong>Submissions</strong> gets a <strong>Full screen / paste</strong> column (for example{' '}
                <code>left full screen 5×</code>, <code>3 paste attempts</code>). Press <strong>Read</strong> on a student
                to see every event with its time, newest first.
            </div>
            <Shot src={shotSubmissions} alt="Submissions table with the Full screen / paste column"
                caption="The roster with the Full screen / paste column." />
            <Shot src={shotSubmissionIntegrity} alt="One student's full-screen exits and blocked pastes, each with a time"
                caption="Reading one attempt: each exit and blocked paste with the time it was recorded." />

            <Note type="warning">
                <strong>A deterrent and a record, not a lock.</strong> Browsers always let people leave full screen, and
                the notebook runs in the student&apos;s own browser, so someone determined can get around both. Use the
                counts as a reason for a conversation rather than as proof — a single exit is often an accidental Esc.
            </Note>
        </div>
    );
}

function TabRuntime() {
    return (
        <div>
            <Note type="key">
                Both runtimes execute inside a Web Worker in the student's own tab — never on the server.
                Running arbitrary student code server-side is a remote-code-execution surface; executing in the browser
                guarantees complete isolation with zero cloud hosting bills.
            </Note>

            <SectionTitle>Python — Pyodide</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Real CPython compiled to WebAssembly. The first start downloads a few megabytes; students
                are informed before clicking Start. <code>numpy</code>, <code>pandas</code>,
                <code> matplotlib</code>, <code>scipy</code>, <code>sympy</code> and
                <code> scikit-learn</code> have prebuilt browser versions and don't need declaring in
                Packages. <strong>TensorFlow, Keras, PyTorch, JAX, XGBoost, LightGBM, CatBoost and
                Transformers have no browser build at all</strong> — point students at the Google Colab link for GPU/deep learning work.
                <code>input()</code> reads from the cell's stdin box or the active test case.
            </div>

            <SectionTitle>C — Real clang, via WebAssembly</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                Real clang plus a linker and sysroot, roughly 50MB on first start (cached after that).
                Warnings are enabled; <code>-Werror</code> is off so first-year exercises don't fail over unused variables.
                <code>scanf</code>/<code>fgets</code> read from the cell's stdin box or active test cases.
            </div>

            <Note type="warning">
                <strong>Stop and Restart always reset kernel state</strong> in both languages —
                there is no true cooperative interrupt, so an infinite loop is killed by terminating the worker.
                Every variable from the previous run is cleared, and hidden setup replays from scratch.
            </Note>
        </div>
    );
}

function TabStudent() {
    return (
        <div>
            <Shot src={shotPlayer} alt="Student view of the sample notebook: warm-up, a locked example, and Question 1 passing its hidden tests"
                caption="A student's view of the sample. The locked example ran with its Input; Question 1 shows Completed and passes all four hidden tests." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Lazy Kernel Start</strong> — nothing downloads until the student clicks <strong>Start</strong>, so opening a notebook just to read it costs nothing.</li>
                    <li><strong>Run All</strong> — runs every code cell top to bottom in sequential order.</li>
                    <li><strong>Run Hidden Test Case</strong> — validates cell code against confidential test cases with instant Yes/No feedback.</li>
                    <li><strong>Completed / Error</strong> — after a run, the cell toolbar shows a green tick with <strong>Completed</strong>, or a red mark with <strong>Error</strong>. A cell that only defines things prints nothing and still shows Completed.</li>
                    <li><strong>Full screen and paste rules</strong> — if you turned them on, the notebook asks for full screen and refuses pastes into code cells. See <em>Full Screen &amp; Paste</em>.</li>
                    <li><strong>Autosave</strong> — runs automatically a couple of seconds after any edit; a badge shows saved / saving / unsaved status.</li>
                    <li><strong>Submit Confirmation</strong> — warns students that submission is final. After submitting, cells can still be run to explore, but changes are locked.</li>
                    <li><strong>Reference Solutions</strong> — if enabled in settings, your reference cell sources appear below theirs once submitted.</li>
                </ul>
            </div>
            <SectionTitle>Student Cell & Test Case Controls</SectionTitle>
            <VisualStudentTestMock />
        </div>
    );
}

function TabGrade() {
    return (
        <div>
            <Shot src={shotSubmissions} alt="Notebook submissions list showing status, cells run, hidden tests, full screen / paste and grade columns"
                caption="Submissions. The Full screen / paste column appears when either rule is on for the notebook." />
            <Note type="tip">
                <strong>Automated Test Summaries + Manual Grading:</strong> The Submissions dashboard provides automated
                test pass summaries (e.g. <code>All Passed (3/3)</code> or <code>1/3 Passed</code>) while allowing teachers
                to inspect student code, view detailed test execution diffs, and assign final grades.
            </Note>

            <SectionTitle>The Submissions Table</SectionTitle>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                The table lists all enrolled students with:
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    <li><strong>Status</strong> — Opened, In Progress, or Submitted (with late flags if submitted past due date).</li>
                    <li><strong>Cells Run</strong> — "every cell ran" in green, or count of errored / unrun cells in yellow.</li>
                    <li><strong>Test Cases</strong> — instant pass badge: <code>All Passed (N/N)</code> in green or <code>X/N Passed</code> in red.</li>
                    <li><strong>Full screen / paste</strong> — how many times the student left full screen and how many pastes were blocked, when those rules are on. <strong>Read</strong> lists each one with its time.</li>
                    <li><strong>Grade</strong> — points awarded out of max score.</li>
                </ul>
            </div>

            <Shot src={shotSubmissionDetail} alt="Expanded submission showing code, recorded output, test results, and grade form"
                caption="Reading a submission. Code, recorded output, and detailed Hidden Test Results breakdown, followed by the Grade and Feedback form." />
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.9, marginBottom: 8 }}>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li><strong>Detailed Test Diffs</strong> — when reading an expanded attempt, teachers can see the exact input, expected output, and student's actual output for failed test cases.</li>
                    <li><strong>Grade and Out of</strong> — enter numeric points; grades mirror directly into the class gradebook.</li>
                    <li><strong>Feedback</strong> — rich text comments shown back to the student on their notebook.</li>
                    <li><strong>Reopen</strong> — resets submission state to allow a student another attempt.</li>
                    <li><strong>PDF Export</strong> — download a structured grading summary PDF per student.</li>
                </ul>
            </div>
        </div>
    );
}

function TabGotchas() {
    const items = [
        'Hidden test cases evaluate locally inside the browser kernel — whitespace and linebreaks (CRLF/LF) are normalized, but string comparison is otherwise exact and case-sensitive.',
        'Language is locked in once a notebook is published — switching between Python and C requires unpublishing first.',
        'Stop and Restart reset kernel state in both languages — an infinite loop is killed by terminating the worker.',
        'Python packages only install when the kernel starts — adding a package to Settings requires restarting the kernel.',
        'TensorFlow, PyTorch, JAX, and GPU libraries cannot run in-browser — use the Google Colab link for deep learning assignments.',
        'In C, every code cell is an individual program with its own main() — a function written in one C cell cannot be called from any other cell. Put helpers in the same cell above main(), or in the Hidden Setup cell to share them.',
        'In Python, cells are connected — a function defined in one cell can be used in later cells, but only once that cell has been run. Restart or Stop clears it.',
        'Hidden setup cells in C must not define main() — doing so will cause compilation conflicts when prepended to student cells.',
        'stdin (input() in Python, scanf/fgets in C) reads pre-typed input strings or test case data; asking for more input than supplied returns EOF.',
        'Submission deadlines are advisory — assignments do not lock automatically at the deadline; late submissions are flagged.',
        'Full screen and paste blocking discourage copying but cannot make it impossible — a browser always lets people leave full screen. Treat the recorded counts as a prompt for a conversation, not proof.',
        'Whatever code is in a cell when you publish is what every student starts with — after testing your solution, put the starter code back.',
        'A notebook file (.xnb.json) contains the hidden test cases — share it only with other teachers.',
        'Deleting a notebook permanently removes all student attempts and submissions associated with it.',
    ];
    return (
        <div>
            <Note type="warning">
                {items.length} things worth knowing before you set a coding notebook for real marks.
            </Note>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map((text, i) => (
                    <div key={i} style={{
                        background: '#fff', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b',
                        borderRadius: 8, padding: '10px 14px',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#92400e', flexShrink: 0 }}>{i + 1}.</span>
                        <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CodingManual({ standalone = false }) {
    const [tab, setTab] = useState('overview');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        if (!standalone) return;
        fetch(`${getEnvironment()}/user/getuser/`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setIsAuthenticated(true); })
            .catch(() => {});
    }, [standalone]);

    const TAB_CONTENT = {
        overview:  <TabOverview />,
        create:    <TabCreate />,
        testcases: <TabTestCases />,
        share:     <TabShare />,
        integrity: <TabIntegrity />,
        runtime:   <TabRuntime />,
        student:   <TabStudent />,
        grade:     <TabGrade />,
        gotchas:   <TabGotchas />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#1e3a8a', borderBottom: '1px solid #1e40af',
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    justifyContent: 'space-between',
                }} className="cdm-topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff',
                        }}><LmIcon name="coding" size={16} /></div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#dbeafe' }}>
                            Coding Notebooks — Teacher Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/learning" style={{
                            fontSize: 13, fontWeight: 600, color: '#93c5fd',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #1e40af', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1e40af'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div className="cdm-page" style={{ fontFamily: T.fontBody }}>
                <div className="cdm-header" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                    }}><LmIcon name="coding" size={21} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cdm-title" style={{ fontWeight: 800, color: T.text }}>Coding Notebooks — Teacher Manual</div>
                        <div className="cdm-subtitle" style={{ color: T.textMuted, marginTop: 2 }}>
                            Python and C, running entirely in the browser with Universal Hidden Test Cases · XCEED Learning
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
                    {TABS.map((t, i) => {
                        const active = tab === t.id;
                        const done = activeIdx > i;
                        const bgColor = active ? (t.id === 'testcases' ? '#7c3aed' : T.accent) : done ? '#10b981' : '#f1f5f9';
                        const numColor = active || done ? '#fff' : '#94a3b8';
                        const labelColor = active ? (t.id === 'testcases' ? '#7c3aed' : T.accent) : done ? '#10b981' : T.textMuted;
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', flex: i < TABS.length - 1 ? 1 : 'none', minWidth: 0 }}>
                                <div
                                    onClick={() => setTab(t.id)}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: 72, flexShrink: 0 }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: bgColor,
                                        border: active ? (t.id === 'testcases' ? '2px solid #7c3aed' : `2px solid ${T.accent}`) : done ? '2px solid #10b981' : '2px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 800, color: numColor,
                                        transition: 'all .2s', flexShrink: 0,
                                        boxShadow: active ? `0 0 0 4px ${t.id === 'testcases' ? '#7c3aed18' : `${T.accent}18`}` : 'none',
                                    }}>
                                        {done ? '✓' : i === 0 ? '★' : i}
                                    </div>
                                    <div style={{
                                        marginTop: 6, fontSize: 10, fontWeight: active ? 700 : 500,
                                        color: labelColor, textAlign: 'center', lineHeight: 1.3,
                                        maxWidth: 68, wordBreak: 'break-word',
                                    }}>
                                        {t.label}
                                    </div>
                                </div>
                                {i < TABS.length - 1 && (
                                    <div style={{
                                        flex: 1, height: 2, marginTop: 17, minWidth: 12,
                                        background: done ? '#10b981' : '#e2e8f0',
                                        transition: 'background .2s',
                                    }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="cdm-card" style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                    overflowX: 'auto',
                }}>
                    {TAB_CONTENT[tab]}
                </div>
            </div>
        </>
    );
}

