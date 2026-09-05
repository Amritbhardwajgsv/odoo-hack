const IORedis = require('ioredis');

// One Redis instance backs every payslip email. BullMQ won't share a
// connection between a Queue and a Worker, so each side calls
// createConnection() for its own.
const QUEUE_NAME = 'payslip-mail';

function createConnection() {
  // BullMQ blocks on Redis (BRPOPLPUSH) while waiting for work, so the
  // per-request retry cap has to be off or a slow tick throws mid-job.
  const options = { maxRetriesPerRequest: null };

  if (process.env.REDIS_URL) {
    return new IORedis(process.env.REDIS_URL, options);
  }
  return new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...options,
  });
}

module.exports = { createConnection, QUEUE_NAME };
