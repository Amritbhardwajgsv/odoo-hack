import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { ATTENDANCE_STATUS_LABELS, type Attendance } from '../types';
import './shared.css';
import './employees.css';
import './attendance.css';

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MyAttendancePage() {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Attendance[]>('/api/me/attendance')
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your attendance'));
  }, []);

  const totalHours = rows.reduce((sum, row) => sum + (row.workedHours ?? 0), 0);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>My Attendance</h1>
            <p className="admin-page__subtitle">
              Check-in and check-out are recorded by your admin &mdash; this is a read-only view
              of your own record.
            </p>
          </div>
        </header>

        {error && <p className="error-banner">{error}</p>}

        <div className="payrun-summary" style={{ marginBottom: 20 }}>
          <div className="payrun-metric">
            <span>Records</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="payrun-metric">
            <span>Total worked hours</span>
            <strong>{totalHours.toFixed(1)}</strong>
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Worked Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ cursor: 'default' }}>
                <td>{new Date(row.attendanceDate).toLocaleDateString()}</td>
                <td>{formatTime(row.checkIn)}</td>
                <td>{formatTime(row.checkOut)}</td>
                <td>{row.workedHours ?? '—'}</td>
                <td>
                  <span className={`dot-status ${row.status === 'present' ? 'dot-status--active' : ''}`}>
                    {ATTENDANCE_STATUS_LABELS[row.status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No attendance recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
