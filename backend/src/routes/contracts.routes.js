const { Router } = require('express');

const contractsController = require('../controllers/contracts.controller');

const router = Router();

router.get('/', contractsController.list);
router.get('/:id', contractsController.getById);
router.post('/', contractsController.create);
router.patch('/:id', contractsController.update);

module.exports = router;
