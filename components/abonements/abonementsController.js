const abonementsDal = require('./abonementsDAL');
const abonementsService = require('./abonementsService');

class AbonementsController {
  async getFull(req, res, next) {
    try {
      const result = await abonementsDal.getAbonementsFull(res.locals.abonementData.params);
      const processedResult = abonementsService.createAbonementsFull(result);

      res.status(200).json(processedResult);
    } catch (error) {
      console.log('controller abonement get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new AbonementsController();
