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
      <NavLink to="/" className="brand app-header__brand">PeoplePay360</NavLink>
      <nav className="app-header__nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Workspace</NavLink>
        {isHrStaff && <NavLink to="/employees" className={({ isActive }) => (isActive ? 'active' : '')}>People</NavLink>}
        {isHrStaff && <NavLink to="/contracts" className={({ isActive }) => (isActive ? 'active' : '')}>Contracts</NavLink>}
        {isAdmin && <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>Access</NavLink>}
      </nav>
      <div className="app-header__actions">
        <span className="signed-in-as">{user.employeeName}</span>
        <button className="btn btn--ghost" onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
