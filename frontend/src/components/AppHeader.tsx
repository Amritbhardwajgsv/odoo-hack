import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './AppHeader.css';

const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];
// Payroll is narrower: a plain HR Manager never sees wages or payslips.
const PAYROLL_STAFF = ['admin', 'hr_payroll_manager', 'hr_payroll_user'];

interface Leaf {
  path: string;
  label: string;
  end?: boolean;
}

interface NavEntry {
  key: string;
  label: string;
  visible: boolean;
  // A single-destination entry has just `path`; a grouped one lists
  // `children` and opens a dropdown (desktop) or an expanded section
  // (mobile) instead of navigating directly.
  path?: string;
  end?: boolean;
  children?: Leaf[];
}

// Grouping related screens under one nav entry is what actually fixes the
// mobile/overflow problem - 11 flat destinations become 6 top-level items,
// with the pages people reach for together (Time Off + Allocations + Leave
// Types, Payruns + Payslips + Salary setup) sitting behind one label.
function buildNav(roles: string[]): NavEntry[] {
  const isHrStaff = roles.some((role) => HR_STAFF.includes(role));
  const isPayrollStaff = roles.some((role) => PAYROLL_STAFF.includes(role));
  const isAdmin = roles.includes('admin');

  return [
    { key: 'workspace', label: 'Workspace', path: '/', end: true, visible: true },
    {
      key: 'employees',
      label: 'Employees',
      visible: isHrStaff,
      children: [
        { path: '/employees', label: 'People' },
        { path: '/contracts', label: 'Contracts' },
        { path: '/working-schedules', label: 'Working Schedules' },
      ],
    },
    { key: 'attendance', label: 'Attendance', path: '/attendance', visible: isHrStaff },
    {
      key: 'timeoff',
      label: 'Time Off',
      visible: isHrStaff,
      children: [
        { path: '/time-off', label: 'Requests' },
        { path: '/allocations', label: 'Allocations' },
        { path: '/time-off-types', label: 'Leave Types' },
      ],
    },
    {
      key: 'payroll',
      label: 'Payroll',
      visible: isPayrollStaff,
      children: [
        { path: '/payruns', label: 'Payruns' },
        { path: '/payslips', label: 'Payslips' },
        { path: '/salary-structures', label: 'Salary Structures' },
        { path: '/salary-rules', label: 'Salary Rules' },
      ],
    },
    { key: 'access', label: 'Access', path: '/users', visible: isAdmin },
  ];
}

function isChildActive(children: Leaf[] | undefined, pathname: string) {
  return (children ?? []).some((child) => pathname.startsWith(child.path));
}

export default function AppHeader() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Close whichever dropdown/panel is open on navigation, and close a
  // desktop dropdown on an outside click - the two things that make a
  // click-to-open menu feel broken if left unhandled.
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!user) return null;

  const entries = buildNav(user.roles).filter((entry) => entry.visible);

  return (
    <header className="app-header">
      <NavLink to="/" className="brand app-header__brand">
        PeoplePay360
      </NavLink>

      <nav className="app-header__nav" ref={navRef}>
        {entries.map((entry) =>
          entry.children ? (
            <div className="nav-group" key={entry.key}>
              <button
                type="button"
                className={
                  'nav-group__trigger' +
                  (isChildActive(entry.children, location.pathname) ? ' active' : '')
                }
                aria-expanded={openGroup === entry.key}
                onClick={() => setOpenGroup((current) => (current === entry.key ? null : entry.key))}
              >
                {entry.label}
                <ChevronDown size={14} className={openGroup === entry.key ? 'is-open' : ''} />
              </button>
              {openGroup === entry.key && (
                <div className="nav-group__menu">
                  {entry.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              key={entry.key}
              to={entry.path!}
              end={entry.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {entry.label}
            </NavLink>
          )
        )}
      </nav>

      <div className="app-header__actions">
        <span className="signed-in-as">{user.employeeName}</span>
        <button className="btn btn--ghost" onClick={logout}>
          Sign out
        </button>
        <button
          type="button"
          className="app-header__burger"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="app-header__mobile">
          {entries.map((entry) =>
            entry.children ? (
              <div className="mobile-group" key={entry.key}>
                <span className="mobile-group__label">{entry.label}</span>
                {entry.children.map((child) => (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            ) : (
              <NavLink
                key={entry.key}
                to={entry.path!}
                end={entry.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                {entry.label}
              </NavLink>
            )
          )}
          <div className="mobile-group">
            <span className="mobile-group__label">{user.employeeName}</span>
            <button className="btn btn--ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
