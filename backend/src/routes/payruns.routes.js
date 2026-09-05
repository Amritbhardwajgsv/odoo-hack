const { Router } = require('express');

const controller = require('../controllers/payruns.controller');

const payrunsRouter = Router();
// Declared before '/:id' so these are never read as a payrun id.
payrunsRouter.get('/years', controller.years);
payrunsRouter.get('/eligible', controller.eligible);
payrunsRouter.get('/', controller.list);
payrunsRouter.get('/:id', controller.get);
payrunsRouter.get('/:id/payslips', controller.listPayslipsForPayrun);
payrunsRouter.post('/', controller.create);
payrunsRouter.patch('/:id', controller.update);
payrunsRouter.post('/:id/compute', controller.compute);
payrunsRouter.post('/:id/status/:status', controller.setStatus);
payrunsRouter.post('/:id/send-payslips', controller.sendPayslips);
payrunsRouter.delete('/:id', controller.remove);

const payslipsRouter = Router();
payslipsRouter.get('/', controller.listPayslips);
payslipsRouter.get('/:id', controller.getPayslip);
payslipsRouter.get('/:id/pdf', controller.payslipPdf);

module.exports = { payrunsRouter, payslipsRouter };
