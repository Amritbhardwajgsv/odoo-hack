const { Router } = require('express');

const controller = require('../controllers/payrollDashboard.controller');

const router = Router();
router.get('/', controller.get);

module.exports = router;
