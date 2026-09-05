import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { DEPARTMENT_LABELS, type EmployeeDetail } from '../types';
import './shared.css';
import './employees.css';

// Only the "Private Information" fields from the admin employee form -
// personal contact details you own and can correct yourself. Work-side
// fields (department, manager, job position, schedule, status) are set by
// HR/Admin and stay read-only here.
interface PrivateForm {
  personalEmail: string;
  personalPhone: string;
  address: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bankAccount: string;
}

function formFrom(employee: EmployeeDetail): PrivateForm {
  return {
    personalEmail: employee.personalEmail ?? '',
    personalPhone: employee.personalPhone ?? '',
    address: employee.address ?? '',
    dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : '',
    emergencyContactName: employee.emergencyContactName ?? '',
    emergencyContactPhone: employee.emergencyContactPhone ?? '',
    bankAccount: employee.bankAccount ?? '',
  };
}

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [form, setForm] = useState<PrivateForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function hydrate(data: EmployeeDetail) {
    setEmployee(data);
    setForm(formFrom(data));
  }

  useEffect(() => {
    api
      .get<EmployeeDetail>('/api/me/profile')
      .then(hydrate)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your profile'));
  }, []);

  function set<K extends keyof PrivateForm>(field: K, value: PrivateForm[K]) {
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<EmployeeDetail>('/api/me/profile', {
        personalEmail: form.personalEmail || null,
        personalPhone: form.personalPhone || null,
        address: form.address || null,
        dateOfBirth: form.dateOfBirth || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        bankAccount: form.bankAccount || null,
      });
      hydrate(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!employee || !form) {
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
            <h1>My Profile</h1>
            <p className="admin-page__subtitle">
              Work details come from HR; your personal information below is yours to keep current
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="detail-identity">
            <span className="avatar avatar--lg">
              {employee.fullName
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h2>{employee.fullName}</h2>
              <p className="detail-identity__role">
                {employee.jobPositionTitle ?? 'No job position set'} &middot;{' '}
                {DEPARTMENT_LABELS[employee.department]}
              </p>
              <p className="detail-identity__contact">{employee.email}</p>
            </div>
          </div>

          <h3 className="section-heading" style={{ fontSize: 15 }}>
            Work Information
          </h3>
          <div className="field-grid" style={{ marginBottom: 30 }}>
            <label className="field">
              <span>Employee Code</span>
              <input type="text" value={employee.employeeCode ?? '—'} readOnly />
            </label>
            <label className="field">
              <span>Manager</span>
              <input type="text" value={employee.managerName ?? '—'} readOnly />
            </label>
            <label className="field">
              <span>Working Schedule</span>
              <input type="text" value={employee.workingScheduleName ?? '—'} readOnly />
            </label>
            <label className="field">
              <span>Employee Type</span>
              <input type="text" value={employee.employeeType} readOnly />
            </label>
            <label className="field">
              <span>Date Joined</span>
              <input type="text" value={new Date(employee.dateJoined).toLocaleDateString()} readOnly />
            </label>
            <label className="field">
              <span>Work Location</span>
              <input type="text" value={employee.workLocation ?? '—'} readOnly />
            </label>
          </div>

          <div className="detail-actions" style={{ marginBottom: 6 }}>
            <h3 className="section-heading" style={{ fontSize: 15, marginBottom: 0 }}>
              Private Information
            </h3>
            {editing ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setForm(formFrom(employee));
                  setEditing(false);
                  setError(null);
                }}
              >
                CANCEL
              </button>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                EDIT
              </button>
            )}
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Personal Email</span>
              <input
                type="email"
                value={form.personalEmail}
                disabled={!editing}
                onChange={(e) => set('personalEmail', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Personal Phone</span>
              <input
                type="text"
                value={form.personalPhone}
                disabled={!editing}
                onChange={(e) => set('personalPhone', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Date of Birth</span>
              <input
                type="date"
                value={form.dateOfBirth}
                disabled={!editing}
                onChange={(e) => set('dateOfBirth', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Bank Account</span>
              <input
                type="text"
                value={form.bankAccount}
                disabled={!editing}
                onChange={(e) => set('bankAccount', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Emergency Contact</span>
              <input
                type="text"
                value={form.emergencyContactName}
                disabled={!editing}
                onChange={(e) => set('emergencyContactName', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Emergency Phone</span>
              <input
                type="text"
                value={form.emergencyContactPhone}
                disabled={!editing}
                onChange={(e) => set('emergencyContactPhone', e.target.value)}
              />
            </label>
            <label className="field field--wide">
              <span>Address</span>
              <input
                type="text"
                value={form.address}
                disabled={!editing}
                onChange={(e) => set('address', e.target.value)}
              />
            </label>
          </div>

          {error && <p className="panel__error">{error}</p>}

          {editing && (
            <div className="panel__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          <div className="smart-buttons" style={{ marginTop: 24 }}>
            <Link className="smart-button" to="/me/attendance">
              Attendance ({employee.counts.attendance})
            </Link>
            <Link className="smart-button" to="/me/time-off">
              Time Off ({employee.counts.timeOff})
            </Link>
            <Link className="smart-button" to="/me/payslips">
              Payslips
            </Link>
          </div>
        </form>

        <p className="admin-page__note">
          Work information (department, manager, schedule, status) is set by HR and cannot be
          changed here.
        </p>
      </div>
    </div>
  );
}
