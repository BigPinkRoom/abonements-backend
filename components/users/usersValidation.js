const Joi = require('joi');
const escapeHtml = require('escape-html');
const { isExist } = require('./usersDAL');
const User = require('./user');

const patternPassword = '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,500})';
const patternName = '^[a-zA-Zа-яА-Я]{2,100}$'; //TODO

class UserValidation {
  userMiddleware(schema, checkExistEmail = false) {
    return async (req, res, next) => {
      try {
        const user = new User(req.body);

        await schema.validateAsync(user);

        const email = user.email;

        if (checkExistEmail) {
          await isExist(email);
        }

        next();
      } catch (error) {
        let message = error.message;
        const { details } = error;

        if (details) {
          message = details.map((i) => i.message).join(',');
        }

        return res.status(422).json({ error: { message: message } });
      }
    };
  }

  userAddSchema() {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string()
        .pattern(RegExp(patternPassword))
        .required()
        .error(
          new Error(
            'Field "password" must be contain at least 8 symbols. At least one digit, one uppercase (latin), one lowercase (latin) and one of symbols("!@#$%^&*")'
          )
        ),
      passwordConfirm: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .error(new Error('Field "password" and field "confirm password" must match ')),
      surname: Joi.string()
        .pattern(RegExp(patternName))
        .required()
        .error(new Error('Field "surname" must be contain at least 2 and at max 100 letters')),
      name: Joi.string()
        .pattern(RegExp(patternName))
        .required()
        .error(new Error('Field "name" must be contain at least 2 and at max 100 letters')),
      patronymic: Joi.string()
        .pattern(RegExp(patternName))
        .required()
        .error(new Error('Field "patronymic" must be contain at least 2 and at max 100 letters')),
    });

    return schema;

    // const options = {
    //   abortEarly: false,
    //   allowUnknown: true,
    //   stripUnknown: true,
    // };
  }

  userLoginSchema() {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string()
        .pattern(RegExp(patternPassword))
        .required()
        .error(
          new Error(
            'Field "password" must be contain at least 8 symbols. At least one digit, one uppercase (latin), one lowercase (latin) and one of symbols("!@#$%^&*")'
          )
        ),
    });

    return schema;
  }

  userUpdateSchema() {
    const schema = Joi.object({
      email: Joi.string().email().required().optional,
      password: Joi.string().pattern(new RegExp(patternPassword)).required().optional,
      passwordConfirm: Joi.string().valid(Joi.ref('password')).required().optional,
      name: Joi.string().pattern(new RegExp(patternName)).required().optional,
      surname: Joi.string().pattern(new RegExp(patternName)).required().optional,
      patronymic: Joi.string().pattern(new RegExp(patternName)).required().optional,
    });

    return schema;
  }
}

module.exports = new UserValidation();
