import React, { useState, useEffect } from 'react';
import { API_BASE, theme, styles, cssReset } from './config';

// photo-swap is mounted as a sibling of /ground-truth on the attendance
// router (server/src/modules/attendanceModule/routes/index.js), not nested
// under it — so strip the /ground-truth suffix that API_BASE carries.
const PHOTO_SWAP_BASE = API_BASE.replace(/\/ground-truth$/, '');

const MIN_EMBEDDING = 3;

// Matches the site's actual Navbar.jsx (tw-bg-gray-900 / tw-border-gray-700 /
// tw-text-cyan-300 / tw-text-white) — used for the header bar only, so it
// reads as part of the same site chrome rather than a different page.
const nav = {
  bg: '#111827',
  border: '#374151',
  accent: '#67e8f9',
  text: '#ffffff',
};

// Dark palette scoped to this page only — theme in config.js is shared
// across ~40 other pages in the app, so we don't touch it here. Accent
// colors (indigo/amber/red/green) come straight from theme since those
// already read well on a dark background.
function PhotoGroup({
  label,
  accent,
  hint,
  photos,
  onMove,
  moveLabel,
  moveTitle,
  token,
  emptyHint,
}) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: accent,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            background: accent + '1a',
            color: accent,
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          {photos.length}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: theme.textMuted,
            flexBasis: '100%',
          }}
        >
          {hint}
        </span>
      </div>

      {photos.length === 0 ? (
        <div
          style={{
            border: `1.5px dashed ${theme.border}`,
            borderRadius: 10,
            padding: '18px 14px',
            textAlign: 'center',
            fontSize: '12.5px',
            color: theme.textMuted,
            background: theme.surfaceAlt,
          }}
        >
          {emptyHint}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 10,
          }}
        >
          {photos.map((filename) => (
            <div
              key={filename}
              style={{
                position: 'relative',
                borderRadius: 10,
                overflow: 'hidden',
                border: `1.5px solid ${accent}40`,
                aspectRatio: '1',
                background: theme.bg,
                boxShadow: '0 1px 3px rgba(26,31,60,0.08)',
              }}
            >
              <img
                src={`${PHOTO_SWAP_BASE}/photo-swap/image/${token}/${filename}`}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              {onMove && (
                <button
                  title={moveTitle}
                  onClick={(e) => {
                    e.preventDefault();
                    onMove(filename);
                  }}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 30,
                    border: 'none',
                    borderTop: `1px solid ${accent}55`,
                    background: 'rgba(15,17,32,0.72)',
                    backdropFilter: 'blur(2px)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}
                >
                  {moveLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentPhotoUpdate() {
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState({
    rollNo: '',
    embeddingFiles: [],
    backupFiles: [],
  });
  const [comments, setComments] = useState('');
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (!urlToken) {
      setStatus('error');
      setErrorMessage('No token provided in the URL.');
      return;
    }
    setToken(urlToken);
    fetch(`${PHOTO_SWAP_BASE}/photo-swap/verify/${urlToken}`)
      .then((res) => res.json().then((body) => ({ status: res.status, body })))
      .then(({ status, body }) => {
        if (status !== 200) {
          setStatus('error');
          setErrorMessage(body.error || 'Invalid or expired link.');
        } else {
          setData({
            rollNo: body.rollNo,
            embeddingFiles: body.embeddingFiles,
            backupFiles: body.backupFiles,
          });
          setStatus('active');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMessage('Network error. Could not verify link.');
      });
  }, []);

  const movePhoto = (filename, direction) => {
    setData((prev) => {
      const next = { ...prev };
      if (direction === 'demote') {
        if (next.embeddingFiles.length <= MIN_EMBEDDING) {
          showToast(
            `Keep at least ${MIN_EMBEDDING} embedding photos.`,
            'error',
          );
          return prev;
        }
        next.embeddingFiles = next.embeddingFiles.filter((f) => f !== filename);
        next.backupFiles = [...next.backupFiles, filename];
      } else {
        next.backupFiles = next.backupFiles.filter((f) => f !== filename);
        next.embeddingFiles = [...next.embeddingFiles, filename];
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (data.embeddingFiles.length < MIN_EMBEDDING) {
      showToast(
        `You must maintain at least ${MIN_EMBEDDING} embedding photos.`,
        'error',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${PHOTO_SWAP_BASE}/photo-swap/apply/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmbeddingFiles: data.embeddingFiles,
          newBackupFiles: data.backupFiles,
          deletedBackupFiles: [],
          comments,
        }),
      });
      const responseData = await res.json();
      if (!res.ok)
        throw new Error(responseData.error || 'Failed to update photos.');
      setStatus('success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const CenterCard = ({ children }) => (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: theme.bg,
        fontFamily: theme.fontBody,
        padding: 20,
      }}
    >
      <style>{cssReset}</style>
      <div
        style={{
          ...styles.card,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          maxWidth: 400,
          width: '100%',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );

  if (status === 'loading') {
    return (
      <CenterCard>
        <div
          style={{
            width: 34,
            height: 34,
            margin: '0 auto 16px',
            border: `3px solid ${theme.border}`,
            borderTopColor: theme.accent,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: theme.textMuted, fontSize: 14 }}>
          Loading your photos…
        </p>
      </CenterCard>
    );
  }

  if (status === 'error') {
    return (
      <CenterCard>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            margin: '0 auto 14px',
            background: theme.dangerDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: theme.danger,
            fontWeight: 700,
          }}
        >
          !
        </div>
        <h2 style={{ color: theme.text, marginBottom: 8, fontSize: 18 }}>
          This link isn't working
        </h2>
        <p style={{ color: theme.textMuted, fontSize: 13.5, lineHeight: 1.5 }}>
          {errorMessage}
        </p>
      </CenterCard>
    );
  }

  if (status === 'success') {
    return (
      <CenterCard>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            margin: '0 auto 14px',
            background: theme.successDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            color: theme.success,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
        <h2 style={{ color: theme.text, marginBottom: 8, fontSize: 18 }}>
          Photos updated
        </h2>
        <p style={{ color: theme.textMuted, fontSize: 13.5, lineHeight: 1.5 }}>
          Your changes are saved and this link is now disabled. You can close
          this window.
        </p>
      </CenterCard>
    );
  }

  const canSubmit = data.embeddingFiles.length >= MIN_EMBEDDING && !submitting;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: theme.bg,
        fontFamily: theme.fontBody,
      }}
    >
      <style>{`
        ${cssReset}
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        /* Header is roomy on mobile (its primary audience); shrink it on
           desktop so it doesn't waste vertical space above the fold. */
        .photo-update-header { padding: 18px 16px; }
        .photo-update-header img { height: 34px; width: 34px; }
        .photo-update-header .pu-eyebrow { font-size: 11px; margin-bottom: 4px; }
        .photo-update-header .pu-title { font-size: 19px; }
        .photo-update-header .pu-roll { font-size: 13px; margin-top: 2px; }

        @media (min-width: 768px) {
          .photo-update-header { padding: 10px 16px; }
          .photo-update-header img { height: 24px; width: 24px; margin-top: 0 !important; }
          .photo-update-header .pu-eyebrow { font-size: 10px; margin-bottom: 1px; }
          .photo-update-header .pu-title { font-size: 15px; }
          .photo-update-header .pu-roll { font-size: 12px; margin-top: 0; }
        }
      `}</style>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9000,
            maxWidth: 'calc(100vw - 32px)',
            padding: '11px 20px',
            borderRadius: 10,
            fontSize: '13px',
            fontWeight: 600,
            background: toast.type === 'error' ? theme.danger : theme.success,
            color: '#ffffff',
            boxShadow: '0 4px 16px rgba(26,31,60,0.22)',
            animation: 'slideUp 0.2s ease',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header — matches Navbar.jsx's own colors (gray-900 / gray-700 / cyan-300) */}
      <div
        className="photo-update-header"
        style={{
          background: nav.bg,
          borderBottom: `1px solid ${nav.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 16px',
            minHeight: 56,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Left */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
              flex: 1,
            }}
          >
            <img
              src="/clublogo.png"
              alt="XCEED"
              style={{
                width: 32,
                height: 32,
                objectFit: 'contain',
                flexShrink: 0,
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />

            <div
              style={{
                overflow: 'hidden',
              }}
            >
              <div
                className="pu-eyebrow"
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: nav.accent,
                  fontSize: 10,
                  lineHeight: 1.1,
                }}
              >
                XCEED Attendance
              </div>

              <div
                className="pu-title"
                style={{
                  fontWeight: 700,
                  color: nav.text,
                  fontSize: 17,
                  lineHeight: 1.15,
                }}
              >
                Update Photos
              </div>
            </div>
          </div>

          {/* Right */}
          <div
            style={{
              textAlign: 'right',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#94a3b8',
              }}
            >
              Roll No.
            </div>

            <div
              style={{
                color: nav.text,
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {data.rollNo}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: '95%',
          margin: '0 auto',
          padding: '18px 16px 110px',
        }}
      >
        <p
          style={{
            fontSize: 13.5,
            color: theme.textMuted,
            lineHeight: 1.55,
            marginBottom: 20,
          }}
        >
          Move clear, front-facing photos into{' '}
          <strong style={{ color: theme.text }}>Active</strong> so the system
          recognizes you correctly. Photos in{' '}
          <strong style={{ color: theme.text }}>Backup</strong> are kept but not
          used for recognition.
        </p>

        <div
          style={{
            ...styles.card,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            marginBottom: 16,
            padding: 18,
          }}
        >
          <PhotoGroup
            token={token}
            label="Active"
            accent={theme.accent}
            hint={`Minimum ${MIN_EMBEDDING} required`}
            photos={data.embeddingFiles}
            onMove={(f) => movePhoto(f, 'demote')}
            moveLabel="Move to backup"
            moveTitle="Move to backup"
            emptyHint="No active photos yet."
          />

          <div
            style={{
              height: 1,
              background: theme.border,
              margin: '4px 0 22px',
            }}
          />

          <PhotoGroup
            token={token}
            label="Backup"
            accent={theme.warning}
            hint="Not used for recognition"
            photos={data.backupFiles}
            onMove={(f) => movePhoto(f, 'promote')}
            moveLabel="Make active"
            moveTitle="Move to active"
            emptyHint="No backup photos."
          />
        </div>

        <div
          style={{
            ...styles.card,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            padding: 18,
          }}
        >
          <label
            style={{ ...styles.label, color: theme.textMuted, marginBottom: 8 }}
          >
            Anything wrong with your photos? (optional)
          </label>
          <textarea
            style={{
              ...styles.input,
              background: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              width: '100%',
              minHeight: 84,
              resize: 'vertical',
              fontSize: 15, // prevents iOS auto-zoom on focus
            }}
            placeholder="E.g. the system keeps confusing me with someone else…"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
      </div>

      {/* Sticky action bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: theme.surface,
          borderTop: `1px solid ${theme.border}`,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          boxShadow: '0 -2px 12px rgba(26,31,60,0.06)',
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: theme.textMuted,
              flex: 1,
              lineHeight: 1.35,
            }}
          >
            {data.embeddingFiles.length} of {MIN_EMBEDDING}+ active photos
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              ...styles.btnPrimary,
              padding: '13px 26px',
              fontSize: '15px',
              minHeight: 46,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Saving…' : 'Submit changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
