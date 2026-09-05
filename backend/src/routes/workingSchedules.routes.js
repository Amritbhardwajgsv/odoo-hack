const { Router } = require('express');

const controller = require('../controllers/workingSchedules.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
