const pool = require('../../pool.db').getPool();
const helpersDAL = require('../../helpers/helpersDAL');

class BranchesModel {
  async get({ sortings = [] } = {}) {
    const params = [];

    const sqlSorting = helpersDAL.createSortingString(sortings) || '';

    const sql = `SELECT * FROM mydb.branches
    ${sqlSorting};`;

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

module.exports = new BranchesModel();
