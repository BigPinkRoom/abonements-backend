const Joi = require('joi');
const { searchesConstants } = require('./constants');
const Search = require('./search');

class searchValidation {
  searchMiddleware(schema) {
    return async (req, res, next) => {
      try {
        const searchData = new Search(req.body);

        console.log('searchData', searchData);

        for (let param in searchData) {
          console.log('param', param, searchData[param]);
          await schema.validateAsync(searchData[param]);
        }

        res.locals.searchData = searchData;

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

  getSearchesSchema() {
    // const schema = Joi.object({
    //   searchString: Joi.string()
    //     .min(2)
    //     .max(100)
    //     .regex(/^[a-zA-Zа-яА-ЯёЁ0-9\-\.\+\ ]+$/),
    // });

    const schema = Joi.string()
      .min(2)
      .max(100)
      .regex(/^[a-zA-Zа-яА-ЯёЁ0-9\-\.\+\ ]+$/);

    return schema;
  }
}

module.exports = new searchValidation();
