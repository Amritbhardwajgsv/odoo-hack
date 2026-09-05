const { ROLE_PRIORITY } = require('./constants');

// Each role builds on the one below it, mirroring the spec's role matrix:
// HR Payroll User is "all HR Manager permissions plus payruns/payslips",
// HR Payroll Manager adds full control of salary config, Admin gets
// everything plus user management.
const EMPLOYEE = ['profile:self', 'attendance:self', 'timeoff:self', 'payslips:self'];

const HR_MANAGER = [
  ...EMPLOYEE,
  'employees:manage',
  'contracts:manage',
  'schedules:manage',
  'attendance:manage',
  'timeoff:manage',
  'timeoff:approve',
];

const HR_PAYROLL_USER = [...HR_MANAGER, 'payruns:write', 'payslips:write', 'salary:read'];

const HR_PAYROLL_MANAGER = [
  ...HR_PAYROLL_USER,
  'payruns:manage',
  'payslips:manage',
  'salary:manage',
];

const ADMIN = [...HR_PAYROLL_MANAGER, 'users:manage'];

const ROLE_PERMISSIONS = {
  employee: EMPLOYEE,
  hr_manager: HR_MANAGER,
  hr_payroll_user: HR_PAYROLL_USER,
  hr_payroll_manager: HR_PAYROLL_MANAGER,
  admin: ADMIN,
};

// Only routes that actually exist are listed, so nothing points at a 404.
const NAVIGATION = [
  { key: 'workspace', label: 'Workspace', path: '/', permission: null },
  { key: 'people', label: 'People', path: '/employees', permission: 'employees:manage' },
  { key: 'contracts', label: 'Contracts', path: '/contracts', permission: 'contracts:manage' },
  { key: 'schedules', label: 'Schedules', path: '/working-schedules', permission: 'schedules:manage' },
  { key: 'timeoff', label: 'Time Off', path: '/time-off', permission: 'timeoff:manage' },
  { key: 'attendance', label: 'Attendance', path: '/attendance', permission: 'attendance:manage' },
  { key: 'payroll', label: 'Payroll', path: '/payruns', permission: 'payruns:write' },
  { key: 'access', label: 'Access', path: '/users', permission: 'users:manage' },
];

// Someone holding several roles gets the union of everything those roles
// allow, never just their highest one.
function permissionsFor(roles = []) {
  const granted = new Set();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] || []) granted.add(permission);
  }
  return [...granted].sort();
}

function can(roles, permission) {
  return permissionsFor(roles).includes(permission);
}

function navigationFor(roles = []) {
  const granted = permissionsFor(roles);
  return NAVIGATION.filter((item) => !item.permission || granted.includes(item.permission)).map(
    ({ key, label, path }) => ({ key, label, path })
  );
}

const LANDING_BY_ROLE = {
  admin: '/users',
  hr_payroll_manager: '/employees',
  hr_payroll_user: '/employees',
  hr_manager: '/employees',
  employee: '/',
};

function primaryRole(roles = []) {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || 'employee';
}

// Which single page opens first is decided by the strongest role held;
// everything else they can reach is exposed through navigation/permissions.
function landingPathFor(roles = []) {
  return LANDING_BY_ROLE[primaryRole(roles)] || '/';
}

module.exports = { ROLE_PERMISSIONS, permissionsFor, can, navigationFor, primaryRole, landingPathFor };
