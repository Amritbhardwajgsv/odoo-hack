import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import type { Employee, TimeOffAllocation, TimeOffType } from '../types';
import { endOfYearIso, startOfYearIso } from '../utils/dates';
import './shared.css';
import './employees.css';
import './timeoff.css';

const STATUS_LABELS: Record<string, string> = {
  draft: 'To Approve',
  approved: 'Approved',
  refused: 'Refused',
  expired: 'Expired',
};

export default function AllocationsPage() {
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<TimeOffAllocation[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      setAllocations(await api.get<TimeOffAllocation[]>(`/api/time-off/allocations${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load allocations');
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: 'approve' | 'refuse') {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/api/time-off/allocations/${id}/${action}`, {});
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
            <h1>Allocations</h1>
            <p className="admin-page__subtitle">
              An approved allocation is what creates usable leave balance
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search allocations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Allocated</th>
              <th>Taken</th>
              <th>Remaining</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {allocations.map((allocation) => (
              <tr key={allocation.id} onClick={() => navigate(`/allocations/${allocation.id}`)}>
                <td>{allocation.employeeName}</td>
                <td>{allocation.typeName}</td>
                <td>
                  {allocation.allocated} {allocation.unit}
                </td>
                <td>
                  {allocation.taken} {allocation.unit}
                </td>
                <td className="balance-remaining">
                  {allocation.remaining} {allocation.unit}
                </td>
                <td>
                  <span className={`leave-status leave-status--${allocation.status === 'draft' ? 'submitted' : allocation.status}`}>
                    {STATUS_LABELS[allocation.status] ?? allocation.status}
                  </span>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  {allocation.status === 'draft' ? (
                    <div className="decide">
                      <button
                        className="decide__approve"
                        disabled={busyId === allocation.id}
                        onClick={() => decide(allocation.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="decide__refuse"
                        disabled={busyId === allocation.id}
                        onClick={() => decide(allocation.id, 'refuse')}
                      >
                        Refuse
                      </button>
                    </div>
                  ) : (
                    <span className="decide__done">{allocation.validityLabel}</span>
                  )}
                </td>
              </tr>
            ))}
            {allocations.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  No allocations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Allocated minus Taken gives Remaining, and that arithmetic is done by the database so it
          cannot drift from the leave that has actually been approved.
        </p>

        {creating && (
          <NewAllocationPanel
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

function NewAllocationPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [timeOffTypeId, setTimeOffTypeId] = useState('');
  const [allocated, setAllocated] = useState('');
  // Annual allocations run for the current policy year by default - this
  // used to be hardcoded to a fixed year, so it quietly went wrong every
  // year the app kept running.
  const [validFrom, setValidFrom] = useState(startOfYearIso());
  const [validTo, setValidTo] = useState(endOfYearIso());
  const [description, setDescription] = useState('Annual leave balance granted at start of policy year.');
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/time-off/allocations', {
        employeeId,
        timeOffTypeId,
        allocated: Number(allocated),
        validFrom,
        validTo: validTo || null,
        description: description || null,
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
        <h2>New Allocation</h2>
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
              </option>
            ))}
          </select>

          <label>Allocated *</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            
            value={allocated}
            onChange={(e) => setAllocated(e.target.value)}
            required
          />

          <label>Valid From *</label>
          <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />

          <label>Valid To</label>
          <input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />

          <label>Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />

          <p className="panel__hint">
            Created awaiting approval. It only becomes usable balance once approved.
          </p>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Allocation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
