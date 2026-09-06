// client/src/dashboard/MailConsole.jsx
//
// Which mailbox each of the platform's senders uses, and how much each has
// sent. At /superadmin/mail.
//
// Two things shape this page:
//
//  - The list of mailboxes comes from the server's environment, not from here.
//    Configure MAIL_<NAME>_USER / MAIL_<NAME>_PASS on the server and the new
//    address appears in every dropdown on the next load, with no code change
//    here or there. So the page must render sensibly for one mailbox (nothing
//    to choose — say so, rather than showing a dead dropdown) and for five.
//
//  - "Use the default" is a real, chosen state, not an empty one. It is the
//    first option in every dropdown and it names the address it resolves to,
//    because an admin deciding whether to override wants to see what they are
//    overriding.
//
// The styles come from the attendance module's config, which is where this
// platform's ops-page look is defined — same as DeployConsole.

import { useCallback, useEffect, useMemo, useState } from 'react';
import getEnvironment from '../getenvironment';
import { styles, theme, cssReset } from '../attendancemodule/config';

const apiUrl = getEnvironment();
const MAIL_URL = `${apiUrl}/api/v1/mailer`;

/** `2026-09-05` → `Fri 5 Sep`, in the reader's own locale rendering of that date. */
const dayLabel = (day) => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/**
 * A week of volume for one sender as a row of bars.
 *
 * Scaled against the busiest day *on this page*, not against each sender's own
 * peak: the question is which sender carries the load, and a per-row scale
 * would draw a sender that sent three mails exactly like one that sent three
 * thousand.
 */
function Sparkline({ days, sent, failed, peak }) {
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '34px' }}>
      {days.map((day, index) => {
        const total = (sent[index] || 0) + (failed[index] || 0);
        // A day with mail always gets a visible sliver, so "a little" never
        // renders identically to "none".
        const height = total === 0 ? 2 : Math.max(4, Math.round((total / peak) * 34));
        return (
          <div
            key={day}
            title={`${dayLabel(day)} — ${sent[index] || 0} sent${
              failed[index] ? `, ${failed[index]} failed` : ''
            }`}
            style={{
              width: '9px',
              height: `${height}px`,
              borderRadius: '2px',
              background: failed[index] ? theme.danger : total ? theme.accent : theme.border,
            }}
          />
        );
      })}
    </div>
  );
}

