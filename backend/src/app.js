const express = require('express');
const cors = require('cors');

const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, requireRole } = require('./middleware/auth');
const healthRouter = require('./routes/health.routes');
const authRouter = require('./routes/auth.routes');
const usersRouter = require('./routes/users.routes');
const employeesRouter = require('./routes/employees.routes');
const jobPositionsRouter = require('./routes/jobPositions.routes');
const workingSchedulesRouter = require('./routes/workingSchedules.routes');

const app = express();

// Per the spec's role matrix, HR Manager and above (not just Admin) get
// full CRUD on Employees/Contracts/Attendance/Working Schedules/Time Off.
const HR_STAFF = ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];

// The frontend isn't deployed alongside this API and has no fixed origin,
// so CORS is left open here; set CORS_ORIGIN (comma-separated) to lock it
// down to specific origins later.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(',').map((origin) => origin.trim()) } : undefined));
app.use(express.json());
app.use(requestLogger);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, requireRole('admin'), usersRouter);
app.use('/api/employees', requireAuth, requireRole(...HR_STAFF), employeesRouter);
app.use('/api/job-positions', requireAuth, requireRole(...HR_STAFF), jobPositionsRouter);
app.use('/api/working-schedules', requireAuth, requireRole(...HR_STAFF), workingSchedulesRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

