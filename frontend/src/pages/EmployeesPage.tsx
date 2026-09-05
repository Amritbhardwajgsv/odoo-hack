import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  type Department,
  type Employee,
  type EmployeeStatus,
  type JobPosition,
  type WorkingSchedule,
} from '../types';
import { todayIso } from '../utils/dates';
import './shared.css';
import './employees.css';

const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract'];
const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<WorkingSchedule[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | ''>('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadEmployees() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentFilter) params.set('department', departmentFilter);
    const query = params.toString();
    try {
      setEmployees(await api.get<Employee[]>(`/api/employees${query ? `?${query}` : ''}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load employees');
    }
  }

  async function loadLookups() {
    try {
      const [positions, schedules] = await Promise.all([
        api.get<JobPosition[]>('/api/job-positions'),
        api.get<WorkingSchedule[]>('/api/working-schedules'),
      ]);
      setJobPositions(positions);
      setWorkingSchedules(schedules);
    } catch {
      // Non-fatal - the create form's dropdowns just come up empty.
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentFilter]);

  useEffect(() => {
    loadLookups();
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Employees</h1>
            <p className="admin-page__subtitle">
              {view === 'kanban'
                ? 'Default view: Kanban'
                : 'List view for sort, filter and bulk scanning'}
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search employees..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value as Department | '')}
          >
            <option value="">All departments</option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {DEPARTMENT_LABELS[department]}
              </option>
            ))}
          </select>
          <div className="view-toggle">
            <button
              className={view === 'kanban' ? 'is-active' : ''}
              onClick={() => setView('kanban')}
            >
              Kanban
            </button>
            <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
              List
            </button>
          </div>
        </div>

        {loadError && <p className="error-banner">{loadError}</p>}

        {view === 'kanban' ? (
          <div className="kanban">
            {employees.map((employee) => (
              <button
                key={employee.id}
                className="kanban-card"
                onClick={() => navigate(`/employees/${employee.id}`)}
              >
                <div className="kanban-card__top">
                  <span className="avatar">{initials(employee.fullName)}</span>
                  <div>
                    <strong>{employee.fullName}</strong>
                    <span className="kanban-card__role">
                      {employee.jobPositionTitle ?? 'No job position'}
                    </span>
                  </div>
                </div>
                <div className="kanban-card__foot">
                  <span className="kanban-card__dept">
                    {DEPARTMENT_LABELS[employee.department]}
                  </span>
                  <span
                    className={`dot-status ${employee.status === 'active' ? 'dot-status--active' : ''}`}
                  >
                    {employee.status === 'active' ? 'Active' : 'Terminated'}
                  </span>
                </div>
              </button>
            ))}
            {employees.length === 0 && <p className="empty-note">No employees found.</p>}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Work Email</th>
                <th>Job Position</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} onClick={() => navigate(`/employees/${employee.id}`)}>
                  <td>{employee.fullName}</td>
                  <td>{employee.email}</td>
                  <td>{employee.jobPositionTitle ?? '-'}</td>
                  <td>{DEPARTMENT_LABELS[employee.department]}</td>
                  <td>
                    <span
                      className={`status-pill ${employee.status === 'active' ? 'status-pill--active' : ''}`}
                    >
                      {employee.status === 'active' ? 'Active' : 'Terminated'}
                    </span>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <p className="admin-page__note">
          {view === 'kanban'
            ? 'Kanban is good for browsing; clicking a card opens the same Employee Form used everywhere else.'
            : 'The list view is the main entry point for opening a specific employee record quickly.'}
        </p>

        {creating && (
          <CreateEmployeePanel
            employees={employees}
            jobPositions={jobPositions}
            workingSchedules={workingSchedules}
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              loadEmployees();
            }}
          />
        )}
      </div>
    </div>
  );
}

function CreateEmployeePanel({
  employees,
  jobPositions,
  workingSchedules,
  onClose,
  onSaved,
}: {
  employees: Employee[];
  jobPositions: JobPosition[];
  workingSchedules: WorkingSchedule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<Department>('engineering');
  const [jobPositionId, setJobPositionId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [workingScheduleId, setWorkingScheduleId] = useState('');
  const [employeeType, setEmployeeType] = useState('full_time');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [dateJoined, setDateJoined] = useState(todayIso());
  const [workLocation, setWorkLocation] = useState('');
  const [company, setCompany] = useState('');
  const [withLogin, setWithLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/employees', {
        fullName,
        email,
        phone: phone || null,
        department,
        jobPositionId: jobPositionId || null,
        managerId: managerId || null,
        workingScheduleId: workingScheduleId || null,
        employeeType,
        status,
        dateJoined,
        workLocation: workLocation || null,
        company: company || null,
        ...(withLogin ? { account: { password, roles: ['employee'], isActive: true } } : {}),
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
        <h2>New Employee</h2>
        <form onSubmit={handleSubmit}>
          <label>Full Name *</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />

          <label>Work Email *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label>Phone</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />

          <label>Department *</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value as Department)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>

          <label>Job Position</label>
          <select value={jobPositionId} onChange={(e) => setJobPositionId(e.target.value)}>
            <option value="">None</option>
            {jobPositions.map((jp) => (
              <option key={jp.id} value={jp.id}>
                {jp.title}
              </option>
            ))}
          </select>

          <label>Manager</label>
          <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">None</option>
            {employees.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>

          <label>Working Schedule</label>
          <select value={workingScheduleId} onChange={(e) => setWorkingScheduleId(e.target.value)}>
            <option value="">None</option>
            {workingSchedules.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.totalWeeklyHours}h/week)
              </option>
            ))}
          </select>

          <label>Work Location</label>
          <input type="text" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />

          <label>Company</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />

          <label>Employee Type *</label>
          <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}>
            {EMPLOYEE_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYEE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <label>Status *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus)}>
            <option value="active">Active</option>
            <option value="terminated">Terminated</option>
          </select>

          <label>Date Joined *</label>
          <input type="date" value={dateJoined} onChange={(e) => setDateJoined(e.target.value)} required />

          <label className="inline-check">
            <input
              type="checkbox"
              checked={withLogin}
              onChange={(e) => setWithLogin(e.target.checked)}
            />
            Also create a login account
          </label>

          {withLogin && (
            <>
              <label>Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </>
          )}

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
