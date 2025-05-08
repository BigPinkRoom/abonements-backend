const abonementsDAL = require('./abonementsDAL');
const abonementsService = require('./abonementsService');

class AbonementsController {
  async getFull(req, res, next) {
    try {
      const abonementsWithClients = await abonementsDAL.getAbonementsWithClients(res.locals.abonementData.params);
      const abonementsEvents = await abonementsDAL.getAbonementsEvents(res.locals.abonementData.params);
      const result = abonementsService.createAbonementsFull({ abonementsWithClients, abonementsEvents });

      res.status(200).json(result);
    } catch (error) {
      console.log('controller abonement get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async addFamily(req, res, next) {
    try {
      const family = await abonementsDAL.addFamily(res.locals.familyData, req.user);

      res.status(200).json(family);
    } catch (error) {
      console.log('controller add family get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async updateFamily(req, res, next) {
    try {
      console.log('Данные семьи, полученные от фронтенда:', JSON.stringify(res.locals.familyData, null, 2));

      const family = await abonementsDAL.updateFamily(res.locals.familyData, req.user);
      res.status(200).json(family);
    } catch (error) {
      console.log('controller update family error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async addAbonement(req, res, next) {
    try {
      const { abonements, clientIds } = req.body;
      const user = req.user;

      if (!Array.isArray(abonements) || !abonements.length || !Array.isArray(clientIds) || !clientIds.length) {
        return res.status(400).json({ error: 'Необходимы данные абонементов и список клиентов' });
      }

      const abonementIds = await abonementsDAL.addAbonementForClients(abonements, clientIds, user);

      console.log('abonementIds in controller', abonementIds);

      res.status(201).json({ abonementIds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
module.exports = new AbonementsController();
