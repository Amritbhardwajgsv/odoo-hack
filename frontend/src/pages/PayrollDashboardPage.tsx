import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import {
  DEPARTMENT_LABELS,
  DEPARTMENTS,
  PAYRUN_STATUS_LABELS,
  type Department,
  type PayrollDashboard,
} from '../types';
import { formatMoney, formatPeriodDate } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Scales a value against the largest one in the set, for the plain CSS-bar
// trend visual - no charting library is loaded anywhere else in this app,
// so this stays consistent with that rather than pulling one in for one page.
function barWidth(value: number, max: number) {
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export default function PayrollDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PayrollDashboard | null>(null);
  const [payrunId, setPayrunId] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeType, setEmployeeType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (payrunId) params.set('payrunId', payrunId);
    if (department) params.set('department', department);
    if (employeeType) params.set('employeeType', employeeType);
    const query = params.toString();

    try {
      setData(await api.get<PayrollDashboard>(`/api/payroll/dashboard${query ? `?${query}` : ''}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the payroll dashboard');
    }
  }, [payrunId, department, employeeType]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div>
        <AppHeader />
        <div className="admin-page">
          {error ? <p className="error-banner">{error}</p> : <p>Loading...</p>}
        </div>
      </div>
    );
  }

  const selectedPayrun = data.options.payruns.find((p) => p.id === payrunId);
  const maxTrend = Math.max(1, ...data.salaryTrend.map((row) => row.net));
  const maxDept = Math.max(1, ...data.salaryByDepartment.map((row) => row.gross));

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Payroll Dashboard</h1>
            <p className="admin-page__subtitle">
              Live metrics from HR and Payroll &mdash; filter by period, department or employee
              type
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <select value={payrunId} onChange={(e) => setPayrunId(e.target.value)}>
            <option value="">All periods</option>
            {data.options.payruns.map((payrun) => (
              <option key={payrun.id} value={payrun.id}>
                Period: {payrun.name}
              </option>
            ))}
          </select>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((value) => (
              <option key={value} value={value}>
                {DEPARTMENT_LABELS[value as Department]}
              </option>
            ))}
          </select>
          <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}>
            <option value="">All employee types</option>
            {data.options.employeeTypes.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {selectedPayrun && (
          <p className="admin-page__subtitle" style={{ marginBottom: 16 }}>
            Showing {formatPeriodDate(selectedPayrun.periodStart)} &mdash;{' '}
            {formatPeriodDate(selectedPayrun.periodEnd)} ({PAYRUN_STATUS_LABELS[selectedPayrun.status]})
          </p>
        )}

        {/* --------------------------------------------------- salary totals */}
        <div className="payrun-summary">
          <div className="payrun-metric">
            <span>Gross salary</span>
            <strong className="money">{formatMoney(data.salaryTotals.gross)}</strong>
          </div>
          <div className="payrun-metric">
            <span>Net salary</span>
            <strong className="money">{formatMoney(data.salaryTotals.net)}</strong>
          </div>
          <div className="payrun-metric">
            <span>Payslips</span>
            <strong>{data.salaryTotals.payslipCount}</strong>
          </div>
          <div className="payrun-metric">
            <span>Employees paid</span>
            <strong>{data.salaryTotals.employeeCount}</strong>
          </div>
        </div>

        <div className="dash-columns">
          <div className="dash-col">
            {/* --------------------------------------------- payslip status */}
            <section className="ws-panel">
              <h2 className="ws-heading">Payslip Status</h2>
              {data.payslipStatus.length === 0 ? (
                <p className="empty-note">No payslips in scope.</p>
              ) : (
                <ul className="dash-status-list">
                  {data.payslipStatus.map((row) => (
                    <li key={row.status}>
                      <span className={`payrun-status payrun-status--${row.status}`}>
                        {PAYRUN_STATUS_LABELS[row.status]}
                      </span>
                      <b>{row.count}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* --------------------------------------------- salary trend */}
            <section className="ws-panel">
              <h2 className="ws-heading">Salary Trend</h2>
              <p className="admin-page__subtitle" style={{ margin: '0 0 12px' }}>
                Net pay across the last {data.salaryTrend.length} payrun
                {data.salaryTrend.length === 1 ? '' : 's'}
              </p>
              {data.salaryTrend.length === 0 ? (
                <p className="empty-note">No payruns yet.</p>
              ) : (
                <ul className="dash-trend">
                  {data.salaryTrend.map((row) => (
                    <li key={row.payrunId}>
                      <span className="dash-trend__label">{row.payrunName}</span>
                      <span className="dash-trend__bar-track">
                        <span
                          className="dash-trend__bar"
                          style={{ width: barWidth(row.net, maxTrend) }}
                        />
                      </span>
                      <span className="dash-trend__value money">{formatMoney(row.net)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* -------------------------------------------- attendance/leave */}
            <section className="ws-panel">
              <h2 className="ws-heading">
                Attendance Overview
                {!payrunId && <span className="dash-window"> &middot; last 30 days</span>}
              </h2>
              <div className="dash-mini-stats">
                <div>
                  <b>{data.attendance.present}</b>
                  <span>Present</span>
                </div>
                <div>
                  <b>{data.attendance.late}</b>
                  <span>Late</span>
                </div>
                <div>
                  <b>{data.attendance.absent}</b>
                  <span>Absent</span>
                </div>
                <div>
                  <b>{data.attendance.onLeave}</b>
                  <span>On Leave</span>
                </div>
              </div>
            </section>

            <section className="ws-panel">
              <h2 className="ws-heading">
                Time Off Overview
                {!payrunId && <span className="dash-window"> &middot; last 30 days</span>}
              </h2>
              <div className="dash-mini-stats">
                <div>
                  <b>{data.timeOff.pending}</b>
                  <span>To Approve</span>
                </div>
                <div>
                  <b>{data.timeOff.approved}</b>
                  <span>Approved</span>
                </div>
                <div>
                  <b>{data.timeOff.allocatedRemaining}</b>
                  <span>Days Remaining</span>
                </div>
              </div>
            </section>
          </div>

          <aside className="dash-col">
            {/* ------------------------------------------- salary by department */}
            <section className="ws-panel">
              <h2 className="ws-heading">Salary by Department</h2>
              {data.salaryByDepartment.length === 0 ? (
                <p className="empty-note">No payslips in scope.</p>
              ) : (
                <ul className="dash-trend">
                  {data.salaryByDepartment.map((row) => (
                    <li key={row.department}>
                      <span className="dash-trend__label">
                        {DEPARTMENT_LABELS[row.department] ?? row.department}
                        <em> &middot; {row.headcount}</em>
                      </span>
                      <span className="dash-trend__bar-track">
                        <span
                          className="dash-trend__bar dash-trend__bar--alt"
                          style={{ width: barWidth(row.gross, maxDept) }}
                        />
                      </span>
                      <span className="dash-trend__value money">{formatMoney(row.gross)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ------------------------------------------------- warnings */}
            <section className="ws-panel">
              <h2 className="ws-heading">Payroll Warnings</h2>
              <div className="dash-mini-stats dash-mini-stats--warn">
                <div>
                  <b className="payrun-warn payrun-warn--blocking">{data.warnings.blocking}</b>
                  <span>Blocking</span>
                </div>
                <div>
                  <b className="payrun-warn">{data.warnings.advisory}</b>
                  <span>Advisory</span>
                </div>
              </div>
              {data.warnings.items.length === 0 ? (
                <p className="empty-note">Nothing needs attention right now.</p>
              ) : (
                <ul className="warning-list">
                  {data.warnings.items.map((item, index) => (
                    <li
                      key={index}
                      className={`warning-item warning-item--${item.severity}`}
                      onClick={() => navigate(`/payslips/${item.payslipId}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="warning-item__tag">{item.severity}</span>
                      <span>
                        <strong>{item.employeeName}</strong> ({item.payrunName}): {item.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <p className="admin-page__note">
          Salary by Department always compares every department, even with one selected in the
          filter above &mdash; picking one there would leave only a single row. Salary Trend,
          Attendance, and Time Off still respect all three filters.
        </p>
      </div>
    </div>
  );
}
