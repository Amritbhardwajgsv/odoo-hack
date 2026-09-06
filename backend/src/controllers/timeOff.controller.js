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
    respondToDecision(await service.createRequest(parsed.data), response, 201);
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

function respondToDecision(result, response, successStatus = 200) {
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Time off request not found' });
  }
  if (result.error === 'invalid_type') {
    return response.status(400).json({ message: 'Referenced time off type does not exist' });
  }
  if (result.error === 'already_approved') {
    return response.status(409).json({ message: 'This request has already been approved' });
  }
  if (result.error === 'wrong_approver') {
    return response.status(403).json({
      message: `This leave type requires approval by the employee's manager (or an admin), not just any HR staff.`,
    });
  }
  if (result.error === 'insufficient_allocation') {
    return response.status(409).json({
      message: result.hasAllocation
        ? `Not enough balance left: ${result.needed} requested but only ${result.available} remaining`
        : 'This leave type needs an allocation, and this employee has no approved balance covering those dates',
    });
  }
  return response.status(successStatus).json(result.request);
}

function approverFrom(request) {
  return { userId: request.user.sub, employeeId: request.user.employeeId, roles: request.user.roles };
}

async function approve(request, response) {
  respondToDecision(await service.approveRequest(request.params.id, approverFrom(request)), response);
}

async function refuse(request, response) {
  respondToDecision(await service.refuseRequest(request.params.id, approverFrom(request)), response);
}

// ------------------------------------------------------------------ types
const typeSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(['days', 'hours']).optional().default('days'),
  requiresAllocation: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  affectsPayroll: z.boolean().optional(),
  approvalBy: z.string().min(1).optional(),
  displayColor: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  workEntry: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function listTypes(request, response) {
  response.json(await service.listTypes({ search: request.query.search }));
}

async function getType(request, response) {
  const type = await service.findTypeById(request.params.id);
  if (!type) return response.status(404).json({ message: 'Time off type not found' });
  response.json(type);
}

async function createType(request, response) {
  const parsed = typeSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  response.status(201).json(await service.createType(parsed.data));
}

async function updateType(request, response) {
  const parsed = typeSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  const type = await service.updateType(request.params.id, parsed.data);
  if (!type) return response.status(404).json({ message: 'Time off type not found' });
  response.json(type);
}

// ------------------------------------------------------------ allocations
const allocationSchema = z.object({
  employeeId: z.string().uuid(),
  timeOffTypeId: z.string().uuid(),
  allocated: z.coerce.number().positive(),
  validFrom: z.string().min(1),
  validTo: z.string().nullable().optional(),
  status: z.enum(['draft', 'approved']).optional(),
  description: z.string().nullable().optional(),
});

async function listAllocations(request, response) {
  const { employeeId, search, status } = request.query;
  response.json(await service.listAllocations({ employeeId, search, status }));
}

async function getAllocation(request, response) {
  const allocation = await service.findAllocationById(request.params.id);
  if (!allocation) return response.status(404).json({ message: 'Allocation not found' });
  response.json(allocation);
}

async function createAllocation(request, response) {
  const parsed = allocationSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  try {
    response.status(201).json(await service.createAllocation(parsed.data));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function updateAllocation(request, response) {
  const parsed = allocationSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  const allocation = await service.updateAllocation(request.params.id, parsed.data);
  if (!allocation) return response.status(404).json({ message: 'Allocation not found' });
  response.json(allocation);
}

function respondToAllocationDecision(result, response) {
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Allocation not found' });
  }
  if (result.error === 'already_consumed') {
    return response.status(409).json({
      message: `${result.taken} already taken from this balance, so it cannot be withdrawn`,
    });
  }
  return response.json(result.allocation);
}

async function approveAllocation(request, response) {
  respondToAllocationDecision(
    await service.decideAllocation(request.params.id, 'approved', request.user.sub),
    response
  );
}

async function refuseAllocation(request, response) {
  respondToAllocationDecision(
    await service.decideAllocation(request.params.id, 'refused', request.user.sub),
    response
  );
}

module.exports = {
  listRequests,
  getRequest,
  createRequest,
  updateRequest,
  approve,
  refuse,
  listTypes,
  getType,
  createType,
  updateType,
  listAllocations,
  getAllocation,
  createAllocation,
  updateAllocation,
  approveAllocation,
  refuseAllocation,
};
