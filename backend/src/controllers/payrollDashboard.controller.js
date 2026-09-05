const service = require('../services/payrollDashboard.service');

async function get(request, response) {
  const { department, employeeType, payrunId } = request.query;
  response.json(await service.getDashboard({ department, employeeType, payrunId }));
}

module.exports = { get };
