const pool = require('../../pool.db').getPool();
const abonementsService = require('./abonementsService');

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

  static createFilteringString(safeFilters, columnDate) {
    const strings = [];

    const filtersNames = Object.keys(safeFilters);

    filtersNames.forEach((filterName) => {
      if (filterName === 'year') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.year}`);

        return;
      }

      if (filterName === 'month') {
        strings.push(`${filterName}(${columnDate}) = ${safeFilters.month}`);

        return;
      }

      strings.push(`${filterName} = ${safeFilters[filterName]}`);
    });

    if (strings.length) {
      return `WHERE ${strings.join(' AND ')}`;
    } else {
      return null;
    }
  }

  async getAbonementsEvents({ filters = {}, sortings = [] }) {
    const params = [];

    const sqlSorting = AbonementsModel.createSortingString(sortings) || '';
    const sqlFilter = AbonementsModel.createFilteringString(filters, 'mydb.abonements.date_create') || '';

    const sql = `SELECT mydb.abonements.abonement_id, mydb.events.*, mydb.event_types.name AS event_type
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_events ON mydb.abonements_events.abev_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.events ON mydb.events.event_id = mydb.abonements_events.abev_event_id
    LEFT JOIN mydb.event_types ON mydb.event_types.event_type_id = mydb.events.event_type_id
    ${sqlFilter} ${sqlSorting};`;

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
    const sqlFilter = AbonementsModel.createFilteringString(filters, 'mydb.abonements.date_create') || '';

    const sql = `SELECT abonements.*, clients.client_id AS client_id, clients.name AS client_name, clients.surname AS client_surname, clients.patronymic AS client_patronymic, clients.birthday AS client_birthday, mydb.abonement_statuses.name AS status_type
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_clients ON mydb.abonements_clients.abcl_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.clients ON mydb.clients.client_id = mydb.abonements_clients.abcl_client_id
    LEFT JOIN mydb.abonement_statuses ON mydb.abonement_statuses.abonement_status_id = mydb.abonements.status_id
    ${sqlFilter} ${sqlSorting};`;

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
