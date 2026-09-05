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

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(requestLogger);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', requireAuth, requireRole('admin'), usersRouter);
app.use('/api/employees', requireAuth, requireRole('admin'), employeesRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

