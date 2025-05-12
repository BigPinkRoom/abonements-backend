require('dotenv').config();

// node scripts/reindexFamilies.js

const mysql = require('mysql2/promise');
const { esClient } = require('../elasticsearch.client');
const searchDAL = require('../components/search/searchDAL');

async function reindexAllFamilies() {
  // const { esClient } = require('../elasticsearch.client'); // Убираем отсюда
  // const searchDAL = require('../components/search/searchDAL'); // Убираем отсюда
  let connection = null;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
    });

    const [allClientRows] = await connection.query(`SELECT client_id FROM clients ORDER BY client_id ASC`);

    console.log(`Найдено ${allClientRows.length} клиентов для обработки.`);
    let indexedFamilyCount = 0;
    const processedCanonicalFamilyIds = new Set();

    for (const { client_id: current_client_id } of allClientRows) {
      try {
        const [relativesOfCurrentClientRows] = await connection.query(
          `SELECT clrl_relative_id FROM clients_relatives WHERE clrl_client_id = ?`,
          [current_client_id]
        );
        const relativesOfCurrentClientIds = relativesOfCurrentClientRows.map((r) => r.clrl_relative_id);

        let clientsInGroupId;
        if (relativesOfCurrentClientIds.length > 0) {
          const [clientsSharingRelativesRows] = await connection.query(
            `SELECT DISTINCT clrl_client_id FROM clients_relatives WHERE clrl_relative_id IN (?)`,
            [relativesOfCurrentClientIds]
          );
          clientsInGroupId = clientsSharingRelativesRows.map((c) => c.clrl_client_id);
        } else {
          clientsInGroupId = [current_client_id];
        }
        if (clientsInGroupId.length === 0) {
          clientsInGroupId = [current_client_id];
        }

        const canonicalFamilyId = Math.min(...clientsInGroupId);

        if (current_client_id !== canonicalFamilyId || processedCanonicalFamilyIds.has(canonicalFamilyId)) {
          continue;
        }

        processedCanonicalFamilyIds.add(canonicalFamilyId);

        const [clientsDataRows] = await connection.query(`SELECT * FROM clients WHERE client_id IN (?)`, [
          clientsInGroupId,
        ]);

        let relativesWithSingleTelephone = [];
        const [allFamilyRelativeIdRows] = await connection.query(
          `SELECT DISTINCT clrl_relative_id FROM clients_relatives WHERE clrl_client_id IN (?)`,
          [clientsInGroupId]
        );
        const allFamilyDistinctRelativeIds = allFamilyRelativeIdRows.map((r) => r.clrl_relative_id);

        if (allFamilyDistinctRelativeIds.length > 0) {
          const [relativesDataRows] = await connection.query(`SELECT * FROM relatives WHERE relative_id IN (?)`, [
            allFamilyDistinctRelativeIds,
          ]);
          const [allTelephonesDataRows] = await connection.query(
            `SELECT relative_id, telephone FROM telephone_numbers WHERE relative_id IN (?) GROUP BY relative_id`,
            [allFamilyDistinctRelativeIds]
          );

          const telephoneByRelativeId = allTelephonesDataRows.reduce((acc, phone) => {
            acc[phone.relative_id] = phone.telephone; // Используем phone.telephone
            return acc;
          }, {});

          relativesWithSingleTelephone = relativesDataRows.map((relative) => ({
            ...relative,
            telephone: telephoneByRelativeId[relative.relative_id] || null,
          }));
        }

        let abonementsDataRows = [];
        if (clientsInGroupId.length > 0) {
          [abonementsDataRows] = await connection.query(
            `SELECT DISTINCT a.* 
             FROM abonements a 
             JOIN abonements_clients ac ON a.abonement_id = ac.abcl_abonement_id 
             WHERE ac.abcl_client_id IN (?)`,
            [clientsInGroupId]
          );
        }

        await searchDAL.addToIndex('families', canonicalFamilyId.toString(), {
          clients: clientsDataRows,
          relatives: relativesWithSingleTelephone,
          abonements: abonementsDataRows,
        });
        indexedFamilyCount++;
        console.log(`Семья с каноническим ID ${canonicalFamilyId} успешно проиндексирована.`);
      } catch (error) {
        console.error(`Ошибка при обработке клиента ${current_client_id} для индексации семьи:`, error);
      }
    }

    console.log(`Индексация ${indexedFamilyCount} уникальных семей завершена.`);
  } catch (error) {
    console.error('Общая ошибка при выполнении скрипта:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

reindexAllFamilies().catch(console.error);
