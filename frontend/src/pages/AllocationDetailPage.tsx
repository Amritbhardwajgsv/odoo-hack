import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import type { TimeOffAllocation } from '../types';
import './shared.css';
import './employees.css';
import './timeoff.css';

const STATUS_LABELS: Record<string, string> = {
  draft: 'To Approve',
  approved: 'Approved',
  refused: 'Refused',
  expired: 'Expired',
};

export default function AllocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [allocation, setAllocation] = useState<TimeOffAllocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAllocation(await api.get<TimeOffAllocation>(`/api/time-off/allocations/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load allocation');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(action: 'approve' | 'refuse') {
    setBusy(true);
    setError(null);
    try {
      setAllocation(
        await api.post<TimeOffAllocation>(`/api/time-off/allocations/${id}/${action}`, {})
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!allocation) {
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
              <Link to="/allocations" className="crumb">
                Allocation
              </Link>{' '}
              / {allocation.employeeName}
            </h1>
            <p className="admin-page__subtitle">Form view of one allocation record</p>
          </div>
        </header>

        <div className="detail-actions">
          <div className="decide decide--lg">
            <button
              className="decide__approve"
              disabled={busy || allocation.status === 'approved'}
              onClick={() => decide('approve')}
            >
              Approve
            </button>
            <button
              className="decide__refuse"
              disabled={busy || allocation.status === 'refused'}
              onClick={() => decide('refuse')}
            >
              Refuse
            </button>
          </div>
          <span
            className={`leave-status leave-status--${allocation.status === 'draft' ? 'submitted' : allocation.status}`}
          >
            {STATUS_LABELS[allocation.status] ?? allocation.status}
          </span>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Employee</span>
              <input type="text" value={allocation.employeeName} readOnly />
            </label>

            <label className="field">
              <span>Taken</span>
              <input type="text" value={`${allocation.taken} ${allocation.unit}`} readOnly />
            </label>

            <label className="field">
              <span>Time Off Type</span>
              <input type="text" value={allocation.typeName} readOnly />
            </label>

            <label className="field">
              <span>Remaining</span>
              <input type="text" value={`${allocation.remaining} ${allocation.unit}`} readOnly />
            </label>

            <label className="field">
              <span>Allocated</span>
              <input type="text" value={`${allocation.allocated} ${allocation.unit}`} readOnly />
            </label>

            <label className="field">
              <span>Approver</span>
              <input type="text" value={allocation.approverName ?? 'Not decided yet'} readOnly />
            </label>

            <label className="field">
              <span>Status</span>
              <input
                type="text"
                value={STATUS_LABELS[allocation.status] ?? allocation.status}
                readOnly
              />
            </label>

            <label className="field">
              <span>Validity</span>
              <input type="text" value={allocation.validityLabel ?? '—'} readOnly />
            </label>
          </div>

          <section className="reason-box">
            <h3>Description</h3>
            <p>{allocation.description || 'No description.'}</p>
          </section>

          {allocation.taken > 0 && (
            <p className="balance-note">
              <strong>{allocation.taken} {allocation.unit}</strong> already drawn from this balance
              by approved leave, so it can no longer be withdrawn.
            </p>
          )}
        </div>

        <p className="admin-page__note">
          An approved allocation is what creates available leave balance for the employee.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/allocations')}>
          Back to Allocations
        </button>
      </div>
    </div>
  );
}
