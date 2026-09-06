import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  PAYRUN_STATUS_LABELS,
  type Payrun,
  type Payslip,
  type PayrunPayslips,
  type SendPayslipsResult,
} from '../types';
import { formatMoney, formatPeriodDate, warningCell } from './PayrunsPage';
import { payslipFileName } from '../utils/payslip';
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

  function sendPayslips() {
    run(async () => {
      const result = await api.post<SendPayslipsResult>(`/api/payruns/${id}/send-payslips`, {});
      const queued = `Queued ${result.queued} payslip${result.queued === 1 ? '' : 's'} for delivery.`;
      return result.skipped.length
        ? `${queued} Skipped ${result.skipped.map((s) => `${s.employee} (${s.reason})`).join(', ')}.`
        : queued;
    });
  }

  // The PDF sits behind bearer auth, so it is fetched and opened as a blob
  // rather than linked to directly.
  async function openPdf(payslipId: string) {
    setError(null);
    try {
      const url = await api.blob(`/api/payslips/${payslipId}/pdf`);
      window.open(url, '_blank', 'noopener');
      // Give the new tab time to load before releasing the object URL.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the payslip PDF');
    }
  }

  async function downloadPdf(payslip: Payslip) {
    setError(null);
    try {
      await api.download(`/api/payslips/${payslip.id}/pdf?download=1`, payslipFileName(payslip));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the payslip PDF');
    }
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

  const canSend = payrun.status === 'validated' || payrun.status === 'paid';

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>
              <Link to="/payruns" className="crumb">
                Payrun
              </Link>{' '}
              / {payrun.name}
            </h1>
            <p className="admin-page__subtitle">
              Open one Payrun to compute and manage its payslips
            </p>
          </div>
        </header>

        <div className="detail-actions">
          <div className="payrun-actions">
            <button
              className="btn btn--primary"
              disabled={busy || payrun.status === 'paid'}
              onClick={compute}
            >
              {payrun.status === 'draft' ? 'COMPUTE' : 'RECOMPUTE'}
            </button>
            <button
              className="btn btn--ghost"
              disabled={busy || payrun.status !== 'computed'}
              onClick={() => setStatus('validated')}
            >
              VALIDATE
            </button>
            <button
              className="btn btn--ghost"
              disabled={busy || payrun.status !== 'validated'}
              onClick={() => setStatus('paid')}
            >
              MARK PAID
            </button>
            {(payrun.status === 'computed' || payrun.status === 'validated') && (
              <button className="btn btn--ghost" disabled={busy} onClick={() => setStatus('draft')}>
                RESET
              </button>
            )}
          </div>
          <button className="btn btn--send" disabled={busy || !canSend} onClick={sendPayslips}>
            SEND PAYSLIPS
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}
        {notice && <p className="admin-page__subtitle">{notice}</p>}

        <div className="payrun-form">
          <span>Name</span>
          <input type="text" value={payrun.name} readOnly />

          <span>Salary Structure</span>
          <input type="text" value={payrun.salaryStructureName ?? '—'} readOnly />

          <span>Period</span>
          <input
            type="text"
            value={`${formatPeriodDate(payrun.periodStart)} — ${formatPeriodDate(payrun.periodEnd)}`}
            readOnly
          />

          <span>Status</span>
          <input type="text" value={PAYRUN_STATUS_LABELS[payrun.status]} readOnly />
        </div>

        <h2 className="section-heading">Payslips in this Payrun</h2>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Warning</th>
              <th>Worked</th>
              <th>Leave</th>
              <th>Basic</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {slips.payslips.map((payslip) => (
              <tr key={payslip.id} onClick={() => navigate(`/payslips/${payslip.id}`)}>
                <td>{payslip.employeeName}</td>
                <td>{warningCell(payslip)}</td>
                <td>{payslip.workedDays ?? '—'}</td>
                <td>{payslip.leaveDays > 0 ? payslip.leaveDays : '—'}</td>
                <td className="money">{formatMoney(payslip.basicAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.grossAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.netAmount ?? 0)}</td>
                <td>
                  <span className={`payrun-status payrun-status--${payslip.status}`}>
                    {PAYRUN_STATUS_LABELS[payslip.status]}
                  </span>
                </td>
                <td className="pdf-actions">
                  <button
                    className="pdf-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      openPdf(payslip.id);
                    }}
                  >
                    View
                  </button>
                  <button
                    className="pdf-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      downloadPdf(payslip);
                    }}
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {slips.payslips.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
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
        </div>

        <p className="admin-page__note">
          Warnings such as missing account data or duplicate payslips are visible here before
          payroll is finalized. Computing rebuilds every payslip from the salary rules and the
          running contracts as they are right now, and a paid payrun is locked.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate('/payruns')}>
          Back to Payruns
        </button>
      </div>
    </div>
  );
}
