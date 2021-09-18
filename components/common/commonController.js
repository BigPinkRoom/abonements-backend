const service = require('../common/commonService');

class CommonController {
  checkAccess(rolesArray) {
    return async (req, res, next) => {
      try {
        if (req.isAuthenticated()) {
          if (!service.checkUserRole(req.user.user_role, rolesArray)) {
            res.status(403).json({ error: { message: 'Forbidden' } });
          }

          next();
        } else {
          res.status(401).json({ error: { message: 'User is not authenticated' } });
          // return new Error({ error: { message: 'User is not authenticated' } });
        }
      } catch (error) {
        res.status(500).json({ error: { message: error } });
        next(error);
      }
    };
  }

  async isNotAuthenticated(req, res, next) {
    try {
      if (!req.isAuthenticated()) {
        next();
      } else {
        res.status(401).json({ error: { message: 'User must be in not authenticated' } });
        // return new Error({ error: { message: 'User must be in not authenticated' } });
      }
    } catch (error) {
      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new CommonController();
