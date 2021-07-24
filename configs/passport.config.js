const LocalStrategy = require('passport-local').Strategy;
const User = require('../components/users/user');
const userDal = require('../components/users/usersDAL');
// const escapeHtml = require('escape-html');

module.exports = function (passport) {
  passport.serializeUser(function (user, done) {
    console.log('serialize', user);

    done(null, user.users_id);
  });

  passport.deserializeUser(async function (id, done) {
    try {
      const user = await userDal.getUser(id);

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
        console.log('email', email);
        console.log('password', password);

        const user = new User(req.body);

        const userId = await userDal.add(user);
        user.users_id = userId;

        try {
          console.log('success', user);
          return done(null, user);
        } catch (error) {
          return done(null, false, req.flash(error));
        }
      }
    )
  );
};
