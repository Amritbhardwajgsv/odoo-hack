import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SALARY_CATEGORY_LABELS, type SalaryRule, type SalaryStructure } from '../types';
import './shared.css';
import './employees.css';
import './payroll.css';

const SALARY_MANAGERS = ['admin', 'hr_payroll_manager'];

export default function SalaryRulesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = (user?.roles ?? []).some((role) => SALARY_MANAGERS.includes(role));

  const [searchParams, setSearchParams] = useSearchParams();
  const structureId = searchParams.get('structureId') ?? '';

  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (structureId) params.set('structureId', structureId);
    const query = params.toString();

    try {
      setRules(await api.get<SalaryRule[]>(`/api/salary-rules${query ? `?${query}` : ''}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load salary rules');
    }
  }, [search, structureId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<SalaryStructure[]>('/api/salary-structures')
      .then(setStructures)
      .catch(() => setStructures([]));
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Salary Rules</h1>
            <p className="admin-page__subtitle">List view</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          {canManage && (
            <button
              className="btn btn--primary"
              onClick={() => navigate(structureId ? `/salary-rules/new?structureId=${structureId}` : '/salary-rules/new')}
            >
              NEW
            </button>
          )}
          <input
            className="search-input"
            placeholder="Search salary rules..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={structureId}
            onChange={(event) => {
              const next = event.target.value;
              setSearchParams(next ? { structureId: next } : {});
            }}
          >
            <option value="">All structures</option>
            {structures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Code</th>
              <th>Category</th>
              <th>Structure</th>
              <th>Sequence</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} onClick={() => navigate(`/salary-rules/${rule.id}`)}>
                <td>{rule.name}</td>
                <td>{rule.code}</td>
                <td>{SALARY_CATEGORY_LABELS[rule.category]}</td>
                <td>{rule.structureName}</td>
                <td>{rule.sequence}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No salary rules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          List view should expose name, code, category, structure and sequence &mdash; the fields
          needed to understand a payroll rule quickly.
        </p>
      </div>
    </div>
  );
}
