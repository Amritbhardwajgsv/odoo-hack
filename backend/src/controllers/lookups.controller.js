const lookupsService = require('../services/lookups.service');

async function listJobPositions(_request, response) {
  response.json(await lookupsService.listJobPositions());
}

async function listWorkingSchedules(_request, response) {
  response.json(await lookupsService.listWorkingSchedules());
}

async function listSalaryStructures(_request, response) {
  response.json(await lookupsService.listSalaryStructures());
}

async function overview(_request, response) {
  response.json(await lookupsService.overview());
}

module.exports = { listJobPositions, listWorkingSchedules, listSalaryStructures, overview };
