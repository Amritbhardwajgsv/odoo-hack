import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import type { WorkingSchedule } from '../types';
import './shared.css';
import './employees.css';
import './schedules.css';

export default function WorkingSchedulesPage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<WorkingSchedule[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeFilter) params.set('active', activeFilter);
    const query = params.toString();
    try {
      setSchedules(await api.get<WorkingSchedule[]>(`/api/working-schedules${query ? `?${query}` : ''}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load working schedules');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeFilter]);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Working Schedules</h1>
            <p className="admin-page__subtitle">
              The weekly working pattern employees and contracts are measured against
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            + New Schedule
          </button>
          <input
            className="search-input"
            placeholder="Search schedules..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as '' | 'true' | 'false')}
          >
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        {loadError && <p className="error-banner">{loadError}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Schedule Name</th>
              <th>Days / Week</th>
              <th>Hours / Week</th>
              <th>Company</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id} onClick={() => navigate(`/working-schedules/${schedule.id}`)}>
                <td>{schedule.name}</td>
                <td>{schedule.daysPerWeek}</td>
                <td>{schedule.totalWeeklyHours}h</td>
                <td>{schedule.company ?? '—'}</td>
                <td>
                  <span
                    className={`status-pill ${schedule.isActive ? 'status-pill--active' : ''}`}
                  >
                    {schedule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  No working schedules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Select a schedule to open its form and edit the weekly pattern. Days and hours per week
          are calculated from that pattern, not typed in.
        </p>

        {creating && (
          <NewSchedulePanel
            onClose={() => setCreating(false)}
            onCreated={(id) => navigate(`/working-schedules/${id}`)}
          />
        )}
      </div>
    </div>
  );
}

function NewSchedulePanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('PeoplePay360 Pvt Ltd');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Created with a standard Mon-Fri week so the form opens on something
      // editable rather than an empty pattern.
      const created = await api.post<WorkingSchedule>('/api/working-schedules', {
        name,
        company: company || null,
        timezone,
        isActive: true,
        lines: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '18:00',
          breakMinutes: 60,
        })),
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
        <h2>New Schedule</h2>
        <form onSubmit={handleSubmit}>
          <label>Schedule Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="40 Hours / Week"
            required
          />

          <label>Company</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />

          <label>Timezone</label>
          <input type="text" value={timezone} onChange={(e) => setTimezone(e.target.value)} />

          <p className="panel__hint">
            Starts as Monday to Friday, 09:00–18:00 with a 60 minute break. Adjust the days on the
            next screen.
          </p>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
