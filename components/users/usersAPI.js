const { Router } = require('express');
const router = Router();
const controller = require('./usersController');
const validation = require('./usersValidation');

exports.signup = router.post('/', validation.userMiddleware(validation.userAddSchema()), controller.add);

exports.logout = router.get('/', controller.logout);
