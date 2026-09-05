const jwt = require('jsonwebtoken');

function requireAuth(request, response, next) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    response.status(401).json({ message: 'Invalid or expired token' });
  }
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
