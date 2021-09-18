const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const app = express();

app.use(morgan('dev'));
require('dotenv').config();

app.use(helmet());

const corsOptions = {
  origin: 'http://localhost:3000',
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

const session = require('express-session');
const passport = require('passport');

require('./pool.db').getPool();

const sessionStoreConfig = require('./configs/db.sessionStore.config');
const MySQLStore = require('express-mysql-session')(session);
const sessionStore = new MySQLStore(sessionStoreConfig);

const users = require('./components/users');
const clients = require('./components/clients');

require('./configs/passport.config')(passport);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { DateTime } = require('luxon');

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: 'id',
    cookie: {
      httpOnly: true,
      maxAge: DateTime.now().endOf('day').toMillis() - DateTime.now().toMillis(),
    },
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/v1/auth', users.api);
app.use('/api/v1/clients', clients.api);

app.use(function (req, res, next) {
  res.status(404).send('Not found');
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}
