import { useState, useEffect } from 'react';
import getEnvironment from '../getenvironment';

// ── design tokens ─────────────────────────────────────────────────────────────
const T = {
    text: '#1a1f3c', textMuted: '#7b84ab', accent: '#6366f1',
    border: '#e4e8f5', bg: '#f5f6fb', fontBody: "'Inter', system-ui, sans-serif",
    success: '#10b981', danger: '#ef4444', warning: '#f59e0b',
};

const cssReset = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    code { font-family: 'IBM Plex Mono', monospace; font-size: 12px; background: #eef0fb; padding: 1px 5px; border-radius: 4px; }
`;

// ── helpers ───────────────────────────────────────────────────────────────────

function Step({ n, title, children }) {
    return (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: T.accent,
                    color: '#fff', fontWeight: 800, fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{n}</div>
                <div style={{ width: 2, flex: 1, background: '#e4e8f5', marginTop: 4 }} />
            </div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 6, paddingTop: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.75 }}>{children}</div>
            </div>
        </div>
    );
}

function Note({ type = 'info', children }) {
    const cfg = {
        info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
        warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠' },
        tip:     { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '💡' },
        key:     { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8', icon: '🔑' },
    };
    const s = cfg[type] || cfg.info;
    return (
        <div style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
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
// ── tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview',     label: 'Overview',              icon: '🗂️' },
    { id: 'setup',        label: 'Events Dashboard',      icon: '📊' },
    { id: 'design',       label: 'Certificate Design',    icon: '🎨' },
    { id: 'participants', label: 'Participants & Emails', icon: '📧' },
    { id: 'lock',         label: 'Lock & Public Page',    icon: '🔒' },
];

// ── tab content ───────────────────────────────────────────────────────────────

function TabOverview({ setTab }) {
    return (
        <div>
            <Note type="key">
                The Certificate Module lets an event organizer register an event, design one or more
                certificate templates for it, load a list of participants, and email each participant a
                unique, permanent link to their own personalised certificate — which they can view and
                download with <strong>no login required</strong>. Locking the event freezes everything so
                nothing can be altered further.
            </Note>

            <SectionTitle>What This Module Does</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {[
                    { icon: '🎨', title: 'Pre-built Templates', desc: '23 ready-made certificate designs (13 Basic + 10 Premium) — fill in text, logos, and signatures rather than building a layout from scratch.' },
                    { icon: '🖱️', title: 'Drag-to-Place Preview', desc: 'The design page shows a live preview beside the form. Drag logos, signatures, and the QR code straight onto the certificate to set their position and size.' },
                    { icon: '🏷️', title: 'Per-Type Designs', desc: 'Design a separate certificate for each type you issue — Winner, Participant, Speaker, Organizer — each saved independently.' },
                    { icon: '🔗', title: 'Merge-Field Variables', desc: 'Click a variable chip to drop {{name}}, {{department}} and the rest into the certificate body at the cursor — each certificate is auto-filled with that participant\'s own data.' },
                    { icon: '📋', title: 'Checked Excel Upload', desc: 'The participants sheet is read and checked in the browser first: missing columns, bad emails, unknown certificate types and repeated addresses are all shown before anything is saved.' },
                    { icon: '📧', title: 'Tracked Bulk Email', desc: 'Send every pending participant their certificate link in one action, with a live progress bar, a running count, and a list of any addresses that failed.' },
                    { icon: '✅', title: 'QR Verification', desc: 'Optionally stamp a QR code on the certificate that links back to its own public page, for third parties to verify authenticity.' },
                    { icon: '🔒', title: 'One-Way Lock', desc: 'Locking an event freezes all certificate and participant data on the backend — designs and participant lists become read-only.' },
                ].map(c => (
                    <div key={c.title} style={{
                        background: '#fff', border: '1px solid #e4e8f5',
                        borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12,
                    }}>
                        <span style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 4 }}>{c.title}</div>
                            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{c.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            <SectionTitle>Workflow at a Glance</SectionTitle>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: '#f8f9ff', borderRadius: 12,
                border: '1px solid #e4e8f5', overflow: 'hidden', marginBottom: 24,
            }}>
                {[
                    { n: 1, icon: '⚙️', label: 'Create Event', sub: 'Name · Date · Plan', tab: 'setup' },
                    { n: 2, icon: '🎨', label: 'Design Certificate', sub: 'Per certificate type', tab: 'design' },
                    { n: 3, icon: '📧', label: 'Add & Email Participants', sub: 'Upload · send links', tab: 'participants' },
                    { n: 4, icon: '🔒', label: 'Lock the Event', sub: 'Freeze everything', tab: 'lock' },
                ].map((s, i) => (
                    <div key={s.n} style={{
                        flex: 1, padding: '16px 14px', textAlign: 'center',
                        borderRight: i < 3 ? '1px solid #e4e8f5' : 'none',
                        cursor: 'pointer',
                    }} onClick={() => setTab(s.tab)}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: T.accent }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{s.sub}</div>
                    </div>
                ))}
            </div>

            <SectionTitle>The Three Screens You Will Use</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                {[
                    {
                        icon: '📊', title: 'Events Dashboard', color: '#6366f1', tab: 'setup',
                        route: '/cm/dashboard',
                        items: [
                            'Every event you own, with totals on top',
                            'Shows which certificate types are designed',
                            'Shows how many participants are loaded',
                            'Lock an event and track certificates issued',
                        ],
                    },
                    {
                        icon: '🎨', title: 'Certificate Design', color: '#10b981', tab: 'design',
                        route: '/cm/<eventId>',
                        items: [
                            'Form on the left, live certificate on the right',
                            'Drag logos, signatures and QR on the preview',
                            'One saved design per certificate type',
                        ],
                    },
                    {
                        icon: '📧', title: 'Participants', color: '#f59e0b', tab: 'participants',
                        route: '/cm/<eventId>/addparticipant',
                        items: [
                            'Excel batch upload, checked before saving',
                            'Manual add and inline row editing',
                            'Bulk email with live progress and failures',
                        ],
                    },
                ].map(u => (
                    <div key={u.title} onClick={() => setTab(u.tab)} style={{
                        background: '#fff', border: `1px solid ${u.color}33`,
                        borderLeft: `4px solid ${u.color}`,
                        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                    }}>
                        <div style={{ fontSize: 18, marginBottom: 6 }}>{u.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 2 }}>{u.title}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}><code>{u.route}</code></div>
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#6b7280', lineHeight: 1.75 }}>
                            {u.items.map(i => <li key={i}>{i}</li>)}
                        </ul>
                    </div>
                ))}
            </div>

            <SectionTitle>Important Notes</SectionTitle>
            <Note type="warning">
                <strong>One event campaign at a time.</strong> The <strong>Add New Event</strong> button on
                the Events Dashboard stays disabled until every one of your existing events is locked. The
                line under the button tells you how many events are still unlocked.
            </Note>
            <Note type="warning">
                <strong>Locking is one-way.</strong> Once locked, no certificate content or participant data
                can be edited, added, or deleted — this is enforced on the server, not just hidden in the UI.
            </Note>
            <Note type="tip">
                Follow the steps in order — Create Event → Certificate Design → Participants &amp; Emails →
                Lock. Design your certificate for each type <em>before</em> uploading participants of that type,
                so the merge fields render correctly.
            </Note>
        </div>
    );
}

function TabSetup() {
    return (
        <div>
            <Note type="info">
                Everything starts at the <strong>Events Dashboard</strong> (<code>/cm/dashboard</code>). It
                lists every event you own and is the launch point for the design page and the participants
                page.
            </Note>

            <SectionTitle>Creating an Event</SectionTitle>
            <Step n={1} title="Click Add New Event">
                On the dashboard header, click <strong>Add New Event</strong>. It opens the create-event form
                (<code>/cm/useraddevent</code>). The button is disabled while you still have an unlocked
                event — see the note at the end of this tab.
            </Step>
            <Step n={2} title="Fill in the Three Fields">
                Enter <strong>Event Name</strong>, <strong>Event Date</strong>, and <strong>Plan</strong>
                (Basic / Premium — defaults to Basic), then click <strong>Submit</strong>. The new event
                appears as a row on the dashboard.
            </Step>
            <Note type="info">
                <strong>Plan</strong> (Basic/Premium) is a record-keeping field only — it does not restrict
                which of the 23 certificate templates you can pick from in the design step.
            </Note>

            <SectionTitle>Reading the Dashboard — Header</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
            }}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li><strong>Help &amp; Manual</strong> — opens this manual in a new tab.</li>
                    <li><strong>Add New Event</strong> — creates your next event (see above).</li>
                    <li>A lock line under the buttons reads either <em>"All events are locked — you can create
                    a new event"</em> or <em>"Lock your N unlocked events before you can create a new one."</em></li>
                </ul>
            </div>

            <SectionTitle>Reading the Dashboard — Summary Cards</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                    { title: 'Events', desc: 'How many events you own in total.' },
                    { title: 'Locked', desc: 'How many of them are already locked and read-only.' },
                    { title: 'Participants', desc: 'Total participants added across all your events.' },
                    { title: 'Certificates Issued', desc: 'How many of those participants have been emailed their certificate.' },
                ].map(c => (
                    <div key={c.title} style={{
                        background: '#fff', border: '1px solid #e4e8f5', borderRadius: 10, padding: '12px 16px',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: T.text, marginBottom: 3 }}>{c.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{c.desc}</div>
                    </div>
                ))}
            </div>

            <SectionTitle>Reading the Dashboard — Event Table</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
            }}>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                    One row per event, with six columns:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li><strong>Event</strong> — the event name.</li>
                    <li><strong>Date</strong> — the event date, in DD/MM/YYYY.</li>
                    <li><strong>Certificate Design</strong> — one card per certificate type that already has a
                    saved design (Winner, Participant, …). Click a card to open that design. If nothing has
                    been designed yet, the column shows a <strong>Design not completed</strong> button that
                    takes you to the design page.</li>
                    <li><strong>Participant Details</strong> — a card showing the participant count with a
                    badge per certificate type (e.g. <em>winner: 6</em>). Click it to open the participants
                    page. With no participants yet it shows <strong>Participant details pending</strong>.</li>
                    <li><strong>Issued</strong> — <em>issued / total</em> with a progress bar; the bar turns
                    green at 100%.</li>
                    <li><strong>Status</strong> — a <strong>Lock</strong> button while the event is open, or a
                    red <strong>Locked</strong> badge with the lock date once locked.</li>
                </ul>
            </div>
            <Note type="tip">
                The two middle columns are your progress checklist: an event is ready to lock when both show
                teal cards rather than the orange "not completed / pending" buttons, and the Issued bar is full.
            </Note>
            <Note type="info">
                On a locked event the cards still open the same pages, but read-only — the card sub-label
                reads <strong>View</strong> instead of <strong>Edit design</strong>.
            </Note>

            <Note type="warning">
                The <strong>Add New Event</strong> button is disabled unless all of your existing events
                are locked (or you have none yet). If some are still unlocked, clicking it shows
                <em> "Action Required — Please lock all previous events before adding a new one."</em>
            </Note>
        </div>
    );
}

function TabDesign() {
    return (
        <div>
            <Note type="key">
                Certificate designs are saved <strong>per certificate type</strong> — Winner, Participant,
                Speaker, and Organizer each have their own independent design. Repeat this step once for
                every certificate type you intend to issue for the event.
            </Note>

            <SectionTitle>How the Page is Laid Out</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
            }}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li><strong>Left — the form.</strong> Every field of the certificate, top to bottom, ending
                    in <strong>Save Changes</strong>. The header card is tinted with the colour of the
                    certificate type being edited, so it is obvious which design is on screen.</li>
                    <li><strong>Right — Certificate Preview.</strong> A live render that updates as you type,
                    with the current zoom percentage in its toolbar.</li>
                    <li><strong>The divider between them can be dragged</strong> to give the form or the
                    preview more room. Double-click it — or click <strong>Reset layout</strong> — to return to
                    the default split; once focused it also responds to the arrow keys.</li>
                </ul>
            </div>

            <SectionTitle>Step-by-Step — Designing a Certificate</SectionTitle>

            <Step n={1} title="Open Certificate Design">
                From the Events Dashboard, click a certificate-type card in the <strong>Certificate Design</strong>
                column, or the <strong>Design not completed</strong> button if nothing has been designed yet.
            </Step>

            <Step n={2} title="Select Certificate Type">
                Choose <strong>Winner</strong>, <strong>Participant</strong>, <strong>Speaker</strong>, or
                <strong> Organizer</strong> at the top of the form. Everything below is saved against this
                specific type — switching the type loads (or starts) a separate design, and the header and
                preview badge change colour to match.
            </Step>

            <Step n={3} title="Name of the Institute">
                Enter one or more title lines. The pencil button beside a line opens its font size, style,
                colour, bold, and italic controls. Use <strong>Add another</strong> for multi-line titles.
            </Step>

            <Step n={4} title="Select Certificate Template">
                Pick a design from the horizontal template gallery — <strong>23 pre-built templates</strong>
                (13 Basic, 10 Premium). The selected one is outlined in blue. These are fixed layouts: the
                fields you fill in are injected into whichever template you choose.
            </Step>

            <Step n={5} title="Logos (up to 4)">
                Upload logo images (JPG/PNG only, maximum 4), then <strong>drag the logo on the preview</strong>
                to position it and drag its corner handle to resize. Numeric <strong>Vertical Position</strong>
                and <strong>Size</strong> fields are still available under the pencil button if you prefer exact
                values. The delete icon on a logo row removes it.
            </Step>

            <Step n={6} title="Department / Club and Certificate Heading">
                Fill in one or more <strong>Department or Club</strong> header lines (same styling controls),
                then the main heading text — e.g. "CERTIFICATE OF PARTICIPATION".
            </Step>

            <Step n={7} title="Body of the Certificate — Using Variables">
                Write the wording in the body editor. Click <strong>See variables</strong> to open the variable
                panel, then click any chip — <code>{'{{name}}'}</code>, <code>{'{{department}}'}</code>,
                <code>{'{{college}}'}</code>, <code>{'{{teamName}}'}</code>, <code>{'{{position}}'}</code>,
                <code>{'{{title1}}'}</code>, <code>{'{{title2}}'}</code> — and it is
                <strong> inserted straight into the body at your cursor</strong>. Each variable is replaced
                with that participant's own value when their certificate is rendered.
            </Step>

            <Note type="warning">
                A variable only fills in if the participants sheet actually carries that column, and the match
                is on the exact variable name. A variable with no matching data renders empty.
            </Note>

            <Step n={8} title="Signatures">
                Add one or more signature blocks — each with a <strong>Name</strong> and
                <strong> Position</strong> (both stylable), and an image for the signature itself.
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, lineHeight: 1.9 }}>
                    <li>Signatures are placed like logos — <strong>drag them on the preview</strong>, resize
                    from the corner, and drag the end of the separator line to change its length.</li>
                    <li><strong>Use an existing signature</strong> — reuse a signature already uploaded rather
                    than uploading it again.</li>
                    <li><strong>Remove Background</strong> — converts white pixels in the uploaded signature
                    image to transparent, so it blends into the certificate.</li>
                    <li><strong>Delete</strong> removes a signature row; on the last remaining row the button
                    reads <strong>Clear</strong> and only empties it, so there is always one row to fill in.</li>
                </ul>
            </Step>

            <Step n={9} title="QR Code with Verifiable Link">
                Turn the <strong>QR code with verifiable link</strong> switch on to stamp a QR code that links
                back to the certificate's own public page — useful for third parties verifying a certificate is
                genuine. Drag the QR on the preview to place it; the line under the switch reports its exact
                position and size, and <strong>Snap back</strong> returns it to the template's default spot.
            </Step>

            <Step n={10} title="Date of Issue and Save">
                Set the <strong>Date of issue</strong>, then click <strong>Save Changes</strong> at the bottom
                of the form. This saves the design for the selected certificate type only — switch the type and
                repeat for the next one.
            </Step>

            <Note type="tip">
                Design and save every certificate type you plan to use (e.g. both Winner and Participant)
                before uploading participants — a participant's certificate cannot render if no design exists
                for their assigned type. The dashboard shows one card per designed type, so you can check at a
                glance which are done.
            </Note>
        </div>
    );
}

function TabParticipants() {
    return (
        <div>
            <Note type="info">
                Open the <strong>Participant Details</strong> card for an event on the Events Dashboard to
                reach this page (<code>/cm/&lt;eventId&gt;/addparticipant</code>). Its header shows how many
                participants have been added so far, plus a <strong>Back to events</strong> button.
            </Note>

            <SectionTitle>Adding Participants — Batch Upload (Recommended for Bulk)</SectionTitle>
            <Step n={1} title="Download the Template">
                Click the download icon ("Download participants Excel template") to get the reference
                <code> .xlsx</code> file.
            </Step>
            <Step n={2} title="Fill in the Template">
                Enter one row per participant. Column headers:
                <div style={{
                    background: '#0f172a', color: '#e2e8f0', borderRadius: 8,
                    padding: '14px 18px', fontFamily: 'monospace', fontSize: 12,
                    margin: '10px 0', lineHeight: 1.9,
                }}>
                    name | mailId | certiType | department | college | types | teamName | position | title1 | title2
                </div>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, lineHeight: 1.9, fontSize: 13 }}>
                    <li><strong>name</strong>, <strong>mailId</strong> and <strong>certiType</strong> are
                    required; the rest are optional.</li>
                    <li><strong>certiType</strong> must be one of <code>winner</code>, <code>participant</code>,
                    <code>speaker</code>, or <code>organizer</code> — matching a certificate design you have
                    already saved for that type.</li>
                    <li>Sample row: <code>hari | harimur@gmail.com | winner | ee | nitj | … | XCEED | first</code></li>
                </ul>
            </Step>
            <Step n={3} title="Choose the File and Read the Check Report">
                Pick the completed <code>.xlsx</code>. Before anything is sent to the server the sheet is read
                in the browser and a summary appears under the file picker — see the next section.
            </Step>
            <Step n={4} title="Upload">
                Click the purple upload button. Each row becomes one participant record and the table below
                refreshes. The <strong>✕</strong> button clears the selected file if you want to start again.
            </Step>

            <SectionTitle>What the Pre-Upload Check Tells You</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
            }}>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li><strong>Row count</strong> — how many rows were found, plus a badge for how many
                    "need attention".</li>
                    <li><strong>Missing required columns</strong> — shown in red. <strong>Upload is blocked</strong>
                    until <code>name</code>, <code>mailId</code> and <code>certiType</code> are all present.</li>
                    <li><strong>Unknown columns</strong> — saved but ignored by the certificate templates, so
                    they are listed as a heads-up.</li>
                    <li><strong>Repeated email addresses</strong> — allowed; each copy gets its own certificate.</li>
                    <li><strong>Rows with problems</strong> — the first five are listed by spreadsheet row
                    number with the reason: an empty required cell, an address that is not a valid email, or a
                    <code> certiType</code> that is not one of the four allowed values.</li>
                    <li>When everything is clean you get a green line confirming every row has a name, a valid
                    email, and a known certificate type.</li>
                </ul>
            </div>
            <Note type="tip">
                Row numbers in the report match the numbers you see in Excel, so you can jump straight to the
                offending row, fix it, and re-select the file.
            </Note>

            <SectionTitle>Adding a Participant Manually</SectionTitle>
            <Step n={1} title="Open the Manual Form">
                Click <strong>+ Add Participant Manually</strong>.
            </Step>
            <Step n={2} title="Fill in the Fields">
                Name, Department, College, Type, Team Name, Position, Title-1, Title-2, Email, and Certificate
                Type (Winner / Participant / Speaker / Organizer). Only <strong>Name</strong>,
                <strong> Certificate Type</strong>, and <strong>E-mail</strong> are required; a missing one
                raises a toast naming the field.
            </Step>
            <Step n={3} title="Save">
                Click <strong>Save New Participant Data</strong>. The button reads <em>Saving…</em> and is
                disabled while the save is in flight, so a double click cannot create the participant twice.
                On success the form is cleared, ready for the next entry, and the participant appears in the
                table below.
            </Step>

            <SectionTitle>Participants Table</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 16,
            }}>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                    Each row shows the participant's details plus:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li><strong>Certificate Link</strong> — a "View" link to that participant's public certificate page.</li>
                    <li><strong>Mail Status</strong> — Sent (green) or Not sent (red).</li>
                    <li><strong>Actions</strong> — edit (pencil), delete (trash), and send-mail (envelope) for
                    that one participant. Editing happens inline: the row's cells turn into inputs and a save
                    button appears.</li>
                </ul>
            </div>

            <SectionTitle>Sending Certificate Emails</SectionTitle>
            <Step n={1} title="Send to Everyone Pending">
                Click the mail icon above the table ("Send email to all participants"). It counts everyone
                whose mail status is still <em>Not sent</em> and asks you to confirm — e.g. <em>"Send
                certificates to 42 participants?"</em>. If everybody already has theirs, it simply says there
                is nothing to send.
            </Step>
            <Step n={2} title="Watch the Progress Panel">
                A panel appears above the table with a progress bar, <em>"Sending certificates — 12 of 42"</em>,
                a percentage, and the address currently being mailed. Emails go out one participant at a time
                and each is marked as sent as it succeeds, so you can see exactly how far the run has got. The
                bulk-mail button stays disabled until it finishes.
            </Step>
            <Step n={3} title="Check the Result">
                When the run ends the panel reports how many of the total were sent. Any address that failed is
                listed under <strong>Could not send to:</strong> and the closing toast turns orange rather than
                green. Those participants keep their <em>Not sent</em> status, so clicking bulk mail again
                retries exactly them.
            </Step>
            <Step n={4} title="Send to One Participant">
                Use the per-row envelope icon to (re)send the email to just that participant.
            </Step>
            <Note type="tip">
                Bulk sending is safe to repeat — it only ever mails participants marked <em>Not sent</em>, so
                you can re-click it after adding new participants without spamming everyone else again.
            </Note>
        </div>
    );
}

function TabLock() {
    return (
        <div>
            <SectionTitle>The Public Certificate Page</SectionTitle>
            <div style={{
                background: '#f8f9ff', border: '1px solid #e4e8f5',
                borderRadius: 10, padding: '16px 20px', marginBottom: 20,
            }}>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 10 }}>
                    Each participant's certificate email contains a unique link
                    (<code>/cm/c/&lt;eventId&gt;/&lt;participantId&gt;</code>) to a public page — no login
                    is required to view it.
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li>The page loads the saved design for that participant's certificate type and fills
                    in their name, department, college, and other merge-field values.</li>
                    <li>If QR verification was enabled at design time, a QR code pointing back to this same
                    page is rendered on the certificate.</li>
                    <li>A <strong>Download Image</strong> button rasterises the on-screen certificate and
                    downloads it as a PNG file.</li>
                </ul>
            </div>
            <Note type="info">
                The link itself is the only thing that keeps a certificate private-ish — anyone who has the
                link can view and download that certificate without logging in. Only share it via the
                participant's own email.
            </Note>

            <SectionTitle>Locking an Event</SectionTitle>
            <Step n={1} title="When to Lock">
                Lock an event once you've finished designing all certificate types, added all participants,
                and sent all certificate emails. The dashboard row is your checklist: design cards present,
                participant card present, and the Issued bar full.
            </Step>
            <Step n={2} title="Click the Lock Button">
                On the Events Dashboard, click <strong>Lock</strong> in the Status column for the event. A
                confirmation dialog appears: <em>"Sure? You wont be able to edit any content once locked!"</em>
            </Step>
            <Step n={3} title="Confirm">
                Confirming sets the event to locked. The Status column now shows a red <strong>Locked</strong>
                badge with the date, and the Locked summary card at the top of the dashboard goes up by one.
            </Step>

            <Note type="warning">
                <strong>Locking is enforced on the server, not just the UI.</strong> Once locked, every
                mutating action — editing certificate designs, and adding, editing, batch-uploading, or
                deleting participants — is rejected with "Event Locked". Treat it as final: lock only when the
                event is genuinely finished.
            </Note>
            <Note type="info">
                A locked event stays fully readable. Its design cards and participant card still open the same
                pages in view-only mode, and participants' certificate links keep working.
            </Note>
            <Note type="tip">
                Locking every open event is also what re-enables <strong>Add New Event</strong>, so it is the
                normal way to close out one campaign and start the next.
            </Note>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CertManual({ standalone = false }) {
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
        overview:     <TabOverview setTab={setTab} />,
        setup:        <TabSetup />,
        design:       <TabDesign />,
        participants: <TabParticipants />,
        lock:         <TabLock />,
    };

    const activeIdx = TABS.findIndex(t => t.id === tab);

    return (
        <>
            <style>{cssReset}</style>
            {standalone && (
                <div style={{
                    position: 'sticky', top: 0, zIndex: 100,
                    background: '#1e1b4b', borderBottom: '1px solid #312e81',
                    padding: '10px 28px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15,
                        }}>📖</div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e0e7ff' }}>
                            Certificate Module — User Manual
                        </span>
                    </div>
                    {isAuthenticated && (
                        <a href="/cm/dashboard" style={{
                            fontSize: 13, fontWeight: 600, color: '#a5b4fc',
                            textDecoration: 'none', padding: '6px 14px',
                            border: '1px solid #4338ca', borderRadius: 7,
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = '#312e81'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            ← Go to Dashboard
                        </a>
                    )}
                </div>
            )}
            <div style={{
                padding: '24px 28px', maxWidth: 900, margin: '0 auto',
                fontFamily: T.fontBody,
            }}>
                {/* Header */}
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                    }}>📖</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: T.text }}>Certificate Module — User Manual</div>
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
                            Step-by-step guide · XCEED, NIT Jalandhar
                        </div>
                    </div>
                </div>

                {/* Step navigator */}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
                    {TABS.map((t, i) => {
                        const active = tab === t.id;
                        const done = activeIdx > i;
                        const bgColor = active ? T.accent : done ? '#10b981' : '#f1f5f9';
                        const numColor = active || done ? '#fff' : '#94a3b8';
                        const labelColor = active ? T.accent : done ? '#10b981' : T.textMuted;
                        return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', flex: i < TABS.length - 1 ? 1 : 'none', minWidth: 0 }}>
                                <div
                                    onClick={() => setTab(t.id)}
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', minWidth: 72, flexShrink: 0 }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: bgColor,
                                        border: active ? `2px solid ${T.accent}` : done ? '2px solid #10b981' : '2px solid #e2e8f0',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 800, color: numColor,
                                        transition: 'all .2s', flexShrink: 0,
                                        boxShadow: active ? `0 0 0 4px ${T.accent}18` : 'none',
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

                {/* Content */}
                <div style={{
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e4e8f5',
                    padding: '28px 32px',
                    boxShadow: '0 1px 6px rgba(26,31,60,0.05)',
                }}>
                    {TAB_CONTENT[tab]}
                </div>
            </div>
        </>
    );
}
