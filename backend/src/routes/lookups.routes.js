const { Router } = require('express');

const lookupsController = require('../controllers/lookups.controller');

const jobPositionsRouter = Router();
jobPositionsRouter.get('/', lookupsController.listJobPositions);

// Salary structures moved to routes/salaryStructures.routes.js, which
// supports full CRUD; this module keeps only the read-only lookups.
const overviewRouter = Router();
overviewRouter.get('/', lookupsController.overview);

module.exports = {
  jobPositionsRouter,
  overviewRouter,
};
