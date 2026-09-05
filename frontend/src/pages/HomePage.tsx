import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AttendanceWidget from '../components/AttendanceWidget';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { DEPARTMENT_LABELS, ROLES, type Overview, type Role } from '../types';
import './home.css';

const HR_STAFF: Role[] = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];

// Quick actions only point at pages that exist and the user may open.
// Self-service ones are open to every role - everyone here is an employee
// too, whatever else their roles add on top.
const QUICK_ACTIONS: { label: string; hint: string; path: string; roles: Role[] }[] = [
  { label: 'People directory', hint: 'Browse and edit employee records', path: '/employees', roles: HR_STAFF },
  { label: 'Contracts', hint: 'Running contracts and history', path: '/contracts', roles: HR_STAFF },
  { label: 'User access', hint: 'Accounts, roles and status', path: '/users', roles: ['admin'] },
  { label: 'My profile', hint: 'Your own record, read-only', path: '/me/profile', roles: ROLES },
  { label: 'My attendance', hint: 'Check-in history and hours worked', path: '/me/attendance', roles: ROLES },
  { label: 'My time off', hint: 'Request leave and see your balance', path: '/me/time-off', roles: ROLES },
  { label: 'My payslips', hint: 'View and download your own payslips', path: '/me/payslips', roles: ROLES },
];

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN')}`;
}

type RoleFeature = {
  role: Role;
  label: string;
  title: string;
  text: string;
  items: string[];
  Icon: typeof UsersRound;
};

const ROLE_FEATURES: (RoleFeature & { emoji: string })[] = [
  { role: 'employee', emoji: '🙋', label: 'Employee', title: 'Your day, in one view.', text: 'Attendance, leave, and payslips without back-and-forth.', items: ['Check attendance', 'Request time off'], Icon: CalendarClock },
  { role: 'hr_manager', emoji: '🧑‍🤝‍🧑', label: 'HR manager', title: 'People operations, clear.', text: 'Keep employee information and approvals moving.', items: ['People directory', 'Leave approvals'], Icon: UsersRound },
  { role: 'hr_payroll_user', emoji: '🧾', label: 'Payroll user', title: 'Payroll inputs, ready.', text: 'Review data and resolve exceptions before payroll closes.', items: ['Payroll inputs', 'Resolve exceptions'], Icon: ClipboardCheck },
  { role: 'hr_payroll_manager', emoji: '💼', label: 'Payroll manager', title: 'Close with confidence.', text: 'See approvals, payroll runs, and reports in one place.', items: ['Approval queue', 'Payroll reports'], Icon: WalletCards },
  { role: 'admin', emoji: '🛡️', label: 'Admin', title: 'Access stays simple.', text: 'Control users, roles, and your organisation settings.', items: ['User access', 'Role setup'], Icon: ShieldCheck },
];

// What the platform actually does today, for the landing page's feature
// grid - concrete capabilities rather than abstract role-marketing copy.
const FEATURES: { emoji: string; title: string; text: string }[] = [
  { emoji: '⏱️', title: 'Live Attendance', text: 'Check in and out from a live widget on your workspace - no punch cards, no paperwork.' },
  { emoji: '🌴', title: 'Time Off', text: 'Request leave, track your balance, and approve requests in one click.' },
  { emoji: '💰', title: 'Payroll Engine', text: 'Salary rules, automatic payslips, and PDFs generated in seconds.' },
  { emoji: '📊', title: 'Payroll Dashboard', text: 'Department costs, salary trends, and warnings - all live, nothing hardcoded.' },
  { emoji: '🔐', title: 'Role-Based Access', text: 'Five focused workspaces behind one login, each seeing only what is theirs.' },
  { emoji: '📧', title: 'Payslip Delivery', text: 'Validated payslips emailed straight from the payrun, queued and reliable.' },
];

const ROLE_PRIORITY: Role[] = ['admin', 'hr_payroll_manager', 'hr_manager', 'hr_payroll_user', 'employee'];

