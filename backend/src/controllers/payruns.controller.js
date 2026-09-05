const { z } = require('zod');

const { DEPARTMENTS } = require('../constants');
const service = require('../services/payruns.service');

const payrunSchema = z.object({
  name: z.string().min(1),
  salaryStructureId: z.string().uuid(),
  department: z.enum(DEPARTMENTS).nullable().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});

function handleConstraintError(error, response) {
  // valid_period CHECK on payruns; the generated period column raises 22000
  // before the CHECK gets a chance, so both codes mean the same thing here.
  if (error.code === '23514' || error.code === '22000') {
    response.status(400).json({ message: 'The period end must be on or after the period start' });
    return true;
  }
  if (error.code === '23503') {
    response.status(400).json({ message: 'That salary structure does not exist' });
    return true;
  }
  return false;
}

async function list(request, response) {
  const { search, year, status } = request.query;
  response.json(await service.listPayruns({ search, year, status }));
}

async function years(request, response) {
  response.json(await service.listYears());
}

async function get(request, response) {
  const payrun = await service.findById(request.params.id);
  if (!payrun) return response.status(404).json({ message: 'Payrun not found' });
  response.json(payrun);
}

async function create(request, response) {
  const parsed = payrunSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }
  if (new Date(parsed.data.periodEnd) < new Date(parsed.data.periodStart)) {
    return response.status(400).json({ message: 'The period end must be on or after the period start' });
  }

  try {
    response.status(201).json(await service.createPayrun(parsed.data, request.user.sub));
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function update(request, response) {
  const parsed = payrunSchema.partial().safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    const result = await service.updatePayrun(request.params.id, parsed.data);
    if (result.error === 'not_found') {
      return response.status(404).json({ message: 'Payrun not found' });
    }
    if (result.error === 'locked') {
      return response.status(409).json({
        message: 'Only a draft payrun can be edited. Reset it to draft first.',
      });
    }
    response.json(result.payrun);
  } catch (error) {
    if (!handleConstraintError(error, response)) throw error;
  }
}

async function compute(request, response) {
  const result = await service.compute(request.params.id);
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Payrun not found' });
  }
  if (result.error === 'locked') {
    return response.status(409).json({ message: 'A paid payrun can no longer be recomputed' });
  }
  if (result.error === 'no_rules') {
    return response.status(409).json({
      message: `The "${result.structure}" salary structure has no active salary rules, so nothing can be computed`,
    });
  }
  response.json({ payrun: result.payrun, computed: result.computed, skipped: result.skipped });
}

async function setStatus(request, response) {
  const status = request.params.status;
  const result = await service.setStatus(request.params.id, status);

  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Payrun not found' });
  }
  if (result.error === 'bad_status') {
    return response.status(400).json({ message: `Unknown payrun status "${status}"` });
  }
  if (result.error === 'bad_transition') {
    return response.status(409).json({
      message: `A ${result.from} payrun cannot move straight to ${result.to}`,
    });
  }
  if (result.error === 'blocked') {
    return response.status(409).json({
      message: `${result.count} blocking warning${result.count === 1 ? '' : 's'} must be cleared before this payrun can be validated`,
    });
  }
  response.json(result.payrun);
}

async function remove(request, response) {
  const result = await service.deletePayrun(request.params.id);
  if (result.error === 'not_found') {
    return response.status(404).json({ message: 'Payrun not found' });
  }
  if (result.error === 'locked') {
    return response.status(409).json({ message: 'A paid payrun cannot be deleted' });
  }
  response.status(204).end();
}

async function listPayslipsForPayrun(request, response) {
  const payrun = await service.findById(request.params.id);
  if (!payrun) return response.status(404).json({ message: 'Payrun not found' });
  response.json({
    payslips: await service.listPayslips({ payrunId: payrun.id }),
    uncomputed: await service.listUncomputed(payrun.id),
  });
}

// ---------------------------------------------------------------- payslips
async function listPayslips(request, response) {
  const { payrunId, employeeId, status, search } = request.query;
  response.json(await service.listPayslips({ payrunId, employeeId, status, search }));
}

async function getPayslip(request, response) {
  const payslip = await service.findPayslipById(request.params.id);
  if (!payslip) return response.status(404).json({ message: 'Payslip not found' });
  response.json(payslip);
}

module.exports = {
  list,
  years,
  get,
  create,
  update,
  compute,
  setStatus,
  remove,
  listPayslipsForPayrun,
  listPayslips,
  getPayslip,
};
