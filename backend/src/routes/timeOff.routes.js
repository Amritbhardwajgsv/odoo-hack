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
typesRouter.get('/:id', controller.getType);
typesRouter.post('/', controller.createType);
typesRouter.patch('/:id', controller.updateType);

const allocationsRouter = Router();
allocationsRouter.get('/', controller.listAllocations);
allocationsRouter.get('/:id', controller.getAllocation);
allocationsRouter.post('/', controller.createAllocation);
allocationsRouter.patch('/:id', controller.updateAllocation);
allocationsRouter.post('/:id/approve', controller.approveAllocation);
allocationsRouter.post('/:id/refuse', controller.refuseAllocation);

module.exports = { requestsRouter, typesRouter, allocationsRouter };
