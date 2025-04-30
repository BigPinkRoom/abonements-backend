const searchDAL = require('./searchDAL');

class SearchController {
  async search(req, res, next) {
    try {
      const result = await searchDAL.searchClients(res.locals.searchData);

      console.log('result search dal', result);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller searches get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new SearchController();
