const { Client } = require('@elastic/elasticsearch');
const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL,
});

module.exports = { esClient };
