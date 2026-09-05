const lookupsService = require('../services/lookups.service');

async function listJobPositions(_request, response) {
  response.json(await lookupsService.listJobPositions());
}

async function overview(_request, response) {
  response.json(await lookupsService.overview());
}

module.exports = { listJobPositions, overview };
