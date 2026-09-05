import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Attendance } from '../types';
import './AttendanceWidget.css';

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// "6h 56m" between two instants - checkIn to either checkOut (finished) or
// "now" (still running, recomputed every tick).
function elapsedLabel(from: string, to: number) {
  const minutes = Math.max(0, Math.round((to - new Date(from).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${String(rest).padStart(2, '0')}`;
}

export default function AttendanceWidget() {
  const { user } = useAuth();
  const [today, setToday] = useState<Attendance | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Attendance | null>('/api/me/attendance/today')
      .then(setToday)
      .catch(() => setToday(null));
  }, []);

  // Only ticks while a session is actually running - a finished or
  // not-yet-started day has nothing that needs a live clock.
  useEffect(() => {
    if (!today || today.checkOut) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [today]);

  async function handleCheckIn() {
    setBusy(true);
    setError(null);
    try {
      setToday(await api.post<Attendance>('/api/me/attendance/check-in', {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check in');
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckOut() {
    setBusy(true);
    setError(null);
    try {
      setToday(await api.post<Attendance>('/api/me/attendance/check-out', {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check out');
    } finally {
      setBusy(false);
    }
  }

  if (today === undefined) return null; // still loading, nothing to flash

  const isActive = Boolean(today && today.checkIn && !today.checkOut);
  const isDone = Boolean(today && today.checkOut);
  const firstName = user?.employeeName?.split(' ')[0] ?? 'there';

  return (
    <div className="attendance-widget">
      <div className="attendance-widget__head">
        <span>Attendance Widget</span>
        <span className={`attendance-widget__dot ${isActive ? 'is-active' : ''}`} />
        <span className="attendance-widget__icon">
          <Clock size={16} />
        </span>
      </div>

      <p className="attendance-widget__welcome">Welcome back</p>
      <p className="attendance-widget__name">{firstName}!</p>

      {isActive && today && (
        <div className="attendance-widget__row">
          <span>
            {formatClock(today.checkIn!)} &mdash; Now
          </span>
          <b>{elapsedLabel(today.checkIn!, now)}</b>
        </div>
      )}

      {/* Shown whenever there's a banked total for today, active session or
          not - a second check-in re-opens the same day's row rather than
          losing what an earlier session already worked. */}
      {isDone && today?.workedHours != null && (
        <div className="attendance-widget__row">
          <span>Today so far</span>
          <b>{today.workedHours}h</b>
        </div>
      )}

      {!today && (
        <p className="attendance-widget__empty">You haven&apos;t checked in yet today.</p>
      )}

      {error && <p className="attendance-widget__error">{error}</p>}

      {isActive ? (
        <button className="attendance-widget__btn" disabled={busy} onClick={handleCheckOut}>
          {busy ? '...' : 'Check Out'}
        </button>
      ) : (
        <button className="attendance-widget__btn" disabled={busy} onClick={handleCheckIn}>
          {busy ? '...' : 'Check In'}
        </button>
      )}

      <p className="attendance-widget__caption">
        Work your attendance from this quick widget and review your full history from My
        Attendance.
      </p>
    </div>
  );
}
