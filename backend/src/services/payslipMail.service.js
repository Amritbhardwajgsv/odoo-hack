const nodemailer = require('nodemailer');

const { payslipPdfBuffer, payslipFileName, periodLabel } = require('./payslipPdf.service');

// Mail is optional infrastructure: the rest of payroll works without it, so
// a missing SMTP config is reported plainly instead of crashing a payrun.
function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
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

// Sends one payslip per employee. Failures are collected rather than thrown,
// so one bad address can't stop the rest of the payrun going out.
async function sendPayslips(payslips) {
  if (!isConfigured()) return { error: 'not_configured' };

  const mailer = transporter();
  const sent = [];
  const failed = [];

  for (const payslip of payslips) {
    if (!payslip.employeeEmail) {
      failed.push({ employee: payslip.employeeName, reason: 'no email address on file' });
      continue;
    }
    try {
      const pdf = await payslipPdfBuffer(payslip);
      await mailer.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: payslip.employeeEmail,
        subject: `Payslip - ${payslip.payrunName}`,
        text: bodyFor(payslip),
        attachments: [{ filename: payslipFileName(payslip), content: pdf }],
      });
      sent.push(payslip.employeeName);
    } catch (error) {
      failed.push({ employee: payslip.employeeName, reason: error.message });
    }
  }

  return { sent, failed };
}

module.exports = { isConfigured, sendPayslips };
