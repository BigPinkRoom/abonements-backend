const esClient = require('../elasticsearch.client');

// Создаем клиент Elasticsearch
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200', // URL Elasticsearch
});

// Функция для проверки подключения к Elasticsearch
async function checkConnection() {
  try {
    const health = await esClient.cluster.health({});
    console.log('Elasticsearch cluster health:', health.body);
  } catch (error) {
    console.error('Error connecting to Elasticsearch:', error);
  }
}

// Функция для создания индекса
async function createIndex(indexName, mappings) {
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
