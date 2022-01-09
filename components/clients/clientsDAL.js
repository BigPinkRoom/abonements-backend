const pool = require('../../pool.db').getPool();
const helpersDAL = require('../../helpers/helpersDAL');

class ClientsModel {
  async addClients() {
    const sql = ``;

    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      await poolPromise.beginTransaction();

      const [rows, fields, error] = await poolPromise.execute(sql);
      const result = rows;

      if (error) throw error;

      return result;
    } catch (error) {
      await poolPromise.rollback();

      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }
}

module.exports = new ClientsModel();
