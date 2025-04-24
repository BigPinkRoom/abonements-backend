const { Router } = require('express');
const router = Router();
const controller = require('./clientsController');
const commonController = require('../common/commonController');
const validation = require('./clientsValidation');

router.post(
  '/list',
  commonController.checkAccess(['employee', 'admin']),
  validation.clientMiddleware(validation.getClientsSchema()),
  controller.get
);

router.post(
  '/add',
  commonController.checkAccess(['employee', 'admin']),
  validation.clientMiddleware(validation.addClientsSchema()),
  controller.get
);

router.post(
  '/search-family',
  commonController.checkAccess(['employee', 'admin']),
  validation.clientMiddleware(validation.searchFamilySchema()),
  controller.searchFamily
);
module.exports = router;
