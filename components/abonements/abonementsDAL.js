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

  async template() {
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

  async getAbonementsEvents() {
    const params = [];

    const sql = `SELECT mydb.abonements.abonement_id, mydb.events.*, mydb.event_types.name AS event_type
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_events ON mydb.abonements_events.abev_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.events ON mydb.events.event_id = mydb.abonements_events.abev_event_id
    LEFT JOIN mydb.event_types ON mydb.event_types.event_type_id = mydb.events.event_type_id
    WHERE event_id  IS NOT NULL;`;

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

  async getAbonementsWithClients({ filters = [], sortings = [] }) {
    const params = [];

    const sqlSorting = AbonementsModel.createSortingString(sortings) || '';

    const sqlFilter = ``;

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
