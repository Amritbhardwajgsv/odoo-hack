// Entry point for the forked worker process. Nothing here runs in the API
// process - startWorker.js spawns this file with child_process.fork(), and
// server.js never require()s it.
require('dotenv').config();

const { Worker } = require('bullmq');

const { createConnection, QUEUE_NAME } = require('./connection');
const mail = require('../services/payslipMail.service');

const concurrency = Number(process.env.MAIL_WORKER_CONCURRENCY || 5);

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    if (job.name !== 'send-payslip') return;
    // Throwing here is deliberate: it marks the job failed and lets BullMQ
    // apply the retry/backoff configured on the queue.
    await mail.deliverPayslip(job.data.payslip);
  },
  { connection: createConnection(), concurrency }
);

worker.on('ready', () => {
  console.log(`[mail-worker] ready on "${QUEUE_NAME}" (concurrency ${concurrency})`);
});
worker.on('completed', (job) => {
  console.log(`[mail-worker] sent payslip ${job.data.payslip?.id} -> ${job.data.payslip?.employeeEmail}`);
});
worker.on('failed', (job, err) => {
  const attempt = job ? `${job.attemptsMade}/${job.opts.attempts}` : '?';
  console.error(`[mail-worker] payslip ${job?.data?.payslip?.id} failed (attempt ${attempt}): ${err.message}`);
});
worker.on('error', (err) => {
  console.error(`[mail-worker] ${err.message}`);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
