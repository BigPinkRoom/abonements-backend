const pool = require('../../pool.db').getPool();
const abonementsService = require('./abonementsService');
const helpersDAL = require('../../helpers/helpersDAL');

class AbonementsModel {
  async getAbonementsEvents({ filters = {}, sortings = [] }) {
    const params = [];

    const sqlSorting = helpersDAL.createSortingString(sortings) || '';
    const sqlFilter = helpersDAL.createFilteringString(filters, 'mydb.abonements.date_create') || '';

    const sql = `SELECT DISTINCT mydb.abonements.abonement_id, mydb.events.*, mydb.event_types.name AS event_type
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_events ON mydb.abonements_events.abev_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.events ON mydb.events.event_id = mydb.abonements_events.abev_event_id
    LEFT JOIN mydb.event_types ON mydb.event_types.event_type_id = mydb.events.event_type_id
    WHERE mydb.events.event_id IS NOT NULL
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

  async getAbonementsWithClients({ filters = {}, sortings = [] }) {
    const params = [];

    const sqlSorting = helpersDAL.createSortingString(sortings) || '';
    const sqlFilter = helpersDAL.createFilteringString(filters, 'mydb.abonements.date_create') || '';

    const sql = `SELECT abonements.*, clients.client_id AS client_id, clients.name AS client_name, clients.surname AS client_surname, clients.patronymic AS client_patronymic, clients.birthday AS client_birthday, mydb.abonement_statuses.name AS status_type,
    relatives.relative_id,
    relatives.name AS relative_name,
    relatives.surname AS relative_surname,
    relatives.patronymic AS relative_patronymic,
    relatives.relative_type_id AS relative_type_id,
    telephone_numbers.telephone AS relative_telephone
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_clients ON mydb.abonements_clients.abcl_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.clients ON mydb.clients.client_id = mydb.abonements_clients.abcl_client_id
    LEFT JOIN mydb.abonement_statuses ON mydb.abonement_statuses.abonement_status_id = mydb.abonements.status_id
    LEFT JOIN mydb.clients_relatives ON mydb.clients_relatives.clrl_client_id = mydb.clients.client_id
    LEFT JOIN mydb.relatives ON mydb.relatives.relative_id = mydb.clients_relatives.clrl_relative_id
    LEFT JOIN mydb.telephone_numbers ON mydb.telephone_numbers.relative_id = mydb.relatives.relative_id
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

  async addFamily(familyData, user) {
    if (!familyData || !user) {
      throw new Error('Необходимые параметры не предоставлены');
    }

    if (!familyData.family || !familyData.family.clients || !familyData.family.relatives) {
      throw new Error('Некорректная структура данных семьи');
    }

    const sqlClient = `
    INSERT INTO clients (
      surname, name, patronymic, gender, birthday, date_create, user_created_id, branch_id
    ) VALUES (?, ?, ?, ?, STR_TO_DATE(?, '%d.%m.%Y'), NOW(), ?, ?)
  `;
    const sqlRelative = `
    INSERT INTO relatives (
      surname, name, patronymic, relative_type_id, date_create, user_created_id, branch_id
    ) VALUES (?, ?, ?, ?, NOW(), ?, ?);
  `;
    const sqlTelephone = `
    INSERT INTO telephone_numbers (
      telephone, relative_id, branch_id
    ) VALUES (?, ?, ?);
  `;
    const sqlClientRelative = `
    INSERT INTO clients_relatives (
      clrl_client_id, clrl_relative_id
    ) VALUES (?, ?);
  `;
    const sqlAbonement = `
    INSERT INTO abonements (
      visits_quantity, visits_left, date_create, date_start, date_end, user_created_id, status_id, branch_id
    ) VALUES (?, ?, NOW(), STR_TO_DATE(?, '%Y-%m-%d'), DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL ? DAY), ?, ?, ?);
  `;

    const sqlAbonementsClients = `
      INSERT INTO abonements_clients (
      abcl_abonement_id, abcl_client_id
    ) VALUES (?, ?);
`;

    let poolPromise = null;
    let connection = null;

    try {
      poolPromise = pool.promise();
      connection = await poolPromise.getConnection();
      await connection.beginTransaction();

      // Создаем клиентов
      const clientIds = [];
      for (const client of familyData.family.clients) {
        const clientResult = await poolPromise.execute(sqlClient, [
          client.surname,
          client.name,
          client.patronymic,
          client.gender,
          client.birthday,
          user.user_id,
          user.branch,
        ]);
        clientIds.push(clientResult[0].insertId);
      }

      // Создаем родственников и связываем их с клиентами
      const relativeIds = [];
      for (const relative of familyData.family.relatives) {
        const relativeResult = await poolPromise.execute(sqlRelative, [
          relative.surname,
          relative.name,
          relative.patronymic,
          relative.relative_type_id,
          user.user_id,
          user.branch,
        ]);

        const relativeId = relativeResult[0].insertId;
        relativeIds.push(relativeId);

        // Добавляем телефон родственника
        await poolPromise.execute(sqlTelephone, [relative.telephone, relativeId, user.branch]);

        // Связываем родственника с каждым клиентом
        for (const clientId of clientIds) {
          await poolPromise.execute(sqlClientRelative, [clientId, relativeId]);
        }
      }

      // Создаем абонемент
      const abonementResult = await poolPromise.execute(sqlAbonement, [
        familyData.family.abonements.quantity,
        familyData.family.abonements.quantity,
        familyData.family.abonements.activation_date,
        familyData.family.abonements.activation_date,
        familyData.family.abonements.duration,
        user.user_id,
        1,
        user.branch,
      ]);

      const abonementId = abonementResult[0].insertId;

      for (const clientId of clientIds) {
        await poolPromise.execute(sqlAbonementsClients, [abonementId, clientId]);
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async updateFamily(familyData, user) {
    const sqlQueries = {
      getClient: `SELECT * FROM clients WHERE client_id = ?`,
      getRelative: `SELECT * FROM relatives WHERE relative_id = ?`,
      getTelephone: `SELECT * FROM telephone_numbers WHERE relative_id = ?`,
      getAbonement: `SELECT * FROM abonements WHERE abonement_id = ?`,
      updateClient: `
        UPDATE clients 
        SET surname = ?, name = ?, patronymic = ?, gender = ?, birthday = STR_TO_DATE(?, '%d.%m.%Y')
        WHERE client_id = ?
      `,
      updateRelative: `
        UPDATE relatives 
        SET surname = ?, name = ?, patronymic = ?, relative_type_id = ?
        WHERE relative_id = ?
      `,
      updateTelephone: `
        UPDATE telephone_numbers 
        SET telephone = ?
        WHERE relative_id = ?
      `,
      addClient: `
        INSERT INTO clients (
          surname, name, patronymic, gender, birthday, date_create, user_created_id, branch_id
        ) VALUES (?, ?, ?, ?, STR_TO_DATE(?, '%d.%m.%Y'), NOW(), ?, ?)
      `,
      addRelative: `
        INSERT INTO relatives (
          surname, name, patronymic, relative_type_id, date_create, user_created_id, branch_id
        ) VALUES (?, ?, ?, ?, NOW(), ?, ?)
      `,
      addTelephone: `
        INSERT INTO telephone_numbers (
          telephone, relative_id, branch_id
        ) VALUES (?, ?, ?)
      `,
      getAbonementId: `
        SELECT DISTINCT ac.abcl_abonement_id 
        FROM abonements_clients ac 
        WHERE ac.abcl_client_id = ?
        LIMIT 1
      `,
      linkClientToAbonement: `
        INSERT INTO abonements_clients (abcl_abonement_id, abcl_client_id)
        VALUES (?, ?)
      `,
      linkClientToRelative: `
        INSERT INTO clients_relatives (clrl_client_id, clrl_relative_id)
        VALUES (?, ?)
      `,
      getFamilyClients: `
        SELECT DISTINCT c.client_id 
        FROM clients c
        JOIN abonements_clients ac ON c.client_id = ac.abcl_client_id
        WHERE ac.abcl_abonement_id = (
          SELECT abcl_abonement_id 
          FROM abonements_clients 
          WHERE abcl_client_id = ?
          LIMIT 1
        )
      `,
      getFamilyRelatives: `
        SELECT DISTINCT r.relative_id 
        FROM relatives r
        JOIN clients_relatives cr ON r.relative_id = cr.clrl_relative_id
        JOIN clients c ON c.client_id = cr.clrl_client_id
        JOIN abonements_clients ac ON ac.abcl_client_id = c.client_id
        WHERE ac.abcl_abonement_id = (
          SELECT abcl_abonement_id 
          FROM abonements_clients 
          WHERE abcl_client_id = ?
          LIMIT 1
        )
      `,
      deleteClient: `DELETE FROM clients WHERE client_id = ?`,
      deleteRelative: `DELETE FROM relatives WHERE relative_id = ?`,
      deleteTelephone: `DELETE FROM telephone_numbers WHERE relative_id = ?`,
      deleteAbonementClient: `DELETE FROM abonements_clients WHERE abcl_client_id = ?`,
      deleteClientRelative: `DELETE FROM clients_relatives WHERE clrl_client_id = ? OR clrl_relative_id = ?`,
    };

    let poolPromise = null;
    let connection = null;
    let createdClientIds = [];
    let createdRelativeIds = [];

    try {
      poolPromise = pool.promise();
      connection = await poolPromise.getConnection();
      await connection.beginTransaction();

      const execute = async (sql, params) => await poolPromise.execute(sql, params);
      const getCurrentData = async (sql, id) => {
        const [rows] = await execute(sql, [id]);
        return rows[0];
      };

      // Сначала обновляем существующих клиентов
      await this._updateExistingClients(familyData, execute, getCurrentData, sqlQueries);

      // Затем обновляем существующих родственников
      await this._updateExistingRelatives(familyData, execute, getCurrentData, sqlQueries);

      // Удаляем клиентов, которых больше нет в семье
      await this._handleClientDeletions(familyData, execute, sqlQueries);

      // Удаляем родственников, которых больше нет в семье
      await this._handleRelativeDeletions(familyData, execute, sqlQueries);

      // В конце добавляем новых клиентов
      createdClientIds = await this._addNewClients(familyData, user, execute, sqlQueries);

      // Добавляем новых родственников
      createdRelativeIds = await this._addNewRelatives(familyData, user, execute, sqlQueries);

      await connection.commit();

      return {
        createdClientIds,
        createdRelativeIds,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async _handleClientDeletions(familyData, execute, sqlQueries) {
    const { clients } = familyData.family;

    // Если нет клиентов или все клиенты новые, пропускаем
    if (!clients?.length || clients.every((client) => client.is_new)) {
      return;
    }

    // Находим существующего клиента для получения ID абонемента
    const existingClient = clients.find((client) => !client.is_new);
    const [currentFamilyRows] = await execute(sqlQueries.getFamilyClients, [existingClient.id]);

    if (!currentFamilyRows?.length) {
      return;
    }

    // Получаем ID клиентов для сравнения
    const currentFamilyIds = currentFamilyRows.map((row) => row.client_id);
    const newFamilyIds = clients.map((client) => Number(client.id)).filter(Boolean);
    const clientsToDelete = currentFamilyIds.filter((id) => !newFamilyIds.includes(id));

    // Удаляем клиентов, которых больше нет в семье
    for (const clientId of clientsToDelete) {
      await Promise.all([
        execute(sqlQueries.deleteAbonementClient, [clientId]),
        execute(sqlQueries.deleteClientRelative, [clientId]),
        execute(sqlQueries.deleteClient, [clientId]),
      ]);
    }
  }

  async _updateExistingClients(familyData, execute, getCurrentData, sqlQueries) {
    const { clients } = familyData.family;

    for (const client of clients) {
      // Пропускаем клиентов без ID
      if (!client.id) continue;

      const current = await getCurrentData(sqlQueries.getClient, client.id);
      if (!current) continue;

      // Проверяем, есть ли изменения в данных клиента
      const hasChanges = this._checkClientChanges(current, client);

      if (hasChanges) {
        await this._updateClientData(client, execute, sqlQueries);
      }
    }
  }

  _checkClientChanges(current, client) {
    return ['surname', 'name', 'patronymic', 'gender', 'birthday'].some((field) => {
      const currentValue = current[field];
      const newValue = client[field];

      if (field === 'birthday') {
        return this._compareDates(currentValue, newValue);
      }

      if (field === 'gender') {
        return Number(currentValue) !== Number(newValue);
      }

      return currentValue !== newValue;
    });
  }

  _compareDates(date1, date2) {
    // Функция для приведения даты к формату дд.мм.гггг
    const formatToDDMMYYYY = (date) => {
      if (!date) return null;

      const d = new Date(date);
      if (isNaN(d.getTime())) return null;

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      return `${day}.${month}.${year}`;
    };

    const d1 = formatToDDMMYYYY(date1);
    const d2 = formatToDDMMYYYY(date2);

    if (!d1 || !d2) return false;

    return d1 !== d2;
  }

  async _updateClientData(client, execute, sqlQueries) {
    try {
      await execute(sqlQueries.updateClient, [
        client.surname,
        client.name,
        client.patronymic,
        client.gender,
        client.birthday,
        client.id,
      ]);
    } catch (error) {
      console.error('Ошибка при обновлении клиента:', error);
      throw error;
    }
  }

  async _addNewClients(familyData, user, execute, sqlQueries) {
    if (!familyData?.family?.clients?.length) {
      return [];
    }

    const newClients = familyData.family.clients.filter((client) => client.is_new);
    if (!newClients.length) {
      return [];
    }

    const existingClient = familyData.family.clients.find((client) => !client.is_new);
    let abonementId = null;
    const createdClientIds = [];

    if (existingClient) {
      try {
        const [abonementRows] = await execute(sqlQueries.getAbonementId, [existingClient.id]);
        abonementId = abonementRows[0]?.abcl_abonement_id;
      } catch (error) {
        console.error('Ошибка при получении ID абонемента:', error);
        throw error;
      }
    }

    for (const client of newClients) {
      try {
        const [result] = await execute(sqlQueries.addClient, [
          client.surname,
          client.name,
          client.patronymic,
          client.gender,
          client.birthday,
          user.user_id,
          user.branch,
        ]);

        const newClientId = result.insertId;
        createdClientIds.push(newClientId);

        if (abonementId) {
          const [result] = await execute(sqlQueries.linkClientToAbonement, [abonementId, newClientId]);
        }
      } catch (error) {
        console.error('Ошибка при добавлении нового клиента:', error);
        throw error;
      }
    }

    return createdClientIds;
  }

  async _updateExistingRelatives(familyData, execute, getCurrentData, sqlQueries) {
    const { relatives } = familyData.family;

    for (const relative of relatives) {
      if (!relative.id) continue;

      const current = await getCurrentData(sqlQueries.getRelative, relative.id);
      if (!current) continue;

      const hasChanges = this._checkRelativeChanges(current, relative);

      if (hasChanges) {
        await this._updateRelativeData(relative, execute, sqlQueries);
      }

      // Обновляем телефон родственника
      const currentTelephone = await getCurrentData(sqlQueries.getTelephone, relative.id);
      if (currentTelephone && currentTelephone.telephone !== relative.telephone) {
        await execute(sqlQueries.updateTelephone, [relative.telephone, relative.id]);
      }
    }
  }

  _checkRelativeChanges(current, relative) {
    return ['surname', 'name', 'patronymic', 'relative_type_id'].some((field) => current[field] !== relative[field]);
  }

  async _updateRelativeData(relative, execute, sqlQueries) {
    try {
      await execute(sqlQueries.updateRelative, [
        relative.surname,
        relative.name,
        relative.patronymic,
        relative.relative_type_id,
        relative.id,
      ]);
    } catch (error) {
      console.error('Ошибка при обновлении родственника:', error);
      throw error;
    }
  }

  async _handleRelativeDeletions(familyData, execute, sqlQueries) {
    const { relatives } = familyData.family;

    if (!relatives?.length || relatives.every((relative) => relative.is_new)) {
      return;
    }

    const existingRelative = relatives.find((relative) => !relative.is_new);
    if (!existingRelative) return;

    const [currentFamilyRows] = await execute(sqlQueries.getFamilyRelatives, [existingRelative.id]);

    if (!currentFamilyRows?.length) {
      return;
    }

    // Получаем список ID существующих родственников
    const currentRelativeIds = currentFamilyRows.map((row) => row.relative_id);

    // Получаем список ID родственников из обновленных данных
    const newRelativeIds = relatives
      .filter((relative) => !relative.is_new)
      .map((relative) => Number(relative.id))
      .filter((id) => id && !isNaN(id)); // Улучшенная фильтрация ID

    // Находим ID родственников, которых нужно удалить
    const relativesToDelete = currentRelativeIds.filter((id) => !newRelativeIds.includes(id));

    // Удаляем родственников и связанные с ними данные
    for (const relativeId of relativesToDelete) {
      await Promise.all([
        execute(sqlQueries.deleteTelephone, [relativeId]),
        execute(sqlQueries.deleteClientRelative, [null, relativeId]),
        execute(sqlQueries.deleteRelative, [relativeId]),
      ]);
    }
  }

  async _addNewRelatives(familyData, user, execute, sqlQueries) {
    const { relatives } = familyData.family;
    const { clients } = familyData.family;
    const createdRelativeIds = [];

    for (const relative of relatives) {
      if (!relative.is_new) continue;

      const [result] = await execute(sqlQueries.addRelative, [
        relative.surname,
        relative.name,
        relative.patronymic,
        relative.relative_type_id,
        user.user_id,
        user.branch,
      ]);

      const newRelativeId = result.insertId;
      createdRelativeIds.push(newRelativeId);

      // Проверяем существование телефона перед добавлением
      const [existingTelephone] = await execute('SELECT telephone FROM telephone_numbers WHERE telephone = ?', [
        relative.telephone,
      ]);

      if (!existingTelephone.length) {
        await execute(sqlQueries.addTelephone, [relative.telephone, newRelativeId, user.branch]);
      }

      // Связываем родственника со всеми клиентами семьи
      for (const client of clients) {
        const clientId = client.is_new ? client.id : client.id;
        if (clientId) {
          await execute(sqlQueries.linkClientToRelative, [clientId, newRelativeId]);
        }
      }
    }

    return createdRelativeIds;
  }
}

module.exports = new AbonementsModel();
