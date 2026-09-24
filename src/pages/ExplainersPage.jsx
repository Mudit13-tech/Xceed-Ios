import { useEffect, useMemo, useState } from 'react';
import getEnvironment from '../getenvironment';
import { mediaUrl } from '../utils/nativeCapabilities';

/**
 * Every explainer recording, grouped by the feature it demonstrates.
 *
 * ## Where the list comes from
 *
 * `GET /api/v1/explainers`, not a constant in this bundle. The same catalogue
 * decides which recordings appear beside a help-desk answer
 * (server/src/services/explainerVideos.js), and two copies of the list would be
 * one list and one lie the first time a video was renamed.
 *
 * ## Why nothing preloads
 *
 * Twenty-two recordings at 4-21 MB each is 222 MB. A page that let the browser
 * fetch even metadata for all of them would be unusable on the connection most
 * of its readers are on. So every player is `preload="none"` and the grid is
 * cheap until something is pressed — the cost of a click, in exchange for the
 * page being openable at all.
 *
 * Styling follows HelpdeskPage: plain CSS in one string, no theme provider and
 * no component library pulled into this route's chunk, because this is a public
 * page reachable while signed out. The dark palette hangs off the same
 * `data-theme` attribute the app's existing toggle already sets.
 */

const apiUrl = getEnvironment();
const API = `${apiUrl}/api/v1/explainers`;

const CSS = `
.xp { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc;
      --surface:#fff; --surface-alt:#f1f5f9; --secondary:#475569;
      --brand:#4f46e5; --brand-dark:#4338ca; --brand-bg:#eef2ff;
      font-family:'Inter','Segoe UI',system-ui,sans-serif; color:var(--ink);
      background:var(--bg); min-height:100vh; }
[data-theme="dark"] .xp { --ink:#e2e8f0; --muted:#94a3b8; --line:#334155;
      --bg:#0f172a; --surface:#1e293b; --surface-alt:#172033; --secondary:#cbd5e1;
      --brand:#818cf8; --brand-dark:#a5b4fc; --brand-bg:#1e1b4b; }

.xp-wrap{max-width:1080px;margin:0 auto;padding:28px 18px 64px;}
.xp-head{margin:0 0 26px;}
.xp-h1{margin:0 0 8px;font-size:clamp(1.5rem,4vw,2rem);font-weight:800;letter-spacing:-.02em;}
.xp-lede{margin:0;font-size:.95rem;line-height:1.6;color:var(--secondary);max-width:62ch;}
.xp-count{display:inline-block;margin-top:12px;font-size:.78rem;font-weight:600;
  color:var(--brand-dark);background:var(--brand-bg);border:1px solid var(--brand);
  border-radius:999px;padding:3px 11px;}

/* One row of in-page anchors, so a reader after one feature does not scroll
   past eight sections of video to reach it. */
.xp-jump{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0 0;}
.xp-jump a{font-size:.78rem;font-weight:600;text-decoration:none;color:var(--secondary);
  background:var(--surface);border:1px solid var(--line);border-radius:999px;
  padding:5px 11px;transition:all .12s;}
.xp-jump a:hover{border-color:var(--brand);color:var(--brand-dark);}

.xp-filters{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0 0;align-items:center;}
.xp-filter-label{font-size:.78rem;color:var(--muted);margin-right:3px;}
.xp-filter{font:inherit;font-size:.78rem;font-weight:600;cursor:pointer;
  color:var(--secondary);background:var(--surface);border:1px solid var(--line);
  border-radius:999px;padding:5px 13px;transition:all .12s;}
.xp-filter:hover{border-color:var(--brand);}
.xp-filter[aria-pressed="true"]{background:var(--brand);border-color:var(--brand);color:#fff;}
[data-theme="dark"] .xp-filter[aria-pressed="true"]{color:#0f172a;}

.xp-section{margin:34px 0 0;scroll-margin-top:18px;}
.xp-sec-h{margin:0 0 4px;font-size:1.12rem;font-weight:700;letter-spacing:-.01em;}
.xp-sec-blurb{margin:0 0 16px;font-size:.86rem;line-height:1.55;color:var(--muted);max-width:68ch;}

/* auto-fit rather than a fixed column count: these are screen captures of a
   full-width UI, so below ~340px of card width the thing being demonstrated
   stops being legible and one column is the honest answer. */
.xp-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));}
@media (max-width:719px){ .xp-grid{grid-template-columns:1fr;} }

.xp-card{border:1px solid var(--line);border-radius:12px;overflow:hidden;
  background:var(--surface);display:flex;flex-direction:column;}
.xp-player{display:block;width:100%;aspect-ratio:16/9;background:#000;}
.xp-meta{padding:11px 13px 13px;border-top:1px solid var(--line);}
.xp-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;
  font-weight:700;font-size:.9rem;margin:0 0 5px;}
.xp-for{font-weight:600;font-size:.67rem;letter-spacing:.04em;text-transform:uppercase;
  color:var(--brand-dark);background:var(--brand-bg);border:1px solid var(--brand);
  border-radius:999px;padding:1px 7px;}
.xp-sum{margin:0;font-size:.82rem;line-height:1.55;color:var(--secondary);}
.xp-missing{margin:6px 0 0;font-size:.76rem;color:#b45309;}

.xp-state{padding:40px 0;text-align:center;color:var(--muted);font-size:.9rem;}
.xp-retry{font:inherit;font-size:.84rem;font-weight:600;cursor:pointer;margin-top:10px;
  color:#fff;background:var(--brand);border:0;border-radius:8px;padding:8px 16px;}
`;

