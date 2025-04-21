const { Router } = require('express');
const router = Router();
const controller = require('./abonementsController');
const commonController = require('../common/commonController');
const validation = require('./abonementsValidation');
const multer = require('multer');
const encoder = multer();

router.post(
  '/abonementsFull',
  commonController.checkAccess(['employee', 'admin']),
  validation.abonementMiddleware(validation.getAbonementsFullSchema()),
  controller.getFull
);

router.post(
  '/addFamily',
  encoder.none(),
  commonController.checkAccess(['employee', 'admin']),
  validation.abonementMiddlewareFamily(validation.addFamilySchema()),
  controller.addFamily
);

router.put(
  '/updateFamily',
  encoder.none(),
  commonController.checkAccess(['employee', 'admin']),
  validation.abonementMiddlewareFamily(validation.updateFamilySchema()),
  controller.updateFamily
);

module.exports = router;
