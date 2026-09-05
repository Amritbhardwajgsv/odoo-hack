// requireAuth reads the user on every authenticated request so that role
// changes and deactivations take effect immediately. That is one database
// round trip per request, which dominates latency when the database is in
// another region.
//
// This caches the lookup for a few seconds AND is invalidated the moment a
// user is written to, so a role change is still applied instantly rather
// than after the TTL. The TTL only bounds changes made outside the API
// (a manual SQL edit, for example).
const TTL_MS = 15_000;

const cache = new Map();

function get(id) {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(id);
    return null;
  }
  return entry.user;
}

function set(id, user) {
  cache.set(id, { user, expiresAt: Date.now() + TTL_MS });
}

function invalidate(id) {
  if (id) cache.delete(id);
}

function clear() {
  cache.clear();
}

module.exports = { get, set, invalidate, clear, TTL_MS };
