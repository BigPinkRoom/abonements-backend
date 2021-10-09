const abonementsDal = require('./abonementsDAL');
const abonementsService = require('./abonementsService');

class AbonementsController {
  async get(req, res, next) {
    try {
      const result = await abonementsDal.getWithClients(res.locals.abonementData.params);
      const processedResult = abonementsService.createAbonementsWithClients(result);

      res.status(200).json(processedResult);
    } catch (error) {
      console.log('controller abonement get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new AbonementsController();
