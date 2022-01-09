const pool = require('../../pool.db').getPool();
const bcrypt = require('bcrypt');

const saltRounds = 10;

class UsersModel {
  async add({ email, password, surname, name, patronymic, branch }) {
    const sql = 'SELECT add_user(?, ?, 0, ?, ?, ?, NULL, ?) AS userId;';
    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      const passwordHashed = await bcrypt.hash(password, saltRounds);
      const params = [email, passwordHashed, surname, name, patronymic, branch];

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

  async isExist(email, branchId) {
    const sql = 'SELECT EXISTS(SELECT user_id FROM mydb.users WHERE email = ? AND branch_id = ? LIMIT 1) AS value;';
    const params = [email, branchId];
    let poolPromise = null;

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (rows[0].value > 0) {
        throw `Email ${email} is already exists`;
      }
    } catch (error) {
      console.log('error dal', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async getUserByEmail(email, branchId) {
    const sql = `SELECT users.*, roles.name AS role_name FROM users 
    LEFT JOIN roles ON users.role_id = roles.role_id 
    WHERE users.email = ? AND branch_id = ?;`;
    let poolPromise = null;

    let params = [email, branchId];

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (error) throw error;

      return rows[0];
    } catch (error) {
      console.log('error get user by email');
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  async getUserById(userId) {
    const sql =
      'SELECT users.*, roles.name AS `role_name` FROM users LEFT JOIN `roles` ON users.role_id = roles.role_id WHERE users.user_id = ?';
    let poolPromise = null;

    let params = [userId];

    try {
      poolPromise = pool.promise();
      const [rows, fields, error] = await poolPromise.execute(sql, params);

      if (error) throw error;

      return rows[0];
    } catch (error) {
      console.log('error get user by id');
      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }

  // TODO delete
  // async getUserRole(roleId) {
  //   const sql = 'SELECT * FROM `roles` WHERE `role_id` = ?';
  //   let poolPromise = null;

  //   let params = [roleId];

  //   try {
  //     poolPromise = pool.promise();
  //     const [rows, fields, error] = await poolPromise.execute(sql, params);

  //     if (error) throw error;

  //     return rows[0];
  //   } catch (error) {
  //     throw error;
  //   } finally {
  //     pool.releaseConnection(poolPromise);
  //   }
  // }
}

module.exports = new UsersModel();
