const abonementsDal = require('./abonementsDAL');
const abonementsService = require('./abonementsService');

class AbonementsController {
  async getFull(req, res, next) {
    try {
      const abonementsWithClients = await abonementsDal.getAbonementsWithClients(res.locals.abonementData.params);
      const abonementsEvents = await abonementsDal.getAbonementsEvents(res.locals.abonementData.params);
      const result = abonementsService.createAbonementsFull({ abonementsWithClients, abonementsEvents });

      res.status(200).json(result);
    } catch (error) {
      console.log('controller abonement get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new AbonementsController();
