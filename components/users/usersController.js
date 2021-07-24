const model = require('./usersDAL');
const service = require('./usersService');
const passport = require('passport');

class UsersController {
  async add(req, res, next) {
    try {
      await passport.authenticate('sign-up', function (err, user, info) {
        if (err) return next(err);
        res.status(201).json('user created');
      })(req, res, next);
    } catch (error) {
      console.log('controller error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async update(req, res) {
    let rawData = {};
  }

  async logout(req, res) {
    try {
      req.logout();
      // req.session.destroy();
      // res.clearCookie('connect.sid');
      res.status(200).json('Succussefully logged out');
    } catch (error) {
      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async isAuthenticated(req, res, next) {
    try {
      if (req.isAuthenticated()) {
        return next();
      } else {
        return new Error({ error: { message: '401 User is not authenticated' } });
      }
    } catch (error) {
      console.log('controller error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new UsersController();
