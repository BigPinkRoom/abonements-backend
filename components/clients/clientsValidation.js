const Joi = require('joi');
const { clientsConstants } = require('./constants');
const Client = require('./client');

class ClientValidation {
  clientMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const clientData = new Client(req.body);

        for (let param in clientData) {
          await schema.validateAsync(clientData[param]);
        }

        res.locals.clientData = clientData;

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

  getClientsSchema() {
    const schema = Joi.object({
      filters: Joi.object({
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(2021).max(2050),
      }),
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...clientsConstants.CLIENTS_SORT_NAMES),
          type: Joi.string().valid(...clientsConstants.CLIENTS_SORT_TYPES),
        })
      ),
      id: Joi.string().min(1).max(6).regex(/^\d+$/),
    });

    return schema;
  }

  addClientsSchema() {
    const schema = Joi.object({
      clients: Joi.array().items(
        Joi.object({
          surname: Joi.string().min(2).max(100),
          name: Joi.string().min(2).max(100),
          patronymic: Joi.string().min(2).max(100),
          birthday: Joi.date().less('1-1-2000').greater('now').iso(),
        })
      ),
      relatives: Joi.array().items(
        Joi.object({
          name: Joi.string().min(2).max(100),
          telephone: Joi.string().min(4).max(100),
        })
      ),
      telephones: Joi.array().items(
        Joi.object({
          telephone: Joi.string().min(4).max(100),
        })
      ),
    });

    return schema;
  }
}

module.exports = new ClientValidation();
