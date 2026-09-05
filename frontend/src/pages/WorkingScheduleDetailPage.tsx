import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { DAY_NAMES, type ScheduleLine, type WorkingScheduleDetail } from '../types';
import './shared.css';
import './employees.css';
import './schedules.css';

// Mirrors the server's calculation so the total updates as you type,
// instead of only after saving. The server still recomputes on save.
function hoursFor(line: ScheduleLine) {
  const [sh, sm] = line.startTime.split(':').map(Number);
  const [eh, em] = line.endTime.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm) - (line.breakMinutes || 0);
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0;
}

export default function WorkingScheduleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<WorkingScheduleDetail | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [timezone, setTimezone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [lines, setLines] = useState<ScheduleLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Bumped every time a fresh set of lines is loaded (initial fetch, or
  // after a save) so each row's key changes and React remounts the row
  // instead of patching it - see the time inputs below for why that matters.
  const [reloadToken, setReloadToken] = useState(0);

  function hydrate(data: WorkingScheduleDetail) {
    setSchedule(data);
    setName(data.name);
    setCompany(data.company ?? '');
    setTimezone(data.timezone);
    setIsActive(data.isActive);
    setLines(data.lines);
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    api
      .get<WorkingScheduleDetail>(`/api/working-schedules/${id}`)
      .then(hydrate)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Failed to load working schedule')
      );
  }, [id]);

  const totalHours = Math.round(lines.reduce((sum, line) => sum + hoursFor(line), 0) * 100) / 100;

  function updateLine(index: number, patch: Partial<ScheduleLine>) {
    setLines((previous) =>
      previous.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
    setSaved(false);
  }

  function addDay() {
    const used = new Set(lines.map((line) => line.dayOfWeek));
    const nextDay = [0, 1, 2, 3, 4, 5, 6].find((day) => !used.has(day));
    if (nextDay === undefined) return;
    setLines((previous) =>
      [...previous, { dayOfWeek: nextDay, startTime: '09:00', endTime: '18:00', breakMinutes: 60 }].sort(
        (a, b) => a.dayOfWeek - b.dayOfWeek
      )
    );
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<WorkingScheduleDetail>(`/api/working-schedules/${id}`, {
        name,
        company: company || null,
        timezone,
        isActive,
        lines: lines.map((line) => ({
          dayOfWeek: line.dayOfWeek,
          startTime: line.startTime,
          endTime: line.endTime,
          breakMinutes: line.breakMinutes || 0,
        })),
      });
      hydrate(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!schedule) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const allDaysUsed = lines.length >= 7;

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <Link to="/working-schedules" className="crumb">
              &larr; Back to List
            </Link>
            <h1>{schedule.name}</h1>
            <p className="admin-page__subtitle">Form view of one schedule</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Schedule Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </label>

            <label className="field">
              <span>Company</span>
              <input
                type="text"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setSaved(false);
                }}
              />
            </label>

            <label className="field">
              <span>Days per Week</span>
              <input type="text" value={lines.length} readOnly title="Calculated from the days below" />
            </label>

            <label className="field">
              <span>Timezone</span>
              <input
                type="text"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setSaved(false);
                }}
              />
            </label>

            <label className="field">
              <span>Hours per Week</span>
              <input type="text" value={`${totalHours}h`} readOnly title="Calculated from the days below" />
            </label>

            <label className="field">
              <span>Status</span>
              <select
                value={isActive ? 'true' : 'false'}
                onChange={(e) => {
                  setIsActive(e.target.value === 'true');
                  setSaved(false);
                }}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </div>

          <section className="week">
            <div className="week__head">
              <h3>Weekly Schedule</h3>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={addDay}
                disabled={allDaysUsed}
                title={allDaysUsed ? 'Every day of the week is already listed' : undefined}
              >
                + Add Day
              </button>
            </div>

            <table className="week__table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Break (min)</th>
                  <th>Hours</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const taken = new Set(lines.filter((_, i) => i !== index).map((l) => l.dayOfWeek));
                  return (
                    <tr key={`${index}-${reloadToken}`}>
                      <td>
                        <select
                          value={line.dayOfWeek}
                          onChange={(e) => updateLine(index, { dayOfWeek: Number(e.target.value) })}
                        >
                          {DAY_NAMES.map((day, dayIndex) => (
                            <option key={day} value={dayIndex} disabled={taken.has(dayIndex)}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {/* No `value` prop on purpose: a fully-controlled
                            time input gets its value re-pushed into the DOM
                            on every keystroke anywhere else in this table,
                            which is what makes Safari's native time picker
                            throw "Invalid value" mid-edit. onChange still
                            drives the live hours total below; the row's key
                            changing on reload is what keeps this in sync
                            with the server after a save, since an
                            uncontrolled input otherwise only reads its
                            initial value once. */}
                        <input
                          type="time"
                          defaultValue={line.startTime}
                          onChange={(e) => updateLine(index, { startTime: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          defaultValue={line.endTime}
                          onChange={(e) => updateLine(index, { endTime: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          value={line.breakMinutes}
                          onChange={(e) =>
                            updateLine(index, { breakMinutes: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="week__hours">{hoursFor(line)}h</td>
                      <td>
                        <button
                          type="button"
                          className="week__remove"
                          onClick={() => {
                            setLines((previous) => previous.filter((_, i) => i !== index));
                            setSaved(false);
                          }}
                          aria-label={`Remove ${DAY_NAMES[line.dayOfWeek]}`}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No days yet. Add one to build the weekly pattern.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="week__total">
              <span>Total Weekly Hours</span>
              <strong>{totalHours}h</strong>
            </div>
          </section>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            {saved && <span className="save-note">Saved</span>}
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/working-schedules')}>
              Back to List
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>

        <p className="admin-page__note">
          Employees and contracts reference this schedule as their expected working time, so
          attendance and payroll read the hours from here.
        </p>
      </div>
    </div>
  );
}
