const express = require('express');
const cors = require('cors');

const { HR_STAFF } = require('./constants');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth, requireRole } = require('./middleware/auth');
const healthRouter = require('./routes/health.routes');
const authRouter = require('./routes/auth.routes');
const usersRouter = require('./routes/users.routes');
const employeesRouter = require('./routes/employees.routes');
const contractsRouter = require('./routes/contracts.routes');
const attendanceRouter = require('./routes/attendance.routes');
const {
  jobPositionsRouter,
  workingSchedulesRouter,
  salaryStructuresRouter,
  overviewRouter,
} = require('./routes/lookups.routes');

const app = express();

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
app.use('/api/contracts', requireAuth, requireRole(...HR_STAFF), contractsRouter);
app.use('/api/attendance', requireAuth, requireRole(...HR_STAFF), attendanceRouter);
app.use('/api/job-positions', requireAuth, requireRole(...HR_STAFF), jobPositionsRouter);
app.use('/api/working-schedules', requireAuth, requireRole(...HR_STAFF), workingSchedulesRouter);
app.use('/api/salary-structures', requireAuth, requireRole(...HR_STAFF), salaryStructuresRouter);
app.use('/api/overview', requireAuth, requireRole(...HR_STAFF), overviewRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
