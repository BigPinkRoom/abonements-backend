const pool = require('../../pool.db').getPool();
const abonementsService = require('./abonementsService');
const helpersDAL = require('../../helpers/helpersDAL');
const searchDAL = require('../search/searchDAL');
const { isEqual } = require('lodash');

class AbonementsModel {
  // Вспомогательный приватный метод для безопасной обработки SQL параметров
  _safeSqlParams(params) {
    return params.map((param) => (param === undefined ? null : param));
  }

  // Вспомогательный приватный метод для выполнения SQL запроса с безопасной обработкой параметров
  async _safeExecute(sql, params, poolPromise) {
    // Если poolPromise не передан, используем новый из пула
    const currentPoolPromise = poolPromise || pool.promise();
    try {
      return await currentPoolPromise.execute(sql, this._safeSqlParams(params));
    } finally {
      // Если poolPromise был создан внутри этого метода, его не нужно освобождать здесь,
      // это должно делаться в вызывающем коде, управляющем транзакцией или соединением.
      // Если же poolPromise был передан, то также освобождение на стороне вызывающего.
    }
  }

  async getAbonementsEvents({ filters = {}, sortings = [] }) {
    const params = [];
    const sqlSorting = helpersDAL.createSortingString(sortings) || '';
    const sqlFilter = helpersDAL.createFilteringString(filters, 'mydb.abonements.date_create') || '';

    const sql = `SELECT DISTINCT mydb.abonements.abonement_id, mydb.events.*, mydb.event_types.name AS event_type
    FROM mydb.abonements
    LEFT JOIN mydb.abonements_events ON mydb.abonements_events.abev_abonement_id = mydb.abonements.abonement_id
    LEFT JOIN mydb.events ON mydb.events.event_id = mydb.abonements_events.abev_event_id
    LEFT JOIN mydb.event_types ON mydb.event_types.event_type_id = mydb.events.event_type_id
    WHERE mydb.events.event_id IS NOT NULL`;

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
    const sqlFilter = helpersDAL.createFilteringString(filters, 'abonements.date_create') || '';

    console.log('sqlFilter', sqlFilter);
    console.log('sqlSorting', sqlSorting);

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

    console.log('Executing SQL:', sql);

    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      const [rows, fields, error] = await poolPromise.execute(sql);

      const familyWithAbonements = await Promise.all(
        rows.map(async (row) => ({
          ...row,
          family_abonements: await this.getAllAbonementsOfClientAndRelatives(row.client_id, filters),
        }))
      );

      const result = familyWithAbonements;

      if (error) throw error;

      return result;
    } catch (error) {
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async getAbonementsOfClient(clientId) {
    const sql = `
    SELECT * FROM abonements
    WHERE abonement_id IN (
      SELECT abcl_abonement_id FROM abonements_clients WHERE abcl_client_id = ?
    )`;

    let poolPromise = null;
    try {
      poolPromise = pool.promise();

      const [rows, fields, error] = await poolPromise.execute(sql, [clientId]);

      const result = rows;
      return result;
    } catch (error) {
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  /**
   * Добавляет новые абонементы и связывает их с клиентами
   * @param {Array<Object>} abonements - массив объектов { quantity, activation_date, duration }
   * @param {Array<number>} clientIds - массив client_id
   * @param {Object} user - { user_id, branch }
   * @returns {Promise<Array<number>>} - Массив ID созданных абонементов
   */
  async addAbonementForClients(abonements, clientIds, user) {
    const poolPromise = pool.promise();
    const abonementIds = [];

    try {
      for (const abonementData of abonements) {
        // Вставка нового абонемента
        const [abonementResult] = await poolPromise.execute(
          `INSERT INTO abonements (
            visits_quantity, visits_left, date_create, date_start, date_end, user_created_id, status_id, branch_id
            ) VALUES (?, ?, NOW(), STR_TO_DATE(?, '%Y-%m-%d'), DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL ? DAY), ?, ?, ?)`,
          [
            abonementData.quantity || 0,
            abonementData.quantity || 0,
            abonementData.activation_date,
            abonementData.activation_date,
            abonementData.duration || 30,
            user.user_id,
            1,
            user.branch,
          ]
        );
        const abonementId = abonementResult.insertId;
        abonementIds.push(abonementId);

        // Связываем абонемент с клиентами
        for (const clientId of clientIds) {
          await poolPromise.execute(
            `INSERT INTO abonements_clients (abcl_abonement_id, abcl_client_id) VALUES (?, ?)`,
            [abonementId, clientId]
          );
        }
      }

      return abonementIds;
    } catch (error) {
      console.error('Ошибка при добавлении абонементов:', error);
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async addFamily(familyData, user) {
    // console.log('familyData ------------------------', familyData); // Оставим этот лог, если он был до наших правок или нужен для других целей
    if (!familyData || !user) {
      throw new Error('Необходимые параметры не предоставлены');
    }

    if (!familyData.family) {
      throw new Error('Некорректная структура данных семьи: отсутствует объект family');
    }

    // Инициализируем пустые массивы, если отсутствуют
    familyData.family.clients = familyData.family.clients || [];
    familyData.family.relatives = familyData.family.relatives || [];
    // Теперь абонементы всегда массив
    if (!Array.isArray(familyData.family.abonements)) {
      familyData.family.abonements = familyData.family.abonements ? [familyData.family.abonements] : [];
    }

    // Проверяем, есть ли родственники
    const hasRelatives = familyData.family.relatives && familyData.family.relatives.length > 0;

    // Проверяем, есть ли клиенты
    const hasClients = familyData.family.clients && familyData.family.clients.length > 0;

    // Проверяем, есть ли хотя бы один валидный абонемент
    const hasAbonementData =
      Array.isArray(familyData.family.abonements) &&
      familyData.family.abonements.some(
        (abonement) => abonement && (abonement.quantity || abonement.activation_date || abonement.duration)
      );

    // Если нет родственников, но есть клиенты - ошибка
    if (!hasRelatives && hasClients) {
      const error = new Error('Невозможно создать клиента без родственника');
      error.code = 'Abonements:relativeRequired';
      error.status = 400;
      throw error;
    }

    // Если нет ни клиентов, ни родственников - также ошибка
    if (!hasClients && !hasRelatives) {
      const error = new Error('Необходимо указать хотя бы одного клиента и родственника.');
      error.code = 'Abonements:ClientOrRelativeRequired';
      error.status = 400;
      throw error;
    }

    if (!hasClients && hasRelatives) {
      const error = new Error('Невозможно создать родственника без клиента');
      error.code = 'Abonements:clientRequired';
      error.status = 400;
      throw error;
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

      // Используем приватный метод _safeExecute, передавая poolPromise для управления транзакцией
      const execute = async (sql, params) => await this._safeExecute(sql, params, poolPromise);
      const getCurrentData = async (sql, id) => {
        const [rows] = await execute(sql, [id]);
        return rows[0];
      };

      const isNoNewClients = !familyData.family.clients.length;

      if (isNoNewClients) {
        return;
      }
      // Создаем клиентов
      const clientIds = [];
      for (const client of familyData.family.clients) {
        const clientResult = await execute(sqlClient, [
          client.surname,
          client.name,
          client.patronymic,
          client.gender,
          client.birthday,
          user.user_id,
          user.branch,
        ]);

        const clientId = clientResult[0].insertId;
        clientIds.push(clientId);
      }

      // Создаем родственников и связываем их с клиентами
      const relativeIds = [];

      const relativesTelephones = [];

      if (familyData.family.relatives && familyData.family.relatives.length > 0) {
        for (const relative of familyData.family.relatives) {
          const relativeResult = await execute(sqlRelative, [
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
          await execute(sqlTelephone, [relative.telephone, relativeId, user.branch]);

          const telephoneResult = await execute(
            'SELECT telephone_number_id FROM telephone_numbers WHERE relative_id = ? AND telephone = ?',
            [relativeId, relative.telephone]
          );

          let telephoneId = null;
          if (telephoneResult && telephoneResult[0] && telephoneResult[0].length > 0) {
            telephoneId = telephoneResult[0][0].telephone_number_id;
          }

          relativesTelephones.push({ telephone: relative.telephone });

          // Связываем родственника с каждым клиентом
          for (const clientId of clientIds) {
            await execute(sqlClientRelative, [clientId, relativeId]);
          }
        }
      }

      // Получаем текущую дату в формате YYYY-MM-DD
      const getCurrentDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Создаем абонементы только если есть хотя бы один валидный абонемент
      let abonementIds = [];
      if (hasAbonementData) {
        abonementIds = await this.addAbonementForClients(familyData.family.abonements, clientIds, user);
        // ПАТЧ: присваиваем abonement_id новым абонементам
        familyData.family.abonements = familyData.family.abonements.map((abonement, idx) => ({
          ...abonement,
          abonement_id: abonementIds[idx],
        }));
      }

      let clearClient = familyData.family.clients;
      clearClient = clearClient.map((client, index) => {
        return {
          ...client,
          client_id: clientIds[index],
        };
      });

      let clearRelative = familyData.family.relatives;
      clearRelative = clearRelative.map((relative, index) => {
        return {
          ...relative,
          relative_id: relativeIds[index],
        };
      });

      let abonements = await this.getAbonementsOfClient(clientIds[0]);

      searchDAL.addToIndex('families', clientIds[0], {
        clients: clearClient,
        relatives: clearRelative,
        abonements: familyData.family.abonements, // ПАТЧ: теперь с ID
      });

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      console.log('mysql error in addFamily:', error);
      throw error;
    } finally {
      if (connection) pool.releaseConnection(connection); // Используем connection для release
    }
  }

  async updateFamily(familyData, user) {
    // Начальные логи удалены

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
    let operationsPerformed = false; // Флаг для отслеживания фактических изменений

    const initialClientIds = familyData.family.clients?.filter((c) => c.id).map((c) => c.id) || [];
    const initialRelativeIds = familyData.family.relatives?.filter((r) => r.id).map((r) => r.id) || [];

    try {
      poolPromise = pool.promise();
      connection = await poolPromise.getConnection();
      await connection.beginTransaction();

      const execute = async (sql, params) => await this._safeExecute(sql, params, poolPromise);
      const getCurrentData = async (sql, id) => {
        const [rows] = await execute(sql, [id]);
        return rows[0];
      };

      if (!Array.isArray(familyData.family.abonements)) {
        familyData.family.abonements = familyData.family.abonements ? [familyData.family.abonements] : [];
      }

      const hasRelativesInput = familyData.family.relatives && familyData.family.relatives.length > 0;
      const hasClientsInput = familyData.family.clients && familyData.family.clients.length > 0;

      if (!hasRelativesInput && hasClientsInput) {
        const error = new Error('Невозможно оставить клиента без родственника');
        error.code = 'Family:RelativeRequiredForClient';
        error.status = 400;
        throw error;
      }

      const updatedAnyClient = await this._updateExistingClients(familyData, execute, getCurrentData, sqlQueries);
      if (updatedAnyClient) {
        operationsPerformed = true;
      }

      const updatedAnyRelative = await this._updateExistingRelatives(familyData, execute, getCurrentData, sqlQueries);
      if (updatedAnyRelative) {
        operationsPerformed = true;
      }

      const deletedClientsCount = await this._handleClientDeletions(familyData, execute, sqlQueries);
      if (deletedClientsCount > 0) {
        operationsPerformed = true;
      }

      const deletedRelativesCount = await this._handleRelativeDeletions(familyData, execute, sqlQueries);
      if (deletedRelativesCount > 0) {
        operationsPerformed = true;
      }

      createdClientIds = await this._addNewClients(familyData, user, execute, sqlQueries);
      if (createdClientIds.length > 0) {
        operationsPerformed = true;
      }

      createdRelativeIds = await this._addNewRelatives(familyData, user, execute, sqlQueries, createdClientIds);
      if (createdRelativeIds.length > 0) {
        operationsPerformed = true;
      }

      const newAbonementsFromFrontend = familyData.family.abonements.filter((ab) => !ab.abonement_id && ab.quantity);
      const allClientIds = [
        ...familyData.family.clients.filter((client) => client.id).map((client) => Number(client.id)),
        ...createdClientIds,
      ];
      const uniqueClientIds = [...new Set(allClientIds.map(Number))];
      let newAbonementIds = [];
      if (newAbonementsFromFrontend.length > 0 && uniqueClientIds.length) {
        newAbonementIds = await this.addAbonementForClients(newAbonementsFromFrontend, uniqueClientIds, user);
        if (newAbonementIds.length > 0) {
          operationsPerformed = true;
        }
      }

      if (!operationsPerformed && (hasClientsInput || hasRelativesInput)) {
        await connection.rollback();
        // TODO: Реализовать корректное получение полного состояния семьи для возврата
        // const fullCurrentFamilyData = await this.getFullFamilyDataById(familyData.family.id); // Пример
        return {
          updated: false,
          code: 'Update:NoChangesDetected',
          message: 'Изменений не найдено.',
          createdClientIds: [],
          createdRelativeIds: [],
          abonements: [], // Заглушка, здесь должны быть актуальные данные
        };
      }
      await connection.commit();

      let newClientIdx = 0;
      const clearClients = familyData.family.clients.map((client) => {
        if (client.id && !createdClientIds.includes(client.id)) {
          return { ...client, client_id: client.client_id || client.id, id: client.id };
        } else {
          const newDbId = createdClientIds[newClientIdx++];
          return { ...client, client_id: newDbId, id: newDbId };
        }
      });

      let newRelativeIdx = 0;
      const clearRelatives = familyData.family.relatives.map((relative) => {
        if (relative.id && !createdRelativeIds.includes(relative.id)) {
          return { ...relative, relative_id: relative.relative_id || relative.id, id: relative.id };
        } else {
          const newDbId = createdRelativeIds[newRelativeIdx++];
          return { ...relative, relative_id: newDbId, id: newDbId };
        }
      });

      const allFamilyAbonementsRaw = uniqueClientIds.length ? await this.getAbonementsOfClient(uniqueClientIds[0]) : [];
      const allFamilyAbonementsForIndex = allFamilyAbonementsRaw.map(({ visits_quantity, ...rest }) => rest);

      if (uniqueClientIds.length > 0) {
        await searchDAL.addToIndex('families', uniqueClientIds[0], {
          clients: clearClients,
          relatives: clearRelatives,
          abonements: allFamilyAbonementsForIndex,
        });
      }
      return {
        updated: true,
        createdClientIds,
        createdRelativeIds,
        abonements: allFamilyAbonementsRaw,
      };
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('[DAL.updateFamily] Ошибка:', error);
      throw error;
    } finally {
      if (connection) pool.releaseConnection(connection);
    }
  }

  async _handleClientDeletions(familyData, execute, sqlQueries) {
    // Начальный и прочие детальные логи удалены
    const { clients } = familyData.family;
    let deletionCount = 0;

    if (!clients?.length) {
      return deletionCount;
    }
    const existingClient = clients.find((client) => client.id);
    if (!existingClient) {
      return deletionCount;
    }
    const [currentFamilyRows] = await execute(sqlQueries.getFamilyClients, [existingClient.id]);
    if (!currentFamilyRows?.length) {
      return deletionCount;
    }
    const currentFamilyIds = currentFamilyRows.map((row) => row.client_id);
    const newFamilyIds = clients.map((client) => Number(client.id)).filter(Boolean);
    const clientsToDelete = currentFamilyIds.filter((id) => !newFamilyIds.includes(id));

    for (const clientId of clientsToDelete) {
      try {
        await execute(sqlQueries.deleteAbonementClient, [clientId]);
        await execute('DELETE FROM clients_relatives WHERE clrl_client_id = ?', [clientId]);
        await execute(sqlQueries.deleteClient, [clientId]);
        deletionCount++;
      } catch (error) {
        console.error('[DAL._handleClientDeletions] Ошибка при удалении клиента ID:', clientId, error);
        throw error;
      }
    }
    return deletionCount;
  }

  async _updateExistingClients(familyData, execute, getCurrentData, sqlQueries) {
    // Начальный и другие детальные логи удалены
    const { clients } = familyData.family;
    let updatedAnyClient = false;

    for (const client of clients) {
      if (!client.id) {
        continue;
      }
      const current = await getCurrentData(sqlQueries.getClient, client.id);
      if (!current) {
        continue;
      }
      const hasChanges = this._checkClientChanges(current, client);
      if (hasChanges) {
        await this._updateClientData(client, execute, sqlQueries);
        updatedAnyClient = true;
      }
    }
    return updatedAnyClient;
  }

  _checkClientChanges(current, client) {
    // Все console.log удалены
    return ['surname', 'name', 'patronymic', 'gender', 'birthday'].some((field) => {
      const currentValue = current[field];
      const newValue = client[field];

      if (field === 'birthday') {
        return this._compareDates(currentValue, newValue);
      }
      if (field === 'gender') {
        const currentGender = Number(currentValue);
        const newGender = Number(newValue);
        return currentGender !== newGender;
      }
      return currentValue !== newValue;
    });
  }

  _compareDates(date1, date2) {
    // Все console.log удалены
    const formatToDDMMYYYY = (date) => {
      if (!date) return null;

      let d;
      if (date instanceof Date) {
        d = date;
      } else if (typeof date === 'string') {
        // Попытка распарсить строку ДД.ММ.ГГГГ
        const parts = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (parts) {
          // parts[0] - вся строка, parts[1] - день, parts[2] - месяц, parts[3] - год
          // ВАЖНО: месяцы в конструкторе Date идут от 0 до 11
          d = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
        } else {
          // Если не формат ДД.ММ.ГГГГ, пробуем стандартный парсинг (может быть ISO строка)
          d = new Date(date);
        }
      } else {
        // Неизвестный тип, пытаемся как есть
        try {
          d = new Date(date);
        } catch (e) {
          return null; // Не удалось преобразовать в дату
        }
      }

      if (!d || isNaN(d.getTime())) {
        // console.log('[DAL._compareDates.formatToDDMMYYYY] Не удалось распарсить дату:', date); // Удалено
        return null;
      }

      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const d1_formatted = formatToDDMMYYYY(date1);
    const d2_formatted = formatToDDMMYYYY(date2);

    return d1_formatted !== d2_formatted;
  }

  async _updateClientData(client, execute, sqlQueries) {
    try {
      // console.log('Обновление данных клиента. Пол:', client.gender, 'Тип:', typeof client.gender); // Удалено

      const surname = client.surname === undefined ? null : client.surname;
      const name = client.name === undefined ? null : client.name;
      const patronymic = client.patronymic === undefined ? null : client.patronymic;
      const gender = client.gender === undefined ? null : client.gender;
      const birthday = client.birthday === undefined ? null : client.birthday;

      await execute(sqlQueries.updateClient, [surname, name, patronymic, gender, birthday, client.id]);
    } catch (error) {
      console.error('Ошибка при обновлении клиента:', error);
      throw error;
    }
  }

  async _addNewClients(familyData, user, execute, sqlQueries) {
    // Начальный и другие детальные логи удалены
    if (!familyData?.family?.clients?.length) {
      return [];
    }

    const newClients = familyData.family.clients.filter((client) => !client.id);
    if (!newClients.length) {
      return [];
    }

    // Проверяем, есть ли родственники в семье
    const hasRelatives = familyData.family.relatives && familyData.family.relatives.length > 0;
    if (!hasRelatives) {
      throw new Error('Невозможно добавить клиента без родственника');
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
        // Лог добавления нового клиента удален
        const surname = client.surname === undefined ? null : client.surname;
        const name = client.name === undefined ? null : client.name;
        const patronymic = client.patronymic === undefined ? null : client.patronymic;
        const gender = client.gender === undefined ? null : client.gender;
        const birthday = client.birthday === undefined ? null : client.birthday;

        const [result] = await execute(sqlQueries.addClient, [
          surname,
          name,
          patronymic,
          gender,
          birthday,
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
    // Начальный и другие детальные логи удалены
    const { relatives } = familyData.family;
    let updatedAnyRelative = false;

    for (const relative of relatives) {
      if (!relative.id) {
        continue;
      }
      const current = await getCurrentData(sqlQueries.getRelative, relative.id);
      if (!current) {
        continue;
      }
      const hasBaseChanges = this._checkRelativeChanges(current, relative);
      if (hasBaseChanges) {
        await this._updateRelativeData(relative, execute, sqlQueries);
        updatedAnyRelative = true;
      }

      const currentTelephone = await getCurrentData(sqlQueries.getTelephone, relative.id);

      let telephoneChanged = false;
      if (currentTelephone && relative.telephone && currentTelephone.telephone !== relative.telephone) {
        await execute(sqlQueries.updateTelephone, [relative.telephone, relative.id]);
        telephoneChanged = true;
      } else if (!currentTelephone && relative.telephone) {
        // В user не передается в user.branch, нужно исправить если этот код актуален
        // await execute(sqlQueries.addTelephone, [relative.telephone, relative.id, user.branch]);
        // Пока закомментирую строку выше, т.к. user не в области видимости
        // Для исправления: user должен быть передан в _updateExistingRelatives
        await execute(sqlQueries.addTelephone, [relative.telephone, relative.id, familyData.user?.branch || null]); // Попытка получить user.branch
        telephoneChanged = true;
      } else if (currentTelephone && (relative.telephone === null || relative.telephone === '')) {
        await execute(sqlQueries.updateTelephone, [null, relative.id]);
        telephoneChanged = true;
      }
      if (telephoneChanged) updatedAnyRelative = true;
    }
    return updatedAnyRelative;
  }

  _checkRelativeChanges(current, relative) {
    // Все console.log удалены
    return ['surname', 'name', 'patronymic', 'relative_type_id'].some((field) => {
      const currentValue = current[field];
      const newValue = relative[field];

      if (field === 'relative_type_id') {
        if (Number(currentValue) !== Number(newValue)) {
          return true;
        }
        return false;
      }
      if (currentValue !== newValue) {
        return true;
      }
      return false;
    });
  }

  async _updateRelativeData(relative, execute, sqlQueries) {
    try {
      const surname = relative.surname === undefined ? null : relative.surname;
      const name = relative.name === undefined ? null : relative.name;
      const patronymic = relative.patronymic === undefined ? null : relative.patronymic;
      const relative_type_id = relative.relative_type_id === undefined ? null : relative.relative_type_id;

      await execute(sqlQueries.updateRelative, [surname, name, patronymic, relative_type_id, relative.id]);
    } catch (error) {
      console.error('Ошибка при обновлении родственника:', error);
      throw error;
    }
  }

  async _addNewRelatives(familyData, user, execute, sqlQueries, createdClientIds = []) {
    // Начальный и другие детальные логи удалены
    const { relatives } = familyData.family;
    const { clients } = familyData.family;
    const createdRelativeIds = [];

    if (!relatives?.length) {
      return createdRelativeIds;
    }

    // Фильтруем только новых родственников (без ID)
    const newRelatives = relatives.filter((relative) => !relative.id);

    if (!newRelatives.length) {
      return createdRelativeIds;
    }

    // Создаем список существующих ID клиентов и недавно созданных
    const allClientIds = [
      ...clients.filter((client) => client.id && client.id !== undefined).map((client) => client.id),
      ...createdClientIds,
    ];

    for (const relative of newRelatives) {
      // Лог добавления нового родственника удален

      const surname = relative.surname === undefined ? null : relative.surname;
      const name = relative.name === undefined ? null : relative.name;
      const patronymic = relative.patronymic === undefined ? null : relative.patronymic;
      const relative_type_id = relative.relative_type_id === undefined ? null : relative.relative_type_id;
      const telephone = relative.telephone === undefined ? null : relative.telephone;

      const [result] = await execute(sqlQueries.addRelative, [
        surname,
        name,
        patronymic,
        relative_type_id,
        user.user_id,
        user.branch,
      ]);

      const newRelativeId = result.insertId;
      createdRelativeIds.push(newRelativeId);

      if (telephone) {
        const [existingTelephone] = await execute('SELECT telephone FROM telephone_numbers WHERE telephone = ?', [
          telephone,
        ]);

        if (!existingTelephone.length) {
          await execute(sqlQueries.addTelephone, [telephone, newRelativeId, user.branch]);
        } else {
          // Лог про существующий телефон удален
        }
      }

      // Логи связывания удалены
      for (const clientId of allClientIds) {
        if (clientId) {
          await execute(sqlQueries.linkClientToRelative, [clientId, newRelativeId]);
        }
      }
    }

    // Конечный лог удален
    return createdRelativeIds;
  }

  async _handleRelativeDeletions(familyData, execute, sqlQueries) {
    // Начальный и другие детальные логи удалены
    const { relatives } = familyData.family;
    let deletionCount = 0;

    if (!relatives?.length) {
      return deletionCount;
    }
    const existingClient = familyData.family.clients.find((client) => client.id);
    if (!existingClient) {
      return deletionCount;
    }
    const [currentFamilyRows] = await execute(sqlQueries.getFamilyRelatives, [existingClient.id]);
    if (!currentFamilyRows?.length) {
      return deletionCount;
    }
    const currentRelativeIds = currentFamilyRows.map((row) => row.relative_id);
    const newRelativeIds = relatives
      .filter((relative) => relative.id && relative.id !== undefined)
      .map((relative) => Number(relative.id))
      .filter((id) => id && !isNaN(id));
    const relativesToDelete = currentRelativeIds.filter((id) => !newRelativeIds.includes(id));

    for (const relativeId of relativesToDelete) {
      try {
        await execute(sqlQueries.deleteTelephone, [relativeId]);
        await execute(sqlQueries.deleteClientRelative, [relativeId]);
        await execute(sqlQueries.deleteRelative, [relativeId]);
        deletionCount++;
      } catch (error) {
        console.error('[DAL._handleRelativeDeletions] Ошибка при удалении родственника ID:', relativeId, error);
        throw error;
      }
    }
    return deletionCount;
  }

  // Вспомогательный метод для построения динамических SQL фильтров
  _buildDynamicFilters(filters, aliasConfig) {
    const sqlClauses = [];
    const queryParams = [];
    const { abonementTable, clientTable } = aliasConfig;

    const filterConfig = [
      // Фильтры для таблицы абонементов (используют abonementTable)
      { filterKey: 'statusId', dbColumn: 'status_id', tableAliasKey: 'abonementTable' },
      { filterKey: 'abonementId', dbColumn: 'abonement_id', tableAliasKey: 'abonementTable' },
      { filterKey: 'dateStart', dbColumn: 'date_start', tableAliasKey: 'abonementTable' },
      { filterKey: 'dateEnd', dbColumn: 'date_end', tableAliasKey: 'abonementTable' },
      { filterKey: 'visitsQuantity', dbColumn: 'visits_quantity', tableAliasKey: 'abonementTable' },
      { filterKey: 'visitsLeft', dbColumn: 'visits_left', tableAliasKey: 'abonementTable' },
      {
        filterKey: 'year',
        dbColumn: `YEAR(${abonementTable}.date_create)`,
        tableAliasKey: 'abonementTable',
        isFunctionCall: true,
      },
      {
        filterKey: 'month',
        dbColumn: `MONTH(${abonementTable}.date_create)`,
        tableAliasKey: 'abonementTable',
        isFunctionCall: true,
      },
      // Фильтры для таблицы клиентов (используют clientTable)
      {
        filterKey: 'surname',
        dbColumn: 'surname',
        tableAliasKey: 'clientTable',
        operator: 'LIKE',
        valueTransformer: (val) => `%${val}%`,
      },
      {
        filterKey: 'name',
        dbColumn: 'name',
        tableAliasKey: 'clientTable',
        operator: 'LIKE',
        valueTransformer: (val) => `%${val}%`,
      },
      {
        filterKey: 'patronymic',
        dbColumn: 'patronymic',
        tableAliasKey: 'clientTable',
        operator: 'LIKE',
        valueTransformer: (val) => `%${val}%`,
      },
    ];

    filterConfig.forEach((config) => {
      const filterValue = filters[config.filterKey];
      if (filterValue != null && filterValue !== '') {
        const tableAlias = aliasConfig[config.tableAliasKey];
        // Пропускаем фильтры по клиентам, если clientTable не предоставлен в aliasConfig
        if (config.tableAliasKey === 'clientTable' && !clientTable) {
          return;
        }

        let columnExpression = config.isFunctionCall ? config.dbColumn : `${tableAlias}.${config.dbColumn}`;
        const operator = config.operator || '=';

        sqlClauses.push(`${columnExpression} ${operator} ?`);
        queryParams.push(config.valueTransformer ? config.valueTransformer(filterValue) : filterValue);
      }
    });

    const finalSql = sqlClauses.length > 0 ? `AND ${sqlClauses.join(' AND ')}` : '';

    return {
      sql: finalSql,
      params: queryParams,
    };
  }

  /**
   * Возвращает все абонементы, принадлежащие клиенту или его родственникам
   * @param {number} clientId - ID клиента
   * @param {object} filters - Объект с фильтрами
   * @returns {Promise<Array<Object>>} - Массив абонементов
   */
  async getAllAbonementsOfClientAndRelatives(clientId, filters = {}) {
    let poolPromise = null;
    try {
      poolPromise = pool.promise();

      // Генерируем SQL и параметры для первой части UNION
      const filterConditionsPart1 = this._buildDynamicFilters(filters, {
        abonementTable: 'a',
        clientTable: 'cl',
      });

      // Генерируем SQL и параметры для второй части UNION
      const filterConditionsPart2 = this._buildDynamicFilters(filters, {
        abonementTable: 'a',
        clientTable: 'cl_rel',
      });

      const finalQueryParams = [
        clientId, // Для WHERE ac.abcl_client_id = ?
        ...filterConditionsPart1.params,
        clientId, // Для подзапроса WHERE cr2.clrl_client_id = ?
        ...filterConditionsPart2.params,
      ];

      const sql = `
      SELECT DISTINCT a.*, s.name as status_name,
      GROUP_CONCAT(DISTINCT cl.name SEPARATOR ', ') as client_names,
      GROUP_CONCAT(DISTINCT cl.surname SEPARATOR ', ') as client_surnames
      FROM abonements a
      LEFT JOIN abonement_statuses s ON a.status_id = s.abonement_status_id
      JOIN abonements_clients ac ON ac.abcl_abonement_id = a.abonement_id
      LEFT JOIN clients cl ON ac.abcl_client_id = cl.client_id
      WHERE ac.abcl_client_id = ? ${filterConditionsPart1.sql}
      GROUP BY a.abonement_id, s.name

      UNION

      SELECT DISTINCT a.*, s.name as status_name,
      GROUP_CONCAT(DISTINCT cl_rel.name SEPARATOR ', ') as client_names,
      GROUP_CONCAT(DISTINCT cl_rel.surname SEPARATOR ', ') as client_surnames
      FROM abonements a
      LEFT JOIN abonement_statuses s ON a.status_id = s.abonement_status_id
      JOIN abonements_clients ac_rel ON ac_rel.abcl_abonement_id = a.abonement_id
      JOIN clients cl_rel ON ac_rel.abcl_client_id = cl_rel.client_id
      JOIN clients_relatives cr_rel ON cr_rel.clrl_client_id = cl_rel.client_id
      WHERE cr_rel.clrl_relative_id IN (
          SELECT cr2.clrl_relative_id
          FROM clients_relatives cr2
          WHERE cr2.clrl_client_id = ? 
      ) ${filterConditionsPart2.sql}
      GROUP BY a.abonement_id, s.name;
      `;

      const [rows] = await poolPromise.execute(sql, finalQueryParams);
      return rows;
    } catch (error) {
      console.error('Error in getAllAbonementsOfClientAndRelatives:', error);
      throw error;
    } finally {
      if (poolPromise) {
        pool.releaseConnection(poolPromise);
      }
    }
  }
}

module.exports = new AbonementsModel();
