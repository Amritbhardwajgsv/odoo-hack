import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AppHeader.css';

const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];

export default function AppHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const isHrStaff = user.roles.some((role) => HR_STAFF.includes(role));
  const isAdmin = user.roles.includes('admin');

  return (
    <header className="app-header">
      <span className="brand app-header__brand">PeoplePay360</span>
      <nav className="app-header__nav">
        {isHrStaff && (
          <NavLink to="/employees" className={({ isActive }) => (isActive ? 'active' : '')}>
            Employees
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            Users
          </NavLink>
        )}
      </nav>
      <div className="app-header__actions">
        <span className="signed-in-as">{user.employeeName}</span>
        <button className="btn btn--ghost" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  );
}
