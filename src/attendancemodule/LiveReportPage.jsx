// client/src/attendancemodule/LiveReportPage.jsx
//
// The standalone live status screen, reached from the "N live" badge on the
// admin dashboard.
//
// Everything it draws now lives in LiveStatusPanel, because the same cards are
// wanted on the department-admin and head-of-department dashboards too. What
// stays here is the one thing that is genuinely this screen's own: where a
// room card goes when it is clicked, which differs by audience — an institute
// admin lands on /attendance/reports, a department admin on their own.

import { useNavigate } from 'react-router-dom';
import LiveStatusPanel from './LiveStatusPanel';

export default function LiveReportPage() {
  const navigate = useNavigate();

  return (
    <LiveStatusPanel
      variant="page"
      onOpenReport={(room, { date, slot }) => navigate('/attendance/reports', {
        state: {
          reportId:    room.reportId,
          prefillDate: date,
          prefillSlot: slot,
          prefillRoom: room.room,
        },
      })}
    />
  );
}
