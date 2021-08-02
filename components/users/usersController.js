const model = require('./usersDAL');
const service = require('./usersService');
const passport = require('passport');
// require('../../configs/passport.config')(passport);

class UsersController {
  async add(req, res, next) {
    try {
      await passport.authenticate('sign-up', function (err, user, info) {
        if (err) return next(err);

        res.status(201).json('user created');
      })(req, res, next);
    } catch (error) {
      console.log('controller add error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      await passport.authenticate('login', function (err, user, info) {
        if (!user) {
          res.status(400).json({ error: { message: info } });
        } else {
          // req.session.touch();
          req.login(user, function (err) {
            res.status(200).json(user);
            next();
          });
        }
      })(req, res, next);
    } catch (error) {
      console.log('controller login error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async getAuthUser(req, res, next) {
    try {
      res.status(200).json(req.user);
    } catch (error) {
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
      res.clearCookie('id');
      req.session.destroy();
      res.status(200).json('Succussefully logged out');
    } catch (error) {
      console.log('controller logout error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }

  async isAuthenticated(req, res, next) {
    try {
      console.log('is authenticated start', req.user);
      if (req.isAuthenticated()) {
        console.log('auth success');
        return next();
      } else {
        console.log('auth error');
        res.status(401).json({ error: { message: 'User is not authenticated' } });
        return new Error({ error: { message: 'User is not authenticated' } });
      }
    } catch (error) {
      console.log('controller is authenticated error', error);

      res.status(500).json({ error: { message: error } });
      next(error);
    }
  }
}
module.exports = new UsersController();
