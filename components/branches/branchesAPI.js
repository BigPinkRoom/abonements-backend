const { Router } = require('express');
const router = Router();
const controller = require('./branchesController');
// const commonController = require('../common/commonController');
const validation = require('./branchesValidation');

router.post('/list', validation.branchMiddleware(validation.getBranchesSchema()), controller.get);

module.exports = router;
