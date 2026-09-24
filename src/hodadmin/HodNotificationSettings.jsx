// client/src/hodadmin/HodNotificationSettings.jsx
//
// A head of department decides what iLEED mails them.
//
// Until now every head shared one switch per alert type — the `head` row in
// Notification Settings — so a head who did not want Class Bunked could only
// have it turned off for every head in the institute. This screen is the
// per-person layer on top of that.
//
// Each switch has THREE states, not two, and the third is the important one:
//
//   Inherit — follow whatever the institute has set for heads. The default for
//             every alert, so a head who never opens this screen keeps exactly
//             the mail they got before it existed.
//   On      — send it to me even if the head role is not subscribed.
//   Off     — do not send it to me even if the head role is.
//
// The toggle shows the *effective* state so the row is never ambiguous: a
// switch sitting on Inherit still reads on or off, with a line underneath
// saying it is following the institute setting. A two-state toggle could not
// tell "off because I chose off" from "off because nobody subscribed", which
// is the difference between a setting that sticks and one that flips the next
// time an admin edits the role.
//
// What it cannot do is escape the master switch. When an admin has paused all
// outbound mail, the page says so at the top and the switches keep showing the
// choice that will apply once it resumes, rather than reading as all-off.

import { useCallback, useEffect, useState } from 'react';
import getEnvironment from '../getenvironment';
import { theme, styles } from '../attendancemodule/config';

const apiUrl = getEnvironment();
const ENDPOINT = `${apiUrl}/attendancemodule/hod/notification-preferences`;

// A pill of three buttons rather than a switch, because the setting has three
// states. `value` is the head's own choice (true / false / null = inherit).
function TriToggle({ value, inherited, disabled, onChange }) {
    const options = [
        { key: 'on',      label: 'On',      next: true  },
        { key: 'inherit', label: 'Default', next: null  },
        { key: 'off',     label: 'Off',     next: false },
    ];
    const selected = value === true ? 'on' : value === false ? 'off' : 'inherit';

    return (
        <div
            role="group"
            aria-label="Notification preference"
            style={{
                display: 'inline-flex', borderRadius: 999, padding: 3,
                background: theme.surfaceAlt, border: `1px solid ${theme.border}`,
                opacity: disabled ? 0.55 : 1,
            }}
        >
            {options.map((opt) => {
                const active = selected === opt.key;
                // "Default" carries what it resolves to, so the row reads
                // unambiguously without the caller having to explain it twice.
                const label = opt.key === 'inherit'
                    ? `Default (${inherited ? 'On' : 'Off'})`
                    : opt.label;
                return (
                    <button
                        key={opt.key}
                        type="button"
                        disabled={disabled}
                        aria-pressed={active}
                        onClick={() => onChange(opt.next)}
                        style={{
                            border: 'none', borderRadius: 999, cursor: disabled ? 'not-allowed' : 'pointer',
                            padding: '6px 13px', fontSize: 12, fontWeight: 600,
                            fontFamily: theme.fontBody, whiteSpace: 'nowrap',
                            background: active ? theme.accent : 'transparent',
                            color: active ? theme.accentText : theme.textMuted,
                        }}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

export default function HodNotificationSettings() {
    const [alerts, setAlerts] = useState(null);       // null = still loading
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState('');         // the key being saved
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const apply = useCallback((data) => {
        setAlerts(data.alerts || []);
        setEnabled(Boolean(data.notificationsEnabled));
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetch(ENDPOINT, { credentials: 'include' })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || data.message || 'Could not load your settings');
                if (!cancelled) apply(data);
            })
            .catch((err) => { if (!cancelled) { setError(err.message); setAlerts([]); } });
        return () => { cancelled = true; };
    }, [apply]);

    // One key per request. The server writes dotted paths, so a save naming one
    // switch leaves the others alone — which matters because two rows changed
    // in quick succession would otherwise race and the slower reply would put
    // back the value the faster one replaced.
    async function save(key, next) {
        setError('');
        setNotice('');
        setSaving(key);
        // Optimistic, so the pill moves under the finger rather than after the
        // round trip; the reply below replaces it with the server's own answer.
        setAlerts((prev) => (prev || []).map((a) => (a.key === key ? { ...a, personal: next } : a)));
        try {
            const response = await fetch(ENDPOINT, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertTypes: { [key]: next } }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || data.message || 'Could not save');
            apply(data);
            setNotice('Saved');
        } catch (err) {
            setError(err.message);
            // Re-read rather than guess what the stored value is now.
            fetch(ENDPOINT, { credentials: 'include' })
                .then((r) => r.json())
                .then(apply)
                .catch(() => {});
        } finally {
            setSaving('');
        }
    }

    return (
        <div style={{ ...styles.page, padding: '26px 28px' }}>
            <div style={{ ...styles.heading, marginBottom: 4 }}>Email Notifications</div>
            <div style={{ ...styles.subheading, marginBottom: 20, maxWidth: 680 }}>
                Choose which iLEED alerts reach your inbox. These settings are
                yours alone — they do not change what anyone else receives.
                Anything left on <strong>Default</strong> follows the setting
                your institute has chosen for heads of department.
            </div>

            {!enabled && (
                <div style={{
                    ...styles.card, marginBottom: 16, padding: '12px 14px',
                    background: theme.warningDim, border: `1px solid ${theme.warning}`,
                    fontSize: 13, color: theme.text,
                }}>
                    All iLEED email is currently paused by an administrator. Your
                    choices below are saved and will apply as soon as it resumes.
                </div>
            )}

            {error && (
                <div style={{
                    ...styles.card, marginBottom: 16, padding: '12px 14px',
                    background: theme.dangerDim, border: `1px solid ${theme.danger}`,
                    fontSize: 13, color: theme.text,
                }}>
                    {error}
                </div>
            )}

            {alerts === null ? (
                <div style={{ padding: 16, fontSize: 13, color: theme.textMuted }}>Loading…</div>
            ) : alerts.length === 0 ? (
                <div style={{ padding: 16, fontSize: 13, color: theme.textMuted }}>
                    No notification types are configured.
                </div>
            ) : (
                <div style={{ ...styles.card, padding: 0, maxWidth: 860 }}>
                    {alerts.map((alert, index) => (
                        <div
                            key={alert.key}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                padding: '14px 18px', flexWrap: 'wrap',
                                borderTop: index === 0 ? 'none' : `1px solid ${theme.border}`,
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 240 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>
                                    {alert.label || alert.key}
                                </div>
                                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                                    {alert.description}
                                </div>
                                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 5 }}>
                                    {alert.personal === null || alert.personal === undefined
                                        ? `Following the institute setting for heads — currently ${alert.inherited ? 'on' : 'off'}.`
                                        : alert.personal
                                            ? 'You have turned this on for yourself.'
                                            : 'You have turned this off for yourself.'}
                                    {enabled ? '' : ' (paused)'}
                                </div>
                            </div>

                            <TriToggle
                                value={alert.personal}
                                inherited={alert.inherited}
                                disabled={saving === alert.key}
                                onChange={(next) => {
                                    if (next === alert.personal) return;
                                    save(alert.key, next);
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {notice && (
                <div style={{ marginTop: 12, fontSize: 12, color: theme.success, fontWeight: 600 }}>
                    {notice}
                </div>
            )}
        </div>
    );
}
