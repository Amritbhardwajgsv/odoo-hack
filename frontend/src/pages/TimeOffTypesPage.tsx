import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import type { TimeOffType } from '../types';
import './shared.css';
import './employees.css';
import './timeoff.css';

export default function TimeOffTypesPage() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<TimeOffType[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      setTypes(await api.get<TimeOffType[]>(`/api/time-off/types${query}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load time off types');
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Time Off Types</h1>
            <p className="admin-page__subtitle">
              Policy rules, not employee transactions &mdash; these drive how requests behave
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search time off types..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Unit</th>
              <th>Allocation</th>
              <th>Approval</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id} onClick={() => navigate(`/time-off-types/${type.id}`)}>
                <td>
                  <span className={`type-dot type-dot--${type.displayColor.toLowerCase()}`} />
                  {type.name}
                </td>
                <td>{type.unit === 'hours' ? 'Hours' : 'Days'}</td>
                <td>{type.requiresAllocation ? 'Required' : 'No'}</td>
                <td>{type.requiresApproval ? type.approvalBy : 'None'}</td>
                <td>
                  <span className={`status-pill ${type.isActive ? 'status-pill--active' : ''}`}>
                    {type.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No time off types found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          A type marked <strong>Allocation: Required</strong> means a request of that type can only
          be approved against an approved balance.
        </p>

        {creating && (
          <NewTypePanel
            onClose={() => setCreating(false)}
            onCreated={(id) => navigate(`/time-off-types/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

function NewTypePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'days' | 'hours'>('days');
  const [requiresAllocation, setRequiresAllocation] = useState(true);
  const [approvalBy, setApprovalBy] = useState('Manager');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<TimeOffType>('/api/time-off/types', {
        name,
        unit,
        requiresAllocation,
        requiresApproval: true,
        approvalBy,
        isActive: true,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(event) => event.stopPropagation()}>
        <h2>New Time Off Type</h2>
        <form onSubmit={handleSubmit}>
          <label>Type Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Paid Time Off"
            required
          />

          <label>Unit *</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'days' | 'hours')}>
            <option value="days">Days</option>
            <option value="hours">Hours</option>
          </select>

          <label>Approval By *</label>
          <select value={approvalBy} onChange={(e) => setApprovalBy(e.target.value)}>
            <option value="Manager">Manager</option>
            <option value="Officer">Officer</option>
          </select>

          <label className="inline-check">
            <input
              type="checkbox"
              checked={requiresAllocation}
              onChange={(e) => setRequiresAllocation(e.target.checked)}
            />
            Requires an allocation (balance) to approve
          </label>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
