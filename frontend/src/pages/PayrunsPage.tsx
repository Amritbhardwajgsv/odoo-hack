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

function NewPayrunPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [name, setName] = useState('');
  const [salaryStructureId, setSalaryStructureId] = useState('');
  const [department, setDepartment] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.post<Payrun>('/api/payruns', {
        name,
        salaryStructureId,
        department: department || null,
        periodStart,
        periodEnd,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(event) => event.stopPropagation()}>
        <h2>New Payrun</h2>
        <form onSubmit={handleSubmit}>
          <label>Period Start *</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => handleStart(e.target.value)}
            required
          />

          <label>Period End *</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />

          <label>Payrun Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="January 2026"
            required
          />

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

          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((value) => (
              <option key={value} value={value}>
                {DEPARTMENT_LABELS[value as Department]}
              </option>
            ))}
          </select>

          {error && <p className="panel__error">{error}</p>}

          <p className="notes-box__text">
            Everyone holding a running contract over this period is added automatically. Nothing is
            calculated until you compute the payrun.
          </p>

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Payrun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
