// client/src/attendancemodule/MenuDisabledNotice.jsx
//
// What a leadership shell shows instead of a screen an administrator has
// switched off on the Academic Administration page.
//
// The toggles used to decide which links the sidebar drew and nothing else, so
// the screen behind a disabled menu stayed reachable by typing its path or
// following an old link, and rendered as though it had been enabled. The
// server refuses its data now — see requireLeadershipMenu — and what that
// leaves without this is a page of failed fetches and empty tables, which
// reads as a broken screen rather than a closed one.
//
// Says which menu, deliberately: "Attendance Disputes is not enabled" is
// something the reader can take to whoever administers the platform, where
// "access denied" only tells them to complain.

import { theme } from './config';

/**
 * @param {object} props
 * @param {string} props.label    The menu's name, as the settings screen lists it.
 * @param {string} props.audience Who is being turned away, for the sentence.
 */
export default function MenuDisabledNotice({ label, audience }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                padding: 32,
            }}
        >
            <div style={{ maxWidth: 460, textAlign: 'center' }}>
                <h2
                    style={{
                        margin: '0 0 10px',
                        fontSize: 18,
                        fontWeight: 700,
                        color: theme.text,
                        fontFamily: theme.fontBody,
                    }}
                >
                    {label} is not switched on
                </h2>
                <p
                    style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: theme.textMuted,
                        fontFamily: theme.fontBody,
                    }}
                >
                    An administrator decides which iLEED screens {audience} can open. This
                    one is currently off, so it is not in your menu either. Ask whoever
                    administers the platform to enable it under Academic Administration.
                </p>
            </div>
        </div>
    );
}
