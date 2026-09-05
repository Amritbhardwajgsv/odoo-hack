// A plain in-memory fixed-window limiter, the same pattern userCache.js
// already uses for a single-process pm2 deployment - no new dependency for
// a rule this small, and it doesn't need to survive a restart.
//
// Built for the attendance check-in/check-out widget specifically: rapid
// double-clicking (or a stuck network retry) can otherwise produce a row
// like "checked in and out inside the same minute, 0.16 hours worked" -
// technically real timestamps, just not a punch anyone actually meant to
// make. Keyed per employee, not per IP, since a shared office connection
// must not throttle one person's spam onto everyone else's.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();

  // Unbounded growth would just be a slow leak in a process that runs for
  // days - each key is only ever a few dozen bytes, but there is no reason
  // to keep one past its own window.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now - entry.windowStart > windowMs) hits.delete(key);
    }
  }, windowMs).unref();

  return function rateLimit(request, response, next) {
    const key = request.user?.employeeId || request.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      response.setHeader('Retry-After', String(retryAfterSeconds));
      return response.status(429).json({ message, retryAfterSeconds });
    }

    entry.count += 1;
    next();
  };
}

// 5 attempts per minute, shared across check-in and check-out together -
// that is what "5 actions on this widget per minute" means, not 5 of each.
const attendancePunchLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message:
    "You're checking in/out too quickly - please wait a moment. This is limited to 5 attempts a minute so accidental double-clicks (or a network retry) don't spam your attendance record.",
});

module.exports = { createRateLimiter, attendancePunchLimiter };
