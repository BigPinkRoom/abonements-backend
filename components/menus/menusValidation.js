const Joi = require('joi');
const { menusConstants } = require('./constants');
const Menu = require('./menu');

class menuValidation {
  menuMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const menuData = new Menu(req.body);

        for (let param in menuData) {
          await schema.validateAsync(menuData[param]);
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

  getMenuSchema() {
    const schema = Joi.object({
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...menusConstants.MENUS_SORT_NAMES),
          type: Joi.string().valid(...menusConstants.MENUS_SORT_TYPES),
        })
      ),
      // userId: Joi.string().min(1).max(6).regex(/^\d+$/).required(),
    });

    return schema;
  }
}

module.exports = new menuValidation();
