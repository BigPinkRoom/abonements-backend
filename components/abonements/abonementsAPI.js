const { Router } = require('express');
const router = Router();
const controller = require('./abonementsController');
const commonController = require('../common/commonController');
const validation = require('./abonementsValidation');

router.post(
  '/listWithClients',
  commonController.checkAccess(['employee', 'admin']),
  validation.abonementMiddleware(validation.getAbonementsWithClientsSchema()),
  controller.get
);

module.exports = router;
