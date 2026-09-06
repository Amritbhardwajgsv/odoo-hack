import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { PAYRUN_STATUS_LABELS, SALARY_CATEGORY_LABELS, type PayslipDetail } from '../types';
import { formatMoney, formatPeriodDate } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

const REDUCES_NET = ['deduction', 'contribution'];

export default function MyPayslipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState<PayslipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PayslipDetail>(`/api/me/payslips/${id}`)
      .then(setPayslip)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load payslip'));
  }, [id]);

  async function openPdf() {
    setError(null);
    try {
      const url = await api.blob(`/api/me/payslips/${id}/pdf`);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the payslip PDF');
    }
  }

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
              <Link to="/me/payslips" className="crumb">
                My Payslips
              </Link>{' '}
              / {payslip.payrunName}
            </h1>
            <p className="admin-page__subtitle">
              {formatPeriodDate(payslip.periodStart)} &mdash; {formatPeriodDate(payslip.periodEnd)}
            </p>
          </div>
        </header>

        <div className="detail-actions">
          <button className="btn btn--ghost" onClick={openPdf}>
            Download PDF
          </button>
          <span className={`payrun-status payrun-status--${payslip.status}`}>
            {PAYRUN_STATUS_LABELS[payslip.status]}
          </span>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <div className="detail-card">
          <div className="field-grid">
            <label className="field">
              <span>Worked Days</span>
              <input type="text" value={payslip.workedDays ?? '—'} readOnly />
            </label>
            <label className="field">
              <span>Leave Days</span>
              <input
                type="text"
                value={payslip.leaveDays > 0 ? `${payslip.leaveDays} (payroll-affecting)` : '—'}
                readOnly
              />
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
                    <tr key={line.id} style={{ cursor: 'default' }}>
                      <td>{line.ruleName}</td>
                      <td>{SALARY_CATEGORY_LABELS[line.category]}</td>
                      <td className="money" style={{ textAlign: 'right' }}>
                        {negative ? '-' : ''}
                        {formatMoney(line.amount)}
                      </td>
                    </tr>
                  );
                })}
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
        </div>

        <button className="btn btn--ghost" onClick={() => navigate('/me/payslips')}>
          Back to My Payslips
        </button>
      </div>
    </div>
  );
}
