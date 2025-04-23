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

    const sql = `SELECT abonements.*, clients.client_id AS client_id, clients.name AS client_name, clients.surname AS client_surname, clients.patronymic AS client_patronymic, clients.birthday AS client_birthday, clients.gender AS client_gender, mydb.abonement_statuses.name AS status_type,
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

      const isNoNewClients = !familyData.family.clients.length;

      if (isNoNewClients) {
        return;
      }
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
      deleteClientRelative: `DELETE FROM clients_relatives WHERE clrl_relative_id = ?`,
      deleteClientRelationship: `DELETE FROM clients_relatives WHERE clrl_client_id = ?`,
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
      createdRelativeIds = await this._addNewRelatives(familyData, user, execute, sqlQueries, createdClientIds);

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

    // Если нет клиентов, пропускаем
    if (!clients?.length) {
      console.log('Нет клиентов для обработки');
      return;
    }

    // Находим существующего клиента для получения ID абонемента
    const existingClient = clients.find((client) => client.id);

    // Если нет существующих клиентов, значит все клиенты новые - нечего удалять
    if (!existingClient) {
      console.log('Не найдено существующих клиентов');
      return;
    }

    console.log('Поиск клиентов семьи для клиента ID:', existingClient.id);
    const [currentFamilyRows] = await execute(sqlQueries.getFamilyClients, [existingClient.id]);

    if (!currentFamilyRows?.length) {
      console.log('Не найдено клиентов для семьи');
      return;
    }

    // Получаем ID клиентов для сравнения
    const currentFamilyIds = currentFamilyRows.map((row) => row.client_id);
    console.log('Текущие ID клиентов:', currentFamilyIds);

    const newFamilyIds = clients.map((client) => Number(client.id)).filter(Boolean);
    console.log('Новые ID клиентов:', newFamilyIds);

    const clientsToDelete = currentFamilyIds.filter((id) => !newFamilyIds.includes(id));
    console.log('ID клиентов для удаления:', clientsToDelete);

    // Удаляем клиентов, которых больше нет в семье
    for (const clientId of clientsToDelete) {
      console.log('Удаление клиента ID:', clientId);

      try {
        // Сначала удаляем связь с абонементом
        console.log('Удаление связи клиента с абонементом...');
        await execute(sqlQueries.deleteAbonementClient, [clientId]);

        // Затем удаляем все связи с родственниками
        console.log('Удаление связей клиента с родственниками...');
        await execute('DELETE FROM clients_relatives WHERE clrl_client_id = ?', [clientId]);

        // И наконец, удаляем самого клиента
        console.log('Удаление записи клиента...');
        await execute(sqlQueries.deleteClient, [clientId]);

        console.log('Клиент и все его связи успешно удалены');
      } catch (error) {
        console.error('Ошибка при удалении клиента:', error);
        throw error;
      }
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
      console.log('field', field);
      const currentValue = current[field];
      const newValue = client[field];

      if (field === 'birthday') {
        return this._compareDates(currentValue, newValue);
      }

      if (field === 'gender') {
        const currentGender = currentValue;
        const newGender = newValue;

        console.log('currentGender', currentGender, 'newGender', newGender);

        return currentGender !== newGender;
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
      console.log('Обновление данных клиента. Пол:', client.gender, 'Тип:', typeof client.gender);
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

    const newClients = familyData.family.clients.filter((client) => !client.id);
    if (!newClients.length) {
      return [];
    }

    // Находим существующего клиента для получения ID абонемента
    const existingClient = familyData.family.clients.find((client) => client.id);
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
        console.log('Добавление нового клиента:', {
          surname: client.surname,
          name: client.name,
          patronymic: client.patronymic,
          gender: client.gender,
          birthday: client.birthday,
        });

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

        // Если есть существующий абонемент, связываем с ним нового клиента
        if (abonementId) {
          await execute(sqlQueries.linkClientToAbonement, [abonementId, newClientId]);
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

    if (!relatives?.length) {
      console.log('Нет родственников для обработки');
      return;
    }

    const existingClient = familyData.family.clients.find((client) => client.id);
    if (!existingClient) {
      console.log('Не найдено существующих клиентов');
      return;
    }

    console.log('Поиск родственников семьи для клиента ID:', existingClient.id);
    const [currentFamilyRows] = await execute(sqlQueries.getFamilyRelatives, [existingClient.id]);

    if (!currentFamilyRows?.length) {
      console.log('Не найдено родственников для семьи');
      return;
    }

    // Получаем список ID существующих родственников
    const currentRelativeIds = currentFamilyRows.map((row) => row.relative_id);
    console.log('Текущие ID родственников:', currentRelativeIds);

    // Получаем список ID родственников из обновленных данных
    const newRelativeIds = relatives
      .filter((relative) => relative.id)
      .map((relative) => Number(relative.id))
      .filter((id) => id && !isNaN(id));
    console.log('Новые ID родственников:', newRelativeIds);

    // Находим ID родственников, которых нужно удалить
    const relativesToDelete = currentRelativeIds.filter((id) => !newRelativeIds.includes(id));
    console.log('ID родственников для удаления:', relativesToDelete);

    // Удаляем родственников и связанные с ними данные
    for (const relativeId of relativesToDelete) {
      console.log('Удаление родственника ID:', relativeId);

      try {
        // Сначала удаляем телефоны
        console.log('Удаление телефонов родственника...');
        await execute(sqlQueries.deleteTelephone, [relativeId]);

        // Затем удаляем все связи с клиентами в таблице clients_relatives
        console.log('Удаление связей родственника с клиентами...');
        await execute('DELETE FROM clients_relatives WHERE clrl_relative_id = ?', [relativeId]);

        // И наконец, удаляем самого родственника
        console.log('Удаление записи родственника...');
        await execute(sqlQueries.deleteRelative, [relativeId]);

        console.log('Родственник и все его связи успешно удалены');
      } catch (error) {
        console.error('Ошибка при удалении родственника:', error);
        throw error;
      }
    }
  }

  async _addNewRelatives(familyData, user, execute, sqlQueries, createdClientIds = []) {
    const { relatives } = familyData.family;
    const { clients } = familyData.family;
    const createdRelativeIds = [];

    console.log('Обработка новых родственников. Получено родственников:', relatives?.length || 0);

    if (!relatives?.length) {
      console.log('Нет родственников для добавления');
      return createdRelativeIds;
    }

    // Фильтруем только новых родственников (без ID)
    const newRelatives = relatives.filter((relative) => !relative.id);
    console.log('Новых родственников для добавления:', newRelatives.length);

    if (!newRelatives.length) {
      console.log('Нет новых родственников для добавления');
      return createdRelativeIds;
    }

    // Создаем список существующих ID клиентов и недавно созданных
    const allClientIds = [...clients.filter((client) => client.id).map((client) => client.id), ...createdClientIds];
    console.log('Список ID клиентов для связи с родственниками:', allClientIds);

    for (const relative of newRelatives) {
      console.log('Добавление нового родственника:', relative.name, relative.surname);

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
      console.log('Создан новый родственник с ID:', newRelativeId);

      // Проверяем существование телефона перед добавлением
      const [existingTelephone] = await execute('SELECT telephone FROM telephone_numbers WHERE telephone = ?', [
        relative.telephone,
      ]);

      if (!existingTelephone.length) {
        await execute(sqlQueries.addTelephone, [relative.telephone, newRelativeId, user.branch]);
        console.log('Добавлен телефон для родственника:', relative.telephone);
      } else {
        console.log('Телефон уже существует в базе, пропуск добавления');
      }

      // Связываем родственника со всеми клиентами семьи
      console.log('Связывание родственника с клиентами...');
      for (const clientId of allClientIds) {
        if (clientId) {
          await execute(sqlQueries.linkClientToRelative, [clientId, newRelativeId]);
          console.log('Родственник связан с клиентом ID:', clientId);
        }
      }
    }

    console.log('Завершено добавление новых родственников. Создано:', createdRelativeIds.length);
    return createdRelativeIds;
  }
}

module.exports = new AbonementsModel();
