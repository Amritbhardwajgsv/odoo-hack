const { z } = require('zod');

const usersService = require('../services/users.service');
const { ROLES } = require('../constants');

const createUserSchema = z.object({
  employeeId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.enum(ROLES)).min(1),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  roles: z.array(z.enum(ROLES)).min(1).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

async function list(request, response) {
  const { search, role } = request.query;
  response.json(await usersService.list({ search, role }));
}

async function create(request, response) {
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  try {
    const id = await usersService.create(parsed.data);
    response.status(201).json(await usersService.findById(id));
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ message: 'That email or employee already has an account' });
    }
    if (error.code === '23503') {
      return response.status(400).json({ message: 'employeeId does not reference a real employee' });
    }
    throw error;
  }
}

async function update(request, response) {
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  if (request.params.id === request.user.sub && parsed.data.roles) {
    return response.status(403).json({ message: 'You cannot change your own roles' });
  }

  const id = await usersService.update(request.params.id, parsed.data);
  if (id === null) {
    const exists = await usersService.findById(request.params.id);
    if (!exists) return response.status(404).json({ message: 'User not found' });
    return response.status(400).json({ message: 'No fields to update' });
  }

  response.json(await usersService.findById(id));
}

module.exports = { list, create, update };
