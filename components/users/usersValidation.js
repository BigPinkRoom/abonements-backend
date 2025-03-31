const Joi = require('joi');
const escapeHtml = require('escape-html');
const { isExist } = require('./usersDAL');
const User = require('./user');

const patternPassword = '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,150})';
const patternName = '^[a-zA-Zа-яА-Я]{2,100}$'; //TODO

class UserValidation {
  userMiddleware(schema, checkExistEmail = false) {
    return async (req, res, next) => {
      try {
        const user = new User(req.body);

        await schema.validateAsync(user);

        const email = user.email;
        const branch = user.branch;

        if (checkExistEmail) {
          await isExist(email, branch);
        }

        next();
      } catch (error) {
        const message = error.message;
        const userEmail = error.userEmail;

        res.status(422).json({ error: { message, userEmail } });
      }
    };
  }

  userAddSchema() {
    const schema = Joi.object({
      email: Joi.string().email().required().messages({
        'string.empty': 'Email:required',
        'string.email': 'Email:validEmail',
        'string.base': 'Email:string',
      }),
      password: Joi.string().pattern(RegExp(patternPassword)).required().messages({
        'string.empty': 'Password:required',
        'string.base': 'Password:string',
        'string.pattern.base': 'Password:pattern',
      }),
      passwordConfirm: Joi.string().valid(Joi.ref('password')).required().messages({
        'string.empty': 'PasswordConfirm:required',
        'string.base': 'PasswordConfirm:string',
        'any.only': 'PasswordConfirm:match',
      }),
      surname: Joi.string().pattern(RegExp(patternName)).required().messages({
        'string.empty': 'Surname:required',
        'string.base': 'Surname:string',
        'string.pattern.base': 'Surname:pattern',
      }),
      name: Joi.string().pattern(RegExp(patternName)).required().messages({
        'string.empty': 'Name:required',
        'string.base': 'Name:string',
        'string.pattern.base': 'Name:pattern',
      }),
      patronymic: Joi.string().pattern(RegExp(patternName)).required().messages({
        'string.empty': 'Patronymic:required',
        'string.base': 'Patronymic:string',
        'string.pattern.base': 'Patronymic:pattern',
      }),
      branch: Joi.number().integer().min(1).max(5000).required().messages({
        'any.required': 'Branch:required',
        'number.base': 'Branch:number',
        'number.min': 'Branch:min',
        'number.max': 'Branch:max',
      }),
    });

    return schema;
  }

  userLoginSchema() {
    const schema = Joi.object({
      email: Joi.string().email().required().messages({
        'string.empty': 'Email:required',
        'string.email': 'Email:validEmail',
        'string.base': 'Email:string',
      }),
      password: Joi.string().pattern(RegExp(patternPassword)).required().messages({
        'string.empty': 'Password:required',
        'string.base': 'Password:string',
        'string.pattern.base': 'Password:pattern',
      }),
      branch: Joi.number().integer().min(1).max(5000).required().messages({
        'any.required': 'Branch:required',
      }),
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
