const pool = require('../../pool.db').getPool();

class ClientsModel {
  static createSortingString(safeSortings) {
    if (safeSortings.length) {
      const strings = [];

      safeSortings.forEach((sort) => {
        strings.push(`${sort.name} ${sort.type}`);
      });

      return `ORDER BY ${strings.join(', ')}`;
    } else {
      return null;
    }
  }

  // static createSortingParams(safeSortings) {
  //   if (safeSortings.length) {
  //     const params = [];

  //     safeSortings.forEach((sort) => {
  //       params.push(sort.name);
  //       params.push(sort.type);
  //     });

  //     return params;
  //   } else {
  //     return null;
  //   }
  // }

  async get({ filters = [], sortings = [] }) {
    const params = [];

    const sqlSorting = ClientsModel.createSortingString(sortings) || '';

    // const paramsSorting = ClientsModel.createSortingParams(sortings);
    // if (paramsSorting) params.push(...paramsSorting);

    const sqlFilter = ``;

    const sql = `SELECT * FROM mydb.clients ${sqlSorting};`;

    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      console.log('test', sql, params);

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
