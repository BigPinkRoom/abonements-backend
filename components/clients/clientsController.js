const clientsDal = require('./clientsDAL');

class ClientsController {
  async get(req, res, next) {
    try {
      const result = await clientsDal.get(res.locals.clientData.params);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller client get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async add(req, res, next) {
    try {
      const result = clientsDal.addClients(res.locals.clientsData)

      res.status(200).json(result)
    } catch (error) {
      console.log('controller client add error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new ClientsController();
