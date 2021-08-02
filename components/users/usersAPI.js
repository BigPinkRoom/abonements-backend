const { Router } = require('express');
const router = Router();
const controller = require('./usersController');
const validation = require('./usersValidation');

router.post('/signup', validation.userMiddleware(validation.userAddSchema(), (checkExistEmail = true)), controller.add);

router.post('/login', validation.userMiddleware(validation.userLoginSchema()), controller.login);

router.delete('/logout', controller.isAuthenticated, controller.logout);

router.get('/user', controller.isAuthenticated, controller.getAuthUser);

module.exports = router;
