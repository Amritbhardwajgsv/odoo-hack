const { z } = require('zod');

const service = require('../services/salaryRules.service');

const COMPUTATION_METHODS = [
  'fixed',
  'percentage_of_basic',
  'percentage_of_gross',
  'percentage_of_contract_wage',
  'formula',
];
const CATEGORIES = ['basic', 'allowance', 'deduction', 'contribution', 'gross', 'net'];

const ruleSchema = z
  .object({
    structureId: z.string().uuid(),
    name: z.string().min(1),
    // Rule codes are referenced from formulas (e.g. "gross - PF"), so they
    // are restricted to identifier-safe characters.
    code: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Code must start with a letter and contain only letters, numbers and underscores'),
    category: z.enum(CATEGORIES),
    sequence: z.coerce.number().int(),
    computationMethod: z.enum(COMPUTATION_METHODS),
    value: z.coerce.number().nullable().optional(),
    formula: z.string().nullable().optional(),
    quantity: z.coerce.number().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => data.computationMethod !== 'formula' || Boolean(data.formula && data.formula.trim()),
    { message: 'A formula rule needs an expression', path: ['formula'] }
  );

function handleConstraintError(error, response) {
  if (error.code === '23505') {
    response.status(409).json({ message: 'This structure already has a rule with that code' });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'That salary structure does not exist' });
    return true;
  }
  return false;
}

async function list(request, response) {
  const { structureId, search } = request.query;
  response.json(await service.listRules({ structureId, search }));
}

async function get(request, response) {
  const rule = await service.findRuleById(request.params.id);
  if (!rule) return response.status(404).json({ message: 'Salary rule not found' });
  response.json(rule);
}

async function create(request, response) {
  const parsed = ruleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  try {
    response.status(201).json(await service.createRule(parsed.data));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = ruleSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  try {
    const rule = await service.updateRule(request.params.id, parsed.data);
    if (!rule) return response.status(404).json({ message: 'Salary rule not found' });
    response.json(rule);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function remove(request, response) {
  const result = await service.deleteRule(request.params.id);
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Salary rule not found' });
  }
  if (result.error === 'in_use') {
    return response.status(409).json({
      message: `This rule already produced ${result.count} payslip line(s) and is kept as history. Mark it inactive instead of deleting it.`,
    });
  }
  response.status(204).end();
}

module.exports = { list, get, create, update, remove };
