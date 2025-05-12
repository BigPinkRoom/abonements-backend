const escapeHtml = require('escape-html');

class Relative {
  constructor(params = {}) {
    if (params) {
      this.params = {};

      if (params.id) {
        this.id = escapeHtml(params.id);
      }
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
          this.params.filters[filterName] = escapeHtml(params.filters[filterName]);
        });
      }
    }
  }
}

module.exports = Relative;
