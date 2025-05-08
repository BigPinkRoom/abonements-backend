const pool = require('../../pool.db').getPool();
const abonementsService = require('./abonementsService');
const helpersDAL = require('../../helpers/helpersDAL');
const searchDAL = require('../search/searchDAL');

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
      throw new Error('Невозможно создать клиента без родственника');
    }

    // Если нет ни клиентов, ни родственников - также ошибка
    if (!hasClients && !hasRelatives) {
      throw new Error('Необходимо указать хотя бы одного клиента и родственника');
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

      searchDAL.addToIndex('families', {
        clients: clearClient,
        relatives: clearRelative,
        abonements: abonements,
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

      // Используем приватный метод _safeExecute, передавая poolPromise для управления транзакцией
      const execute = async (sql, params) => await this._safeExecute(sql, params, poolPromise);
      const getCurrentData = async (sql, id) => {
        const [rows] = await execute(sql, [id]);
        return rows[0];
      };

      // Гарантируем, что familyData.family.abonements — всегда массив
      if (!Array.isArray(familyData.family.abonements)) {
        familyData.family.abonements = familyData.family.abonements ? [familyData.family.abonements] : [];
      }

      // Проверяем, есть ли родственники
      const hasRelatives = familyData.family.relatives && familyData.family.relatives.length > 0;

      // Проверяем, есть ли клиенты
      const hasClients = familyData.family.clients && familyData.family.clients.length > 0;

      // Если после обновления не останется родственников, но останутся клиенты - ошибка
      if (!hasRelatives && hasClients) {
        throw new Error('Невозможно оставить клиента без родственника');
      }

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

      // Добавление новых абонементов для всех клиентов семьи (и новых, и существующих)
      const hasAbonementData =
        Array.isArray(familyData.family.abonements) &&
        familyData.family.abonements.some(
          (abonement) => abonement && (abonement.quantity || abonement.activation_date || abonement.duration)
        );

      // Собираем id всех клиентов семьи (и новых, и существующих)
      const allClientIds = [
        ...familyData.family.clients.filter((client) => client.id).map((client) => client.id),
        ...createdClientIds,
      ];
      // Удаляем дубликаты
      const uniqueClientIds = [...new Set(allClientIds.map(Number))];

      if (hasAbonementData && uniqueClientIds.length) {
        await this.addAbonementForClients(familyData.family.abonements, uniqueClientIds, user);
      }

      await connection.commit();

      // Получаем абонементы для возврата, если есть клиенты
      const abonements = uniqueClientIds.length ? await this.getAbonementsOfClient(uniqueClientIds[0]) : [];

      return {
        createdClientIds,
        createdRelativeIds,
        abonements,
      };
    } catch (error) {
      await connection.rollback();
      console.log('mysql error in updateFamily:', error);
      throw error;
    } finally {
      if (connection) pool.releaseConnection(connection); // Используем connection для release
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
      const currentValue = current[field];
      const newValue = client[field];

      if (field === 'birthday') {
        return this._compareDates(currentValue, newValue);
      }

      if (field === 'gender') {
        const currentGender = currentValue;
        const newGender = newValue;

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

      // Преобразуем undefined значения в null для SQL
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
        console.log('Добавление нового клиента:', {
          surname: client.surname,
          name: client.name,
          patronymic: client.patronymic,
          gender: client.gender,
          birthday: client.birthday,
        });

        // Преобразуем undefined значения в null для SQL
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
      // Преобразуем undefined значения в null для SQL
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
      .filter((relative) => relative.id && relative.id !== undefined)
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
    const allClientIds = [
      ...clients.filter((client) => client.id && client.id !== undefined).map((client) => client.id),
      ...createdClientIds,
    ];
    console.log('Список ID клиентов для связи с родственниками:', allClientIds);

    for (const relative of newRelatives) {
      console.log('Добавление нового родственника:', relative.name, relative.surname);

      // Преобразуем undefined значения в null для SQL
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
      console.log('Создан новый родственник с ID:', newRelativeId);

      // Проверяем существование телефона перед добавлением
      if (telephone) {
        const [existingTelephone] = await execute('SELECT telephone FROM telephone_numbers WHERE telephone = ?', [
          telephone,
        ]);

        if (!existingTelephone.length) {
          await execute(sqlQueries.addTelephone, [telephone, newRelativeId, user.branch]);
          console.log('Добавлен телефон для родственника:', telephone);
        } else {
          console.log('Телефон уже существует в базе, пропуск добавления');
        }
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
