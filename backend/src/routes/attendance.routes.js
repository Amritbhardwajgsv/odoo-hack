const { Router } = require('express');

const attendanceController = require('../controllers/attendance.controller');

const router = Router();

router.get('/', attendanceController.list);
router.get('/:id', attendanceController.getById);
router.post('/', attendanceController.create);
router.patch('/:id', attendanceController.update);

module.exports = router;
