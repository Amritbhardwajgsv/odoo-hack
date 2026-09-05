import { useEffect, useState, type FormEvent } from 'react';
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
import './shared.css';

const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract'];
const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
};

type PanelState = { mode: 'create' } | { mode: 'edit'; employee: Employee } | null;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<WorkingSchedule[]>([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<Department | ''>('');
  const [panel, setPanel] = useState<PanelState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadEmployees() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentFilter) params.set('department', departmentFilter);
    const query = params.toString();
    try {
      setEmployees(await api.get<Employee[]>(`/api/employees${query ? `?${query}` : ''}`));
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
      // Non-fatal - the form's dropdowns just come up empty.
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, departmentFilter]);

  useEffect(() => {
    loadLookups();
  }, []);

  function closePanel() {
    setPanel(null);
  }

  function onSaved() {
    closePanel();
    loadEmployees();
  }

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <h1>Employees</h1>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setPanel({ mode: 'create' })}>
            + New Employee
          </button>
          <input
            className="search-input"
            placeholder="Search by name or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value as Department | '')}
          >
            <option value="">Department Filter</option>
            {DEPARTMENTS.map((department) => (
              <option key={department} value={department}>
                {DEPARTMENT_LABELS[department]}
              </option>
            ))}
          </select>
        </div>

        {loadError && <p className="error-banner">{loadError}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Job Position</th>
              <th>Manager</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} onClick={() => setPanel({ mode: 'edit', employee })}>
                <td>{employee.fullName}</td>
                <td>{DEPARTMENT_LABELS[employee.department]}</td>
                <td>{employee.jobPositionTitle ?? '-'}</td>
                <td>{employee.managerName ?? '-'}</td>
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

        {panel && (
          <EmployeePanel
            panel={panel}
            employees={employees}
            jobPositions={jobPositions}
            workingSchedules={workingSchedules}
            onClose={closePanel}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  );
}

function EmployeePanel({
  panel,
  employees,
  jobPositions,
  workingSchedules,
  onClose,
  onSaved,
}: {
  panel: { mode: 'create' } | { mode: 'edit'; employee: Employee };
  employees: Employee[];
  jobPositions: JobPosition[];
  workingSchedules: WorkingSchedule[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = panel.mode === 'edit';
  const editing = isEdit ? panel.employee : null;

  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [department, setDepartment] = useState<Department>(editing?.department ?? 'engineering');
  const [jobPositionId, setJobPositionId] = useState(editing?.jobPositionId ?? '');
  const [managerId, setManagerId] = useState(editing?.managerId ?? '');
  const [workingScheduleId, setWorkingScheduleId] = useState(editing?.workingScheduleId ?? '');
  const [employeeType, setEmployeeType] = useState(editing?.employeeType ?? 'full_time');
  const [status, setStatus] = useState<EmployeeStatus>(editing?.status ?? 'active');
  const [dateJoined, setDateJoined] = useState(
    editing?.dateJoined ? editing.dateJoined.slice(0, 10) : ''
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const possibleManagers = employees.filter((employee) => employee.id !== editing?.id);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = {
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
    };

    try {
      if (isEdit && editing) {
        await api.patch(`/api/employees/${editing.id}`, payload);
      } else {
        await api.post('/api/employees', payload);
      }
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
        <h2>{isEdit ? 'Edit Employee' : 'New Employee'}</h2>

        <form onSubmit={handleSubmit}>
          <label>Full Name *</label>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label>Email *</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label>Phone</label>
          <input type="text" value={phone} onChange={(event) => setPhone(event.target.value)} />

          <label>Department *</label>
          <select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {DEPARTMENT_LABELS[d]}
              </option>
            ))}
          </select>

          <label>Job Position</label>
          <select value={jobPositionId} onChange={(event) => setJobPositionId(event.target.value)}>
            <option value="">None</option>
            {jobPositions.map((jp) => (
              <option key={jp.id} value={jp.id}>
                {jp.title}
              </option>
            ))}
          </select>

          <label>Manager</label>
          <select value={managerId} onChange={(event) => setManagerId(event.target.value)}>
            <option value="">None</option>
            {possibleManagers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.fullName}
              </option>
            ))}
          </select>

          <label>Working Schedule</label>
          <select
            value={workingScheduleId}
            onChange={(event) => setWorkingScheduleId(event.target.value)}
          >
            <option value="">None</option>
            {workingSchedules.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.totalWeeklyHours}h/week)
              </option>
            ))}
          </select>

          <label>Employee Type *</label>
          <select value={employeeType} onChange={(event) => setEmployeeType(event.target.value)}>
            {EMPLOYEE_TYPES.map((type) => (
              <option key={type} value={type}>
                {EMPLOYEE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>

          <label>Status *</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatus)}>
            <option value="active">Active</option>
            <option value="terminated">Terminated</option>
          </select>

          <label>Date Joined *</label>
          <input
            type="date"
            value={dateJoined}
            onChange={(event) => setDateJoined(event.target.value)}
            required
          />

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
