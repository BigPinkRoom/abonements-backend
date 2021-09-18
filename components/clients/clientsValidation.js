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
      filters: '',
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
}

module.exports = new ClientValidation();