const AUDIENCES = [
  { id: 'all', label: 'Everything' },
  { id: 'teacher', label: 'For teachers' },
  { id: 'student', label: 'For students' },
];

function VideoCard({ video }) {
  const src = mediaUrl(video.url);
  return (
    <figure className="xp-card" style={{ margin: 0 }}>
      <video className="xp-player" controls preload="none" playsInline>
        <source src={src} type="video/mp4" />
        Your browser cannot play this video.{' '}
        <a href={src}>Download it instead.</a>
      </video>
      <figcaption className="xp-meta">
        <h3 className="xp-title">
          {video.title}
          {video.audience ? <span className="xp-for">{video.audience}</span> : null}
        </h3>
        {video.summary ? <p className="xp-sum">{video.summary}</p> : null}
        {/* The catalogue tells us when a file is not where it should be. Saying
            so beats a player that silently does nothing when pressed. */}
        {video.missing ? (
          <p className="xp-missing">This recording is not available right now.</p>
        ) : null}
      </figcaption>
    </figure>
  );
}

export default function ExplainersPage() {
  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState('all');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetch(API)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSections(data.sections || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the video list.');
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Filtering drops whole sections when nothing in them matches, rather than
  // leaving a heading over an empty grid.
  const shown = useMemo(() => {
    if (!sections) return [];
    if (audience === 'all') return sections;
    return sections
      .map((section) => ({
        ...section,
        videos: section.videos.filter((video) => video.audience === audience),
      }))
      .filter((section) => section.videos.length > 0);
  }, [sections, audience]);

  const total = useMemo(
    () => shown.reduce((n, section) => n + section.videos.length, 0),
    [shown],
  );

  return (
    <div className="xp">
      <style>{CSS}</style>
      <div className="xp-wrap">
        <header className="xp-head">
          <h1 className="xp-h1">Explainer videos</h1>
          <p className="xp-lede">
            Short screen recordings of how each part of the platform works, from
            both sides of it — what a teacher does to set something up, and what
            a student sees. Nothing loads until you press play.
          </p>

          {sections ? (
            <>
              <span className="xp-count">
                {total} {total === 1 ? 'video' : 'videos'}
              </span>

              <div className="xp-filters">
                <span className="xp-filter-label">Show:</span>
                {AUDIENCES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="xp-filter"
                    aria-pressed={audience === option.id}
                    onClick={() => setAudience(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <nav className="xp-jump" aria-label="Jump to a section">
                {shown.map((section) => (
                  <a key={section.id} href={`#${section.id}`}>{section.title}</a>
                ))}
              </nav>
            </>
          ) : null}
        </header>

        {error ? (
          <div className="xp-state">
            <div>Could not load the video list — {error}</div>
            <button
              type="button"
              className="xp-retry"
              onClick={() => setReloadKey((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : null}

        {!sections && !error ? <div className="xp-state">Loading…</div> : null}

        {sections && !error && shown.length === 0 ? (
          <div className="xp-state">No videos match that filter.</div>
        ) : null}

        {shown.map((section) => (
          <section className="xp-section" id={section.id} key={section.id}>
            <h2 className="xp-sec-h">{section.title}</h2>
            {section.blurb ? <p className="xp-sec-blurb">{section.blurb}</p> : null}
            <div className="xp-grid">
              {section.videos.map((video) => (
                <VideoCard video={video} key={video.id} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
