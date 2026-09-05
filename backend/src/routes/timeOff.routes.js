const { Router } = require('express');

const controller = require('../controllers/timeOff.controller');

const requestsRouter = Router();
requestsRouter.get('/', controller.listRequests);
requestsRouter.get('/:id', controller.getRequest);
requestsRouter.post('/', controller.createRequest);
requestsRouter.patch('/:id', controller.updateRequest);
requestsRouter.post('/:id/approve', controller.approve);
requestsRouter.post('/:id/refuse', controller.refuse);

const typesRouter = Router();
typesRouter.get('/', controller.listTypes);

const allocationsRouter = Router();
allocationsRouter.get('/', controller.listAllocations);

module.exports = { requestsRouter, typesRouter, allocationsRouter };
