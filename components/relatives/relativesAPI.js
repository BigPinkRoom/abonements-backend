const { Router } = require('express');
const router = Router();
const controller = require('./relativesController');
const commonController = require('../common/commonController');
const validation = require('./relativesValidation');
const multer = require('multer');
const encoder = multer();

router.post(
  '/types',
  commonController.checkAccess(['employee', 'admin']),
  validation.relativeMiddleware(validation.getRelativeTypesSchema()),
  controller.getTypes
);

module.exports = router;
