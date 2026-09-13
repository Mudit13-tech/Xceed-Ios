// client/src/attendancemodule/DeptRollAssignmentChart.jsx
// Admin-dashboard chart: per-department roll assignments completed vs ERP
// photos uploaded. Sourced from GET /attendancemodule/dept-admin/stats/progress
// (the same endpoint that powers DashboardProgress's per-batch breakdown,
// here rolled up to one bar pair per department).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { theme, styles } from './config';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

export default function DeptRollAssignmentChart() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/attendancemodule/dept-admin/stats/progress`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled) setRows(res.ok ? (data.groundTruthProgress || []) : []);
      } catch (_) {
        if (!cancelled) setRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ ...styles.card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Roll Assignment vs ERP Photos by Department</div>
        <button
          onClick={() => navigate('/attendance/ground-truth')}
          style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 6,
            background: theme.accentDim, color: theme.accent,
            border: `1px solid ${theme.accent}30`, cursor: 'pointer',
            fontFamily: theme.fontBody, fontWeight: 700,
          }}
        >
          Roll Assignment
        </button>
      </div>

      {!rows ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: theme.textMuted }}>
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: theme.textMuted }}>
          No ERP-backed department batches found yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(240, rows.length * 48)}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
            barCategoryGap={12}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 10, fill: theme.textMuted }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="department"
              width={150}
              tick={{ fontSize: 11, fill: theme.textMuted }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface }}
              cursor={{ fill: 'rgba(99,102,241,0.05)' }}
            />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, color: theme.textMuted, paddingTop: 8 }} />
            <Bar dataKey="erpPhotoCount" name="ERP Photos" fill={theme.accent} radius={[0, 4, 4, 0]} />
            <Bar dataKey="approvedAssignments" name="Roll Assignments Completed" fill={theme.success} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
