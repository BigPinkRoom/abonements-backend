const pool = require('../../pool.db').getPool();
const helpersDAL = require('../../helpers/helpersDAL');

class ClientsModel {
  async getClientById(clientId) {
    const sql = `SELECT * FROM mydb.clients WHERE client_id = ${clientId}`;

    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      const [rows, fields, error] = await poolPromise.execute(sql);
      const result = rows;

      if (error) throw error;

      return result;
    } catch (error) {
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }
}

module.exports = new ClientsModel();
