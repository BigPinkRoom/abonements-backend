const pool = require('../../pool.db').getPool();
const helpersDAL = require('../../helpers/helpersDAL');

// const { relativesConstants } = require('./constants');

class RelativesModel {
  async getRelativeTypes({ sortings = [] } = {}) {
    console.log('get relatve types', sortings);
    const sqlSorting = helpersDAL.createSortingString(sortings) || '';

    const params = null;

    let sql = `SELECT * FROM mydb.relatives_types
    ${sqlSorting};
    `;
    console.log('sql', sortings);
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

  async getRelativeById(relativeId) {
    const sql = `SELECT r.*, c.telephone
                 FROM mydb.relatives r
                 LEFT JOIN mydb.telephone_numbers c ON r.relative_id = c.relative_id
                 WHERE r.relative_id = ${relativeId}`;

    let poolPromise = null;
    try {
      poolPromise = pool.promise();

      const [rows, fields, error] = await poolPromise.execute(sql);
      const result = rows;

      console.log('result of getRelativeById', result);

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

module.exports = new RelativesModel();
