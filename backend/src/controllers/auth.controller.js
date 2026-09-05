const { z } = require('zod');

const authService = require('../services/auth.service');
const { primaryRole, landingPathFor, permissionsFor, navigationFor } = require('../permissions');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function login(request, response) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'email and password are required' });
  }

  const user = await authService.authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }

  response.json({ token: authService.issueToken(user), user });
}

// requireAuth has already refreshed roles from the database, so this reflects
// the user's current access even if their token was signed with older roles.
function me(request, response) {
  const { sub, email, roles, employeeId, employeeName } = request.user;
  response.json({
    id: sub,
    email,
    roles,
    primaryRole: primaryRole(roles),
    landingPath: landingPathFor(roles),
    permissions: permissionsFor(roles),
    navigation: navigationFor(roles),
    employeeId,
    employeeName,
  });
}

module.exports = { login, me };