export default function MailConsole() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${MAIL_URL}/console`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);
      setData(body);
      setError('');
    } catch (err) {
      setError(`Could not load the mail console: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Volume, keyed by sender. A sender can have counts under more than one
     mailbox — that is what last week looks like after somebody re-routed it
     mid-week — so the rows are kept apart rather than merged. */
  const statsByPurpose = useMemo(() => {
    const map = new Map();
    (data?.stats?.rows || []).forEach((row) => {
      if (!map.has(row.purpose)) map.set(row.purpose, []);
      map.get(row.purpose).push(row);
    });
    return map;
  }, [data]);

  const peak = useMemo(() => {
    let highest = 1;
    (data?.stats?.rows || []).forEach((row) => {
      row.sent.forEach((value, index) => {
        highest = Math.max(highest, value + (row.failed[index] || 0));
      });
    });
    return highest;
  }, [data]);

  const byModule = useMemo(() => {
    const map = new Map();
    (data?.senders || []).forEach((sender) => {
      if (!map.has(sender.module)) map.set(sender.module, []);
      map.get(sender.module).push(sender);
    });
    return [...map.entries()];
  }, [data]);

  const addressOf = useCallback(
    (accountName) => data?.accounts.find((a) => a.name === accountName)?.address || accountName,
    [data],
  );

  const choose = async (sender, accountName) => {
    setSavingId(sender.id);
    setNotice('');
    try {
      const res = await fetch(`${MAIL_URL}/console/routing/${sender.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: accountName || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || `status ${res.status}`);

      // Patched in place rather than re-fetching the whole console: a reload
      // would also redraw every chart, which makes a saved dropdown look like a
      // page flicker instead of a saved dropdown.
      setData((prev) => ({
        ...prev,
        senders: prev.senders.map((row) =>
          row.id === sender.id
            ? { ...row, account: body.account, effectiveAccount: body.effectiveAccount }
            : row,
        ),
      }));
      setNotice(`${sender.label} now sends from ${body.address}`);
      setError('');
    } catch (err) {
      setError(`Could not save: ${err.message}`);
    } finally {
      setSavingId('');
    }
  };

  if (error && !data) {
    return (
      <div style={styles.page}>
        <style>{cssReset}</style>
        <h1 style={styles.heading}>Mail senders</h1>
        <div style={styles.badge('danger')}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.page}>
        <style>{cssReset}</style>
        <p style={styles.subheading}>Loading…</p>
      </div>
    );
  }

  const days = data.stats?.days || [];

  return (
    <div style={styles.page}>
      <style>{cssReset}</style>

      <h1 style={styles.heading}>Mail senders</h1>
      <p style={styles.subheading}>
        Which mailbox each part of the platform sends from, and how much each has sent in the
        last seven days. A sender left on its default uses the address shown beside it.
      </p>

      {error && <div style={{ ...styles.badge('danger'), marginBottom: '16px' }}>{error}</div>}
      {notice && <div style={{ ...styles.badge('success'), marginBottom: '16px' }}>{notice}</div>}

      {/* ── The mailboxes this server has credentials for ── */}
      <div style={{ ...styles.card, marginBottom: '20px' }}>
        <div style={styles.sectionTitle}>Available mailboxes</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {data.accounts.map((account) => (
            <div
              key={account.name}
              style={{
                ...styles.badge(account.isDefault ? 'info' : 'success'),
                display: 'inline-block',
                fontSize: '12px',
              }}
            >
              {account.address}
              {account.isDefault ? ' · platform default' : ''}
            </div>
          ))}
        </div>
        {!data.multipleAccounts && (
          <p style={{ ...styles.subheading, margin: '14px 0 0' }}>
            Only one mailbox is configured, so every sender uses it. Add
            {' '}<code>MAIL_&lt;NAME&gt;_USER</code> and <code>MAIL_&lt;NAME&gt;_PASS</code> to the
            server environment and restart — the new address appears here and in every dropdown
            below on its own.
          </p>
        )}
      </div>

      {/* ── One card per module ── */}
      {byModule.map(([moduleName, senders]) => (
        <div key={moduleName} style={{ ...styles.card, marginBottom: '20px' }}>
          <div style={styles.sectionTitle}>{moduleName}</div>

          {senders.map((sender, index) => {
            const rows = statsByPurpose.get(sender.id) || [];
            const total = rows.reduce((sum, row) => sum + row.total, 0);
            const failedTotal = rows.reduce((sum, row) => sum + row.totalFailed, 0);

            return (
              <div
                key={sender.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(220px, 2fr) minmax(200px, 1.2fr) auto',
                  gap: '16px',
                  alignItems: 'center',
                  padding: '14px 0',
                  borderTop: index === 0 ? 'none' : `1px solid ${theme.border}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{sender.label}</div>
                  <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '2px' }}>
                    {sender.description}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.textMuted,
                      marginTop: '4px',
                      fontFamily: theme.fontMono,
                    }}
                  >
                    {sender.where}
                  </div>
                </div>

                <div>
                  <label style={styles.label} htmlFor={`account-${sender.id}`}>
                    Sends from
                  </label>
                  <select
                    id={`account-${sender.id}`}
                    style={styles.select}
                    value={sender.account || ''}
                    disabled={savingId === sender.id || !data.multipleAccounts}
                    onChange={(event) => choose(sender, event.target.value)}
                  >
                    {/* Named, not blank: "default" is a choice, and the address
                        it resolves to is the thing worth reading. */}
                    <option value="">Default — {addressOf(sender.fallback)}</option>
                    {data.accounts.map((account) => (
                      <option key={account.name} value={account.name}>
                        {account.address}
                      </option>
                    ))}
                  </select>
                  {sender.updatedBy && sender.account && (
                    <div style={{ fontSize: '11px', color: theme.textMuted, marginTop: '4px' }}>
                      set by {sender.updatedBy}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '150px' }}>
                  {rows.length ? (
                    <>
                      <Sparkline
                        days={days}
                        sent={rows[0].sent.map((_, i) =>
                          rows.reduce((sum, row) => sum + row.sent[i], 0),
                        )}
                        failed={rows[0].failed.map((_, i) =>
                          rows.reduce((sum, row) => sum + row.failed[i], 0),
                        )}
                        peak={peak}
                      />
                      <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '4px' }}>
                        {total} in 7 days
                        {failedTotal ? (
                          <span style={{ color: theme.danger }}> · {failedTotal} failed</span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: theme.textMuted }}>
                      nothing sent this week
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── Day by day, every sender that actually sent ── */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Volume by day · last 7 days</div>
        {data.stats?.rows?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px', color: theme.textMuted }}>
                    Sender
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px', color: theme.textMuted }}>
                    Mailbox
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      style={{
                        textAlign: 'right',
                        padding: '8px',
                        color: theme.textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dayLabel(day)}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '8px', color: theme.textMuted }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.stats.rows.map((row) => {
                  const sender = data.senders.find((entry) => entry.id === row.purpose);
                  return (
                    <tr key={`${row.purpose}-${row.account}`}>
                      <td style={{ padding: '8px', borderTop: `1px solid ${theme.border}` }}>
                        {sender ? `${sender.module} · ${sender.label}` : row.purpose}
                      </td>
                      <td
                        style={{
                          padding: '8px',
                          borderTop: `1px solid ${theme.border}`,
                          color: theme.textMuted,
                        }}
                      >
                        {addressOf(row.account)}
                      </td>
                      {row.sent.map((value, index) => (
                        <td
                          key={days[index]}
                          style={{
                            padding: '8px',
                            textAlign: 'right',
                            borderTop: `1px solid ${theme.border}`,
                            color: value ? theme.text : theme.textMuted,
                          }}
                        >
                          {value}
                          {row.failed[index] ? (
                            <span style={{ color: theme.danger }}> +{row.failed[index]}✗</span>
                          ) : null}
                        </td>
                      ))}
                      <td
                        style={{
                          padding: '8px',
                          textAlign: 'right',
                          borderTop: `1px solid ${theme.border}`,
                          fontWeight: 700,
                        }}
                      >
                        {row.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ ...styles.subheading, margin: 0 }}>
            No mail has been sent in the last seven days — or none since counting began.
          </p>
        )}
      </div>
    </div>
  );
}
