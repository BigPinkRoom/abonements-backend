const { DateTime } = require('luxon');
const { searchConstants } = require('./constants');
const helpersDate = require('../../helpers/helpersDate');

/**
 * Форматирует результаты поиска Elasticsearch для фронтенда.
 * @param {Array} hits - Массив совпадений из Elasticsearch.
 * @returns {Array} - Массив объектов с _id и _source.
 */
function formatSearchHits(hits) {
  if (!Array.isArray(hits)) return [];
  return hits.map((hit) => ({
    _id: hit._id,
    ...hit._source,
  }));
}

module.exports = {
  searchResponseModel: formatSearchHits,
};
