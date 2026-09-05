import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type Contract,
  type ContractStatus,
  type Department,
  type JobPosition,
  type SalaryStructure,
  type WorkingSchedule,
} from '../types';
import './shared.css';
import './employees.css';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<WorkingSchedule[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get<Contract>(`/api/contracts/${id}`);
      setContract(data);
      setForm(toForm(data));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load contract');
    }
  }

  useEffect(() => {
    load();
    Promise.all([
      api.get<JobPosition[]>('/api/job-positions').catch(() => []),
      api.get<WorkingSchedule[]>('/api/working-schedules').catch(() => []),
      api.get<SalaryStructure[]>('/api/salary-structures').catch(() => []),
    ]).then(([positions, schedules, salaryStructures]) => {
      setJobPositions(positions);
      setWorkingSchedules(schedules);
      setStructures(salaryStructures);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set(field: string, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<Contract>(`/api/contracts/${id}`, {
        department: form.department as Department,
        jobPositionId: form.jobPositionId || null,
        workingScheduleId: form.workingScheduleId || null,
        salaryStructureId: form.salaryStructureId,
        wage: Number(form.wage),
        startDate: form.startDate,
        endDate: form.endDate || null,
        status: form.status as ContractStatus,
        notes: form.notes || null,
      });
      setContract(updated);
      setForm(toForm(updated));
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!contract) {
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
              <Link to="/contracts" className="crumb">
                Contract
              </Link>{' '}
              / {contract.contractNumber}
            </h1>
            <p className="admin-page__subtitle">Form view of one contract</p>
          </div>
        </header>

        <div className="detail-actions">
          {editing ? (
            <button
              className="btn btn--ghost"
              onClick={() => {
                setForm(toForm(contract));
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

          <span className={`contract-status contract-status--${contract.status}`}>
            {CONTRACT_STATUS_LABELS[contract.status]}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="field-grid">
            <Field label="Employee">
              <input type="text" value={contract.employeeName} disabled />
            </Field>

            <Field label="Department">
              <select
                value={form.department}
                disabled={!editing}
                onChange={(e) => set('department', e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {DEPARTMENT_LABELS[d]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Start Date">
              <input
                type="date"
                value={form.startDate}
                disabled={!editing}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </Field>

            <Field label="Job Position">
              <select
                value={form.jobPositionId}
                disabled={!editing}
                onChange={(e) => set('jobPositionId', e.target.value)}
              >
                <option value="">None</option>
                {jobPositions.map((jp) => (
                  <option key={jp.id} value={jp.id}>
                    {jp.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="End Date">
              <input
                type="date"
                value={form.endDate}
                disabled={!editing}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </Field>

            <Field label="Wage / Month">
              <input
                type="number"
                value={form.wage}
                disabled={!editing}
                onChange={(e) => set('wage', e.target.value)}
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                disabled={!editing}
                onChange={(e) => set('status', e.target.value)}
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CONTRACT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Working Schedule">
              <select
                value={form.workingScheduleId}
                disabled={!editing}
                onChange={(e) => set('workingScheduleId', e.target.value)}
              >
                <option value="">None</option>
                {workingSchedules.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({ws.totalWeeklyHours} Hours / Week)
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <section className="notes-box">
            <h3>Salary Structure / Notes</h3>
            <label className="notes-box__field">
              <span>Structure Type</span>
              <select
                value={form.salaryStructureId}
                disabled={!editing}
                onChange={(e) => set('salaryStructureId', e.target.value)}
              >
                {structures.map((structure) => (
                  <option key={structure.id} value={structure.id}>
                    {structure.name}
                  </option>
                ))}
              </select>
            </label>
            {editing ? (
              <input
                className="notes-box__input"
                type="text"
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Notes"
              />
            ) : (
              <p className="notes-box__text">{contract.notes || 'No notes on this contract.'}</p>
            )}
          </section>

          {error && <p className="panel__error">{error}</p>}

          {editing && (
            <div className="panel__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>

        <p className="admin-page__note">
          An employee cannot hold two running contracts covering the same period; the database
          rejects the overlap.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/contracts')}>
          Back to Contracts
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function toForm(contract: Contract): Record<string, string> {
  return {
    department: contract.department,
    jobPositionId: contract.jobPositionId ?? '',
    workingScheduleId: contract.workingScheduleId ?? '',
    salaryStructureId: contract.salaryStructureId,
    wage: String(contract.wage),
    startDate: contract.startDate ? contract.startDate.slice(0, 10) : '',
    endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
    status: contract.status,
    notes: contract.notes ?? '',
  };
}
