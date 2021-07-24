const mysql = require('mysql2');
const dbConfig = require('./configs/db.config');

let pool = null;

const getPool = () => {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool(dbConfig);
};

module.exports.getPool = getPool;
