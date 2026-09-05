import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENT_LABELS,
  PAYRUN_STATUS_LABELS,
  type Payrun,
  type PayrunPayslips,
} from '../types';
import { formatMoney, formatPeriodDate } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

export default function PayrunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payrun, setPayrun] = useState<Payrun | null>(null);
  const [slips, setSlips] = useState<PayrunPayslips>({ payslips: [], uncomputed: [] });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [run, payslips] = await Promise.all([
        api.get<Payrun>(`/api/payruns/${id}`),
        api.get<PayrunPayslips>(`/api/payruns/${id}/payslips`),
      ]);
      setPayrun(run);
      setSlips(payslips);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payrun');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Every action ends by reloading, so the screen reflects the database
  // rather than what the request happened to return.
  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
      await load();
    }
  }

  function compute() {
    run(async () => {
      const result = await api.post<{ computed: number; skipped: string[] }>(
        `/api/payruns/${id}/compute`,
        {}
      );
      const base = `Computed ${result.computed} payslip${result.computed === 1 ? '' : 's'}.`;
      // Anyone without a running contract can't get a payslip at all, so say
      // so plainly rather than letting the headcount quietly shrink.
      return result.skipped.length
        ? `${base} Skipped ${result.skipped.join(', ')} - no running contract in this period.`
        : base;
    });
  }

  function setStatus(status: string) {
    run(async () => {
      await api.post<Payrun>(`/api/payruns/${id}/status/${status}`, {});
      return null;
    });
  }

  if (!payrun) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const totalWarnings = payrun.warningCount + payrun.uncomputedCount;

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>
              <Link to="/payruns" className="crumb">
                Payruns
              </Link>{' '}
              / {payrun.name}
            </h1>
            <p className="admin-page__subtitle">
              {formatPeriodDate(payrun.periodStart)} &mdash; {formatPeriodDate(payrun.periodEnd)}
              {' · '}
              {payrun.salaryStructureName}
              {payrun.department ? ` · ${DEPARTMENT_LABELS[payrun.department]}` : ' · All departments'}
            </p>
          </div>
        </header>

        <div className="detail-actions">
          <div className="payrun-actions">
            {payrun.status !== 'paid' && (
              <button className="btn btn--primary" disabled={busy} onClick={compute}>
                {payrun.status === 'draft' ? 'Compute' : 'Recompute'}
              </button>
            )}
            {payrun.status === 'computed' && (
              <button className="btn btn--ghost" disabled={busy} onClick={() => setStatus('validated')}>
                Validate
              </button>
            )}
            {payrun.status === 'validated' && (
              <button className="btn btn--ghost" disabled={busy} onClick={() => setStatus('paid')}>
                Mark Paid
              </button>
            )}
            {(payrun.status === 'computed' || payrun.status === 'validated') && (
              <button className="btn btn--ghost" disabled={busy} onClick={() => setStatus('draft')}>
                Reset to Draft
              </button>
            )}
          </div>
          <span className={`payrun-status payrun-status--${payrun.status}`}>
            {PAYRUN_STATUS_LABELS[payrun.status]}
          </span>
        </div>

        {error && <p className="error-banner">{error}</p>}
        {notice && <p className="admin-page__subtitle">{notice}</p>}

        <div className="payrun-summary">
          <div className="payrun-metric">
            <span>Employees</span>
            <strong>{payrun.employeeCount}</strong>
          </div>
          <div className="payrun-metric">
            <span>Payslips</span>
            <strong>{payrun.payslipCount}</strong>
          </div>
          <div className="payrun-metric">
            <span>Gross total</span>
            <strong className="money">{formatMoney(payrun.grossTotal)}</strong>
          </div>
          <div className="payrun-metric">
            <span>Net total</span>
            <strong className="money">{formatMoney(payrun.netTotal)}</strong>
          </div>
          <div className="payrun-metric">
            <span>Warnings</span>
            <strong
              className={
                payrun.blockingCount > 0
                  ? 'payrun-warn payrun-warn--blocking'
                  : totalWarnings === 0
                    ? 'payrun-warn payrun-warn--none'
                    : 'payrun-warn'
              }
            >
              {totalWarnings === 0 ? 'None' : totalWarnings}
            </strong>
          </div>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Job Position</th>
              <th>Worked Days</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
              <th>Warnings</th>
            </tr>
          </thead>
          <tbody>
            {slips.payslips.map((payslip) => (
              <tr key={payslip.id} onClick={() => navigate(`/payslips/${payslip.id}`)}>
                <td>{payslip.employeeName}</td>
                <td>{payslip.jobTitle ?? '—'}</td>
                <td>{payslip.workedDays ?? '—'}</td>
                <td className="money">{formatMoney(payslip.grossAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.netAmount ?? 0)}</td>
                <td>
                  <span className={`payrun-status payrun-status--${payslip.status}`}>
                    {PAYRUN_STATUS_LABELS[payslip.status]}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      payslip.blockingCount > 0
                        ? 'payrun-warn payrun-warn--blocking'
                        : payslip.warningCount === 0
                          ? 'payrun-warn payrun-warn--none'
                          : 'payrun-warn'
                    }
                  >
                    {payslip.warningCount === 0 ? 'None' : payslip.warningCount}
                  </span>
                </td>
              </tr>
            ))}
            {slips.payslips.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">
                  {payrun.status === 'draft'
                    ? 'Nothing computed yet. Compute this payrun to generate payslips.'
                    : 'No payslips in this payrun.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {slips.uncomputed.length > 0 && (
          <ul className="warning-list">
            {slips.uncomputed.map((employee) => (
              <li key={employee.id} className="warning-item warning-item--blocking">
                <span className="warning-item__tag">No payslip</span>
                <span>
                  {employee.fullName} is on this payrun but has no running contract covering the
                  period, so no payslip could be produced.
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="admin-page__note">
          Computing rebuilds every payslip from the salary rules and the running contracts as they
          are right now. A payrun must be validated before it can be marked paid, and a paid payrun
          is locked.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/payruns')}>
          Back to Payruns
        </button>
      </div>
    </div>
  );
}
