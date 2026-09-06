import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  TIME_OFF_STATUS_LABELS,
  type Employee,
  type TimeOffRequest,
  type TimeOffType,
} from '../types';
import { todayIso } from '../utils/dates';
import './shared.css';
import './employees.css';
import './timeoff.css';

export function formatDay(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function durationLabel(duration: number, unit: 'days' | 'hours') {
  const rounded = Number(duration);
  const noun = unit === 'hours' ? 'Hour' : 'Day';
  return `${rounded} ${rounded === 1 ? noun : `${noun}s`}`;
}

export default function TimeOffPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Set by the "Time Off" smart button on an employee, so opening this
  // screen from a person lands on just their requests.
  const employeeId = searchParams.get('employeeId') ?? '';
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [search, setSearch] = useState('');
  const [myTeam, setMyTeam] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (myTeam) params.set('team', 'true');
    if (employeeId) params.set('employeeId', employeeId);
    const query = params.toString();
    try {
      setRequests(await api.get<TimeOffRequest[]>(`/api/time-off/requests${query ? `?${query}` : ''}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load requests');
    }
  }, [search, myTeam, employeeId]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Decide from the list without opening the request, then refresh so the
  // balance and status shown are the ones the server just wrote.
  async function decide(id: string, action: 'approve' | 'refuse') {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/api/time-off/requests/${id}/${action}`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Time Off Requests</h1>
            <p className="admin-page__subtitle">Approve or refuse leave, and see the balance it uses</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search requests..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            className={`filter-chip ${myTeam ? 'filter-chip--active' : ''}`}
            onClick={() => setMyTeam((value) => !value)}
            title="Only requests from people who report to you"
          >
            My Team {myTeam ? '×' : ''}
          </button>
          {employeeId && (
            <button className="filter-chip filter-chip--active" onClick={clearEmployeeFilter}>
              Employee: {employeeName ?? '...'} &times;
            </button>
          )}
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} onClick={() => navigate(`/time-off/${request.id}`)}>
                <td>{request.employeeName}</td>
                <td>{request.typeName}</td>
                <td>{formatDay(request.dateFrom)}</td>
                <td>{formatDay(request.dateTo)}</td>
                <td>{durationLabel(request.duration, request.typeUnit)}</td>
                <td>
                  <span className={`leave-status leave-status--${request.status}`}>
                    {TIME_OFF_STATUS_LABELS[request.status]}
                  </span>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  {request.status === 'submitted' ? (
                    <div className="decide">
                      <button
                        className="decide__approve"
                        disabled={busyId === request.id}
                        onClick={() => decide(request.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="decide__refuse"
                        disabled={busyId === request.id}
                        onClick={() => decide(request.id, 'refuse')}
                      >
                        Refuse
                      </button>
                    </div>
                  ) : (
                    <span className="decide__done">
                      {request.allocationLabel ?? (request.status === 'approved' ? 'no balance used' : '—')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No time off requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Approving a request that needs an allocation draws the days from that balance; refusing an
          approved one puts them back.
        </p>

        {creating && (
          <NewRequestPanel
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function NewRequestPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [timeOffTypeId, setTimeOffTypeId] = useState('');
  // Most requests start soon, so today is a sensible starting point for
  // both ends of a single-day request; the user extends dateTo as needed.
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Employee[]>('/api/employees').catch(() => []),
      api.get<TimeOffType[]>('/api/time-off/types').catch(() => []),
    ]).then(([people, leaveTypes]) => {
      setEmployees(people);
      setTypes(leaveTypes);
      if (leaveTypes[0]) setTimeOffTypeId(leaveTypes[0].id);
    });
  }, []);

  // Same rule the server applies, shown before submitting.
  const days =
    dateFrom && dateTo
      ? Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86_400_000) + 1
      : 0;
  const selectedType = types.find((type) => type.id === timeOffTypeId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/time-off/requests', {
        employeeId,
        timeOffTypeId,
        dateFrom,
        dateTo,
        reason: reason || null,
      });
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
        <h2>New Time Off Request</h2>
        <form onSubmit={handleSubmit}>
          <label>Employee *</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>

          <label>Time Off Type *</label>
          <select value={timeOffTypeId} onChange={(e) => setTimeOffTypeId(e.target.value)} required>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
                {type.requiresAllocation ? ' (uses balance)' : ''}
              </option>
            ))}
          </select>

          <label>Start Date *</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required />

          <label>End Date *</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} required />

          {days > 0 && (
            <p className="panel__hint">
              Duration: {days} {days === 1 ? 'day' : 'days'}
              {selectedType?.requiresAllocation
                ? ' — will be taken from their balance on approval.'
                : ' — this type needs no balance.'}
            </p>
          )}

          <label>Reason</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} />

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
