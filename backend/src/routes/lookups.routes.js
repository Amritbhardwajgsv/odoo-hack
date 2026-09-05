const { Router } = require('express');

const lookupsController = require('../controllers/lookups.controller');

const jobPositionsRouter = Router();
jobPositionsRouter.get('/', lookupsController.listJobPositions);

const workingSchedulesRouter = Router();
workingSchedulesRouter.get('/', lookupsController.listWorkingSchedules);

module.exports = { jobPositionsRouter, workingSchedulesRouter };
