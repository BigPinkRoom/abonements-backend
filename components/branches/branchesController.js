const branchesDAL = require('./branchesDAL');

class BranchesController {
  async get(req, res, next) {
    try {
      const result = await branchesDAL.get(res.locals.branchData.params);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller branches get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new BranchesController();
