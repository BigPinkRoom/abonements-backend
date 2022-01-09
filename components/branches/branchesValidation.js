const Joi = require('joi');
const { branchesConstants } = require('./constants');
const Branch = require('./branch');

class branchValidation {
  branchMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const branchData = new Branch(req.body);

        for (let param in branchData) {
          await schema.validateAsync(branchData[param]);
        }

        res.locals.branchData = branchData;

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

  getBranchesSchema() {
    const schema = Joi.object({
      sortings: Joi.array().items(
        Joi.object({
          name: Joi.string().valid(...branchesConstants.BRANCHES_SORT_NAMES),
          type: Joi.string().valid(...branchesConstants.BRANCHES_SORT_TYPES),
        })
      ),
      id: Joi.string().min(1).max(6).regex(/^\d+$/),
    });

    return schema;
  }
}

module.exports = new branchValidation();
