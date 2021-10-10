const pool = require('../../pool.db').getPool();

class AbonementsModel {
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

  async getAbonementsCalendar() {
    const sql = '';

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

  async getAbonementsFull({ filters = [], sortings = [] }) {
    const params = [];

    const sqlSorting = AbonementsModel.createSortingString(sortings) || '';

    const sqlFilter = ``;

    // TODO 'data' to 'date'
    const sql = `SELECT abonements.*, clients.client_id AS client_id, clients.name AS client_name, clients.surname AS client_surname, clients.patronymic AS client_patronymic, clients.birthday AS client_birthday
    FROM mydb.abonements 
    LEFT JOIN mydb.abonements_clients ON mydb.abonements_clients.abcl_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.clients ON mydb.clients.client_id = mydb.abonements_clients.abcl_client_id
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

module.exports = new AbonementsModel();
