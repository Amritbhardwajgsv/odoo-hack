const { z } = require('zod');

const contractsService = require('../services/contracts.service');
const { DEPARTMENTS, CONTRACT_STATUSES } = require('../constants');

const contractSchema = z.object({
  employeeId: z.string().uuid(),
  department: z.enum(DEPARTMENTS),
  jobPositionId: z.string().uuid().nullable().optional(),
  workingScheduleId: z.string().uuid().nullable().optional(),
  salaryStructureId: z.string().uuid(),
  wage: z.coerce.number().positive(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional().or(z.literal('')),
  status: z.enum(CONTRACT_STATUSES).optional().default('draft'),
  notes: z.string().nullable().optional(),
});

const updateContractSchema = contractSchema.partial();

function handleConstraintError(error, response) {
  // The database enforces that one employee cannot hold two running
  // contracts covering the same dates.
  if (error.code === '23P01') {
    response.status(409).json({
      message: 'This employee already has a running contract covering those dates',
    });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'Referenced employee, position or structure does not exist' });
    return true;
  }
  // 23514 is the CHECK; 22000 comes from the generated date_range column,
  // which rejects a backwards range before the CHECK is reached.
  if (error.code === '23514' || error.code === '22000') {
    response.status(400).json({ message: 'End date must be on or after the start date' });
    return true;
  }
  return false;
}

async function list(request, response) {
  const { search, status, employeeId } = request.query;
  response.json(await contractsService.list({ search, status, employeeId }));
}

async function getById(request, response) {
  const contract = await contractsService.findById(request.params.id);
  if (!contract) return response.status(404).json({ message: 'Contract not found' });
  response.json(contract);
}

async function create(request, response) {
  const parsed = contractSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    response.status(201).json(await contractsService.create(parsed.data));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = updateContractSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    const contract = await contractsService.update(request.params.id, parsed.data);
    if (!contract) return response.status(404).json({ message: 'Contract not found' });
    response.json(contract);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

module.exports = { list, getById, create, update };
