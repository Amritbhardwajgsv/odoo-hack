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

module.exports = { ROLES, HR_STAFF, DEPARTMENTS, EMPLOYEE_STATUSES, PASSWORD_SALT_ROUNDS };
