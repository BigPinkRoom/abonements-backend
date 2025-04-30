const { esClient } = require('../../elasticsearch.client');
const { searchResponseModel } = require('./searchService');

class SearchModel {
  async searchClients({ searchString }) {
    try {
      const response = await esClient.search({
        index: 'families',
        size: 5,
        query: {
          bool: {
            should: [
              // Поиск по родителям
              {
                nested: {
                  path: 'relatives', // Убедитесь, что это поле существует в маппинге
                  query: {
                    multi_match: {
                      query: searchString,
                      fields: [
                        'relatives.telephone^4',
                        'relatives.surname^3',
                        'relatives.name^2',
                        'relatives.patronymic',
                      ],
                      fuzziness: 'AUTO',
                    },
                  },
                },
              },
              // Поиск по детям
              {
                nested: {
                  path: 'clients', // Убедитесь, что это поле существует в маппинге
                  query: {
                    multi_match: {
                      query: searchString,
                      fields: ['clients.surname^3', 'clients.name^2', 'clients.patronymic'],
                      fuzziness: 'AUTO',
                    },
                  },
                },
              },
            ],
          },
        },
      });

      // Проверяем наличие результатов
      if (!response || !response.hits) {
        console.error('Unexpected Elasticsearch response:', response);
        return [];
      }
      const searchResponse = await searchResponseModel(response.hits.hits);

      return searchResponse || [];
    } catch (error) {
      console.error('Search error:', error.message);
      throw error;
    }
  }

  async addToIndex(indexName, documentData) {
    try {
      const response = await esClient.index({
        index: indexName,
        document: documentData,
      });

      console.log(`✅ Данные добавлены в "${indexName}". ID: ${response._id}`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка добавления в "${indexName}":`, error.message);
      return false;
    }
  }
}

module.exports = new SearchModel();
