const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

app.set('trust proxy', 1);

app.use(cookieParser());
app.use(morgan('dev'));
require('dotenv').config();

app.use(helmet());

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000, // лимит для каждого IP
});
app.use(limiter);

const corsOptions = {
  origin: ['http://localhost:3000', 'http://89.169.0.139:3000', 'http://frontend:3000', 'http://frontend:80'],
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

require('./pool.db').getPool();

const sessionStoreConfig = require('./configs/db.sessionStore.config');
const MySQLStore = require('express-mysql-session')(session);
const sessionStore = new MySQLStore(sessionStoreConfig);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    name: 'id',
    cookie: {
      httpOnly: true,
      // maxAge: DateTime.now().endOf('day').toMillis() + DateTime.now().toMillis(),
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: 'lax',
      secure: false, // TODO
    },
    store: sessionStore,
    resave: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

require('./configs/passport.config')(passport);

const users = require('./components/users');
const clients = require('./components/clients');
const abonements = require('./components/abonements');
const branches = require('./components/branches');
const menus = require('./components/menus');
const relatives = require('./components/relatives');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { DateTime } = require('luxon');

app.use('/api/v1/auth', users.api);
app.use('/api/v1/clients', clients.api);
app.use('/api/v1/abonements', abonements.api);
app.use('/api/v1/branches', branches.api);
app.use('/api/v1/menus', menus.api);
app.use('/api/v1/relatives', relatives.api);

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
