const escapeHtml = require('escape-html');

class Search {
  constructor({ searchString = null }) {
    if (searchString) {
      this.searchString = escapeHtml(searchString);

      return {
        searchString: this.searchString,
      };
    }
  }
}

module.exports = Search;
