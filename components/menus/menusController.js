const menusDAL = require('./menusDAL');
const usersDAL = require('../users/usersDAL');

class MenusController {
  async get(req, res, next) {
    try {
      const currentUserId = await usersDAL.getUserIdFromSession(req.sessionID);
      const result = await menusDAL.getMainMenu({}, currentUserId);

      res.status(200).json(result);
    } catch (error) {
      console.log('controller menus get error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new MenusController();
