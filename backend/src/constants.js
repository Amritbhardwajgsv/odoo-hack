const ROLES = ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'];

// Per the spec's role matrix, HR Manager and above get full CRUD on the
// HR master data (employees, contracts, schedules, attendance, time off).
const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];

const DEPARTMENTS = [
  'engineering',
  'sales',
  'hr',
  'finance',
  'marketing',
  'operations',
  'customer_support',
  'admin',
];

const EMPLOYEE_STATUSES = ['active', 'terminated'];

const PASSWORD_SALT_ROUNDS = 10;

// Most-privileged first: a user with several roles lands on the page for
// the strongest one they hold.
const ROLE_PRIORITY = ['admin', 'hr_payroll_manager', 'hr_payroll_user', 'hr_manager', 'employee'];

const LANDING_PATHS = {
  admin: '/users',
  hr_payroll_manager: '/employees',
  hr_payroll_user: '/employees',
  hr_manager: '/employees',
  employee: '/',
};

function primaryRole(roles = []) {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || 'employee';
}

function landingPathFor(roles = []) {
  return LANDING_PATHS[primaryRole(roles)];
}

module.exports = {
  ROLES,
  HR_STAFF,
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
  PASSWORD_SALT_ROUNDS,
  ROLE_PRIORITY,
  LANDING_PATHS,
  primaryRole,
  landingPathFor,
};
