const Joi = require('joi');
const { abonementsConstants } = require('./constants');
const helpersDate = require('../../helpers/helpersDate');
const Abonement = require('./abonement');

class AbonementValidation {
  abonementMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const params = {
          filters: req.body.filters || {},
          sortings: req.body.sortings || [],
        };

        await schema.validateAsync(params);
        res.locals.abonementData = { params };

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

  abonementMiddlewareFamily(schema) {
    return async (req, res, next) => {
      try {
        const familyData = new Abonement({ family: req.body });

        await schema.validateAsync(familyData);
        res.locals.familyData = familyData;

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
      id: Joi.string().min(1).max(6).regex(/^\d+$/), // TODO
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
      id: Joi.string().min(1).max(6).regex(/^\d+$/), // TODO
    });

    return schema;
  }

  addFamilySchema() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(2000, 0, 1); // 01.01.2000

    const schema = Joi.object({
      family: Joi.object({
        clients: Joi.array()
          .required()
          .items(
            Joi.object({
              id: Joi.number().min(1).max(999999),
              name: Joi.string().min(1).max(150).required(),
              surname: Joi.string().min(1).max(150).required(),
              patronymic: Joi.string().min(1).max(150).required(),
              birthday: Joi.string()
                .pattern(/^\d{2}\.\d{2}\.\d{4}$/)
                .required()
                .custom((value, helpers) => {
                  try {
                    const [day, month, year] = value.split('.');
                    const date = new Date(year, month - 1, day);

                    if (isNaN(date.getTime())) {
                      return helpers.error('date.invalid');
                    }

                    if (date > today || date < minDate) {
                      return helpers.error('date.range');
                    }

                    return value;
                  } catch (error) {
                    return helpers.error('date.invalid', error);
                  }
                })
                .messages({
                  'string.pattern.base': 'Дата рождения должна быть в формате DD.MM.YYYY',
                  'date.invalid': 'Некорректная дата рождения',
                  'date.range': 'Дата рождения должна быть между 01.01.2000 и текущей датой',
                }),
              gender: Joi.number()
                .required()
                .valid(...abonementsConstants.GENDER_TYPES),
            })
          ),
        relatives: Joi.array()
          .required()
          .items(
            Joi.object({
              id: Joi.number().min(1).max(999999),
              name: Joi.string().min(1).max(150).required(),
              surname: Joi.string().min(1).max(150).required(),
              patronymic: Joi.string().min(1).max(150).required(),
              relative_type_id: Joi.number().min(1).max(20).required(),
              telephone: Joi.string().required(),
            })
          ),
        abonements: Joi.object({
          duration: Joi.string().optional(),
          quantity: Joi.string().optional(),
          activation_date: Joi.date().min(today).optional(),
        }).optional(),
      }),
    });
    return schema;
  }

  updateFamilySchema() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minDate = new Date(2000, 0, 1);
    const schema = Joi.object({
      family: Joi.object({
        clients: Joi.array().items(
          Joi.object({
            id: Joi.number().min(1).max(999999),
            name: Joi.string().min(1).max(150),
            surname: Joi.string().min(1).max(150),
            patronymic: Joi.string().min(1).max(150),
            birthday: Joi.string()
              .pattern(/^\d{2}\.\d{2}\.\d{4}$/)

              .custom((value, helpers) => {
                try {
                  const [day, month, year] = value.split('.');
                  const date = new Date(year, month - 1, day);

                  if (isNaN(date.getTime())) {
                    return helpers.error('date.invalid');
                  }

                  if (date > today || date < minDate) {
                    return helpers.error('date.range');
                  }

                  return value;
                } catch (error) {
                  return helpers.error('date.invalid');
                }
              })
              .messages({
                'string.pattern.base': 'Дата рождения должна быть в формате DD.MM.YYYY',
                'date.invalid': 'Некорректная дата рождения',
                'date.range': 'Дата рождения должна быть между 01.01.2000 и текущей датой',
              }),
            gender: Joi.number().valid(...abonementsConstants.GENDER_TYPES),
          })
        ),
        relatives: Joi.array().items(
          Joi.object({
            id: Joi.number().min(1).max(999999),
            name: Joi.string().min(1).max(150),
            surname: Joi.string().min(1).max(150),
            patronymic: Joi.string().min(1).max(150),
            relative_type_id: Joi.number().min(1).max(20),
            telephone: Joi.string(),
          })
        ),
        abonements: Joi.object({
          id: Joi.number().min(1).max(999999),
          duration: Joi.string(),
          quantity: Joi.string(),
          activation_date: Joi.date().min(today),
        }).required(),
      }),
    });

    return schema;
  }
}

module.exports = new AbonementValidation();
