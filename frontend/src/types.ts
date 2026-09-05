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

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  department: string;
  hasAccount: boolean;
}
