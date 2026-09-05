import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENT_LABELS,
  PAYRUN_STATUS_LABELS,
  SALARY_CATEGORY_LABELS,
  type PayslipDetail,
} from '../types';
import { formatMoney, formatPeriodDate } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

// Deductions and contributions come off the gross, so they are shown as
// negatives and the column then adds up to the net on screen.
const REDUCES_NET = ['deduction', 'contribution'];

export default function PayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PayslipDetail>(`/api/payslips/${id}`)
      .then(setPayslip)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payslip'));
  }, [id]);

  if (!payslip) {
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
              <Link to={`/payruns/${payslip.payrunId}`} className="crumb">
                {payslip.payrunName}
              </Link>{' '}
              / {payslip.employeeName}
            </h1>
            <p className="admin-page__subtitle">
              {formatPeriodDate(payslip.periodStart)} &mdash; {formatPeriodDate(payslip.periodEnd)}
            </p>
          </div>
        </header>

        <div className="detail-actions">
          <span />
          <span className={`payrun-status payrun-status--${payslip.status}`}>
            {PAYRUN_STATUS_LABELS[payslip.status]}
          </span>
        </div>

        <div className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Employee</span>
              <input type="text" value={payslip.employeeName} readOnly />
            </label>

            <label className="field">
              <span>Contract</span>
              <input type="text" value={payslip.contractNumber ?? '—'} readOnly />
            </label>

            <label className="field">
              <span>Job Position</span>
              <input type="text" value={payslip.jobTitle ?? '—'} readOnly />
            </label>

            <label className="field">
              <span>Contract Wage</span>
              <input
                type="text"
                value={payslip.wage === null ? '—' : formatMoney(payslip.wage)}
                readOnly
              />
            </label>

            <label className="field">
              <span>Department</span>
              <input type="text" value={DEPARTMENT_LABELS[payslip.department]} readOnly />
            </label>

            <label className="field">
              <span>Worked Days</span>
              <input type="text" value={payslip.workedDays ?? '—'} readOnly />
            </label>
          </div>

          <section className="notes-box">
            <h3>Salary Computation</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payslip.lines.map((line) => {
                  const negative = REDUCES_NET.includes(line.category);
                  return (
                    <tr
                      key={line.id}
                      className={negative ? 'payslip-line--deduction' : undefined}
                      style={{ cursor: 'default' }}
                    >
                      <td>{line.ruleName}</td>
                      <td>{SALARY_CATEGORY_LABELS[line.category]}</td>
                      <td className="money" style={{ textAlign: 'right' }}>
                        {negative ? '-' : ''}
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  );
                })}
                {payslip.lines.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-row">
                      No lines on this payslip.
                    </td>
                  </tr>
                )}
                <tr className="payslip-total">
                  <td colSpan={2}>Gross</td>
                  <td className="money" style={{ textAlign: 'right' }}>
                    {formatMoney(payslip.grossAmount ?? 0)}
                  </td>
                </tr>
                <tr className="payslip-total payslip-total--net">
                  <td colSpan={2}>Net Pay</td>
                  <td className="money" style={{ textAlign: 'right' }}>
                    {formatMoney(payslip.netAmount ?? 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {payslip.warnings.length > 0 && (
            <ul className="warning-list">
              {payslip.warnings.map((warning) => (
                <li key={warning.id} className={`warning-item warning-item--${warning.severity}`}>
                  <span className="warning-item__tag">{warning.severity}</span>
                  <span>{warning.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="admin-page__note">
          A blocking warning stops the whole payrun from being validated. An advisory one is worth
          a look but does not hold up payroll.
        </p>

        <button className="btn btn--ghost" onClick={() => navigate(`/payruns/${payslip.payrunId}`)}>
          Back to Payrun
        </button>
      </div>
    </div>
  );
}
