const Joi = require('joi');
const { clientsConstants } = require('./constants');
const Client = require('./client');

class ClientValidation {
  clientMiddleware(schema) {
    return async (req, res, next) => {
      console.log('req.body', req.body);
      try {
        const clientData = new Client(req.body);
        let result = null;

        if (clientData) {
          result = await schema.validateAsync({ id: clientData.id });
        }

        res.locals.clientData = result.id;

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

  getClientByIdSchema() {
    const schema = Joi.object({
      id: Joi.number().min(1).max(9999999).required(),
    });

    return schema;
  }
}

module.exports = new ClientValidation();
