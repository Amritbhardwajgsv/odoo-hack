const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const pool = require('../../db/pool');

const router = Router();

const ROLES = ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'admin'];

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

function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    roles: row.roles,
    isActive: row.is_active,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    createdAt: row.created_at,
  };
}

router.get('/', async (request, response) => {
  const { search, role } = request.query;
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${params.length} OR e.full_name ILIKE $${params.length})`);
  }

  if (role) {
    params.push(role);
    conditions.push(`$${params.length} = ANY(u.roles)`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.roles::text[] AS roles, u.is_active, u.employee_id, u.created_at,
            e.full_name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       ${where}
       ORDER BY u.created_at DESC`,
    params
  );

  response.json(rows.map(serializeUser));
});

router.post('/', async (request, response) => {
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const { employeeId, email, password, roles, isActive } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (employee_id, email, password_hash, roles, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, roles::text[] AS roles, is_active, employee_id, created_at`,
      [employeeId, email, passwordHash, roles, isActive]
    );
    const { rows: employeeRows } = await pool.query(
      'SELECT full_name FROM employees WHERE id = $1',
      [employeeId]
    );

    response
      .status(201)
      .json(serializeUser({ ...rows[0], employee_name: employeeRows[0]?.full_name }));
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ message: 'A user with that email already exists' });
    }
    if (error.code === '23503') {
      return response.status(400).json({ message: 'employeeId does not reference a real employee' });
    }
    throw error;
  }
});

router.patch('/:id', async (request, response) => {
  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  if (request.params.id === request.user.sub && parsed.data.roles) {
    return response.status(403).json({ message: 'You cannot change your own roles' });
  }

  const { roles, isActive, password } = parsed.data;
  const sets = [];
  const params = [];

  if (roles) {
    params.push(roles);
    sets.push(`roles = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (password) {
    params.push(await bcrypt.hash(password, 10));
    sets.push(`password_hash = $${params.length}`);
  }

  if (sets.length === 0) {
    return response.status(400).json({ message: 'No fields to update' });
  }

  params.push(request.params.id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, email, roles::text[] AS roles, is_active, employee_id, created_at`,
    params
  );

  if (rows.length === 0) {
    return response.status(404).json({ message: 'User not found' });
  }

  const { rows: employeeRows } = await pool.query('SELECT full_name FROM employees WHERE id = $1', [
    rows[0].employee_id,
  ]);

  response.json(serializeUser({ ...rows[0], employee_name: employeeRows[0]?.full_name }));
});

module.exports = router;
