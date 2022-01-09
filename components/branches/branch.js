const escapeHtml = require('escape-html');

class Branch {
  constructor({ params = null }) {
    if (params) {
      this.params = {};

      if (params.sortings && Array.isArray(params.sortings)) {
        this.params.sortings = params.sortings.map((param) => {
          return {
            name: escapeHtml(param.name),
            type: escapeHtml(param.type),
          };
        });
      }

      if (params.filters) {
        this.params.filters = {};

        const filterNames = Object.keys(params.filters);

        filterNames.forEach((filterName) => {
          this.params.filters[filterName] = params.filters[filterName];
        });
      }
    }
  }
}

module.exports = Branch;
