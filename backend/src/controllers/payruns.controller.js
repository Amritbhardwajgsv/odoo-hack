const { z } = require('zod');

const { DEPARTMENTS } = require('../constants');
const service = require('../services/payruns.service');
const mail = require('../services/payslipMail.service');
const { buildPayslipPdf, payslipFileName } = require('../services/payslipPdf.service');

const payrunSchema = z.object({
  name: z.string().min(1),
  salaryStructureId: z.string().uuid(),
  department: z.enum(DEPARTMENTS).nullable().optional(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  // The wizard picks people before the payrun exists; when a selection is
  // sent the payrun contains exactly those employees and nobody else.
  employeeIds: z.array(z.string().uuid()).optional(),
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

// Step two of the wizard reads this before anything is created, so the user
// sees exactly who they are about to pay.
async function eligible(request, response) {
  const { periodStart, periodEnd, department, search } = request.query;
  if (!periodStart || !periodEnd) {
    return response.status(400).json({ message: 'periodStart and periodEnd are required' });
  }
  if (new Date(periodEnd) < new Date(periodStart)) {
    return response.status(400).json({ message: 'The period end must be on or after the period start' });
  }
  response.json(await service.eligibleEmployees({ periodStart, periodEnd, department, search }));
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
  // Sending an empty selection is a mistake worth naming, not a payrun.
  if (parsed.data.employeeIds && parsed.data.employeeIds.length === 0) {
    return response.status(400).json({ message: 'Select at least one employee for this payrun' });
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

// -------------------------------------------------------------- documents
async function payslipPdf(request, response) {
  const payslip = await service.findPayslipById(request.params.id);
  if (!payslip) return response.status(404).json({ message: 'Payslip not found' });

  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `inline; filename="${payslipFileName(payslip)}"`);
  buildPayslipPdf(payslip).pipe(response);
}

async function sendPayslips(request, response) {
  const payrun = await service.findById(request.params.id);
  if (!payrun) return response.status(404).json({ message: 'Payrun not found' });
  // Sending is the point of no return for the employee's inbox, so it waits
  // until somebody has actually signed the payrun off.
  if (payrun.status === 'draft' || payrun.status === 'computed') {
    return response.status(409).json({
      message: 'Validate the payrun before sending payslips',
    });
  }

  const summaries = await service.listPayslips({ payrunId: payrun.id });
  const payslips = await Promise.all(
    summaries.map((summary) => service.findPayslipById(summary.id))
  );

  const result = await mail.queuePayslips(payslips);
  if (result.error === 'not_configured') {
    return response.status(503).json({
      message:
        'Email delivery is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send payslips.',
    });
  }

  // The jobs are on the queue now; the worker process delivers them and
  // handles its own retries, so this is a 202, not a per-address result.
  response.status(202).json({
    message: `${result.queued} payslip${result.queued === 1 ? '' : 's'} queued for delivery`,
    queued: result.queued,
    recipients: result.recipients,
    skipped: result.skipped,
  });
}

module.exports = {
  list,
  years,
  eligible,
  get,
  payslipPdf,
  sendPayslips,
  create,
  update,
  compute,
  setStatus,
  remove,
  listPayslipsForPayrun,
  listPayslips,
  getPayslip,
};
