const { Router } = require('express');

const controller = require('../controllers/me.controller');

const router = Router();
router.get('/profile', controller.profile);
router.get('/attendance', controller.attendance);
router.get('/attendance/today', controller.attendanceToday);
router.post('/attendance/check-in', controller.checkIn);
router.post('/attendance/check-out', controller.checkOut);
router.get('/time-off/types', controller.timeOffTypeOptions);
router.get('/time-off', controller.timeOffRequests);
router.post('/time-off', controller.createTimeOffRequest);
router.get('/allocations', controller.allocations);
router.get('/payslips', controller.payslips);
router.get('/payslips/:id', controller.payslipDetail);
router.get('/payslips/:id/pdf', controller.payslipPdf);

module.exports = router;
