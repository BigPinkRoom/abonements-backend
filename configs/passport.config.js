const LocalStrategy = require('passport-local').Strategy;
const User = require('../components/users/user');
const service = require('../components/users/usersService');
const userDal = require('../components/users/usersDAL');
const bcrypt = require('bcrypt');
// const escapeHtml = require('escape-html');

module.exports = function (passport) {
  passport.serializeUser(function (user, done) {
    console.log('serialize', user);

    done(null, user.user_id);
  });

  passport.deserializeUser(async function (id, done) {
    try {
      console.log('start serialize');
      const user = await userDal.getUserById(id);

      console.log('de seiralize', user);

      if (!user) done(new Error('User not found'));

      done(null, user);
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

        const userId = await userDal.add(user);
        user.users_id = userId;

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
          const user = await userDal.getUserByEmail(email);

          if (!user) {
            return done(null, false, `User with email ${email} was not found`);
            // return done(null, false, createError(401, `User with email ${email} was not found`));
          }

          const userHash = user.password;

          const match = await bcrypt.compare(password, userHash);

          const safeUser = service.createSafeUser(user);

          if (!match) {
            return done(null, false, 'Not a matching password');
          }

          return done(null, safeUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};
