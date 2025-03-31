const { Router } = require('express');
const router = Router();
const controller = require('./menusController');
const commonController = require('../common/commonController');
const validation = require('./menusValidation');

router.post('/list', validation.menuMiddleware(validation.getMenuSchema()), controller.get);

module.exports = router;
