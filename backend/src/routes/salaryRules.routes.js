const { Router } = require('express');

const { requireRole } = require('../middleware/auth');
const { SALARY_MANAGERS } = require('../constants');
const controller = require('../controllers/salaryRules.controller');

const router = Router();
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requireRole(...SALARY_MANAGERS), controller.create);
router.patch('/:id', requireRole(...SALARY_MANAGERS), controller.update);
router.delete('/:id', requireRole(...SALARY_MANAGERS), controller.remove);

module.exports = router;
