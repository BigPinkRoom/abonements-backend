const { DateTime } = require('luxon');
const { abonementsConstants } = require('./constants');

class AbonementsService {
  createAbonementsFull({ abonementsWithClients, abonementsEvents }) {
    const resultTable = [];

    abonementsWithClients.forEach((row, index) => {
      const resultRow = {
        clients: [],
        events: [],
      };

      const client = {};

      const isExistingAbonement = this._checkingExistingAbonement({ resultTable, abonementId: row.abonement_id });

      for (let column in row) {
        const isClientColumn = this._checkingClientColumn(column);

        if (isClientColumn) {
          client[column] = row[column];
        }

        if (!isExistingAbonement && !isClientColumn) {
          resultRow[column] = row[column];
        }
      }

      if (isExistingAbonement) {
        const lastIndexTable = resultTable.length - 1;

        resultTable[lastIndexTable].clients.push(client);
      } else {
        resultRow.clients.push(client);

        delete resultRow.status_id;

        resultTable.push(resultRow);
      }

      abonementsEvents.forEach((event) => {
        if (event.abonement_id === row.abonement_id) {
          delete event.abonement_id;
          delete event.event_type_id;

          resultRow.events.push(event);
        }
      });
    });

    return resultTable;
  }

  _checkingClientColumn(columnName) {
    const check = abonementsConstants.ABONEMENTS_FULL_CLIENT_COLUMNS.find((checkingColumnName) => {
      return checkingColumnName === columnName;
    });

    return Boolean(check);
  }

  _checkingExistingAbonement(options) {
    const check = options.resultTable.find((resultTableRow) => {
      return resultTableRow.abonement_id === options.abonementId;
    });

    return Boolean(check);
  }

  createFilters() {}

  // setAbonementsFullDate(options) {
  //   if (!options.year) {
  //     options.year = DateTime.local().year;
  //   }
  //   if (!options.month) {
  //     options.month = DateTime.local().month;
  //   }

  //   return options;
  // }

  // setDateFilterString(options) {
  //   const strings = [];

  //   if(options.year) {
  //     strings.push(``)
  //   }
  //   return `YEAR(${options.year}) AND MONTH(${options.month})`;
  // }
}

module.exports = new AbonementsService();
