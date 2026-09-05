const { z } = require('zod');

const service = require('../services/timeOff.service');

const REQUEST_STATUSES = ['draft', 'submitted', 'approved', 'refused'];

const requestSchema = z.object({
  employeeId: z.string().uuid(),
  timeOffTypeId: z.string().uuid(),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  reason: z.string().nullable().optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
});

const updateRequestSchema = z.object({
  timeOffTypeId: z.string().uuid().optional(),
  dateFrom: z.string().min(1).optional(),
  dateTo: z.string().min(1).optional(),
  reason: z.string().nullable().optional(),
});

function handleConstraintError(error, response) {
  if (error.code === '23514') {
    response.status(400).json({ message: 'The end date must be on or after the start date' });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'Referenced employee or time off type does not exist' });
    return true;
  }
  return false;
}

async function listRequests(request, response) {
  const { search, status, employeeId, team } = request.query;
  response.json(
    await service.listRequests({
      search,
      status,
      employeeId,
      // "My Team" shows requests from people reporting to the viewer.
      managerEmployeeId: team === 'true' ? request.user.employeeId : undefined,
    })
  );
}

async function getRequest(request, response) {
  const found = await service.findRequestById(request.params.id);
  if (!found) return response.status(404).json({ message: 'Time off request not found' });
  response.json(found);
}

async function createRequest(request, response) {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  if (service.durationBetween(parsed.data.dateFrom, parsed.data.dateTo) <= 0) {
    return response.status(400).json({ message: 'The end date must be on or after the start date' });
  }

  try {
    response.status(201).json(await service.createRequest(parsed.data));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function updateRequest(request, response) {
  const parsed = updateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    const updated = await service.updateRequest(request.params.id, parsed.data);
    if (!updated) return response.status(404).json({ message: 'Time off request not found' });
    response.json(updated);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

function respondToDecision(result, response) {
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Time off request not found' });
  }
  if (result.error === 'already_approved') {
    return response.status(409).json({ message: 'This request has already been approved' });
  }
  if (result.error === 'insufficient_allocation') {
    return response.status(409).json({
      message: result.hasAllocation
        ? `Not enough balance left: ${result.needed} requested but only ${result.available} remaining`
        : 'This leave type needs an allocation, and this employee has no approved balance covering those dates',
    });
  }
  return response.json(result.request);
}

async function approve(request, response) {
  respondToDecision(await service.approveRequest(request.params.id, request.user.sub), response);
}

async function refuse(request, response) {
  respondToDecision(await service.refuseRequest(request.params.id, request.user.sub), response);
}

async function listTypes(_request, response) {
  response.json(await service.listTypes());
}

async function listAllocations(request, response) {
  response.json(await service.listAllocations({ employeeId: request.query.employeeId }));
}

module.exports = {
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  approve,
  refuse,
  listTypes,
  listAllocations,
};
