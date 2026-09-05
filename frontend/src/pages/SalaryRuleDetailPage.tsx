import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  COMPUTATION_METHODS,
  COMPUTATION_METHOD_LABELS,
  SALARY_CATEGORY_LABELS,
  type ComputationMethod,
  type SalaryCategory,
  type SalaryRule,
  type SalaryStructure,
} from '../types';
import './shared.css';
import './employees.css';
import './payroll.css';

const CATEGORIES: SalaryCategory[] = ['basic', 'allowance', 'deduction', 'contribution', 'gross', 'net'];
const SALARY_MANAGERS = ['admin', 'hr_payroll_manager'];

// The wireframe's "Percentage" label is only literally true for the
// percentage_of_* methods - showing "Amount" for fixed keeps the same field
// honest for both cases instead of mislabelling a flat rupee value.
function amountFieldLabel(method: ComputationMethod) {
  return method === 'fixed' ? 'Amount' : 'Percentage';
}

interface RuleForm {
  name: string;
  structureId: string;
  code: string;
  computationMethod: ComputationMethod;
  category: SalaryCategory;
  value: string;
  sequence: string;
  quantity: string;
  formula: string;
  isActive: boolean;
}

const BLANK_FORM: RuleForm = {
  name: '',
  structureId: '',
  code: '',
  computationMethod: 'fixed',
  category: 'allowance',
  value: '',
  sequence: '10',
  quantity: '1',
  formula: '',
  isActive: true,
};

export default function SalaryRuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = (user?.roles ?? []).some((role) => SALARY_MANAGERS.includes(role));
  const isNew = id === 'new';

  const [rule, setRule] = useState<SalaryRule | null>(null);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [form, setForm] = useState<RuleForm>(BLANK_FORM);
  const [editing, setEditing] = useState(isNew);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function hydrate(data: SalaryRule) {
    setRule(data);
    setForm({
      name: data.name,
      structureId: data.structureId,
      code: data.code,
      computationMethod: data.computationMethod,
      category: data.category,
      value: data.value === null ? '' : String(data.value),
      sequence: String(data.sequence),
      quantity: String(data.quantity),
      formula: data.formula ?? '',
      isActive: data.isActive,
    });
  }

  useEffect(() => {
    api
      .get<SalaryStructure[]>('/api/salary-structures')
      .then((rows) => {
        setStructures(rows);
        if (isNew) {
          const preset = searchParams.get('structureId');
          setForm((f) => ({ ...f, structureId: preset || rows[0]?.id || '' }));
        }
      })
      .catch(() => setStructures([]));
  }, [isNew, searchParams]);

  useEffect(() => {
    if (isNew) return;
    api
      .get<SalaryRule>(`/api/salary-rules/${id}`)
      .then(hydrate)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load salary rule'));
  }, [id, isNew]);

  function set<K extends keyof RuleForm>(field: K, value: RuleForm[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      structureId: form.structureId,
      code: form.code,
      computationMethod: form.computationMethod,
      category: form.category,
      value: form.computationMethod === 'formula' ? null : Number(form.value || 0),
      formula: form.computationMethod === 'formula' ? form.formula : null,
      sequence: Number(form.sequence || 0),
      quantity: Number(form.quantity || 1),
      isActive: form.isActive,
    };

    try {
      if (isNew) {
        const created = await api.post<SalaryRule>('/api/salary-rules', payload);
        navigate(`/salary-rules/${created.id}`, { replace: true });
      } else {
        const updated = await api.patch<SalaryRule>(`/api/salary-rules/${id}`, payload);
        hydrate(updated);
        setEditing(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!isNew && !rule) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const disabled = !editing;
  const backTarget = form.structureId ? `/salary-structures/${form.structureId}` : '/salary-rules';

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>
              <Link to="/salary-rules" className="crumb">
                Salary Rule
              </Link>{' '}
              / {isNew ? 'New' : rule!.name}
            </h1>
            <p className="admin-page__subtitle">Form view</p>
          </div>
        </header>

        {canManage && !isNew && (
          <div className="detail-actions">
            {editing ? (
              <button
                className="btn btn--ghost"
                onClick={() => {
                  hydrate(rule!);
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
          <div className="field-grid">
            <label className="field">
              <span>Rule Name</span>
              <input
                type="text"
                value={form.name}
                disabled={disabled}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Salary Structure</span>
              <select
                value={form.structureId}
                disabled={disabled}
                onChange={(e) => set('structureId', e.target.value)}
                required
              >
                {structures.map((structure) => (
                  <option key={structure.id} value={structure.id}>
                    {structure.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Code</span>
              <input
                type="text"
                value={form.code}
                disabled={disabled}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="BASIC"
                required
              />
            </label>

            <label className="field">
              <span>Computation</span>
              <select
                value={form.computationMethod}
                disabled={disabled}
                onChange={(e) => set('computationMethod', e.target.value as ComputationMethod)}
              >
                {COMPUTATION_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {COMPUTATION_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Category</span>
              <select
                value={form.category}
                disabled={disabled}
                onChange={(e) => set('category', e.target.value as SalaryCategory)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {SALARY_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            {form.computationMethod === 'formula' ? (
              <label className="field">
                <span>Python Code</span>
                <input
                  type="text"
                  value={form.formula}
                  disabled={disabled}
                  onChange={(e) => set('formula', e.target.value)}
                  placeholder="gross - PF - PT"
                />
              </label>
            ) : (
              <label className="field">
                <span>{amountFieldLabel(form.computationMethod)}</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.value}
                  disabled={disabled}
                  onChange={(e) => set('value', e.target.value)}
                  placeholder={form.computationMethod === 'fixed' ? '2000' : '50'}
                />
              </label>
            )}

            <label className="field">
              <span>Sequence</span>
              <input
                type="number"
                value={form.sequence}
                disabled={disabled}
                onChange={(e) => set('sequence', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                step="0.01"
                value={form.quantity}
                disabled={disabled}
                onChange={(e) => set('quantity', e.target.value)}
              />
            </label>

            {!isNew && (
              <label className="field">
                <span>Active</span>
                <select
                  value={form.isActive ? 'true' : 'false'}
                  disabled={disabled}
                  onChange={(e) => set('isActive', e.target.value === 'true')}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </label>
            )}
          </div>

          <section className="notes-box">
            <h3>Computation options from the source</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fixed Amount</th>
                  <th>Percentage of Wage</th>
                  <th>Python Code</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ cursor: 'default' }}>
                  <td>Uses the exact value entered, e.g. Meal Allowance = 2,000.</td>
                  <td>Calculates as a percentage of a base, e.g. HRA = 20% &times; Basic.</td>
                  <td>
                    Advanced calculations, e.g. attendance-based pay or multi-rule formulas.
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="notes-box__text" style={{ marginTop: 12 }}>
              Example expression: <code>result = gross - PF - PT</code>
            </p>
          </section>

          {(editing || isNew) && (
            <div className="panel__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : isNew ? 'Create Rule' : 'Save Rule'}
              </button>
            </div>
          )}
        </form>

        <p className="admin-page__note">
          A Salary Rule needs a clear computation method and category because these drive the
          lines shown on the final payslip. Quantity multiplies whatever the computation produces.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate(backTarget)}>
          Back
        </button>
      </div>
    </div>
  );
}