function getWorkspace(roles: Role[]): RoleFeature {
  const role = ROLE_PRIORITY.find((item) => roles.includes(item)) ?? 'employee';
  return ROLE_FEATURES.find((item) => item.role === role) ?? ROLE_FEATURES[0];
}

function Workspace() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);

  const roles = user?.roles ?? [];
  const isHrStaff = roles.some((role) => HR_STAFF.includes(role));
  const workspace = getWorkspace(roles);
  const Icon = workspace.Icon;
  const firstName = user?.employeeName?.split(' ')[0] ?? 'there';
  const actions = QUICK_ACTIONS.filter((action) => action.roles.some((r) => roles.includes(r)));

  useEffect(() => {
    if (!isHrStaff) return;
    api
      .get<Overview>('/api/overview')
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [isHrStaff]);

  const attention = overview
    ? [
        overview.employeesWithoutContract > 0 && {
          text: `${overview.employeesWithoutContract} employee${overview.employeesWithoutContract > 1 ? 's have' : ' has'} no running contract`,
          detail: 'Payroll cannot compute without one.',
          path: '/contracts',
        },
        overview.employeesWithoutLogin > 0 && {
          text: `${overview.employeesWithoutLogin} employee${overview.employeesWithoutLogin > 1 ? 's' : ''} cannot sign in yet`,
          detail: 'No login account has been created.',
          path: '/employees',
        },
      ].filter(Boolean as unknown as (value: unknown) => value is { text: string; detail: string; path: string })
    : [];

  return (
    <>
      <AppHeader />
      <main className="app-workspace">
        <div className="app-workspace__heading">
          <p className="flow-kicker">
            <Sparkles size={14} /> Your workspace &middot; {firstName}
          </p>
          <h1>{workspace.title}</h1>
          <p>{workspace.text}</p>
        </div>

        {overview && (
          <section className="ws-stats">
            <article className="ws-stat">
              <UsersRound size={18} />
              <b>{overview.activeEmployees}</b>
              <span>Active people</span>
              <small>{overview.totalEmployees} on record</small>
            </article>
            <article className="ws-stat">
              <FileText size={18} />
              <b>{overview.runningContracts}</b>
              <span>Running contracts</span>
              <small>{overview.totalContracts} including history</small>
            </article>
            <article className="ws-stat">
              <ShieldCheck size={18} />
              <b>{overview.activeAccounts}</b>
              <span>Active logins</span>
              <small>across all roles</small>
            </article>
            <article className="ws-stat">
              <WalletCards size={18} />
              <b>{formatMoney(overview.monthlyWageTotal)}</b>
              <span>Monthly wage</span>
              <small>from running contracts</small>
            </article>
          </section>
        )}

        <div className="ws-columns">
          <section className="quick-actions">
            <h2 className="ws-heading">What would you like to do?</h2>
            {actions.map((action, index) => (
              <Link to={action.path} key={action.path}>
                <span>0{index + 1}</span>
                <Icon size={22} />
                <strong>
                  {action.label}
                  <em>{action.hint}</em>
                </strong>
                <ChevronRight size={18} />
              </Link>
            ))}
            {actions.length === 0 && (
              <p className="ws-empty">
                Your workspace has no admin actions. Attendance and time off arrive with those
                modules.
              </p>
            )}
          </section>

          <aside className="ws-side">
            <AttendanceWidget />

            <section className="ws-panel">
              <h2 className="ws-heading">Needs attention</h2>
              {attention.length > 0 ? (
                attention.map((item) => (
                  <Link to={item.path} className="ws-alert" key={item.text}>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>{item.text}</strong>
                      <em>{item.detail}</em>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="ws-empty">
                  {overview ? 'Nothing needs your attention right now.' : 'No alerts for your role.'}
                </p>
              )}
            </section>

            {overview && overview.departments.length > 0 && (
              <section className="ws-panel">
                <h2 className="ws-heading">Headcount by department</h2>
                <ul className="ws-dept">
                  {overview.departments.map((row) => (
                    <li key={row.department}>
                      <span>{DEPARTMENT_LABELS[row.department] ?? row.department}</span>
                      <b>{row.headcount}</b>
                      <small>{row.wageTotal > 0 ? formatMoney(row.wageTotal) : '—'}</small>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="ws-panel">
              <h2 className="ws-heading">Your access</h2>
              <div className="ws-roles">
                {roles.map((role) => (
                  <span key={role}>{role.replace(/_/g, ' ')}</span>
                ))}
              </div>
              <p className="ws-empty">Your workspace adapts to the roles assigned to you.</p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

export default function HomePage() {
  const { user } = useAuth();

  if (user) {
    return <Workspace />;
  }

  return (
    <main className="flow-page">
      <header className="flow-nav">
        <Link to="/" className="flow-brand"><LayoutDashboard size={18} /> PeoplePay360</Link>
        <nav>
          <a href="#workspaces">Workspaces</a>
          <a href="#why">Why it works</a>
          <Link to="/login" className="flow-nav__signin">Sign in <ArrowUpRight size={15} /></Link>
        </nav>
      </header>

      <section className="flow-hero">
        <div className="flow-glow" aria-hidden="true" />
        <div>
          <p className="flow-kicker">✨ HR and payroll, without the clutter</p>
          <h1>Work flows better when everyone sees the right next step.</h1>
          <p className="flow-hero__copy">PeoplePay360 gives every person a focused workspace. Employees get their essentials; HR, payroll, and admin teams get the controls they need.</p>
          <div className="flow-hero__buttons">
            <Link to="/login" className="flow-button">Open your workspace <ArrowUpRight size={17} /></Link>
            <a href="#workspaces" className="flow-text-link">Explore roles <ChevronRight size={17} /></a>
          </div>
        </div>
        <aside className="flow-overview">
          <div className="flow-overview__top"><span>Today</span><span className="flow-live">🟢 All systems clear</span></div>
          <h2>One platform.<br />Five focused workspaces.</h2>
          <div className="flow-stat-row"><div><b>5</b><span>role views</span></div><div><b>1</b><span>clear flow</span></div></div>
        </aside>
      </section>

      <section id="features" className="flow-features">
        <div className="section-heading">
          <p className="flow-kicker">🚀 What's actually inside</p>
          <h2>Real HR &amp; payroll,<br />not a mockup.</h2>
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <span className="feature-card__emoji">{feature.emoji}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workspaces" className="flow-workspaces">
        <div className="section-heading">
          <p className="flow-kicker">Built for each role</p>
          <h2>Everything is connected.<br />Nothing is crowded.</h2>
        </div>
        <div className="role-grid">
          {ROLE_FEATURES.map((feature, index) => {
            const Icon = feature.Icon;
            return (
              <article className={'role-card role-card--' + feature.role} key={feature.role}>
                <div className="role-card__icon"><Icon size={22} /></div>
                <span>{feature.emoji} 0{index + 1} / {feature.label}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <div className="role-card__links">
                  {feature.items.map((item) => <a href="/login" key={item}>{item} <ArrowUpRight size={14} /></a>)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="why" className="flow-why">
        <div><p className="flow-kicker">💡 Why this flow works</p><h2>Less switching. More getting things done.</h2></div>
        <div className="flow-why__points">
          <p><b>🔑</b> One identity follows you across the tools you are allowed to use.</p>
          <p><b>🎯</b> Each workspace starts with the actions that matter for that role.</p>
          <p><b>🧭</b> Teams stay aligned without seeing unnecessary complexity.</p>
        </div>
      </section>

      <footer className="flow-footer">
        <span>👋 PeoplePay360</span>
        <Link to="/login">Sign in to your workspace <ArrowUpRight size={15} /></Link>
      </footer>
    </main>
  );
}
