const { z } = require('zod');

const service = require('../services/salaryStructures.service');

const structureSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

async function list(request, response) {
  const { search, activeOnly } = request.query;
  response.json(await service.listStructures({ search, activeOnly: activeOnly === 'true' }));
}

async function get(request, response) {
  const structure = await service.findStructureById(request.params.id);
  if (!structure) return response.status(404).json({ message: 'Salary structure not found' });
  response.json(structure);
}

async function create(request, response) {
  const parsed = structureSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  response.status(201).json(await service.createStructure(parsed.data));
}

async function update(request, response) {
  const parsed = structureSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  const structure = await service.updateStructure(request.params.id, parsed.data);
  if (!structure) return response.status(404).json({ message: 'Salary structure not found' });
  response.json(structure);
}

async function remove(request, response) {
  const result = await service.deleteStructure(request.params.id);
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Salary structure not found' });
  }
  if (result.error === 'in_use') {
    return response.status(409).json({
      message: `This structure is used by ${result.contracts} contract(s) and ${result.payruns} payrun(s), so it cannot be deleted. Mark it inactive instead.`,
    });
  }
  response.status(204).end();
}

module.exports = { list, get, create, update, remove };
