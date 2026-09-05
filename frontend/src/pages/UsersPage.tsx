import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { api, ApiError } from '../api/client';
import { ROLES, ROLE_LABELS, type Employee, type ManagedUser, type Role } from '../types';
import './users.css';

type PanelState = { mode: 'create' } | { mode: 'edit'; user: ManagedUser } | null;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [panel, setPanel] = useState<PanelState>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadUsers() {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    const query = params.toString();
    try {
      setUsers(await api.get<ManagedUser[]>(`/api/users${query ? `?${query}` : ''}`));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load users');
    }
  }

  async function loadEmployees() {
    try {
      setEmployees(await api.get<Employee[]>('/api/employees'));
    } catch {
      // Employee list is only needed for the create/edit panel - a failure here
      // shouldn't block viewing the user list.
    }
  }

  useEffect(() => {
    loadUsers();
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  function closePanel() {
    setPanel(null);
  }

  function onSaved() {
    closePanel();
    loadUsers();
    loadEmployees();
  }

  return (
    <div>
      <AppHeader />
      <div className="admin-page">
        <header className="admin-page__header">
          <div>
            <h1>User Management</h1>
            <span className="badge">Admin Only</span>
          </div>
        </header>

        <div className="admin-page__toolbar">
        <button className="btn btn--primary" onClick={() => setPanel({ mode: 'create' })}>
          + New User
        </button>
        <input
          className="search-input"
          placeholder="Search users, employees, or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | '')}>
          <option value="">Role Filter</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {loadError && <p className="error-banner">{loadError}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Employee</th>
            <th>Work Email</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} onClick={() => setPanel({ mode: 'edit', user })}>
              <td>{user.employeeName}</td>
              <td>{user.employeeName}</td>
              <td>{user.email}</td>
              <td>{user.roles.map((role) => ROLE_LABELS[role]).join(', ')}</td>
              <td>
                <span className={`status-pill ${user.isActive ? 'status-pill--active' : ''}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {panel && (
        <UserPanel
          panel={panel}
          employees={employees}
          currentUserId={currentUser?.id}
          onClose={closePanel}
          onSaved={onSaved}
        />
      )}
      </div>
    </div>
  );
}

function UserPanel({
  panel,
  employees,
  currentUserId,
  onClose,
  onSaved,
}: {
  panel: { mode: 'create' } | { mode: 'edit'; user: ManagedUser };
  employees: Employee[];
  currentUserId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = panel.mode === 'edit';
  const editingUser = isEdit ? panel.user : null;
  const isEditingSelf = isEdit && editingUser?.id === currentUserId;

  const [employeeId, setEmployeeId] = useState(editingUser?.employeeId ?? '');
  const [email, setEmail] = useState(editingUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Set<Role>>(new Set(editingUser?.roles ?? ['employee']));
  const [isActive, setIsActive] = useState(editingUser?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectableEmployees = employees.filter(
    (employee) => !employee.hasAccount || employee.id === employeeId
  );

  function toggleRole(role: Role) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function onEmployeeChange(id: string) {
    setEmployeeId(id);
    const employee = employees.find((candidate) => candidate.id === id);
    if (employee) setEmail(employee.email);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (roles.size === 0) {
      setError('Select at least one role.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editingUser) {
        const payload: Record<string, unknown> = { isActive };
        if (!isEditingSelf) payload.roles = Array.from(roles);
        if (password) payload.password = password;
        await api.patch(`/api/users/${editingUser.id}`, payload);
      } else {
        await api.post('/api/users', {
          employeeId,
          email,
          password,
          roles: Array.from(roles),
          isActive,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel" onClick={(event) => event.stopPropagation()}>
        <h2>{isEdit ? 'Edit User' : 'Create / Edit User'}</h2>

        <form onSubmit={handleSubmit}>
          <label>Employee *</label>
          <select
            value={employeeId}
            onChange={(event) => onEmployeeChange(event.target.value)}
            disabled={isEdit}
            required
          >
            <option value="">Select employee</option>
            {selectableEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>

          <label>Work Email *</label>
          <input type="email" value={email} disabled required />

          <label>{isEdit ? 'Reset Password (optional)' : 'Password *'}</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required={!isEdit}
            minLength={8}
          />

          <label>Roles *</label>
          <div className="roles-checklist">
            {ROLES.map((role) => (
              <label key={role} className="roles-checklist__item">
                <input
                  type="checkbox"
                  checked={roles.has(role)}
                  disabled={isEditingSelf}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          {isEditingSelf && (
            <p className="panel__hint">You cannot change your own roles.</p>
          )}

          <label className="account-status">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Account Status: {isActive ? 'Active' : 'Inactive'}
          </label>

          {error && <p className="panel__error">{error}</p>}

          <div className="panel__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Access' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
