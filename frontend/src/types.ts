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
  // Sent by the API since the multi-role change. Optional so a session
  // stored before that still works without forcing a re-login.
  primaryRole?: Role;
  landingPath?: string;
  permissions?: string[];
  navigation?: { key: string; label: string; path: string }[];
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
  workLocation: string | null;
  company: string | null;
  personalEmail: string | null;
  personalPhone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bankAccount: string | null;
  hasAccount: boolean;
  account: { id: string; roles: Role[]; isActive: boolean } | null;
  createdAt: string;
}

export interface EmployeeCounts {
  contracts: number;
  attendance: number;
  timeOff: number;
  allocations: number;
}

export interface EmployeeDetail extends Employee {
  counts: EmployeeCounts;
}

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'active', 'expired', 'terminated'];

// 'active' reads as "Running" everywhere in the UI.
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft',
  active: 'Running',
  expired: 'Expired',
  terminated: 'Terminated',
};

export interface Contract {
  id: string;
  contractNumber: string;
  employeeId: string;
  employeeName: string;
  department: Department;
  jobPositionId: string | null;
  jobPositionTitle: string | null;
  workingScheduleId: string | null;
  workingScheduleName: string | null;
  workingScheduleHours: number | null;
  salaryStructureId: string;
  salaryStructureName: string | null;
  wage: number;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  notes: string | null;
  createdAt: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'on_leave' | 'exception';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'on_leave',
  'exception',
];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  on_leave: 'On Leave',
  exception: 'Exception',
};

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  status: AttendanceStatus;
  isManualCorrection: boolean;
  correctedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SalaryStructure {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface Overview {
  activeEmployees: number;
  totalEmployees: number;
  runningContracts: number;
  totalContracts: number;
  activeAccounts: number;
  employeesWithoutLogin: number;
  employeesWithoutContract: number;
  monthlyWageTotal: number;
  departments: { department: Department; headcount: number; wageTotal: number }[];
}

export interface JobPosition {
  id: string;
  title: string;
  department: Department;
}

export type TimeOffStatus = 'draft' | 'submitted' | 'approved' | 'refused';

export const TIME_OFF_STATUS_LABELS: Record<TimeOffStatus, string> = {
  draft: 'Draft',
  submitted: 'To Approve',
  approved: 'Approved',
  refused: 'Refused',
};

export interface TimeOffType {
  id: string;
  name: string;
  unit: 'days' | 'hours';
  requiresAllocation: boolean;
  requiresApproval: boolean;
  affectsPayroll: boolean;
  approvalBy: string;
  displayColor: string;
  isActive: boolean;
  workEntry: string | null;
  notes: string | null;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  timeOffTypeId: string;
  typeName: string;
  typeUnit: 'days' | 'hours';
  requiresAllocation: boolean;
  requiresApproval: boolean;
  dateFrom: string;
  dateTo: string;
  duration: number;
  status: TimeOffStatus;
  reason: string | null;
  approverName: string | null;
  approvedAt: string | null;
  allocationId: string | null;
  allocationLabel: string | null;
  allocationRemaining: number | null;
  createdAt: string;
}

export interface TimeOffAllocation {
  id: string;
  employeeId: string;
  employeeName: string;
  timeOffTypeId: string;
  typeName: string;
  unit: 'days' | 'hours';
  allocated: number;
  taken: number;
  remaining: number;
  validFrom: string;
  validTo: string | null;
  validityLabel: string | null;
  status: string;
  approverName: string | null;
  approvedAt: string | null;
  description: string | null;
}

export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface ScheduleLine {
  id?: string;
  dayOfWeek: number;
  dayName?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours?: number;
}

export interface WorkingSchedule {
  id: string;
  name: string;
  type: string;
  company: string | null;
  timezone: string;
  isActive: boolean;
  daysPerWeek: number;
  totalWeeklyHours: number;
  createdAt?: string;
}

export interface WorkingScheduleDetail extends WorkingSchedule {
  lines: ScheduleLine[];
}
