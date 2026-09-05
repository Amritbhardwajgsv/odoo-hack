import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  TIME_OFF_STATUS_LABELS,
  type TimeOffAllocation,
  type TimeOffRequest,
  type TimeOffType,
} from '../types';
import { todayIso } from '../utils/dates';
import './shared.css';
import './employees.css';
import './timeoff.css';

export default function MyTimeOffPage() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [requestRows, allocationRows] = await Promise.all([
        api.get<TimeOffRequest[]>('/api/me/time-off'),
        api.get<TimeOffAllocation[]>('/api/me/allocations'),
      ]);
      setRequests(requestRows);
      setAllocations(allocationRows);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your time off');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>My Time Off</h1>
            <p className="admin-page__subtitle">Your requests and your current leave balances</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW REQUEST
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <h2 className="section-heading">My Balances</h2>
        <table className="admin-table" style={{ marginBottom: 28 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Allocated</th>
              <th>Taken</th>
              <th>Remaining</th>
              <th>Valid Until</th>
            </tr>
          </thead>
          <tbody>
            {allocations
              .filter((allocation) => allocation.status === 'approved')
              .map((allocation) => (
                <tr key={allocation.id} style={{ cursor: 'default' }}>
                  <td>
                    <span className={`type-dot type-dot--blue`} />
                    {allocation.typeName}
                  </td>
                  <td>
                    {allocation.allocated} {allocation.unit}
                  </td>
                  <td>
                    {allocation.taken} {allocation.unit}
                  </td>
                  <td className="balance-remaining">
                    {allocation.remaining} {allocation.unit}
                  </td>
                  <td>{allocation.validTo ? new Date(allocation.validTo).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            {allocations.filter((a) => a.status === 'approved').length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No approved balance yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="section-heading">My Requests</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Dates</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} style={{ cursor: 'default' }}>
                <td>{request.typeName}</td>
                <td>
                  {new Date(request.dateFrom).toLocaleDateString()} &mdash;{' '}
                  {new Date(request.dateTo).toLocaleDateString()}
                </td>
                <td>
                  {request.duration} {request.typeUnit}
                </td>
                <td>
                  <span className={`leave-status leave-status--${request.status}`}>
                    {TIME_OFF_STATUS_LABELS[request.status]}
                  </span>
                </td>
                <td>{request.reason ?? '—'}</td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  You haven&apos;t requested any time off yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {creating && (
          <NewRequestPanel
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function NewRequestPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [timeOffTypeId, setTimeOffTypeId] = useState('');
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<TimeOffType[]>('/api/me/time-off/types')
      .then((rows) => {
        setTypes(rows);
        if (rows[0]) setTimeOffTypeId(rows[0].id);
      })
      .catch(() => setError('Could not load leave types'));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/me/time-off', { timeOffTypeId, dateFrom, dateTo, reason: reason || null });
      onCreated();
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
          <label>Type *</label>
          <select value={timeOffTypeId} onChange={(e) => setTimeOffTypeId(e.target.value)} required>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>

          <label>From *</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required />

          <label>To *</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} required />

          <label>Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
          />

          {error && <p className="panel__error">{error}</p>}

          <p className="notes-box__text">
            Your request goes to your HR team for approval. If the leave type needs an allocation,
            it is deducted only once approved.
          </p>

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
