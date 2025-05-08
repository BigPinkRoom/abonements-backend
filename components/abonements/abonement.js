const escapeHtml = require('escape-html');

class Abonement {
  constructor({ abonements = null, params = null, family = null }) {
    if (Array.isArray(abonements)) {
      this.abonements = abonements.map((abonement) => ({
        number: escapeHtml(abonement.number),
        visits_quantity: escapeHtml(abonement.visits_quantity),
        status: escapeHtml(abonement.status),
        date_start: escapeHtml(abonement.date_start),
        date_end: escapeHtml(abonement.date_end),
      }));
    }
    if (family) {
      const rawFamily = {};
      rawFamily.clients = JSON.parse(family.clients);
      rawFamily.relatives = JSON.parse(family.relatives);
      rawFamily.abonements = JSON.parse(family.abonements);

      const safeFamily = this._getSafeFamily(rawFamily);

      this.family = safeFamily;
    }

    if (params) {
      console.log('params', params);
      this.params = {
        sortings: [],
        filters: {},
      };

      if (params.sortings && Array.isArray(params.sortings)) {
        this.params.sortings = params.sortings.map((param) => ({
          name: escapeHtml(param.name),
          type: escapeHtml(param.type),
        }));
      }

      if (params.filters) {
        const filterNames = Object.keys(params.filters);

        filterNames.forEach((filterName) => {
          this.params.filters[filterName] = params.filters[filterName];
        });
      }
    }
  }

  _getSafeFamily(family) {
    const safeFamily = {
      clients: [],
      relatives: [],
      abonements: [],
    };

    function escapeObjectValues(obj) {
      const escapedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'gender') {
            escapedObj[key] = Number(escapeHtml(obj[key]));
          } else {
            escapedObj[key] = escapeHtml(obj[key]);
          }
        }
      }
      return escapedObj;
    }

    family.clients.forEach((client) => {
      safeFamily.clients.push(escapeObjectValues(client));
    });

    family.relatives.forEach((relative) => {
      safeFamily.relatives.push(escapeObjectValues(relative));
    });

    if (Array.isArray(family.abonements)) {
      family.abonements.forEach((abonement) => {
        if (typeof abonement === 'object' && abonement !== null) {
          safeFamily.abonements.push(escapeObjectValues(abonement));
        } else {
          safeFamily.abonements.push(escapeHtml(abonement));
        }
      });
    }

    return safeFamily;
  }
}

module.exports = Abonement;
