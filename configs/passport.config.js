const LocalStrategy = require('passport-local').Strategy;
const User = require('../components/users/user');
const service = require('../components/users/usersService');
const usersDal = require('../components/users/usersDAL');
const bcrypt = require('bcrypt');
// const escapeHtml = require('escape-html');

module.exports = function (passport) {
  passport.serializeUser(function (user, done) {
    done(null, user.user_id);
  });

  passport.deserializeUser(async function (userId, done) {
    try {
      const user = await usersDal.getUserById(userId);

      if (!user) done(new Error('User not found'));

      const safeUser = service.createSafeUser(user);

      done(null, safeUser);
    } catch (error) {
      done(error);
    }
  });

  passport.use(
    'sign-up',
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async function (req, email, password, done) {
        const user = new User(req.body);

        const userId = await usersDal.add(user);
        user.user_id = userId;

        try {
          return done(null, user);
        } catch (error) {
          return done(null, false, req.flash(error));
        }
      }
    )
  );
  passport.use(
    'login',
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true,
      },
      async function (req, email, password, done) {
        try {
          const user = await usersDal.getUserByEmail(email);

          if (!user) {
            return done(null, false, { message: `User with email ${email} was not found` });

            // TODO delete
            // return done(null, false, createError(401, `User with email ${email} was not found`));
          }

          const userHash = user.password;
          const match = await bcrypt.compare(password, userHash);

          if (!match) {
            return done(null, false, { message: 'Not a matching password' });
          }

          const safeUser = service.createSafeUser(user);

          return done(null, safeUser);
        } catch (error) {
          console.log('passport error login', error);
          return done(error);
        }
      }
    )
  );
};
