import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type Department,
  type Employee,
  type EmployeeDetail,
  type EmployeeStatus,
  type JobPosition,
  type WorkingSchedule,
} from '../types';
import { initials } from './EmployeesPage';
import './shared.css';
import './employees.css';

type Tab = 'work' | 'private';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [colleagues, setColleagues] = useState<Employee[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<WorkingSchedule[]>([]);
  const [tab, setTab] = useState<Tab>('work');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get<EmployeeDetail>(`/api/employees/${id}`);
      setEmployee(data);
      setForm(toForm(data));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load employee');
    }
  }

  useEffect(() => {
    load();
    Promise.all([
      api.get<Employee[]>('/api/employees').catch(() => []),
      api.get<JobPosition[]>('/api/job-positions').catch(() => []),
      api.get<WorkingSchedule[]>('/api/working-schedules').catch(() => []),
    ]).then(([people, positions, schedules]) => {
      setColleagues(people);
      setJobPositions(positions);
      setWorkingSchedules(schedules);
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
      const updated = await api.patch<EmployeeDetail>(`/api/employees/${id}`, {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || null,
        department: form.department as Department,
        jobPositionId: form.jobPositionId || null,
        managerId: form.managerId || null,
        workingScheduleId: form.workingScheduleId || null,
        status: form.status as EmployeeStatus,
        workLocation: form.workLocation || null,
        company: form.company || null,
        personalEmail: form.personalEmail || null,
        personalPhone: form.personalPhone || null,
        address: form.address || null,
        dateOfBirth: form.dateOfBirth || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        bankAccount: form.bankAccount || null,
      });
      setEmployee((previous) => (previous ? { ...updated, counts: previous.counts } : updated));
      setForm(toForm(updated));
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!employee) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">{error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}</div>
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
              <Link to="/employees" className="crumb">
                Employee
              </Link>{' '}
              / {employee.fullName}
            </h1>
            <p className="admin-page__subtitle">Main employee form with related HR actions</p>
          </div>
        </header>

        <div className="detail-actions">
          {editing ? (
            <button
              className="btn btn--ghost"
              onClick={() => {
                setForm(toForm(employee));
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

          <div className="smart-buttons">
            <span className="smart-button">Time Off {employee.counts.timeOff}</span>
            <span className="smart-button">Contracts {employee.counts.contracts}</span>
            <span className="smart-button">Attendance {employee.counts.attendance}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="detail-identity">
            <span className="avatar avatar--lg">{initials(employee.fullName)}</span>
            <div>
              <h2>{employee.fullName}</h2>
              <p className="detail-identity__role">
                {employee.jobPositionTitle ?? 'No job position'} &bull;{' '}
                {DEPARTMENT_LABELS[employee.department]}
              </p>
              <p className="detail-identity__contact">
                {employee.email}
                {employee.phone ? ` | ${employee.phone}` : ''}
              </p>
            </div>
          </div>

          <div className="tabs">
            <button type="button" className={tab === 'work' ? 'is-active' : ''} onClick={() => setTab('work')}>
              Work Information
            </button>
            <button
              type="button"
              className={tab === 'private' ? 'is-active' : ''}
              onClick={() => setTab('private')}
            >
              Private Information
            </button>
          </div>

          {tab === 'work' ? (
            <div className="field-grid">
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

              <Field label="Manager">
                <select
                  value={form.managerId}
                  disabled={!editing}
                  onChange={(e) => set('managerId', e.target.value)}
                >
                  <option value="">None</option>
                  {colleagues
                    .filter((person) => person.id !== employee.id)
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Work Location">
                <input
                  type="text"
                  value={form.workLocation}
                  disabled={!editing}
                  onChange={(e) => set('workLocation', e.target.value)}
                />
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

              <Field label="Status">
                <select
                  value={form.status}
                  disabled={!editing}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="terminated">Terminated</option>
                </select>
              </Field>

              <Field label="Company">
                <input
                  type="text"
                  value={form.company}
                  disabled={!editing}
                  onChange={(e) => set('company', e.target.value)}
                />
              </Field>

              <Field label="Work Email">
                <input
                  type="email"
                  value={form.email}
                  disabled={!editing}
                  onChange={(e) => set('email', e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <div className="field-grid">
              <Field label="Personal Email">
                <input
                  type="email"
                  value={form.personalEmail}
                  disabled={!editing}
                  onChange={(e) => set('personalEmail', e.target.value)}
                />
              </Field>

              <Field label="Personal Phone">
                <input
                  type="text"
                  value={form.personalPhone}
                  disabled={!editing}
                  onChange={(e) => set('personalPhone', e.target.value)}
                />
              </Field>

              <Field label="Date of Birth">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  disabled={!editing}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                />
              </Field>

              <Field label="Bank Account">
                <input
                  type="text"
                  value={form.bankAccount}
                  disabled={!editing}
                  onChange={(e) => set('bankAccount', e.target.value)}
                />
              </Field>

              <Field label="Emergency Contact">
                <input
                  type="text"
                  value={form.emergencyContactName}
                  disabled={!editing}
                  onChange={(e) => set('emergencyContactName', e.target.value)}
                />
              </Field>

              <Field label="Emergency Phone">
                <input
                  type="text"
                  value={form.emergencyContactPhone}
                  disabled={!editing}
                  onChange={(e) => set('emergencyContactPhone', e.target.value)}
                />
              </Field>

              <Field label="Address" wide>
                <input
                  type="text"
                  value={form.address}
                  disabled={!editing}
                  onChange={(e) => set('address', e.target.value)}
                />
              </Field>
            </div>
          )}

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
          Smart buttons show related Contracts, Attendance and Time Off records for this employee.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/employees')}>
          Back to Employees
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field ${wide ? 'field--wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function toForm(employee: Employee): Record<string, string> {
  return {
    fullName: employee.fullName,
    email: employee.email,
    phone: employee.phone ?? '',
    department: employee.department,
    jobPositionId: employee.jobPositionId ?? '',
    managerId: employee.managerId ?? '',
    workingScheduleId: employee.workingScheduleId ?? '',
    status: employee.status,
    workLocation: employee.workLocation ?? '',
    company: employee.company ?? '',
    personalEmail: employee.personalEmail ?? '',
    personalPhone: employee.personalPhone ?? '',
    address: employee.address ?? '',
    dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
    bankAccount: employee.bankAccount ?? '',
  };
}
