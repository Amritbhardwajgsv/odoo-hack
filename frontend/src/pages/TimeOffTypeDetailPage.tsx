import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import type { TimeOffType } from '../types';
import './shared.css';
import './employees.css';
import './timeoff.css';

const COLORS = ['Blue', 'Green', 'Red', 'Amber', 'Purple'];

export default function TimeOffTypeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<TimeOffType | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function hydrate(data: TimeOffType) {
    setType(data);
    setForm({
      name: data.name,
      unit: data.unit,
      requiresAllocation: data.requiresAllocation,
      requiresApproval: data.requiresApproval,
      approvalBy: data.approvalBy,
      displayColor: data.displayColor,
      isActive: data.isActive,
      workEntry: data.workEntry ?? '',
      notes: data.notes ?? '',
    });
  }

  useEffect(() => {
    api
      .get<TimeOffType>(`/api/time-off/types/${id}`)
      .then(hydrate)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load type'));
  }, [id]);

  function set(field: string, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<TimeOffType>(`/api/time-off/types/${id}`, {
        name: form.name,
        unit: form.unit,
        requiresAllocation: form.requiresAllocation,
        requiresApproval: form.requiresApproval,
        approvalBy: form.approvalBy,
        displayColor: form.displayColor,
        isActive: form.isActive,
        workEntry: form.workEntry || null,
        notes: form.notes || null,
      });
      hydrate(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (!type) {
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
            <h1>
              <Link to="/time-off-types" className="crumb">
                Time Off Type
              </Link>{' '}
              / {type.name}
            </h1>
            <p className="admin-page__subtitle">Form view of one time off type</p>
          </div>
        </header>

        <div className="detail-actions">
          {editing ? (
            <button
              className="btn btn--ghost"
              onClick={() => {
                hydrate(type);
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
        </div>

        <form onSubmit={handleSubmit} className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Type Name</span>
              <input
                type="text"
                value={String(form.name)}
                disabled={!editing}
                onChange={(e) => set('name', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Approval</span>
              <select
                value={String(form.approvalBy)}
                disabled={!editing}
                onChange={(e) => set('approvalBy', e.target.value)}
              >
                <option value="Manager">Manager</option>
                <option value="Officer">Officer</option>
              </select>
            </label>

            <label className="field">
              <span>Unit</span>
              <select
                value={String(form.unit)}
                disabled={!editing}
                onChange={(e) => set('unit', e.target.value)}
              >
                <option value="days">Days</option>
                <option value="hours">Hours</option>
              </select>
            </label>

            <label className="field">
              <span>Payroll / Work Entry</span>
              <input
                type="text"
                value={String(form.workEntry)}
                disabled={!editing}
                onChange={(e) => set('workEntry', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Requires Allocation</span>
              <select
                value={form.requiresAllocation ? 'yes' : 'no'}
                disabled={!editing}
                onChange={(e) => set('requiresAllocation', e.target.value === 'yes')}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="field">
              <span>Display Color</span>
              <select
                value={String(form.displayColor)}
                disabled={!editing}
                onChange={(e) => set('displayColor', e.target.value)}
              >
                {COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Active</span>
              <select
                value={form.isActive ? 'true' : 'false'}
                disabled={!editing}
                onChange={(e) => set('isActive', e.target.value === 'true')}
              >
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </label>
          </div>

          <section className="reason-box">
            <h3>Configuration Notes</h3>
            {editing ? (
              <input
                className="notes-box__input"
                type="text"
                value={String(form.notes)}
                onChange={(e) => set('notes', e.target.value)}
              />
            ) : (
              <p>{type.notes || 'No configuration notes.'}</p>
            )}
          </section>

          {error && <p className="panel__error">{error}</p>}

          {editing && (
            <div className="panel__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Type'}
              </button>
            </div>
          )}
        </form>

        <p className="admin-page__note">
          This type drives approval behaviour and whether a request needs an allocation. One
          exception applies regardless of the Approval setting above: an HR Manager&apos;s own
          request always needs HR Payroll (or an admin) to decide it, and an HR Payroll
          user&apos;s or manager&apos;s own request always needs an admin — nobody approves their
          own tier's leave.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/time-off-types')}>
          Back to Types
        </button>
      </div>
    </div>
  );
}
