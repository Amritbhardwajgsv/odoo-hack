import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { DEPARTMENT_LABELS, type EmployeeDetail } from '../types';
import './shared.css';
import './employees.css';

export default function MyProfilePage() {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<EmployeeDetail>('/api/me/profile')
      .then(setEmployee)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your profile'));
  }, []);

  if (!employee) {
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
            <p className="admin-page__subtitle">Your own record, read-only</p>
          </div>
        </header>

        <div className="detail-card">
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

          <div className="field-grid">
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
            <label className="field">
              <span>Phone</span>
              <input type="text" value={employee.phone ?? '—'} readOnly />
            </label>
            <label className="field">
              <span>Personal Email</span>
              <input type="text" value={employee.personalEmail ?? '—'} readOnly />
            </label>
          </div>

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
        </div>

        <p className="admin-page__note">
          To change any of this, ask your HR team &mdash; self-service here is read-only.
        </p>
      </div>
    </div>
  );
}
