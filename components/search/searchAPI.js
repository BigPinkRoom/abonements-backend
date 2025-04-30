const { Router } = require('express');
const router = Router();
const controller = require('./searchController');
// const commonController = require('../common/commonController');
const validation = require('./searchValidation');

router.post('/search-family', validation.searchMiddleware(validation.getSearchesSchema()), controller.search);

module.exports = router;
