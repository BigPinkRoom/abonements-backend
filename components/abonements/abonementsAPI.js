const { Router } = require('express');
const router = Router();
const controller = require('./abonementsController');
const commonController = require('../common/commonController');
const validation = require('./abonementsValidation');

router.post(
  '/abonementsFull',
  commonController.checkAccess(['employee', 'admin']),
  validation.abonementMiddleware(validation.getAbonementsFullSchema()),
  controller.getFull
);

module.exports = router;
