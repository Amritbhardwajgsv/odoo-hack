const express = require('express');

const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRouter = require('./routes/health.routes');

const app = express();

app.use(express.json());
app.use(requestLogger);
app.use('/api/health', healthRouter);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

