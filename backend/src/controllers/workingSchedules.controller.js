const { z } = require('zod');

const service = require('../services/workingSchedules.service');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const lineSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(TIME, 'Use HH:MM'),
  endTime: z.string().regex(TIME, 'Use HH:MM'),
  breakMinutes: z.coerce.number().int().min(0).max(600).optional().default(0),
});

// total weekly hours is deliberately absent: it is computed from the lines,
// never accepted from the client.
const scheduleSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional().default('fixed'),
  company: z.string().nullable().optional(),
  timezone: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  lines: z.array(lineSchema).optional(),
});

const updateScheduleSchema = scheduleSchema.partial();

// Caught here rather than at the database so the message names the day.
function validateLines(lines) {
  if (!lines) return null;

  const seen = new Set();
  for (const line of lines) {
    if (seen.has(line.dayOfWeek)) {
      return `${service.DAY_NAMES[line.dayOfWeek]} is listed twice`;
    }
    seen.add(line.dayOfWeek);

    if (line.endTime <= line.startTime) {
      return `${service.DAY_NAMES[line.dayOfWeek]} ends before it starts`;
    }

    const [sh, sm] = line.startTime.split(':').map(Number);
    const [eh, em] = line.endTime.split(':').map(Number);
    const worked = eh * 60 + em - (sh * 60 + sm) - (line.breakMinutes ?? 0);
    if (worked <= 0) {
      return `${service.DAY_NAMES[line.dayOfWeek]} has a break longer than the shift`;
    }
  }
  return null;
}

async function list(request, response) {
  const { search, active } = request.query;
  const isActive = active === undefined ? undefined : active === 'true';
  response.json(await service.list({ search, isActive }));
}

async function getById(request, response) {
  const schedule = await service.findById(request.params.id);
  if (!schedule) return response.status(404).json({ message: 'Working schedule not found' });
  response.json(schedule);
}

async function create(request, response) {
  const parsed = scheduleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const problem = validateLines(parsed.data.lines);
  if (problem) return response.status(400).json({ message: problem });

  response.status(201).json(await service.create(parsed.data));
}

async function update(request, response) {
  const parsed = updateScheduleSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({ message: 'Invalid input', issues: parsed.error.issues });
  }

  const problem = validateLines(parsed.data.lines);
  if (problem) return response.status(400).json({ message: problem });

  const schedule = await service.update(request.params.id, parsed.data);
  if (!schedule) return response.status(404).json({ message: 'Working schedule not found' });
  response.json(schedule);
}

async function remove(request, response) {
  const removed = await service.remove(request.params.id);
  if (!removed) return response.status(404).json({ message: 'Working schedule not found' });
  response.status(204).end();
}

module.exports = { list, getById, create, update, remove };
