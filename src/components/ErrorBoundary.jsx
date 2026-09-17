import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * The only place in this app that catches a render-time crash — there is no
 * error-monitoring service wired in (no Sentry/Bugsnag), so console.error is
 * the whole of what gets recorded.
 *
 * Deliberately class-based: getDerivedStateFromError/componentDidCatch have
 * no hook equivalent. Deliberately self-contained (no Chakra, no lazy
 * imports) — the fallback has to render even when something else in the
 * bundle is what broke.
 *
 * Only catches render/lifecycle/effect errors, per React's own contract —
 * not event handlers and not code inside a promise's .then(). Those still
 * need their own try/catch at the call site.
 */
class ErrorBoundaryImpl extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  // Clearing the flag rather than being rebuilt around it — see the wrapper.
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1a1f3c', margin: 0 }}>
          Something went wrong.
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 420, margin: 0 }}>
          This page hit an unexpected error. Use the menu above to go elsewhere, or reload.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#1a1f3c',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Clears a stuck error whenever the route changes — otherwise `hasError` stays
 * true, and clicking a still-working navbar link to escape would just show the
 * same fallback for the new page too, since the class instance survives the
 * navigation.
 *
 * The pathname is handed down as an ordinary prop, not as `key`. It was a `key`
 * first, and because this boundary wraps the entire route table in App.jsx, a
 * changed URL threw away and rebuilt every mounted component under it — layout
 * shells included. That is what made the learning module's rail drop back to
 * its skeleton and re-read `me`, `overview` and the class list on every click
 * (#2413). Resetting one boolean does the same job for the case the key was
 * there for, and leaves the tree alone for every other navigation.
 */
export default function ErrorBoundary({ children }) {
  const location = useLocation();
  return <ErrorBoundaryImpl resetKey={location.pathname}>{children}</ErrorBoundaryImpl>;
}
