const { Queue } = require('bullmq');

const { createConnection, QUEUE_NAME } = require('./connection');

// The API process only ever produces jobs; the Queue (and its Redis
// connection) is built lazily so nothing touches Redis until the first
// payrun is actually sent.
let queue;

function mailQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: createConnection(),
      defaultJobOptions: {
        // A dropped SMTP connection or a greylisting server is usually
        // transient, so retry a few times with a widening gap before the
        // job lands in the failed set for someone to look at.
        attempts: 4,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 200,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
}

// One job per payslip, not one per payrun: a single unreachable address
// then fails and retries on its own without holding up everyone else's
// mail, and the worker can send several in parallel.
async function enqueuePayslips(payslips) {
  const jobs = payslips.map((payslip) => ({
    name: 'send-payslip',
    data: { payslip },
  }));
  await mailQueue().addBulk(jobs);
  return jobs.length;
}

async function closeMailQueue() {
  if (queue) {
    await queue.close();
    queue = undefined;
  }
}

module.exports = { mailQueue, enqueuePayslips, closeMailQueue };
