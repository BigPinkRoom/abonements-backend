const clientsDal = require('./clientsDAL');

class ClientsController {
  async getClientById(req, res, next) {
    try {
      const result = await clientsDal.getClientById(res.locals.clientData);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller client get error', error);
    }
  }
}
module.exports = new ClientsController();
