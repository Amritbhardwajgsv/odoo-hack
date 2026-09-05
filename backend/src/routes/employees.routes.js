const { Router } = require('express');

const employeesController = require('../controllers/employees.controller');

const router = Router();

router.get('/', employeesController.list);
router.get('/:id', employeesController.getById);
router.post('/', employeesController.create);
router.patch('/:id', employeesController.update);

module.exports = router;
