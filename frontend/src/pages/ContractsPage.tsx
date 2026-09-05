import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
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
  type Employee,
  type JobPosition,
  type SalaryStructure,
  type WorkingSchedule,
} from '../types';
import './shared.css';
import './employees.css';

export function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

export function formatWage(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

export default function ContractsPage() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    const query = params.toString();
    try {
      setContracts(await api.get<Contract[]>(`/api/contracts${query ? `?${query}` : ''}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load contracts');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Contracts</h1>
            <p className="admin-page__subtitle">List view of employee contracts</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search contracts..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ContractStatus | '')}
          >
            <option value="">All statuses</option>
            {CONTRACT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONTRACT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {loadError && <p className="error-banner">{loadError}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Employee</th>
              <th>Start</th>
              <th>End</th>
              <th>Wage / Month</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr key={contract.id} onClick={() => navigate(`/contracts/${contract.id}`)}>
                <td>{contract.contractNumber}</td>
                <td>{contract.employeeName}</td>
                <td>{formatDate(contract.startDate)}</td>
                <td>{formatDate(contract.endDate)}</td>
                <td>{formatWage(contract.wage)}</td>
                <td>
                  <span className={`contract-status contract-status--${contract.status}`}>
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </span>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No contracts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Contract history is retained; the running contract is listed first because payroll
          depends on it.
        </p>

        {creating && (
          <NewContractPanel
            onClose={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function NewContractPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobPositions, setJobPositions] = useState<JobPosition[]>([]);
  const [workingSchedules, setWorkingSchedules] = useState<WorkingSchedule[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);

  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState<Department>('engineering');
  const [jobPositionId, setJobPositionId] = useState('');
  const [workingScheduleId, setWorkingScheduleId] = useState('');
  const [salaryStructureId, setSalaryStructureId] = useState('');
  const [wage, setWage] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ContractStatus>('active');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Employee[]>('/api/employees').catch(() => []),
      api.get<JobPosition[]>('/api/job-positions').catch(() => []),
      api.get<WorkingSchedule[]>('/api/working-schedules').catch(() => []),
      api.get<SalaryStructure[]>('/api/salary-structures').catch(() => []),
    ]).then(([people, positions, schedules, salaryStructures]) => {
      setEmployees(people);
      setJobPositions(positions);
      setWorkingSchedules(schedules);
      setStructures(salaryStructures);
      if (salaryStructures[0]) setSalaryStructureId(salaryStructures[0].id);
    });
  }, []);

  // Picking the employee pre-fills the terms their record already implies.
  function onEmployeeChange(id: string) {
    setEmployeeId(id);
    const employee = employees.find((candidate) => candidate.id === id);
    if (!employee) return;
    setDepartment(employee.department);
    setJobPositionId(employee.jobPositionId ?? '');
    setWorkingScheduleId(employee.workingScheduleId ?? '');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/api/contracts', {
        employeeId,
        department,
        jobPositionId: jobPositionId || null,
        workingScheduleId: workingScheduleId || null,
        salaryStructureId,
        wage: Number(wage),
        startDate,
        endDate: endDate || null,
        status,
        notes: notes || null,
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
        <h2>New Contract</h2>
        <form onSubmit={handleSubmit}>
          <label>Employee *</label>
          <select value={employeeId} onChange={(e) => onEmployeeChange(e.target.value)} required>
            <option value="">Select employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>

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

          <label>Working Schedule</label>
          <select value={workingScheduleId} onChange={(e) => setWorkingScheduleId(e.target.value)}>
            <option value="">None</option>
            {workingSchedules.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.totalWeeklyHours} Hours / Week)
              </option>
            ))}
          </select>

          <label>Salary Structure *</label>
          <select
            value={salaryStructureId}
            onChange={(e) => setSalaryStructureId(e.target.value)}
            required
          >
            {structures.map((structure) => (
              <option key={structure.id} value={structure.id}>
                {structure.name}
              </option>
            ))}
          </select>

          <label>Wage / Month *</label>
          <input
            type="number"
            min="1"
            value={wage}
            onChange={(e) => setWage(e.target.value)}
            required
          />

          <label>Start Date *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <label>End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <label>Status *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ContractStatus)}>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <label>Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
