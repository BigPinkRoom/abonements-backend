const { esClient } = require('./elasticsearch.client');

async function createIndexIfNotExists(indexName, settings, mappings) {
  try {
    const indexExists = await esClient.indices.exists({ index: indexName });
    if (!indexExists.body) {
      await esClient.indices.create({
        index: indexName,
        body: {
          settings, // Настройки анализатора
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

(async () => {
  // Общие настройки анализатора для индекса families
  const edgeNgramSettings = {
    index: {
      max_ngram_diff: 2, // Устанавливаем максимальную разницу между max_gram и min_gram
    },
    analysis: {
      filter: {
        lowercase: {
          type: 'lowercase',
        },
      },
      analyzer: {
        my_edge_ngram_analyzer: {
          type: 'custom',
          tokenizer: 'my_edge_ngram_tokenizer',
          filter: ['lowercase'],
        },
        telephone_ngram_analyzer: {
          type: 'custom',
          tokenizer: 'telephone_ngram_tokenizer',
          filter: ['lowercase'],
        },
      },
      tokenizer: {
        my_edge_ngram_tokenizer: {
          type: 'edge_ngram',
          min_gram: 3,
          max_gram: 10,
          token_chars: ['letter', 'digit'],
        },
        telephone_ngram_tokenizer: {
          type: 'ngram',
          min_gram: 3,
          max_gram: 5,
          token_chars: ['digit'],
        },
      },
    },
  };

  // Создаем индекс families
  await createIndexIfNotExists(
    'families',
    edgeNgramSettings, // Настройки анализатора
    {
      properties: {
        relatives: {
          type: 'nested', // Массив родителей
          properties: {
            parent_id: { type: 'integer' }, // Уникальный ID родителя
            surname: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' }, // Подполе для точного поиска
              },
            },
            name: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            patronymic: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            telephone: {
              type: 'text',
              analyzer: 'telephone_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            releative_type_id: { type: 'integer' },
          },
        },
        clients: {
          type: 'nested', // Массив детей
          properties: {
            child_id: { type: 'integer' }, // Уникальный ID ребенка
            surname: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            name: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            patronymic: {
              type: 'text',
              analyzer: 'my_edge_ngram_analyzer',
              search_analyzer: 'standard',
              fields: {
                keyword: { type: 'keyword' },
              },
            },
            gender: { type: 'integer' },
            birthday: { type: 'date', format: 'dd.MM.yyyy || strict_date_optional_time || epoch_millis' },
          },
        },
      },
    }
  );
})();
