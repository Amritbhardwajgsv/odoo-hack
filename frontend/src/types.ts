export type Role = 'employee' | 'hr_manager' | 'hr_payroll_user' | 'hr_payroll_manager' | 'admin';

export const ROLES: Role[] = [
  'employee',
  'hr_manager',
  'hr_payroll_user',
  'hr_payroll_manager',
  'admin',
];

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  hr_manager: 'HR Manager',
  hr_payroll_user: 'HR Payroll User',
  hr_payroll_manager: 'HR Payroll Manager',
  admin: 'Admin',
};

export interface AuthUser {
  id: string;
  email: string;
  roles: Role[];
  employeeId: string;
  employeeName: string | null;
}

export interface ManagedUser {
  id: string;
  email: string;
  roles: Role[];
  isActive: boolean;
  employeeId: string;
  employeeName: string | null;
  createdAt: string;
}

export type Department =
  | 'engineering'
  | 'sales'
  | 'hr'
  | 'finance'
  | 'marketing'
  | 'operations'
  | 'customer_support'
  | 'admin';

export const DEPARTMENTS: Department[] = [
  'engineering',
  'sales',
  'hr',
  'finance',
  'marketing',
  'operations',
  'customer_support',
  'admin',
];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  engineering: 'Engineering',
  sales: 'Sales',
  hr: 'HR',
  finance: 'Finance',
  marketing: 'Marketing',
  operations: 'Operations',
  customer_support: 'Customer Support',
  admin: 'Admin',
};

export type EmployeeStatus = 'active' | 'terminated';

export interface Employee {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  department: Department;
  jobPositionId: string | null;
  jobPositionTitle: string | null;
  managerId: string | null;
  managerName: string | null;
  workingScheduleId: string | null;
  workingScheduleName: string | null;
  employeeType: string;
  status: EmployeeStatus;
  dateJoined: string;
  hasAccount: boolean;
  createdAt: string;
}

export interface JobPosition {
  id: string;
  title: string;
  department: Department;
}

export interface WorkingSchedule {
  id: string;
  name: string;
  type: string;
  totalWeeklyHours: number;
}
