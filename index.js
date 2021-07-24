const express = require('express');
const app = express();

const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');

require('./pool.db').getPool();

const users = require('./components/users');

require('./configs/passport.config')(passport);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
    },
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use('/api/v1/signup', users.api.signup);
app.use('/api/v1/logout', users.api.logout);

// app.use(function (req, res, next) {
//   res.status(404).send('Not found');
// });

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}
