import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SALARY_CATEGORY_LABELS, type SalaryRule, type SalaryStructure } from '../types';
import './shared.css';
import './employees.css';
import './payroll.css';

const SALARY_MANAGERS = ['admin', 'hr_payroll_manager'];

export default function SalaryStructureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = (user?.roles ?? []).some((role) => SALARY_MANAGERS.includes(role));

  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function hydrate(data: SalaryStructure) {
    setStructure(data);
    setForm({ name: data.name, description: data.description ?? '', isActive: data.isActive });
  }

  const load = useCallback(async () => {
    try {
      const [structureData, ruleRows] = await Promise.all([
        api.get<SalaryStructure>(`/api/salary-structures/${id}`),
        api.get<SalaryRule[]>(`/api/salary-rules?structureId=${id}`),
      ]);
      hydrate(structureData);
      setRules(ruleRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load salary structure');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<SalaryStructure>(`/api/salary-structures/${id}`, {
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
      });
      hydrate(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!structure) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>
              <Link to="/salary-structures" className="crumb">
                Salary Structure
              </Link>{' '}
              / {structure.name}
            </h1>
            <p className="admin-page__subtitle">Form view with its salary rules</p>
          </div>
        </header>

        {canManage && (
          <div className="detail-actions">
            {editing ? (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  hydrate(structure);
                  setEditing(false);
                  setError(null);
                }}
              >
                CANCEL
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={() => setEditing(true)}>
                EDIT
              </button>
            )}
          </div>
        )}

        {error && <p className="error-banner">{error}</p>}

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="payrun-form">
            <span>Structure Name</span>
            <input
              type="text"
              value={form.name}
              disabled={!editing}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <span>Active</span>
            {editing ? (
              <select
                value={form.isActive ? 'true' : 'false'}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'true' }))}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input type="text" value={structure.isActive ? 'True' : 'False'} readOnly />
            )}
          </div>

          <label className="field field--wide" style={{ marginBottom: 18 }}>
            <span>Description</span>
            <input
              type="text"
              value={editing ? form.description : form.description || '—'}
              disabled={!editing}
              placeholder="Standard monthly salary structure"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>

          {editing && (
            <div className="panel__actions" style={{ marginBottom: 10 }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Structure'}
              </button>
            </div>
          )}

          <h2 className="section-heading">Salary Rules</h2>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Rule Name</th>
                <th>Code</th>
                <th>Category</th>
                <th>Sequence</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} onClick={() => navigate(`/salary-rules/${rule.id}`)}>
                  <td>{rule.name}</td>
                  <td>{rule.code}</td>
                  <td>{SALARY_CATEGORY_LABELS[rule.category]}</td>
                  <td>{rule.sequence}</td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-row">
                    No salary rules yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <div className="panel__actions" style={{ justifyContent: 'flex-start', marginTop: 14 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate(`/salary-rules/new?structureId=${structure.id}`)}
              >
                + Add Salary Rule
              </button>
            </div>
          )}
        </form>

        <p className="admin-page__note">
          Rule order matters &mdash; keep sequence visible so participants understand the
          calculation order. Rules created here drive the final payslip.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/salary-structures')}>
          Back to Salary Structures
        </button>
      </div>
    </div>
  );
}
