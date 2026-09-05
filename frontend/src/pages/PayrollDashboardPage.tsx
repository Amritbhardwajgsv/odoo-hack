import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader';
import { BarChart, LineChart, StackedBar, formatCompact } from '../components/charts';
import { api, ApiError } from '../api/client';
import { DEPARTMENT_LABELS, type Department, type PayrollDashboard } from '../types';
import { formatMoney } from './PayrunsPage';
import './shared.css';
import './employees.css';
import './payroll.css';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// 'YYYY-MM' -> "Sep 2026"
function formatPeriod(period: string) {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function departmentLabel(department: Department) {
  return DEPARTMENT_LABELS[department] ?? department;
}

export default function PayrollDashboardPage() {
  const [data, setData] = useState<PayrollDashboard | null>(null);
  const [period, setPeriod] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeType, setEmployeeType] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (department) params.set('department', department);
    if (employeeType) params.set('employeeType', employeeType);
    if (company) params.set('company', company);
    const query = params.toString();

    try {
      const result = await api.get<PayrollDashboard>(`/api/payroll/dashboard${query ? `?${query}` : ''}`);
      setData(result);
      // The server resolves a default period on first load; adopt it so
      // the filter row shows what is actually being displayed.
      if (!period) setPeriod(result.filters.period);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the payroll dashboard');
    }
  }, [period, department, employeeType, company]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, employeeType, company, period]);

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

  const { metrics } = data;
  const deltaClass =
    metrics.totalNetPaid.deltaPct > 0
      ? 'metric-delta metric-delta--up'
      : metrics.totalNetPaid.deltaPct < 0
        ? 'metric-delta metric-delta--down'
        : 'metric-delta';
  const deltaSign = metrics.totalNetPaid.deltaPct > 0 ? '+' : '';

  const statusColorClass: Record<string, string> = {
    paid: 'chart-stack__seg--paid',
    done: 'chart-stack__seg--done',
    pending: 'chart-stack__seg--pending',
    warning: 'chart-stack__seg--warning',
  };

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>Payroll Dashboard</h1>
            <p className="admin-page__subtitle">
              Combines Payroll with HR data to help payroll and HR understand payments, staffing
              impact, leave patterns, and attendance quality for the selected period.
            </p>
          </div>
        </header>

        <div className="admin-page__toolbar">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {data.options.periods.map((value) => (
              <option key={value} value={value}>
                {formatPeriod(value)}
              </option>
            ))}
          </select>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {data.options.departments.map((value) => (
              <option key={value} value={value}>
                {departmentLabel(value)}
              </option>
            ))}
          </select>
          <select value={employeeType} onChange={(e) => setEmployeeType(e.target.value)}>
            <option value="">All Types</option>
            {data.options.employeeTypes.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
          <select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">All Companies</option>
            {data.options.companies.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {/* ---------------------------------------------------- headline cards */}
        <div className="metric-row">
          <div className="metric-card">
            <span>Total Net Salary Paid</span>
            <strong className="money">{formatMoney(metrics.totalNetPaid.value)}</strong>
            <em className={deltaClass}>
              {deltaSign}
              {metrics.totalNetPaid.deltaPct}% vs previous month
            </em>
          </div>
          <div className="metric-card">
            <span>Payslips Generated</span>
            <strong>{metrics.payslipsGenerated.total}</strong>
            <em className="metric-delta metric-delta--up">
              {metrics.payslipsGenerated.paid} paid, {metrics.payslipsGenerated.pending} pending
            </em>
          </div>
          <div className="metric-card">
            <span>Avg Salary / Employee</span>
            <strong className="money">{formatMoney(metrics.avgSalaryPerEmployee.value)}</strong>
            <em className="metric-delta">Based on selected period</em>
          </div>
          <div className="metric-card">
            <span>Approved Time Off Days</span>
            <strong>{metrics.approvedTimeOffDays.value} Days</strong>
            <em className="metric-delta">Across selected period</em>
          </div>
          <div className="metric-card">
            <span>Attendance Health</span>
            <strong>{metrics.attendanceHealth.pct}%</strong>
            <em className="metric-delta">Present / reviewed records</em>
          </div>
        </div>

        {/* --------------------------------------------------------- charts row */}
        <div className="dash-grid-3">
          <section className="ws-panel">
            <h2 className="ws-heading">Salary Cost by Department</h2>
            <p className="chart-source">Source: Payslips + Employee Department</p>
            <BarChart
              ariaLabel="Salary cost by department"
              data={data.salaryByDepartment.map((row) => ({
                label: departmentLabel(row.department),
                value: row.net,
              }))}
            />
          </section>

          <section className="ws-panel">
            <h2 className="ws-heading">Monthly Net Salary Trend</h2>
            <p className="chart-source">Source: historical Payslips / Payruns</p>
            <LineChart
              ariaLabel="Monthly net salary trend"
              data={data.salaryTrend.map((row) => ({
                label: formatPeriod(row.month).split(' ')[0],
                value: row.net,
              }))}
              formatValue={(v) => formatCompact(v)}
            />
          </section>

          <section className="ws-panel">
            <h2 className="ws-heading">Payslip Status &amp; Payroll Alerts</h2>
            <p className="chart-source">Source: Payrun + Payslip validation</p>

            <div className="status-split">
              <span className="chart-subheading">Status split</span>
              <StackedBar
                segments={data.payslipStatus.segments.map((segment) => ({
                  key: segment.key,
                  pct: segment.pct,
                  className: statusColorClass[segment.key],
                }))}
              />
              <div className="chart-legend">
                {data.payslipStatus.segments.map((segment) => (
                  <span key={segment.key} className="chart-legend__item">
                    <i className={`chart-legend__dot ${statusColorClass[segment.key]}`} />
                    {segment.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="alerts-block">
              <span className="chart-subheading">Current alerts</span>
              {data.alerts.length === 0 ? (
                <p className="empty-note">Nothing needs attention right now.</p>
              ) : (
                <ul className="alert-list">
                  {data.alerts.map((alert, index) => (
                    <li key={index} className={`alert-list__item alert-list__item--${alert.severity}`}>
                      {alert.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* --------------------------------------------------- overview row */}
        <div className="dash-grid-3">
          <section className="ws-panel">
            <h2 className="ws-heading">Attendance Overview</h2>
            <p className="chart-source">Source: Attendance</p>
            <BarChart
              ariaLabel="Attendance overview"
              data={[
                { label: 'Present', value: data.attendance.present },
                { label: 'Late', value: data.attendance.late },
                { label: 'Absent', value: data.attendance.absent },
                { label: 'Overtime', value: data.attendance.overtime },
              ]}
              formatValue={(v) => String(v)}
            />
            <ul className="stat-lines">
              <li>
                Missing check-outs: <b>{data.attendance.missingCheckouts}</b>
              </li>
              <li>
                Manual attendance edits: <b>{data.attendance.manualEdits}</b>
              </li>
              <li>
                Attendance coverage: <b>{data.attendance.coveragePct}%</b>
              </li>
            </ul>
          </section>

          <section className="ws-panel">
            <h2 className="ws-heading">Time Off Overview</h2>
            <p className="chart-source">Source: Time Off Requests + Allocations</p>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Approved Days</th>
                  <th>Pending</th>
                  <th>Remaining Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.timeOff.map((row) => (
                  <tr key={row.typeId} style={{ cursor: 'default' }}>
                    <td>{row.typeName}</td>
                    <td>{row.approvedDays}</td>
                    <td>{row.pending}</td>
                    <td>{row.remainingBalance === null ? 'N/A' : `${row.remainingBalance} Days`}</td>
                  </tr>
                ))}
                {data.timeOff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      No leave types configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="ws-panel">
            <h2 className="ws-heading">Department Overview</h2>
            <p className="chart-source">Source: Employee + Contract totals</p>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Headcount</th>
                  <th>Monthly Salary</th>
                </tr>
              </thead>
              <tbody>
                {data.departmentOverview.map((row) => (
                  <tr key={row.department} style={{ cursor: 'default' }}>
                    <td>{departmentLabel(row.department)}</td>
                    <td>{row.headcount}</td>
                    <td className="money">{formatCompact(row.monthlySalary, '₹')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <p className="admin-page__note">
          Salary by Department and Department Overview always compare every department, even with
          one selected above &mdash; picking one there would leave a single row. Every other card
          respects Period, Department, Employee Type and Company together.
        </p>
      </div>
    </div>
  );
}
