const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.post('/login', authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
