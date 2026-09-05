const service = require('../services/payrollDashboard.service');

async function get(request, response) {
  const { period, department, employeeType, company } = request.query;
  response.json(await service.getDashboard({ period, department, employeeType, company }));
}

module.exports = { get };
