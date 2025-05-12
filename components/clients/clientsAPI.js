const { Router } = require('express');
const router = Router();
const controller = require('./clientsController');
const commonController = require('../common/commonController');
const validation = require('./clientsValidation');

router.post(
  '/get-client-by-id',
  commonController.checkAccess(['employee', 'admin']),
  validation.clientMiddleware(validation.getClientByIdSchema()),
  controller.getClientById
);

module.exports = router;
