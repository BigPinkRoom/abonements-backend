const relativesDAL = require('./relativesDAL');

class RelativesController {
  async getTypes(req, res, next) {
    try {
      const result = await relativesDAL.getRelativeTypes(res.locals.relativeData.params);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller relatives get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}

module.exports = new RelativesController();
