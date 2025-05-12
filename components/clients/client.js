const escapeHtml = require('escape-html');

class Client {
  constructor({ clients = null, relatives = null, telephones = null, search = null, params = null, id = null }) {
    if (id) {
      this.id = escapeHtml(id);
    }
  }
}

module.exports = Client;
