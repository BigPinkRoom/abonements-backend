const Joi = require('joi');
const { abonementsConstants } = require('./constants');
const Abonement = require('./abonement');

class AbonementValidation {
  abonementMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const abonementData = new Abonement(req.body);

        for (let param in abonementData) {
          await schema.validateAsync(abonementData[param]);
        }

        res.locals.abonementData = abonementData;

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

  getAbonementsSchema() {
    const schema = Joi.object({
      filters: Joi.object({
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(2021).max(2050),
      }),
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...abonementsConstants.ABONEMENTS_SORT_NAMES),
          type: Joi.string().valid(...abonementsConstants.ABONEMENTS_SORT_TYPES),
        })
      ),
      id: Joi.string().min(1).max(6).regex(/^\d+$/),
    });

    return schema;
  }

  getAbonementsFullSchema() {
    const schema = Joi.object({
      filters: Joi.object({
        status: Joi.number().valid(...abonementsConstants.ABONEMENTS_FULL_FILTERS.status),
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(2021).max(2050),
      }),
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...abonementsConstants.ABONEMENTS_FULL_SORT_NAMES),
          type: Joi.string().valid(...abonementsConstants.ABONEMENTS_FULL_SORT_TYPES),
        })
      ),
      id: Joi.string().min(1).max(6).regex(/^\d+$/),
    });

    return schema;
  }
}

module.exports = new AbonementValidation();
