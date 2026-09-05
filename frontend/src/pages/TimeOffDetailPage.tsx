import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { TIME_OFF_STATUS_LABELS, type TimeOffRequest } from '../types';
import { durationLabel } from './TimeOffPage';
import './shared.css';
import './employees.css';
import './timeoff.css';

function formatFullDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function TimeOffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<TimeOffRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRequest(await api.get<TimeOffRequest>(`/api/time-off/requests/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load request');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(action: 'approve' | 'refuse') {
    setBusy(true);
    setError(null);
    try {
      setRequest(await api.post<TimeOffRequest>(`/api/time-off/requests/${id}/${action}`, {}));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!request) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const pending = request.status === 'submitted' || request.status === 'draft';

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>
              <Link to="/time-off" className="crumb">
                Time Off Request
              </Link>{' '}
              / {request.employeeName}
            </h1>
            <p className="admin-page__subtitle">Form view of one request</p>
          </div>
        </header>

        <div className="detail-actions">
          <div className="decide decide--lg">
            <button
              className="decide__approve"
              disabled={busy || request.status === 'approved'}
              onClick={() => decide('approve')}
            >
              Approve
            </button>
            <button
              className="decide__refuse"
              disabled={busy || request.status === 'refused'}
              onClick={() => decide('refuse')}
            >
              Refuse
            </button>
          </div>
          <span className={`leave-status leave-status--${request.status}`}>
            {TIME_OFF_STATUS_LABELS[request.status]}
          </span>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Employee</span>
              <input type="text" value={request.employeeName} readOnly />
            </label>

            <label className="field">
              <span>Duration</span>
              <input
                type="text"
                value={durationLabel(request.duration, request.typeUnit)}
                readOnly
              />
            </label>

            <label className="field">
              <span>Time Off Type</span>
              <input type="text" value={request.typeName} readOnly />
            </label>

            <label className="field">
              <span>Status</span>
              <input type="text" value={TIME_OFF_STATUS_LABELS[request.status]} readOnly />
            </label>

            <label className="field">
              <span>Start Date</span>
              <input type="text" value={formatFullDate(request.dateFrom)} readOnly />
            </label>

            <label className="field">
              <span>Approver</span>
              <input type="text" value={request.approverName ?? 'Not decided yet'} readOnly />
            </label>

            <label className="field">
              <span>End Date</span>
              <input type="text" value={formatFullDate(request.dateTo)} readOnly />
            </label>

            <label className="field">
              <span>Allocation Used</span>
              <input
                type="text"
                value={
                  request.allocationLabel ??
                  (request.requiresAllocation
                    ? pending
                      ? 'Assigned on approval'
                      : 'None'
                    : 'Not required for this type')
                }
                readOnly
              />
            </label>
          </div>

          <section className="reason-box">
            <h3>Reason</h3>
            <p>{request.reason || 'No reason given.'}</p>
          </section>

          {request.allocationLabel && request.allocationRemaining !== null && (
            <p className="balance-note">
              Drawn from <strong>{request.allocationLabel}</strong> —{' '}
              {request.allocationRemaining} {request.typeUnit} left on that balance.
            </p>
          )}
        </div>

        <p className="admin-page__note">
          Types that require an allocation show exactly which balance the approval consumed.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/time-off')}>
          Back to Requests
        </button>
      </div>
    </div>
  );
}
