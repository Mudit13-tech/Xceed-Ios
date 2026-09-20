// client/src/attendancemodule/ExpandableCard.jsx
//
// A section that starts folded and opens when asked.
//
// Exists because the dashboards have one thing that must be seen the moment
// the page loads — what the classrooms are doing right now — and several
// things that are worth having but not worth scrolling past every time. A
// chart that is only consulted when a number looks wrong belongs behind a
// heading you can open, not above the fold.
//
// Built on <details>/<summary> rather than a state hook so it keeps what the
// browser gives for free: keyboard operation, the disclosure semantics screen
// readers announce, and find-in-page opening a folded section to reveal a hit.
//
// `defaultOpen` is honoured on first render only. It is deliberately not a
// controlled `open`: re-rendering the parent (the live panel polls every 15s
// and re-renders its siblings with it) would otherwise snap a section the
// reader had just opened back shut.

import { theme } from './config';

export default function ExpandableCard({
    title,
    subtitle,
    // Shown on the right of the header while folded — a count or a percentage,
    // so a folded section still carries its headline and the reader can decide
    // whether opening it is worth it.
    badge,
    badgeColor,
    defaultOpen = false,
    children,
}) {
    return (
        <details
            open={defaultOpen}
            style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                marginTop: 12,
                overflow: 'hidden',
            }}
        >
            <summary
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
                    listStyle: 'none',
                }}
            >
                {/* The marker is drawn here rather than left to the browser:
                    Safari and Chrome disagree on its size and colour, and
                    list-style:none above removes it in Chrome but not Safari. */}
                <span
                    aria-hidden="true"
                    style={{
                        fontSize: 10, color: theme.textMuted, flexShrink: 0,
                        transition: 'transform .15s ease', display: 'inline-block',
                    }}
                    className="exp-card-marker"
                >
                    ▶
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text }}>{title}</div>
                    {subtitle && (
                        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>{subtitle}</div>
                    )}
                </div>
                {badge != null && badge !== '' && (
                    <span
                        style={{
                            flexShrink: 0, fontSize: 12, fontWeight: 800,
                            fontFamily: theme.fontMono,
                            padding: '3px 10px', borderRadius: 99,
                            color: badgeColor || theme.accent,
                            background: `${badgeColor || theme.accent}14`,
                            border: `1px solid ${badgeColor || theme.accent}30`,
                        }}
                    >
                        {badge}
                    </span>
                )}
            </summary>

            <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${theme.border}` }}>
                <div style={{ paddingTop: 14 }}>{children}</div>
            </div>
        </details>
    );
}

// Rotates the marker when the section is open, and hides the native one in
// browsers that ignore list-style:none. Injected once by whoever renders the
// cards — see ExpandableCard.css-in-JS consumers.
export const expandableCardCss = `
    details > summary::-webkit-details-marker { display: none; }
    details[open] > summary .exp-card-marker { transform: rotate(90deg); }
`;
