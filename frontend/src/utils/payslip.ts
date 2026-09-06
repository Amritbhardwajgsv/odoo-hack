// Mirrors payslipFileName() in backend/src/services/payslipPdf.service.js so
// a downloaded file matches the name the emailed attachment would use.
export function payslipFileName(payslip: { employeeName: string; periodStart: string }): string {
  const safeName = payslip.employeeName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `payslip-${safeName}-${payslip.periodStart.slice(0, 7)}.pdf`;
}
