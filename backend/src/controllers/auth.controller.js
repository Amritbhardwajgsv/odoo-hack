const { z } = require('zod');

const authService = require('../services/auth.service');

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

module.exports = { login };
