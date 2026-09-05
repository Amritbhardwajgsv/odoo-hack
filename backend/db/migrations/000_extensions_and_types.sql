CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM (
    'employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'
);
CREATE TYPE contract_status AS ENUM ('draft', 'active', 'expired', 'terminated');
CREATE TYPE attendance_status AS ENUM ('present', 'late', 'absent', 'on_leave', 'exception');
CREATE TYPE time_off_unit AS ENUM ('days', 'hours');
CREATE TYPE time_off_request_status AS ENUM ('draft', 'submitted', 'approved', 'refused');
CREATE TYPE allocation_status AS ENUM ('draft', 'approved', 'expired');
CREATE TYPE salary_category AS ENUM ('basic', 'allowance', 'deduction', 'contribution', 'gross', 'net');
CREATE TYPE computation_method AS ENUM (
    'fixed', 'percentage_of_basic', 'percentage_of_gross',
    'percentage_of_contract_wage', 'formula'
);
CREATE TYPE payrun_status AS ENUM ('draft', 'computed', 'validated', 'paid');
CREATE TYPE payslip_status AS ENUM ('draft', 'computed', 'validated', 'paid');
CREATE TYPE warning_severity AS ENUM ('blocking', 'advisory');
CREATE TYPE department_type AS ENUM (
    'engineering',
    'sales',
    'hr',
    'finance',
    'marketing',
    'operations',
    'customer_support',
    'admin'
);
CREATE TYPE status_type AS ENUM ('active',  'terminated');