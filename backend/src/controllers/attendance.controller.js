const { z } = require('zod');

const attendanceService = require('../services/attendance.service');
const { ATTENDANCE_STATUSES } = require('../constants');

const attendanceSchema = z.object({
  employeeId: z.string().uuid(),
  attendanceDate: z.string().min(1),
  checkIn: z.string().nullable().optional().or(z.literal('')),
  checkOut: z.string().nullable().optional().or(z.literal('')),
  status: z.enum(ATTENDANCE_STATUSES).optional().default('present'),
  notes: z.string().nullable().optional(),
});

const updateAttendanceSchema = attendanceSchema.partial();

function handleConstraintError(error, response) {
  // One attendance record per employee per day.
  if (error.code === '23505') {
    response
      .status(409)
      .json({ message: 'This employee already has an attendance record for that date' });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'Referenced employee does not exist' });
    return true;
  }
  return false;
}

async function list(request, response) {
  const { search, employeeId, date, status } = request.query;
  response.json(await attendanceService.list({ search, employeeId, date, status }));
}

async function getById(request, response) {
  const record = await attendanceService.findById(request.params.id);
  if (!record) return response.status(404).json({ message: 'Attendance record not found' });
  response.json(record);
}

async function create(request, response) {
  const parsed = attendanceSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    response.status(201).json(await attendanceService.create(parsed.data));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = updateAttendanceSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    const record = await attendanceService.update(request.params.id, parsed.data, request.user.sub);
    if (!record) return response.status(404).json({ message: 'Attendance record not found' });
    response.json(record);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

module.exports = { list, getById, create, update };
