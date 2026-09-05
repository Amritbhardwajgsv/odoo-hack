import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { PAYRUN_STATUS_LABELS, type Payslip } from '../types';
import { formatMoney, formatShortPeriod } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

export default function MyPayslipsPage() {
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Payslip[]>('/api/me/payslips')
      .then(setPayslips)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your payslips'));
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>My Payslips</h1>
            <p className="admin-page__subtitle">Your own payslips, across every payrun</p>
          </div>
        </header>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((payslip) => (
              <tr key={payslip.id} onClick={() => navigate(`/me/payslips/${payslip.id}`)}>
                <td>{formatShortPeriod(payslip.periodStart, payslip.periodEnd)}</td>
                <td className="money">{formatMoney(payslip.grossAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.netAmount ?? 0)}</td>
                <td>
                  <span className={`payrun-status payrun-status--${payslip.status}`}>
                    {PAYRUN_STATUS_LABELS[payslip.status]}
                  </span>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="empty-row">
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
