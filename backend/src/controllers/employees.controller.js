const { z } = require('zod');

const employeesService = require('../services/employees.service');
const { ROLES, DEPARTMENTS, EMPLOYEE_STATUSES } = require('../constants');

// Optional login credentials the admin can set while creating/editing an employee.
const accountSchema = z.object({
  password: z.string().min(8).optional(),
  roles: z.array(z.enum(ROLES)).min(1).optional(),
  isActive: z.boolean().optional(),
});

const employeeSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  department: z.enum(DEPARTMENTS),
  jobPositionId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  workingScheduleId: z.string().uuid().nullable().optional(),
  employeeType: z.string().min(1).optional().default('full_time'),
  status: z.enum(EMPLOYEE_STATUSES).optional().default('active'),
  dateJoined: z.string().min(1),
  workLocation: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  // Private Information tab
  personalEmail: z.string().email().nullable().optional().or(z.literal('')),
  personalPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional().or(z.literal('')),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  account: accountSchema.optional(),
});

const updateEmployeeSchema = employeeSchema.partial();

function handleConstraintError(error, response) {
  if (error.code === '23505') {
    response.status(409).json({ message: 'That email is already in use' });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'Referenced job position, manager, or schedule does not exist' });
    return true;
  }
  return false;
}

async function list(request, response) {
  const { search, department, status } = request.query;
  response.json(await employeesService.list({ search, department, status }));
}

async function getById(request, response) {
  const employee = await employeesService.findByIdWithCounts(request.params.id);
  if (!employee) return response.status(404).json({ message: 'Employee not found' });
  response.json(employee);
}

async function create(request, response) {
  const parsed = employeeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const { account, ...employeeData } = parsed.data;
  if (account && !account.password) {
    return response.status(400).json({ message: 'A password is required to create a login account' });
  }

  try {
    const employee = await employeesService.create(
      employeeData,
      account ? { roles: ['employee'], isActive: true, ...account } : null
    );
    response.status(201).json(employee);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = updateEmployeeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const { account, ...employeeData } = parsed.data;
  const existing = await employeesService.findById(request.params.id);
  if (!existing) return response.status(404).json({ message: 'Employee not found' });

  if (account) {
    if (!existing.account && !account.password) {
      return response
        .status(400)
        .json({ message: 'A password is required to create a login account' });
    }
    if (account.roles && existing.account && existing.account.id === request.user.sub) {
      return response.status(403).json({ message: 'You cannot change your own roles' });
    }
  }

  try {
    const employee = await employeesService.update(
      request.params.id,
      employeeData,
      account && !existing.account ? { roles: ['employee'], isActive: true, ...account } : account
    );
    if (!employee) return response.status(404).json({ message: 'Employee not found' });
    response.json(employee);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

module.exports = { list, getById, create, update };
