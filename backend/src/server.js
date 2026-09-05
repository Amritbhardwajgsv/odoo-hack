const app = require('./app');
const mail = require('./services/payslipMail.service');
const { startMailWorker } = require('./queue/startWorker');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

// Payslip emails are delivered by a BullMQ worker running in a forked child
// process (see src/queue). No SMTP config means nothing would ever be sent,
// so there's no point spawning it - the send endpoint reports that itself.
if (mail.isConfigured()) {
  startMailWorker();
} else {
  console.log('[mail-worker] not started: SMTP is not configured');
}
