const express = require('express');
const cors = require('cors');

const { HR_STAFF, PAYROLL_STAFF } = require('./constants');
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
const workingSchedulesRouter = require('./routes/workingSchedules.routes');
const {
  requestsRouter: timeOffRequestsRouter,
  typesRouter: timeOffTypesRouter,
  allocationsRouter: timeOffAllocationsRouter,
} = require('./routes/timeOff.routes');
const { payrunsRouter, payslipsRouter } = require('./routes/payruns.routes');
const { jobPositionsRouter, overviewRouter } = require('./routes/lookups.routes');
const salaryStructuresRouter = require('./routes/salaryStructures.routes');
const salaryRulesRouter = require('./routes/salaryRules.routes');
const payrollDashboardRouter = require('./routes/payrollDashboard.routes');
const meRouter = require('./routes/me.routes');

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
app.use('/api/time-off/requests', requireAuth, requireRole(...HR_STAFF), timeOffRequestsRouter);
app.use('/api/time-off/types', requireAuth, requireRole(...HR_STAFF), timeOffTypesRouter);
app.use('/api/time-off/allocations', requireAuth, requireRole(...HR_STAFF), timeOffAllocationsRouter);
app.use('/api/job-positions', requireAuth, requireRole(...HR_STAFF), jobPositionsRouter);
app.use('/api/working-schedules', requireAuth, requireRole(...HR_STAFF), workingSchedulesRouter);
app.use('/api/payruns', requireAuth, requireRole(...PAYROLL_STAFF), payrunsRouter);
app.use('/api/payslips', requireAuth, requireRole(...PAYROLL_STAFF), payslipsRouter);
// Read is PAYROLL_STAFF-wide (a payroll user needs these to build a payrun);
// write is narrowed further to SALARY_MANAGERS inside each router.
app.use('/api/salary-structures', requireAuth, requireRole(...PAYROLL_STAFF), salaryStructuresRouter);
app.use('/api/salary-rules', requireAuth, requireRole(...PAYROLL_STAFF), salaryRulesRouter);
app.use('/api/payroll/dashboard', requireAuth, requireRole(...PAYROLL_STAFF), payrollDashboardRouter);
app.use('/api/overview', requireAuth, requireRole(...HR_STAFF), overviewRouter);
// No role restriction - every authenticated account (including a plain
// employee) reaches these; ownership is enforced inside the controller by
// scoping every query to request.user.employeeId.
app.use('/api/me', requireAuth, meRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
