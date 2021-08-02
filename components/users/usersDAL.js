const pool = require('../../pool.db').getPool();
const bcrypt = require('bcrypt');

const saltRounds = 10;

class UsersModel {
  async add({ email, password, surname, name, patronymic }) {
    const sql = 'SELECT add_user(?, ?, 0, ?, ?, ?, NULL) AS userId';
    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      const passwordHashed = await bcrypt.hash(password, saltRounds);
      const params = [email, passwordHashed, surname, name, patronymic];

      const [rows, fields, error] = await poolPromise.execute(sql, params);

      const userId = rows[0].userId;

      if (error) throw error;

      return userId;
    } catch (error) {
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async isExist(email) {
    const sql = 'SELECT EXISTS(SELECT users_id FROM mydb.users WHERE email = ? LIMIT 1) AS value ';
    const params = [email];
    let poolPromise = null;

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (rows[0].value > 0) {
        throw `Email ${email} is already exists`;
      }
    } catch (error) {
      console.log('error dal', error);

      throw new Error(error);
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async getUserByEmail(email) {
    const sql = 'SELECT * FROM `users` where `email` = ?';
    let poolPromise = null;

    let params = [email];

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (error) throw error;

      return rows[0];
    } catch (error) {
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async getUserById(userId) {
    const sql = 'SELECT * FROM `users` where `users_id` = ?';
    let poolPromise = null;

    let params = [userId];

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (error) throw error;

      return rows[0];
    } catch (error) {
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }
}

module.exports = new UsersModel();
