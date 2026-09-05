const lookupsService = require('../services/lookups.service');

async function listJobPositions(_request, response) {
  response.json(await lookupsService.listJobPositions());
}

async function listWorkingSchedules(_request, response) {
  response.json(await lookupsService.listWorkingSchedules());
}

module.exports = { listJobPositions, listWorkingSchedules };
