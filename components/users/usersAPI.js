const { Router } = require('express');
const router = Router();
const controller = require('./usersController');
const commonController = require('../common/commonController');
const validation = require('./usersValidation');

router.post(
  '/signup',
  commonController.isNotAuthenticated,
  validation.userMiddleware(validation.userAddSchema(), (checkExistEmail = true)),
  controller.add
);

router.post(
  '/login',
  commonController.isNotAuthenticated,
  validation.userMiddleware(validation.userLoginSchema()),
  controller.login
);

router.delete('/logout', commonController.checkAccess(['employee', 'admin']), controller.logout);

router.get('/user', commonController.checkAccess(['employee', 'admin']), controller.getAuthUser);

module.exports = router;
