import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SquarePen } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  PAYRUN_STATUS_LABELS,
  type Department,
  type EligibleEmployee,
  type Payrun,
  type SalaryStructure,
} from '../types';
import './shared.css';
import './employees.css';
import './payroll.css';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// A payroll period is a calendar range, not an instant. The API sends these
// date-only columns as UTC midnight, so putting them through a local Date
// would show 31-Dec-2025 for a 01-Jan-2026 period anywhere west of UTC.
// Read the calendar parts straight off the string instead.
function calendarParts(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

// "01-Jan-2026", the format the payroll wireframe uses.
export function formatPeriodDate(value: string) {
  const { year, month, day } = calendarParts(value);
  if (!year || !month || !day) return '—';
  return `${String(day).padStart(2, '0')}-${MONTHS[month - 1]}-${year}`;
}

export function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

function warningLabel(payrun: Payrun) {
  const total = payrun.warningCount + payrun.uncomputedCount;
  if (total === 0) return 'No warnings';
  return `${total} warning${total === 1 ? '' : 's'}`;
}

export default function PayrunsPage() {
  const navigate = useNavigate();
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (year) params.set('year', year);
    const query = params.toString();

    try {
      setPayruns(await api.get<Payrun[]>(`/api/payruns${query ? `?${query}` : ''}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payruns');
    }
  }, [search, year]);

  useEffect(() => {
    load();
  }, [load]);

  // The year chip offers only years that actually have a payrun, so it can
  // never filter the list down to nothing.
  useEffect(() => {
    api
      .get<number[]>('/api/payruns/years')
      .then(setYears)
      .catch(() => setYears([]));
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Payruns</h1>
            <p className="admin-page__subtitle">Payrun view for payroll periods</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search payruns..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">All years</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="payrun-list">
          {payruns.map((payrun) => (
            <Link key={payrun.id} to={`/payruns/${payrun.id}`} className="payrun-card">
              <div>
                <span className="payrun-card__name">{payrun.name}</span>
                <span className="payrun-card__period">
                  {formatPeriodDate(payrun.periodStart)} &mdash;{' '}
                  {formatPeriodDate(payrun.periodEnd)}
                </span>
              </div>

              <span className="payrun-card__count">
                {payrun.employeeCount} employee{payrun.employeeCount === 1 ? '' : 's'}
              </span>

              <span className="payrun-card__state">
                <span className={`payrun-status payrun-status--${payrun.status}`}>
                  {PAYRUN_STATUS_LABELS[payrun.status]}
                </span>
                <span
                  className={
                    payrun.blockingCount > 0
                      ? 'payrun-warn payrun-warn--blocking'
                      : payrun.warningCount + payrun.uncomputedCount === 0
                        ? 'payrun-warn payrun-warn--none'
                        : 'payrun-warn'
                  }
                >
                  {warningLabel(payrun)}
                </span>
              </span>

              <span className="payrun-card__open" aria-hidden="true">
                <SquarePen size={18} />
              </span>
            </Link>
          ))}

          {payruns.length === 0 && !error && (
            <p className="empty-note">
              No payruns{year ? ` for ${year}` : ''}. Use NEW to open a payroll period.
            </p>
          )}
        </div>

        <p className="admin-page__note">
          Each payrun represents one payroll period and groups the payslips generated for that
          period.
        </p>

        {creating && (
          <NewPayrunPanel
            onClose={() => setCreating(false)}
            onCreated={(id) => navigate(`/payruns/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Month name a period start falls in, used to pre-fill the payrun name.
function monthNameFor(date: string) {
  const { year, month } = calendarParts(date);
  if (!year || !month) return '';
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// End of the month a date falls in, so picking a start fills a whole period.
// Day 0 of the next month is the last day of this one, and leap years come
// out right without a special case.
function endOfMonth(date: string) {
  const { year, month } = calendarParts(date);
  if (!year || !month) return '';
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// Step one collects the structure and the period only. Continue deliberately
// creates nothing - the payrun comes into existence in step two, once the
// employees are actually chosen.
interface DraftPayrun {
  name: string;
  salaryStructureId: string;
  department: string;
  periodStart: string;
  periodEnd: string;
}

function NewPayrunPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [draft, setDraft] = useState<DraftPayrun | null>(null);

  if (draft) {
    return (
      <SelectEmployeesModal
        draft={draft}
        onBack={() => setDraft(null)}
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  }
  return <NewPayrunModal onClose={onClose} onContinue={setDraft} />;
}

function NewPayrunModal({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: (draft: DraftPayrun) => void;
}) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [name, setName] = useState('');
  const [salaryStructureId, setSalaryStructureId] = useState('');
  const [department, setDepartment] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SalaryStructure[]>('/api/salary-structures')
      .then((rows) => {
        setStructures(rows);
        if (rows[0]) setSalaryStructureId(rows[0].id);
      })
      .catch(() => setError('Could not load salary structures'));
  }, []);

  // Payroll periods are almost always whole months, so choosing a start
  // fills in the rest and leaves both fields editable.
  function handleStart(value: string) {
    setPeriodStart(value);
    if (!value) return;
    if (!periodEnd) setPeriodEnd(endOfMonth(value));
    if (!name) setName(monthNameFor(value));
  }

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    if (new Date(periodEnd) < new Date(periodStart)) {
      setError('The period end must be on or after the period start');
      return;
    }
    onContinue({ name, salaryStructureId, department, periodStart, periodEnd });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--sm" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>New Pay Run</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleContinue} className="modal__body">
          <div className="stack-field">
            <span>Salary Structure</span>
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
          </div>

          <div className="stack-field">
            <span>Period</span>
            <div className="period-row">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => handleStart(e.target.value)}
                required
              />
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="stack-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="January 2026"
              required
            />
          </div>

          <div className="stack-field">
            <span>Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((value) => (
                <option key={value} value={value}>
                  {DEPARTMENT_LABELS[value as Department]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="panel__error">{error}</p>}

          <div className="modal__actions modal__actions--left">
            <button type="submit" className="btn btn--primary">
              Continue
            </button>
            <button type="button" className="btn btn--link" onClick={onClose}>
              Discard
            </button>
          </div>

          <p className="notes-box__text">
            This step only collects the structure and period. The payrun is created after you choose
            the employees.
          </p>
        </form>
      </div>
    </div>
  );
}

function hoursLabel(employee: EligibleEmployee) {
  if (employee.weeklyHours === null) return '—';
  return `${employee.weeklyHours} hours/week`;
}

// "Jan 1", matching the selection wireframe. Parsed off the string so the
// date can't drift a day in a browser west of UTC.
function shortDate(value: string) {
  const { year, month, day } = calendarParts(value);
  if (!year || !month || !day) return '—';
  return `${MONTHS[month - 1]} ${day}`;
}

function SelectEmployeesModal({
  draft,
  onBack,
  onClose,
  onCreated,
}: {
  draft: DraftPayrun;
  onBack: () => void;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [rows, setRows] = useState<EligibleEmployee[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
    });
    if (draft.department) params.set('department', draft.department);
    if (search) params.set('search', search);

    setLoading(true);
    api
      .get<EligibleEmployee[]>(`/api/payruns/eligible?${params}`)
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Could not load eligible employees')
      )
      .finally(() => setLoading(false));
  }, [draft.periodStart, draft.periodEnd, draft.department, search]);

  function toggle(employeeId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  // Header checkbox acts on what is currently listed, so it stays honest
  // while a search is narrowing the table.
  const allShownSelected = rows.length > 0 && rows.every((row) => selected.has(row.employeeId));
  function toggleAll() {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const row of rows) {
        if (allShownSelected) next.delete(row.employeeId);
        else next.add(row.employeeId);
      }
      return next;
    });
  }

  async function createPayrun() {
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<Payrun>('/api/payruns', {
        name: draft.name,
        salaryStructureId: draft.salaryStructureId,
        department: draft.department || null,
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        employeeIds: [...selected],
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>Select Employee Records</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal__toolbar">
          <input
            className="search-input"
            placeholder="Search employees..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="modal__count">
            {selected.size > 0 ? `${selected.size} selected / ` : ''}
            {rows.length} eligible
          </span>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="modal__body modal__body--table">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="pick-col">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAll}
                    aria-label="Select all listed employees"
                  />
                </th>
                <th>Employee</th>
                <th>Working Hours</th>
                <th>Start Date</th>
                <th>Wage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} onClick={() => toggle(row.employeeId)}>
                  <td className="pick-col">
                    <input
                      type="checkbox"
                      checked={selected.has(row.employeeId)}
                      onChange={() => toggle(row.employeeId)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${row.fullName}`}
                    />
                  </td>
                  <td>
                    {row.fullName}
                    {!row.hasBankAccount && <span className="pick-flag">no bank account</span>}
                  </td>
                  <td>{hoursLabel(row)}</td>
                  <td>{shortDate(row.contractStart)}</td>
                  <td className="money">{formatMoney(row.wage)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {loading
                      ? 'Loading...'
                      : 'Nobody holds a running contract over this period.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="modal__actions modal__actions--left">
          <button
            className="btn btn--primary"
            disabled={submitting || selected.size === 0}
            onClick={createPayrun}
          >
            {submitting ? 'Creating...' : 'Create payrun'}
          </button>
          <button className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>

        <p className="admin-page__note">
          The payrun is created now, containing only the employees ticked above.
        </p>
      </div>
    </div>
  );
}
