const Joi = require('joi');
const { relativesConstants } = require('./constants');
const Relative = require('./relative');

class menuValidation {
  relativeMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const relativeData = new Relative(req.body);

        if (relativeData.id) {
          await schema.validateAsync({ id: relativeData.id });

          res.locals.relativeData = relativeData;
        }

        if (!relativeData.id) {
          for (let param in relativeData) {
            await schema.validateAsync(relativeData[param]);
          }
        }

        res.locals.relativeData = relativeData;

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

  getRelativeTypesSchema() {
    const schema = Joi.object({
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...relativesConstants.RELATIVE_SORT_NAMES),
          type: Joi.string().valid(...relativesConstants.RELATIVE_SORT_TYPES),
        })
      ),
    });

    return schema;
  }

  getRelativeByIdSchema() {
    const schema = Joi.object({
      id: Joi.number().min(1).max(9999999).required(),
    });
    return schema;
  }
}

module.exports = new menuValidation();
