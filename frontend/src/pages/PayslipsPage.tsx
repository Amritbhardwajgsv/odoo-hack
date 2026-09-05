import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { PAYRUN_STATUS_LABELS, type Payrun, type Payslip } from '../types';
import { formatMoney, formatShortPeriod, warningCell } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

export default function PayslipsPage() {
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [payrunId, setPayrunId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    // A payrun is a period, so filtering by payrun is what the period chip
    // actually means - and it stays exact if two runs share a month.
    if (payrunId) params.set('payrunId', payrunId);
    const query = params.toString();

    try {
      setPayslips(await api.get<Payslip[]>(`/api/payslips${query ? `?${query}` : ''}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payslips');
    }
  }, [search, payrunId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get<Payrun[]>('/api/payruns')
      .then(setPayruns)
      .catch(() => setPayruns([]));
  }, []);

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Payslips</h1>
            <p className="admin-page__subtitle">List view of employee payslips</p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          {/* Payslips only ever come from computing a payrun, so NEW goes
              where they are actually produced rather than pretending a
              payslip can be created on its own. */}
          <button className="btn btn--primary" onClick={() => navigate('/payruns')}>
            NEW
          </button>
          <input
            className="search-input"
            placeholder="Search payslips..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={payrunId} onChange={(event) => setPayrunId(event.target.value)}>
            <option value="">All periods</option>
            {payruns.map((payrun) => (
              <option key={payrun.id} value={payrun.id}>
                Period: {payrun.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Warning</th>
              <th>Period</th>
              <th>Basic</th>
              <th>Gross</th>
              <th>Net</th>
              <th>Structure</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((payslip) => (
              <tr key={payslip.id} onClick={() => navigate(`/payslips/${payslip.id}`)}>
                <td>{payslip.employeeName}</td>
                <td>{warningCell(payslip)}</td>
                <td>{formatShortPeriod(payslip.periodStart, payslip.periodEnd)}</td>
                <td className="money">{formatMoney(payslip.basicAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.grossAmount ?? 0)}</td>
                <td className="money">{formatMoney(payslip.netAmount ?? 0)}</td>
                <td>{payslip.structureName ?? '—'}</td>
                <td>
                  <span className={`payrun-status payrun-status--${payslip.status}`}>
                    {PAYRUN_STATUS_LABELS[payslip.status]}
                  </span>
                </td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  No payslips yet. Compute a payrun to generate them.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="admin-page__note">
          Selecting any payslip opens the detailed salary computation and the PDF action for that
          employee.
        </p>
      </div>
    </div>
  );
}
