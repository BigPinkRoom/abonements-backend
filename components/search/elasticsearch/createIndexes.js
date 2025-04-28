const { esClient } = require('./elasticsearch.client');

console.log('es client', esClient);

async function createIndexIfNotExists(indexName, mappings) {
  try {
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (!indexExists.body) {
      await esClient.indices.create({
        index: indexName,
        body: {
          mappings,
        },
      });
      console.log(`Index "${indexName}" created successfully`);
    } else {
      console.log(`Index "${indexName}" already exists`);
    }
  } catch (error) {
    console.error(`Error creating index "${indexName}":`, error);
  }
}

// Создаем индексы
(async () => {
  await createIndexIfNotExists('clients', {
    properties: {
      client_id: { type: 'integer' },
      surname: { type: 'text' },
      name: { type: 'text' },
      patronymic: { type: 'text' },
      gender: { type: 'integer' },
      birthday: { type: 'date' },
      date_create: { type: 'date' },
      user_created_id: { type: 'integer' },
      branch_id: { type: 'integer' },
    },
  });

  await createIndexIfNotExists('relatives', {
    properties: {
      relative_id: { type: 'integer' },
      surname: { type: 'text' },
      name: { type: 'text' },
      patronymic: { type: 'text' },
      relative_type_id: { type: 'integer' },
      date_create: { type: 'date' },
      user_created_id: { type: 'integer' },
      branch_id: { type: 'integer' },
    },
  });

  await createIndexIfNotExists('telephone_numbers', {
    properties: {
      telephone_number_id: { type: 'integer' },
      telephone: { type: 'keyword' }, // Используем keyword для точного поиска
      relative_id: { type: 'integer' },
      branch_id: { type: 'integer' },
    },
  });

  // Добавьте другие индексы по необходимости
})();
