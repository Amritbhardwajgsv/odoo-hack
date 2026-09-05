const jwt = require('jsonwebtoken');

const usersService = require('../services/users.service');
const userCache = require('../services/userCache');

async function requireAuth(request, response, next) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return response.status(401).json({ message: 'Invalid or expired token' });
  }

  // The token carries the roles it was signed with, but those go stale the
  // moment an admin edits them. Authorization therefore uses the roles as
  // they are in the database right now, so a demotion or deactivation takes
  // effect immediately instead of lingering until the token expires.
  let user = userCache.get(payload.sub);
  if (!user) {
    user = await usersService.findById(payload.sub);
    if (user) userCache.set(payload.sub, user);
  }

  if (!user || !user.isActive) {
    return response.status(401).json({ message: 'Account is inactive or no longer exists' });
  }

  request.user = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    employeeId: user.employeeId,
    employeeName: user.employeeName,
  };
  next();
}

function requireRole(...allowedRoles) {
  return (request, response, next) => {
    const userRoles = request.user?.roles || [];
    const hasAccess = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasAccess) {
      return response.status(403).json({ message: 'Insufficient role for this action' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };
