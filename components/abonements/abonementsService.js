const { DateTime } = require('luxon');
const { abonementsConstants } = require('./constants');
const helpersDate = require('../../helpers/helpersDate');

class AbonementsService {
  createAbonementsFull({ abonementsWithClients, abonementsEvents }) {
    const groupedAbonements = {};

    abonementsWithClients.forEach((row) => {
      const abonementId = row.abonement_id;

      if (!groupedAbonements[abonementId]) {
        groupedAbonements[abonementId] = {
          abonement: {},
          clients: [],
          relatives: [],
          events: [],
        };
      }

      const { client, relative, abonement } = this._extractEntities(row);

      if (client && !groupedAbonements[abonementId].clients.some((c) => c.client_id === client.client_id)) {
        groupedAbonements[abonementId].clients.push(client);
      }

      if (relative && !groupedAbonements[abonementId].relatives.some((r) => r.relative_id === relative.relative_id)) {
        groupedAbonements[abonementId].relatives.push(relative);
      }

      groupedAbonements[abonementId].abonement = abonement;
    });

    this._addEventsToAbonements(groupedAbonements, abonementsEvents);

    return Object.values(groupedAbonements);
  }

  _extractEntities(row) {
    const client = {};
    const relative = {};
    const abonement = {};

    const columnHandlers = {
      client: (key, value) => this._checkingClientColumn(key) && (client[key] = value),
      relative: (key, value) => this._checkingRelativeColumn(key) && (relative[key] = value),
      abonement: (key, value) => this._checkingAbonementColumn(key) && (abonement[key] = value),
    };

    Object.entries(row).forEach(([key, value]) => {
      Object.values(columnHandlers).forEach((handler) => handler(key, value));
    });

    return { client, relative, abonement };
  }

  _addEventsToAbonements(groupedAbonements, events) {
    events.forEach((event) => {
      if (event.event_id !== null) {
        const abonementId = event.abonement_id;
        if (groupedAbonements[abonementId]) {
          const { abonement_id, event_type_id, ...eventData } = event;
          groupedAbonements[abonementId].events.push(eventData);
        }
      }
    });
  }

  _checkingClientColumn(columnName) {
    return abonementsConstants.ABONEMENTS_FULL_CLIENT_COLUMNS.includes(columnName);
  }

  _checkingRelativeColumn(columnName) {
    return abonementsConstants.ABONEMENTS_FULL_RELATIVE_COLUMNS.includes(columnName);
  }

  _checkingAbonementColumn(columnName) {
    return abonementsConstants.ABONEMENTS_FULL_ABONEMENT_COLUMNS.includes(columnName);
  }

  createFilters() {}
}

module.exports = new AbonementsService();
