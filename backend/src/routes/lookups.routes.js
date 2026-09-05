const { Router } = require('express');

const lookupsController = require('../controllers/lookups.controller');

const jobPositionsRouter = Router();
jobPositionsRouter.get('/', lookupsController.listJobPositions);

const salaryStructuresRouter = Router();
salaryStructuresRouter.get('/', lookupsController.listSalaryStructures);

const overviewRouter = Router();
overviewRouter.get('/', lookupsController.overview);

module.exports = {
  jobPositionsRouter,
  salaryStructuresRouter,
  overviewRouter,
};
