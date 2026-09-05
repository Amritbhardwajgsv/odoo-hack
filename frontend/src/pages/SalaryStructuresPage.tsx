import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { SalaryStructure } from '../types';
import './shared.css';
import './employees.css';
import './payroll.css';

const SALARY_MANAGERS = ['admin', 'hr_payroll_manager'];

export default function SalaryStructuresPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = (user?.roles ?? []).some((role) => SALARY_MANAGERS.includes(role));

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    try {
      setStructures(await api.get<SalaryStructure[]>(`/api/salary-structures${query}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load salary structures');
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
            <h1>Salary Structures</h1>
            <p className="admin-page__subtitle">
              Containers of Salary Rules &mdash; a structure is what a Payrun applies
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          {canManage && (
            <button className="btn btn--primary" onClick={() => setCreating(true)}>
              NEW
            </button>
          )}
          <input
            className="search-input"
            placeholder="Search salary structures..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Structure Name</th>
              <th>Rules</th>
              <th>Employees</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {structures.map((structure) => (
              <tr key={structure.id} onClick={() => navigate(`/salary-structures/${structure.id}`)}>
                <td>{structure.name}</td>
                <td>{structure.ruleCount}</td>
                <td>{structure.employeeCount}</td>
                <td>
                  <span className={`status-pill ${structure.isActive ? 'status-pill--active' : ''}`}>
                    {structure.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {structures.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No salary structures found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Employees counts running contracts using that structure. A structure used by a contract
          or a payrun cannot be deleted &mdash; mark it inactive instead.
        </p>

        {creating && (
          <NewStructurePanel
            onClose={() => setCreating(false)}
            onCreated={(id) => navigate(`/salary-structures/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

function NewStructurePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<SalaryStructure>('/api/salary-structures', {
        name,
        description: description || null,
        isActive,
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
        <h2>New Salary Structure</h2>
        <form onSubmit={handleSubmit}>
          <label>Structure Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Regular Salary"
            required
          />

          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Standard monthly salary structure"
          />

          <label>Active</label>
          <select value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
