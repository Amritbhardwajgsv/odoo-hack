const PDFDocument = require('pdfkit');

const { UNPAID_LEAVE_THRESHOLD_DAYS } = require('./payruns.service');

const ADDS_TO_EARNINGS = ['basic', 'allowance', 'gross'];
const REDUCES_NET = ['deduction', 'contribution'];

const BRAND = '#7c3aed';
const BRAND_TINT = '#f2edfc';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';
const BORDER = '#d9d3ea';

function money(value) {
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthYearLabel(value) {
  const [year, month] = isoDate(value).split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ----------------------------------------------------------- amount in words
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n) {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return TENS[tens] + (ones ? ` ${ONES[ones]}` : '');
}

function threeDigitWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return (hundreds ? `${ONES[hundreds]} Hundred${rest ? ' ' : ''}` : '') + (rest ? twoDigitWords(rest) : '');
}

// Indian numbering (Crore/Lakh/Thousand), matching how the amount is
// grouped everywhere else in this app (toLocaleString('en-IN')).
function numberToIndianWords(value) {
  let n = Math.round(value);
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh = Math.floor(n / 100_000); n %= 100_000;
  const thousand = Math.floor(n / 1_000); n %= 1_000;
  const rest = n;

  const parts = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(' ');
}

function amountInWords(value) {
  return `Rupees ${numberToIndianWords(value)} Only`;
}

// -------------------------------------------------------------- geometry
const PAGE_LEFT = 40;
const PAGE_RIGHT = 555;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const SUMMARY_W = 300;
const NETPAY_X = PAGE_LEFT + SUMMARY_W + 15;
const NETPAY_W = PAGE_RIGHT - NETPAY_X;
const COL_GAP = 16;
const COL_W = (CONTENT_WIDTH - COL_GAP) / 2;
const EARN_X = PAGE_LEFT;
const DED_X = PAGE_LEFT + COL_W + COL_GAP;

function row(doc, x, y, width, label, value, opts = {}) {
  doc.fontSize(9).fillColor(MUTED).text(label, x, y, { width: width * 0.42 });
  doc
    .fontSize(9)
    .fillColor(opts.strong ? INK : '#333')
    .font(opts.strong ? 'Helvetica-Bold' : 'Helvetica')
    .text(value, x + width * 0.42, y, { width: width * 0.58, align: 'left' });
  doc.font('Helvetica');
}

