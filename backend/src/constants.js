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

// 'active' is shown as "Running" in the UI, which is the wording the
// wireframes and the payroll flow use.
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'];

const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on_leave', 'exception'];

const PASSWORD_SALT_ROUNDS = 10;

// Most-privileged first. Used to decide which single page opens after
// login; see permissions.js for what a multi-role user can actually reach.
const ROLE_PRIORITY = ['admin', 'hr_payroll_manager', 'hr_payroll_user', 'hr_manager', 'employee'];

module.exports = {
  ROLES,
  HR_STAFF,
  DEPARTMENTS,
  EMPLOYEE_STATUSES,
  CONTRACT_STATUSES,
  ATTENDANCE_STATUSES,
  PASSWORD_SALT_ROUNDS,
  ROLE_PRIORITY,
};
