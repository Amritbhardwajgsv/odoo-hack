const nodemailer = require('nodemailer');

const { payslipPdfBuffer, payslipFileName, periodLabel } = require('./payslipPdf.service');
const { enqueuePayslips } = require('../queue/mailQueue');

// Mail is optional infrastructure: the rest of payroll works without it, so
// a missing SMTP config is reported plainly instead of crashing a payrun.
function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// One transporter per process, reused across every job the worker handles
// rather than rebuilt per email.
let cachedTransporter;
function transporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return cachedTransporter;
}

function bodyFor(payslip) {
  return [
    `Hi ${payslip.employeeName},`,
    '',
    `Your payslip for ${payslip.payrunName} (${periodLabel(payslip.periodStart)} to ${periodLabel(
      payslip.periodEnd
    )}) is attached.`,
    '',
    `Net pay: INR ${Number(payslip.netAmount ?? 0).toLocaleString('en-IN')}`,
    '',
    'This is an automated message from PeoplePay360.',
  ].join('\n');
}

// Sends exactly one payslip. Called by the queue worker, one job at a time;
// any failure is thrown so BullMQ can retry it on its own schedule without
// affecting the other jobs.
async function deliverPayslip(payslip) {
  if (!isConfigured()) throw new Error('SMTP is not configured');
  if (!payslip.employeeEmail) throw new Error('no email address on file');

  const pdf = await payslipPdfBuffer(payslip);
  await transporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: payslip.employeeEmail,
    subject: `Payslip - ${payslip.payrunName}`,
    text: bodyFor(payslip),
    attachments: [{ filename: payslipFileName(payslip), content: pdf }],
  });
}

// Hands the payrun's payslips to the mail queue and returns immediately.
// Delivery, retries and per-address failures all happen later in the worker
// process, so the request doesn't wait on SMTP.
async function queuePayslips(payslips) {
  if (!isConfigured()) return { error: 'not_configured' };

  const deliverable = [];
  const skipped = [];
  for (const payslip of payslips) {
    if (payslip.employeeEmail) {
      deliverable.push(payslip);
    } else {
      skipped.push({ employee: payslip.employeeName, reason: 'no email address on file' });
    }
  }

  const queued = await enqueuePayslips(deliverable);
  return { queued, recipients: deliverable.map((payslip) => payslip.employeeName), skipped };
}

module.exports = { isConfigured, deliverPayslip, queuePayslips };