// One payslip as a PDF, styled as a standard payroll document (branded
// header, employee summary, a highlighted net-pay figure, side-by-side
// Earnings/Deductions, amount in words) rather than a plain line-by-line
// printout. Returns a stream the route can pipe straight to the response,
// and the same document is what gets attached to the email.
function buildPayslipPdf(payslip) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  // ---------------------------------------------------------------- header
  doc.rect(0, 0, doc.page.width, 74).fill(BRAND);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(19).text('PeoplePay360', PAGE_LEFT, 22);
  doc.font('Helvetica').fontSize(8).fillColor('#e4d9fb').text('HR & Payroll Platform', PAGE_LEFT, 44);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#ffffff')
    .text('PAYSLIP', PAGE_LEFT, 20, { width: CONTENT_WIDTH, align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#e4d9fb')
    .text(`For ${monthYearLabel(payslip.periodStart)}`, PAGE_LEFT, 38, {
      width: CONTENT_WIDTH,
      align: 'right',
    });

  // ------------------------------------------------- summary + net pay
  const topY = 96;
  const boxH = 128;

  doc.roundedRect(PAGE_LEFT, topY, SUMMARY_W, boxH, 6).strokeColor(BORDER).lineWidth(1).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(BRAND)
    .text('EMPLOYEE SUMMARY', PAGE_LEFT + 14, topY + 12, { characterSpacing: 0.5 });

  const summaryRows = [
    ['Employee Name', payslip.employeeName],
    ['Employee ID', payslip.employeeCode || '—'],
    ['Designation', payslip.jobTitle || '—'],
    ['Department', payslip.department ? payslip.department.replace(/_/g, ' ') : '—'],
    ['Contract No.', payslip.contractNumber || '—'],
    ['Pay Period', `${periodLabel(payslip.periodStart)} to ${periodLabel(payslip.periodEnd)}`],
  ];
  let sy = topY + 32;
  for (const [label, value] of summaryRows) {
    row(doc, PAGE_LEFT + 14, sy, SUMMARY_W - 28, label, String(value));
    sy += 15.5;
  }

  doc.roundedRect(NETPAY_X, topY, NETPAY_W, boxH, 6).fill(BRAND_TINT);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(BRAND)
    .text('EMPLOYEE NET PAY', NETPAY_X, topY + 16, { width: NETPAY_W, align: 'center', characterSpacing: 0.5 });
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(INK)
    .text(money(payslip.netAmount ?? 0), NETPAY_X, topY + 34, { width: NETPAY_W, align: 'center' });

  doc
    .moveTo(NETPAY_X + 20, topY + 68)
    .lineTo(NETPAY_X + NETPAY_W - 20, topY + 68)
    .strokeColor(BORDER)
    .stroke();

  const workedLabel = payslip.workedDays ?? '—';
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text('Worked Days', NETPAY_X, topY + 78, { width: NETPAY_W / 2, align: 'center' })
    .text('Leave Days', NETPAY_X + NETPAY_W / 2, topY + 78, { width: NETPAY_W / 2, align: 'center' });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(INK)
    .text(String(workedLabel), NETPAY_X, topY + 92, { width: NETPAY_W / 2, align: 'center' })
    .text(String(payslip.leaveDays ?? 0), NETPAY_X + NETPAY_W / 2, topY + 92, {
      width: NETPAY_W / 2,
      align: 'center',
    });

  // --------------------------------------------------- earnings / deductions
  const earnings = payslip.lines.filter((line) => ADDS_TO_EARNINGS.includes(line.category));
  const deductions = payslip.lines.filter((line) => REDUCES_NET.includes(line.category));

  const tableTop = topY + boxH + 24;
  const headerH = 20;
  const lineH = 16;

  function drawColumnHeader(x, title) {
    doc.rect(x, tableTop, COL_W, headerH).fill(BRAND);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#ffffff')
      .text(title, x + 10, tableTop + 6, { width: COL_W - 80 })
      .text('AMOUNT', x + 10, tableTop + 6, { width: COL_W - 20, align: 'right' });
  }

  drawColumnHeader(EARN_X, 'EARNINGS');
  drawColumnHeader(DED_X, 'DEDUCTIONS');

  const nameColWidth = COL_W - 90;

  function drawColumnRows(x, rows) {
    let y = tableTop + headerH + 6;
    doc.font('Helvetica').fontSize(9).fillColor('#333');
    for (const line of rows) {
      // Rule names come from user-configured salary rules and can run long
      // (e.g. the auto-generated "Unpaid Leave (N days over the ..." line),
      // so each row's height follows however many lines its name wraps to
      // instead of a fixed one-line height that would let rows overlap.
      const rowHeight = Math.max(lineH, doc.heightOfString(line.ruleName, { width: nameColWidth }) + 4);
      doc.text(line.ruleName, x + 10, y, { width: nameColWidth });
      doc.text(money(line.amount), x + 10, y, { width: COL_W - 20, align: 'right' });
      y += rowHeight;
    }
    if (rows.length === 0) {
      doc.fillColor(MUTED).text('—', x + 10, y, { width: COL_W - 20 });
      y += lineH;
    }
    return y;
  }

  const earnEndY = drawColumnRows(EARN_X, earnings);
  const dedEndY = drawColumnRows(DED_X, deductions);
  const bodyBottom = Math.max(earnEndY, dedEndY) + 4;

  function drawColumnTotal(x, label, value) {
    doc.moveTo(x + 10, bodyBottom).lineTo(x + COL_W - 10, bodyBottom).strokeColor(BORDER).stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(INK)
      .text(label, x + 10, bodyBottom + 6, { width: COL_W - 90 })
      .text(money(value), x + 10, bodyBottom + 6, { width: COL_W - 20, align: 'right' });
  }

  const totalDeductions = deductions.reduce((sum, line) => sum + Number(line.amount), 0);
  drawColumnTotal(EARN_X, 'Gross Earnings', payslip.grossAmount ?? 0);
  drawColumnTotal(DED_X, 'Total Deductions', totalDeductions);

  doc
    .rect(EARN_X, tableTop, COL_W, bodyBottom + 22 - tableTop)
    .strokeColor(BORDER)
    .stroke();
  doc
    .rect(DED_X, tableTop, COL_W, bodyBottom + 22 - tableTop)
    .strokeColor(BORDER)
    .stroke();

  // ------------------------------------------------------- total net payable
  const netBandY = bodyBottom + 34;
  doc.roundedRect(PAGE_LEFT, netBandY, CONTENT_WIDTH, 46, 6).fill(BRAND_TINT);
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(INK)
    .text('TOTAL NET PAYABLE', PAGE_LEFT + 16, netBandY + 8)
    .text(money(payslip.netAmount ?? 0), PAGE_LEFT, netBandY + 8, {
      width: CONTENT_WIDTH - 16,
      align: 'right',
    });
  doc
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(`Amount in words: ${amountInWords(payslip.netAmount ?? 0)}`, PAGE_LEFT + 16, netBandY + 27);

  let cursorY = netBandY + 46 + 16;

  // ------------------------------------------------------------- warnings
  if (payslip.warnings.length > 0) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Warnings', PAGE_LEFT, cursorY);
    cursorY += 15;
    doc.font('Helvetica').fontSize(8.5);
    for (const warning of payslip.warnings) {
      doc.fillColor(warning.severity === 'blocking' ? '#b00020' : '#8a6d00');
      doc.text(`• [${warning.severity}] ${warning.message}`, PAGE_LEFT, cursorY, {
        width: CONTENT_WIDTH,
      });
      cursorY = doc.y + 3;
    }
    doc.fillColor(INK);
  }

  // A payslip needing an automatic Unpaid Leave line is exactly the kind of
  // thing worth explaining plainly, not just showing as a bare number.
  if (Number(payslip.leaveDays ?? 0) > UNPAID_LEAVE_THRESHOLD_DAYS) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(
        `Leave beyond the ${UNPAID_LEAVE_THRESHOLD_DAYS}-day paid allowance for this period is deducted automatically as Unpaid Leave.`,
        PAGE_LEFT,
        cursorY + 4,
        { width: CONTENT_WIDTH }
      );
    cursorY = doc.y + 8;
  }

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#999')
    .text(
      'This is a computer-generated payslip. Amounts are derived from the salary structure and the running contract for this period; no signature is required.',
      PAGE_LEFT,
      Math.max(cursorY, doc.page.height - 60),
      { width: CONTENT_WIDTH }
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
