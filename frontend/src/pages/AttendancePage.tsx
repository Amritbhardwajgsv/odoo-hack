import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import {
  ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_LABELS,
  type Attendance,
  type AttendanceStatus,
  type Employee,
} from '../types';
import './shared.css';
import './employees.css';
import './attendance.css';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const { user } = useAuth();
  // Only an admin may touch their own attendance; everyone else needs an
  // admin to do it, so their own rows are shown but not editable.
  const isAdmin = user?.roles.includes('admin') ?? false;
  const ownEmployeeId = user?.employeeId;
  const canEdit = (record: Attendance) => isAdmin || record.employeeId !== ownEmployeeId;

  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = searchParams.get('employeeId') ?? '';
  const [employeeName, setEmployeeName] = useState<string | null>(null);

  const [records, setRecords] = useState<Attendance[]>([]);
  const [search, setSearch] = useState('');
  // Empty means every date; the API takes any day, not just today.
  const [dateFilter, setDateFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Attendance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (employeeId) params.set('employeeId', employeeId);
    if (dateFilter) params.set('date', dateFilter);
    const query = params.toString();
    try {
      setRecords(await api.get<Attendance[]>(`/api/attendance${query ? `?${query}` : ''}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load attendance');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, dateFilter, employeeId]);

  useEffect(() => {
    if (!employeeId) {
      setEmployeeName(null);
      return;
    }
    api
      .get<Employee>(`/api/employees/${employeeId}`)
      .then((employee) => setEmployeeName(employee.fullName))
      .catch(() => setEmployeeName(null));
  }, [employeeId]);

  function clearEmployeeFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('employeeId');
    setSearchParams(next);
  }

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Attendance</h1>
            <p className="admin-page__subtitle">List view of employee attendance records</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search attendance..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="date-filter">
            <label htmlFor="attendance-date">Date</label>
            <input
              id="attendance-date"
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
            <button type="button" onClick={() => setDateFilter(todayIso())}>
              Today
            </button>
            {dateFilter && (
              <button type="button" onClick={() => setDateFilter('')}>
                Clear
              </button>
            )}
          </div>
          {employeeId && (
            <button className="filter-chip filter-chip--active" onClick={clearEmployeeFilter}>
              Employee: {employeeName ?? '...'} &times;
            </button>
          )}
        </div>

        {loadError && <p className="error-banner">{loadError}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Worked Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                className={canEdit(record) ? '' : 'row--locked'}
                onClick={() => canEdit(record) && setEditing(record)}
                title={canEdit(record) ? undefined : 'Only an admin can correct your own attendance'}
              >
                <td>
                  {record.employeeName}
                  {!canEdit(record) && <span className="lock-tag">your record</span>}
                  <span className="attendance-date"> &bull; {formatDate(record.attendanceDate)}</span>
                </td>
                <td>{formatTime(record.checkIn)}</td>
                <td>{formatTime(record.checkOut)}</td>
                <td>{(record.workedHours ?? 0).toFixed(2)}</td>
                <td>
                  <span className={`attendance-status attendance-status--${record.status}`}>
                    {ATTENDANCE_STATUS_LABELS[record.status]}
                  </span>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No attendance records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          {dateFilter
            ? `Showing ${formatDate(dateFilter)} only — clear the date to see every record.`
            : 'Showing all dates. Pick a date to narrow the list, or use Today for this shift.'}{' '}
          A dash in Check In or Check Out means the punch is missing.
        </p>

        {employeeId && (
          <Link to="/employees" className="crumb">
            &larr; Back to Employees
          </Link>
        )}

        {creating && (
          <AttendancePanel
            defaultEmployeeId={employeeId}
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              load();
            }}
          />
        )}

        {editing && (
          <AttendancePanel
            record={editing}
            defaultEmployeeId={editing.employeeId}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function toTimeInput(value: string | null) {
  if (!value) return '';
  return new Date(value).toTimeString().slice(0, 5);
}

function AttendancePanel({
  record,
  defaultEmployeeId,
  onClose,
  onSaved,
}: {
  record?: Attendance;
  defaultEmployeeId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState(record?.employeeId ?? defaultEmployeeId ?? '');
  const [attendanceDate, setAttendanceDate] = useState(
    record ? record.attendanceDate.slice(0, 10) : todayIso()
  );
  const [checkIn, setCheckIn] = useState(toTimeInput(record?.checkIn ?? null));
  const [checkOut, setCheckOut] = useState(toTimeInput(record?.checkOut ?? null));
  const [status, setStatus] = useState<AttendanceStatus>(record?.status ?? 'present');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Employee[]>('/api/employees')
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        employeeId,
        attendanceDate,
        checkIn: checkIn ? `${attendanceDate}T${checkIn}:00` : null,
        checkOut: checkOut ? `${attendanceDate}T${checkOut}:00` : null,
        status,
        notes: notes || null,
      };
      if (record) {
        await api.patch(`/api/attendance/${record.id}`, payload);
      } else {
        await api.post('/api/attendance', payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(event) => event.stopPropagation()}>
        <h2>{record ? 'Edit Attendance' : 'New Attendance'}</h2>
        <form onSubmit={handleSubmit}>
          <label>Employee *</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            disabled={!!defaultEmployeeId && !record}
            required
          >
            <option value="">Select employee</option>
            {employees
              .filter((employee) => isAdmin || employee.id !== user?.employeeId)
              .map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
          </select>

          <label>Date *</label>
          <input
            type="date"
            value={attendanceDate}
            onChange={(e) => setAttendanceDate(e.target.value)}
            required
          />

          <label>Check In</label>
          <input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />

          <label>Check Out</label>
          <input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />

          <label>Status *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ATTENDANCE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : record ? 'Save Changes' : 'Create Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
