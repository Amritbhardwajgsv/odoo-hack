const { z } = require('zod');

const employeesService = require('../services/employees.service');
const attendanceService = require('../services/attendance.service');
const timeOffService = require('../services/timeOff.service');
const payrunsService = require('../services/payruns.service');
const { buildPayslipPdf, payslipFileName } = require('../services/payslipPdf.service');

// Everything in this controller is scoped to request.user.employeeId - it
// exists so an authenticated employee can see their own records without
// needing the HR/Payroll roles the bulk endpoints require. Ownership is
// enforced by only ever querying for the caller's own employeeId, never by
// trusting an id from the request.

async function profile(request, response) {
  const employee = await employeesService.findByIdWithCounts(request.user.employeeId);
  if (!employee) return response.status(404).json({ message: 'Employee record not found' });
  response.json(employee);
}

// Only the "Private Information" fields from the admin employee form -
// personal contact details an employee owns and can reasonably correct
// themselves. Work-side fields (department, manager, job position,
// schedule, status, employee type, company, work email) are deliberately
// excluded here; those stay HR/Admin-only via /api/employees.
const privateInfoSchema = z.object({
  personalEmail: z.string().email().nullable().optional().or(z.literal('')),
  personalPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional().or(z.literal('')),
  emergencyContactName: z.string().nullable().optional(),
  emergencyContactPhone: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
});

async function updateProfile(request, response) {
  const parsed = privateInfoSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  // No accountData argument - self-service can never touch roles, password,
  // or active status, no matter what the request body contains.
  const updated = await employeesService.update(request.user.employeeId, parsed.data);
  if (!updated) return response.status(404).json({ message: 'Employee record not found' });
  response.json(updated);
}

async function attendance(request, response) {
  const rows = await attendanceService.list({ employeeId: request.user.employeeId });
  response.json(rows);
}

async function attendanceToday(request, response) {
  const record = await attendanceService.todayForEmployee(request.user.employeeId);
  response.json(record);
}

function respondToPunch(result, response) {
  if (result.error === 'already_checked_in') {
    return response.status(409).json({ message: 'Already checked in today', attendance: result.attendance });
  }
  if (result.error === 'not_checked_in') {
    return response.status(409).json({ message: 'You have not checked in today' });
  }
  if (result.error === 'already_checked_out') {
    return response.status(409).json({ message: 'Already checked out', attendance: result.attendance });
  }
  response.json(result.attendance);
}

async function checkIn(request, response) {
  respondToPunch(await attendanceService.checkInSelf(request.user.employeeId), response);
}

async function checkOut(request, response) {
  respondToPunch(await attendanceService.checkOutSelf(request.user.employeeId), response);
}

async function timeOffRequests(request, response) {
  const rows = await timeOffService.listRequests({ employeeId: request.user.employeeId });
  response.json(rows);
}

const requestSchema = z.object({
  timeOffTypeId: z.string().uuid(),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  reason: z.string().nullable().optional(),
});

async function createTimeOffRequest(request, response) {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  if (timeOffService.durationBetween(parsed.data.dateFrom, parsed.data.dateTo) <= 0) {
    return response.status(400).json({ message: 'The end date must be on or after the start date' });
  }

  try {
    // No `status` here - the service decides for itself whether this type
    // needs a manual approval step at all, same as the HR-facing form.
    const result = await timeOffService.createRequest({
      ...parsed.data,
      // Self-service can only ever file a request for yourself - never take
      // an employeeId from the body, however it got there.
      employeeId: request.user.employeeId,
    });
    if (result.error === 'invalid_type') {
      return response.status(400).json({ message: 'Referenced time off type does not exist' });
    }
    if (result.error === 'insufficient_allocation') {
      return response.status(409).json({
        message: result.hasAllocation
          ? `Not enough balance left: ${result.needed} requested but only ${result.available} remaining`
          : 'This leave type needs an allocation, and you have no approved balance covering those dates',
      });
    }
    response.status(201).json(result.request);
  } catch (error) {
    if (error.code === '23514' || error.code === '22000') {
      return response.status(400).json({ message: 'The end date must be on or after the start date' });
    }
    throw error;
  }
}

async function timeOffTypeOptions(_request, response) {
  const types = await timeOffService.listTypes({});
  response.json(types.filter((type) => type.isActive));
}

async function allocations(request, response) {
  const rows = await timeOffService.listAllocations({ employeeId: request.user.employeeId });
  response.json(rows);
}

async function payslips(request, response) {
  const rows = await payrunsService.listPayslips({ employeeId: request.user.employeeId });
  response.json(rows);
}

async function payslipDetail(request, response) {
  const payslip = await payrunsService.findPayslipById(request.params.id);
  // A 404 here (not 403) so a guessed id from another employee's payslip
  // never confirms that id exists at all.
  if (!payslip || payslip.employeeId !== request.user.employeeId) {
    return response.status(404).json({ message: 'Payslip not found' });
  }
  response.json(payslip);
}

async function payslipPdf(request, response) {
  const payslip = await payrunsService.findPayslipById(request.params.id);
  if (!payslip || payslip.employeeId !== request.user.employeeId) {
    return response.status(404).json({ message: 'Payslip not found' });
  }
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `inline; filename="${payslipFileName(payslip)}"`);
  buildPayslipPdf(payslip).pipe(response);
}

module.exports = {
  profile,
  updateProfile,
  attendance,
  attendanceToday,
  checkIn,
  checkOut,
  timeOffRequests,
  createTimeOffRequest,
  timeOffTypeOptions,
  allocations,
  payslips,
  payslipDetail,
  payslipPdf,
};
