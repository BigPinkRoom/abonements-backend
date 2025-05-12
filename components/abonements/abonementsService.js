const { DateTime } = require('luxon');
const { abonementsConstants } = require('./constants');
const helpersDate = require('../../helpers/helpersDate');

class AbonementsService {
  createAbonementsFull({ abonementsWithClients, abonementsEvents }) {
    const groupedAbonements = {};
    const orderedFamilyKeys = []; // Для сохранения порядка ключей

    abonementsWithClients.forEach((row) => {
      if (!Array.isArray(row.family_abonements) || row.family_abonements.length === 0) {
        return; // Пропускаем строки без family_abonements
      }

      const abonementIdFamily = row.family_abonements[0].abonement_id;

      // Если ключ встречается впервые, добавляем его в orderedFamilyKeys
      // и инициализируем группу
      if (!groupedAbonements[abonementIdFamily]) {
        orderedFamilyKeys.push(abonementIdFamily);
        groupedAbonements[abonementIdFamily] = {
          abonements: [],
          clients: [],
          relatives: [],
          events: [], // Инициализируем пустым, события добавятся позже
        };
      }

      const currentGroup = groupedAbonements[abonementIdFamily];
      const { client, relative, abonement } = this._extractEntities(row);

      // Добавляем уникальных клиентов
      if (client && client.client_id && !currentGroup.clients.some((c) => c.client_id === client.client_id)) {
        currentGroup.clients.push(client);
      }

      // Добавляем уникальных родственников
      if (
        relative &&
        relative.relative_id &&
        !currentGroup.relatives.some((r) => r.relative_id === relative.relative_id)
      ) {
        currentGroup.relatives.push(relative);
      }

      // Добавляем все семейные абонементы из текущей строки, если они еще не были добавлены
      // целиком как группа. Эта логика направлена на то, чтобы family_abonements из одной row
      // не дублировались, если несколько row ссылаются на один и тот же набор family_abonements.
      // Мы будем просто добавлять все family_abonements из КАЖДОЙ row, которая относится к этому ключу.
      // Повторное добавление одинаковых объектов абонементов не должно быть проблемой, если они идентичны.
      // Однако, для чистоты, можно проверять уникальность добавляемых абонементов внутри группы.
      if (Array.isArray(row.family_abonements)) {
        row.family_abonements.forEach((famAbonement) => {
          if (!currentGroup.abonements.some((a) => a.abonement_id === famAbonement.abonement_id)) {
            currentGroup.abonements.push(famAbonement);
          }
        });
      }
    });

    // Добавляем события к собранным группам
    this._addEventsToAbonements(groupedAbonements, abonementsEvents);

    // Формируем итоговый массив в порядке orderedFamilyKeys
    const result = orderedFamilyKeys.map((key) => {
      const group = groupedAbonements[key];
      return {
        ...group,
        clients: addIsFirstClientFlag(group.clients),
        relatives: addIsFirstRelativeFlag(group.relatives),
      };
    });

    return result;
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

// Вспомогательная функция для добавления is_first_client
function addIsFirstClientFlag(clients) {
  const ids = clients.map((c) => Number(c.client_id)).filter((id) => !isNaN(id));
  const firstId = ids.length ? Math.min(...ids) : null;
  return clients.map((c) => ({
    ...c,
    is_first_client: clients.length === 1 ? true : Number(c.client_id) === firstId,
  }));
}

// Вспомогательная функция для добавления is_first_relative
function addIsFirstRelativeFlag(relatives) {
  const ids = relatives.map((r) => Number(r.relative_id)).filter((id) => !isNaN(id));
  const firstId = ids.length ? Math.min(...ids) : null;
  return relatives.map((r) => ({
    ...r,
    is_first_relative: relatives.length === 1 ? true : Number(r.relative_id) === firstId,
  }));
}
