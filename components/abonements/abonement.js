const escapeHtml = require('escape-html');

class Abonement {
  constructor({ abonement = null, params = null }) {
    if (abonement) {
      this.abonement = {
        number: escapeHtml(abonement.number),
        visits_quantity: escapeHtml(abonement.visits_quantity),
        status: escapeHtml(abonement.status),
        date_start: escapeHtml(abonement.date_start),
        date_end: escapeHtml(abonemet.date_end),
      };
    }

    if (params) {
      this.params = {
        sortings: params.sortings.map((param) => {
          return {
            name: escapeHtml(param.name),
            type: escapeHtml(param.type),
          };
        }),
      };
    }
  }
}

module.exports = Abonement;
