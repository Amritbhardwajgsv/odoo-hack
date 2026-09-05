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

// Nobody records or corrects their own hours - that is the admin's job.
// HR staff can punch anyone else in or out, but their own row has to be
// handled by someone above them, so worked hours cannot be self-serving.
function isOwnRecord(request, employeeId) {
  return Boolean(employeeId) && employeeId === request.user.employeeId;
}

function refuseSelfEdit(response) {
  response.status(403).json({
    message: 'You cannot record or correct your own attendance. An admin must do this for you.',
  });
}

function handleConstraintError(error, response) {
  // 23505 (one attendance record per employee per day) no longer reaches
  // here for create() - it upserts through the conflict instead - but
  // update() can still in principle collide if a date is moved onto a day
  // that already has a row, so the message stays for that path.
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

  const isAdmin = request.user.roles.includes('admin');
  if (!isAdmin && isOwnRecord(request, parsed.data.employeeId)) {
    return refuseSelfEdit(response);
  }

  try {
    response.status(201).json(await attendanceService.create(parsed.data, request.user.sub));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = updateAttendanceSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const existing = await attendanceService.findById(request.params.id);
  if (!existing) return response.status(404).json({ message: 'Attendance record not found' });

  // Checked against the row being edited and the row it would be moved to,
  // so an edit cannot be re-pointed at yourself either.
  const isAdmin = request.user.roles.includes('admin');
  if (!isAdmin && (isOwnRecord(request, existing.employeeId) || isOwnRecord(request, parsed.data.employeeId))) {
    return refuseSelfEdit(response);
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
