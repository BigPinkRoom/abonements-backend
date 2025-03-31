const pool = require('../../pool.db').getPool();
const helpersDAL = require('../../helpers/helpersDAL');

const { menusConstants } = require('./constants');

class MenusModel {
  async getMainMenu({ sortings = [] } = {}, userId = null) {
    const sqlSorting = helpersDAL.createSortingString(sortings) || '';

    const params = [userId];

    let sql = null;

    const sqlMenuByUserId = `
      SELECT 
        main_menu.menu_item_id,
        main_menu.name
      FROM 
        users
      JOIN 
        roles ON users.role_id = roles.role_id
      JOIN 
        roles_menus ON roles.role_id = roles_menus.rl_mn_role_id
      JOIN 
        main_menu ON roles_menus.rl_mn_menu_item_id = main_menu.menu_item_id
      WHERE 
        users.user_id = ?;
      ${sqlSorting};`;

    const sqlMenuByRoleId = `
      SELECT
        main_menu.menu_item_id,
        main_menu.name
      FROM
        roles
      JOIN
        roles_menus ON roles.role_id = roles_menus.rl_mn_role_id
      JOIN
        main_menu ON roles_menus.rl_mn_menu_item_id = main_menu.menu_item_id
      WHERE
        roles.role_id = ${menusConstants.MENUS_GUEST_ROLE_ID};
      ${sqlSorting}`;

    if (userId) {
      sql = sqlMenuByUserId;
    } else {
      sql = sqlMenuByRoleId;
    }

    let poolPromise = null;

    try {
      poolPromise = pool.promise();

      const [rows, fields, error] = await poolPromise.execute(sql, params);
      const result = rows;

      if (error) throw error;

      return result;
    } catch (error) {
      console.log('mysql error', error);

      throw error;
    } finally {
      pool.releaseConnection(poolPromise);
    }
  }
}

module.exports = new MenusModel();
