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

        resultTable.push(resultRow);
      }

      abonementsEvents.forEach((event) => {
        if (event.abonement_id === row.abonement_id) {
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
}

module.exports = new AbonementsService();
