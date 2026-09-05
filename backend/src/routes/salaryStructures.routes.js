const { Router } = require('express');

const { requireRole } = require('../middleware/auth');
const { SALARY_MANAGERS } = require('../constants');
const controller = require('../controllers/salaryStructures.controller');

const router = Router();
// Reading is open to everyone mounted under this router (PAYROLL_STAFF, set
// in app.js); only a salary manager or admin may change what gets computed.
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireRole(...SALARY_MANAGERS), controller.create);
router.patch('/:id', requireRole(...SALARY_MANAGERS), controller.update);
router.delete('/:id', requireRole(...SALARY_MANAGERS), controller.remove);

module.exports = router;
