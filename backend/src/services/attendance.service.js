const pool = require('../../db/pool');

const SELECT_BASE = `
  SELECT a.*,
         e.full_name AS employee_name
    FROM attendance a
    JOIN employees e ON e.id = a.employee_id
`;

function mapAttendance(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    attendanceDate: row.attendance_date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    workedHours: row.worked_hours === null ? null : Number(row.worked_hours),
    status: row.status,
    isManualCorrection: row.is_manual_correction,
    correctedBy: row.corrected_by,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// Client punches arrive as naive "YYYY-MM-DDTHH:mm:ss" strings (no zone
// offset). Node parses those as local time, but a bare string handed
// straight to Postgres gets parsed against the *session* time zone instead
// - which can silently disagree with Node's local zone. Resolving through a
// Date here and always writing an explicit-offset ISO string keeps both
// sides reading the exact same instant.
function toTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// Worked hours are always derived from the punches themselves rather than
// trusted from the client, so a corrected check-in/out can't drift from the total.
function workedHoursFrom(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const hours = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000;
  return hours > 0 ? Math.round(hours * 100) / 100 : 0;
}

async function list({ search, employeeId, date, status } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`e.full_name ILIKE $${params.length}`);
  }
  if (employeeId) {
    params.push(employeeId);
    conditions.push(`a.employee_id = $${params.length}`);
  }
  if (date) {
    params.push(date);
    conditions.push(`a.attendance_date = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `${SELECT_BASE} ${where} ORDER BY a.attendance_date DESC, e.full_name`,
    params
  );
  return rows.map(mapAttendance);
}

async function findById(id) {
  const { rows } = await pool.query(`${SELECT_BASE} WHERE a.id = $1`, [id]);
  return rows[0] ? mapAttendance(rows[0]) : null;
}

async function create(data) {
  const checkIn = toTimestamp(data.checkIn);
  const checkOut = toTimestamp(data.checkOut);
  const { rows } = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, worked_hours, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      data.employeeId,
      data.attendanceDate,
      checkIn,
      checkOut,
      workedHoursFrom(checkIn, checkOut),
      data.status,
      data.notes || null,
    ]
  );
  return findById(rows[0].id);
}

async function update(id, data, correctedByUserId) {
  const existing = await findById(id);
  if (!existing) return null;

  const checkIn = data.checkIn !== undefined ? toTimestamp(data.checkIn) : toTimestamp(existing.checkIn);
  const checkOut = data.checkOut !== undefined ? toTimestamp(data.checkOut) : toTimestamp(existing.checkOut);
  const attendanceDate = data.attendanceDate !== undefined ? data.attendanceDate : existing.attendanceDate;
  const status = data.status !== undefined ? data.status : existing.status;
  const notes = data.notes !== undefined ? data.notes || null : existing.notes;

  // Any edit after creation is treated as a manual correction to the punches,
  // which HR reviews separately from raw device/self check-ins.
  const { rows } = await pool.query(
    `UPDATE attendance
        SET attendance_date = $1,
            check_in = $2,
            check_out = $3,
            worked_hours = $4,
            status = $5,
            notes = $6,
            is_manual_correction = true,
            corrected_by = $7
      WHERE id = $8
      RETURNING id`,
    [attendanceDate, checkIn, checkOut, workedHoursFrom(checkIn, checkOut), status, notes, correctedByUserId, id]
  );
  return rows[0] ? findById(rows[0].id) : null;
}

// -------------------------------------------------------------- self-service
// The quick attendance widget: every timestamp here comes from the server's
// own clock, never from the client, so this can never be used to fabricate
// or backdate hours the way an admin's manual correction could. That is
// what keeps it safe to offer to everyone, HR included - the earlier rule
// that HR cannot edit their own attendance is about the admin's manual
// correction form (explicit, typed-in times), not a live "now" punch.
function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function todayForEmployee(employeeId) {
  const { rows } = await pool.query(
    `${SELECT_BASE} WHERE a.employee_id = $1 AND a.attendance_date = $2`,
    [employeeId, todayDate()]
  );
  return rows[0] ? mapAttendance(rows[0]) : null;
}

// One row per (employee, date) is a hard schema constraint, so a second
// check-in the same day re-opens that same row rather than needing a
// second one - check_in moves to now, check_out clears, and worked_hours
// is left as whatever the previous segment already banked. checkOutSelf
// then adds the new segment on top instead of overwriting it, so hours
// from an earlier session that day are never lost to a later one.
async function checkInSelf(employeeId) {
  const existing = await todayForEmployee(employeeId);
  if (existing && !existing.checkOut) return { error: 'already_checked_in', attendance: existing };

  if (existing) {
    await pool.query(
      `UPDATE attendance SET check_in = now(), check_out = NULL, status = 'present' WHERE id = $1`,
      [existing.id]
    );
    return { attendance: await findById(existing.id) };
  }

  const { rows } = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, status)
     VALUES ($1, $2, now(), 'present') RETURNING id`,
    [employeeId, todayDate()]
  );
  return { attendance: await findById(rows[0].id) };
}

async function checkOutSelf(employeeId) {
  const existing = await todayForEmployee(employeeId);
  if (!existing || !existing.checkIn) return { error: 'not_checked_in' };
  if (existing.checkOut) return { error: 'already_checked_out', attendance: existing };

  const { rows } = await pool.query(
    `UPDATE attendance
        SET check_out = now(),
            worked_hours = ROUND(COALESCE(worked_hours, 0) + (EXTRACT(EPOCH FROM (now() - check_in)) / 3600.0)::numeric, 2)
      WHERE id = $1
      RETURNING id`,
    [existing.id]
  );
  return { attendance: await findById(rows[0].id) };
}

module.exports = {
  list,
  findById,
  create,
  update,
  todayForEmployee,
  checkInSelf,
  checkOutSelf,
};
