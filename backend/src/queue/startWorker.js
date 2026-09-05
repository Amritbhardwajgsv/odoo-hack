const path = require('path');
const { fork } = require('child_process');

// Runs the BullMQ mail worker in its own OS process. Email delivery is PDF
// rendering plus blocking SMTP round-trips; keeping it out of the API
// process means a slow mail server never stalls request handling, and a
// crash in delivery restarts here instead of taking the API down.
function startMailWorker() {
  let child;
  let stopped = false;

  const spawn = () => {
    child = fork(path.join(__dirname, 'mailWorker.js'), [], { stdio: 'inherit' });
    child.on('exit', (code, signal) => {
      if (stopped) return;
      console.error(
        `[mail-worker] process exited (code ${code}, signal ${signal}); restarting in 2s`
      );
      setTimeout(spawn, 2000);
    });
  };

  spawn();
  console.log('[mail-worker] child process started');

  const stop = () => {
    stopped = true;
    if (child) child.kill('SIGTERM');
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  // Backstop so `node --watch` restarts and hard exits don't leave an
  // orphaned worker behind.
  process.once('exit', () => {
    stopped = true;
    if (child) child.kill('SIGKILL');
  });

  return { stop };
}

module.exports = { startMailWorker };
