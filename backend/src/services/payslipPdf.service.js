const PDFDocument = require('pdfkit');

const REDUCES_NET = ['deduction', 'contribution'];

function money(value) {
  // Rendered in a PDF, so no currency symbol from a font that may not have
  // the glyph - "INR" is unambiguous and always prints.
  return `INR ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// pg hands DATE columns back as Date objects, so these values are sometimes
// a Date and sometimes an ISO string depending on the caller. Normalise to
// "YYYY-MM-DD" before doing anything with them.
function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function periodLabel(value) {
  const [year, month, day] = isoDate(value).split('-');
  return `${day}-${month}-${year}`;
}

// One payslip as a PDF. Returns a stream the route can pipe straight to the
// response, and the same document is what gets attached to the email.
function buildPayslipPdf(payslip) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(20).text('PeoplePay360', { continued: false });
  doc.fontSize(10).fillColor('#666').text('Payslip');
  doc.moveDown(1.2);
  doc.fillColor('#000');

  const facts = [
    ['Employee', payslip.employeeName],
    ['Payrun', payslip.payrunName],
    ['Period', `${periodLabel(payslip.periodStart)} to ${periodLabel(payslip.periodEnd)}`],
    ['Contract', payslip.contractNumber || '-'],
    ['Job Position', payslip.jobTitle || '-'],
    ['Worked Days', String(payslip.workedDays ?? '-')],
    ['Status', payslip.status],
  ];
  doc.fontSize(11);
  for (const [label, value] of facts) {
    doc.text(`${label}:`, 50, doc.y, { width: 130, continued: true });
    doc.text(String(value));
  }

  doc.moveDown(1);
  doc.fontSize(13).text('Salary Computation');
  doc.moveDown(0.4);

  const right = 400;
  doc.fontSize(10).fillColor('#666');
  doc.text('Rule', 50, doc.y, { width: 240, continued: true });
  doc.text('Amount', { width: 150, align: 'right' });
  doc.fillColor('#000').moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.4);

  doc.fontSize(11);
  for (const line of payslip.lines) {
    const negative = REDUCES_NET.includes(line.category);
    doc.text(line.ruleName, 50, doc.y, { width: 240, continued: true });
    doc.text(`${negative ? '-' : ''}${money(line.amount)}`, { width: 150, align: 'right' });
  }

  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(0.4);

  doc.text('Gross', 50, doc.y, { width: 240, continued: true });
  doc.text(money(payslip.grossAmount ?? 0), { width: 150, align: 'right' });
  doc.fontSize(13).text('Net Pay', 50, doc.y + 4, { width: 240, continued: true });
  doc.text(money(payslip.netAmount ?? 0), { width: 150, align: 'right' });

  if (payslip.warnings.length > 0) {
    doc.moveDown(1.2).fontSize(13).fillColor('#000').text('Warnings');
    doc.moveDown(0.3).fontSize(10);
    for (const warning of payslip.warnings) {
      doc.fillColor(warning.severity === 'blocking' ? '#b00020' : '#8a6d00');
      doc.text(`[${warning.severity}] ${warning.message}`, { width: 495 });
    }
    doc.fillColor('#000');
  }

  doc.moveDown(1.5).fontSize(8).fillColor('#888');
  doc.text(
    'Computer-generated payslip. Amounts are derived from the salary structure and the running contract for this period.',
    { width: 495 }
  );

  doc.end();
  return doc;
}

// The PDF as a single Buffer, for attaching to mail.
function payslipPdfBuffer(payslip) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = buildPayslipPdf(payslip);
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function payslipFileName(payslip) {
  const safeName = payslip.employeeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `payslip-${safeName}-${isoDate(payslip.periodStart).slice(0, 7)}.pdf`;
}

module.exports = { buildPayslipPdf, payslipPdfBuffer, payslipFileName, periodLabel };
